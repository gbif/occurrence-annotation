const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(name) {
  const filename = path.join(__dirname, '..', 'utils', `${name}.ts`);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, URLSearchParams,
    require: dependency => dependency === './gbifOccurrenceIds' ? load('gbifOccurrenceIds') : {},
  }, { filename });
  return exports;
}

const { parseGbifOccurrenceIds, appendGbifOccurrenceIds } = load('gbifOccurrenceIds');
const plain = value => JSON.parse(JSON.stringify(value));
const checklistKey = '7ddf754f-d193-4cc9-b351-99906754a03b';

function componentExpression(filename, predicate, context) {
  const file = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  let expression;
  function visit(node) {
    if (predicate(node)) expression = node;
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(expression, 'Component expression not found');
  const source = ts.transpileModule(`globalThis.expression = ${expression.getText(file)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const scope = { URLSearchParams, appendGbifOccurrenceIds, GBIF_BACKBONE_UUID: checklistKey, ...context };
  vm.runInNewContext(source, scope, { filename });
  return scope.expression;
}

const mapFilename = path.join(__dirname, '..', 'components', 'MapComponent.tsx');
const initializer = name => node =>
  ts.isArrowFunction(node) && ts.isVariableDeclaration(node.parent) && node.parent.name.getText() === name;

test('parses single and multiple GBIF IDs without losing precision', () => {
  assert.deepEqual(plain(parseGbifOccurrenceIds('182368733')), ['182368733']);
  assert.deepEqual(
    plain(parseGbifOccurrenceIds(' 182368733, 182368734\n182368735\t182368736 ')),
    ['182368733', '182368734', '182368735', '182368736']
  );
  assert.deepEqual(plain(parseGbifOccurrenceIds('9007199254740993')), ['9007199254740993']);
});

test('normalizes and deduplicates IDs and allows clearing the filter', () => {
  assert.deepEqual(plain(parseGbifOccurrenceIds('000182368733,182368733')), ['182368733']);
  for (const input of ['', ' \n\t ']) {
    assert.deepEqual(plain(parseGbifOccurrenceIds(input)), []);
  }
});

test('rejects invalid inputs rather than silently broadening the search', () => {
  for (const input of ['0', '000', '-1', '1.5', '1e9', 'abc', '182368733,invalid', ',,,']) {
    assert.throws(() => parseGbifOccurrenceIds(input), /positive numeric GBIF occurrence IDs/);
  }
});

test('uses repeated gbifId parameters and preserves existing search and tile filters', () => {
  for (const initial of [
    'taxonKey=9ZGGV&checklistKey=checklist&occurrenceStatus=PRESENT&limit=20',
    'taxonKey=9ZGGV&checklistKey=checklist&srs=EPSG%3A3857&style=scaled.circles&mode=GEO_CENTROID',
  ]) {
    const params = new URLSearchParams(initial);
    appendGbifOccurrenceIds(params, ['182368733', '182368734']);
    assert.deepEqual(params.getAll('gbifId'), ['182368733', '182368734']);
    assert.equal(params.has('occurrenceId'), false);
    for (const [key, value] of new URLSearchParams(initial)) {
      assert.equal(params.get(key), value);
    }
    const unfiltered = new URLSearchParams(initial);
    appendGbifOccurrenceIds(unfiltered);
    appendGbifOccurrenceIds(unfiltered, []);
    assert.equal(unfiltered.toString(), initial);
  }
});

test('coordinate-less country queries use the same IDs with taxon and checklist filters', () => {
  const { coordinateLessCountryQuery } = load('coordinateLessCountries');
  const params = new URLSearchParams(coordinateLessCountryQuery('9ZGGV', {
    gbifId: ['182368733', '182368734'],
    datasetKey: 'dataset', yearRange: { min: 2000, max: 2026 },
    basisOfRecord: ['HUMAN_OBSERVATION'], hasGeospatialIssue: false,
  }, 'selected-checklist'));
  assert.deepEqual(params.getAll('gbifId'), ['182368733', '182368734']);
  assert.equal(params.get('taxonKey'), '9ZGGV');
  assert.equal(params.get('checklistKey'), 'selected-checklist');
  assert.equal(params.get('hasCoordinate'), 'false');
  assert.equal(params.get('occurrenceStatus'), 'PRESENT');
  assert.equal(params.get('datasetKey'), 'dataset');
  assert.equal(params.get('year'), '2000,2026');
  assert.equal(params.get('basisOfRecord'), 'HUMAN_OBSERVATION');
  assert.equal(params.get('hasGeospatialIssue'), 'false');
  assert.equal(params.has('occurrenceId'), false);
});

test('actual map tile builder combines GBIF IDs with existing occurrence filters', () => {
  const build = componentExpression(mapFilename, initializer('buildGbifTileUrl'), {
    occurrenceFilters: {
      gbifId: ['182368733', '182368734'], showOnlyPresent: false,
      datasetKey: 'dataset', yearRange: { min: 2000, max: 2026 },
      basisOfRecord: ['HUMAN_OBSERVATION'], hasGeospatialIssue: false,
    },
  });
  const url = new URL(build(2, 1, 0, '9ZGGV'));
  assert.equal(url.pathname, '/v2/map/occurrence/adhoc/2/1/0@2x.png');
  assert.deepEqual(url.searchParams.getAll('gbifId'), ['182368733', '182368734']);
  assert.equal(url.searchParams.get('taxonKey'), '9ZGGV');
  assert.equal(url.searchParams.get('checklistKey'), checklistKey);
  assert.equal(url.searchParams.get('datasetKey'), 'dataset');
  assert.equal(url.searchParams.get('year'), '2000,2026');
  assert.equal(url.searchParams.get('basisOfRecord'), 'HUMAN_OBSERVATION');
  assert.equal(url.searchParams.get('hasGeospatialIssue'), 'false');
  assert.equal(url.searchParams.has('occurrenceStatus'), false);
  assert.equal(url.searchParams.has('occurrenceId'), false);
});

test('actual tile updater refreshes filtered URLs without moving the map', () => {
  let tiles = [];
  let id = '182368733';
  const update = componentExpression(mapFilename, node =>
    ts.isArrowFunction(node) && ts.isCallExpression(node.parent) &&
    node.parent.expression.getText() === 'useEffect' && node.getText().includes('const newTiles:'), {
    selectedSpecies: { key: '9ZGGV' }, mapSize: { width: 1, height: 1 },
    isZooming: false, zoom: 2, center: [0, 0],
    latLngToTileWebMercator: () => [1, 1],
    tileToLatLngWebMercator: () => [0, 0],
    buildGbifTileUrl: (z, x, y) => `tile/${z}/${x}/${y}?gbifId=${id}`,
    setGbifTiles: updater => { tiles = typeof updater === 'function' ? updater(tiles) : updater; },
  });
  update();
  const initial = tiles;
  update();
  assert.equal(tiles, initial, 'Unchanged URLs should reuse tiles');
  id = '182368734';
  update();
  assert.notEqual(tiles, initial, 'Changed filter must replace tiles even at the same position');
  assert.ok(tiles.every(tile => tile.url.endsWith('gbifId=182368734')));
});

test('actual investigation search retains IDs, taxon/checklist, bounds and other filters', async () => {
  let url;
  const noop = () => {};
  const investigate = componentExpression(mapFilename, initializer('investigateArea'), {
    selectedSpecies: { key: '9ZGGV', scientificName: 'Test species' },
    isInvestigateMode: true, investigateRadius: 200000,
    occurrenceFilters: {
      gbifId: ['182368733', '182368734'], datasetKey: 'dataset',
      year: '2020', basisOfRecord: ['HUMAN_OBSERVATION'], distanceFromCentroid: true,
    },
    setInvestigationPoint: noop, setIsInvestigateLoading: noop,
    setInvestigateResults: noop, setIsInvestigateDialogOpen: noop, setInvestigationBounds: noop,
    toast: { info: noop, error: message => assert.fail(message) }, console,
    fetch: async requested => { url = requested; return { ok: true, json: async () => ({ results: [] }) }; },
  });
  await investigate(20, 10);
  const params = new URL(url).searchParams;
  assert.deepEqual(params.getAll('gbifId'), ['182368733', '182368734']);
  assert.equal(params.get('taxonKey'), '9ZGGV');
  assert.equal(params.get('checklistKey'), checklistKey);
  assert.equal(params.get('hasCoordinate'), 'true');
  assert.ok(params.has('decimalLatitude') && params.has('decimalLongitude'));
  assert.equal(params.get('occurrenceStatus'), 'PRESENT');
  assert.equal(params.get('datasetKey'), 'dataset');
  assert.equal(params.get('year'), '2020');
  assert.equal(params.get('basisOfRecord'), 'HUMAN_OBSERVATION');
  assert.equal(params.get('distanceFromCentroidInMeters'), '0,5000');
});

test('creating a rule from a search never copies GBIF IDs into rule filters', () => {
  let polygon;
  const appFilename = path.join(__dirname, '..', 'App.tsx');
  const create = componentExpression(appFilename, node =>
    ts.isArrowFunction(node) && ts.isCallExpression(node.parent) &&
    ts.isVariableDeclaration(node.parent.parent) &&
    node.parent.parent.name.getText() === 'handleCreateRuleFromSearch', {
    occurrenceFilters: { gbifId: ['182368733'], datasetKey: 'dataset', basisOfRecord: ['HUMAN_OBSERVATION'] },
    selectedSpecies: { key: '9ZGGV' }, currentAnnotation: 'SUSPICIOUS',
    setSavedPolygons: updater => { polygon = updater([])[0]; }, setCurrentPolygon: () => {},
  });
  create([[0, 0], [1, 1], [0, 0]]);
  assert.deepEqual(plain(polygon.initialFilters), {
    datasetKey: 'dataset', basisOfRecord: ['HUMAN_OBSERVATION'],
  });
  assert.equal(JSON.stringify(polygon).includes('gbifId'), false);
});

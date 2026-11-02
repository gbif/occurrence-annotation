const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(fetch, sourceInfo) {
  const cache = new Map();
  function module(name) {
    if (name === './apiConfig') return {
      getColApiUrl: endpoint => `https://api.checklistbank.org${endpoint}`,
      getGbifApiUrl: endpoint => `https://api.gbif.org/v1${endpoint}`,
    };
    if (cache.has(name)) return cache.get(name);
    const filename = path.join(__dirname, '..', 'utils', `${name.slice(2)}.ts`);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const exports = {};
    cache.set(name, exports);
    const request = async (url, options) => {
      if (url.includes('/v2/experimental/taxon/')) {
        const key = decodeURIComponent(url.split('/').at(-2));
        return response(sourceInfo ?? {
          taxonID: key,
          checklistbankURL: `https://www.checklistbank.org/dataset/315557/taxon/${key}`,
        });
      }
      return fetch(url, options);
    };
    vm.runInNewContext(source, { exports, require: module, fetch: request, console, URL }, { filename });
    return exports;
  }
  return module('./colDistributions');
}

const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
const feature = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } };
const info = distributions => ({ usage: { id: 'TEST' }, distributions });
const distribution = (gazetteer, id, establishmentMeans) => ({
  area: { gazetteer, id, name: id }, establishmentMeans,
});
const response = data => ({ ok: true, json: async () => data });

test('checks info first and downloads exact ISO and TDWG areas, deduplicating areas', async () => {
  const calls = [];
  const api = load(async url => {
    calls.push(url);
    return response(url.endsWith('/info') ? info([
      distribution('iso', 'DK', 'native'), distribution('tdwg', 'YUG'),
      distribution('iso', 'DK', 'introduced'),
    ]) : feature);
  });
  const result = await api.fetchColDistributions('HWCX', new AbortController().signal);
  assert.match(calls[0], /dataset\/315557\/taxon\/HWCX\/info$/);
  assert.equal(calls.length, 3);
  assert(calls.includes('https://api.checklistbank.org/vocab/area/iso:DK.geojson'));
  assert(calls.includes('https://api.checklistbank.org/vocab/area/tdwg:YUG.geojson'));
  assert.equal(result.areas.length, 2);
  assert.equal(result.areas[0].establishmentMeans.join(','), 'native,introduced');
});

test('no geometry requests when info has no distributions', async () => {
  for (const body of [info([]), { usage: { id: 'TEST' } }]) {
    let calls = 0;
    const api = load(async () => { calls++; return response(body); });
    const result = await api.fetchColDistributions('P', new AbortController().signal);
    assert.equal(result.areas.length, 0);
    assert.equal(calls, 1);
  }
});

test('failed and unresolvable areas are reported without losing valid polygons', async () => {
  const api = load(async url => {
    if (url.endsWith('/info')) return response(info([
      distribution('iso', 'DK'), distribution('tdwg', 'MISSING'), { area: { name: 'Free text' } },
    ]));
    if (url.includes('MISSING')) return { ok: false, status: 404 };
    return response(feature);
  });
  const result = await api.fetchColDistributions('TEST', new AbortController().signal);
  assert.equal(result.areas.length, 1);
  assert.equal([...result.unmapped].sort().join(','), 'Free text,MISSING');
});

test('numeric GBIF keys require exact canonical-name and rank matching', async () => {
  const calls = [];
  const api = load(async url => {
    calls.push(url);
    if (url.includes('/species/')) return response({ canonicalName: 'Calopteryx maculata', rank: 'SPECIES' });
    if (url.includes('/match/')) return response({ usage: { id: 'Q2LL', name: 'Calopteryx maculata', rank: 'species' } });
    return response(info([]));
  });

  await api.fetchColDistributions('123', new AbortController().signal);
  assert.match(calls[2], /taxon\/Q2LL\/info$/);
  const mismatch = load(async url => response(url.includes('/species/') ?
    { canonicalName: 'Other species', rank: 'SPECIES' } :
    { usage: { id: 'Q2LL', name: 'Calopteryx maculata', rank: 'species' } }));
  await assert.rejects(mismatch.fetchColDistributions('123', new AbortController().signal), /No exact COL/);
});

test('free-text red fox regions are reported without guessing or requesting polygons', async () => {
  const names = ['Africa', 'Australia', 'Europe & Northern Asia (excluding China)', 'North America', 'Southern Asia'];
  let calls = 0;
  const api = load(async () => {
    calls++;
    return response(info(names.map(name => ({ area: { gazetteer: 'text', name } }))));
  });
  const result = await api.fetchColDistributions('5BSG3', new AbortController().signal);
  assert.equal(calls, 1);
  assert.equal(result.areas.length, 0);
  assert.equal(result.unmapped.join(';'), names.join(';'));
});

test('explicit COL numeric identifiers are not interpreted as GBIF keys', async () => {
  const calls = [];
  const api = load(async url => { calls.push(url); return response(info([])); });
  await api.fetchColDistributions('123', new AbortController().signal, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /dataset\/315557\/taxon\/123\/info$/);
});

test('extended-release-only taxa use the concrete source dataset, not base COL', async () => {
  const calls = [];
  const api = load(async url => {
    calls.push(url);
    if (url.includes('/dataset/315557/taxon/NBMSV/info')) {
      return response(info([distribution('iso', 'BR', 'native')]));
    }
    if (url.includes('/vocab/area/iso:BR.geojson')) return response(feature);
    throw new Error(`Unexpected dataset request: ${url}`);
  });
  const result = await api.fetchColDistributions('NBMSV', new AbortController().signal);
  assert.equal(result.areas[0].id, 'iso:BR');
  assert.equal(result.areas[0].establishmentMeans[0], 'native');
  assert(!calls.some(url => url.includes('/dataset/3LR/')));
});

test('invalid or mismatched ChecklistBank source links are rejected', async () => {
  for (const checklistbankURL of [
    'https://other.example/dataset/315557/taxon/NBMSV',
    'https://www.checklistbank.org/dataset/315557/taxon/OTHER',
  ]) {
    const api = load(async () => { throw new Error('Should not fetch distribution'); }, {
      taxonID: 'NBMSV', checklistbankURL,
    });
    await assert.rejects(api.fetchColDistributions('NBMSV', new AbortController().signal), /Invalid ChecklistBank/);
  }
});

test('GeoJSON supports multipolygons, holes and dateline normalization', () => {
  const api = load();
  const geometry = { type: 'MultiPolygon', coordinates: [
    [ring, [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.1]]],
    [[[179, 10], [-179, 10], [-179, 12], [179, 10]]],
  ] };
  const parsed = api.parseColGeometry(geometry);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].holes.length, 1);
  assert.equal(parsed[0].holes[0][1][0], 0.1);
  assert.equal(parsed[0].holes[0][1][1], 0.2);
  assert.equal(parsed[1].outer[1][1], 181);
  assert.throws(() => api.parseColGeometry({ type: 'Point', coordinates: [0, 0] }), /no polygon/);
  assert.throws(() => api.parseColGeometry({ type: 'Polygon', coordinates: [[[0, 0]]] }), /ring/);
});

test('invalid info and failed requests do not look like missing distributions', async () => {
  const invalid = load(async () => response({ distributions: [] }));
  await assert.rejects(invalid.fetchColDistributions('TEST', new AbortController().signal), /Invalid COL taxon/);
  const failure = load(async () => ({ ok: false, status: 503 }));
  await assert.rejects(failure.fetchColDistributions('TEST', new AbortController().signal), /503/);
});

test('aborted geometry requests are not converted into partial success', async () => {
  const controller = new AbortController();
  const api = load(async url => {
    if (url.endsWith('/info')) return response(info([distribution('iso', 'DK')]));
    controller.abort();
    throw new Error('aborted');
  });
  await assert.rejects(api.fetchColDistributions('TEST', controller.signal), /aborted/);
});

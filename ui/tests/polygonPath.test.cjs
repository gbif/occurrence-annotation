const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.join(__dirname, '..', 'utils', 'polygonPath.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleExports = {};
vm.runInNewContext(source, { exports: moduleExports, require, WeakMap, Map, Math, Number, Uint8Array }, { filename });
const { mercator, simplify, projectPolygon } = moduleExports;
const plain = value => JSON.parse(JSON.stringify(value));

test('mercator matches the web tile scheme', () => {
  assert.deepEqual(plain(mercator(0, -180).map(v => +v.toFixed(9))), [0, 0.5]);
  assert.deepEqual(plain(mercator(0, 0).map(v => +v.toFixed(9))), [0.5, 0.5]);
  assert.ok(Math.abs(mercator(85.0511287798, 180)[1]) < 1e-9);
});

test('simplify removes points within tolerance and keeps corners', () => {
  const line = [[0, 0], [1, 0.1], [2, 0], [2, 2], [0, 2], [0, 0]];
  assert.deepEqual(plain(simplify(line, 0.5)), [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]);
  assert.deepEqual(plain(simplify(line, 0.01)), line);
});

test('projectPolygon caches per zoom and drops sub-pixel rings', () => {
  const polygon = {
    outer: [[10, -10], [10, 10], [-10, 10], [-10, -10], [10, -10]],
    holes: [[[0, 0], [0, 0.0001], [0.0001, 0.0001], [0, 0]]],
  };
  const projected = projectPolygon(polygon, 2);
  assert.equal(projectPolygon(polygon, 2), projected);
  assert.notEqual(projectPolygon(polygon, 3), projected);
  assert.equal(projected.path.split('Z').length - 1, 1);
  const [minX, , maxX] = projected.bounds;
  assert.ok(Math.abs(minX - (170 / 360) * 1024) < 1e-6);
  assert.ok(Math.abs(maxX - (190 / 360) * 1024) < 1e-6);
  assert.equal(projectPolygon({ outer: [[0, 0], [0, 0.001], [0.001, 0], [0, 0]], holes: [] }, 2), null);
});

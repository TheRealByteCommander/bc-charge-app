/**
 * Run: node --test server/utils/safeJson.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeParseJson, safeParseObject } from './safeJson.mjs';

describe('safeParseJson', () => {
  it('returns fallback for nullish / empty string', () => {
    assert.equal(safeParseJson(null), null);
    assert.equal(safeParseJson(undefined), null);
    assert.equal(safeParseJson(''), null);
    assert.deepEqual(safeParseJson(null, {}), {});
    assert.deepEqual(safeParseJson(undefined, { a: 1 }), { a: 1 });
    assert.deepEqual(safeParseJson('', []), []);
  });

  it('passes through already-decoded values (pg jsonb)', () => {
    const obj = { kWh: 1.2 };
    assert.equal(safeParseJson(obj), obj);
    assert.equal(safeParseJson(12), 12);
    assert.deepEqual(safeParseJson([1, 2]), [1, 2]);
  });

  it('parses valid JSON strings', () => {
    assert.deepEqual(safeParseJson('{"n":2}'), { n: 2 });
    assert.deepEqual(safeParseJson('[1,2]'), [1, 2]);
    assert.equal(safeParseJson('true'), true);
  });

  it('returns fallback on corrupt JSON', () => {
    assert.equal(safeParseJson('{'), null);
    assert.equal(safeParseJson('not-json', 'x'), 'x');
    assert.deepEqual(safeParseJson('{"a":', {}), {});
  });
});

describe('safeParseObject', () => {
  it('returns plain objects from string or object input', () => {
    assert.deepEqual(safeParseObject('{"a":1}'), { a: 1 });
    assert.deepEqual(safeParseObject({ b: 2 }), { b: 2 });
  });

  it('rejects arrays / primitives / corrupt → fallback {}', () => {
    assert.deepEqual(safeParseObject('[1]'), {});
    assert.deepEqual(safeParseObject('null'), {});
    assert.deepEqual(safeParseObject('x'), {});
    assert.deepEqual(safeParseObject(null), {});
    assert.deepEqual(safeParseObject(42, { def: true }), { def: true });
  });
});

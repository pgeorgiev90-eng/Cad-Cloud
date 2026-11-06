// Run with: node --test tests/electric-cad-core.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const busbar = require('../electrical-busbar-core.js');
const wires = require('../electrical-connections.js');

const device = (id, col, width = 1) => ({
  type: 'MCB', width, row: 0, col, name: id,
  rating: 'C16', connectionId: id, poles: 1
});
const project = (items, connections = [], extra = {}) => ({
  rows: 2, modules: 12, mode: 'din', items, connections, busbars: [], ...extra
});
const end = (device, side, pole = 0) => ({ device, side, pole });
const link = (from, to, phase = 'L1') => ({ from, to, phase, bends: [] });

test('valid DIN arrangement is accepted', () => {
  assert.equal(busbar.validate(project([device('a', 0), device('b', 1)])).items.length, 2);
});
test('overlapping DIN devices are rejected', () => {
  assert.throws(() => busbar.validate(project([device('a', 0, 2), device('b', 1)])), /Припокриващи/);
});
test('free mounting permits independent coordinates', () => {
  const p = project([device('a', 0), device('b', 0)], [], { mode: 'free' });
  p.items[0].x = 10; p.items[0].y = 10;
  p.items[1].x = 100; p.items[1].y = 100;
  assert.equal(busbar.validate(p).mode, 'free');
});
test('connection between distinct terminals is accepted', () => {
  const items = [device('a', 0), device('b', 1)];
  assert.equal(wires.validate(items, [link(end('a','bottom'), end('b','top'))]).length, 1);
});
test('connection to missing device is rejected', () => {
  const items = [device('a', 0)];
  assert.throws(() => wires.validate(items, [link(end('a','bottom'), end('missing','top'))]), /Невалидна връзка/);
});
test('duplicate connection is rejected in either direction', () => {
  const items = [device('a', 0), device('b', 1)];
  const a = end('a','bottom'), b = end('b','top');
  assert.throws(() => wires.validate(items, [link(a,b), link(b,a)]), /вече са свързани/);
});
test('invalid phase is rejected', () => {
  const items = [device('a', 0), device('b', 1)];
  assert.throws(() => wires.validate(items, [link(end('a','bottom'),end('b','top'),'L4')]), /Невалидна връзка/);
});
test('group collision and boundary checks', () => {
  assert.equal(wires.validGroup([{x:0,y:0,width:2,height:1}], [{x:1,y:0,width:1,height:1}], 12, 2), false);
  assert.equal(wires.validGroup([{x:0,y:0,width:1,height:1}], [{x:2,y:0,width:1,height:1}], 12, 2), true);
});
test('invalid busbar geometry is rejected', () => {
  const p = project([]);
  p.busbars = [{width:20,thickness:5,color:'#ffff00',points:[{x:0,y:0,z:0}]}];
  assert.throws(() => busbar.validate(p), /Невалидна геометрия/);
});

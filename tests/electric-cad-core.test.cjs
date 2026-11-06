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

test('valid three-phase terminal wiring with independent poles', () => {
  const main = {...device('main', 0, 4), poles: 4};
  const load = {...device('load', 4, 3), poles: 3};
  const connections = ['L1','L2','L3'].map((phase, pole) =>
    link(end('main', 'bottom', pole), end('load', 'top', pole), phase));
  assert.equal(busbar.validate(project([main, load], connections)).connections.length, 3);
});
test('reject a wire connected to an out-of-range terminal pole', () => {
  assert.throws(() => wires.validate([device('a',0), device('b',1)],
    [link(end('a','bottom',2),end('b','top'))]), /Невалидна връзка/);
});
test('reject two selected devices overlapping each other', () => {
  assert.equal(wires.validGroup([
    {x:0,y:0,width:2,height:2},{x:1,y:1,width:2,height:2}
  ], [], 12, 10), false);
});
test('reject out-of-bounds selected device', () => {
  assert.equal(wires.validGroup([{x:11,y:0,width:2,height:1}],[],12,10),false);
});
test('valid three-point busbar is accepted', () => {
  const p=project([]);
  p.busbars=[{width:20,thickness:5,color:'#ffff00',points:[
    {x:0,y:0,z:0},{x:100,y:0,z:0},{x:100,y:100,z:0}
  ]}];
  assert.equal(busbar.validate(p).busbars.length,1);
});
test('DWG block extraction groups identical equipment and preserves quantities', async () => {
  const fs=require('node:fs');
  const src=fs.readFileSync(require.resolve('../electrical-dwg-data.js'),'utf8');
  const {equipmentFromDwg}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
  const block={type:'INSERT',name:'MCB-C16',attribs:[
    {tag:'SKU',text:{text:'SCHRACK-12345'}},
    {tag:'RATING',text:{text:'C16'}}
  ]};
  const result=equipmentFromDwg({entities:[block,block,{type:'LINE'}]});
  assert.equal(result.blocks,2);
  assert.equal(result.rows.length,1);
  assert.equal(result.rows[0].count,2);
  assert.ok(result.rows[0].codes.includes('SCHRACK-12345'));
});

test('a terminal network rejects different conductors even through an unlabelled link', () => {
  const items = ['a', 'b', 'c', 'd'].map((id, col) => device(id, col));
  const a = end('a', 'bottom'), b = end('b', 'top');
  const c = end('c', 'top'), d = end('d', 'top');
  const first = link(a, b);
  const legacy = { from: b, to: c, bends: [] };
  assert.doesNotThrow(() => wires.validate(items, [first, legacy, link(c, d)]));
  assert.throws(() => wires.validate(items, [first, link(a, d, 'L2')]), /Несъвместими/);
  assert.throws(() => wires.validate(items, [first, legacy, link(c, d, 'L2')]), /Несъвместими/);
});

test('free mounting rejects collisions and devices outside the plate or cabinet depth', () => {
  const a = { ...device('a', 0), x: 0, y: 0, widthMm: 100, heightMm: 100, depthMm: 180 };
  const b = { ...device('b', 0), x: 100, y: 0, widthMm: 100, heightMm: 100 };
  const p = items => project(items, [], { mode: 'free' });
  assert.doesNotThrow(() => busbar.validate(p([a, b])));
  assert.throws(() => busbar.validate(p([a, { ...b, x: 99 }])), /Припокриващи/);
  assert.throws(() => busbar.validate(p([{ ...a, x: 405 }])), /извън монтажната плоча/);
  assert.throws(() => busbar.validate(p([{ ...a, depthMm: 261 }])), /извън монтажната плоча/);
});

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

test('busbar taps share their phase and remain valid after moving a vertex', () => {
  const bar={id:'bar-one',phase:'PE',width:20,thickness:5,color:'#ffff00',
    points:[{x:10,y:50,z:30},{x:110,y:50,z:30}]};
  const a=wires.nearestTap(bar,{x:35,y:54}),b=wires.nearestTap(bar,{x:85,y:49});
  const items=[device('a',0),device('b',1)];
  assert.deepEqual(wires.tapPosition(bar,a),{x:35,y:50});
  const connection=link(a,end('a','top'),'PE');
  assert.doesNotThrow(()=>busbar.validate(project(items,[connection,link(b,end('b','top'),'PE')],{busbars:[bar]})));
  assert.throws(()=>busbar.validate(project(items,[connection,link(b,end('b','top'),'L1')],{busbars:[bar]})),/Несъвместими/);
  bar.points[1].y=90;
  assert.deepEqual(wires.tapPosition(bar,a),{x:35,y:60});
});

test('DWG traces only a supported phase path between two explicit terminals', async () => {
  const fs=require('node:fs');
  const src=fs.readFileSync(require.resolve('../electrical-dwg-data.js'),'utf8');
  const {equipmentFromDwg}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
  const mark=(name,x,y)=>({type:'INSERT',name,insertionPoint:{x,y}});
  const line=(layer,x,y,ex,ey)=>({type:'LINE',layer,startPoint:{x,y},endPoint:{x:ex,y:ey}});
  const result=equipmentFromDwg({entities:[
    mark('QF1_BOTTOM_1',0,0),mark('QF2_TOP_1',10,10),mark('QF3_TOP_1',9,9),mark('QF4_BOTTOM_1',1,1),
    {type:'LWPOLYLINE',layer:'L1',flag:0,elevation:0,extrusionDirection:{x:0,y:0,z:0},
      vertices:[{x:0,y:0},{x:0,y:10},{x:10,y:10}]},
    line('WIRE',1,1,9,9),line('L2',0,0,2,2),line('PE',0,5,10,5)
  ]});
  assert.equal(result.blocks,0);
  assert.deepEqual(result.proposals,[
    {from:{ref:'QF1',side:'bottom',pole:0},to:{ref:'QF2',side:'top',pole:0},phase:'L1'},
    {from:{ref:'QF4',side:'bottom',pole:0},to:{ref:'QF3',side:'top',pole:0},phase:''}
  ]);
  assert.equal(result.review.filter(r=>!r.point).length,2);
  assert.deepEqual(result.review.find(r=>r.point)?.point,{x:0,y:5});
  assert.equal(result.skipped,0);
});

test('DWG proposal places a fixed breaker and DIN equipment without modifying the source', () => {
  const {propose}=require('../electrical-dwg-plan.js');
  const original=project([]);
  const product=(sku,type,widthMm,heightMm,depthMm,poles)=>({sku,name:sku,type,widthMm,heightMm,depthMm,poles,modules:Math.ceil(widthMm/18)});
  const devices=[{ref:'QF1',product:product('MAIN','MCCB',105,241,190.5,3)},
    {ref:'QF2',product:product('OUT','MCB',17.8,83,70,1)}];
  const dwgEnd=(ref,side,pole)=>({ref,side,pole});
  const valid={from:dwgEnd('QF1','bottom',0),to:dwgEnd('QF2','top',0),phase:'L1'};
  const invalid={...valid,to:dwgEnd('QF2','top',1),phase:'L2'};
  const result=propose(original,devices,[valid,invalid]);
  assert.equal(original.items.length,0);
  assert.equal(result.project.mode,'free');
  assert.equal(result.project.dinRails.length,1);
  assert.equal(result.project.items.length,2);
  assert.equal(result.project.connections.length,1);
  assert.equal(result.project.connections[0].bends.length,4);
  assert.equal(result.unresolved.length,1);
});

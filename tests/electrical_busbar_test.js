const assert=require('node:assert/strict'),C=require('../electrical-busbar-core.js');
const base={version:1,rows:3,modules:18,items:[{type:'MCB',row:0,col:0,width:1,name:'Тест',rating:'C16'}]};
const b={width:20,thickness:5,color:'#e5b82a',points:[{x:0,y:0,z:30},{x:100,y:0,z:30},{x:100,y:100,z:40}],holes:[{index:1,diameter:8,bolt:true}]};
assert.deepEqual(C.validate(base).busbars,[]);
const v2={...base,version:2,mode:'free',busbars:[b]};assert.deepEqual(C.validate(JSON.parse(JSON.stringify(v2))),v2);
assert.equal(Math.round(C.length(b)),200);assert.equal(C.length({points:[{x:0,y:0,z:0},{x:0,y:0,z:100}]}),100);
assert.deepEqual(C.snap({x:13,y:18,z:30},[]),{x:15,y:20,z:30});assert.deepEqual(C.snap({x:13,y:18,z:30},[{x:14,y:19}]),{x:14,y:19,z:30});
for(const view of ['front','side','3d']){const p=C.project(b.points[1],view);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y))}
assert.throws(()=>C.validate({...base,rows:0}));assert.throws(()=>C.validate({...base,items:[...base.items,...base.items]}));
assert.throws(()=>C.validate({...v2,busbars:[{...b,width:-2}]}));assert.throws(()=>C.validate({...v2,busbars:[{...b,points:[{x:NaN,y:0,z:0}]}]}));assert.throws(()=>C.validate({...v2,busbars:[{...b,holes:[{index:999,diameter:8}]}]}));
assert.throws(()=>C.validate({...base,items:[{...base.items[0],width:NaN}]}));
assert.equal(base.items[0].name,'Тест');console.log('PASS: legacy migration, JSON round-trip, 3D lengths, snapping, projection and invalid project rejection');

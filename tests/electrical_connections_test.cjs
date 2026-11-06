const assert = require('node:assert/strict');
const busbar = require('../electrical-busbar-core.js');
const connections = require('../electrical-connections.js');

const one = {type:'MCB',row:0,col:0,width:1,connectionId:'test-one'};
const two = {type:'RCD',row:1,col:2,width:4,connectionId:'test-two'};
const from = {device:one.connectionId,side:'bottom',pole:0};
const to = {device:two.connectionId,side:'top',pole:2};
const link = {from,to,phase:'PE',bends:[{x:100,y:150}]};
const project = {version:2,mode:'din',rows:3,modules:18,items:[one,two],busbars:[],connections:[link]};
assert.deepEqual(busbar.validate(JSON.parse(JSON.stringify(project))).connections,[link]);
assert.throws(()=>connections.validate([one,two],[link,{from:to,to:from,bends:[]}]));
assert.throws(()=>connections.validate([one],[link]));
assert.throws(()=>connections.validate([one,two],[{...link,phase:'invalid'}]));
assert(connections.phases.PE.stripe);
const boxes=[{x:1,y:1,width:1,height:1},{x:3,y:1,width:1,height:1}];
assert(connections.validGroup(boxes,[],5,3));
assert(!connections.validGroup(boxes,[{x:3,y:1,width:1,height:1}],5,3));
assert(!connections.validGroup(boxes,[],3,3));
assert(!connections.validGroup([boxes[0],boxes[0]],[],5,3));
assert.throws(()=>connections.validate([one,two],[{...link,to:{...to,pole:4}}]));
const route = connections.route({x:10,y:40},{x:72,y:110},link.bends);
assert.deepEqual(route[0],{x:10,y:40});
assert.deepEqual(route.at(-1),{x:72,y:110});
assert(route.some(p=>p.x===100&&p.y===150));
for(let i=1;i<route.length;i++) assert(route[i-1].x===route[i].x||route[i-1].y===route[i].y);
assert.deepEqual(connections.terminalPosition(two,to,{x:10,y:70},72,83),{x:55,y:70});

(async () => {
    const {equipmentFromDwg}=await import('../electrical-dwg-data.js');
    const insert={type:'INSERT',name:'Schrack_BM617116',attribs:[
        {tag:'ARTICLE_NO',text:{text:'BM617116'}},{tag:'RATING',text:{text:'C16'}}
    ]};
    const data=equipmentFromDwg({entities:[insert,insert,{type:'LINE'}]});
    assert.equal(data.blocks,2);
    assert.equal(data.rows[0].count,2);
    assert.deepEqual(data.rows[0].codes,['BM617116']);
    assert.equal(data.rows[0].details.RATING,'C16');
    console.log('PASS: valid and invalid terminals, stable JSON, orthogonal routing and DWG block attributes');
})().catch(error=>{console.error(error);process.exitCode=1;});

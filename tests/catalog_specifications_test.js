'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {electrical,stringPlan}=require('../solar-offer-core.js');
const rows=JSON.parse(fs.readFileSync('database/catalog-specifications-v1.json','utf8'));
assert.equal(rows.length,204);
const identities=new Set();
for(const row of rows){
  const key=JSON.stringify(row.match);assert.ok(!identities.has(key));identities.add(key);
  assert.ok(row.fields.length>=3);assert.ok(row.fields.length<=30);assert.ok(row.sources.length>0);
  const labels=new Set();for(const f of row.fields){assert.equal(typeof f.value,'string');assert.ok(f.value.length>0&&f.value.length<=1000);assert.ok(f.label.length<=100);assert.ok(!labels.has(f.label));labels.add(f.label);assert.notEqual(f.label,'Източник за фазност');}
}
const inverters=rows.filter(r=>r.match.category==='Инвертори');assert.equal(inverters.length,45);
for(const r of inverters){const s=electrical(r.fields);assert.ok(s.acPowerKw>0,r.match.name);assert.ok([1,3].includes(s.phase));assert.equal(s.limit,s.phase===1?400:750);}
const find=name=>rows.find(r=>r.match.name===name);
const boost=electrical(find('X1-BOOST-5K-G4').fields);assert.equal(boost.acPowerKw,5);assert.equal(boost.mpptCount,2);assert.equal(boost.limit,400);
const pro=electrical(find('X3-PRO-25K-G2').fields);assert.equal(pro.acPowerKw,25);assert.equal(pro.mpptCount,3);assert.equal(pro.limit,750);
assert.equal(electrical(find('X3-GRD-350K-HV').fields).acPowerKw,350);
const rails=rows.filter(r=>r.match.code==='TRB-D20');assert.equal(rails.length,2);assert.deepEqual(rails.map(r=>r.fields.find(f=>f.label==='Дължина (mm)').value).sort(),['250','385']);
const clamps=rows.find(r=>r.match.code==='FEC3035');assert.equal(clamps.fields.find(f=>f.label==='Съвместими дебелини на рамката (mm)').value,'30 / 35');
const pg=stringPlan([{panels:[{model:'jinko440',power:440}]}],boost,-20);assert.equal(pg.rows[0].maxPanels,9);
console.log('PASS: 204 distinct variants, 45 machine-readable inverter powers, phase/DC caps, MPPT counts, exact rail lengths and fixed clamp sizes');

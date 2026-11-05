'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {sections,sectionOf,matches,compare}=require('../catalog-sections.js');
const products=JSON.parse(fs.readFileSync('database/catalog-specifications-v1.json','utf8')).map((r,i)=>({...r.match,id:i+1}));
const counts={};for(const p of products){const s=sectionOf(p);counts[s]=(counts[s]||0)+1;}
assert.deepEqual(counts,{mounting:133,inverters:45,bms:5,batteries:5,battery_accessories:1,storage:4,energy_management:5,chargers:5,system_cabinets:1});
for(const p of products.filter(p=>matches(p,'batteries'))){assert.ok(!p.name.startsWith('TBMS'));assert.notEqual(p.name,'HS160-BA');}
assert.equal(matches(products.find(p=>p.name==='TBMS-R76'),'batteries'),false);
assert.equal(matches(products.find(p=>p.name==='B100'),'batteries'),false);
assert.equal(matches(products.find(p=>p.code==='EIC'),'panels'),false);
assert.equal(sectionOf({category:'BMS модули',name:'New BMS'}),'bms');
assert.equal(sectionOf({category:'Батерии',name:'New battery'}),'batteries');
assert.equal(sectionOf({category:'Инвертори',brand:'Another brand',name:'Other inverter'}),'inverters');
const sorted=products.slice().sort(compare);assert.equal(sectionOf(sorted[0]),'inverters');assert.equal(sectionOf(sorted[45]),'batteries');
for(const s of Object.keys(counts))assert.ok(sections[s]);
console.log('PASS: 45 inverters, 5 batteries, separate BMS/accessories/storage, 133 mounting products, exact section filters and stable grouping');

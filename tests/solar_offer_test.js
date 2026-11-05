'use strict';
const assert=require('node:assert/strict');
const {project,costs,price}=require('../solar-offer-core.js');
const path=[[42.7,23.3],[42.7001,23.3],[42.7001,23.3001]];
const summary=project([
 {path,tilt:10,azimuth:180,mountingName:'Enerack',panels:[{power:440,model:'jinko440'},{power:440,model:'jinko440'}]},
 {path,tilt:25,moduleTilt:35,azimuth:90,panels:[{power:550}]}
]);
assert.equal(summary.count,3);assert.equal(summary.kwp,1.43);
assert.equal(summary.groups.length,2);assert.equal(summary.groups[0].count,2);
assert.equal(summary.roofs[1].tilt,25);assert.equal(summary.roofs[1].moduleTilt,35);assert.equal(summary.roofs[0].moduleTilt,10);assert.equal(summary.roofs[1].mounting,'Не е избрана');
const settings={inverterName:'Test',inverterQty:'2',panelPrice:'100.25',inverterPrice:'1000',mountPrice:'500',installPrice:'300'};
const quote=costs(summary,settings);
assert.equal(quote.subtotal,310075);assert.equal(quote.vat,62015);assert.equal(quote.total,372090);assert.equal(quote.complete,true);
const partial=costs(summary,{...settings,mountPrice:''});assert.equal(partial.complete,false);assert.equal(partial.rows[2].total,null);
assert.equal(price('0'),0);assert.equal(price(''),null);assert.throws(()=>price('-1'));assert.throws(()=>price('NaN'));
assert.throws(()=>project([{path,tilt:10,azimuth:180,panels:[{power:NaN}]}]));
console.log('PASS: multi-roof panel totals, mixed models, per-roof angles, exact VAT, missing and zero prices');

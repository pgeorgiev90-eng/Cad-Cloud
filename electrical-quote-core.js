(function(root){
'use strict';
function calculate(lines,vat=20,labour=0){
 const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 if(!valid(vat)||vat>100||!valid(labour))throw Error('Невалидно ДДС или монтаж');
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;let subtotal=0,missing=0;
 const rows=lines.filter(l=>l.included!==false).map(l=>{if(!valid(l.quantity))throw Error('Невалидно количество');const known=valid(l.unitPrice),amount=known?round(l.quantity*l.unitPrice):null;if(!known)missing++;else subtotal+=amount;return {...l,amount}});subtotal=round(subtotal+labour);const tax=round(subtotal*vat/100);return {rows,subtotal,tax,total:round(subtotal+tax),missing,complete:missing===0};
}
const api={calculate};if(typeof module!=='undefined')module.exports=api;root.PDGQuoteCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);

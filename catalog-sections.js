(function(root){
 'use strict';
 const sections={
  inverters:'Инвертори',batteries:'Батерии',mounting:'Конструкции и крепежи',
  bms:'BMS модули',battery_accessories:'Аксесоари за батерии',storage:'Системи за съхранение',
  chargers:'Зарядни станции',energy_management:'Енергийно управление',system_cabinets:'Системни шкафове',
  panels:'Фотоволтаични панели',electrical:'Електроапаратура',protection:'Защити и апаратура',enclosures:'Табла и кутии',accessories:'Кабели и аксесоари'
 };
 const batteryNames=new Set(['TB-HS51','TB-HR76','TB-HR140','HS160-PA','TB-LD16']);
 const bmsNames=new Set(['TBMS-MCS0800','TBMS-S8-1','TBMS-R76','TBMS-R15','HS160-BA']);
 function sectionOf(product){
  const c=String(product.category||'').trim().toLocaleLowerCase('bg');
  if(c==='батерии и аксесоари')return batteryNames.has(product.name)?'batteries':bmsNames.has(product.name)?'bms':'battery_accessories';
  if(c.includes('инвертор'))return 'inverters';
  if(c==='батерии'||c==='високоволтови батерии'||c==='нисковолтови батерии')return 'batteries';
  if(c==='bms модули')return 'bms';
  if(c==='аксесоари за батерии')return 'battery_accessories';
  if(c==='системи за съхранение')return 'storage';
  if(c==='зарядни станции')return 'chargers';
  if(c==='енергийно управление')return 'energy_management';
  if(c==='системни шкафове')return 'system_cabinets';
  if(['мини рейл','ламарина','керемида','баласт','наземен','ограда'].includes(c)||c.startsWith('паркинг'))return 'mounting';
  if(c==='фотоволтаични панели')return 'panels';
  if(c.startsWith('електроапаратура / '))return 'electrical';
  if(c==='защити и апаратура')return 'protection';
  if(c==='табла и кутии')return 'enclosures';
  if(c==='кабели и аксесоари')return 'accessories';
  return 'other';
 }
 const matches=(product,section)=>!sections[section]||sectionOf(product)===section;
 const order=Object.keys(sections);
 function compare(a,b){const x=order.indexOf(sectionOf(a)),y=order.indexOf(sectionOf(b));return (x<0?99:x)-(y<0?99:y)||Number(a.id)-Number(b.id);}
 const api={sections,sectionOf,matches,compare};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.PDGCatalogSections=api;
})(typeof window==='object'?window:globalThis);

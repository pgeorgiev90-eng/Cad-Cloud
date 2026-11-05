(function(root){
  'use strict';
  function project(planes){
    const groups=new Map();let count=0,watts=0;
    const roofs=planes.map((p,i)=>{
      let roofWatts=0;
      for(const panel of p.panels){
        const power=Number(panel.power);if(!Number.isFinite(power)||power<=0)throw Error('Невалидна мощност на панел.');
        const model=panel.model||'custom',key=model+'|'+power;
        const g=groups.get(key)||{model,power,count:0};g.count++;groups.set(key,g);count++;watts+=power;roofWatts+=power;
      }
      return {number:i+1,count:p.panels.length,kwp:roofWatts/1000,tilt:p.tilt,moduleTilt:p.moduleTilt??p.tilt,azimuth:p.azimuth,mounting:p.mountingName||'Не е избрана',latitude:p.path.reduce((s,x)=>s+x[0],0)/p.path.length,longitude:p.path.reduce((s,x)=>s+x[1],0)/p.path.length};
    });
    return {count,kwp:watts/1000,roofs,groups:[...groups.values()]};
  }
  function price(value){if(value===''||value===null||value===undefined)return null;const n=Number(value);if(!Number.isFinite(n)||n<0||n>100000000)throw Error('Невалидна цена.');return Math.round(n*100);}
  function costs(summary,settings){
    const lines=[['Фотоволтаични панели',summary.count,price(settings.panelPrice)],['Инвертор: '+settings.inverterName,Number(settings.inverterQty),price(settings.inverterPrice)],['Монтажна конструкция',1,price(settings.mountPrice)],['Монтаж и останали материали',1,price(settings.installPrice)]];
    const rows=lines.map(([name,qty,unit])=>({name,qty,unit,total:unit===null?null:Math.round(qty*unit)}));
    const subtotal=rows.reduce((s,r)=>s+(r.total||0),0),vat=Math.round(subtotal*.2);
    return {rows,complete:rows.every(r=>r.total!==null),subtotal,vat,total:subtotal+vat};
  }
  const api={project,price,costs};if(typeof module==='object'&&module.exports)module.exports=api;else root.PDGSolarOfferCore=api;
})(typeof window==='object'?window:globalThis);

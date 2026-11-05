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
  const normalize=value=>String(value).toLowerCase().normalize('NFKC').replace(/[()[\]_.:/–—-]+/g,' ').replace(/\s+/g,' ').trim();
  function phaseValue(value){
    const s=normalize(value);
    if(/^(1|1 ф|1ф|1 фаза|1 phase|single phase|single|монофазен|монофазно|еднофазен|еднофазно)$/.test(s))return 1;
    if(/^(3|3 ф|3ф|3 фази|3 phase|three phase|three|трифазен|трифазно)$/.test(s))return 3;
    return null;
  }
  function positiveValue(value){
    const s=String(value).trim().replace(/\s/g,'').replace(',','.');
    const m=s.match(/^(\d+(?:\.\d+)?)(v|volt|volts|в|kv|кв)?$/i);
    if(!m)return null;const n=Number(m[1])*(/^(kv|кв)$/i.test(m[2]||'')?1000:1);return Number.isFinite(n)&&n>0?n:null;
  }
  function electrical(fields){
    function scalar(labels,integer=false){
      const entries=fields.filter(f=>labels.includes(normalize(f.label))).map(f=>String(f.value).trim().replace(',','.'));
      if(!entries.length)return null;
      const values=entries.map(v=>/^(?:\d+\.?\d*|\.\d+)(?:\s*(?:kW|кВт|V|В))?$/i.test(v)?Number.parseFloat(v):NaN);
      if(values.some(v=>!Number.isFinite(v)||v<=0||(integer&&!Number.isInteger(v)))||new Set(values).size!==1)return null;
      return values[0];
    }
    const phaseLabels=['брой фази','фазност','фази','phase','phases','number of phases','ac phases'];
    const maxLabels=['максимално dc напрежение v','максимално dc напрежение','макс dc напрежение v','максимално входно dc напрежение v','максимално входно напрежение v','max dc voltage','max dc voltage v','max dc input voltage','maximum dc voltage','maximum input voltage','max input voltage','max input voltage v'];
    const capLabels=['лимит напрежение на стринг v','лимит напрежение на стринг','string voltage limit v','string voltage limit'];
    const phaseEntries=fields.filter(f=>phaseLabels.includes(normalize(f.label))),phases=phaseEntries.map(f=>phaseValue(f.value));
    const errors=[];let phase=null;
    if(!phases.length)errors.push('Липсва характеристика „Брой фази“ на инвертора.');
    else if(phases.some(p=>p===null)||new Set(phases).size!==1)errors.push('Нееднозначна или невалидна фазност на инвертора.');
    else phase=phases[0];
    const voltageFields=fields.filter(f=>maxLabels.includes(normalize(f.label))||capLabels.includes(normalize(f.label)));
    const voltages=voltageFields.map(f=>positiveValue(f.value));
    if(voltages.some(v=>v===null))errors.push('Невалидна характеристика за максимално DC напрежение.');
    const policyLimit=phase===1?400:phase===3?750:null;
    const limit=policyLimit&&errors.length===0?Math.min(policyLimit,...voltages):null;
    const acPowerKw=scalar(['номинална ac мощност kw','номинална ac мощност квт','rated ac power kw','nominal ac power kw']);
    const mpptCount=scalar(['брой mppt','number of mppt'],true);
    const mpptMinVoltage=scalar(['минимално mppt напрежение v']);
    const mpptMaxVoltage=scalar(['максимално mppt напрежение v']);
    return {phase,policyLimit,limit,errors,acPowerKw,mpptCount,mpptMinVoltage,mpptMaxVoltage};
  }
  const knownModules={jinko440:{voc:39.57,coefficient:-0.25},longi435:{voc:39.33,coefficient:-0.23}};
  function panelElectrical(panel){
    const known=knownModules[panel.model];
    const voc=panel.voc==null?known?.voc:Number(panel.voc);
    const coefficient=panel.vocCoefficient==null?known?.coefficient:Number(panel.vocCoefficient);
    return {voc,coefficient};
  }
  function stringPlan(planes,spec,minTemperature){
    if(!spec?.limit)return {valid:false,errors:spec?.errors?.length?spec.errors:['Изберете каталожен инвертор с попълнена фазност.'],rows:[]};
    const temperature=Number(minTemperature);if(minTemperature===''||minTemperature==null||!Number.isFinite(temperature)||temperature< -50||temperature>25)return {valid:false,errors:['Задайте минимална проектна температура между −50 и 25°C.'],rows:[]};
    const rows=[],errors=[];
    planes.forEach((roof,i)=>{
      const groups=new Map();for(const panel of roof.panels){const e=panelElectrical(panel),key=JSON.stringify([panel.model||'custom',panel.power,e.voc,e.coefficient]);const g=groups.get(key)||{model:panel.model||'custom',power:panel.power,voc:e.voc,coefficient:e.coefficient,count:0};g.count++;groups.set(key,g);}
      for(const g of groups.values()){
        if(!(Number.isFinite(g.voc)&&g.voc>0&&Number.isFinite(g.coefficient)&&g.coefficient<0&&g.coefficient>= -1)){
          errors.push('Скат '+(i+1)+': липсва валидно Voc или температурен коефициент на панелите.');continue;
        }
        const coldVoc=g.voc*(1+g.coefficient/100*(temperature-25));
        let maxPanels=Math.floor(spec.limit/coldVoc);while(maxPanels>0&&maxPanels*coldVoc>spec.limit)maxPanels--;
        if(maxPanels<1){errors.push('Скат '+(i+1)+': дори един панел надвишава лимита.');continue;}
        const count=Math.ceil(g.count/maxPanels),base=Math.floor(g.count/count),extra=g.count%count;
        const strings=Array.from({length:count},(_,j)=>base+(j<extra?1:0));
        rows.push({...g,roof:i+1,coldVoc,maxPanels,strings,maxStringVoltage:Math.max(...strings)*coldVoc});
      }
    });
    return {valid:errors.length===0&&rows.length>0,errors,rows,limit:spec.limit,policyLimit:spec.policyLimit,phase:spec.phase,temperature};
  }
  const api={project,price,costs,electrical,stringPlan,panelElectrical};if(typeof module==='object'&&module.exports)module.exports=api;else root.PDGSolarOfferCore=api;
})(typeof window==='object'?window:globalThis);

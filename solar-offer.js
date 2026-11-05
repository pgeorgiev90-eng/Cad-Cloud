(() => {
  'use strict';
  const $=id=>document.getElementById(id),core=window.PDGSolarOfferCore;
  const ids=['client','site','inverterName','inverterKw','inverterQty','inverterPrice','panelPrice','mountPrice','installPrice','loss','yieldMode','manualYield'];
  let products=[],generation=0,ready=false;
  const field=id=>$('offer-'+id);
  function settings(){const data={};for(const id of ids)data[id]=field(id).value;return data;}
  function restore(data){if(!data||typeof data!=='object')return;for(const id of ids)if(typeof data[id]==='string')field(id).value=data[id].slice(0,500);invalidate();}
  window.PDGSolarOffer={settings,restore};
  function invalidate(){generation++;ready=false;$('offer-print').disabled=$('offer-download').disabled=true;if($('solarOfferDialog').open)$('offer-progress').textContent='Проектът е променен. Затворете офертата и я генерирайте отново.';}
  window.addEventListener('pdg-solar-change',invalidate);
  $('solar-offer-settings').addEventListener('input',invalidate);
  $('solar-offer-settings').addEventListener('change',invalidate);
  $('offer-apply-tilt').onclick=()=>{const input=$('offer-roof-tilt');if(!input.reportValidity())return;const module=$('offer-module-tilt');if(!module.reportValidity())return;window.PDGSolarProject.setTilt(Number(input.value),module.value===''?null:Number(module.value));};
  $('offer-inverter').onchange=()=>{
    const p=products.find(p=>String(p.id)===$('offer-inverter').value);if(!p)return;
    field('inverterName').value=p.name;field('inverterPrice').value=p.price??'';field('inverterKw').value='';
    $('offer-inverter-status').textContent='Избран е '+p.name+'. Въведете номиналната AC мощност от техническия лист.';invalidate();
  };
  fetch('api/products.php',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{
    products=d.products.filter(p=>/инвертор|inverter/i.test(p.category));
    for(const p of products){const o=new Option(p.brand+' · '+p.name,p.id);$('offer-inverter').add(o);}
    $('offer-inverter-status').textContent=products.length+' инвертора от магазина. Може да въведете и друг модел.';
  }).catch(()=>{$('offer-inverter-status').textContent='Каталогът временно не се зарежда. Може да въведете модела и цената ръчно.';});
  const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e;};
  const number=(v,d=1)=>Number(v).toLocaleString('bg-BG',{maximumFractionDigits:d});
  const money=cents=>(cents/100).toLocaleString('bg-BG',{style:'currency',currency:'EUR'});
  function table(headers,rows){const t=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr'),body=document.createElement('tbody');for(const h of headers)tr.append(text('th',h));head.append(tr);for(const row of rows){const tr=document.createElement('tr');for(const v of row)tr.append(text('td',v));body.append(tr);}t.append(head,body);return t;}
  function modelName(group){const names={jinko440:'Jinko Tiger Neo JKM440N-54HL4R-B',longi435:'LONGi Hi-MO X6 LR5-54HTH-435M',custom:'Панел с ръчно въведени параметри'};return (names[group.model]||group.model)+' · '+group.power+' Wp';}
  async function forecast(roof,loss){
    const params=new URLSearchParams({lat:roof.latitude.toFixed(4),lon:roof.longitude.toFixed(4),angle:String(roof.moduleTilt),azimuth:String(roof.azimuth),loss:String(loss)});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
    try{const r=await fetch('api/solar-yield.php?'+params,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const d=await r.json();if(!(d.annual_kwh_per_kwp>0))throw Error();return {...d,kwh:d.annual_kwh_per_kwp*roof.kwp};}finally{clearTimeout(timer);}
  }
  $('offer-generate').onclick=async()=>{
    const controls=[...$('solar-offer-settings').querySelectorAll('input')];if(controls.some(e=>!e.reportValidity()))return;
    let summary,prices,s;
    try{
      s=settings();summary=core.project(window.PDGSolarProject.snapshot());
      if(!summary.count)throw Error('Поставете панели в проекта, преди да генерирате оферта.');
      if(!s.inverterName.trim()||!(Number(s.inverterKw)>0))throw Error('Изберете инвертор и въведете неговата номинална AC мощност.');
      if(s.yieldMode==='manual'&&!(Number(s.manualYield)>0))throw Error('Въведете специфичен годишен добив за ръчната оценка.');
      if(summary.roofs.filter(r=>r.count).length>20)throw Error('Офертата поддържа до 20 ската с панели.');
      prices=core.costs(summary,s);
    }catch(e){$('offer-inverter-status').textContent=e.message;return;}
    const run=++generation;ready=false;$('offer-print').disabled=$('offer-download').disabled=true;
    const dialog=$('solarOfferDialog'),report=$('solar-offer-report');report.replaceChildren();dialog.showModal();
    $('offer-progress').textContent='Подготовка на офертата и прогнозния добив…';
    report.append(text('p','PDG Systems · Фотоволтаични системи'),text('h1','Предварителна оферта за фотоволтаична система'),text('p','Дата: '+new Date().toLocaleDateString('bg-BG')));
    if(s.client)report.append(text('p','Клиент: '+s.client));if(s.site)report.append(text('p','Обект: '+s.site));
    report.append(text('p',summary.count+' панела · '+number(summary.kwp,2)+' kWp DC · '+s.inverterQty+' × '+s.inverterName,'offer-summary'));
    report.append(text('h2','Панели и инвертор'),table(['Компонент','Брой','Мощност'],[...summary.groups.map(g=>[modelName(g),String(g.count),number(g.count*g.power/1000,2)+' kWp']),[s.inverterName,s.inverterQty,number(s.inverterKw,2)+' kW AC / бр.']]));
    report.append(text('p','Обща AC мощност: '+number(Number(s.inverterKw)*Number(s.inverterQty),2)+' kW. Съотношение DC/AC: '+number(summary.kwp/(Number(s.inverterKw)*Number(s.inverterQty)),2)+'. Изборът на инвертор подлежи на проверка на стрингове, напрежения и токове по техническия лист.','offer-fine'));
    report.append(text('h2','Покрив, конструкция и ъгли'),table(['Скат','Панели / kWp','Конструкция','Покрив / панели / азимут'],summary.roofs.map(r=>['Скат '+r.number,r.count+' / '+number(r.kwp,2),r.mounting,r.tilt+'° / '+r.moduleTilt+'° / '+r.azimuth+'°'])));
    report.append(text('p','Наклонът е спрямо хоризонталата. 10° е начална стойност за нов скат и трябва да се съобрази с реалния покрив. Ъгълът на панелите е спрямо хоризонталата; при липса на отделна стойност следва покрива. Азимут: 0° север, 90° изток, 180° юг, 270° запад. Отделният ъгъл на панелите се използва за добива; визуализацията и запълването не моделират повдигането и засенчването между редовете.','offer-fine'));
    if(summary.roofs.some(r=>r.count&&r.mounting==='Не е избрана'))report.append(text('p','За част от скатовете няма избрана конструкция. Запазете конструкцията за всеки скат преди окончателната оферта.','offer-pending'));
    report.append(text('h2','Прогнозен средногодишен добив'));
    const yieldBox=document.createElement('div');report.append(yieldBox);
    report.append(text('h2','Ценова оферта'),table(['Позиция','Количество','Ед. цена без ДДС','Стойност без ДДС'],prices.rows.map(r=>[r.name,String(r.qty),r.unit===null?'По запитване':money(r.unit),r.total===null?'По запитване':money(r.total)])));
    report.append(text('p',(prices.complete?'Общо без ДДС: ':'Междинна сума на оценените позиции без ДДС: ')+money(prices.subtotal)),text('p','ДДС 20%: '+money(prices.vat)),text('p',(prices.complete?'Общо с ДДС: ':'Междинна сума с ДДС: ')+money(prices.total),'offer-summary'));
    if(!prices.complete)report.append(text('p','Офертата е с непопълнени цени. Междинната сума не е крайна цена на системата.','offer-pending'));
    report.append(text('p','Предварителна оферта. Каталожните цени и ръчно въведените стойности подлежат на потвърждение от PDG Systems. Доставката не е включена. Конструкцията, отстоянията, електрическата схема и крайната съвместимост се уточняват за конкретния обект.','offer-fine'));
    const active=summary.roofs.filter(r=>r.count);
    if(s.yieldMode==='manual'){
      const kwh=summary.kwp*Number(s.manualYield);yieldBox.append(text('p',number(kwh,0)+' kWh/година · '+number(kwh/1000,2)+' MWh/година','offer-summary'),text('p','Ръчна оценка: '+s.manualYield+' kWh/kWp годишно, въведени от потребителя. Не е изчисление от PVGIS и не моделира отделно ориентацията, наклона и засенчването.','offer-fine'));
    }else{
      const results=[];let next=0;
      async function worker(){while(next<active.length){const i=next++;if(run!==generation)return;try{results[i]=await forecast(active[i],Number(s.loss));}catch(e){results[i]=null;}if(run===generation)$('offer-progress').textContent='Прогноза: обработени '+results.filter(x=>x!==undefined).length+' от '+active.length+' ската.';}}
      await Promise.all([worker(),worker()]);if(run!==generation)return;
      yieldBox.append(table(['Скат','Годишен добив','Специфичен добив'],active.map((r,i)=>['Скат '+r.number,results[i]?number(results[i].kwh,0)+' kWh':'Временно недостъпен',results[i]?number(results[i].annual_kwh_per_kwp,0)+' kWh/kWp':'—'])));
      if(results.every(Boolean)){const total=results.reduce((n,r)=>n+r.kwh,0);yieldBox.prepend(text('p',number(total,0)+' kWh/година · '+number(total/1000,2)+' MWh/година','offer-summary'));}
      else yieldBox.prepend(text('p','Няма пълна прогноза за всички скатове. Опитайте отново или изберете ръчна оценка.','offer-pending'));
      const sources=[...new Set(results.filter(Boolean).map(r=>(r.radiation_database||'PVGIS')+(r.year_min?' · '+r.year_min+'–'+r.year_max:'')))];
      yieldBox.append(text('p','Източник: PVGIS 5.3 / Европейска комисия, JRC. '+sources.join('; ')+'. Загуби: '+s.loss+'%. Кристален силиций, вентилиран монтаж и теренен хоризонт. Не се отчитат локални сенки от комини/дървета, редово засенчване, ограничения по износ и конкретното ограничаване от избрания инвертор. Стойностите са климатична прогноза, а не гаранция за производство.','offer-fine'));
    }
    if(run!==generation)return;ready=true;$('offer-print').disabled=$('offer-download').disabled=false;$('offer-progress').textContent='Офертата е готова за преглед и печат.';
  };
  $('offer-close').onclick=()=>$('solarOfferDialog').close();
  $('offer-print').onclick=()=>{if(ready)window.print();};
  $('offer-download').onclick=()=>{if(!ready)return;const doc='<!doctype html><html lang="bg"><meta charset="utf-8"><title>Оферта PDG Systems</title><style>body{font:15px/1.6 Arial;color:#183348;max-width:1000px;margin:30px auto;padding:20px}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #ccc;padding:10px;overflow-wrap:anywhere}h1{font-size:27px}.offer-summary{background:#e8f5ef;padding:15px}.offer-pending{color:#885d13}.offer-fine{font-size:12px}@media print{tr{break-inside:avoid}}</style>'+$('solar-offer-report').outerHTML+'</html>';const url=URL.createObjectURL(new Blob([doc],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='PDG-Systems-solar-offer.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();

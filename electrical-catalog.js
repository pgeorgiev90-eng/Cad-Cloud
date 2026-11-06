(()=>{
'use strict';
let products=[],rates=[],sourceIndex={},online=false,shopOnline=null,category='',limit=24,selectionRequest=0;const byCode=new Map();
const norm=s=>String(s||'').normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]+/gu,'');
const publicPrice=p=>typeof p?.unitPrice==='number'&&Number.isFinite(p.unitPrice)?p.unitPrice:null;
const left=document.querySelector('.layout>aside'),result=$('catalogResults'),search=$('catalogSearch');
search.placeholder='Артикулен номер, EAN или модел';search.setAttribute('aria-label',search.placeholder);search.previousElementSibling.textContent='Търси апарат или корпус';
const brand=document.createElement('div');brand.className='electric-schrack';brand.textContent='SCHRACK TECHNIK';search.after(brand);
const categories=document.createElement('div');categories.className='electric-categories';brand.after(categories);
for(const [key,label]of [['','Всички артикули'],['MCB','Автоматични прекъсвачи'],['RCD','Дефектнотокови защити'],['CONTACT','Контактори'],['MCCB','Прекъсвачи с лят корпус'],['RELAY','Релета и защити'],['BUS_SUPPORT','Шинни държачи'],['ENCLOSURE','Табла и корпуси']]){const b=document.createElement('button');b.textContent=label+' ›';b.dataset.category=key;b.onclick=()=>{category=key;limit=24;render()};categories.append(b)}
const input=$('catalogFile'),label=input.previousElementSibling,help=input.nextElementSibling;const imports=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Импорт на локален каталог за чертеж';imports.append(summary);input.before(imports);imports.append(label,input,help);$('catalogStatus').before(result);result.style.maxHeight='none';result.style.overflow='visible';
left.querySelector('.palette').closest('div').previousElementSibling.textContent='Условни символи';
const settings=document.querySelector('.cad-project-settings'),boardCard=document.createElement('div');boardCard.id='electricCabinetCard';settings.prepend(boardCard);
function fmt(p){return new Intl.NumberFormat('bg-BG',{style:'currency',currency:'EUR'}).format(p)}
function indexProduct(p){
 byCode.set(norm(p.sku),p);
 if(p.ean)byCode.set(norm(p.ean),p);
}
function shopProduct(p){
 const category=p.category;
 const typeName=category.toLowerCase();
 const type=category.includes('лят корпус')?'MCCB':typeName.includes('шинни държачи')?'BUS_SUPPORT':
  typeName.includes('релета')||category.includes('системна защита')?'RELAY':
  category.includes('Табла и корпуси')?'ENCLOSURE':category.includes('Дефектнотокови')?'RCD':
  typeName.includes('контактори')?'CONTACT':'MCB';
 return {sku:p.code,name:p.name,manufacturer:p.brand,category,type,imageUrl:p.imageUrl,shopId:p.id};
}
function dimensions(fields){
 const values=new Map(fields.map(({label,value})=>[label.trim().toLowerCase(),String(value).trim()]));
 const number=(labels)=>{
  for(const label of labels){
   const match=values.get(label)?.match(/^(\d+(?:[.,]\d+)?)\s*(mm|мм|cm|см)?$/iu);
   if(match)return Number(match[1].replace(',','.'))*(/^(cm|см)$/iu.test(match[2]||'')?10:1);
  }
 };
 return [number(['нето широчина','широчина','ширина','ширина (mm)','ширина (мм)']),
  number(['нето височина','височина','височина (mm)','височина (мм)']),
  number(['дълбочина','нето дълбочина','дълбочина (mm)','дълбочина (мм)'])];
}
function armProduct(p){
 if(['MCCB','BUS_SUPPORT'].includes(p.type)&&$('boardMode').value!=='free'){
  $('status').textContent='За този артикул избери „Свободен монтаж“, после го избери от каталога отново.';
  return;
 }
 if(p.type==='ENCLOSURE'){PDGCad.chooseCabinet(p);renderCabinet();return}
 if(view!=='front')setView('front');
 selectedCatalog=p;PDGCad.arm();
 $('status').textContent='Избран '+p.sku+' — щракни в таблото, за да го поставиш.';
}
const sizeDialog=document.createElement('dialog');
sizeDialog.innerHTML='<form><h2>Размери за монтаж</h2><p></p><label>Ширина (mm) <input type="number" step="any" required></label><br><label>Височина (mm) <input type="number" step="any" required></label><br><label>Дълбочина (mm) <input type="number" step="any" required></label><p><button type="submit" class="primary">Избери за монтаж</button> <button type="button">Отказ</button></p></form>';
document.body.append(sizeDialog);
sizeDialog.querySelector('button[type="button"]').onclick=()=>sizeDialog.close();
function confirmDimensions(p,sizes){
 const inputs=[...sizeDialog.querySelectorAll('input')];
 const minimum=p.type==='ENCLOSURE'?[200,200,50]:[0.1,0.1,0.1];
 const maximum=[1600,2400,1000];
 inputs.forEach((el,i)=>{el.min=minimum[i];el.max=maximum[i];el.value=sizes[i]??''});
 sizeDialog.querySelector('p').textContent=p.sku+' · Въведи липсващите размери от техническата документация.';
 sizeDialog.querySelector('form').onsubmit=e=>{
  e.preventDefault();sizeDialog.close();armShopProduct(p,inputs.map(el=>el.valueAsNumber));
 };
 sizeDialog.showModal();
}
function armShopProduct(p,[widthMm,heightMm,depthMm]){
 armProduct({...p,widthMm,heightMm,depthMm,modules:Math.ceil(widthMm/18),rating:p.rating||''});
}
async function selectProduct(p,button){
 const request=++selectionRequest;
 if(!p.shopId){armProduct(p);return}
 button.disabled=true;
 try{
  const data=await fetch('api/product-details.php?id='+encodeURIComponent(p.shopId),{cache:'no-store'}).then(r=>{
   if(!r.ok)throw Error();return r.json();
  });
  if(request!==selectionRequest)return;
  const fields=data.fields||[];
  const sizes=dimensions(fields);
  const value=label=>fields.find(f=>f.label.trim().toLowerCase()===label)?.value;
  p={...p,poles:Number(value('полюси'))||undefined,rating:value('номинален ток')||'',
   specifications:{'Редове':value('редове'),'Брой модули на ред':value('брой модули на ред')}};
  const minimum=p.type==='ENCLOSURE'?[200,200,50]:[0.1,0.1,0.1];
  if(sizes.every((v,i)=>v>=minimum[i]&&v<=[1600,2400,1000][i]))armShopProduct(p,sizes);
  else confirmDimensions(p,sizes);
 }catch{if(request===selectionRequest)confirmDimensions(p,[])}
 finally{button.disabled=false}
}
function render(){const q=norm(search.value);const merged=new Map(products.map(p=>[norm(p.sku),p]));for(const p of catalog){const key=norm(p.sku);if(!merged.has(key)||merged.get(key).shopId)merged.set(key,p)}const found=[...merged.values()].filter(p=>(!category||p.type===category)&&(!q||[p.sku,p.ean,p.name,p.rating,p.category,p.manufacturer].some(v=>norm(v).includes(q))));found.sort((a,b)=>Number(norm(b.sku)===q||norm(b.ean)===q)-Number(norm(a.sku)===q||norm(a.ean)===q));result.replaceChildren();categories.querySelectorAll('button').forEach(b=>b.classList.toggle('electric-current',b.dataset.category===category));for(const p of found.slice(0,limit)){const button=document.createElement('button');button.className='electric-product';button.title='Избери '+p.sku;const img=document.createElement('img');img.alt='';img.loading='lazy';if(/^https:\/\/image\.schrackcdn\.com\//.test(p.imageUrl||''))img.src=p.imageUrl;const desc=document.createElement('span'),name=document.createElement('strong');name.textContent=p.name;const sku=document.createElement('small');sku.textContent=p.sku;const dims=document.createElement('small');dims.textContent=p.widthMm?p.widthMm+' × '+p.heightMm+' × '+p.depthMm+' mm':p.shopId?'От магазина · размери при избор':p.modules+' DIN · локален каталог';const price=document.createElement('small');price.textContent=publicPrice(p)===null?'Цена при запитване':fmt(p.unitPrice)+' без ДДС'+(p.priceSource==='schrack_2026_06'?' · справочна':'');desc.append(name,sku,dims,price);const plus=document.createElement('span');plus.className='cad-plus';plus.textContent='+';button.append(img,desc,plus);button.onclick=()=>selectProduct(p,button);result.append(button)}if(found.length>limit){const more=document.createElement('button');more.textContent='Покажи още '+Math.min(24,found.length-limit);more.onclick=()=>{limit+=24;render()};result.append(more)}$('catalogStatus').textContent=`${found.length} артикула${!online?' · справочни данни':''}${shopOnline===false?' · магазинът временно е недостъпен':''}`;if(!found.length){const empty=document.createElement('p');empty.className='hint';empty.textContent='Няма намерен артикул. Провери каталожния номер.';result.append(empty);const source=sourceIndex[q];if(source){const link=document.createElement('a');link.href=source;link.target='_blank';link.rel='noopener';link.textContent='Артикул в Schrack ↗';result.append(link);if(online){const load=document.createElement('button');load.className='primary';load.textContent='Зареди '+q+' от Schrack';load.onclick=async()=>{load.disabled=true;load.textContent='Зареждам…';try{const r=await fetch('api/electric-catalog.php?lookup=1&q='+encodeURIComponent(q),{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json(),p=data.products?.find(x=>norm(x.sku)===q);if(!p)throw Error();products.push(p);indexProduct(p);render()}catch{load.textContent='Не се зареди · опитай отново';load.disabled=false}};result.append(load)}}}}
function renderCabinet(){const c=PDGCad.cabinet(),p=byCode.get(norm(c.sku));boardCard.replaceChildren();const title=document.createElement('strong');title.textContent=p?p.sku:'▢ Корпус';const specs=document.createElement('p');specs.textContent=`${c.widthMm} × ${c.heightMm} × ${c.depthMm} mm`;const button=document.createElement('button');button.textContent='Избери корпус от каталога';button.onclick=()=>{category='ENCLOSURE';search.value='';render();left.scrollTop=0};boardCard.append(title,specs,button)}
function fromProduct(p,row,col){return {type:'CAT',width:p.modules,row,col,name:p.name,rating:p.rating,sku:p.sku,manufacturer:p.manufacturer,widthMm:p.widthMm,heightMm:p.heightMm,depthMm:p.depthMm,imageUrl:p.imageUrl,sourceUrl:p.sourceUrl,poles:p.poles,catalogType:p.type}}
let initialDemo=items.length>0&&items.every(it=>!it.sku);const oldDemo=$('demo').onclick;$('demo').onclick=()=>{oldDemo();sample()};
function sample(){const box=byCode.get(norm('WSA8060260'));if(box)PDGCad.chooseCabinet(box);const picks=[['BM617332',0,0],['BC054103',0,6],['BM617116',1,0],['BM617116',1,2],['BM617116',1,4],['BM617120',1,6],['BM617316',1,8],['BZ326471',2,0],['BZ326471',2,3]];const next=picks.flatMap(([sku,r,c])=>{const p=byCode.get(norm(sku));return p&&c+p.modules<=modules&&r<rows?[fromProduct(p,r,c)]:[]});if(next.length){items=next;selected=-1;redraw();showSelection()}renderCabinet()}
catalogRender=render;
search.oninput=()=>{limit=24;if(search.value.trim())category='';render()};
const originalSelection=showSelection;showSelection=function(){originalSelection();const it=items[selected];if(!it?.sku||!$('editName'))return;const p=byCode.get(norm(it.sku)),el=$('selection'),head=document.createElement('div');head.className='electric-selected-product';if(/^https:\/\/image\.schrackcdn\.com\//.test(it.imageUrl||'')){const img=document.createElement('img');img.src=it.imageUrl;img.alt='';head.append(img)}const title=document.createElement('strong');title.textContent=it.sku;head.append(title);el.prepend(head);const detail=document.createElement('p');detail.className='hint';detail.textContent=`${it.widthMm||it.width*18} × ${it.heightMm||'—'} × ${it.depthMm||'—'} mm · ${publicPrice(p)===null?'Цена при запитване':fmt(p.unitPrice)+' без ДДС'+(p.priceSource==='schrack_2026_06'?' · справочна':'')}`;el.append(detail);const source=p?.specifications?.['Източник за размерите']||p?.sourceUrl;if(/^https:\/\/(?:www\.schrack\.(?:bg|sk)|image\.schrackcdn\.com)\//i.test(source||'')){const link=document.createElement('a');link.href=source;link.target='_blank';link.rel='noopener';link.textContent=p.specifications?.['Източник за размерите']?'Размерен чертеж на Schrack ↗':'Данни от производителя ↗';el.append(link)}};
window.addEventListener('pdg-cad-change',renderCabinet);
window.PDGElectricCatalog={select:selectProduct,find:sku=>byCode.get(norm(sku)),rate:(w,t)=>{const r=rates.find(x=>Number(x.width_mm)===Number(w)&&Number(x.thickness_mm)===Number(t));return r?Number(r.price_per_m_cents)/100:null},online:()=>online,ready:null};
fetch('database/electrical-source-index.json').then(r=>r.ok?r.json():{}).then(d=>{sourceIndex=d;render()}).catch(()=>{});
window.PDGElectricCatalog.ready=(async()=>{try{const r=await fetch('api/electric-catalog.php',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.products))throw Error();products=data.products;rates=data.busbarRates||[];online=true}catch{try{const r=await fetch('database/electrical-catalog.json');if(!r.ok)throw Error();products=(await r.json()).products||[];const ref=await fetch('database/electrical-reference-prices.json').then(r=>r.ok?r.json():{}).catch(()=>({}));rates=Object.values(ref.busbarRates||{});for(const p of products){const cents=ref.products?.[norm(p.sku)];if(Number.isInteger(cents)){p.unitPrice=cents/100;p.priceSource='schrack_2026_06'}}}catch{products=[]}}for(const p of products)indexProduct(p);render();if(initialDemo&&items.every(it=>!it.sku))sample();renderCabinet()})();
const cadReady=window.PDGElectricCatalog.ready;
window.PDGElectricCatalog.ready=Promise.all([cadReady,(async()=>{
 try{
  const r=await fetch('api/products.php',{cache:'no-store'});
  if(!r.ok)throw Error();
  const data=await r.json();
  if(!Array.isArray(data.products))throw Error();
  await cadReady;
  for(const row of data.products){
   if(!row.id||!row.code||!row.name||!/^Schrack(?: Technik)?$/i.test(row.brand)||!/^Електроапаратура(?:\s*\/|$)/u.test(row.category))continue;
   if(byCode.has(norm(row.code)))continue;
   const p=shopProduct(row);
   products.push(p);indexProduct(p);
  }
  shopOnline=true;
 }catch{shopOnline=false}
 render();
})()]);

})();

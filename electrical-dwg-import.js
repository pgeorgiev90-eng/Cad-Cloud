(() => {
'use strict';
const section=document.createElement('details');
section.className='cad-dwg-import';
const summary=document.createElement('summary');
summary.textContent='Импорт на апаратура от DWG';
const label=document.createElement('label');
label.textContent='DWG файл до 12 MB';
const input=document.createElement('input');
input.type='file';
input.accept='.dwg';
input.id='electric-dwg-file';
label.htmlFor=input.id;
const hint=document.createElement('p');
hint.className='hint';
hint.textContent='Четат се блоковете в Model Space и техните атрибути. Провери съвпаденията по код или EAN и постави избраните апарати.';
const result=document.createElement('div');
result.setAttribute('aria-live','polite');
section.append(summary,label,input,hint,result);
$('catalogSearch').before(section);
function parse(buffer) {
    return new Promise((resolve,reject) => {
        const worker=new Worker('electrical-dwg-worker.js',{type:'module'});
        const finish=(callback,value)=>{clearTimeout(timer);worker.terminate();callback(value);};
        const timer=setTimeout(()=>finish(reject,Error('Четенето на DWG отне твърде дълго.')),45000);
        worker.onmessage=({data})=>data.error?finish(reject,Error(data.error)):finish(resolve,data);
        worker.onerror=()=>finish(reject,Error('Декодерът за DWG не се зареди.'));
        worker.postMessage(buffer,[buffer]);
    });
}
input.addEventListener('change',async()=>{
    const file=input.files[0];
    if (!file) return;
    input.disabled=true;
    result.textContent='Четене на DWG…';
    try {
        if (!/\.dwg$/i.test(file.name) || file.size>12*1024*1024) throw Error('Избери DWG файл до 12 MB.');
        const signature=new TextDecoder().decode(await file.slice(0,6).arrayBuffer());
        if (!/^AC10\d\d$/.test(signature)) throw Error('Файлът няма разпознаваем DWG формат.');
        const data=await parse(await file.arrayBuffer());
        await PDGElectricCatalog.ready;
        const list=document.createElement('ul');
        let matched=0;
        for (const row of data.rows) {
            const li=document.createElement('li');
            const candidates=new Set(row.candidates.map(code=>PDGElectricCatalog.find(code)).filter(Boolean));
            const product=candidates.size===1?[...candidates][0]:null;
            li.textContent=(row.block||'Блок')+' × '+row.count+
                (row.codes.length?' · '+row.codes.join(', '):'')+
                (Object.keys(row.details).length?' · '+Object.entries(row.details).map(([key,value])=>key+' '+value).join(' · '):'');
            if (product) {
                matched+=row.count;
                const use=document.createElement('button');
                use.type='button';
                use.textContent=(product.type==='ENCLOSURE'?'Избери корпус ':'Постави ')+product.sku;
                use.onclick=()=>{
                    if (product.type==='ENCLOSURE'){PDGCad.chooseCabinet(product);return;}
                    selectedCatalog=product;
                    setView('front');
                    PDGCad.arm();
                    $('status').textContent='DWG · '+product.sku+' — щракни в таблото за всяка бройка.';
                };
                li.append(document.createElement('br'),use);
            } else {
                const state=document.createElement('small');
                state.textContent=candidates.size>1?'Няколко съвпадения — провери кода.':'Няма точно съвпадение в каталога.';
                li.append(document.createElement('br'),state);
            }
            list.append(li);
        }
        const count=document.createElement('p');
        count.textContent=data.blocks?'Блокове: '+data.blocks+' · разпознати по каталог: '+matched+
            (data.shown<data.blocks?' · показани: '+data.shown:''):'Няма блокове в Model Space.';
        result.replaceChildren(count,list);
    } catch (error) {
        result.textContent=error.message;
    } finally {
        input.value='';
        input.disabled=false;
    }
});
})();

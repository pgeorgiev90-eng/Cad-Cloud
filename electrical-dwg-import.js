(() => {
'use strict';
const section=document.createElement('details');
section.className='cad-dwg-import';
const summary=document.createElement('summary');
summary.textContent='Импорт на схема от DWG';
const label=document.createElement('label');
label.textContent='DWG файл до 12 MB';
const input=document.createElement('input');
input.type='file';
input.accept='.dwg';
input.id='electric-dwg-file';
label.htmlFor=input.id;
const hint=document.createElement('p');
hint.className='hint';
hint.textContent='DWG с блокове в Model Space. За автоматично опроводяване използвай означения на клеми като QF1_TOP_1 и проводници на слой L1, L2, L3, N или PE. Избери корпус от каталога преди прегледа.';
const result=document.createElement('div');
result.setAttribute('aria-live','polite');
section.append(summary,label,input,hint,result);
$('catalogSearch').before(section);
function parse(buffer) {
    return new Promise((resolve,reject) => {
        const worker=new Worker('electrical-dwg-worker.js?v=wire-dwg1',{type:'module'});
        const finish=(callback,value)=>{clearTimeout(timer);worker.terminate();callback(value);};
        const timer=setTimeout(()=>finish(reject,Error('Четенето на DWG отне твърде дълго.')),45000);
        worker.onmessage=({data})=>data.error?finish(reject,Error(data.error)):finish(resolve,data);
        worker.onerror=()=>finish(reject,Error('Декодерът за DWG не се зареди.'));
        worker.postMessage(buffer,[buffer]);
    });
}
function textElement(tag,text,parent){
    const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;
}
function action(text,parent,run){
    const button=textElement('button',text,parent);
    button.type='button';button.onclick=run;return button;
}
function endName(end){return end.ref+' · '+(end.side==='top'?'горна ':'долна ')+(end.pole+1);}
function drawingPreview(project){
    const plate=PDGBusbar.layout(project.cabinet,project.rows,project.modules);
    const create=(tag,attrs,parent)=>{
        const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
        for(const [name,value] of Object.entries(attrs))el.setAttribute(name,value);
        parent?.append(el);return el;
    };
    const svg=create('svg',{viewBox:`0 0 ${plate.width} ${plate.height}`,width:'100%',height:260,role:'img',
        'aria-label':'Предложена монтажна подредба и трасета'});
    create('rect',{x:0,y:0,width:plate.width,height:plate.height,fill:'#f2f6fc',stroke:'#8799ac'},svg);
    for(const rail of project.dinRails)create('rect',{...rail,height:12,fill:'#a7b3c0'},svg);
    for(const item of project.items){
        create('rect',{x:item.x,y:item.y,width:item.widthMm,height:item.heightMm,fill:'#d8e9f8',stroke:'#455b70'},svg);
        create('title',{},svg.lastElementChild).textContent=(item.designation||'')+' '+item.sku;
    }
    const items=new Map(project.items.map(item=>[item.connectionId,item]));
    const at=end=>{
        const item=items.get(end.device);
        return PDGConnections.terminalPosition(item,end,item,item.widthMm,item.heightMm);
    };
    for(const wire of project.connections){
        const phase=PDGConnections.phases[wire.phase];
        const points=PDGConnections.route(at(wire.from),at(wire.to),wire.bends).map(p=>p.x+','+p.y).join(' ');
        const attributes={points,fill:'none','stroke-width':3,stroke:phase.color};
        create('polyline',attributes,svg);
        if(phase.stripe)create('polyline',{...attributes,stroke:phase.stripe,'stroke-dasharray':'6 6'},svg);
    }
    return svg;
}
function showImport(data){
    result.replaceChildren();
    const devices=[], choices=[], preview=document.createElement('div');
    const articleList=document.createElement('ul');
    const wireList=document.createElement('ul');
    const count=textElement('p','Блокове апаратура: '+data.blocks+' · предложения за връзки: '+data.proposals.length,result);
    if(data.limited)count.append(' · пропуснати по лимит: '+data.limited);
    if(!data.devices.length)return;
    textElement('h4','1. Свери апаратите',result);
    result.append(articleList);
    const refs=new Map();
    for(const row of data.devices){
        if(row.ref)refs.set(row.ref,(refs.get(row.ref)||0)+1);
        const li=textElement('li',[(row.ref||'Без означение'),(row.block||'Блок'),row.codes.join(', ')].filter(Boolean).join(' · '),articleList);
        const candidates=[...new Set(row.candidates.map(code=>PDGElectricCatalog.find(code)).filter(Boolean))];
        const state={ref:row.ref,product:null};
        const select=document.createElement('select');
        select.setAttribute('aria-label','Артикул за '+(row.ref||row.block));
        select.append(new Option('Изключен от предложението',''));
        const code=document.createElement('input');
        code.placeholder='Въведи артикулен номер или EAN';
        code.setAttribute('aria-label','Търси точен артикул за '+(row.ref||row.block));
        const feedback=textElement('small','',li);
        function setOptions(products){
            select.replaceChildren(new Option('Изключен от предложението',''));
            for(const p of products)select.append(new Option(p.sku+' · '+p.name,p.sku));
            select.value=products.length===1?products[0].sku:'';
            updateProduct();
        }
        function updateProduct(){
            state.product=select.value?PDGElectricCatalog.find(select.value):null;
            feedback.textContent=state.product?.type==='ENCLOSURE'?' · корпус':state.product&&!state.product.widthMm?
                ' · липсват потвърдени монтажни размери':'';
            preview.replaceChildren();
        }
        select.onchange=updateProduct;
        setOptions(candidates);
        li.append(document.createElement('br'),select,code);
        action('Провери код',li,()=>{
            const product=PDGElectricCatalog.find(code.value);
            if(product){setOptions([...new Set([...candidates,product])]);select.value=product.sku;updateProduct();}
            else feedback.textContent=' · кодът липсва в каталога';
        });
        const manual=action('Постави ръчно',li,()=>{
            if(!state.product){feedback.textContent=' · първо избери артикул';return;}
            PDGElectricCatalog.select(state.product,manual);
        });
        devices.push(state);
    }
    textElement('h4','2. Потвърди предложените проводници',result);
    result.append(wireList);
    const unique=ref=>refs.get(ref)===1;
    for(const wire of data.proposals){
        const li=document.createElement('li'),label=document.createElement('label'),check=document.createElement('input');
        check.type='checkbox';
        check.disabled=!unique(wire.from.ref)||!unique(wire.to.ref);
        check.onchange=()=>preview.replaceChildren();
        label.append(check,' '+(wire.phase||'Избери проводник')+' · '+endName(wire.from)+' → '+endName(wire.to));
        li.append(label);wireList.append(li);
        if(check.disabled)textElement('small',' · липсващо или повторено означение на апарат',li);
        let conductor;
        if(!wire.phase){
            conductor=document.createElement('select');
            conductor.setAttribute('aria-label','Проводник '+endName(wire.from)+' към '+endName(wire.to));
            conductor.append(new Option('Избери L1, L2, L3, N или PE',''));
            for(const [key,phase] of Object.entries(PDGConnections.phases))conductor.append(new Option(phase.label,key));
            conductor.onchange=()=>preview.replaceChildren();
            li.append(conductor);
        }
        choices.push({wire,check,conductor});
    }
    for(const entry of data.review)textElement('li',(entry.phase||'Без означение')+' · за проверка: '+entry.reason,wireList);
    if(data.skipped)textElement('p','Линии за ръчна проверка: '+data.skipped+' · неподдържана геометрия или лимит.',result);
    textElement('p','Пресичане без общ край не създава връзка. Провери проводниците преди прилагане.',result);
    action('Преглед на подредбата',result,()=>{
        preview.replaceChildren();
        try{
            const current=PDGCad.project(),baseline=JSON.stringify(current);
            const selected=devices.filter(d=>d.product&&d.product.type!=='ENCLOSURE');
            if(!selected.length)throw Error('Избери поне един апарат.');
            const boxes=[...new Set(devices.map(d=>d.product).filter(p=>p?.type==='ENCLOSURE'))];
            if(boxes.length>1)throw Error('Остави само един избран корпус.');
            const box=boxes[0];
            const project=box?{...current,cabinet:{sku:box.sku,widthMm:box.widthMm,heightMm:box.heightMm,depthMm:box.depthMm}}:current;
            const accepted=choices.filter(c=>c.check.checked).map(({wire,conductor})=>({...wire,phase:wire.phase||conductor.value}));
            if(accepted.some(wire=>!wire.phase))throw Error('Избери проводник за всяко потвърдено трасе без означение.');
            const plan=PDGDwgPlan.propose(project,selected,accepted);
            const next=plan.project;
            textElement('p',next.items.length+' апарата · '+next.dinRails.length+' DIN реда · '+
                next.connections.length+' проводника · корпус '+next.cabinet.widthMm+' × '+next.cabinet.heightMm+' mm',preview);
            preview.append(drawingPreview(next));
            const positions=document.createElement('ul');
            for(const it of next.items)textElement('li',(it.designation||it.sku)+' · '+it.sku+' · X '+it.x.toFixed(1)+' / Y '+it.y.toFixed(1)+' mm',positions);
            preview.append(positions);
            for(const entry of plan.unresolved)textElement('p','Пропусната връзка '+endName(entry.link.from)+' → '+endName(entry.link.to)+' · '+entry.reason,preview);
            action('Замени текущия чертеж с предложението',preview,()=>{
                if(JSON.stringify(PDGCad.project())!==baseline){textElement('p','Проектът е променен. Обнови прегледа.',preview);return;}
                try{PDGCad.applyImport(next);preview.replaceChildren();textElement('p','Предложението е приложено. „Отмени“ връща предишния чертеж.',preview);}
                catch(error){textElement('p',error.message,preview);}
            });
        }catch(error){textElement('p',error.message,preview);}
    });
    result.append(preview);
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
        showImport(data);
    } catch (error) {
        result.textContent=error.message;
    } finally {
        input.value='';
        input.disabled=false;
    }
});
})();

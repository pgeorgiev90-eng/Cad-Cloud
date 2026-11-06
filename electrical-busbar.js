/* PDG Electric CAD: millimetre geometry; legacy DIN projects remain readable. */
(()=>{
'use strict';
const C=PDGBusbar, W=PDGConnections, oldSelection=showSelection,oldPlace=place;
let connections=[], wiring=false, wireStart=null, wireBends=[];
const marked=new Set();
let marking=false;
let mode='din',bars=[],active=-1,vertex=-1,draft=null,editing=false,moving=null,moduleTemplate=null,suppressClick=false,placing=false,cabinet={sku:'',widthMm:600,heightMm:800,depthMm:260};
const scale=1;const pitch=()=>Math.max(95,(cabinet.heightMm-180)/rows);const usableW=()=>Math.max(0,cabinet.widthMm-Math.min(96,cabinet.widthMm*.16)),usableH=()=>Math.max(0,cabinet.heightMm-125);const inset=()=>Math.max(0,(usableW()-modules*18)/2);const widthOf=it=>it.widthMm||it.width*18,heightOf=it=>it.heightMm||83;const deviceMeta=p=>p?{widthMm:p.widthMm,heightMm:p.heightMm,depthMm:p.depthMm,imageUrl:p.imageUrl,sourceUrl:p.sourceUrl,poles:p.poles,catalogType:p.type}:{};
const status=t=>$('status').textContent=t;
const position=it=>({x:mode==='free'&&Number.isFinite(it.x)?it.x:inset()+it.col*18,y:mode==='free'&&Number.isFinite(it.y)?it.y:it.row*pitch()});
function terminalEntries() {
    return items.flatMap((item,index) => ['top','bottom'].flatMap(side =>
        Array.from({length:W.poleCount(item)},(_,pole) => {
            const end = {device:item.connectionId,side,pole};
            return {end,index,...W.terminalPosition(item,end,position(item),widthOf(item),heightOf(item))};
        })));
}
const deviceTargets=()=>terminalEntries().map(({x,y})=>({x,y}));
const targets=()=>deviceTargets().concat(bars.flatMap(b=>b.points));
function pfrom(e){const s=$('drawing'),r=s.getBoundingClientRect();return C.snap({x:((e.clientX-r.left)*s.viewBox.baseVal.width/r.width-50)/scale,y:((e.clientY-r.top)*s.viewBox.baseVal.height/r.height-120)/scale,z:Number($('barDepth').value)},targets())}
let fieldId=0;function field(parent,label,type,value,change,attrs={}){const l=document.createElement('label');l.textContent=label;parent.append(l);const input=document.createElement('input');input.type=type;Object.assign(input,attrs);input.id=input.id||'cad-field-'+(++fieldId);l.htmlFor=input.id;input.value=value;input.onchange=()=>change(input.value);parent.append(input);return input}
function button(parent,label,run,id){const b=document.createElement('button');b.type='button';b.textContent=label;if(id)b.id=id;b.onclick=run;parent.append(b);return b}
const side=document.querySelector('aside');const settings=document.createElement('section');settings.innerHTML='<h3>Монтаж и тоководещи шини</h3><label>Вид табло</label><select id="boardMode"><option value="din">Табло с DIN шини</option><option value="free">Празна монтажна кутия</option></select><p class="hint">Размерите на шините са в mm. При свободен монтаж апаратите се поставят и местят по мрежа 5 mm. Шините се чертаят в монтажния изглед.</p>';
side.insertBefore(settings,$('catalogSearch').previousElementSibling.previousElementSibling);
field(settings,'Ширина на шина (mm)','number',20,()=>{}, {id:'barWidth',min:2,max:100});
field(settings,'Дебелина (mm)','number',5,()=>{}, {id:'barThickness',min:1,max:20});
field(settings,'Отстояние от плочата (mm)','number',30,()=>{}, {id:'barDepth',min:0,max:300});
field(settings,'Цвят','color','#e5b82a',()=>{}, {id:'barColor'});
button(settings,'Чертай тоководеща шина',()=>{stopWire();if(view!=='front')setView('front');editing=true;draft=null;active=-1;selectedCatalog=null;placing=false;status('Щракни за начало, после за огъвки или друга клема. Завърши с бутона или Enter. Escape отказва.');redraw()},'drawBusbar');
button(settings,'Завърши шина',finish,'finishBusbar');button(settings,'Откажи чертането',cancel,'cancelBusbar');
button(settings,'Запази избраната шина като модул',()=>{if(!bars[active])return status('Избери шина.');moduleTemplate=JSON.parse(JSON.stringify(bars[active]));try{localStorage.setItem('pdg_busbar_module_v1',JSON.stringify(moduleTemplate));status('Модулът е запазен в този браузър.')}catch{status('Модулът е достъпен до затваряне на страницата.')}},'saveBusbarModule');
button(settings,'Постави запазен модул',()=>{stopWire();if(!moduleTemplate)return status('Няма запазен модул.');editing='module';draft=null;setView('front');status('Щракни за начало на запазения модул.');},'placeBusbarModule');
try{const t=JSON.parse(localStorage.getItem('pdg_busbar_module_v1')||'null');if(t){C.validate({rows,modules,items:[],busbars:[t]});moduleTemplate=t}}catch{}
const toolbar=document.querySelector('.toolbar');button(toolbar,'Страничен изглед',()=>setView('side'),'sideView');button(toolbar,'3D изглед',()=>setView('3d'),'threeView');
$('boardMode').onchange=()=>{const next=$('boardMode').value;try{C.validate({...data(),mode:next});mode=next;cancel();redraw()}catch(err){$('boardMode').value=mode;status('Първо подреди апаратите по DIN редове: '+err.message)}};
function finish(){if(draft?.points.length>=2){bars.push(draft);active=bars.length-1;vertex=0;draft=null;editing=false;showSelection();status('Шината е добавена. Избери точка за размери и отвор.')}else status('Необходими са поне две различни точки.');redraw()}
function cancel(){stopWire();draft=null;editing=false;moving=null;redraw();status('Готов за работа.')}
function params(){const b={width:Number($('barWidth').value),thickness:Number($('barThickness').value),color:$('barColor').value,points:[{x:0,y:0,z:Number($('barDepth').value)},{x:5,y:0,z:Number($('barDepth').value)}],holes:[]};C.validate({rows,modules,items:[],busbars:[b]});return b}
function append(p){try{if(p.x>usableW()||p.y>usableH()||p.z>Math.min(300,cabinet.depthMm))throw Error('Точката е извън монтажната плоча или дълбочината на корпуса.');if(editing==='module'){const b=JSON.parse(JSON.stringify(moduleTemplate)),origin=b.points[0];b.points=b.points.map(q=>({x:q.x-origin.x+p.x,y:q.y-origin.y+p.y,z:q.z-origin.z+p.z}));C.validate({rows,modules,items:[],busbars:[b]});if(b.points.some(q=>q.x>usableW()||q.y>usableH()||q.z>cabinet.depthMm))throw Error('Модулът не се побира на тази позиция.');bars.push(b);active=bars.length-1;editing=false;showSelection()}else if(!draft){draft=params();draft.points=[p]}else if(C.length({points:[draft.points.at(-1),p]})>.01)draft.points.push(p);redraw()}catch(err){status(err.message)}}
function barsRender(){const svg=$('drawing');bars.concat(draft?[draft]:[]).forEach((b,i)=>{const points=b.points.map(p=>C.project(p,view)),g=node('g',{'data-busbar':i,'aria-label':'Тоководеща шина '+(i+1)});const path=node('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:b.color,'stroke-width':view==='side'?b.thickness*2:b.width*(view==='front'?scale:1.25),'stroke-linejoin':'round',opacity:i===active?1:.84,style:'cursor:pointer'},g);path.addEventListener('pointerdown',e=>{if(editing)return;e.stopPropagation();active=i;selected=-1;vertex=0;showSelection();redraw()});b.holes.forEach(h=>{const p=points[h.index];if(h.bolt){node('path',{d:`M ${p.x-5} ${p.y} h 10 M ${p.x} ${p.y-5} v 10`,stroke:'#1c3040','stroke-width':3},g)}node('circle',{cx:p.x,cy:p.y,r:h.diameter*(view==='front'?scale:1.25)/2,fill:h.bolt?'#9aaab5':'#fff',stroke:'#34495e','stroke-width':1},g)});if(i===active||b===draft)points.forEach((p,j)=>{const h=node('circle',{cx:p.x,cy:p.y,r:j===vertex?6:4,fill:'#fff',stroke:'#0b5292','stroke-width':2,style:'cursor:move','data-vertex':j},g);h.addEventListener('pointerdown',e=>{if(view!=='front'||editing)return;e.stopPropagation();vertex=j;moving={kind:'vertex',i,j};svg.setPointerCapture(e.pointerId);showSelection()})})})}
function boardRender(){
 const svg=$('drawing');svg.replaceChildren();const front=view==='front',w=front?cabinet.widthMm+45:Math.max(660,cabinet.widthMm*1.25+300),h=front?cabinet.heightMm+95:Math.max(850,cabinet.heightMm*1.5+180);svg.setAttribute('width',w);svg.setAttribute('height',h);svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const defs=node('defs');for(const [id,stops]of [['cad-metal',['#6c767b','#f9fafb','#a4afb6','#e4e9ed','#68747b']],['cad-device',['#d0d4d7','#fff','#e5e8ea']],['cad-blue',['#537aab','#113b75','#305f98']]]){const grad=node('linearGradient',{id,x1:'0%',y1:'0%',x2:'0%',y2:'100%'},defs);stops.forEach((color,i)=>node('stop',{offset:(i/(stops.length-1)*100)+'%','stop-color':color},grad))}
 if(front){node('image',{href:'assets/electric-cabinet-render.webp',x:30,y:59,width:cabinet.widthMm,height:cabinet.heightMm,preserveAspectRatio:'none','pointer-events':'none'});const bx=42,ex=30+cabinet.widthMm-12,ey=59+cabinet.heightMm-16;node('path',{d:`M ${bx} 47 H ${ex} M ${bx} 38 V 57 M ${ex} 38 V 57 M 22 73 V ${ey} M 15 73 H 29 M 15 ${ey} H 29`,stroke:'#17253d','stroke-width':1,fill:'none'});txt((bx+ex)/2-27,35,cabinet.widthMm+' mm',15,'#111b2f');const t=txt(13,(73+ey)/2+35,cabinet.heightMm+' mm',15,'#111b2f');t.setAttribute('transform',`rotate(-90 13 ${(73+ey)/2+35})`);if(mode==='din')for(let r=0;r<rows;r++){const y=120+r*pitch(),x=46+inset(),rw=modules*18+8;node('rect',{x,y:y+24,width:rw,height:35,fill:'url(#cad-metal)',stroke:'#616d76','stroke-width':1});for(let i=x+7;i<x+rw-13;i+=23)node('rect',{x:i,y:y+38,width:13,height:6,rx:3,fill:'#606c74'});if(r>0){node('rect',{x:x-7,y:y-35,width:rw+14,height:18,fill:'url(#cad-metal)',stroke:'#758087'});for(let i=x-2;i<x+rw;i+=10)node('rect',{x:i,y:y-32,width:5,height:12,fill:'#4c5459'})}}}
 else{txt(30,45,view==='side'?'Страничен изглед · отстояния от монтажната плоча':'Аксонометричен изглед',22);node('rect',{x:30,y:65,width:w-60,height:h-100,fill:'#f2f6fc',stroke:'#9aaabe'})}
 items.forEach((it,i)=>{const pos=position(it),p=C.project({...pos,z:front?0:Math.min(25,cabinet.depthMm)},view),g=node('g',{'data-device':i,style:'cursor:grab'});const ww=view==='side'?(it.depthMm||70)*2:widthOf(it)*(view==='3d'?1.25:1),hh=heightOf(it)*(view==='side'?1.5:view==='3d'?1.1:1);PDGDeviceFace.draw(node,g,it,p.x,p.y,ww,hh,Math.max(1,W.poleCount(it)));if(i===selected||marked.has(it)){node('rect',{x:p.x-2,y:p.y-2,width:ww+4,height:hh+4,fill:'none',stroke:'#064bff','stroke-width':2},g);for(const x of [p.x-2,p.x+ww+2])for(const y of [p.y-2,p.y+hh+2])node('rect',{x:x-2,y:y-2,width:4,height:4,fill:'#fff',stroke:'#064bff'},g)}g.addEventListener('pointerdown',e=>{if(editing||wiring||!front)return;e.stopPropagation();selected=i;active=-1;moving={kind:marked.size>1&&marked.has(it)?'group':'device',i,start:pfrom(e),pos};svg.setPointerCapture(e.pointerId);showSelection()})});
 $('bom').textContent=items.map(it=>(it.sku?it.sku+' · ':'')+it.name+' '+it.rating).join(' | ');$('summary').textContent=`Апарати: ${items.length} · шини: ${bars.length} · дължина: ${Math.round(bars.reduce((s,b)=>s+C.length(b),0))} mm`;
}
function terminalName(end) {
    const index = items.findIndex(item => item.connectionId === end.device);
    return 'Q' + (index+1) + ' · ' + (end.side==='top'?'горна ':'долна ') + (end.pole+1);
}
function stopWire() {
    wiring=false; wireStart=null; wireBends=[];
    $('drawConnection').setAttribute('aria-pressed','false');
}
function connect(entry) {
    const item=items[entry.index];
    item.connectionId ||= crypto.randomUUID();
    const end={...entry.end,device:item.connectionId};
    if (!wireStart) {
        wireStart=end;
        status('Избрана ' + terminalName(end) + '. Посочи клема на друг апарат или щракни за чупка.');
    } else {
        const connection={from:wireStart,to:end,bends:wireBends,phase:phaseSelect.value};
        try {
            W.validate(items,[...connections,connection]);
            connections.push(connection);
            wireStart=null; wireBends=[];
            status('Връзката е записана. Можеш да започнеш следваща.');
        } catch (error) { status(error.message); }
    }
    redraw();
}
const wireButton=button(toolbar,'Чертай връзка',()=>{
    if (wiring) {stopWire();redraw();status('Чертането на връзка е изключено.');return;}
    setView('front'); placing=false; wiring=true;
    wireButton.setAttribute('aria-pressed','true');
    status('Избери първата клема. Щракни върху плочата за чупки и върху втора клема за край.');
    redraw();
},'drawConnection');
wireButton.setAttribute('aria-pressed','false');
const phaseLabel=document.createElement('label');
phaseLabel.className='cad-wire-phase';
phaseLabel.textContent='Проводник ';
const phaseSelect=document.createElement('select');
phaseSelect.setAttribute('aria-label','Фаза или проводник на връзката');
for (const [value, phase] of Object.entries(W.phases)) {
    const option=document.createElement('option');
    option.value=value;option.textContent=phase.label;phaseSelect.append(option);
}
phaseLabel.append(phaseSelect);
wireButton.after(phaseLabel);
const wireList=document.createElement('details');
wireList.className='cad-wire-list';
const wireSummary=document.createElement('summary');
const wireRows=document.createElement('div');
wireList.append(wireSummary,wireRows);
settings.after(wireList);
function renderWireList() {
    wireSummary.textContent='Връзки между клеми (' + connections.length + ')';
    wireRows.replaceChildren();
    connections.forEach((connection,index)=>{
        const row=document.createElement('p');
        row.textContent=terminalName(connection.from) + ' → ' + terminalName(connection.to) + ' ';
        const conductor=phaseSelect.cloneNode(true);
        conductor.setAttribute('aria-label','Проводник на '+terminalName(connection.from)+' към '+terminalName(connection.to));
        if (!connection.phase) {
            const option=document.createElement('option');option.value='';option.textContent='Без означение';conductor.prepend(option);
        }
        conductor.value=connection.phase||'';
        conductor.onchange=()=>{if(conductor.value)connection.phase=conductor.value;else delete connection.phase;redraw();};
        row.append(conductor);
        button(row,'Изтрий',()=>{connections.splice(index,1);redraw();status('Връзката е премахната.');});
        wireRows.append(row);
    });
}
function wireShape(tag, attrs, connection, width) {
    const phase=Object.hasOwn(W.phases,connection.phase)?W.phases[connection.phase]:null;
    const base={...attrs,fill:'none','stroke-width':width,'stroke-linecap':'round',
        'stroke-linejoin':'round','pointer-events':'none'};
    node(tag,{...base,stroke:phase?.color||'#087dc2','data-connection':'','aria-label':phase?.label||'Връзка'});
    if (phase?.stripe) node(tag,{...base,stroke:phase.stripe,'stroke-dasharray':'6 6','stroke-linecap':'butt'});
}
function drawWires(entries) {
    const points=new Map(entries.filter(p=>p.end.device).map(p=>[W.key(p.end),p]));
    for (const connection of connections) {
        const start=points.get(W.key(connection.from)), end=points.get(W.key(connection.to));
        const route=W.route(start,end,connection.bends).map(p=>C.project({...p,z:0},view));
        wireShape('polyline',{points:route.map(p=>p.x+','+p.y).join(' ')},connection,3);
    }
    for (const entry of entries) {
        const p=C.project({...entry,z:0},view);
        const active=wireStart && W.key(entry.end)===W.key(wireStart);
        const terminal=node('circle',{cx:p.x,cy:p.y,r:wiring?5.2:2.6,fill:active?'#f4b635':wiring?'#e7f8ff':'#c5d3dc',
            stroke:'#205375','stroke-width':1.2,'pointer-events':wiring?'auto':'none'});
        if (!wiring) continue;
        terminal.setAttribute('data-terminal',entry.index+':'+entry.end.side+':'+entry.end.pole);
        terminal.setAttribute('tabindex','0');
        terminal.setAttribute('role','button');
        const title=node('title',{},terminal);
        title.textContent='Q'+(entry.index+1)+' · '+(entry.end.side==='top'?'горна ':'долна ')+(entry.end.pole+1);
        terminal.setAttribute('aria-label',title.textContent);
        terminal.addEventListener('keydown',event=>{
            if (event.key!=='Enter' && event.key!==' ') return;
            event.preventDefault();event.stopPropagation();connect(entry);
        });
    }
    if (wireStart) for (const point of wireBends) {
        const p=C.project({...point,z:0},view);
        node('circle',{cx:p.x,cy:p.y,r:3.2,fill:'#087dc2','pointer-events':'none'});
    }
}
$('drawing').addEventListener('pointerdown',event=>{
    if (wiring) event.stopImmediatePropagation();
},true);
$('drawing').addEventListener('click',event=>{
    if (!wiring) return;
    event.preventDefault();event.stopImmediatePropagation();
    const target=event.target.closest('[data-terminal]');
    if (target) {
        const [index,side,pole]=target.getAttribute('data-terminal').split(':');
        const entry=terminalEntries().find(t=>t.index===Number(index)&&t.end.side===side&&t.end.pole===Number(pole));
        if (entry) connect(entry);
        return;
    }
    if (!wireStart || event.target.closest('[data-device]') || wireBends.length>=24) return;
    const svg=$('drawing'), matrix=svg.getScreenCTM();
    if (!matrix) return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    const x=Math.round((point.x-50)/5)*5, y=Math.round((point.y-120)/5)*5;
    if (x<0 || x>usableW() || y<0 || y>usableH()) return status('Чупката трябва да е в монтажната плоча.');
    wireBends.push({x,y});redraw();
},true);
const groupButton=button(toolbar,'Маркирай група',()=>{
    if (view!=='front') setView('front');
    stopWire();placing=false;editing=false;draft=null;
    marking=!marking;
    groupButton.setAttribute('aria-pressed',String(marking));
    status(marking?'Щракни върху апаратите за маркиране. После изключи маркирането, за да ги преместиш.':'Хвани маркиран апарат, за да преместиш групата.');
    redraw();
},'markDeviceGroup');
groupButton.setAttribute('aria-pressed','false');
const topAlign=button(toolbar,'Изравни горе',()=>arrangeGroup('top'));
const leftAlign=button(toolbar,'Изравни вляво',()=>arrangeGroup('left'));
const clearGroup=button(toolbar,'Свали маркирането',()=>{marked.clear();redraw();});
function arrangeGroup(action, dx=0, dy=0) {
    const group=items.filter(item=>marked.has(item));
    if (group.length<2) return;
    const din=mode==='din';
    const box=item=>din?{x:item.col,y:item.row,width:item.width,height:1}:
        {...position(item),width:widthOf(item),height:heightOf(item)};
    const source=group.map(box);
    const minX=Math.min(...source.map(p=>p.x)),minY=Math.min(...source.map(p=>p.y));
    const stepX=din?Math.round(dx/18):dx,stepY=din?Math.round(dy/pitch()):dy;
    const proposed=source.map(p=>({...p,
        x:action==='left'?minX:p.x+stepX,
        y:action==='top'?minY:p.y+stepY
    }));
    const fixed=items.filter(item=>!marked.has(item)).map(box);
    if (!W.validGroup(proposed,fixed,din?modules:usableW(),din?rows:usableH())) {
        status('Групата не може да се постави там: застъпване или излизане извън таблото.');
        return;
    }
    for (const [index,item] of group.entries()) {
        const {x,y}=proposed[index];
        if (din) {item.col=x;item.row=y;delete item.x;delete item.y;}
        else {item.x=x;item.y=y;}
    }
    status('Обновени позиции на '+group.length+' апарата.');
    redraw();showSelection();
}
$('drawing').addEventListener('pointerdown',event=>{
    if (view==='front' && !wiring && (marking || event.shiftKey) && event.target.closest('[data-device]')) {
        event.stopImmediatePropagation();
    }
},true);
$('drawing').addEventListener('click',event=>{
    if (view!=='front' || wiring || (!marking && !event.shiftKey)) return;
    const group=event.target.closest('[data-device]');
    if (!group) return;
    event.preventDefault();event.stopImmediatePropagation();
    const item=items[Number(group.getAttribute('data-device'))];
    if (!item) return;
    if (marked.has(item)) marked.delete(item); else marked.add(item);
    status('Маркирани апарати: '+marked.size);
    redraw();
},true);
function renderConnectionsSchematic() {
    const svg=$('drawing');
    svg.replaceChildren();
    const blocks=items.map((item,index)=>({item,index,width:Math.max(112, W.poleCount(item)*24)}));
    let x=44;
    for(const block of blocks){block.x=x;x+=block.width+18;}
    const width=Math.max(670,x+25),height=Math.max(350,228+connections.length*13);
    svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    node('rect',{x:0,y:0,width,height,fill:'#fff'});
    txt(44,42,'Схема на въведените връзки',23);
    txt(44,69,'Г = горна клема · Д = долна клема. Показват се само въведените връзки.',13);
    const ends=new Map();
    for(const {item,index,x,width} of blocks){
        node('rect',{x,y:99,width,height:64,rx:6,fill:'#edf4fa',stroke:'#7d9cb9'});
        txt(x+8,120,'Q'+(index+1)+' · '+item.type,13);
        txt(x+8,142,(item.sku||item.rating||'').slice(0,16),11);
        const poles=W.poleCount(item);
        if(!poles) continue;
        ['top','bottom'].forEach((side,group)=>{
            for(let pole=0;pole<poles;pole++){
                const px=x+width*(group*poles+pole+.5)/(poles*2);
                ends.set(W.key({device:item.connectionId,side,pole}),px);
                node('circle',{cx:px,cy:164,r:2.5,fill:'#185382'});
                txt(px-5,183,(group?'Д':'Г')+(pole+1),8);
            }
        });
    }
    connections.forEach((connection,index)=>{
        const from=ends.get(W.key(connection.from)),to=ends.get(W.key(connection.to)),y=210+index*13;
        wireShape('path',{d:`M ${from} 188 V ${y} H ${to} V 188`},connection,2);
    });
    if (!connections.length) txt(44,220,'Няма начертани връзки. Добави ги в монтажния изглед.',13);
    $('bom').textContent=items.map(it=>[it.sku,it.name,it.rating].filter(Boolean).join(' · ')).join(' | ');
    $('summary').textContent='Апарати: '+items.length+' · връзки: '+connections.length;
}
redraw=function(){
    for (const item of marked) if (!items.includes(item)) marked.delete(item);
    topAlign.disabled=leftAlign.disabled=marked.size<2||view!=='front';
    clearGroup.disabled=marked.size===0;
    const ids=new Set(items.map(it=>it.connectionId).filter(Boolean));
    connections=connections.filter(link=>ids.has(link.from.device)&&ids.has(link.to.device));
    if (wireStart && !ids.has(wireStart.device)) {wireStart=null;wireBends=[];}
    if (view==='schematic') {renderConnectionsSchematic();renderWireList();return;}
    boardRender();
    barsRender();
    if (view==='front') drawWires(terminalEntries());
    renderWireList();
    let state=$('quoteState');
    if (!state) {state=document.createElement('script');state.type='application/json';state.id='quoteState';document.body.append(state);}
    state.textContent=JSON.stringify(bars);
    window.dispatchEvent(new Event('pdg-cad-change'));
};
setView=function(v){stopWire();marking=false;groupButton.setAttribute('aria-pressed','false');view=v;draft=null;editing=false;moving=null;for(const [id,value] of [['frontView','front'],['singleLine','schematic'],['sideView','side'],['threeView','3d']])$(id).classList.toggle('primary',v===value);redraw();status(v==='front'?'Монтажен изглед.':'Изглед за преглед. За редакция избери монтажния изглед.')};
showSelection=function(){if(active<0||!bars[active]){oldSelection();return}const b=bars[active],el=$('selection');el.replaceChildren();const title=document.createElement('b');title.textContent='Шина '+(active+1)+' · '+Math.round(C.length(b))+' mm';el.append(title);for(const [key,label,min,max]of [['width','Ширина (mm)',2,100],['thickness','Дебелина (mm)',1,20]])field(el,label,'number',b[key],v=>{const n=Number(v);if(n>=min&&n<=max){b[key]=n;redraw()}else showSelection()},{min,max});field(el,'Цвят','color',b.color,v=>{b.color=v;redraw()});const sel=document.createElement('select');b.points.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Точка '+(i+1);sel.append(o)});vertex=Math.max(0,Math.min(vertex,b.points.length-1));sel.value=vertex;sel.onchange=()=>{vertex=Number(sel.value);showSelection();redraw()};el.append(sel);for(const key of ['x','y','z'])field(el,key.toUpperCase()+' (mm)','number',b.points[vertex][key],v=>{const n=Number(v),max=key==='z'?Math.min(300,cabinet.depthMm):key==='x'?usableW():usableH();if(n>=0&&n<=max){b.points[vertex][key]=n;redraw();showSelection()}else showSelection()},{min:0,max:key==='z'?Math.min(300,cabinet.depthMm):key==='x'?usableW():usableH()});
field(el,'Диаметър на отвор (mm)','number',b.holes.find(h=>h.index===vertex)?.diameter||8,()=>{}, {id:'holeDiameter',min:2,max:30});button(el,'Добави / промени отвор в точката',()=>{const diameter=Number($('holeDiameter').value);if(diameter<2||diameter>30)return status('Диаметърът трябва да е 2–30 mm.');b.holes=b.holes.filter(h=>h.index!==vertex).concat({index:vertex,diameter});redraw()});button(el,'Добави болтово съединение',()=>{const diameter=Number($('holeDiameter').value);if(diameter>=2&&diameter<=30){b.holes=b.holes.filter(h=>h.index!==vertex).concat({index:vertex,diameter,bolt:true});redraw()}});button(el,'Премахни отвор',()=>{b.holes=b.holes.filter(h=>h.index!==vertex);redraw()});button(el,'Изтрий шина',()=>{bars.splice(active,1);active=-1;redraw();showSelection()});};
$('drawing').addEventListener('click',e=>{if(suppressClick||editing){suppressClick=false;e.stopImmediatePropagation();e.preventDefault()}},true);
$('drawing').addEventListener('pointerdown',e=>{if(view!=='front')return;if(!editing&&mode==='din'&&e.target.closest('g')&&!e.target.closest('[data-busbar]'))active=-1;if(editing){e.preventDefault();e.stopImmediatePropagation();suppressClick=true;append(pfrom(e));return}},true);
$('drawing').addEventListener('pointerup',e=>{if(moving){suppressClick=true;e.stopImmediatePropagation();const p=pfrom(e);if(moving.kind==='vertex'){p.z=bars[moving.i].points[moving.j].z;if(p.x<=usableW()&&p.y<=usableH())bars[moving.i].points[moving.j]=p;}else if(moving.kind==='group'){arrangeGroup('move',p.x-moving.start.x,p.y-moving.start.y);}else{const it=items[moving.i];if(mode==='din'){const r=it.row+Math.round((p.y-moving.start.y)/pitch()),c=it.col+Math.round((p.x-moving.start.x)/18);if(fits(r,c,it.width,moving.i)){it.row=r;it.col=c;delete it.x;delete it.y}}else{const x=Math.max(0,Math.min(usableW()-widthOf(it),moving.pos.x+p.x-moving.start.x)),y=Math.max(0,Math.min(usableH()-heightOf(it),moving.pos.y+p.y-moving.start.y));if(!items.some((other,i)=>{const q=position(other);return i!==moving.i&&x<q.x+widthOf(other)&&x+widthOf(it)>q.x&&y<q.y+heightOf(other)&&y+heightOf(it)>q.y})){it.x=x;it.y=y}}}moving=null;redraw();showSelection()}},true);
$('drawing').addEventListener('pointercancel',()=>{moving=null});
// Ignore painted grid dots and cabinet backgrounds when placing free-mounted devices.
$('drawing').addEventListener('click',e=>{if(suppressClick){suppressClick=false;return}if(view!=='front'||editing||!placing||e.target.closest('[data-device],[data-busbar]'))return;const p=pfrom(e);if(mode==='free')placeFree(p);else place(Math.floor(p.y/pitch()),Math.floor((p.x-inset())/18))});
function placeFree(p){const d=selectedCatalog?['Каталожен артикул',selectedCatalog.modules,selectedCatalog.rating]:types[tool];const ww=selectedCatalog?.widthMm||d[1]*18,hh=selectedCatalog?.heightMm||83;if(p.x+ww>usableW()||p.y+hh>usableH()||selectedCatalog?.depthMm>cabinet.depthMm)return status('Апаратът е извън монтажната плоча.');if(items.some(it=>{const q=position(it);return p.x<q.x+widthOf(it)&&p.x+ww>q.x&&p.y<q.y+heightOf(it)&&p.y+hh>q.y}))return status('Позицията е заета.');items.push({type:selectedCatalog?'CAT':tool,width:d[1],row:0,col:0,x:p.x,y:p.y,name:selectedCatalog?.name||d[0],rating:d[2],sku:selectedCatalog?.sku||'',manufacturer:selectedCatalog?.manufacturer||'',unitPrice:selectedCatalog?.unitPrice??null,...deviceMeta(selectedCatalog)});selected=items.length-1;active=-1;redraw();showSelection()}
place=function(r,c){if(selectedCatalog?.depthMm>cabinet.depthMm||selectedCatalog?.heightMm>pitch())return status('Апаратът не се побира в избраното табло.');active=-1;const n=items.length;oldPlace(r,c);if(items.length>n){Object.assign(items.at(-1),deviceMeta(selectedCatalog));redraw()}};
const previousDemo=$('demo').onclick;$('demo').onclick=()=>{stopWire();connections=[];bars=[];draft=null;active=-1;mode='din';$('boardMode').value=mode;view='front';previousDemo();setView('front')};
function data(){return {version:2,project:$('project').value,rows,modules,items,mode,cabinet,busbars:bars,connections,quote:window.PDGQuote?.settings()}}
function download(name,obj){const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('save').onclick=()=>{try{C.validate(data());download('pdg-electric-cad.json',data())}catch(err){status('Неуспешен запис: '+err.message)}};
$('load').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const d=C.validate(JSON.parse(await f.text()));rows=d.rows;modules=d.modules;items=d.items;bars=d.busbars;connections=d.connections||[];mode=d.mode;cabinet=d.cabinet||{sku:'',widthMm:600,heightMm:800,depthMm:260};window.PDGQuote?.load(d.quote);$('boardMode').value=mode;$('project').value=String(d.project||'Електрическо табло');$('rows').value=rows;$('modules').value=modules;active=-1;selected=-1;setView('front');showSelection();status('Проектът е отворен успешно.')}catch(err){status('Грешка при отваряне: '+err.message)}finally{e.target.value=''}};
const previousBoard=$('newBoard').onclick;$('newBoard').onclick=()=>{if(mode==='din'&&Number($('modules').value)*18>usableW())return status('Избери по-широк корпус.');previousBoard()};
$('autoArrange').onclick=()=>{if(bars.length)return status('Автоматичното подреждане е блокирано при начертани шини. Премести апаратите и точките заедно ръчно.');let r=0,c=0;const arranged=[];for(const source of items){if(c+source.width>modules){r++;c=0}if(r>=rows)return status('Недостатъчно място — проектът е запазен без промени.');const it={...source,row:r,col:c};delete it.x;delete it.y;arranged.push(it);c+=source.width}items=arranged;selected=-1;active=-1;redraw();showSelection();status('Апаратите са подредени по DIN редове.');};
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='Escape'){stopWire();cancel();}if(e.key==='Enter'&&editing)finish()});
document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{stopWire();placing=true;redraw()}));window.PDGCad={arm(value=true){stopWire();placing=value;redraw()},project:data,cabinet:()=>({...cabinet}),chooseCabinet(p){if(!p||p.widthMm<200||p.heightMm<200||p.depthMm<50)return false;const nr=Number(p.specifications?.['Редове'])||rows,nm=Number(p.specifications?.['Брой модули на ред'])||modules,w=p.widthMm-Math.min(96,p.widthMm*.16),h=p.heightMm-125;if(mode==='din'&&(nm*18>w||items.some(it=>it.row>=nr||it.col+it.width>nm||heightOf(it)>Math.max(95,(p.heightMm-180)/nr)))||items.some(it=>{const pos=position(it);return it.depthMm>p.depthMm||(mode==='free'&&(pos.x+widthOf(it)>w||pos.y+heightOf(it)>h))})||bars.some(b=>b.points.some(q=>q.x>w||q.y>h||q.z>p.depthMm)))return status('Елементите не се побират в този корпус.'),false;cabinet={sku:p.sku,widthMm:p.widthMm,heightMm:p.heightMm,depthMm:p.depthMm};if(mode==='din'&&[12,18,24,36].includes(nm)&&nr>=1&&nr<=8){rows=nr;modules=nm;$('rows').value=rows;$('modules').value=modules}redraw();status('Избран корпус '+p.sku);return true}};$('drawing').setAttribute('tabindex','0');document.title='PDG Electric CAD | PDG Systems';document.querySelector('header b').textContent='PDG Electric CAD';redraw();
})();

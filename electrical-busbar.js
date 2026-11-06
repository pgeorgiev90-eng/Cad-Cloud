/* PDG Electric CAD: millimetre geometry; legacy DIN projects remain readable. */
(()=>{
'use strict';
const C=PDGBusbar, W=PDGConnections, oldSelection=showSelection,oldPlace=place;
let connections=[],dinRails=[], wiring=false, wireStart=null, wireBends=[];
let channelY, branchDraft, branching=false, selectedWire=null, zoom=1;
const marked=new Set();
const undoStack=[],redoStack=[];
let lastSnapshot,restoring=false;
let marking=false;
let mode='din',bars=[],active=-1,vertex=-1,draft=null,editing=false,moving=null,moduleTemplate=null,suppressClick=false,placing=false,cabinet={sku:'',widthMm:600,heightMm:800,depthMm:260};
const scale=1;
const geometry=()=>C.layout(cabinet,rows,modules);
const pitch=()=>geometry().pitch,usableW=()=>geometry().width,usableH=()=>geometry().height,inset=()=>geometry().inset;
const {widthOf,heightOf}=C;
const deviceMeta=p=>p?{widthMm:p.widthMm,heightMm:p.heightMm,depthMm:p.depthMm,imageUrl:p.imageUrl,sourceUrl:p.sourceUrl,poles:p.poles,catalogType:p.type}:{};
const status=t=>$('status').textContent=t;
const position=it=>C.position(it,mode,geometry());
function terminalEntries() {
    return items.flatMap((item,index) => ['top','bottom'].flatMap(side =>
        Array.from({length:W.poleCount(item)},(_,pole) => {
            const end = {device:item.connectionId,side,pole};
            return {end,index,...W.terminalPosition(item,end,position(item),widthOf(item),heightOf(item))};
        })));
}
const deviceTargets=()=>terminalEntries().map(({x,y})=>({x,y}));
const targets=()=>deviceTargets().concat(bars.flatMap(b=>b.points));
function drawingPoint(event){
 const matrix=$('drawing').getScreenCTM();
 const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
 return {x:(point.x-50)/scale,y:(point.y-120)/scale,z:Number($('barDepth').value)};
}
const canFeedByBar=entry=>items[entry.index].catalogType==='MCCB';
function nearbyTerminal(event, eligible=()=>true){
 const matrix=$('drawing').getScreenCTM();
 let closest, distance=11;
 for(const terminal of terminalEntries().filter(eligible)){
  const p=C.project({...terminal,z:0},'front');
  const screen=new DOMPoint(p.x,p.y).matrixTransform(matrix);
  const d=Math.hypot(screen.x-event.clientX,screen.y-event.clientY);
  if(d<distance){closest=terminal;distance=d;}
 }
 return closest;
}
function routePoint(event, origin){
 const raw=drawingPoint(event);
 const round=n=>guideGrid.checked?Math.round(n/5)*5:n;
 const p={...raw,x:round(raw.x),y:round(raw.y)};
 if(origin&&guideOrtho.checked){
  if(Math.abs(raw.x-origin.x)>=Math.abs(raw.y-origin.y))p.y=origin.y;
  else p.x=origin.x;
 }
 return p;
}
function pfrom(event){
 const point=drawingPoint(event);
 if(!editing)return C.snap(point,targets());
 const barTargets=terminalEntries().filter(canFeedByBar);
 return C.snap(point,[...barTargets,...bars.flatMap(b=>b.points)]);
}
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
button(settings,'Постави запазен модул',()=>{stopWire();if(!moduleTemplate)return status('Няма запазен модул.');setView('front');placing=false;editing='module';status('Щракни за начало на запазения модул.');},'placeBusbarModule');
try{const t=JSON.parse(localStorage.getItem('pdg_busbar_module_v1')||'null');if(t){C.validate({rows,modules,items:[],busbars:[t]});moduleTemplate=t}}catch{}
const toolbar=document.querySelector('.toolbar');
const undoButton=button(toolbar,'↶ Отмени',()=>changeHistory(undoStack,redoStack,'Операцията е отменена.'),'cadUndo');
const redoButton=button(toolbar,'↷ Повтори',()=>changeHistory(redoStack,undoStack,'Операцията е повторена.'),'cadRedo');
button(toolbar,'− Намали',()=>setZoom(zoom/1.25),'cadZoomOut');
const zoomReset=button(toolbar,'Зуум 100%',()=>setZoom(1),'cadZoomReset');
button(toolbar,'+ Увеличи',()=>setZoom(zoom*1.25),'cadZoomIn');
function resizeDrawing(){
 const svg=$('drawing');
 svg.style.width='';svg.style.height='';svg.style.maxWidth='';svg.style.maxHeight='';svg.style.minWidth='';
 if(zoom===1)return;
 const {width,height}=svg.getBoundingClientRect();
 svg.style.maxWidth='none';svg.style.maxHeight='none';svg.style.minWidth='0';
 svg.style.width=width*zoom+'px';svg.style.height=height*zoom+'px';
}
function setZoom(value){
 zoom=Math.max(.5,Math.min(3,value));
 zoomReset.textContent='Зуум '+Math.round(zoom*100)+'%';
 resizeDrawing();
}
$('drawing').closest('.canvas').addEventListener('wheel',event=>{
 if(!event.ctrlKey&&!event.metaKey)return;
 event.preventDefault();setZoom(zoom*(event.deltaY<0?1.25:1/1.25));
},{passive:false});
button(toolbar,'Страничен изглед',()=>setView('side'),'sideView');button(toolbar,'3D изглед',()=>setView('3d'),'threeView');
$('boardMode').onchange=()=>{
 const next=$('boardMode').value;
 if(next===mode)return;
 try{
  if(next==='din'&&items.some(item=>item.x!==undefined)){
   throw Error('Свободно поставените апарати трябва първо да бъдат преместени в отделен DIN проект.');
  }
  C.validate({...data(),mode:next});
  mode=next;cancel();
 }catch(err){$('boardMode').value=mode;status(err.message);}
};
function finish(){if(draft?.points.length>=2){bars.push(draft);active=bars.length-1;vertex=0;draft=null;editing=false;showSelection();status('Шината е добавена. Избери точка за размери и отвор.')}else status('Необходими са поне две различни точки.');redraw()}
function cancel(){stopWire();draft=null;editing=false;moving=null;redraw();status('Готов за работа.')}
function params(){const phase=newBarPhase.value||undefined;const b={id:crypto.randomUUID(),phase,width:Number($('barWidth').value),thickness:Number($('barThickness').value),color:phase?W.phases[phase].color:$('barColor').value,points:[{x:0,y:0,z:Number($('barDepth').value)},{x:5,y:0,z:Number($('barDepth').value)}],holes:[]};C.validate({rows,modules,items:[],busbars:[b]});return b}
function append(p){try{if(p.x>usableW()||p.y>usableH()||p.z>Math.min(300,cabinet.depthMm))throw Error('Точката е извън монтажната плоча или дълбочината на корпуса.');if(editing==='module'){const b=JSON.parse(JSON.stringify(moduleTemplate)),origin=b.points[0];b.id=crypto.randomUUID();b.points=b.points.map(q=>({x:q.x-origin.x+p.x,y:q.y-origin.y+p.y,z:q.z-origin.z+p.z}));C.validate({rows,modules,items:[],busbars:[b]});if(b.points.some(q=>q.x>usableW()||q.y>usableH()||q.z>cabinet.depthMm))throw Error('Модулът не се побира на тази позиция.');bars.push(b);active=bars.length-1;editing=false;showSelection()}else if(!draft){draft=params();draft.points=[p]}else if(C.length({points:[draft.points.at(-1),p]})>.01)draft.points.push(p);redraw()}catch(err){status(err.message)}}
function barsRender(){const svg=$('drawing');bars.concat(draft?[draft]:[]).forEach((b,i)=>{const points=b.points.map(p=>C.project(p,view)),g=node('g',{'data-busbar':i,'aria-label':'Тоководеща шина '+(i+1)});const path=node('polyline',{points:points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:W.phases[b.phase]?.color||b.color,'stroke-width':view==='side'?b.thickness*2:b.width*(view==='front'?scale:1.25),'stroke-linejoin':'round',opacity:i===active?1:.84,style:'cursor:pointer'},g);if(W.phases[b.phase]?.stripe)node('polyline',{points:path.getAttribute('points'),fill:'none',stroke:W.phases[b.phase].stripe,'stroke-width':path.getAttribute('stroke-width'),'stroke-dasharray':'10 10','pointer-events':'none'},g);path.addEventListener('pointerdown',e=>{if(editing)return;e.stopPropagation();active=i;selected=-1;selectedWire=null;vertex=0;showSelection();redraw()});b.holes.forEach(h=>{const p=points[h.index];if(h.bolt){node('path',{d:`M ${p.x-5} ${p.y} h 10 M ${p.x} ${p.y-5} v 10`,stroke:'#1c3040','stroke-width':3},g)}node('circle',{cx:p.x,cy:p.y,r:h.diameter*(view==='front'?scale:1.25)/2,fill:h.bolt?'#9aaab5':'#fff',stroke:'#34495e','stroke-width':1},g)});if(i===active||b===draft)points.forEach((p,j)=>{const h=node('circle',{cx:p.x,cy:p.y,r:j===vertex?6:4,fill:'#fff',stroke:'#0b5292','stroke-width':2,style:'cursor:move','data-vertex':j},g);h.addEventListener('pointerdown',e=>{if(view!=='front'||editing)return;e.stopPropagation();vertex=j;moving={kind:'vertex',i,j};svg.setPointerCapture(e.pointerId);showSelection()})})})}
function boardRender(){
 const svg=$('drawing');svg.replaceChildren();const front=view==='front',w=front?cabinet.widthMm+45:Math.max(660,cabinet.widthMm*1.25+300),h=front?cabinet.heightMm+95:Math.max(850,cabinet.heightMm*1.5+180);svg.setAttribute('width',w);svg.setAttribute('height',h);svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const defs=node('defs');for(const [id,stops]of [['cad-metal',['#6c767b','#f9fafb','#a4afb6','#e4e9ed','#68747b']],['cad-device',['#d0d4d7','#fff','#e5e8ea']],['cad-blue',['#537aab','#113b75','#305f98']]]){const grad=node('linearGradient',{id,x1:'0%',y1:'0%',x2:'0%',y2:'100%'},defs);stops.forEach((color,i)=>node('stop',{offset:(i/(stops.length-1)*100)+'%','stop-color':color},grad))}
 if(front){node('image',{href:'assets/electric-cabinet-render.webp',x:30,y:59,width:cabinet.widthMm,height:cabinet.heightMm,preserveAspectRatio:'none','pointer-events':'none'});const bx=42,ex=30+cabinet.widthMm-12,ey=59+cabinet.heightMm-16;node('path',{d:`M ${bx} 47 H ${ex} M ${bx} 38 V 57 M ${ex} 38 V 57 M 22 73 V ${ey} M 15 73 H 29 M 15 ${ey} H 29`,stroke:'#17253d','stroke-width':1,fill:'none'});txt((bx+ex)/2-27,35,cabinet.widthMm+' mm',15,'#111b2f');const t=txt(13,(73+ey)/2+35,cabinet.heightMm+' mm',15,'#111b2f');t.setAttribute('transform',`rotate(-90 13 ${(73+ey)/2+35})`);if(mode==='din')for(let r=0;r<rows;r++){const y=120+r*pitch(),x=46+inset(),rw=modules*18+8;node('rect',{x,y:y+24,width:rw,height:35,fill:'url(#cad-metal)',stroke:'#616d76','stroke-width':1});for(let i=x+7;i<x+rw-13;i+=23)node('rect',{x:i,y:y+38,width:13,height:6,rx:3,fill:'#606c74'});if(r>0){node('rect',{x:x-7,y:y-35,width:rw+14,height:18,fill:'#dae4ee','fill-opacity':.62,stroke:'#758087','data-wire-channel':r*pitch()-26});for(let i=x-2;i<x+rw;i+=10)node('rect',{x:i,y:y-32,width:5,height:12,fill:'#4c5459','pointer-events':'none'})}}}
 else{txt(30,45,view==='side'?'Страничен изглед · отстояния от монтажната плоча':'Аксонометричен изглед',22);node('rect',{x:30,y:65,width:w-60,height:h-100,fill:'#f2f6fc',stroke:'#9aaabe'})}
 if(front&&mode==='free')for(const rail of dinRails){
  const p=C.project({...rail,z:0},view);
  node('rect',{x:p.x,y:p.y,width:rail.width,height:12,fill:'url(#cad-metal)',stroke:'#616d76','data-din-rail':''});
 }
 items.forEach((it,i)=>{const pos=position(it),p=C.project({...pos,z:front?0:Math.min(25,cabinet.depthMm)},view),g=node('g',{'data-device':i,style:'cursor:grab'});const ww=view==='side'?(it.depthMm||70)*2:widthOf(it)*(view==='3d'?1.25:1),hh=heightOf(it)*(view==='side'?1.5:view==='3d'?1.1:1);PDGDeviceFace.draw(node,g,it,p.x,p.y,ww,hh,Math.max(1,W.poleCount(it)));if(i===selected||marked.has(it)){node('rect',{x:p.x-2,y:p.y-2,width:ww+4,height:hh+4,fill:'none',stroke:'#064bff','stroke-width':2},g);for(const x of [p.x-2,p.x+ww+2])for(const y of [p.y-2,p.y+hh+2])node('rect',{x:x-2,y:y-2,width:4,height:4,fill:'#fff',stroke:'#064bff'},g)}g.addEventListener('pointerdown',e=>{if(editing||wiring||!front)return;e.stopPropagation();selected=i;selectedWire=null;active=-1;moving={kind:marked.size>1&&marked.has(it)?'group':'device',i,start:pfrom(e),pos};svg.setPointerCapture(e.pointerId);showSelection()})});
 $('bom').textContent=items.map(it=>(it.sku?it.sku+' · ':'')+it.name+' '+it.rating).join(' | ');$('summary').textContent=`Апарати: ${items.length} · шини: ${bars.length} · дължина: ${Math.round(bars.reduce((s,b)=>s+C.length(b),0))} mm`;
}
function terminalName(end) {
    if(end.bar){const index=bars.findIndex(b=>b.id===end.bar);return 'Шина '+(index+1)+' · '+bars[index]?.phase;}
    const index = items.findIndex(item => item.connectionId === end.device);
    return (items[index]?.designation||'Q'+(index+1)) + ' · ' + (end.side==='top'?'горна ':'долна ') + (end.pole+1);
}
function stopWire() {
    wiring=false; wireStart=null; wireBends=[];channelY=undefined;branchDraft=null;branching=false;
    $('drawConnection').setAttribute('aria-pressed','false');
}
function connect(entry) {
    const end={...entry.end};
    if(!end.bar){
        const item=items[entry.index];
        item.connectionId ||= crypto.randomUUID();
        end.device=item.connectionId;
    }
    const bar=bars.find(b=>b.id&&(b.id===end.bar||b.id===wireStart?.bar));
    if(bar)phaseSelect.value=bar.phase;
    if (!wireStart) {
        wireStart=end;
        status('Избрана ' + terminalName(end) + '. Посочи клема, шина или щракни за чупка.');
    } else {
        const connection={from:wireStart,to:end,bends:wireBends,phase:phaseSelect.value};
        if(channelY!==undefined)Object.assign(connection,{id:crypto.randomUUID(),channelY});
        if(branchDraft)Object.assign(connection,branchDraft);
        if(channelY===undefined&&!guideOrtho.checked)connection.freeAngle=true;
        try {
            W.validate(items,[...connections,connection],bars);
            connections.push(connection);
            wireStart=null;wireBends=[];channelY=undefined;branchDraft=null;branching=false;
            status('Връзката е записана. Можеш да започнеш следваща.');
        } catch (error) { status(error.message); }
    }
    redraw();
}
const wireButton=button(toolbar,'Чертай проводник',()=>{
    if (wiring) {stopWire();redraw();status('Чертането на връзка е изключено.');return;}
    setView('front'); placing=false; wiring=true;
    wireButton.setAttribute('aria-pressed','true');
    status('Избери начална клема, щракни в канала и избери крайна клема. Можеш и да чертаеш с ръчни чупки.');
    redraw();
},'drawConnection');
wireButton.setAttribute('aria-pressed','false');
button(toolbar,'Добави отклонение',()=>{
    setView('front');placing=false;wiring=true;branching=true;
    wireButton.setAttribute('aria-pressed','true');
    status('Щракни върху хоризонтален проводник в канала, после избери крайна клема.');
    redraw();
},'addWireBranch');
function barPhaseControl(parent, value, change){
 const label=document.createElement('label');
 label.textContent='Проводник на шината';
 const select=document.createElement('select');
 select.setAttribute('aria-label',label.textContent);
 select.append(new Option('Без означение',''));
 for(const [key,phase] of Object.entries(W.phases))select.append(new Option(phase.label,key));
 select.value=value||'';
 select.onchange=()=>change(select.value||undefined,select);
 label.append(select);parent.append(label);
 return select;
}
const newBarPhase=barPhaseControl(settings,'',phase=>{if(phase)$('barColor').value=W.phases[phase].color;});
function editBarPhase(bar,phase,select){
 const previous=bar.phase;
 bar.phase=phase;
 try{
  W.validate(items,connections,bars);
  if(phase){bar.id||=crypto.randomUUID();bar.color=W.phases[phase].color;}
  redraw();
 }catch(error){bar.phase=previous;select.value=previous||'';status(error.message);}
}
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
let expandedBends=-1;
function renderWireList() {
    wireSummary.textContent='Връзки между клеми (' + connections.length + ')';
    wireRows.replaceChildren();
    connections.forEach((connection,index)=>{
        const row=document.createElement('div');
        row.textContent=terminalName(connection.from) + ' → ' + terminalName(connection.to) + ' ';
        const conductor=phaseSelect.cloneNode(true);
        conductor.setAttribute('aria-label','Проводник на '+terminalName(connection.from)+' към '+terminalName(connection.to));
        if (!connection.phase) {
            const option=document.createElement('option');option.value='';option.textContent='Без означение';conductor.prepend(option);
        }
        conductor.value=connection.phase||'';
        conductor.onchange=()=>{
            const phase=conductor.value||undefined;
            const updated={...connection,phase};
            try {
                W.validate(items,connections.map((link,i)=>i===index?updated:link),bars);
                connections[index]=updated;
                redraw();
            } catch(error) {
                conductor.value=connection.phase||'';
                status(error.message);
            }
        };
        const bends=document.createElement('details');
        const summary=document.createElement('summary');
        summary.textContent='Чупки на проводника';
        bends.append(summary);
        const edit=(points)=>{
            connections[index]={...connections[index],bends:points};
            redraw();
        };
        const populate=()=>{
            if(bends.children.length>1)return;
            for(const [i,point] of connection.bends.entries()){
                const line=document.createElement('div');
                const number=document.createElement('strong');
                number.textContent='Точка '+(i+1);
                line.append(number);
                for(const [coordinate,max] of [['x',usableW()],['y',usableH()]]){
                    field(line,coordinate.toUpperCase()+' (mm)','number',point[coordinate],value=>{
                        const n=Number(value);
                        if(value.trim()===''||!Number.isFinite(n)||n<0||n>max){
                            status('Чупката трябва да е в монтажната плоча.');return;
                        }
                        edit(connection.bends.map((p,j)=>i===j?{...p,[coordinate]:n}:p));
                    },{min:0,max,step:'any'});
                }
                button(line,'Премахни точка',()=>edit(connection.bends.filter((_,j)=>i!==j)));
                bends.append(line);
            }
            if(connection.bends.length)button(bends,'Върни автоматичното трасе',()=>edit([]));
        };
        bends.open=index===expandedBends;
        if(bends.open)populate();
        bends.ontoggle=()=>{
            if(!bends.isConnected)return;
            if(bends.open){expandedBends=index;populate();}
            else if(expandedBends===index)expandedBends=-1;
        };
        row.append(conductor,bends);
        button(row,'Изтрий',()=>{connections.splice(index,1);expandedBends=-1;redraw();status('Връзката е премахната.');});
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
function wireRoute(start,end,bends,freeAngle){
    return freeAngle?[start,...bends,end]:W.route(start,end,bends);
}
function channelLane(wire){
    return wire.channelY+(['L1','L2','L3','N','PE'].indexOf(wire.phase)-2)*2.8;
}
function drawWires(entries) {
    const points=new Map(entries.filter(p=>p.end.device).map(p=>[W.key(p.end),p]));
    const resolve=end=>end.bar?W.tapPosition(bars.find(b=>b.id===end.bar),end):points.get(W.key(end));
    for (const [index,connection] of connections.entries()) {
        let start=resolve(connection.from);
        const end=resolve(connection.to);
        if(!start||!end)continue;
        if(connection.branchOf){
            const parent=connections.find(w=>w.id===connection.branchOf),target=resolve(parent.to);
            if(!target)continue;
            start={x:start.x+(target.x-start.x)*connection.branchFraction,y:channelLane(parent)};
            const tap=C.project({...start,z:0},view);
            node('circle',{cx:tap.x,cy:tap.y,r:4,fill:W.phases[connection.phase].color,stroke:'#263447','pointer-events':'none','data-wire-junction':''});
        }
        const lane=channelLane(connection);
        const bends=connection.channelY===undefined?connection.bends:[{x:start.x,y:lane},{x:end.x,y:lane}];
        const route=wireRoute(start,end,bends,connection.channelY===undefined&&connection.freeAngle).map(p=>C.project({...p,z:0},view));
        const attrs={points:route.map(p=>p.x+','+p.y).join(' ')};
        if(!wiring&&selectedWire===connection)node('polyline',{...attrs,fill:'none',stroke:'#2874ee','stroke-width':8,'pointer-events':'none'});
        wireShape('polyline',attrs,connection,3);
        const hit=node('polyline',{...attrs,fill:'none',stroke:'transparent','stroke-width':10,
            'pointer-events':!wiring||branching?'stroke':'none','data-wire-index':index,style:'cursor:pointer'});
        hit.addEventListener('pointerdown',event=>{
            if(wiring||editing||placing||marking)return;
            event.stopPropagation();selectedWire=connection;selected=-1;active=-1;marked.clear();
            const point=drawingPoint(event);
            if(!connection.branchOf&&connection.channelY!==undefined&&Math.abs(point.y-lane)<=7&&
                point.x>=Math.min(start.x,end.x)&&point.x<=Math.max(start.x,end.x)){
                moving={kind:'channel',index,start:point};
                $('drawing').setPointerCapture(event.pointerId);
                return;
            }
            redraw();showSelection();
            status('Избран проводник. Delete го изтрива.');
        });
        hit.addEventListener('click',event=>event.stopPropagation());
        if(connection.from.bar||connection.to.bar){
            const tap=C.project({...(connection.from.bar?start:end),z:0},view);
            node('circle',{cx:tap.x,cy:tap.y,r:4,fill:W.phases[connection.phase]?.color||'#087dc2',stroke:'#263447','pointer-events':'none','data-busbar-tap':''});
        }
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
        title.textContent=(items[entry.index]?.designation||'Q'+(entry.index+1))+' · '+(entry.end.side==='top'?'горна ':'долна ')+(entry.end.pole+1);
        terminal.setAttribute('aria-label',title.textContent);
        terminal.addEventListener('keydown',event=>{
            if (event.key!=='Enter' && event.key!==' ') return;
            event.preventDefault();event.stopPropagation();connect(entry);
        });
    }
    if(wireStart?.bar){
        const tap=W.tapPosition(bars.find(b=>b.id===wireStart.bar),wireStart);
        if(tap){
            const p=C.project({...tap,z:0},view);
            node('circle',{cx:p.x,cy:p.y,r:5,fill:'#f4b635',stroke:'#263447','pointer-events':'none'});
        }
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
    if(branching&&!wireStart){
        const hit=event.target.closest('[data-wire-index]');
        const wire=hit&&connections[Number(hit.getAttribute('data-wire-index'))];
        if(!wire?.id||wire.branchOf||wire.channelY===undefined)return;
        const entries=terminalEntries();
        const resolve=end=>end.bar?W.tapPosition(bars.find(b=>b.id===end.bar),end):entries.find(p=>W.key(p.end)===W.key(end));
        const from=resolve(wire.from),to=resolve(wire.to),point=drawingPoint(event);
        if(!from||!to||Math.abs(to.x-from.x)<1||Math.abs(point.y-channelLane(wire))>7){
            status('Избери хоризонталния участък на проводника в канала.');return;
        }
        wireStart=wire.from;channelY=wire.channelY;phaseSelect.value=wire.phase;
        branchDraft={branchOf:wire.id,branchFraction:Math.max(0,Math.min(1,(point.x-from.x)/(to.x-from.x)))};
        branching=false;
        status('Избери крайната клема на отклонението.');
        redraw();return;
    }
    const target=event.target.closest('[data-terminal]');
    if (target) {
        const [index,side,pole]=target.getAttribute('data-terminal').split(':');
        const entry=terminalEntries().find(t=>t.index===Number(index)&&t.end.side===side&&t.end.pole===Number(pole));
        if (entry) connect(entry);
        return;
    }
    const near=guideTerminals.checked?nearbyTerminal(event):null;
    if(near&&!event.target.closest('[data-busbar]')){connect(near);return;}
    const channel=event.target.closest('[data-wire-channel]');
    if(channel&&wireStart&&!branchDraft){
        channelY=Number(channel.getAttribute('data-wire-channel'));wireBends=[];
        status('Каналът е избран. Щракни върху крайната клема.');
        redraw();return;
    }
    const busbar=event.target.closest('[data-busbar]');
    if(busbar){
        const bar=bars[Number(busbar.getAttribute('data-busbar'))];
        if(!bar?.phase){status('Избери проводник L1, L2, L3, N или PE в свойствата на шината.');return;}
        const end=W.nearestTap(bar,drawingPoint(event));
        if(end)connect({end});
        return;
    }
    if (!wireStart || event.target.closest('[data-device]') || wireBends.length>=24) return;
    const origin=wireBends.at(-1)||wireOrigin();
    const {x,y}=routePoint(event,origin);
    if (x<0 || x>usableW() || y<0 || y>usableH()) return status('Чупката трябва да е в монтажната плоча.');
    if(branchDraft||channelY!==undefined)return;
    wireBends.push({x,y});redraw();
},true);
function guideOption(text){
 const label=document.createElement('label'),input=document.createElement('input');
 input.type='checkbox';input.checked=true;label.append(input,' '+text);toolbar.append(label);
 return input;
}
const guideTerminals=guideOption('Клеми');
const guideGrid=guideOption('Мрежа 5 mm');
const guideOrtho=guideOption('Само 90°');
function wireOrigin(){
 if(!wireStart)return null;
 const locate=end=>end.bar?W.tapPosition(bars.find(b=>b.id===end.bar),end):terminalEntries().find(t=>W.key(t.end)===W.key(end));
 const source=locate(wireStart);
 if(!branchDraft||!source)return source;
 const parent=connections.find(w=>w.id===branchDraft.branchOf);
 const end=parent&&locate(parent.to);
 return end?{x:source.x+(end.x-source.x)*branchDraft.branchFraction,y:channelLane(parent)}:null;
}
const drawing=$('drawing');
const clearGuide=()=>drawing.querySelector('[data-drawing-guide]')?.remove();
drawing.addEventListener('pointerleave',clearGuide);
drawing.addEventListener('pointermove',event=>{
 clearGuide();
 const bar=editing===true;
 if(view!=='front'||moving||(!bar&&!wiring)||branching)return;
 const origin=bar?draft?.points[0]:wireOrigin();
 const bends=bar?draft?.points.slice(1)||[]:wireBends;
 const last=bends.at(-1)||origin;
 const terminal=guideTerminals.checked?nearbyTerminal(event,bar?canFeedByBar:undefined):null;
 const next=terminal||routePoint(event,last);
 if(next.x<0||next.y<0||next.x>usableW()||next.y>usableH())return;
 const group=node('g',{'data-drawing-guide':'','pointer-events':'none','aria-hidden':'true'});
 const project=point=>C.project({...point,z:0},'front');
 const p=project(next);
 const color=bar?(W.phases[newBarPhase.value]?.color||$('barColor').value):(W.phases[phaseSelect.value]?.color||'#087dc2');
 const stroke=(points,attrs)=>node('polyline',{points:points.map(project).map(p=>p.x+','+p.y).join(' '),
    fill:'none','stroke-width':3,stroke:color,'stroke-linecap':'round',...attrs},group);
 if(origin){
  if(bends.length&&!bar)stroke([origin,...bends],{});
  let tentative=[last,next];
  if(!bar&&channelY!==undefined){
   const lane=channelLane({phase:phaseSelect.value,channelY});
   tentative=[origin,{x:origin.x,y:lane},{x:next.x,y:lane},next];
  }else if(!bar&&guideOrtho.checked){
   tentative=wireRoute(origin,next,bends,false);
   if(bends.length){
    const index=tentative.lastIndexOf(last);
    if(index>=0)tentative=tentative.slice(index);
   }
  }
  stroke(tentative,{'stroke-dasharray':'7 5'});
  if(guideOrtho.checked&&channelY===undefined){
   const horizontal=Math.abs(next.y-last.y)<.001;
   const vertical=Math.abs(next.x-last.x)<.001;
   if(horizontal||vertical)stroke(horizontal?[{x:0,y:last.y},{x:usableW(),y:last.y}]:
      [{x:last.x,y:0},{x:last.x,y:usableH()}],{stroke:'#009cb8','stroke-width':1,'stroke-dasharray':'5 5'});
  }
  const start=project(origin), fixed=project(last);
  node('circle',{cx:start.x,cy:start.y,r:4.5,fill:color},group);
  if(bends.length)node('rect',{x:fixed.x-3,y:fixed.y-3,width:6,height:6,fill:color},group);
 }
 node('circle',{cx:p.x,cy:p.y,r:terminal?7:4,stroke:color,fill:'none','stroke-width':2},group);
 node('path',{d:`M ${p.x-10} ${p.y} h20 M ${p.x} ${p.y-10} v20`,stroke:'#17253d','stroke-width':1,fill:'none'},group);
 if(terminal){
  const text=node('text',{x:p.x+10,y:p.y-10,fill:'#17253d','font-size':11,stroke:'#fff','stroke-width':3,'paint-order':'stroke'},group);
  text.textContent=(items[terminal.index]?.designation||'Q'+(terminal.index+1))+' · '+(terminal.end.side==='top'?'горна ':'долна ')+(terminal.end.pole+1);
 }
});
const exportDrawing=$('svgExport').onclick;
$('svgExport').onclick=event=>{clearGuide();return exportDrawing.call($('svgExport'),event);};
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
    const linkedBars=bars.filter(b=>b.id&&connections.some(link=>link.from.bar===b.id||link.to.bar===b.id));
    const barColumns=linkedBars.map(bar=>{const column=x;x+=115;return {bar,column};});
    const width=Math.max(670,x+25),height=Math.max(350,228+connections.length*13);
    svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    node('rect',{x:0,y:0,width,height,fill:'#fff'});
    txt(44,42,'Схема на въведените връзки',23);
    txt(44,69,'Г = горна клема · Д = долна клема. Показват се само въведените връзки.',13);
    const ends=new Map();
    for(const {item,index,x,width} of blocks){
        node('rect',{x,y:99,width,height:64,rx:6,fill:'#edf4fa',stroke:'#7d9cb9'});
        txt(x+8,120,(item.designation||'Q'+(index+1))+' · '+item.type,13);
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
    for(const {bar,column} of barColumns){
        node('rect',{x:column,y:99,width:100,height:64,rx:6,fill:'#edf4fa',stroke:W.phases[bar.phase].color});
        txt(column+8,128,'Шина '+bar.phase,13);
        ends.set(W.key({bar:bar.id}),column+50);
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
    const exists=end=>end.bar?bars.some(b=>b.id===end.bar):ids.has(end.device);
    connections=connections.filter(link=>exists(link.from)&&exists(link.to));
    const wireIds=new Set(connections.map(link=>link.id));
    connections=connections.filter(link=>!link.branchOf||wireIds.has(link.branchOf));
    if(!connections.includes(selectedWire))selectedWire=null;
    if (wireStart && !exists(wireStart)) {wireStart=null;wireBends=[];}
    rememberHistory();
    if (view==='schematic') {renderConnectionsSchematic();resizeDrawing();renderWireList();return;}
    boardRender();
    resizeDrawing();
    barsRender();
    if (view==='front') drawWires(terminalEntries());
    renderWireList();
    let state=$('quoteState');
    if (!state) {state=document.createElement('script');state.type='application/json';state.id='quoteState';document.body.append(state);}
    state.textContent=JSON.stringify(bars);
    window.dispatchEvent(new Event('pdg-cad-change'));
};
setView=function(v){stopWire();marking=false;groupButton.setAttribute('aria-pressed','false');view=v;draft=null;editing=false;moving=null;for(const [id,value] of [['frontView','front'],['singleLine','schematic'],['sideView','side'],['threeView','3d']])$(id).classList.toggle('primary',v===value);redraw();status(v==='front'?'Монтажен изглед.':'Изглед за преглед. За редакция избери монтажния изглед.')};
showSelection=function(){if(active<0||!bars[active]){oldSelection();return}const b=bars[active],el=$('selection');el.replaceChildren();const title=document.createElement('b');title.textContent='Шина '+(active+1)+' · '+Math.round(C.length(b))+' mm';el.append(title);barPhaseControl(el,b.phase,(phase,select)=>editBarPhase(b,phase,select));for(const [key,label,min,max]of [['width','Ширина (mm)',2,100],['thickness','Дебелина (mm)',1,20]])field(el,label,'number',b[key],v=>{const n=Number(v);if(n>=min&&n<=max){b[key]=n;redraw()}else showSelection()},{min,max});field(el,'Цвят','color',b.color,v=>{b.color=v;redraw()});const sel=document.createElement('select');b.points.forEach((p,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Точка '+(i+1);sel.append(o)});vertex=Math.max(0,Math.min(vertex,b.points.length-1));sel.value=vertex;sel.onchange=()=>{vertex=Number(sel.value);showSelection();redraw()};el.append(sel);for(const key of ['x','y','z'])field(el,key.toUpperCase()+' (mm)','number',b.points[vertex][key],v=>{const n=Number(v),max=key==='z'?Math.min(300,cabinet.depthMm):key==='x'?usableW():usableH();if(n>=0&&n<=max){b.points[vertex][key]=n;redraw();showSelection()}else showSelection()},{min:0,max:key==='z'?Math.min(300,cabinet.depthMm):key==='x'?usableW():usableH()});
field(el,'Диаметър на отвор (mm)','number',b.holes.find(h=>h.index===vertex)?.diameter||8,()=>{}, {id:'holeDiameter',min:2,max:30});button(el,'Добави / промени отвор в точката',()=>{const diameter=Number($('holeDiameter').value);if(diameter<2||diameter>30)return status('Диаметърът трябва да е 2–30 mm.');b.holes=b.holes.filter(h=>h.index!==vertex).concat({index:vertex,diameter});redraw()});button(el,'Добави болтово съединение',()=>{const diameter=Number($('holeDiameter').value);if(diameter>=2&&diameter<=30){b.holes=b.holes.filter(h=>h.index!==vertex).concat({index:vertex,diameter,bolt:true});redraw()}});button(el,'Премахни отвор',()=>{b.holes=b.holes.filter(h=>h.index!==vertex);redraw()});button(el,'Изтрий шина',()=>{bars.splice(active,1);active=-1;redraw();showSelection()});};
$('drawing').addEventListener('click',e=>{if(suppressClick||editing){suppressClick=false;e.stopImmediatePropagation();e.preventDefault()}},true);
$('drawing').addEventListener('pointerdown',event=>{
 if(view!=='front')return;
 if(!editing&&mode==='din'&&event.target.closest('g')&&!event.target.closest('[data-busbar]'))active=-1;
 if(!editing)return;
 event.preventDefault();event.stopImmediatePropagation();suppressClick=true;
 if(editing!=='module'){
  const point=drawingPoint(event),hit=event.target.closest('[data-device]');
  const device=hit&&items[Number(hit.getAttribute('data-device'))];
  const nearDin=terminalEntries().some(t=>!canFeedByBar(t)&&Math.hypot(t.x-point.x,t.y-point.y)<7);
  if((device&&device.catalogType!=='MCCB')||nearDin){
   status('За клемите на този апарат използвай „Чертай проводник“.');return;
  }
 }
 const terminal=editing==='module'||!guideTerminals.checked?null:nearbyTerminal(event,canFeedByBar);
 const point=editing==='module'?pfrom(event):terminal?{x:terminal.x,y:terminal.y,z:Number($('barDepth').value)}:
    routePoint(event,draft?.points.at(-1));
 append(point);
},true);
$('drawing').addEventListener('pointerup',e=>{if(moving){suppressClick=true;e.stopImmediatePropagation();const p=pfrom(e);if(moving.kind==='channel'){
 const wire=connections[moving.index],delta=drawingPoint(e).y-moving.start.y;
 const next=Math.max(7,Math.min(usableH()-7,wire.channelY+delta));
 if(Math.abs(delta)>2){
  wire.channelY=next;
  for(const branch of connections.filter(w=>w.branchOf===wire.id))branch.channelY=next;
 }
 status('Избран проводник. Delete го изтрива.');
 }else if(moving.kind==='vertex'){p.z=bars[moving.i].points[moving.j].z;if(p.x<=usableW()&&p.y<=usableH())bars[moving.i].points[moving.j]=p;}else if(moving.kind==='group'){arrangeGroup('move',p.x-moving.start.x,p.y-moving.start.y);}else{const it=items[moving.i];if(mode==='din'){const r=it.row+Math.round((p.y-moving.start.y)/pitch()),c=it.col+Math.round((p.x-moving.start.x)/18);if(fits(r,c,it.width,moving.i)){it.row=r;it.col=c;delete it.x;delete it.y}}else{const x=Math.max(0,Math.min(usableW()-widthOf(it),moving.pos.x+p.x-moving.start.x)),y=Math.max(0,Math.min(usableH()-heightOf(it),moving.pos.y+p.y-moving.start.y));if(!items.some((other,i)=>{const q=position(other);return i!==moving.i&&x<q.x+widthOf(other)&&x+widthOf(it)>q.x&&y<q.y+heightOf(other)&&y+heightOf(it)>q.y})){it.x=x;it.y=y}}}moving=null;redraw();showSelection()}},true);
$('drawing').addEventListener('pointercancel',()=>{moving=null});
// Ignore painted grid dots and cabinet backgrounds when placing free-mounted devices.
$('drawing').addEventListener('click',e=>{if(suppressClick){suppressClick=false;return}if(view!=='front'||editing||!placing||e.target.closest('[data-device],[data-busbar]'))return;const p=pfrom(e);if(mode==='free')placeFree(p);else place(Math.floor(p.y/pitch()),Math.floor((p.x-inset())/18))});
function placeFree(p){const d=selectedCatalog?['Каталожен артикул',selectedCatalog.modules,selectedCatalog.rating]:types[tool];const ww=selectedCatalog?.widthMm||d[1]*18,hh=selectedCatalog?.heightMm||83;if(p.x+ww>usableW()||p.y+hh>usableH()||selectedCatalog?.depthMm>cabinet.depthMm)return status('Апаратът е извън монтажната плоча.');if(items.some(it=>{const q=position(it);return p.x<q.x+widthOf(it)&&p.x+ww>q.x&&p.y<q.y+heightOf(it)&&p.y+hh>q.y}))return status('Позицията е заета.');items.push({type:selectedCatalog?'CAT':tool,width:d[1],row:0,col:0,x:p.x,y:p.y,name:selectedCatalog?.name||d[0],rating:d[2],sku:selectedCatalog?.sku||'',manufacturer:selectedCatalog?.manufacturer||'',unitPrice:selectedCatalog?.unitPrice??null,...deviceMeta(selectedCatalog)});selected=items.length-1;active=-1;redraw();showSelection()}
place=function(r,c){
 if(selectedCatalog?.depthMm>cabinet.depthMm||selectedCatalog?.heightMm>pitch()||
    r*pitch()+heightOf(selectedCatalog||{})>usableH())return status('Апаратът не се побира в избраното табло.');
 active=-1;
 const n=items.length;
 restoring=true;
 try{oldPlace(r,c);}finally{restoring=false;}
 if(items.length>n){Object.assign(items.at(-1),deviceMeta(selectedCatalog));redraw();}
};
const previousDemo=$('demo').onclick;$('demo').onclick=()=>{stopWire();connections=[];bars=[];dinRails=[];draft=null;active=-1;mode='din';$('boardMode').value=mode;view='front';previousDemo();setView('front')};
function data(){return {version:2,project:$('project').value,rows,modules,items,mode,cabinet,busbars:bars,...(dinRails.length?{dinRails}:{}),connections,quote:window.PDGQuote?.settings()}}
function download(name,obj){const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('save').onclick=()=>{try{C.validate(data());download('pdg-electric-cad.json',data())}catch(err){status('Неуспешен запис: '+err.message)}};
function applyProject(d){
 rows=d.rows;modules=d.modules;items=d.items;bars=d.busbars;dinRails=d.dinRails||[];connections=d.connections||[];
 mode=d.mode;cabinet=d.cabinet||{...C.defaultCabinet};
 window.PDGQuote?.load(d.quote);
 $('boardMode').value=mode;$('project').value=String(d.project||'Електрическо табло');
 $('rows').value=rows;$('modules').value=modules;
 active=-1;selected=-1;selectedWire=null;placing=false;suppressClick=false;selectedCatalog=null;marked.clear();
 setView('front');showSelection();
}
function rememberHistory(){
 if(restoring)return;
 const current=JSON.stringify(data());
 if(lastSnapshot!==undefined&&current!==lastSnapshot){
  undoStack.push(lastSnapshot);
  if(undoStack.length>60)undoStack.shift();
  redoStack.length=0;
 }
 lastSnapshot=current;
 undoButton.disabled=!undoStack.length;
 redoButton.disabled=!redoStack.length;
}
function changeHistory(from,to,message){
 if(!from.length)return;
 to.push(lastSnapshot);
 lastSnapshot=from.pop();
 restoring=true;
 try{applyProject(JSON.parse(lastSnapshot));}finally{restoring=false;}
 lastSnapshot=JSON.stringify(data());
 rememberHistory();status(message);
}
$('load').onchange=async e=>{
 try{
  const f=e.target.files[0];if(!f)return;
  applyProject(C.validate(JSON.parse(await f.text())));
  status('Проектът е отворен успешно.');
 }catch(err){status('Грешка при отваряне: '+err.message);}
 finally{e.target.value='';}
};
$('newBoard').onclick=()=>{
 const nextRows=Number($('rows').value),nextModules=Number($('modules').value);
 try{
  C.validate({...data(),rows:nextRows,modules:nextModules});
  rows=nextRows;modules=nextModules;redraw();showSelection();
 }catch(err){
  $('rows').value=rows;$('modules').value=modules;status(err.message);
 }
};
$('autoArrange').onclick=()=>{
 if(dinRails.length)return status('Предложените DIN редове остават на монтажната плоча. Премести апаратите ръчно.');
 if(bars.length||connections.length)return status('Автоматичното подреждане е достъпно преди окабеляване и чертане на шини.');
 let x=0,y=0,rowHeight=0;
 const free=mode==='free';
 const arranged=items.map(item=>{
  const width=free?widthOf(item):item.width;
  const height=free?heightOf(item):1;
  if(x&&x+width>(free?usableW():modules)){x=0;y+=rowHeight;rowHeight=0;}
  const next={...item};
  if(free){next.x=x;next.y=y;}
  else{next.col=x;next.row=y;delete next.x;delete next.y;}
  const gap=free?5:0;
  x+=width+gap;rowHeight=Math.max(rowHeight,height+gap);
  return next;
 });
 try{C.validate({...data(),items:arranged});}
 catch(err){return status('Недостатъчно място за автоматично подреждане. '+err.message);}
 items=arranged;selected=-1;active=-1;redraw();showSelection();
 status(free?'Апаратите са подредени върху монтажната плоча.':'Апаратите са подредени по DIN редове.');
};
document.addEventListener('keydown',e=>{
 if(e.target.closest?.('input,select,textarea,[contenteditable]'))return;
 const key=e.key.toLowerCase();
 if((e.ctrlKey||e.metaKey)&&['z','y'].includes(key)){
  e.preventDefault();
  (key==='y'||e.shiftKey?redoButton:undoButton).click();return;
 }
 if(key==='delete'&&!editing&&!wiring&&view==='front'){
  const chosen=marked.size?marked:(items[selected]?new Set([items[selected]]):null);
  if(selectedWire)connections=connections.filter(w=>w!==selectedWire);
  else if(active>=0&&bars[active])bars.splice(active,1);
  else if(chosen)items=items.filter(item=>!chosen.has(item));
  else return;
  e.preventDefault();selectedWire=null;selected=-1;active=-1;marked.clear();
  redraw();showSelection();status('Избраното е изтрито. Можеш да го върнеш с „Отмени“.');
  return;
 }
 if(key==='backspace'&&(wiring||editing===true)){
  e.preventDefault();
  if(editing===true&&draft){
   draft.points.pop();if(!draft.points.length)draft=null;
  }else if(channelY!==undefined&&!branchDraft)channelY=undefined;
  else wireBends.pop();
  redraw();return;
 }
 if(e.key==='Escape')cancel();
 if(e.key==='Enter'&&editing)finish();
});
document.querySelectorAll('[data-type]').forEach(b=>b.addEventListener('click',()=>{stopWire();placing=true;redraw()}));window.PDGCad={arm(value=true){stopWire();placing=value;redraw()},project:data,applyImport(next){applyProject(C.validate(next));status('Предложението от DWG е приложено.');},cabinet:()=>({...cabinet}),chooseCabinet(p){
 if(!p)return false;
 const nextCabinet={sku:p.sku,widthMm:p.widthMm,heightMm:p.heightMm,depthMm:p.depthMm};
 const specRows=Number(p.specifications?.['Редове']),specModules=Number(p.specifications?.['Брой модули на ред']);
 const nextRows=mode==='din'&&Number.isInteger(specRows)&&specRows>=1&&specRows<=8?specRows:rows;
 const nextModules=mode==='din'&&[12,18,24,36].includes(specModules)?specModules:modules;
 try{C.validate({...data(),cabinet:nextCabinet,rows:nextRows,modules:nextModules});}
 catch(err){status('Елементите не се побират в този корпус. '+err.message);return false;}
 cabinet=nextCabinet;rows=nextRows;modules=nextModules;
 $('rows').value=rows;$('modules').value=modules;
 redraw();status('Избран корпус '+p.sku);return true;
 }};$('drawing').setAttribute('tabindex','0');document.title='PDG Electric CAD | PDG Systems';document.querySelector('header b').textContent='PDG Electric CAD';redraw();
})();

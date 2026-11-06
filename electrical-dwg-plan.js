(function (root) {
'use strict';
const C=typeof module==='undefined'?root.PDGBusbar:require('./electrical-busbar-core.js');
const W=typeof module==='undefined'?root.PDGConnections:require('./electrical-connections.js');
const dinTypes=new Set(['MCB','RCD','RCBO','CONTACT']);
function propose(project, devices, links) {
    const cabinet=project.cabinet||C.defaultCabinet;
    const plate=C.layout(cabinet,project.rows,project.modules);
    const items=[],dinRails=[],known=new Map(),counts=new Map();
    const gap=15,margin=10;
    let x=margin,y=margin,rowHeight=0;
    for(const {ref} of devices)if(ref)counts.set(ref,(counts.get(ref)||0)+1);
    for(const din of [false,true]){
        if(din&&rowHeight){x=margin;y+=rowHeight+gap;rowHeight=0;}
        let rail=null;
        for(const {product:p,ref} of devices){
            if(dinTypes.has(p.type)!==din)continue;
            if(![p.widthMm,p.heightMm,p.depthMm,p.modules].every(v=>Number.isFinite(v)&&v>0)||
                p.type==='ENCLOSURE')throw Error('Липсват монтажни данни за '+p.sku+'.');
            if(x>margin&&x+p.widthMm>plate.width-margin){x=margin;y+=rowHeight+gap;rowHeight=0;rail=null;}
            if(x+p.widthMm>plate.width-margin||y+p.heightMm>plate.height-margin||p.depthMm>cabinet.depthMm){
                throw Error('Избери по-голям корпус. Артикул '+p.sku+' не се побира.');
            }
            if(din&&!rail){
                rail={x:margin,y:y+Math.min(30,p.heightMm/2),width:plate.width-2*margin};
                dinRails.push(rail);
            }
            const connectionId='dwg-'+(items.length+1);
            items.push({type:'CAT',catalogType:p.type,sku:p.sku,name:p.name,rating:p.rating||'',manufacturer:p.manufacturer,
                width:p.modules,widthMm:p.widthMm,heightMm:p.heightMm,depthMm:p.depthMm,poles:p.poles,imageUrl:p.imageUrl,
                sourceUrl:p.sourceUrl,designation:ref,connectionId,row:0,col:0,x,y});
            if(ref&&counts.get(ref)===1)known.set(ref,connectionId);
            x+=p.widthMm+(din?Math.max(0,p.modules*18-p.widthMm):gap);
            rowHeight=Math.max(rowHeight,p.heightMm);
        }
    }
    const connections=[], unresolved=[];
    const byId=new Map(items.map(item=>[item.connectionId,item]));
    const rowBottom=new Map();
    for(const item of items)rowBottom.set(item.y,Math.max(rowBottom.get(item.y)||0,item.y+item.heightMm));
    const exit=end=>{
        const item=byId.get(end.device);
        const position=W.terminalPosition(item,end,item,item.widthMm,item.heightMm);
        return {x:position.x,y:end.side==='top'?item.y-5:rowBottom.get(item.y)+5};
    };
    for(const link of links){
        const from={device:known.get(link.from.ref),side:link.from.side,pole:link.from.pole};
        const to={device:known.get(link.to.ref),side:link.to.side,pole:link.to.pole};
        const candidate={from,to,phase:link.phase,bends:[]};
        try{
            W.validate(items,[...connections,candidate]);
            const a=exit(from),b=exit(to);
            const lane=connections.length%2===0?4:plate.width-4;
            candidate.bends=[a,{x:lane,y:a.y},{x:lane,y:b.y},b];
            connections.push(candidate);
        }catch(error){
            unresolved.push({link,reason:error.message});
        }
    }
    const next=C.validate({...project,mode:'free',cabinet,items,busbars:[],dinRails,connections});
    return {project:next,unresolved};
}
const api={propose};
if(typeof module!=='undefined')module.exports=api;
root.PDGDwgPlan=api;
})(globalThis);

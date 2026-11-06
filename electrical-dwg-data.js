const clean = value => typeof value === 'string' ? value.trim().slice(0,120) : '';
const normal = value => clean(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
const codeKeys = ['SKU','ARTICLE','ARTICLENO','ARTIKELNUMMER','PARTNO','PARTNUMBER','CATALOGNO','CATALOGNUMBER','EAN','MODEL'];
const infoKeys = ['NAME','DESCRIPTION','MANUFACTURER','RATING','CURRENT','POLES','WIDTH','HEIGHT','DEPTH','TAG'];
const reference = value => clean(value).toUpperCase();
const planar = point => point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    (point.z===undefined||point.z===0);
const pointKey = point => Math.round(point.x*10000)+':'+Math.round(point.y*10000);
function wireLayer(layer) {
    const name=clean(layer).toUpperCase();
    if(/^(?:WIRES?|WIRING|ПРОВОДНИК)$/u.test(name))return '';
    return /^(?:(?:WIRES?|WIRING|ПРОВОДНИК)[ _-])?(L1|L2|L3|N|PE)$/u.exec(name)?.[1];
}
function crossingReviews(segments) {
    const warnings=[],seen=new Set(),epsilon=1e-8;
    segments.sort((a,b)=>a.left-b.left);
    for(let i=0;i<segments.length&&warnings.length<60;i++){
        const a=segments[i],dx=a.end.x-a.start.x,dy=a.end.y-a.start.y;
        for(let j=i+1;j<segments.length&&segments[j].left<=a.right&&warnings.length<60;j++){
            const b=segments[j],ex=b.end.x-b.start.x,ey=b.end.y-b.start.y;
            if(a.top>b.bottom||b.top>a.bottom)continue;
            const det=dx*ey-dy*ex;
            if(!det)continue;
            const x=b.start.x-a.start.x,y=b.start.y-a.start.y;
            const t=(x*ey-y*ex)/det,u=(x*dy-y*dx)/det;
            if(t<-epsilon||t>1+epsilon||u<-epsilon||u>1+epsilon||
                !(t>epsilon&&t<1-epsilon||u>epsilon&&u<1-epsilon))continue;
            const point={x:a.start.x+t*dx,y:a.start.y+t*dy},key=pointKey(point);
            if(seen.has(key))continue;
            seen.add(key);
            warnings.push({phase:a.phase===b.phase?a.phase:'',point,reason:'Пресичане без общ край'});
        }
    }
    return warnings;
}
function traceWires(entities, terminals) {
    const layers=new Map(), proposals=[], review=[], segments=[];
    let skipped=0, segmentCount=0;
    for(const e of entities){
        const phase=wireLayer(e.layer);
        if(phase===undefined||!['LINE','LWPOLYLINE'].includes(e.type))continue;
        const points=e.type==='LINE'?[e.startPoint,e.endPoint]:e.vertices;
        if(!points?.length||!points.every(planar)||
            (e.type==='LWPOLYLINE'&&(e.elevation||(e.flag&1)||points.some(p=>p.bulge)))||
            (e.extrusionDirection&&(e.extrusionDirection.x||e.extrusionDirection.y||![0,1].includes(e.extrusionDirection.z)))){
            skipped++;continue;
        }
        if(segmentCount+points.length-1>5000){skipped++;continue;}
        segmentCount+=points.length-1;
        const graph=layers.get(phase)||new Map();
        layers.set(phase,graph);
        for(let i=1;i<points.length;i++){
            const start=points[i-1],end=points[i],a=pointKey(start),b=pointKey(end);
            if(a===b)continue;
            segments.push({start,end,phase,left:Math.min(start.x,end.x),right:Math.max(start.x,end.x),
                top:Math.min(start.y,end.y),bottom:Math.max(start.y,end.y)});
            if(!graph.has(a))graph.set(a,new Set());
            if(!graph.has(b))graph.set(b,new Set());
            graph.get(a).add(b);graph.get(b).add(a);
        }
    }
    const atPoint=new Map();
    for(const {point,end} of terminals){
        const key=pointKey(point);
        if(!atPoint.has(key))atPoint.set(key,[]);
        atPoint.get(key).push(end);
    }
    for(const [phase,graph] of layers){
        const visited=new Set();
        for(const start of graph.keys()){
            if(visited.has(start))continue;
            const nodes=[start],ends=[];
            visited.add(start);
            let branches=false,endpointCount=0;
            for(let i=0;i<nodes.length;i++){
                const key=nodes[i],adjacent=graph.get(key);
                const markers=atPoint.get(key)||[];
                if(adjacent.size===1)endpointCount++;
                if(adjacent.size>2||markers.length>1||(markers.length&&adjacent.size!==1))branches=true;
                ends.push(...markers);
                for(const next of adjacent)if(!visited.has(next)){visited.add(next);nodes.push(next);}
            }
            if(!branches&&endpointCount===2&&ends.length===2&&ends[0].ref!==ends[1].ref&&proposals.length<300){
                proposals.push({from:ends[0],to:ends[1],phase});
            }else if(review.length<250)review.push({phase,reason:branches?'Разклонение или двусмислена клема':'Трасето няма две еднозначни крайни клеми'});
        }
    }
    return {proposals,review:[...crossingReviews(segments),...review],skipped};
}
export function equipmentFromDwg(database) {
    const rows = new Map();
    const devices=[],terminals=[];
    const entities=(database.entities||[]).filter(e=>!e.isInPaperSpace);
    let blocks=0,limited=0;
    for (const entity of entities) {
        if (entity.type !== 'INSERT') continue;
        const block = clean(entity.name);
        const attributes = new Map();
        for (const attr of entity.attribs || []) {
            const key = normal(attr.tag || attr.attrTag);
            const value = clean(attr.text?.text);
            if (key && value) attributes.set(key,value);
        }
        const marker=/^([A-Z0-9.-]+)[_:](TOP|BOTTOM)[_:]([1-9][0-9]?)$/i.exec(block);
        const terminalRef=reference(attributes.get('DEVICE')||marker?.[1]);
        const side=reference(attributes.get('SIDE')||marker?.[2]).toLowerCase();
        const pole=Number(attributes.get('POLE')||marker?.[3]);
        if(marker||attributes.has('DEVICE')&&attributes.has('SIDE')&&attributes.has('POLE')){
            if(terminalRef&&['top','bottom'].includes(side)&&Number.isInteger(pole)&&pole>=1&&pole<=12&&planar(entity.insertionPoint)&&
                terminals.length<2000)terminals.push({point:entity.insertionPoint,end:{ref:terminalRef,side,pole:pole-1}});
            continue;
        }
        blocks++;
        const codes = [...new Set(codeKeys.map(key=>attributes.get(key)).filter(Boolean))];
        // Many manufacturer blocks use their SKU as the block name.
        const blockTokens = block.split(/[^a-z0-9-]+/i).filter(token=>/[a-z]/i.test(token)&&/\d/.test(token)&&token.length>=5);
        const candidates = [...new Set([...codes,block,...blockTokens])].filter(Boolean);
        const details = Object.fromEntries(infoKeys.filter(key=>attributes.has(key)).map(key=>[key,attributes.get(key)]));
        const ref=reference(attributes.get('TAG')||attributes.get('REFDES')||attributes.get('DESIGNATION'));
        if(devices.length<250)devices.push({block,codes,candidates,details,ref});
        else limited++;
        const key = JSON.stringify([block,codes,details]);
        if (rows.has(key)) rows.get(key).count++;
        else if (rows.size<250) rows.set(key,{block,codes,candidates,details,count:1});
    }
    return {blocks, devices, limited, ...traceWires(entities,terminals), rows:[...rows.values()], shown:[...rows.values()].reduce((sum,row)=>sum+row.count,0)};
}

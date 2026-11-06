(function (root) {
'use strict';
const poleCount = item => item.type === 'BLANK' ? 0 :
    Math.max(1, Math.min(12, Math.trunc(Number(item.poles) || (item.type === 'RCBO' ? 2 : item.width))));
const phases = Object.freeze({
    L1:{label:'L1 · жълт',color:'#e0a500'},
    L2:{label:'L2 · зелен',color:'#248440'},
    L3:{label:'L3 · червен',color:'#d63036'},
    N:{label:'N · син',color:'#087dc2'},
    PE:{label:'PE · жълто-зелен',color:'#f2c321',stripe:'#237b3d'}
});
const key = terminal => terminal.bar ? 'bar:'+terminal.bar : terminal.device+':'+terminal.side+':'+terminal.pole;
function tapPosition(bar, end) {
    const a=bar?.points?.[end.segment], b=bar?.points?.[end.segment+1];
    if (!a||!b||!Number.isInteger(end.segment)||!Number.isFinite(end.fraction)||end.fraction<0||end.fraction>1) return null;
    return {x:a.x+(b.x-a.x)*end.fraction,y:a.y+(b.y-a.y)*end.fraction};
}
function nearestTap(bar, point) {
    let best=null, distance=Infinity;
    for(let segment=0;segment<bar.points.length-1;segment++){
        const a=bar.points[segment],b=bar.points[segment+1],dx=b.x-a.x,dy=b.y-a.y;
        const length=dx*dx+dy*dy;
        if(!length)continue;
        const fraction=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length));
        const end={bar:bar.id,segment,fraction},p=tapPosition(bar,end);
        const d=Math.hypot(point.x-p.x,point.y-p.y);
        if(d<distance){best=end;distance=d;}
    }
    return best;
}
const validEnd = (end, devices, bars) => {
    if(end?.bar)return !end.device&&Object.hasOwn(phases,bars.get(end.bar)?.phase)&&!!tapPosition(bars.get(end.bar),end);
    const device = devices.get(end?.device);
    return !!device && ['top','bottom'].includes(end.side) &&
        Number.isInteger(end.pole) && end.pole >= 0 && end.pole < poleCount(device);
};
function validate(items, connections = [], busbars = []) {
    const devices = new Map();
    for (const item of items) {
        if (item.connectionId === undefined) continue;
        if (typeof item.connectionId !== 'string' || !/^[a-z0-9-]{1,64}$/i.test(item.connectionId) ||
            devices.has(item.connectionId)) throw Error('Невалиден идентификатор на апарат.');
        devices.set(item.connectionId,item);
    }
    if (!Array.isArray(connections) || connections.length > 300) throw Error('Невалиден списък с връзки.');
    const pairs = new Set(), byId=new Map();
    for(const wire of connections){
        if(wire?.id===undefined)continue;
        if(typeof wire.id!=='string'||!(/^[a-z0-9-]{1,64}$/i.test(wire.id))||byId.has(wire.id))throw Error('Невалиден идентификатор на проводник.');
        byId.set(wire.id,wire);
    }
    const bars = new Map();
    for (const bar of busbars) {
        if (bar.phase!==undefined&&!Object.hasOwn(phases,bar.phase)) throw Error('Невалиден проводник на шина.');
        if (bar.id===undefined) continue;
        if (typeof bar.id!=='string'||!(/^[a-z0-9-]{1,64}$/i.test(bar.id))||bars.has(bar.id)) throw Error('Невалиден идентификатор на шина.');
        bars.set(bar.id,bar);
    }
    const parents = new Map();
    const conductorByNet = new Map();
    function root(terminal) {
        while (parents.has(terminal)) terminal = parents.get(terminal);
        return terminal;
    }
    for (const connection of connections) {
        if (!validEnd(connection?.from,devices,bars) || !validEnd(connection?.to,devices,bars) ||
            (connection.from.bar&&connection.to.bar) ||
            (connection.from.device&&connection.from.device === connection.to.device) ||
            (connection.phase !== undefined && !Object.hasOwn(phases, connection.phase)) ||
            !Array.isArray(connection.bends) || connection.bends.length > 24 ||
            !connection.bends.every(p => p && Number.isFinite(p.x) && p.x>=0 && p.x<=1600 &&
                Number.isFinite(p.y) && p.y>=0 && p.y<=2400)) throw Error('Невалидна връзка между клеми.');
        if(connection.channelY!==undefined&&(!Number.isFinite(connection.channelY)||connection.channelY<0||connection.channelY>2400)){
            throw Error('Невалидно трасе през канал.');
        }
        if(connection.branchOf!==undefined){
            const parent=byId.get(connection.branchOf);
            if(!parent||parent===connection||parent.branchOf!==undefined||parent.channelY===undefined||
                parent.channelY!==connection.channelY||!parent.from||parent.phase!==connection.phase||
                key(parent.from)!==key(connection.from)||
                !Number.isFinite(connection.branchFraction)||connection.branchFraction<0||connection.branchFraction>1){
                throw Error('Невалидно отклонение от проводник.');
            }
        }
        const pair = [key(connection.from),key(connection.to)].sort().join('|');
        if (pairs.has(pair)) throw Error('Тези клеми вече са свързани.');
        pairs.add(pair);
        const from = root(key(connection.from)), to = root(key(connection.to));
        const phasesInNet = new Set([conductorByNet.get(from), conductorByNet.get(to), bars.get(connection.from.bar)?.phase, bars.get(connection.to.bar)?.phase, connection.phase].filter(Boolean));
        if (phasesInNet.size > 1) {
            throw Error('Несъвместими проводници в една електрическа мрежа: '+[...phasesInNet].join(' и ')+'.');
        }
        if (from !== to) parents.set(to, from);
        conductorByNet.set(from, phasesInNet.values().next().value);
    }
    return connections;
}
function terminalPosition(item, terminal, position, width, height) {
    return {
        x:position.x + width * (terminal.pole + .5) / poleCount(item),
        y:position.y + (terminal.side === 'bottom' ? height : 0)
    };
}
function route(start, end, bends = []) {
    const points = [start];
    const append = p => {
        const last = points.at(-1);
        if (last.x !== p.x || last.y !== p.y) points.push(p);
    };
    if (bends.length === 0) {
        const y = (start.y + end.y) / 2;
        bends = [{x:start.x,y}, {x:end.x,y}];
    }
    for (const point of [...bends,end]) {
        const last = points.at(-1);
        if (last.x !== point.x && last.y !== point.y) append({x:last.x,y:point.y});
        append(point);
    }
    return points;
}
function validGroup(positions, fixed, width, height) {
    const overlaps = (a,b) => a.x<b.x+b.width && b.x<a.x+a.width &&
        a.y<b.y+b.height && b.y<a.y+a.height;
    return positions.every((p,i)=>p.x>=0 && p.y>=0 && p.x+p.width<=width && p.y+p.height<=height &&
        !fixed.some(q=>overlaps(p,q)) && !positions.slice(0,i).some(q=>overlaps(p,q)));
}
const api = {poleCount,key,validate,terminalPosition,route,phases,validGroup,tapPosition,nearestTap};
if (typeof module !== 'undefined') module.exports = api;
root.PDGConnections = api;
})(globalThis);

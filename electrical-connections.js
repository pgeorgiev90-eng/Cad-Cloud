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
const key = terminal => terminal.device + ':' + terminal.side + ':' + terminal.pole;
const validEnd = (end, devices) => {
    const device = devices.get(end?.device);
    return !!device && ['top','bottom'].includes(end.side) &&
        Number.isInteger(end.pole) && end.pole >= 0 && end.pole < poleCount(device);
};
function validate(items, connections = []) {
    const devices = new Map();
    for (const item of items) {
        if (item.connectionId === undefined) continue;
        if (typeof item.connectionId !== 'string' || !/^[a-z0-9-]{1,64}$/i.test(item.connectionId) ||
            devices.has(item.connectionId)) throw Error('Невалиден идентификатор на апарат.');
        devices.set(item.connectionId,item);
    }
    if (!Array.isArray(connections) || connections.length > 300) throw Error('Невалиден списък с връзки.');
    const pairs = new Set();
    for (const connection of connections) {
        if (!validEnd(connection?.from,devices) || !validEnd(connection?.to,devices) ||
            connection.from.device === connection.to.device ||
            (connection.phase !== undefined && !Object.hasOwn(phases, connection.phase)) ||
            !Array.isArray(connection.bends) || connection.bends.length > 24 ||
            !connection.bends.every(p => p && Number.isFinite(p.x) && p.x>=0 && p.x<=1600 &&
                Number.isFinite(p.y) && p.y>=0 && p.y<=2400)) throw Error('Невалидна връзка между клеми.');
        const pair = [key(connection.from),key(connection.to)].sort().join('|');
        if (pairs.has(pair)) throw Error('Тези клеми вече са свързани.');
        pairs.add(pair);
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
const api = {poleCount,key,validate,terminalPosition,route,phases,validGroup};
if (typeof module !== 'undefined') module.exports = api;
root.PDGConnections = api;
})(globalThis);

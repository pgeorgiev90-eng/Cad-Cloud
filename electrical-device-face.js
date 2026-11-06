/* Scalable front views. Geometry is illustrative; physical dimensions come from the catalog. */
(function (root) {
'use strict';
function family(item) {
    const kind = item.catalogType || item.type;
    if (kind !== 'CAT') return kind;
    const label = item.name || '';
    if (/лят корпус|mccb/i.test(label)) return 'MCCB';
    if (/дефектноток|\bДТЗ\b|rcd|rcbo/i.test(label)) return 'RCD';
    if (/контактор|contactor/i.test(label)) return 'CONTACT';
    if (/клем|terminal/i.test(label)) return 'TERMINAL';
    return 'MCB';
}
function draw(node, parent, item, x, y, width, height, poles) {
    const kind = family(item);
    const dark = kind === 'MCCB';
    const protective = kind === 'RCD' || kind === 'RCBO';
    const handle = kind === 'CONTACT' ? '#576875' : '#213f62';
    const add = (tag, attributes) => node(tag, attributes, parent);
    const rect = (dx, dy, w, h, fill, stroke = 'none', radius = 1.5) =>
        add('rect', {x:x+dx,y:y+dy,width:w,height:h,rx:radius,fill,stroke,'stroke-width':.65});
    const line = (x1, y1, x2, y2, stroke, thickness = .7) =>
        add('line', {x1:x+x1,y1:y+y1,x2:x+x2,y2:y+y2,stroke,'stroke-width':thickness});
    const text = (dx, dy, value, size, fill) => {
        const label = add('text', {x:x+dx,y:y+dy,fill,'font-family':'system-ui,sans-serif','font-size':size,'font-weight':650});
        label.textContent = value;
    };
    const body = dark ? '#59616a' : '#f3f5f6';
    rect(1.8,2.4,width,height,'#263440', 'none', 2);
    rect(0,0,width,height,body,dark?'#27313b':'#a5afb6',2);
    if (kind === 'BLANK') return;
    rect(1.2,height*.19,width-2.4,height*.62,dark?'#353f49':'#fff',dark?'#262e36':'#c0cad1');
    rect(1.2,height*.43,width-2.4,height*.28,dark?'#252d35':'#d9dfe3');
    const spacing = width / poles;
    for (let pole=0; pole<poles; pole++) {
        const center = (pole+.5)*spacing;
        if (pole) line(pole*spacing,height*.18,pole*spacing,height*.82,dark?'#717a83':'#c4cdd4');
        for (const terminalY of [height*.085,height*.915]) {
            rect(center-spacing*.29,terminalY-height*.045,spacing*.58,height*.09,dark?'#262e36':'#d8dfe4');
            add('circle',{cx:x+center,cy:y+terminalY,r:Math.min(3,spacing*.19),fill:'#64717d',stroke:'#384956','stroke-width':.5});
            line(center-1.7,terminalY,center+1.7,terminalY,'#e5eaf0');
        }
        rect(center-spacing*.31,height*.5,spacing*.62,height*.132,handle,'#102740');
        line(center-spacing*.24,height*.525,center+spacing*.24,height*.525,'#7297bd',1);
    }
    if (poles>1 && kind!=='TERMINAL') rect(width*.09,height*.62,width*.82,height*.052,handle);
    if (protective) rect(width*.69,height*.28,width*.22,height*.085,'#f0bd42','#aa7e19');
    text(2.2,height*.31,String(item.rating||kind).slice(0,Math.max(3,Math.floor(width/4.5))),Math.min(7,width*.28),dark?'#f1f5fa':'#1a3855');
    if (width>=34 && item.sku) text(2.2,height*.395,item.sku.slice(0,Math.floor(width/3.5)),5.3,dark?'#d7e0eb':'#44566a');
}
const api = {draw};
if (typeof module !== 'undefined') module.exports = api;
root.PDGDeviceFace = api;
})(globalThis);

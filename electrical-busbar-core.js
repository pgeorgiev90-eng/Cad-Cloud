(function(root){
'use strict';
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
function point(p){return p&&finite(p.x,0,1600)&&finite(p.y,0,2400)&&finite(p.z,0,300)}
function validate(data){
 if(!data||!Array.isArray(data.items)||data.items.length>500||!Number.isInteger(data.rows)||data.rows<1||data.rows>8||![12,18,24,36].includes(data.modules))throw Error('Невалидни размери или апарати');
 const d=JSON.parse(JSON.stringify(data));d.mode=d.mode==='free'?'free':'din';d.busbars=d.busbars||[];
 if(!Array.isArray(d.busbars)||d.busbars.length>300)throw Error('Невалидни шини');
 if(d.cabinet&&(!finite(d.cabinet.widthMm,200,1600)||!finite(d.cabinet.heightMm,200,2400)||!finite(d.cabinet.depthMm,50,1000)||typeof d.cabinet.sku!=='string'))throw Error('Невалиден корпус');
 d.items.forEach(it=>{if(!['MCB','RCD','RCBO','SPD','MAIN','CONTACT','METER','BLANK','CAT'].includes(it.type)||!finite(it.width,1,36)||!Number.isInteger(it.row)||!Number.isInteger(it.col)||it.row<0||it.row>=d.rows||it.col<0||it.col+it.width>d.modules)throw Error('Апарат извън таблото');if(it.x!==undefined&&(!finite(it.x,0,1600)||!finite(it.y,0,2400)))throw Error('Невалидна монтажна позиция');if(it.unitPrice!==undefined&&it.unitPrice!==null&&!finite(it.unitPrice,0,1e9))throw Error('Невалидна цена');it.name=String(it.name||'Апарат').slice(0,200);it.rating=String(it.rating||'').slice(0,100)});
 for(let i=0;i<d.items.length;i++)for(let j=0;j<i;j++){const a=d.items[i],b=d.items[j];if(d.mode==='din'&&a.row===b.row&&a.col<b.col+b.width&&b.col<a.col+a.width)throw Error('Припокриващи се апарати')}
 d.busbars.forEach(b=>{if(!Array.isArray(b.points)||b.points.length<2||b.points.length>500||!b.points.every(point)||!finite(b.width,2,100)||!finite(b.thickness,1,20)||!/^#[0-9a-f]{6}$/i.test(b.color))throw Error('Невалидна геометрия на шина');b.holes=b.holes||[];if(!Array.isArray(b.holes)||!b.holes.every(h=>Number.isInteger(h.index)&&h.index>=0&&h.index<b.points.length&&finite(h.diameter,2,30)))throw Error('Невалиден отвор')});
 const wires=typeof module!=="undefined"?require("./electrical-connections.js"):root.PDGConnections;
 wires.validate(d.items,d.connections);
 return d;
}
function project(p,view){return view==='side'?{x:40+p.z*2,y:100+p.y*1.5}:view==='3d'?{x:55+p.x*1.25+p.z*.8,y:240+p.y*1.1-p.x*.22-p.z*.65}:{x:50+p.x,y:120+p.y}}
function snap(p,targets,step=5,radius=8){let best=null,dist=radius;for(const t of targets){const n=Math.hypot(t.x-p.x,t.y-p.y);if(n<dist){dist=n;best=t}}return best?{...best,z:p.z}:{x:Math.max(0,Math.round(p.x/step)*step),y:Math.max(0,Math.round(p.y/step)*step),z:p.z}}
function length(b){return b.points.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-b.points[i].x,p.y-b.points[i].y,p.z-b.points[i].z),0)}
const api={validate,project,snap,length};if(typeof module!=='undefined')module.exports=api;root.PDGBusbar=api;
})(typeof globalThis!=='undefined'?globalThis:this);

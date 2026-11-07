'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
for(const file of ['roof-cad.php','solar-cad-preview.html']){
 const source=fs.readFileSync(file,'utf8'),part=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 const fields={panelW:{value:'1'},panelH:{value:'2'},panelPower:{value:'450'},panelGap:{value:'.02'},alignSouth:{checked:true},panelCatalog:{value:'custom'},panelVoc:{value:'40'},panelVmp:{value:'33'},panelVocCoefficient:{value:'-.25'},panelImp:{value:'13'},panelIsc:{value:'14'}};
 const ctx=vm.createContext({console,Math,Number,Set,document:{body:{classList:{contains:()=>true}}},window:{},$:(id)=>fields[id],render:()=>{},msg:()=>{}});
 vm.runInContext('let selected=0,markedPanels=new Set(),planes=[];'+part('function rad(','function actualArea(')+part('function contains(','function panelMoveGroup(')+part('function panelMoveGroup(','function choosePanel(')+part('function panelFitsRoof(','function roofPanelAngle(')+part('function roofPanelAngle(','function autoFillRoof(')+part('function autoFillRoof('," $('autoFill')"),ctx);
 const run=s=>vm.runInContext(s,ctx);
 run("planes=[{path:[[0,0],[0,.0001],[.0001,.0001],[.0001,0]],panels:[]}];autoFillRoof(true)");
 assert.ok(run('planes[0].panels.length')>10,file+' rectangle fill');
 assert.ok(run('planes[0].panels.every(p=>panelFitsRoof(p,planes[0].path))'),file+' all panels inside');
 const count=run('planes[0].panels.length');run('autoFillRoof(true)');assert.equal(run('planes[0].panels.length'),count,file+' repeated fill cannot overlap');
 run('markedPanels=new Set([0,1]);const group=panelMoveGroup(0,0);const original=planes[0].panels.map(p=>({...p}));translatePanels(group,.001,.002)');
 assert.ok(run('planes[0].panels[0].lat===original[0].lat+.001&&planes[0].panels[1].lng===original[1].lng+.002&&planes[0].panels[2].lat===original[2].lat'),file+' group translation');
 run('translatePanels(group,0,0)');assert.ok(run('planes[0].panels[0].lat===original[0].lat'),file+' cancelled move rolls back');
 assert.equal(run('panelMoveGroup(0,2).length'),1,file+' unmarked move');
 run('planes[0].panels=Array.from({length:1499},()=>({...original[0]}));autoFillRoof(true)');assert.equal(run('planes[0].panels.length'),1500,file+' maximum includes existing panels');
 run('autoFillRoof(true)');assert.equal(run('planes[0].panels.length'),1500,file+' cap remains stable');
 // A notch can cross a panel whose four corners all remain inside.
 run('const notch=[[0,0],[0,.0001],[.0001,.0001],[.0001,.00006],[.00004,.00006],[.00004,.00004],[.0001,.00004],[.0001,0]];const bridge={lat:.000065,lng:.00005,w:8,h:2,rotation:0}');
 assert.ok(run('panelCorners(bridge).every(c=>contains(c,notch))'));
 assert.equal(run('panelFitsRoof(bridge,notch)'),false,file+' concave roof edge crossing');
 console.log('PASS: '+file+' actual editor geometry, non-overlapping fill, concave edges, 1500 limit, group move and cancellation');
}
// Exercise the real autosave function against storage failures and unchanged saves.
{
 const source=fs.readFileSync('solar-cad-preview.html','utf8'),data=new Map(),status={textContent:''};let project={version:1,planes:[],projectName:'One'};
 const ctx=vm.createContext({JSON,Date,Error,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},window:{PDGSolarProjectFormat:{validProject:d=>d?.version===1&&Array.isArray(d.planes)}},api:{project:()=>project,message:()=>{}},status,ready:true,restoring:false,storeKey:'test'});
 vm.runInContext(source.slice(source.indexOf('function save(show=false)'),source.indexOf('function schedule()',source.indexOf('function save(show=false)'))),ctx);
 vm.runInContext('save()',ctx);const first=data.get('test');
 project={...project,projectName:'Two'};vm.runInContext('save()',ctx);assert.equal(data.get('test-previous'),first);
 vm.runInContext('save()',ctx);assert.equal(data.get('test-previous'),first,'unchanged save preserves previous revision');
 data.set('test','broken');project={...project,projectName:'Three'};vm.runInContext('save()',ctx);assert.equal(data.get('test-previous'),first,'corrupt current cannot replace recovery');
 ctx.localStorage.setItem=()=>{throw Error('quota')};project={...project,projectName:'Four'};vm.runInContext('save()',ctx);assert.match(status.textContent,/Експорт/);
 console.log('PASS: real autosave rotation, stable previous revision, corrupt current and storage quota failure');
}

(function(root){
 'use strict';
 const finite=Number.isFinite;
 function validProject(data){
  const coordinate=x=>Array.isArray(x)&&x.length===2&&finite(x[0])&&finite(x[1])&&Math.abs(x[0])<=90&&Math.abs(x[1])<=180;
  if(!data||data.version!==1||!Array.isArray(data.planes)||data.planes.length>100)return false;
  let total=0;
  return data.planes.every(p=>{
   if(!p||!Array.isArray(p.path)||p.path.length<3||p.path.length>200||!p.path.every(coordinate)||!finite(p.azimuth)||p.azimuth<0||p.azimuth>=360||!finite(p.tilt)||p.tilt<0||p.tilt>80)return false;
   if(p.moduleTilt!=null&&(!finite(p.moduleTilt)||p.moduleTilt<0||p.moduleTilt>80))return false;
   if(p.manualArea!=null&&(!finite(p.manualArea)||p.manualArea<=0))return false;
   if(!Array.isArray(p.panels)||p.panels.length>1500)return false;
   total+=p.panels.length;if(total>20000)return false;
   return p.panels.every(x=>x&&finite(x.lat)&&finite(x.lng)&&Math.abs(x.lat)<=90&&Math.abs(x.lng)<=180&&finite(x.w)&&x.w>0&&finite(x.h)&&x.h>0&&finite(x.power)&&x.power>0&&finite(x.rotation));
  });
 }
 const api={validProject};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.PDGSolarProjectFormat=api;
})(typeof window==='object'?window:globalThis);

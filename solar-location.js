(function(root){
 'use strict';
 function currentPosition(geolocation){
  return new Promise((resolve,reject)=>{
   if(!geolocation||typeof geolocation.getCurrentPosition!=='function'){reject(new Error('Този браузър не поддържа определяне на местоположение. Потърси адрес от „Настройки“.'));return;}
   geolocation.getCurrentPosition(position=>{
    const c=position?.coords;
    if(!c||![c.latitude,c.longitude,c.accuracy].every(Number.isFinite)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||c.accuracy<0){reject(new Error('Телефонът върна невалидно местоположение. Опитай отново.'));return;}
    resolve({lat:c.latitude,lng:c.longitude,accuracy:c.accuracy});
   },error=>{
    const messages={1:'Достъпът до местоположението е отказан. Разреши го за този сайт от настройките на браузъра или потърси адрес.',2:'Местоположението не е достъпно. Провери дали услугите за местоположение на телефона са включени и опитай отново.',3:'Телефонът не успя да определи местоположението навреме. Опитай отново или потърси адрес.'};
    reject(new Error(messages[error?.code]||'Местоположението не може да се определи. Опитай отново или потърси адрес.'));
   },{enableHighAccuracy:true,timeout:18000,maximumAge:30000});
  });
 }
 const api={currentPosition};if(typeof module==='object'&&module.exports)module.exports=api;else root.PDGSolarLocation=api;
})(typeof window==='object'?window:globalThis);

(() => {
 'use strict';
 const $=id=>document.getElementById(id),editor=window.PDGSolarEditor;
 if(!editor)return;
 const media=matchMedia('(max-width: 820px)'),forced=new URLSearchParams(location.search).get('mobile')==='1';
 const storageKey='pdg-solar-cad-draft-v1';let saveTimer,restoring=false,pendingDraft=null,hasSavedProject=false;
 function announce(s){editor.message(s);$('mobile-hint').textContent=s;}
 function sheet(open,target){
  document.body.classList.toggle('sheet-open',open);
  $('mobile-settings').setAttribute('aria-expanded',String(open));
  if(open){if(target)requestAnimationFrame(()=>$(target)?.scrollIntoView({block:'start'}));else document.querySelector('aside').scrollTop=0;$('mobile-sheet-close').focus({preventScroll:true});}
  else if(document.querySelector('aside').contains(document.activeElement))$('mobile-settings').focus({preventScroll:true});
  requestAnimationFrame(()=>editor.resize());
 }
 function update(){
  const s=editor.state(),mobile=document.body.classList.contains('mobile-cad');
  document.body.classList.toggle('precise-drawing',mobile&&s.mode==='roof'&&!!window.PDGSolarPreciseMode);
  $('mobile-summary').textContent=s.roofs?s.roofs+(s.roofs===1?' скат · ':' ската · ')+s.panels+' панела · '+s.kwp.toFixed(2)+' kWp':'Нов соларен проект';
  $('mobile-hint').textContent=s.mode==='roof'?s.points+' върха · '+(window.PDGSolarPreciseMode?'Мести картата под мерника и добавяй точки.':'Докосвай ъглите върху картата.'):(!s.roofs?'Избери „Скат“, за да очертаеш покрив.':$('mapHint').textContent);
  const drawing=s.mode==='roof';
  $('mobile-point').hidden=!drawing||!window.PDGSolarPreciseMode;
  $('mobile-undo').hidden=$('mobile-finish').hidden=$('mobile-precision').hidden=!drawing;
  $('mobile-undo').disabled=!s.points;
  $('mobile-finish').disabled=s.points<3;
  $('mobile-precision').textContent=window.PDGSolarPreciseMode?'Точки с докосване':'Прецизен мерник';
  $('mobile-fill').hidden=$('mobile-multi').hidden=$('mobile-rotate').hidden=$('mobile-remove').hidden=!s.cad||drawing||s.view;
  $('mobile-2d').hidden=$('mobile-3d').hidden=!s.cad||drawing;
  $('mobile-2d').textContent=s.view==='2d'?'Към CAD':'2D';$('mobile-3d').textContent=s.view==='3d'?'Към CAD':'3D';
  $('mobile-multi').setAttribute('aria-pressed',String(!!window.PDGSolarMultiSelect));
  $('mobile-map').setAttribute('aria-pressed',String(!drawing&&!s.cad));
  $('mobile-roof').setAttribute('aria-pressed',String(drawing));
  $('mobile-panels').setAttribute('aria-pressed',String(s.cad));
 }
 function layout(){const mobile=media.matches||forced;document.body.classList.toggle('mobile-cad',mobile);if(!mobile)sheet(false);if(mobile&&window.PDGSolarPreciseMode===undefined)window.PDGSolarPreciseMode=true;update();requestAnimationFrame(()=>editor.resize());}
 $('mobile-sheet-close').onclick=()=>sheet(false);
 $('mobile-settings').onclick=()=>sheet(!document.body.classList.contains('sheet-open'));
 $('mobile-map').onclick=()=>{sheet(false);const s=editor.state();if(s.mode==='roof'&&s.points){announce('Завърши ската или отмени очертаването от настройките.');return;}editor.open('draw');update();};
 $('mobile-roof').onclick=()=>{if(editor.state().mode==='roof'){sheet(false);return;}if(editor.state().cad)editor.open('draw');$('newPlane').click();sheet(false);update();};
 $('mobile-panels').onclick=()=>{editor.open('cad');if(!editor.state().cad)return;sheet(false);announce('Панели: запълни автоматично или отвори „Настройки“ за модел и размери.');update();};
 $('mobile-offer').onclick=()=>{editor.open('cad');if(editor.state().cad)sheet(true,'solar-offer-settings');};
 $('mobile-point').onclick=()=>editor.addCenterPoint();
 $('mobile-undo').onclick=()=>editor.undoPoint();
 $('mobile-finish').onclick=()=>{$('finishPlane').click();update();};
 $('mobile-precision').onclick=()=>{window.PDGSolarPreciseMode=!window.PDGSolarPreciseMode;update();};
 $('mobile-fill').onclick=()=>{$('autoFill').click();update();};
 $('mobile-multi').onclick=()=>{window.PDGSolarMultiSelect=!window.PDGSolarMultiSelect;announce(window.PDGSolarMultiSelect?'Докосвай панелите, за да ги добавяш или премахваш от избора.':'Докосни панел за единичен избор.');update();};
 $('mobile-rotate').onclick=()=>$('rotateRight').click();
 $('mobile-remove').onclick=()=>$('deleteMarked').click();
 $('mobile-2d').onclick=()=>{editor.toggle2d();update();};
 $('mobile-3d').onclick=()=>{editor.toggle3d();update();};
 $('mobile-locate').onclick=async()=>{
  if(editor.state().mode==='roof'&&editor.state().points){announce('Завърши текущия скат, преди да преместиш картата към местоположението си.');return;}
  const button=$('mobile-locate');button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='…';sheet(false);announce('Определяне на местоположението… Разреши достъпа, ако телефонът поиска.');
  try{const point=await window.PDGSolarLocation.currentPosition(navigator.geolocation);if(editor.showLocation(point)){announce('Местоположението е отбелязано · точност около '+Math.round(point.accuracy)+' m. Избери „Скат“, за да започнеш да чертаеш.');}}
  catch(error){announce(error.message);}
  finally{button.disabled=false;button.removeAttribute('aria-busy');button.textContent='GPS';}
 };
 $('mobile-zoom-in').onclick=()=>editor.zoom(1);
 $('mobile-zoom-out').onclick=()=>editor.zoom(-1);
 $('mobile-fit').onclick=()=>editor.fit();
 document.addEventListener('keydown',e=>{if(e.key==='Escape')sheet(false);});
 for(const id of ['goCad','tabCad','tabDraw','addPanel','cadEditPoints'])$(id).addEventListener('click',()=>{if(document.body.classList.contains('mobile-cad'))sheet(false);update();});
 for(const id of ['quickMount'])$(id).addEventListener('click',()=>{if(document.body.classList.contains('mobile-cad'))sheet(true,'mountSection');});
 function save(){
  if(restoring)return;
  try{const project=editor.project();if(!project.planes.length){if(hasSavedProject){localStorage.removeItem(storageKey);hasSavedProject=false;}return;}localStorage.setItem(storageKey,JSON.stringify({savedAt:new Date().toISOString(),project}));$('mobile-save-status').textContent='Запазено на това устройство · '+new Date().toLocaleTimeString('bg-BG',{hour:'2-digit',minute:'2-digit'});pendingDraft=null;hasSavedProject=true;$('mobile-draft').hidden=true;}
  catch{$('mobile-save-status').textContent='Автоматичният запис не е достъпен. Използвай „Запази файл“.';}
 }
 window.addEventListener('pdg-solar-change',()=>{update();if(!restoring){clearTimeout(saveTimer);saveTimer=setTimeout(save,700);}});
 window.addEventListener('pdg-solar-mode',update);
 document.querySelector('aside').addEventListener('input',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(save,700);});
 window.addEventListener('pagehide',save);
 try{const raw=localStorage.getItem(storageKey);if(raw&&raw.length<=5000000){const saved=JSON.parse(raw);if(saved.project?.planes?.length){pendingDraft=saved.project;$('mobile-draft').hidden=false;}}}catch{}
 $('mobile-restore').onclick=()=>{if(!pendingDraft)return;try{restoring=true;editor.restore(pendingDraft);$('mobile-draft').hidden=true;pendingDraft=null;announce('Последният проект е възстановен от това устройство.');}catch{announce('Запазеният проект не може да се възстанови.');}finally{restoring=false;update();}};
 $('mobile-dismiss-draft').onclick=()=>{$('mobile-draft').hidden=true;pendingDraft=null;};
 const observer=new ResizeObserver(()=>editor.resize());observer.observe($('mapWrap'));
 media.addEventListener('change',layout);window.addEventListener('orientationchange',()=>requestAnimationFrame(()=>editor.resize()));layout();
})();

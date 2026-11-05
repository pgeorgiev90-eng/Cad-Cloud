(() => {
  'use strict';
  const button=document.querySelector('[data-menu-toggle]');
  const nav=document.getElementById('site-navigation');
  if(!button || !nav)return;
  const mobile=window.matchMedia('(max-width:900px)');
  function setOpen(open){
    nav.classList.toggle('is-open',open);
    button.setAttribute('aria-expanded',String(open));
    button.querySelector('.menu-label').textContent=open?'Затвори':'Меню';
  }
  button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
  nav.addEventListener('click',event=>{if(mobile.matches && event.target.closest('a'))setOpen(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && button.getAttribute('aria-expanded')==='true'){setOpen(false);button.focus();}});
  document.addEventListener('click',event=>{if(mobile.matches && !nav.contains(event.target) && !button.contains(event.target))setOpen(false);});
  mobile.addEventListener('change',()=>{const focused=nav.contains(document.activeElement);setOpen(false);if(mobile.matches && focused)button.focus();});
})();

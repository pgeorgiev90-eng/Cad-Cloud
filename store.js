(() => {
  'use strict';
  const money = cents => (Number(cents) / 100).toLocaleString('bg-BG', {style:'currency', currency:'EUR'});
  const errors = {shop_unavailable:'Магазинът временно не е достъпен.', product_unavailable:'Този продукт е само по запитване или вече не се предлага.', invalid_quantity:'Въведете количество от 1 до 999.', cart_limit:'Достигнат е лимитът на количката (50 продукта, до 999 броя).', invalid_request:'Сесията е обновена. Презаредете страницата.', cart_changed:'Количката или цените са променени. Прегледайте обновените суми и изпратете отново.', invalid_customer:'Проверете данните за контакт и адреса.', try_later:'Достигнат е лимитът за поръчки. Опитайте по-късно.', checkout_unavailable:'Поръчката не може да бъде потвърдена. Опитайте отново със същата количка.', empty_cart:'Количката е празна.'};
  let cart = null, queue = Promise.resolve();
  const node = (tag, text, cls) => {const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const notice = node('div', '', 'store-toast');
  notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite'); document.body.append(notice);
  let noticeTimer;
  function tell(text) {notice.textContent=text;notice.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.hidden=true;},6000);}
  async function request(url, data) {
    const options={credentials:'same-origin',cache:'no-store'};
    if(data!==undefined){options.method='POST';options.headers={'Content-Type':'application/json','X-CSRF-Token':cart?.csrf||''};options.body=JSON.stringify(data);}
    const response=await fetch(url,options); const result=await response.json();
    if(!response.ok)throw new Error(result.error||'shop_unavailable');
    return result;
  }
  function updateBadge() {document.querySelectorAll('[data-cart-count]').forEach(e=>{e.textContent=cart?String(cart.items.reduce((sum,p)=>sum+p.quantity,0)):'…';});}
  async function refresh() {cart=await request('api/cart.php');updateBadge();return cart;}
  function mutate(data) {
    const operation=queue.then(async()=>{if(!cart)await refresh();cart=await request('api/cart.php',data);updateBadge();return cart;});
    queue=operation.catch(()=>{});return operation;
  }
  function cartLink() {const a=node('a',undefined,'cart-link');a.href='cart.html';a.append(node('span','Количка '));const count=node('span','…');count.dataset.cartCount='';a.append(count);return a;}
  document.querySelectorAll('[data-store-cart-link]').forEach(e=>e.append(cartLink()));
  window.PDGStore={add:async(id,quantity=1)=>{try{await mutate({action:'add',id:Number(id),quantity});window.PDGTrack?.('cart_add');tell('Продуктът е добавен в количката.');}catch(e){tell(errors[e.message]||'Неуспешно добавяне. Опитайте отново.');throw e;}},money};
  const root=document.getElementById('cart-content'),form=document.getElementById('checkout-form'),status=document.getElementById('cart-status');
  const summary=document.getElementById('cart-summary');
  let submitting=false;
  const setStatus=text=>{if(status)status.textContent=text;};
  function render() {
    if(!root)return;
    root.replaceChildren();summary.replaceChildren();
    if(!cart.items.length){root.append(node('p','Количката е празна. Разгледайте каталога и добавете продукти.'));form.hidden=true;return;}
    form.hidden=false;
    for(const p of cart.items){
      const row=node('article',undefined,'cart-row'),info=node('div',undefined,'cart-product');
      info.append(node('h2',p.name),node('p','Код: '+p.code,'muted'),node('p',p.available?money(p.unit_cents)+' / бр. без ДДС':'Продуктът не е достъпен. Премахнете го от количката.','muted'));
      const controls=node('div',undefined,'quantity-controls'),label=node('label','Количество '),input=node('input');
      input.type='number';input.min='1';input.max='999';input.step='1';input.value=p.quantity;input.setAttribute('aria-label','Количество за '+p.name);label.append(input);
      const save=node('button','Обнови'),remove=node('button','Премахни','secondary');save.type=remove.type='button';
      async function change(action){
        if(submitting)return;
        const quantity=action==='remove'?1:Number(input.value);
        if(!Number.isInteger(quantity)||quantity<1||quantity>999){setStatus(errors.invalid_quantity);return;}
        save.disabled=remove.disabled=true;
        try{await mutate({action,id:p.id,quantity});render();setStatus('Количката е обновена.');}
        catch(e){setStatus(errors[e.message]||'Количката не е обновена.');save.disabled=remove.disabled=false;}
      }
      save.onclick=()=>change('set');remove.onclick=()=>change('remove');controls.append(label,save,remove);
      row.append(info,controls,node('strong',p.available?money(p.line_cents):'—'));root.append(row);
    }
    for(const [label,value] of [['Стойност без ДДС',cart.subtotal_cents],['ДДС 20%',cart.vat_cents],['Общо за продуктите с ДДС',cart.total_cents]]){const line=node('div',undefined,'sum-line');line.append(node('span',label),node('strong',money(value)));summary.append(line);}
    summary.append(node('p','Доставката не е включена. Цената и срокът се потвърждават с вас преди изпращане.','muted'));
    form.querySelector('[type=submit]').disabled=!cart.can_checkout;
  }
  if(form)form.addEventListener('submit',async event=>{
    event.preventDefault();if(submitting||!form.reportValidity())return;
    submitting=true;const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Изпращане…';
    root.querySelectorAll('button,input').forEach(e=>e.disabled=true);
    try {
      await queue;
      const data=Object.fromEntries(new FormData(form));
      data.acknowledge=form.elements.acknowledge.checked;data.checkout_key=cart.checkout_key;data.revision=cart.revision;
      const receipt=await request('api/checkout.php',data);
      form.reset();form.hidden=true;root.replaceChildren();summary.replaceChildren();
      const confirmation=node('section',undefined,'order-success');confirmation.setAttribute('tabindex','-1');
      confirmation.append(node('h1','Поръчката е приета'),node('p','Номер: '+receipt.order_number),node('p','Продукти с ДДС: '+money(receipt.total_cents)),node('p','Запазете номера. Ще се свържем с вас за наличност, доставка и начин на плащане. На този етап не е извършено плащане.'));
      const back=node('a','Продължи пазаруването','button');back.href='catalog.html';confirmation.append(back);root.append(confirmation);confirmation.focus();setStatus('');
      cart={...cart,items:[]};updateBadge();
    } catch(e) {
      setStatus(errors[e.message]||'Не успяхме да потвърдим поръчката. Опитайте отново.');
      if(e.message==='cart_changed'){try{await refresh();render();}catch(_){}}
    } finally {
      submitting=false;button.disabled=!cart?.can_checkout;button.textContent='Изпрати поръчка за потвърждение';root.querySelectorAll('button,input').forEach(e=>e.disabled=false);
    }
  });
  refresh().then(render).catch(()=>{if(root){root.textContent='Количката временно не е достъпна.';form.hidden=true;}tell('Не можем да заредим количката. Презаредете страницата.');});
})();

(() => {
  'use strict';
  const $=id=>document.getElementById(id),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const labels={new:'Нова',confirmed:'Потвърдена',processing:'Подготвя се',shipped:'Изпратена',completed:'Приключена',cancelled:'Отказана'};
  const money=c=>(Number(c)/100).toLocaleString('bg-BG',{style:'currency',currency:'EUR'});
  let csrf='',page=1,current=null;
  async function req(url,data){const options={cache:'no-store',credentials:'same-origin'};if(data){options.method='POST';options.headers={'Content-Type':'application/json','X-CSRF-Token':csrf};options.body=JSON.stringify(data);}const r=await fetch(url,options),d=await r.json();if(!r.ok)throw Error(d.error);return d;}
  function error(e){$('status').textContent=['authentication_required','forbidden','session_expired'].includes(e.message)?'Необходим е администраторски вход. Влезте от страницата за вход.':'Неуспешна операция. Опитайте отново.';}
  async function open(id){
    const data=await req('api/admin-orders.php?id='+id);if(current!==id)return;
    const o=data.order,root=$('detail');root.replaceChildren(node('h2',o.order_number));
    for(const text of [o.customer_name,'Имейл: '+o.email,'Телефон: '+o.phone,'Адрес: '+o.city+', '+o.address,'Бележка: '+(o.notes||'—'),'Създадена: '+o.created_at+' (сървърно време)'])root.append(node('p',text));
    for(const p of data.items){const row=node('div');row.className='order-item';row.append(node('strong',p.name),node('p',p.code+' · '+p.quantity+' × '+money(p.unit_cents)+' без ДДС'),node('p',money(p.line_cents)+' без ДДС'));root.append(row);}
    root.append(node('p','Без ДДС: '+money(o.subtotal_cents)),node('p','ДДС: '+money(o.vat_cents)),node('strong','Продукти с ДДС: '+money(o.total_cents)),node('p','Доставката и плащането се уточняват с клиента.'));
    const label=node('label','Статус '),select=node('select');select.setAttribute('aria-label','Статус на поръчката');for(const [key,text] of Object.entries(labels)){const option=new Option(text,key);select.add(option);}select.value=o.status;label.append(select);const save=node('button','Запази статуса');save.type='button';
    save.onclick=async()=>{save.disabled=true;try{await req('api/admin-orders.php',{id:Number(id),status:select.value});$('status').textContent='Статусът е запазен.';await list();}catch(e){error(e);}finally{save.disabled=false;}};
    const actions=node('div');actions.className='actions';actions.append(label,save);root.append(actions);
  }
  async function list(){const data=await req('api/admin-orders.php?page='+page);$('orders').replaceChildren();for(const o of data.orders){const b=node('button');b.type='button';b.append(node('strong',o.order_number),node('div',o.customer_name),node('div',money(o.total_cents)+' · '+labels[o.status]),node('small',o.created_at));b.onclick=()=>{current=Number(o.id);open(current).catch(error);};$('orders').append(b);}if(!data.orders.length)$('orders').append(node('p','Все още няма поръчки.'));$('page').textContent='Страница '+page+' · '+data.total+' поръчки';$('prev').disabled=page<=1;$('next').disabled=page*30>=data.total;}
  $('reload').onclick=()=>list().catch(error);$('prev').onclick=()=>{page=Math.max(1,page-1);list().catch(error);};$('next').onclick=()=>{page++;list().catch(error);};
  (async()=>{try{const s=await req('api/account-draft.php?action=session');if(s.user?.role!=='admin'){const a=node('a','Вход в профила');a.href='auth.html';$('status').replaceChildren(node('span','Необходим е администраторски вход. '),a);return;}csrf=s.csrf;await list();$('orders-app').hidden=false;$('status').textContent='Поръчките се записват в базата на магазина.';}catch(e){error(e);}})();
})();

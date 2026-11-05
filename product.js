(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const id = new URLSearchParams(location.search).get('id');
  const money = price => Number(price).toLocaleString('bg-BG', {style:'currency',currency:'EUR'});
  function row(label, value) {
    const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');
    th.scope='row';th.textContent=label;td.textContent=value;tr.append(th,td);$('specs').append(tr);
  }
  async function load() {
    if(!id || !/^[1-9][0-9]*$/.test(id)) {$('status').textContent='Невалиден продукт. Изберете артикул от каталога.';return;}
    try {
      const r=await fetch('api/product-details.php?id='+encodeURIComponent(id),{cache:'no-store'});
      if(r.status===404){$('status').textContent='Този продукт вече не се предлага.';return;}
      if(!r.ok)throw Error();
      const data=await r.json(),p=data.product;
      document.title=p.name+' | PDG Systems';$('name').textContent=p.name;
      $('category').textContent=p.brand+' · '+p.category;$('code').textContent='Код: '+p.code;
      $('description').textContent=p.description||'';$('description-section').hidden=!p.description;
      $('image-caption').textContent=p.imageCaption||(p.imageUrl?'Изображение на продуктовата серия.':'');
      $('image-caption').hidden=!$('image-caption').textContent;
      const imageIndex=Number(p.imageIndex);
      if(p.imageUrl && /^https?:\/\//i.test(p.imageUrl)) {
        const img=document.createElement('img');img.className='product-image';img.src=p.imageUrl;img.alt=p.name;img.referrerPolicy='no-referrer';
        img.onerror=()=>{$('photo').textContent='Снимката временно не е достъпна';};$('photo').append(img);
      } else if(p.imageIndex!==null && Number.isInteger(imageIndex) && imageIndex>=0) {
        const photo=document.createElement('div');photo.className='sprite';photo.style.backgroundPosition=(-150*(imageIndex%10))+'px '+(-150*Math.floor(imageIndex/10))+'px';photo.setAttribute('role','img');photo.setAttribute('aria-label',p.name);$('photo').append(photo);
      } else {$('photo').textContent='Снимка предстои';}
      if(Number(p.price)>0) {
        $('price').textContent=money(p.price)+' без ДДС';$('vat').textContent=money(Number(p.price)*1.2)+' с ДДС';$('buy').hidden=false;
        $('add').onclick=async()=>{if(!$('quantity').reportValidity())return;$('add').disabled=true;try{await window.PDGStore.add(p.id,Number($('quantity').value));}catch(e){}finally{$('add').disabled=false;}};
      } else {$('price').textContent='Цена по запитване';$('inquiry').hidden=false;}
      row('Производител',p.brand);row('Категория',p.category);row('Код на продукта',p.code);
      for(const f of data.fields)row(f.label,f.value);
      $('empty').hidden=data.fields.length>0;$('status').hidden=true;$('product').hidden=false;
    } catch(e) {$('status').textContent='Продуктът временно не може да се зареди. Презаредете страницата, за да опитате отново.';}
  }
  load();
})();

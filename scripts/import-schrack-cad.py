"""Import public Schrack product facts; never infer a price from logged-out zeros."""
import concurrent.futures,html,json,re,urllib.request,urllib.parse
from pathlib import Path
ROOT='https://www.schrack.bg/shop/'
OUT=Path('database/electrical-catalog.json')
CACHE=Path('/tmp/pdg-schrack-cache');CACHE.mkdir(exist_ok=True)
def get(url):
 path=CACHE/(str(__import__('hashlib').sha256(url.encode()).hexdigest())+'.html')
 if path.exists():return path.read_text()
 req=urllib.request.Request(url,headers={'User-Agent':'PDG catalog data import; public product specification retrieval'})
 s=urllib.request.urlopen(req,timeout=35).read().decode('utf-8');path.write_text(s);return s
def links(s):return sorted(set(html.unescape(u) for u in re.findall(r'href=[\'\"](https://www\.schrack\.bg/shop/[^\'\"<> ]+)',s)))
def clean(s):return html.unescape(re.sub('<[^>]+>',' ',s)).strip()
def facts(url):
 try:
  s=get(url);title=re.search(r'itemprop="name" content="([^"]+)"',s)
  if not title:return None
  name=' '.join(clean(title[1]).split());m=re.search(r'Артикул\s*#:\s*(?:<[^>]+>\s*)*([A-Z0-9-]{6,20})',s)
  if not m:return None
  sku=m[1];attrs={clean(k):' '.join(clean(v).split()) for k,v in re.findall(r'<tr[^>]*>\s*<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>\s*</tr>',s,re.S)}
  def num(k):
   z=re.search(r'[0-9]+(?:[,.][0-9]+)?',attrs.get(k,''));return float(z[0].replace(',','.')) if z else None
  width,height,depth=num('Нето широчина'),num('Нето височина'),num('Дълбочина')
  if not width or not height or not depth:return None
  isbox='табло' in name.lower() and width>=200 and height>=200
  if not isbox and not any(w in name.lower() for w in ['прекъсвач','дефектноток','контактор','отводител']):return None
  typ='ENCLOSURE' if isbox else 'RCD' if 'дефектноток' in name.lower() else 'CONTACT' if 'контактор' in name.lower() else 'MCB'
  photo=re.search(r'<img[^>]+id=[\'\"]desktop-large-img[\'\"][^>]+src=[\'\"]([^\'\"]+)',s)
  if not photo:photo=re.search(r'https://image\.schrackcdn\.com/(?:foto|340x380)/f_[^\s\'\"<>]+\.jpg',s)
  img=html.unescape(photo[1] if photo and photo.lastindex else photo[0]) if photo else ''
  return dict(sku=sku,name=name,manufacturer='Schrack Technik',category='Табла и корпуси' if isbox else 'DIN апаратура',type=typ,modules=__import__('math').ceil(width/18) if not isbox else 0,widthMm=width,heightMm=height,depthMm=depth,rating=attrs.get('Криви на изключване','')+attrs.get('Номинален ток',''),ean=attrs.get('EAN-Code',''),imageUrl=img,sourceUrl=url,poles=int(num('Полюси') or 1),unitPrice=None,currency='EUR',specifications=attrs)
 except Exception as e:return {'error':url,'reason':type(e).__name__}
seeds=[
'miniatjuren-avtomatichen-preksvach-c-16-1-6ka-bm617116.html',
'miniatjuren-avtomatichen-preksvach-b-16-1-6ka-bm618116.html',
'miniatjuren-avtomatichen-preksvach-c-16-1-10ka-bm017116.html',
'miniatjuren-avtomatichen-preksvach-c-16-2-6ka-bm617216.html',
'miniatjuren-avtomatichen-preksvach-b-16-1-10ka-bm018116.html',
'defektnotokova-zashchita-40a-2r-30ma-tip-a-10ka-bc054203.html',
'defektnotokova-zashchita-40a-4r-30ma-tip-a-10ka-bc054103.html',
'zashchitna-i-komutacionna-aparatura-i-elektrorazpredelenie/zashchitni-ustroistva-i-aksesoari/miniatjurni-avtomatichni-preksvachi/miniatjurni-avt-preksvachi-serija-bms6-6ka/miniatjuren-avtomatichen-preksvach-c-32-3-6ka-bm617332.html',
'zashchitna-i-komutacionna-aparatura-i-elektrorazpredelenie/kontaktori-i-motorni-zashchiti/modulni-kontaktori-ac-1/modulni-kontaktori-ac-1/modulen-kontaktor-20a-1no-230vac-bz326471.html',
'razpredelitelno-tablo-modulno-1m-24k-1105x330x200-mm-il172124ms.html',
'razpr-tablo-za-stenen-montazh-4-reda-48-modula-bez-vrata-bk003124.html',
'metalno-tablo-za-stenen-m-zh-s-1-vrata-ip66-800x600x260mm-wsa8060260.html']
products={};fail=[];seen=set();todo=[ROOT+s for s in seeds]
def work(u):
 p=facts(u)
 if p and 'sku' in p:
  candidates=[v for v in links(get(u)) if re.search(r'(?:miniatjuren-avtomatichen|defektnotokova-zashchita|modulen-kontaktor|metalno-tablo|modulno-tablo|razpr-tablo)[^/]*-[a-z]{2}[a-z0-9-]+\.html$',v)]
  return u,p,candidates
 return u,p,[]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for level in range(3):
  current=list(dict.fromkeys(todo))[:90];todo=[];seen.update(current)
  for u,p,more in pool.map(work,current):
   if p and 'sku' in p:products[p['sku']]=p
   elif p:fail.append(p)
   todo.extend(v for v in more if v not in seen)
  print('Pass',level+1,'verified',len(products),'further links',len(set(todo)),flush=True)
  if not todo:break
OUT.write_text(json.dumps({'source':'Schrack Technik Bulgaria public catalogue','importedAt':'2026-11-05','products':sorted(products.values(),key=lambda p:p['sku'])},ensure_ascii=False,separators=(',',':')))
Path('/tmp/pdg-schrack-import-errors.json').write_text(json.dumps(fail));print('Imported',len(products),'failures',len(fail),flush=True)

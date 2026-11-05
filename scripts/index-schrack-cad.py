"""Index official public product URLs; detailed facts are loaded only on demand."""
import json,re,time,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
base='https://www.schrack.bg/shop/'
def locs(url):
 with urllib.request.urlopen(url,timeout=60) as r:return [e.text for e in ET.fromstring(r.read()).iter() if e.tag.endswith('}loc') and e.text]
index={}
for url in locs(base+'sitemap.xml'):
 if not re.fullmatch(re.escape(base)+r'sitemap-\d+\.xml',url):continue
 time.sleep(5)
 for p in locs(url):
  if not p.startswith(base):continue
  slug=p.rsplit('/',1)[-1]
  if not re.match(r'(?:miniatjuren-avtomatichen-preksvach|defektnotokova-zashchita|modulen-kontaktor|metalno-tablo|modulno-tablo|razpr-tablo|razpredelitelno-tablo-modulno)',slug):continue
  m=re.search(r'-([a-z]{2,4}\d[a-z0-9-]{3,18})\.html$',slug)
  if m:index.setdefault(re.sub('[^A-Z0-9]','',m[1].upper()),p)
 print(url.rsplit('/',1)[-1],len(index),flush=True)
Path('database/electrical-source-index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')))
print('Indexed',len(index),'official article URLs')

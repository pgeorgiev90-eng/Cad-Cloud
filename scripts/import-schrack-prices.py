"""Read reference unit prices from Schrack BG's June 2026 public workbook."""
from decimal import Decimal,ROUND_HALF_UP
from pathlib import Path
import json,re,sys,openpyxl
root=Path('database')
book=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=False)
visible=book['Спецификация'];assert '06.2026' in visible['A1'].value and '€' in visible['E8'].value and 'без ДДС' in visible['G8'].value
# The visible EUR estimate looks up AW:BD column 5 directly, with zero default discount.
assert "'Sheet 1'!AW:BD,5,0" in visible['E9'].value and visible['I6'].value==0
book.close()
source=openpyxl.load_workbook(sys.argv[1],read_only=True,data_only=True)['Sheet 1']
key=lambda v:re.sub('[^A-Z0-9]','',v.upper())
items=json.loads((root/'electrical-catalog.json').read_text())['products'];codes=set(json.loads((root/'electrical-source-index.json').read_text()))|{key(p['sku']) for p in items}
profiles={'IS505068--':(20,5,2),'IS505069--':(30,5,2),'IS505087--':(30,10,2),'IS505119--':(10,3,2),'IS505114--':(40,10,2),'IS505115--':(50,10,2),'IS505116--':(60,10,2),'IS505117--':(80,10,2),'IS505121--':(100,10,2),'IS505122--':(40,5,2)}
prices={};rates={}
for sku,_,_,name,price,_,_,unit in source.iter_rows(min_col=49,max_col=56,values_only=True):
 if not isinstance(sku,str) or not isinstance(price,(int,float)) or price<=0 or unit!=1:continue
 cents=Decimal(str(price))*100;k=key(sku)
 if k in codes:
  n=int(cents.quantize(Decimal('1'),rounding=ROUND_HALF_UP))
  if k in prices and prices[k]!=n:raise ValueError('Conflicting SKU '+k)
  prices[k]=n
 if sku in profiles:
  w,t,metres=profiles[sku];rates[f'{w:.2f}x{t:.2f}']={'sku':sku,'width_mm':w,'thickness_mm':t,'price_per_m_cents':int((cents/metres).quantize(Decimal('1'),rounding=ROUND_HALF_UP))}
assert prices['BM617116']==376 and prices['WSA8060260']==20640 and rates['20.00x5.00']['price_per_m_cents']==2492
out={'source':'Schrack Technik Bulgaria, ценова листа 06.2026','sourceUrl':'https://www.schrack.bg/dokumenti/cenova-lista','date':'2026-06','currency':'EUR','vatIncluded':False,'products':prices,'busbarRates':rates}
(root/'electrical-reference-prices.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')))
print(len(prices),'article prices,',len(rates),'busbar profiles')

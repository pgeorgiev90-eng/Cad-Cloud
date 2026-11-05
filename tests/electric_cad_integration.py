"""Isolated MySQL/PHP test. All prices and contacts are test fixtures."""
import http.cookiejar,json,urllib.error,urllib.request
BASE='http://127.0.0.1:8199/'
class Policy(http.cookiejar.DefaultCookiePolicy):
 def return_ok_secure(self,cookie,request):return True
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar(policy=Policy())))
def request(c,path,payload=None,csrf=None):
 headers={'Content-Type':'application/json'} if payload is not None else {}
 if csrf:headers['X-CSRF-Token']=csrf
 r=urllib.request.Request(BASE+path,data=json.dumps(payload).encode() if payload is not None else None,headers=headers)
 try:
  with c.open(r,timeout=15) as x:return x.status,json.load(x)
 except urllib.error.HTTPError as x:return x.code,json.load(x)
def login(email,password):
 c=client();_,s=request(c,'api/account-draft.php?action=session');assert request(c,'api/account-draft.php?action=login',{'email':email,'password':password},s['csrf'])[0]==200
 return c,request(c,'api/account-draft.php?action=session')[1]['csrf']
a,csrf=login('new-admin@example.test','Longer-test-password-123');v=client();c,customer_csrf=login('new-customer@example.test','Customer-long-password-123')
assert request(v,'api/admin-electric.php')[0]==401
assert request(c,'api/admin-electric.php')[0]==403
assert request(c,'api/admin-electric.php',{'action':'labour','id':1,'price':'1'},customer_csrf)[0]==403
status,data=request(v,'api/electric-catalog.php?q=BM617116');assert status==200 and data['labour_included'] is False
p=next(p for p in data['products'] if p['sku']=='BM617116--');assert p['ean']=='9004840395877' and p['widthMm']==17.8 and p['unitPrice']==3.76 and p['priceSource']=='schrack_2026_06'
assert request(a,'api/admin-electric.php',{'action':'price','sku':p['sku'],'price':'7.50'})[0]==403
for payload in [{'action':'price','sku':p['sku'],'price':'7.50'},{'action':'price','sku':'WSA8060260','price':'130.00'},{'action':'rate','width':'20','thickness':'5','price':'25.00'}]:assert request(a,'api/admin-electric.php',payload,csrf)[0]==200
status,data=request(v,'api/electric-catalog.php?q=9004840395877');assert status==200 and data['products'][0]['unitPrice']==7.5
_,s=request(v,'api/electric-enquiries.php');payload={'request_key':s['request_key'],'name':'CI test','email':'electric-test@example.invalid','project':'CAD test','parts':[{'sku':'WSA8060260','quantity':1,'price':0},{'sku':p['sku'],'quantity':2,'price':0}],'busbars':[{'width':20,'thickness':5,'points':[{'x':0,'y':0,'z':0},{'x':100,'y':0,'z':0},{'x':100,'y':0,'z':100}]}],'labour_cents':1,'drawing':{'version':2,'items':[]}}
assert request(v,'api/electric-enquiries.php',payload)[0]==403
assert request(v,'api/electric-enquiries.php',{**payload,'parts':[{'sku':p['sku'],'quantity':1}]},s['csrf'])[0]==422
status,d=request(v,'api/electric-enquiries.php',payload,s['csrf']);assert status==201,d
q=d['quote'];assert q['materials_cents']==15000 and q['total_cents']==18000 and q['missing_prices']==0 and q['labour_included'] is False,q
assert request(v,'api/electric-enquiries.php',payload,s['csrf'])[1]['reference']==d['reference']
_,data=request(a,'api/admin-electric.php');enquiry=next(e for e in data['enquiries'] if e['public_ref']==d['reference']);assert enquiry['labour_cents'] is None
assert request(a,'api/admin-electric.php',{'action':'labour','id':int(enquiry['id']),'price':'85.00'},csrf)[0]==200
_,data=request(a,'api/admin-electric.php');enquiry=next(e for e in data['enquiries'] if e['public_ref']==d['reference']);assert int(enquiry['labour_cents'])==8500 and int(enquiry['materials_cents'])==15000 and enquiry['status']=='reviewed'
print('Electric CAD: idempotent catalog migration, SKU/EAN, canonical materials, depth bends, CSRF, duplicate requests and admin-only labour passed.')

import http.cookiejar,json,urllib.request,urllib.error
B='http://127.0.0.1:8199/'
class Policy(http.cookiejar.DefaultCookiePolicy):
 def return_ok_secure(self,cookie,request):return True
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar(policy=Policy())))
def req(c,path,data=None,csrf=None):
 h={}
 if data is not None:h['Content-Type']='application/json'
 if csrf:h['X-CSRF-Token']=csrf
 r=urllib.request.Request(B+path,data=json.dumps(data).encode() if data is not None else None,headers=h,method='POST' if data is not None else 'GET')
 try:
  with c.open(r,timeout=10) as x:return x.status,json.load(x)
 except urllib.error.HTTPError as x:return x.code,json.load(x)
def check(ok,msg):
 if not ok:raise AssertionError(msg)
a=client();_,s=req(a,'api/account-draft.php?action=session')
st,_=req(a,'api/account-draft.php?action=login',{'email':'new-admin@example.test','password':'Longer-test-password-123'},s['csrf']);check(st==200,'admin login')
_,s=req(a,'api/account-draft.php?action=session');ac=s['csrf']
st,_=req(a,'api/admin-dashboard-install.php',{},ac);check(st==200,'install order tables')
_,p=req(a,'api/admin-products-draft.php');product=next(x for x in p['products'] if x['code']=='TEST-1')
v=client();_,s=req(v,'api/account-draft.php?action=session');csrf=s['csrf']
data={'request_key':'a'*64,'name':'Test Customer','email':'customer@example.test','phone':'+359 888 123456','address':'Test address','note':'','items':[{'id':int(product['id']),'quantity':2,'unit_cents':1050}]}
st,_=req(v,'api/orders.php',data);check(st==403,'csrf required')
bad={**data,'items':[{'id':int(product['id']),'quantity':2,'unit_cents':1}]}
st,_=req(v,'api/orders.php',bad,csrf);check(st==409,'reject stale or forged price')
st,o=req(v,'api/orders.php',data,csrf);check(st==200 and o['order_id']>0,'submit order')
st,again=req(v,'api/orders.php',data,csrf);check(st==200 and again['order_id']==o['order_id'],'idempotency')
st,_=req(v,'api/admin-orders.php');check(st==401,'anonymous cannot read orders')
st,orders=req(a,'api/admin-orders.php');order=next(x for x in orders['orders'] if int(x['id'])==o['order_id'])
check(st==200 and int(order['subtotal_cents'])==2100 and int(order['vat_cents'])==420 and int(order['total_cents'])==2520,'vat calculation')
print('Orders: csrf, validation, price integrity, idempotency, access and VAT passed.')

import http.cookiejar,json,urllib.request,urllib.error
BASE='http://127.0.0.1:8199/'
class Policy(http.cookiejar.DefaultCookiePolicy):
 def return_ok_secure(self,cookie,request):return True
def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar(policy=Policy())))
def req(c,path,data=None,csrf=None):
 h={}
 if data is not None:h['Content-Type']='application/json'
 if csrf:h['X-CSRF-Token']=csrf
 r=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers=h,method='POST' if data is not None else 'GET')
 try:
  with c.open(r,timeout=10) as x:return x.status,json.load(x)
 except urllib.error.HTTPError as x:return x.code,json.load(x)
def check(x,m):
 if not x:raise AssertionError(m)
admin=client();_,s=req(admin,'api/account-draft.php?action=session')
st,_=req(admin,'api/account-draft.php?action=login',{'email':'new-admin@example.test','password':'Longer-test-password-123'},s['csrf']);check(st==200,'admin login')
_,s=req(admin,'api/account-draft.php?action=session');csrf=s['csrf']
st,_=req(client(),'api/admin-users.php');check(st==401,'anonymous admin access')
st,_=req(admin,'api/admin-dashboard-install.php',{});check(st==403,'installer csrf')
st,_=req(admin,'api/admin-dashboard-install.php',{},csrf);check(st==200,'install schema')
st,_=req(admin,'api/admin-dashboard-install.php',{},csrf);check(st==200,'install is repeatable')
st,users=req(admin,'api/admin-users.php');check(st==200,'list users')
customer=next(x for x in users['users'] if x['email']=='new-customer@example.test')
st,products=req(admin,'api/admin-products-draft.php');check(st==200 and len(products['products'])>0,'products')
pid=int(products['products'][0]['id'])
st,fields=req(admin,'api/admin-product-fields.php?product_id='+str(pid));check(st==200,'read fields')
payload={'product_id':pid,'version':fields['version'],'fields':[{'label':'Мощност','value':'10 kW'}]}
st,_=req(admin,'api/admin-product-fields.php',payload);check(st==403,'fields csrf')
st,_=req(admin,'api/admin-product-fields.php',payload,csrf);check(st==200,'save fields')
st,_=req(admin,'api/admin-product-fields.php',payload,csrf);check(st==409,'concurrent field update')
st,d=req(client(),'api/product-details.php?id='+str(pid));check(st==200 and d['fields'][0]['value']=='10 kW','public fields')
v=client();_,s=req(v,'api/account-draft.php?action=session');vc=s['csrf']
st,_=req(v,'api/product-view.php',{'action':'view','product_id':pid},vc);check(st==403,'consent required')
st,_=req(v,'api/product-view.php',{'action':'consent'},vc);check(st==200,'consent')
st,_=req(v,'api/product-view.php',{'action':'view','product_id':pid},vc);check(st==200,'record view')
st,stats=req(admin,'api/admin-stats.php');check(st==200 and stats['today']==1 and len(stats['live'])==1,'real stats')
check(len(stats['daily'])==7 and stats['daily'][-1]['visitors']==1 and all(x['visitors']==0 for x in stats['daily'][:-1]),'daily counts include empty days')
check(stats['popular'][0]['visitors']==1,'product visitor count')
st,_=req(client(),'api/admin-stats.php');check(st==401,'anonymous cannot read stats')
st,_=req(v,'api/product-view.php',{'action':'withdraw'},vc);check(st==200,'withdraw')
st,_=req(v,'api/product-view.php',{'action':'view','product_id':pid},vc);check(st==403,'withdraw enforced')
st,_=req(admin,'api/admin-users.php',{'id':int(customer['id']),'active':False},csrf);check(st==200,'disable customer')
c=client();_,s=req(c,'api/account-draft.php?action=session')
st,_=req(c,'api/account-draft.php?action=login',{'email':'new-customer@example.test','password':'Customer-long-password-123'},s['csrf']);check(st==401,'disabled customer cannot login')
st,_=req(admin,'api/admin-users.php',{'id':int(customer['id']),'active':True},csrf);check(st==200,'restore customer')
st,_=req(c,'api/account-draft.php?action=login',{'email':'new-customer@example.test','password':'Customer-long-password-123'},s['csrf']);check(st==200,'restored customer can login')
st,_=req(c,'api/admin-users.php');check(st==403,'customer forbidden admin users')
print('Dashboard: authorization, fields, consent, statistics and user management passed.')

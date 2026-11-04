import http.cookiejar, json, urllib.request, urllib.error
BASE='http://127.0.0.1:8199/'
class LocalTestCookiePolicy(http.cookiejar.DefaultCookiePolicy):
    def return_ok_secure(self, cookie, request): return True

def client():
    jar=http.cookiejar.CookieJar(policy=LocalTestCookiePolicy())
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(opener,path,data=None,csrf=None):
    headers={}
    if data is not None: headers['Content-Type']='application/json'
    if csrf: headers['X-CSRF-Token']=csrf
    req=urllib.request.Request(BASE+path, data=None if data is None else json.dumps(data).encode(), headers=headers, method='GET' if data is None else 'POST')
    try:
        with opener.open(req,timeout=10) as response: return response.status,json.load(response)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
def check(condition,message):
    if not condition: raise AssertionError(message)
admin=client()
status,body=request(admin,'api/account-draft.php?action=session')
check(status==200 and body['user'] is None,'new session')
csrf=body['csrf']
status,_=request(admin,'api/account-draft.php?action=login',{'email':'admin@example.test','password':'Admin-test-123456'})
check(status==403,'login without CSRF must fail')
status,body=request(admin,'api/account-draft.php?action=login',{'email':'admin@example.test','password':'wrong-password'},csrf)
check(status==401,'incorrect password must fail')
status,body=request(admin,'api/account-draft.php?action=login',{'email':'admin@example.test','password':'Admin-test-123456'},csrf)
check(status==200 and body['user']['role']=='admin','admin login')
status,body=request(admin,'api/account-draft.php?action=session')
admin_csrf=body['csrf']
status,body=request(admin,'api/admin-products-draft.php')
check(status==200 and isinstance(body['products'],list),'admin read')
product={'brand':'Test','category':'Test','code':'TEST-1','name':'Test item','price':'10.50','active':True}
status,_=request(admin,'api/admin-products-draft.php',product)
check(status==403,'admin writes require CSRF')
status,body=request(admin,'api/admin-products-draft.php',product,admin_csrf)
check(status==200 and body['ok'],'admin create')
customer=client()
_,body=request(customer,'api/account-draft.php?action=session')
status,body=request(customer,'api/account-draft.php?action=login',{'email':'customer@example.test','password':'Customer-test-123456'},body['csrf'])
check(status==200 and body['user']['role']=='customer','customer login')
status,_=request(customer,'api/admin-products-draft.php')
check(status==403,'customer must not access admin')
status,_=request(client(),'api/admin-products-draft.php')
check(status==401,'anonymous must not access admin')
status,_=request(admin,'api/account-draft.php?action=logout',{},admin_csrf)
check(status==200,'logout')
status,_=request(admin,'api/admin-products-draft.php')
check(status==401,'logout revokes session')
print('Account and role checks passed.')

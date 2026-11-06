import http.cookiejar, json, urllib.request, urllib.error, subprocess, re
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
def check_editor_access(opener, authenticated):
    for editor in ['roof-cad.php', 'electrical-cad.php']:
        with opener.open(BASE+editor, timeout=10) as response:
            if authenticated:
                check(response.geturl()==BASE+editor, 'authenticated CAD editor access')
                check(b'id="save-account-project"' in response.read(), 'CAD editor was rendered')
            else:
                check(response.geturl()==BASE+'auth.html?next='+editor, 'guest CAD redirects to login')

check_editor_access(client(), False)
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
setup=client()
_,body=request(setup,'api/account-draft.php?action=session')
setup_csrf=body['csrf']
details={'setup_secret':'wrong-secret','email':'new-admin@example.test','password':'Longer-test-password-123'}
status,_=request(setup,'api/setup-admin-draft.php',details,setup_csrf)
check(status==403,'wrong setup secret must fail')
details['setup_secret']='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
status,_=request(setup,'api/setup-admin-draft.php',details,setup_csrf)
check(status==409,'setup must not overwrite existing accounts')
subprocess.run(['php','tests/reset-setup-ci.php'],check=True)
status,body=request(setup,'api/setup-admin-draft.php',details,setup_csrf)
check(status==200 and body['ok'],'initial setup')
status,_=request(setup,'api/setup-admin-draft.php',details,setup_csrf)
check(status==409,'setup must be one-time')
_,body=request(setup,'api/account-draft.php?action=session')
status,body=request(setup,'api/account-draft.php?action=login',{'email':'new-admin@example.test','password':'Longer-test-password-123'},body['csrf'])
check(status==200 and body['user']['role']=='admin','new admin login')
visitor=client()
_,body=request(visitor,'api/account-draft.php?action=session')
visitor_csrf=body['csrf']
registration={'email':'new-customer@example.test','password':'Customer-long-password-123'}
status,_=request(visitor,'api/registration-draft.php?action=register',registration)
check(status==403,'registration requires CSRF')
status,body=request(visitor,'api/registration-draft.php?action=register',registration,visitor_csrf)
check(status==200 and body['ok'],'registration')
status,_=request(visitor,'api/account-draft.php?action=login',registration,visitor_csrf)
check(status==401,'unverified account must not log in')
message=open('/tmp/pdg-captured-mail.txt',encoding='utf-8').read()
match=re.search(r'#token=([a-f0-9]{64})',message)
check(bool(match),'confirmation email must contain token')
status,_=request(visitor,'api/registration-draft.php?action=verify',{'token':'a'*64},visitor_csrf)
check(status==400,'incorrect verification token must fail')
status,body=request(visitor,'api/registration-draft.php?action=verify',{'token':match.group(1),'password':registration['password']},visitor_csrf)
check(status==200 and body['ok'],'email confirmation')
status,_=request(visitor,'api/registration-draft.php?action=verify',{'token':match.group(1),'password':registration['password']},visitor_csrf)
check(status==400,'verification token must be one-time')
status,body=request(visitor,'api/account-draft.php?action=login',registration,visitor_csrf)
check(status==200 and body['user']['role']=='customer','verified customer login')
check_editor_access(visitor, True)
print('Login, admin authorization, setup and email verification checks passed.')

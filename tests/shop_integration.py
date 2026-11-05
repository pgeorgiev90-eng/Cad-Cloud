import json
import subprocess
import urllib.request
import urllib.error
import http.cookiejar

BASE = 'http://127.0.0.1:8091/'
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def api(path, data=None, csrf=None, expected=200):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
        if csrf is not None:
            headers['X-CSRF-Token'] = csrf
    request = urllib.request.Request(BASE + path, data=None if data is None else json.dumps(data).encode(), headers=headers)
    try:
        response = client.open(request)
    except urllib.error.HTTPError as error:
        response = error
    result = json.load(response)
    # Isolated HTTP test server simulates HTTPS in the PHP router.
    for cookie in jar:
        cookie.secure = False
    assert response.code == expected, (path, response.code, result)
    return result

def sql(statement):
    # Only fixed CI fixture statements are accepted here.
    code = '$s=require dirname(getcwd())."/pdg-shop-db.php";$d=new PDO("mysql:host=".$s["host"].";dbname=".$s["database"],$s["username"],$s["password"]);$d->exec($argv[1]);'
    subprocess.run(['php', '-r', code, statement], check=True)

cart = api('api/cart.php')
assert cart['items'] == [] and not cart['can_checkout']
csrf = cart['csrf']
api('api/cart.php', {'action':'add','id':1,'quantity':1}, 'wrong', 403)
for quantity in [0, -1, 1000, 1.2, '2']:
    api('api/cart.php', {'action':'add','id':1,'quantity':quantity}, csrf, 422)
cart = api('api/cart.php', {'action':'add','id':1,'quantity':2}, csrf)
assert cart['subtotal_cents'] == 688 and cart['vat_cents'] == 138 and cart['total_cents'] == 826
cart = api('api/cart.php', {'action':'add','id':1,'quantity':1}, csrf)
assert cart['items'][0]['quantity'] == 3
cart = api('api/cart.php', {'action':'set','id':1,'quantity':2}, csrf)
api('api/cart.php', {'action':'add','id':2,'quantity':1}, csrf, 422)
customer = dict(name='CI Test Customer', email='test@example.invalid', phone='+359888123456', city='Sofia', address='CI address', notes='automated isolated test', acknowledge=True)
payload = {**customer, 'checkout_key':cart['checkout_key'], 'revision':cart['revision'], 'total_cents':1}
api('api/checkout.php', {**payload,'acknowledge':False}, csrf, 422)
sql('UPDATE products SET price=4.00 WHERE id=1')
api('api/checkout.php', payload, csrf, 409)
sql('UPDATE products SET active=0 WHERE id=1')
unavailable = api('api/cart.php')
assert not unavailable['can_checkout']
api('api/checkout.php', {**payload,'revision':unavailable['revision']}, csrf, 409)
sql('UPDATE products SET active=1,price=3.44 WHERE id=1')
cart = api('api/cart.php')
payload.update(checkout_key=cart['checkout_key'],revision=cart['revision'])
receipt = api('api/checkout.php', payload, csrf)
assert receipt['ok'] and receipt['total_cents'] == 826
retry = api('api/checkout.php', payload, csrf)
assert retry == receipt
assert not api('api/cart.php')['items']
api('api/admin-orders.php', expected=401)
sql("UPDATE pdg_orders SET status='confirmed' WHERE order_number='" + receipt['order_number'] + "'")
code = '$s=require dirname(getcwd())."/pdg-shop-db.php";$d=new PDO("mysql:host=".$s["host"].";dbname=".$s["database"],$s["username"],$s["password"]);$o=$d->query("SELECT * FROM pdg_orders")->fetchAll(PDO::FETCH_ASSOC);$i=$d->query("SELECT * FROM pdg_order_items")->fetchAll(PDO::FETCH_ASSOC);echo json_encode([$o,$i]);'
orders, items = json.loads(subprocess.check_output(['php','-r',code]))
assert len(orders) == 1 and len(items) == 1
assert int(orders[0]['total_cents']) == 826 and int(items[0]['quantity']) == 2 and int(items[0]['unit_cents']) == 344
assert orders[0]['customer_name'] == customer['name']
print('PASS: CSRF, quantities, server pricing/VAT, price changes, disabled products, checkout persistence, retry deduplication, admin access')

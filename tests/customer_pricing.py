"""Account-scoped catalogue and cart prices against an isolated database."""
import http.cookiejar
import json
import urllib.error
import urllib.request

BASE = 'http://127.0.0.1:8199/'


class TestCookiePolicy(http.cookiejar.DefaultCookiePolicy):
    def return_ok_secure(self, cookie, request):
        return True


def client():
    jar = http.cookiejar.CookieJar(policy=TestCookiePolicy())
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def api(browser, path, expected=200, data=None, csrf=None):
    headers = {'Content-Type': 'application/json'} if data is not None else {}
    if csrf:
        headers['X-CSRF-Token'] = csrf
    req = urllib.request.Request(BASE + path, headers=headers,
                                 data=None if data is None else json.dumps(data).encode())
    try:
        response = browser.open(req, timeout=20)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        result = json.load(response)
        assert response.code == expected, (path, response.code, result)
        return result


def login(email, password):
    browser = client()
    csrf = api(browser, 'api/account-draft.php?action=session')['csrf']
    api(browser, 'api/account-draft.php?action=login', data={'email': email, 'password': password}, csrf=csrf)
    return browser, api(browser, 'api/account-draft.php?action=session')['csrf']


guest = client()
listing = api(guest, 'api/products.php')
assert not listing['prices_visible'] and all(row['price'] is None for row in listing['products'])
product = next(row for row in listing['products'] if row['code'] == 'PRICING-CI')
path = f"api/product-details.php?id={product['id']}"
assert api(guest, path)['product']['price'] is None
assert not api(guest, 'api/electric-catalog.php')['busbarRates']
api(guest, 'api/cart.php', 401)
api(guest, 'api/checkout.php', 401, {})
customer, customer_csrf = login('customer@example.test', 'Customer-test-123456')
admin, admin_csrf = login('admin@example.test', 'Admin-test-123456')
assert api(customer, path)['product']['price'] == '100.00'
user_id = int(next(row['id'] for row in api(admin, 'api/admin-users.php')['users'] if row['role'] == 'customer'))
endpoint = 'api/admin-users.php'
api(customer, endpoint, 403, {'id': user_id, 'discount_bp': 5000}, customer_csrf)
api(admin, endpoint, 422, {'id': user_id, 'discount_bp': 10001}, admin_csrf)
api(admin, endpoint, data={'id': user_id, 'discount_bp': 1250}, csrf=admin_csrf)
assert api(customer, path)['product']['price'] == '87.50'
assert api(admin, path)['product']['price'] == '100.00'
cart = api(customer, 'api/cart.php')
cart = api(customer, 'api/cart.php', data={'action': 'add', 'id': int(product['id']), 'quantity': 2}, csrf=cart['csrf'])
assert cart['items'][0]['unit_cents'] == 8750 and cart['subtotal_cents'] == 17500 and cart['total_cents'] == 21000
checkout = dict(name='Test Customer', email='customer@example.test', phone='+359888123456', city='Sofia',
                address='CI address', acknowledge=True, checkout_key=cart['checkout_key'], revision=cart['revision'])
api(admin, endpoint, data={'id': user_id, 'discount_bp': 1000}, csrf=admin_csrf)
api(customer, 'api/checkout.php', 409, checkout, cart['csrf'])
cart = api(customer, 'api/cart.php')
checkout['revision'] = cart['revision']
assert api(customer, 'api/checkout.php', data=checkout, csrf=cart['csrf'])['total_cents'] == 21600
api(admin, endpoint, data={'id': user_id, 'active': False}, csrf=admin_csrf)
assert api(customer, path)['product']['price'] is None
api(customer, 'api/cart.php', 401)
print('PASS guest privacy, admin-only discounts, cart totals, checkout repricing and blocked account.')

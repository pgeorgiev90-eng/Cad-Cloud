<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function shop_answer(int $status, array $body): void {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function shop_db(): PDO {
    $file = dirname(__DIR__, 2) . '/pdg-shop-db.php';
    if (!is_file($file)) throw new RuntimeException('configuration');
    $s = require $file;
    if (!is_array($s)) throw new RuntimeException('configuration');
    return new PDO('mysql:host='.($s['host']??'localhost').';dbname='.($s['database']??'').';charset=utf8mb4', $s['username']??'', $s['password']??'', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
}
function shop_session(): void {
    if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off') shop_answer(400, ['error'=>'https_required']);
    ini_set('session.use_strict_mode','1');
    ini_set('session.use_only_cookies','1');
    session_name('PDGCART');
    session_set_cookie_params(['lifetime'=>0, 'path'=>'/', 'secure'=>true, 'httponly'=>true, 'samesite'=>'Lax']);
    session_start();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32));
    if (!isset($_SESSION['cart'])) $_SESSION['cart']=[];
    if (empty($_SESSION['checkout_key'])) $_SESSION['checkout_key']=bin2hex(random_bytes(32));
}
function shop_input(): array {
    if ($_SERVER['REQUEST_METHOD']!=='POST') shop_answer(405,['error'=>'method_not_allowed']);
    if (!hash_equals($_SESSION['csrf']??'', (string)($_SERVER['HTTP_X_CSRF_TOKEN']??''))) shop_answer(403,['error'=>'invalid_request']);
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>16384) shop_answer(413,['error'=>'request_too_large']);
    $raw=file_get_contents('php://input', false, null, 0, 16385);
    if (strlen($raw)>16384) shop_answer(413,['error'=>'request_too_large']);
    $input=json_decode($raw,true);
    if (!is_array($input)) shop_answer(422,['error'=>'invalid_input']);
    return $input;
}
function shop_cents($price): ?int {
    if (!is_string($price) || !preg_match('/^(\d{1,10})(?:\.(\d{1,2}))?$/D',$price,$m)) return null;
    $cents=(int)$m[1]*100+(int)str_pad($m[2]??'',2,'0');
    return $cents>0 ? $cents : null;
}
function shop_quote(PDO $db): array {
    $items=[]; $subtotal=0; $unavailable=false;
    $ids=array_keys($_SESSION['cart']);
    if ($ids) {
        $q=$db->prepare('SELECT id,code,name,price,active FROM products WHERE id IN ('.implode(',',array_fill(0,count($ids),'?')).')');
        $q->execute($ids); $rows=[];
        foreach ($q->fetchAll() as $row) $rows[(int)$row['id']]=$row;
        foreach ($_SESSION['cart'] as $id=>$quantity) {
            $p=$rows[$id]??null;
            $unit=$p && (int)$p['active']===1 ? shop_cents($p['price']) : null;
            $line=$unit===null ? 0 : $unit*$quantity;
            if ($unit===null) $unavailable=true;
            $items[]=['id'=>(int)$id,'code'=>$p['code']??'', 'name'=>$p['name']??'Продуктът вече не е достъпен', 'quantity'=>$quantity,'unit_cents'=>$unit,'line_cents'=>$line,'available'=>$unit!==null];
            $subtotal+=$line;
        }
    }
    $vat=intdiv($subtotal*20+50,100);
    $quote=['items'=>$items,'subtotal_cents'=>$subtotal,'vat_cents'=>$vat,'total_cents'=>$subtotal+$vat,'currency'=>'EUR','can_checkout'=>count($items)>0&&!$unavailable];
    $quote['revision']=hash('sha256',json_encode($quote));
    $quote['csrf']=$_SESSION['csrf'];
    $quote['checkout_key']=$_SESSION['checkout_key'];
    return $quote;
}

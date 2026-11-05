<?php
declare(strict_types=1);
require __DIR__.'/shop-common.php';
shop_session();
try {
    $input=shop_input();
    $db=shop_db();
    $key=$input['checkout_key']??'';
    if (!is_string($key)||!preg_match('/^[a-f0-9]{64}$/D',$key)) shop_answer(422,['error'=>'invalid_input']);
    // A retry of the same successful submission returns the same receipt.
    if (isset($_SESSION['last_order']) && hash_equals($_SESSION['last_order']['key'],$key)) shop_answer(200,$_SESSION['last_order']['receipt']);
    if (!hash_equals($_SESSION['checkout_key'],$key)) shop_answer(409,['error'=>'cart_changed']);
    $limits=['name'=>120,'email'=>254,'phone'=>40,'city'=>120,'address'=>500,'notes'=>2000];$customer=[];
    foreach ($limits as $field=>$limit) {
        $value=$input[$field]??'';
        if (!is_string($value)||strlen($value)>$limit || ($field!=='notes'&&trim($value)==='') || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/',$value)) shop_answer(422,['error'=>'invalid_customer']);
        $customer[$field]=trim($value);
    }
    if (!filter_var($customer['email'],FILTER_VALIDATE_EMAIL)||!preg_match('/^[+0-9() .-]{6,40}$/D',$customer['phone'])||($input['acknowledge']??false)!==true) shop_answer(422,['error'=>'invalid_customer']);
    $db->exec(file_get_contents(dirname(__DIR__).'/database/orders-schema.sql'));
    // Serialize the per-IP counter independently of session cookies.
    $s=require dirname(__DIR__,2).'/pdg-shop-db.php';
    $ip=hash_hmac('sha256',(string)($_SERVER['REMOTE_ADDR']??''),(string)$s['password']);
    $db->beginTransaction();
    $q=$db->prepare('INSERT INTO pdg_checkout_limits (identifier_hash) VALUES (?) ON DUPLICATE KEY UPDATE identifier_hash=VALUES(identifier_hash)');$q->execute([$ip]);
    $q=$db->prepare('SELECT attempt_count,window_start < DATE_SUB(NOW(),INTERVAL 1 HOUR) AS expired FROM pdg_checkout_limits WHERE identifier_hash=? FOR UPDATE');$q->execute([$ip]);$rate=$q->fetch();
    if ((int)$rate['expired']===1) {$q=$db->prepare('UPDATE pdg_checkout_limits SET attempt_count=0,window_start=NOW() WHERE identifier_hash=?');$q->execute([$ip]);$rate['attempt_count']=0;}
    if ((int)$rate['attempt_count']>=10) {$db->rollBack();shop_answer(429,['error'=>'try_later']);}
    $q=$db->prepare('UPDATE pdg_checkout_limits SET attempt_count=attempt_count+1 WHERE identifier_hash=?');$q->execute([$ip]);
    // Lock product prices until the order and its immutable line snapshots commit.
    $ids=array_keys($_SESSION['cart']);
    if (!$ids) {$db->rollBack();shop_answer(422,['error'=>'empty_cart']);}
    $q=$db->prepare('SELECT id FROM products WHERE id IN ('.implode(',',array_fill(0,count($ids),'?')).') FOR UPDATE');$q->execute($ids);$q->fetchAll();
    $quote=shop_quote($db);
    if (!$quote['can_checkout']||!is_string($input['revision']??null)||!hash_equals($quote['revision'],$input['revision'])) {$db->rollBack();shop_answer(409,['error'=>'cart_changed']);}
    $number='PDG-'.gmdate('Ymd').'-'.strtoupper(bin2hex(random_bytes(5)));
    $request=hash('sha256',session_id().':'.$key);
    $q=$db->prepare('SELECT order_number,total_cents FROM pdg_orders WHERE request_key=?');$q->execute([$request]);$previous=$q->fetch();
    if (!$previous) {
        $q=$db->prepare('INSERT INTO pdg_orders (order_number,request_key,customer_name,email,phone,city,address,notes,subtotal_cents,vat_cents,total_cents) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        $q->execute([$number,$request,$customer['name'],$customer['email'],$customer['phone'],$customer['city'],$customer['address'],$customer['notes'],$quote['subtotal_cents'],$quote['vat_cents'],$quote['total_cents']]);
        $id=(int)$db->lastInsertId();
        $q=$db->prepare('INSERT INTO pdg_order_items (order_id,product_id,code,name,quantity,unit_cents,line_cents) VALUES (?,?,?,?,?,?,?)');
        foreach ($quote['items'] as $item) $q->execute([$id,$item['id'],$item['code'],$item['name'],$item['quantity'],$item['unit_cents'],$item['line_cents']]);
    } else {$number=$previous['order_number'];$quote['total_cents']=(int)$previous['total_cents'];}
    $db->commit();
    $receipt=['ok'=>true,'order_number'=>$number,'total_cents'=>$quote['total_cents'],'currency'=>'EUR'];
    $_SESSION['last_order']=['key'=>$key,'receipt'=>$receipt];
    $_SESSION['cart']=[];$_SESSION['checkout_key']=bin2hex(random_bytes(32));
    shop_answer(200,$receipt);
} catch (Throwable $e) {
    if (isset($db)&&$db->inTransaction()) $db->rollBack();
    shop_answer(503,['error'=>'checkout_unavailable']);
}

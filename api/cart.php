<?php
declare(strict_types=1);
require __DIR__.'/shop-common.php';
try {
    $db=shop_db();
    $account=pdg_pricing_account($db,true);
    if($account===null)shop_answer(401,['error'=>'authentication_required']);
    shop_customer_cart();
    $db->exec(file_get_contents(dirname(__DIR__).'/database/orders-schema.sql'));
    if ($_SERVER['REQUEST_METHOD']==='GET') shop_answer(200,shop_quote($db,$account));
    $input=shop_input();
    $action=$input['action']??'';
    if ($action==='clear') {
        $_SESSION['cart']=[];
    } elseif (in_array($action,['add','set','remove'],true)) {
        $id=$input['id']??null; $qty=$input['quantity']??1;
        if (!is_int($id)||$id<1||!is_int($qty)||$qty<1||$qty>999) shop_answer(422,['error'=>'invalid_quantity']);
        if ($action==='remove') {
            unset($_SESSION['cart'][$id]);
        } else {
            $q=$db->prepare('SELECT price FROM products WHERE id=? AND active=1');$q->execute([$id]);$p=$q->fetch();
            if (!$p || shop_cents($p['price'])===null) shop_answer(422,['error'=>'product_unavailable']);
            $next=$action==='add' ? ($_SESSION['cart'][$id]??0)+$qty : $qty;
            if ($next>999 || (!isset($_SESSION['cart'][$id])&&count($_SESSION['cart'])>=50)) shop_answer(422,['error'=>'cart_limit']);
            $_SESSION['cart'][$id]=$next;
        }
    } else shop_answer(422,['error'=>'invalid_action']);
    $_SESSION['checkout_key']=bin2hex(random_bytes(32));
    shop_answer(200,shop_quote($db,$account));
} catch (Throwable $e) { shop_answer(503,['error'=>'shop_unavailable']); }

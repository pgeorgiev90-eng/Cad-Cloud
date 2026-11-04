<?php
declare(strict_types=1);
require_once __DIR__.'/admin-common.php';
try{
 [$db,$actor]=pdg_admin_session();
 if($_SERVER['REQUEST_METHOD']==='GET'){
  $orders=$db->query('SELECT id,customer_name,email,phone,address,note,payment_method,status,subtotal_cents,vat_cents,total_cents,created_at FROM pdg_orders ORDER BY id DESC LIMIT 100')->fetchAll();
  $q=$db->prepare('SELECT product_name,product_code,unit_price_cents,quantity FROM pdg_order_items WHERE order_id=? ORDER BY id');
  foreach($orders as &$o){$q->execute([$o['id']]);$o['items']=$q->fetchAll();}unset($o);pdg_answer(200,['orders'=>$orders]);
 }
 if($_SERVER['REQUEST_METHOD']!=='POST')pdg_answer(405,['error'=>'method_not_allowed']);
 $v=json_decode(file_get_contents('php://input'),true);
 if(!is_array($v)||!filter_var($v['id']??null,FILTER_VALIDATE_INT)||!in_array($v['status']??null,['pending','confirmed','cancelled','completed'],true))pdg_answer(422,['error'=>'invalid_request']);
 $q=$db->prepare('UPDATE pdg_orders SET status=? WHERE id=?');$q->execute([$v['status'],(int)$v['id']]);pdg_answer(200,['ok'=>true]);
}catch(Throwable $e){pdg_answer(503,['error'=>'service_unavailable']);}

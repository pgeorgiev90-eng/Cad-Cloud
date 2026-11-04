<?php
declare(strict_types=1);
// Draft for review: never deploy until authentication and access controls have been verified.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function answer(int $code, array $data): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit; }
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') answer(400,['error'=>'https_required']);
ini_set('session.use_strict_mode','1');
ini_set('session.use_only_cookies','1');
session_name('PDGSESSION');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
session_start();
if (isset($_SESSION['user']['id'])) {
  $now=time(); $start=(int)($_SESSION['login_at']??0); $last=(int)($_SESSION['last_activity']??0);
  if (!$start || !$last || $now-$last>1800 || $now-$start>43200) { unset($_SESSION['user']); answer(401,['error'=>'session_expired']); }
  $_SESSION['last_activity']=$now;
}
$id = (int)($_SESSION['user']['id'] ?? 0);
if ($id < 1) answer(401,['error'=>'authentication_required']);
try {
  $path = dirname(__DIR__,2).'/pdg-shop-db.php';
  if (!is_file($path)) throw new RuntimeException('config');
  $s=require $path;
  if (!is_array($s)) throw new RuntimeException('config');
  $db=new PDO('mysql:host='.($s['host']??'localhost').';dbname='.($s['database']??'').';charset=utf8mb4', $s['username']??'', $s['password']??'', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
  $q=$db->prepare('SELECT role,is_active FROM pdg_users WHERE id=?');
  $q->execute([$id]); $who=$q->fetch();
  if (!$who || (int)$who['is_active']!==1 || $who['role']!=='admin') answer(403,['error'=>'forbidden']);
  if ($_SERVER['REQUEST_METHOD']==='GET') {
    $q=$db->query('SELECT id,brand,category,code,name,price,active FROM products ORDER BY id DESC LIMIT 500');
    answer(200,['products'=>$q->fetchAll()]);
  }
  if ($_SERVER['REQUEST_METHOD']!=='POST') answer(405,['error'=>'method_not_allowed']);
  $csrf=$_SERVER['HTTP_X_CSRF_TOKEN']??'';
  if (!is_string($csrf) || !isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'],$csrf)) answer(403,['error'=>'invalid_request']);
  $v=json_decode(file_get_contents('php://input'),true);
  if (!is_array($v)) answer(400,['error'=>'invalid_request']);
  $fields=[];
  foreach (['brand'=>120,'category'=>190,'code'=>190,'name'=>500] as $name=>$max) {
    $value=$v[$name]??null;
    if (!is_string($value)) answer(422,['error'=>'invalid_product']);
    $value=trim($value);
    if ($value==='' || mb_strlen($value,'UTF-8')>$max) answer(422,['error'=>'invalid_product']);
    $fields[$name]=$value;
  }
  $price=$v['price']??null;
  if ($price==='') $price=null;
  if ($price!==null && (!is_string($price) || !preg_match('/^(?:0|[1-9][0-9]{0,9})(?:\\.[0-9]{1,2})?$/D',$price))) answer(422,['error'=>'invalid_price']);
  $active=($v['active']??true);
  if (!is_bool($active)) answer(422,['error'=>'invalid_product']);
  $productId=(int)($v['id']??0);
  if ($productId>0) {
    $q=$db->prepare('UPDATE products SET brand=?,category=?,code=?,name=?,price=?,active=? WHERE id=?');
    $q->execute([$fields['brand'],$fields['category'],$fields['code'],$fields['name'],$price,(int)$active,$productId]);
    $q=$db->prepare('SELECT id FROM products WHERE id=?'); $q->execute([$productId]);
    if (!$q->fetch()) answer(404,['error'=>'not_found']);
  } else {
    $q=$db->prepare('INSERT INTO products (brand,category,code,name,price,active) VALUES (?,?,?,?,?,?)');
    $q->execute([$fields['brand'],$fields['category'],$fields['code'],$fields['name'],$price,(int)$active]);
    $productId=(int)$db->lastInsertId();
  }
  answer(200,['ok'=>true,'id'=>$productId]);
} catch (Throwable $e) { answer(503,['error'=>'service_unavailable']); }

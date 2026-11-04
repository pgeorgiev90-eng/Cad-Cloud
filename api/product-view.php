<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
function answer(int $status,array $v):void{http_response_code($status);echo json_encode($v);exit;}
if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')answer(400,['error'=>'https_required']);
ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');
session_name('PDGSESSION');session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);session_start();
if($_SERVER['REQUEST_METHOD']!=='POST')answer(405,['error'=>'method_not_allowed']);
if(!isset($_SESSION['csrf'])||!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))answer(403,['error'=>'invalid_request']);
if((int)($_SERVER['CONTENT_LENGTH']??0)>2048)answer(413,['error'=>'invalid_request']);
$v=json_decode(file_get_contents('php://input'),true);
if(!is_array($v))answer(400,['error'=>'invalid_request']);
if(($v['action']??'')==='consent'){$_SESSION['analytics_consent']=true;$_SESSION['analytics_id']=$_SESSION['analytics_id']??bin2hex(random_bytes(32));answer(200,['ok'=>true]);}
if(($v['action']??'')==='withdraw'){unset($_SESSION['analytics_consent'],$_SESSION['analytics_id'],$_SESSION['analytics_last']);answer(200,['ok'=>true]);}
if(($v['action']??'')!=='view'||empty($_SESSION['analytics_consent'])||empty($_SESSION['analytics_id']))answer(403,['error'=>'consent_required']);
$id=filter_var($v['product_id']??null,FILTER_VALIDATE_INT);if(!$id||$id<1)answer(422,['error'=>'invalid_product']);
if(time()-(int)($_SESSION['analytics_last']??0)<10)answer(429,['error'=>'try_later']);
try{
 $s=require dirname(__DIR__,2).'/pdg-shop-db.php';if(!is_array($s))throw new RuntimeException();
 $db=new PDO('mysql:host='.($s['host']??'localhost').';dbname='.($s['database']??'').';charset=utf8mb4',$s['username']??'',$s['password']??'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
 $q=$db->prepare('SELECT id FROM products WHERE id=? AND active=1');$q->execute([$id]);if(!$q->fetch())answer(404,['error'=>'not_found']);
 $userId=null;
 if(isset($_SESSION['user']['id'])){$q=$db->prepare("SELECT id FROM pdg_users WHERE id=? AND role='customer' AND is_active=1");$q->execute([(int)$_SESSION['user']['id']]);$userId=$q->fetchColumn()?:null;}
 $q=$db->prepare('INSERT INTO pdg_product_views (product_id,visitor_hash,user_id) VALUES (?,?,?)');$q->execute([$id,hash('sha256',$_SESSION['analytics_id']),$userId]);
 $_SESSION['analytics_last']=time();answer(200,['ok'=>true]);
}catch(Throwable $e){answer(503,['error'=>'service_unavailable']);}

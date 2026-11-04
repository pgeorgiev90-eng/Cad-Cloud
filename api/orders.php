<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
function answer(int $status,array $v):void{http_response_code($status);echo json_encode($v,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')answer(400,['error'=>'https_required']);
ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');session_name('PDGSESSION');session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);session_start();
if($_SERVER['REQUEST_METHOD']!=='POST')answer(405,['error'=>'method_not_allowed']);
if(empty($_SESSION['csrf'])||!hash_equals($_SESSION['csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))answer(403,['error'=>'invalid_request']);
if((int)($_SERVER['CONTENT_LENGTH']??0)>20000)answer(413,['error'=>'invalid_request']);
$v=json_decode(file_get_contents('php://input'),true);
if(!is_array($v)||!is_string($v['request_key']??null)||!preg_match('/^[a-f0-9]{64}$/D',$v['request_key'])||!is_array($v['items']??null)||count($v['items'])<1||count($v['items'])>50)answer(422,['error'=>'invalid_request']);
foreach(['name'=>160,'email'=>254,'phone'=>40,'address'=>500,'note'=>1000] as $k=>$max){if(!is_string($v[$k]??null))answer(422,['error'=>'invalid_contact']);$v[$k]=trim($v[$k]);if(($k!=='note'&&$v[$k]==='')||mb_strlen($v[$k],'UTF-8')>$max)answer(422,['error'=>'invalid_contact']);}
if(!filter_var($v['email'],FILTER_VALIDATE_EMAIL)||!preg_match('/^[+0-9 ()\\-]{6,40}$/D',$v['phone']))answer(422,['error'=>'invalid_contact']);
$lines=[];foreach($v['items'] as $item){if(!is_array($item)||!filter_var($item['id']??null,FILTER_VALIDATE_INT)||!filter_var($item['quantity']??null,FILTER_VALIDATE_INT)||!is_int($item['unit_cents']??null))answer(422,['error'=>'invalid_items']);$id=(int)$item['id'];$qty=(int)$item['quantity'];if($id<1||$qty<1||$qty>999||$item['unit_cents']<0||isset($lines[$id]))answer(422,['error'=>'invalid_items']);$lines[$id]=$item;}ksort($lines);$fingerprint=hash('sha256',json_encode([$v['name'],$v['email'],$v['phone'],$v['address'],$v['note'],array_values($lines)],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
try{
 $path=dirname(__DIR__,2).'/pdg-shop-db.php';if(!is_file($path))throw new RuntimeException();$s=require $path;if(!is_array($s))throw new RuntimeException();
 $db=new PDO('mysql:host='.($s['host']??'localhost').';dbname='.($s['database']??'').';charset=utf8mb4',$s['username']??'',$s['password']??'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
 // Create only the bundled, additive order tables if the admin has not opened the panel yet.
 $schema=file_get_contents(dirname(__DIR__).'/database/orders-schema.sql');if($schema===false)throw new RuntimeException('schema');
 foreach(preg_split('/;\\s*(?:\\r?\\n|$)/',$schema) as $statement){$statement=trim($statement);if($statement!=='')$db->exec($statement);}
 $key=hash('sha256',(string)($_SERVER['REMOTE_ADDR']??'unknown'));$db->beginTransaction();
 $q=$db->prepare('INSERT INTO pdg_order_attempts(identifier_hash,window_start,attempt_count) VALUES (?,NOW(),0) ON DUPLICATE KEY UPDATE identifier_hash=VALUES(identifier_hash)');$q->execute([$key]);
 $q=$db->prepare('SELECT attempt_count,window_start < DATE_SUB(NOW(), INTERVAL 15 MINUTE) AS expired FROM pdg_order_attempts WHERE identifier_hash=? FOR UPDATE');$q->execute([$key]);$attempt=$q->fetch();
 if((int)$attempt['expired']){$q=$db->prepare('UPDATE pdg_order_attempts SET window_start=NOW(),attempt_count=0 WHERE identifier_hash=?');$q->execute([$key]);$attempt['attempt_count']=0;}
 if((int)$attempt['attempt_count']>=10){$db->commit();answer(429,['error'=>'try_later']);}
 $q=$db->prepare('UPDATE pdg_order_attempts SET attempt_count=attempt_count+1 WHERE identifier_hash=?');$q->execute([$key]);$db->commit();
 $db->beginTransaction();$q=$db->prepare('SELECT id,request_fingerprint FROM pdg_orders WHERE request_key=?');$q->execute([$v['request_key']]);$existing=$q->fetch();if($existing){$db->commit();if(!hash_equals($existing['request_fingerprint'],$fingerprint))answer(409,['error'=>'request_key_conflict']);answer(200,['ok'=>true,'order_id'=>(int)$existing['id']]);}
 $q=$db->prepare('SELECT id,code,name,price,active FROM products WHERE id=? FOR UPDATE');$resolved=[];$subtotal=0;
 foreach($lines as $id=>$line){$q->execute([$id]);$p=$q->fetch();if(!$p||(int)$p['active']!==1||$p['price']===null){$db->rollBack();answer(409,['error'=>'product_unavailable']);}$parts=explode('.',(string)$p['price']);$cents=(int)$parts[0]*100+(int)str_pad($parts[1]??'0',2,'0');if($cents!==$line['unit_cents']){$db->rollBack();answer(409,['error'=>'price_changed']);}$p['unit_cents']=$cents;$p['quantity']=(int)$line['quantity'];$subtotal+=$cents*$p['quantity'];$resolved[]=$p;}
 $vat=intdiv($subtotal*20+50,100);$q=$db->prepare('INSERT INTO pdg_orders(request_key,request_fingerprint,customer_name,email,phone,address,note,subtotal_cents,vat_cents,total_cents) VALUES (?,?,?,?,?,?,?,?,?,?)');$q->execute([$v['request_key'],$fingerprint,$v['name'],$v['email'],$v['phone'],$v['address'],$v['note'],$subtotal,$vat,$subtotal+$vat]);$order=(int)$db->lastInsertId();
 $q=$db->prepare('INSERT INTO pdg_order_items(order_id,product_id,product_name,product_code,unit_price_cents,quantity) VALUES (?,?,?,?,?,?)');foreach($resolved as $p)$q->execute([$order,$p['id'],$p['name'],$p['code'],$p['unit_cents'],$p['quantity']]);$db->commit();answer(200,['ok'=>true,'order_id'=>$order]);
}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();answer(503,['error'=>'service_unavailable']);}

<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
function result(int $status,array $data): void {http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
$id=filter_input(INPUT_GET,'id',FILTER_VALIDATE_INT);
if(!$id||$id<1)result(422,['error'=>'invalid_product']);
try{
 $path=dirname(__DIR__,2).'/pdg-shop-db.php';if(!is_file($path))throw new RuntimeException('config');
 $s=require $path;if(!is_array($s))throw new RuntimeException('config');
 $db=new PDO('mysql:host='.($s['host']??'localhost').';dbname='.($s['database']??'').';charset=utf8mb4',$s['username']??'',$s['password']??'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
 $q=$db->prepare('SELECT id,brand,category,code,name,price,image_url AS imageUrl,image_index AS imageIndex FROM products WHERE id=? AND active=1');$q->execute([$id]);$product=$q->fetch();if(!$product)result(404,['error'=>'not_found']);
 $fields=[];try{$q=$db->prepare('SELECT label,value FROM pdg_product_fields WHERE product_id=? ORDER BY sort_order,id');$q->execute([$id]);$fields=$q->fetchAll();}catch(PDOException $e){if($e->getCode()!=='42S02')throw $e;}
 result(200,['product'=>$product,'fields'=>$fields]);
}catch(Throwable $e){result(503,['error'=>'service_unavailable']);}

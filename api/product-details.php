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
 $q=$db->prepare('SELECT id,brand,code FROM products WHERE id=? AND active=1');$q->execute([$id]);$product=$q->fetch();if(!$product)result(404,['error'=>'not_found']);
 $q=$db->prepare('SELECT label,value FROM pdg_product_fields WHERE product_id=? ORDER BY sort_order,id');$q->execute([$id]);
 $fields=$q->fetchAll();
 $specfile=dirname(__DIR__).'/database/manufacturer-specifications.json';
 if(is_file($specfile)){
   $entries=json_decode((string)file_get_contents($specfile),true);
   if(is_array($entries))foreach($entries as $entry){
     if(($entry['brand']??'')!==$product['brand']||($entry['code']??'')!==$product['code'])continue;
     $known=array_column($fields,'label');
     foreach(($entry['fields']??[]) as $field)if(is_array($field)&&!in_array($field['label']??'', $known,true)){$fields[]=$field;$known[]=$field['label'];}
     $fields[]=['label'=>'Код на производителя','value'=>$entry['manufacturer_code']];
     $fields[]=['label'=>'Източник на данните','value'=>$entry['source']];
     break;
   }
 }
 result(200,['fields'=>$fields]);
}catch(Throwable $e){result(503,['error'=>'service_unavailable']);}

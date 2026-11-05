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
 require_once __DIR__.'/product-phase-bootstrap.php';pdg_seed_inverter_phases($db);
 require_once __DIR__.'/product-spec-bootstrap.php';pdg_seed_product_specifications($db);
 require_once __DIR__.'/product-category-bootstrap.php';pdg_classify_catalog_products($db);
 require_once __DIR__.'/product-content-bootstrap.php';pdg_seed_product_content($db);
 $q=$db->prepare('SELECT id,brand,category,code,name,price,image_url AS imageUrl,image_index AS imageIndex FROM products WHERE id=? AND active=1');$q->execute([$id]);$product=$q->fetch();if(!$product)result(404,['error'=>'not_found']);
 $fields=[];try{$q=$db->prepare('SELECT label,value FROM pdg_product_fields WHERE product_id=? ORDER BY sort_order,id');$q->execute([$id]);$fields=$q->fetchAll();}catch(PDOException $e){if($e->getCode()!=='42S02')throw $e;}
 $hidden=['източник за фазност','източник на фазност','phase source','source of phase','source of phases'];
 $fields=array_values(array_filter($fields,fn($f)=>!in_array(mb_strtolower(trim($f['label']),'UTF-8'),$hidden,true)));
 $product['description']='';$product['imageCaption']='';
 foreach($fields as $f){if(mb_strtolower(trim($f['label']),'UTF-8')==='описание')$product['description']=$f['value'];if(mb_strtolower(trim($f['label']),'UTF-8')==='бележка за снимката')$product['imageCaption']=$f['value'];}
 $fields=array_values(array_filter($fields,fn($f)=>!in_array(mb_strtolower(trim($f['label']),'UTF-8'),['описание','бележка за снимката'],true)));
 result(200,['product'=>$product,'fields'=>$fields]);
}catch(Throwable $e){result(503,['error'=>'service_unavailable']);}

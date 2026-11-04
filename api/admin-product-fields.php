<?php
declare(strict_types=1);
require_once __DIR__.'/admin-common.php';
function fields(PDO $db,int $id): array {
  $q=$db->prepare('SELECT label,value FROM pdg_product_fields WHERE product_id=? ORDER BY sort_order,id');
  $q->execute([$id]);return $q->fetchAll();
}
function version(array $fields): string {return hash('sha256',json_encode($fields,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));}
try {
  [$db,$actor]=pdg_admin_session();
  if($_SERVER['REQUEST_METHOD']==='GET'){
    $id=filter_input(INPUT_GET,'product_id',FILTER_VALIDATE_INT);
    if(!$id||$id<1)pdg_answer(422,['error'=>'invalid_product']);
    $q=$db->prepare('SELECT id FROM products WHERE id=?');$q->execute([$id]);if(!$q->fetch())pdg_answer(404,['error'=>'not_found']);
    $items=fields($db,$id);pdg_answer(200,['fields'=>$items,'version'=>version($items)]);
  }
  if($_SERVER['REQUEST_METHOD']!=='POST')pdg_answer(405,['error'=>'method_not_allowed']);
  if((int)($_SERVER['CONTENT_LENGTH']??0)>50000)pdg_answer(413,['error'=>'invalid_request']);
  $v=json_decode(file_get_contents('php://input'),true);
  if(!is_array($v)||!isset($v['product_id'])||!filter_var($v['product_id'],FILTER_VALIDATE_INT)||!is_string($v['version']??null)||!is_array($v['fields']??null)||count($v['fields'])>30)pdg_answer(422,['error'=>'invalid_request']);
  $id=(int)$v['product_id'];$clean=[];
  foreach($v['fields'] as $entry){
    if(!is_array($entry)||!is_string($entry['label']??null)||!is_string($entry['value']??null))pdg_answer(422,['error'=>'invalid_fields']);
    $label=trim($entry['label']);$value=trim($entry['value']);
    if($label===''||$value===''||mb_strlen($label,'UTF-8')>100||mb_strlen($value,'UTF-8')>1000)pdg_answer(422,['error'=>'invalid_fields']);
    $clean[]=['label'=>$label,'value'=>$value];
  }
  $db->beginTransaction();
  $q=$db->prepare('SELECT id FROM products WHERE id=? FOR UPDATE');$q->execute([$id]);
  if(!$q->fetch()){$db->rollBack();pdg_answer(404,['error'=>'not_found']);}
  $current=fields($db,$id);
  if(!hash_equals(version($current),$v['version'])){$db->rollBack();pdg_answer(409,['error'=>'changed_refresh']);}
  $q=$db->prepare('DELETE FROM pdg_product_fields WHERE product_id=?');$q->execute([$id]);
  $q=$db->prepare('INSERT INTO pdg_product_fields(product_id,label,value,sort_order) VALUES (?,?,?,?)');
  foreach($clean as $i=>$entry)$q->execute([$id,$entry['label'],$entry['value'],$i]);
  $db->commit();pdg_answer(200,['ok'=>true,'version'=>version($clean)]);
} catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();pdg_answer(503,['error'=>'service_unavailable']);}

<?php
declare(strict_types=1);
require_once __DIR__.'/admin-common.php';
require_once __DIR__.'/customer-pricing.php';
try {
  [$db,$actor]=pdg_admin_session();
  pdg_discount_schema($db);
  if($_SERVER['REQUEST_METHOD']==='GET'){
    $q=$db->query("SELECT u.id,u.email,u.role,u.is_active,u.created_at,COALESCE(d.discount_bp,0) AS discount_bp,EXISTS(SELECT 1 FROM pdg_email_tokens t WHERE t.user_id=u.id) AS verification_pending FROM pdg_users u LEFT JOIN pdg_customer_discounts d ON d.user_id=u.id ORDER BY u.created_at DESC,u.id DESC LIMIT 500");
    pdg_answer(200,['users'=>$q->fetchAll()]);
  }
  if($_SERVER['REQUEST_METHOD']!=='POST')pdg_answer(405,['error'=>'method_not_allowed']);
  if((int)($_SERVER['CONTENT_LENGTH']??0)>2048)pdg_answer(413,['error'=>'invalid_request']);
  $v=json_decode(file_get_contents('php://input'),true);
  if(!is_array($v)||!isset($v['id'])||!filter_var($v['id'],FILTER_VALIDATE_INT))pdg_answer(422,['error'=>'invalid_request']);
  $discountAction=array_key_exists('discount_bp',$v);
  if($discountAction ? (!is_int($v['discount_bp'])||$v['discount_bp']<0||$v['discount_bp']>10000) : !is_bool($v['active']??null))
    pdg_answer(422,['error'=>'invalid_request']);
  $target=(int)$v['id'];if($target<1||$target===$actor)pdg_answer(403,['error'=>'forbidden']);
  $db->beginTransaction();
  $q=$db->prepare('SELECT role,is_active FROM pdg_users WHERE id=? FOR UPDATE');$q->execute([$target]);$user=$q->fetch();
  if(!$user){$db->rollBack();pdg_answer(404,['error'=>'not_found']);}
  if($user['role']!=='customer'){$db->rollBack();pdg_answer(403,['error'=>'forbidden']);}
  if($discountAction){
    $q=$db->prepare('INSERT INTO pdg_customer_discounts(user_id,discount_bp) VALUES(?,?) ON DUPLICATE KEY UPDATE discount_bp=VALUES(discount_bp)');
    $q->execute([$target,$v['discount_bp']]);$db->commit();pdg_answer(200,['ok'=>true]);
  }
  if($v['active']){
    $q=$db->prepare('SELECT COUNT(*) FROM pdg_email_tokens WHERE user_id=?');$q->execute([$target]);
    if((int)$q->fetchColumn()>0){$db->rollBack();pdg_answer(409,['error'=>'verification_pending']);}
  }
  $q=$db->prepare("UPDATE pdg_users SET is_active=? WHERE id=? AND role='customer'");$q->execute([(int)$v['active'],$target]);
  $db->commit();pdg_answer(200,['ok'=>true]);
} catch(Throwable $e) {if(isset($db)&&$db->inTransaction())$db->rollBack();pdg_answer(503,['error'=>'service_unavailable']);}

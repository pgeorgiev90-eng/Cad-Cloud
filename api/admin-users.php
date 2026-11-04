<?php
declare(strict_types=1);
require_once __DIR__.'/admin-common.php';
try {
  [$db,$actor]=pdg_admin_session();
  if($_SERVER['REQUEST_METHOD']==='GET'){
    $q=$db->query("SELECT u.id,u.email,u.role,u.is_active,u.created_at,EXISTS(SELECT 1 FROM pdg_email_tokens t WHERE t.user_id=u.id) AS verification_pending FROM pdg_users u ORDER BY u.created_at DESC,u.id DESC LIMIT 500");
    pdg_answer(200,['users'=>$q->fetchAll()]);
  }
  if($_SERVER['REQUEST_METHOD']!=='POST')pdg_answer(405,['error'=>'method_not_allowed']);
  if((int)($_SERVER['CONTENT_LENGTH']??0)>2048)pdg_answer(413,['error'=>'invalid_request']);
  $v=json_decode(file_get_contents('php://input'),true);
  if(!is_array($v)||!isset($v['id'])||!filter_var($v['id'],FILTER_VALIDATE_INT)||!is_bool($v['active']??null))pdg_answer(422,['error'=>'invalid_request']);
  $target=(int)$v['id'];if($target<1||$target===$actor)pdg_answer(403,['error'=>'forbidden']);
  $db->beginTransaction();
  $q=$db->prepare('SELECT role,is_active FROM pdg_users WHERE id=? FOR UPDATE');$q->execute([$target]);$user=$q->fetch();
  if(!$user){$db->rollBack();pdg_answer(404,['error'=>'not_found']);}
  if($user['role']!=='customer'){$db->rollBack();pdg_answer(403,['error'=>'forbidden']);}
  if($v['active']){
    $q=$db->prepare('SELECT COUNT(*) FROM pdg_email_tokens WHERE user_id=?');$q->execute([$target]);
    if((int)$q->fetchColumn()>0){$db->rollBack();pdg_answer(409,['error'=>'verification_pending']);}
  }
  $q=$db->prepare("UPDATE pdg_users SET is_active=? WHERE id=? AND role='customer'");$q->execute([(int)$v['active'],$target]);
  $db->commit();pdg_answer(200,['ok'=>true]);
} catch(Throwable $e) {if(isset($db)&&$db->inTransaction())$db->rollBack();pdg_answer(503,['error'=>'service_unavailable']);}

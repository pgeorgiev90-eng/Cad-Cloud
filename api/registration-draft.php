<?php
declare(strict_types=1);
// New CAD accounts require email verification.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function response(int $code,array $data): void {http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE);exit;}
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off') response(400,['error'=>'https_required']);
if ($_SERVER['REQUEST_METHOD']!=='POST') response(405,['error'=>'method_not_allowed']);
if ((int)($_SERVER['CONTENT_LENGTH']??0)>4096) response(413,['error'=>'invalid_request']);
ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');session_name('PDGSESSION');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);session_start();
$csrf=$_SERVER['HTTP_X_CSRF_TOKEN']??'';
if (!is_string($csrf)||!isset($_SESSION['csrf'])||!hash_equals($_SESSION['csrf'],$csrf)) response(403,['error'=>'invalid_request']);
$action=$_GET['action']??'';
$data=json_decode(file_get_contents('php://input'),true);
if (!is_array($data)) response(400,['error'=>'invalid_request']);
try {
  $path=dirname(__DIR__,2).'/pdg-shop-db.php';
  if (!is_file($path)) throw new RuntimeException('config');
  $s=require $path;
  if (!is_array($s) || ($s['cad_registration_enabled']??true)!==true) response(503,['error'=>'registration_unavailable']);
  $db=new PDO('mysql:host='.($s['host']??'localhost').';dbname='.($s['database']??'').';charset=utf8mb4',$s['username']??'',$s['password']??'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
  if (!in_array($action,['register','verify'],true)) response(404,['error'=>'not_found']);
  $key=hash('sha256','registration:'.$action.':'.($_SERVER['REMOTE_ADDR']??'unknown'));
  $db->beginTransaction();
  $q=$db->prepare("INSERT INTO pdg_login_attempts(identifier_hash,window_start,attempt_count) VALUES (?,NOW(),0) ON DUPLICATE KEY UPDATE identifier_hash=VALUES(identifier_hash)");$q->execute([$key]);
  $q=$db->prepare("SELECT attempt_count,(window_start<DATE_SUB(NOW(),INTERVAL 15 MINUTE)) AS expired FROM pdg_login_attempts WHERE identifier_hash=? FOR UPDATE");$q->execute([$key]);$a=$q->fetch();
  if ((int)$a['expired']===1){$q=$db->prepare("UPDATE pdg_login_attempts SET window_start=NOW(),attempt_count=0 WHERE identifier_hash=?");$q->execute([$key]);$a['attempt_count']=0;}
  if ((int)$a['attempt_count']>=5){$db->commit();response(429,['error'=>'try_later']);}
  $q=$db->prepare('UPDATE pdg_login_attempts SET attempt_count=attempt_count+1 WHERE identifier_hash=?');$q->execute([$key]);$db->commit();
  if ($action==='verify') {
    $token=is_string($data['token']??null)?$data['token']:'';
    $password=is_string($data['password']??null)?$data['password']:'';
    if (strlen($password)<12 || strlen($password)>72 || !preg_match('/^[a-f0-9]{64}$/D',$token)) response(400,['error'=>'invalid_token']);
    $db->beginTransaction();
    $q=$db->prepare("SELECT t.user_id,u.password_hash FROM pdg_email_tokens t JOIN pdg_users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at>NOW() AND u.role='customer' AND u.is_active=0 FOR UPDATE");
    $q->execute([hash('sha256',$token)]);$row=$q->fetch();
    if (!$row || !password_verify($password,$row['password_hash'])){$db->rollBack();response(400,['error'=>'invalid_token']);}
    $q=$db->prepare("UPDATE pdg_users SET is_active=1 WHERE id=? AND role='customer'");$q->execute([$row['user_id']]);
    $q=$db->prepare('DELETE FROM pdg_email_tokens WHERE user_id=?');$q->execute([$row['user_id']]);$db->commit();
    response(200,['ok'=>true]);
  }
  $email=is_string($data['email']??null)?trim($data['email']):'';
  $password=is_string($data['password']??null)?$data['password']:'';
  if (strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<12||strlen($password)>72) response(422,['error'=>'invalid_details']);
  $db->beginTransaction();
  $q=$db->prepare('SELECT id,is_active,role FROM pdg_users WHERE email=? FOR UPDATE');$q->execute([$email]);$user=$q->fetch();
  $pending = !$user;
  $passwordHash = null;
  if (!$user){
    $q=$db->prepare("INSERT INTO pdg_users(email,password_hash,role,is_active) VALUES (?,?,'customer',0)");
    $passwordHash=password_hash($password,PASSWORD_DEFAULT);
    $q->execute([$email,$passwordHash]);
    $user=['id'=>(int)$db->lastInsertId()];
  } elseif ((int)$user['is_active']===0 && $user['role']==='customer') {
    $q=$db->prepare('SELECT 1 FROM pdg_email_tokens WHERE user_id=? LIMIT 1');
    $q->execute([$user['id']]);
    $pending=(bool)$q->fetchColumn();
  }
  if ($pending){
    if ($passwordHash===null) {
      $q=$db->prepare("UPDATE pdg_users SET password_hash=? WHERE id=? AND is_active=0 AND role='customer'");
      $q->execute([password_hash($password,PASSWORD_DEFAULT),$user['id']]);
    }
    $token=bin2hex(random_bytes(32));
    $q=$db->prepare('DELETE FROM pdg_email_tokens WHERE user_id=?');$q->execute([$user['id']]);
    $q=$db->prepare("INSERT INTO pdg_email_tokens(token_hash,user_id,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 30 MINUTE))");$q->execute([hash('sha256',$token),$user['id']]);
  }
  $db->commit();
  if (isset($token)){
    $url='https://pdgsystems.bg/verify-account.html#token='.$token;
    $body="Здравейте,\n\nПотвърдете имейла си в PDG Systems чрез линка:\n".$url."\n\nЛинкът е валиден 30 минути. Ако не сте заявявали регистрация, игнорирайте това съобщение.";
    $ok=mail($email,'PDG Systems - Potvarzhdenie na email',$body,"From: no-reply@pdgsystems.bg\r\nContent-Type: text/plain; charset=UTF-8");
    if (!$ok) {
      error_log('PDG registration email delivery failed');
      response(503,['error'=>'registration_unavailable']);
    }
  }
  response(200,['ok'=>true]);
} catch(Throwable $e) {
  if(isset($db)&&$db->inTransaction())$db->rollBack();
  response(503,['error'=>'registration_unavailable']);
}

<?php
declare(strict_types=1);
// Shared private admin helpers. Call only from APIs that perform their own input validation.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function pdg_answer(int $code,array $body): void {http_response_code($code);echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
function pdg_admin_session(): array {
  return pdg_account_session(true);
}
function pdg_account_session(bool $adminOnly, ?string $loginPage = null): array {
  $requireLogin = static function (string $error) use ($loginPage): void {
    if ($loginPage !== null) {
      header('Location: '.$loginPage, true, 302);
      exit;
    }
    pdg_answer(401, ['error'=>$error]);
  };
  if(empty($_SERVER['HTTPS'])||$_SERVER['HTTPS']==='off')pdg_answer(400,['error'=>'https_required']);
  ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');
  session_name('PDGSESSION');
  session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);session_start();
  if (isset($_SESSION['user']['id'])) {
    $now=time(); $start=(int)($_SESSION['login_at']??0); $last=(int)($_SESSION['last_activity']??0);
    if (!$start || !$last || $now-$last>1800 || $now-$start>43200) { unset($_SESSION['user']); $requireLogin('session_expired'); }
    $_SESSION['last_activity']=$now;
  }
  $id=(int)($_SESSION['user']['id']??0);
  if($id<1)$requireLogin('authentication_required');
  $path=dirname(__DIR__,2).'/pdg-shop-db.php';
  if(!is_file($path))throw new RuntimeException('configuration');
  $s=require $path;if(!is_array($s))throw new RuntimeException('configuration');
  $db=new PDO('mysql:host='.($s['host']??'localhost').';dbname='.($s['database']??'').';charset=utf8mb4',$s['username']??'',$s['password']??'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
  $q=$db->prepare('SELECT id,role,is_active FROM pdg_users WHERE id=?');$q->execute([$id]);$user=$q->fetch();
  if ((!$user || (int)$user['is_active']!==1) && $loginPage !== null) {
    unset($_SESSION['user'], $_SESSION['login_at'], $_SESSION['last_activity']);
    $requireLogin('authentication_required');
  }
  if(!$user || (int)$user['is_active']!==1 || ($adminOnly && $user['role']!=='admin'))pdg_answer(403,['error'=>'forbidden']);
  if($_SERVER['REQUEST_METHOD']!=='GET'){
    $csrf=$_SERVER['HTTP_X_CSRF_TOKEN']??'';
    if(!is_string($csrf)||!isset($_SESSION['csrf'])||!hash_equals($_SESSION['csrf'],$csrf))pdg_answer(403,['error'=>'invalid_request']);
  }
  return [$db,$id];
}

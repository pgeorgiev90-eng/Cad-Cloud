<?php
declare(strict_types=1);
// One-time setup; inert until a strong secret and short expiry are configured outside web root.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(int $code, array $data): void {http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE);exit;}
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off') reply(400,['error'=>'https_required']);
if ($_SERVER['REQUEST_METHOD']!=='POST') reply(405,['error'=>'method_not_allowed']);
if ((int)($_SERVER['CONTENT_LENGTH']??0)>4096) reply(413,['error'=>'invalid_request']);
ini_set('session.use_strict_mode','1'); ini_set('session.use_only_cookies','1');
session_name('PDGSESSION');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']); session_start();
$csrf=$_SERVER['HTTP_X_CSRF_TOKEN']??'';
if (!is_string($csrf)||!isset($_SESSION['csrf'])||!hash_equals($_SESSION['csrf'],$csrf)) reply(403,['error'=>'invalid_request']);
$path=dirname(__DIR__,2).'/pdg-shop-db.php';
if (!is_file($path)) reply(503,['error'=>'setup_unavailable']);
try {
  $s=require $path;
  $key=is_array($s)?($s['setup_secret']??''):''; $expiry=is_array($s)?($s['setup_expires_at']??((int)filemtime($path)+1800)):0;
  if (!is_string($key)||!preg_match('/^[a-f0-9]{64}$/D',$key)||!is_int($expiry)||$expiry<time()||$expiry>time()+3600) reply(503,['error'=>'setup_unavailable']);
  $data=json_decode(file_get_contents('php://input'),true);
  $given=is_array($data)&&is_string($data['setup_secret']??null)?$data['setup_secret']:'';
  if (!hash_equals($key,$given)) reply(403,['error'=>'setup_denied']);
  $email=is_array($data)&&is_string($data['email']??null)?trim($data['email']):'';
  $password=is_array($data)&&is_string($data['password']??null)?$data['password']:'';
  if (strlen($email)>254 || !filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($password)<12 || strlen($password)>72) reply(422,['error'=>'invalid_details']);
  $db=new PDO('mysql:host='.($s['host']??'localhost').';dbname='.($s['database']??'').';charset=utf8mb4',$s['username']??'',$s['password']??'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_EMULATE_PREPARES=>false]);
  $lock=$db->query("SELECT GET_LOCK('pdg_admin_setup', 10)")->fetchColumn();
  if ((int)$lock!==1) reply(503,['error'=>'setup_unavailable']);
  try {
    $db->exec("CREATE TABLE IF NOT EXISTS pdg_users (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,email VARCHAR(254) NOT NULL,password_hash VARCHAR(255) NOT NULL,role ENUM('customer','admin') NOT NULL DEFAULT 'customer',is_active TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (id),UNIQUE KEY uq_pdg_users_email (email)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS pdg_login_attempts (identifier_hash CHAR(64) NOT NULL,window_start DATETIME NOT NULL,attempt_count INT UNSIGNED NOT NULL DEFAULT 0,PRIMARY KEY (identifier_hash)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS pdg_email_tokens (token_hash CHAR(64) NOT NULL,user_id BIGINT UNSIGNED NOT NULL,expires_at DATETIME NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (token_hash),KEY idx_pdg_email_user (user_id),CONSTRAINT fk_pdg_token_user FOREIGN KEY (user_id) REFERENCES pdg_users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if ((int)$db->query('SELECT COUNT(*) FROM pdg_users')->fetchColumn()!==0) reply(409,['error'=>'setup_already_completed']);
    $q=$db->prepare("INSERT INTO pdg_users(email,password_hash,role) VALUES (?,?,'admin')");
    $q->execute([$email,password_hash($password,PASSWORD_DEFAULT)]);
  } finally { $db->query("SELECT RELEASE_LOCK('pdg_admin_setup')"); }
  reply(200,['ok'=>true]);
} catch(Throwable $e) { reply(503,['error'=>'setup_unavailable']); }

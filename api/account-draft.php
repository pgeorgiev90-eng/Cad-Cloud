<?php
declare(strict_types=1);
// Shared PDG account sessions for CAD and administration.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') {
    respond(400, ['error' => 'https_required']);
}
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name('PDGSESSION');
session_set_cookie_params(['lifetime'=>0, 'path'=>'/', 'secure'=>true, 'httponly'=>true, 'samesite'=>'Lax']);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
$action = $_GET['action'] ?? 'session';
if ($action === 'session' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $registrationAvailable = false;
    try {
        $file = dirname(__DIR__, 2) . '/pdg-shop-db.php';
        if (is_file($file)) {
            $cfg = require $file;
            $registrationAvailable = is_array($cfg) && ($cfg['cad_registration_enabled'] ?? true) === true;
        }
    } catch (Throwable $e) { $registrationAvailable = false; }
    if (isset($_SESSION['user']['id'])) {
        $now=time(); $start=(int)($_SESSION['login_at']??0); $last=(int)($_SESSION['last_activity']??0);
        if (!$start || !$last || $now-$last>1800 || $now-$start>43200) {
            unset($_SESSION['user'],$_SESSION['login_at'],$_SESSION['last_activity']);
            session_regenerate_id(true); $_SESSION['csrf']=bin2hex(random_bytes(32));
        } else {
            try {
                if (!isset($cfg) || !is_array($cfg)) throw new RuntimeException('configuration');
                $db=new PDO('mysql:host='.($cfg['host']??'localhost').';dbname='.($cfg['database']??'').';charset=utf8mb4',$cfg['username']??'',$cfg['password']??'',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
                $q=$db->prepare('SELECT id,email,role,is_active FROM pdg_users WHERE id=?');$q->execute([(int)$_SESSION['user']['id']]);$fresh=$q->fetch();
                if (!$fresh || (int)$fresh['is_active']!==1) {
                    unset($_SESSION['user'],$_SESSION['login_at'],$_SESSION['last_activity']);
                    session_regenerate_id(true); $_SESSION['csrf']=bin2hex(random_bytes(32));
                } else {
                    $_SESSION['user']=['id'=>(int)$fresh['id'],'email'=>$fresh['email'],'role'=>$fresh['role']];
                    $_SESSION['last_activity']=$now;
                }
            } catch (Throwable $e) { respond(503,['error'=>'service_unavailable']); }
        }
    }
    respond(200, ['csrf'=>$_SESSION['csrf'], 'user'=>$_SESSION['user'] ?? null, 'registration_available'=>$registrationAvailable]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['error'=>'method_not_allowed']);
$csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if (!is_string($csrf) || !hash_equals($_SESSION['csrf'], $csrf)) respond(403, ['error'=>'invalid_request']);
if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    setcookie(session_name(), '', ['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
    respond(200, ['ok'=>true]);
}
if ($action !== 'login') respond(404, ['error'=>'not_found']);
$input = json_decode(file_get_contents('php://input'), true);
$email = is_array($input) && is_string($input['email'] ?? null) ? trim($input['email']) : '';
$password = is_array($input) && is_string($input['password'] ?? null) ? $input['password'] : '';
if (strlen($email)>254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password)>1024 || $password==='') {
    respond(400, ['error'=>'invalid_credentials']);
}
try {
    $config = dirname(__DIR__, 2) . '/pdg-shop-db.php';
    if (!is_file($config)) throw new RuntimeException('configuration_missing');
    $settings = require $config;
    if (!is_array($settings)) throw new RuntimeException('configuration_invalid');
    $pdo = new PDO('mysql:host='.($settings['host']??'localhost').';dbname='.($settings['database']??'').';charset=utf8mb4',
        $settings['username']??'', $settings['password']??'',
        [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
    // Per-IP fixed window. Account lookup and counter update are serialized.
    $key=hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $pdo->beginTransaction();
    $stmt=$pdo->prepare("INSERT INTO pdg_login_attempts (identifier_hash,window_start,attempt_count) VALUES (?,NOW(),0) ON DUPLICATE KEY UPDATE identifier_hash=VALUES(identifier_hash)");
    $stmt->execute([$key]);
    $stmt=$pdo->prepare("SELECT attempt_count, (window_start < DATE_SUB(NOW(), INTERVAL 15 MINUTE)) AS expired FROM pdg_login_attempts WHERE identifier_hash=? FOR UPDATE");
    $stmt->execute([$key]); $attempt=$stmt->fetch();
    if ((int)$attempt['expired']===1) {
        $stmt=$pdo->prepare("UPDATE pdg_login_attempts SET window_start=NOW(),attempt_count=0 WHERE identifier_hash=?");
        $stmt->execute([$key]); $attempt['attempt_count']=0;
    }
    if ((int)$attempt['attempt_count']>=10) {
        $pdo->commit(); respond(429,['error'=>'try_later']);
    }
    $stmt=$pdo->prepare('UPDATE pdg_login_attempts SET attempt_count=attempt_count+1 WHERE identifier_hash=?');
    $stmt->execute([$key]); $pdo->commit();
    $stmt=$pdo->prepare('SELECT id,email,password_hash,role,is_active FROM pdg_users WHERE email=? LIMIT 1');
    $stmt->execute([$email]); $user=$stmt->fetch();
    $dummy='$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
    $valid=password_verify($password, $user['password_hash'] ?? $dummy);
    if (!$user || !$valid || (int)$user['is_active']!==1) respond(401,['error'=>'invalid_credentials']);
    session_regenerate_id(true);
    $_SESSION['csrf']=bin2hex(random_bytes(32));
    $_SESSION['user']=['id'=>(int)$user['id'],'email'=>$user['email'],'role'=>$user['role']];
    $_SESSION['login_at']=time(); $_SESSION['last_activity']=time();
    respond(200,['ok'=>true,'user'=>$_SESSION['user']]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    respond(503,['error'=>'service_unavailable']);
}

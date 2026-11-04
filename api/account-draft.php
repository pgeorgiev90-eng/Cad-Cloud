<?php
declare(strict_types=1);
// Locked pending full security testing and administrator provisioning.
http_response_code(503);
header('Content-Type: application/json; charset=utf-8');
echo '{"error":"account_service_not_enabled"}';
exit;
// Draft: not connected to public forms or deployed. Requires security review and migrations.
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
    respond(200, ['csrf'=>$_SESSION['csrf'], 'user'=>$_SESSION['user'] ?? null]);
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
    respond(200,['ok'=>true,'user'=>$_SESSION['user']]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    respond(503,['error'=>'service_unavailable']);
}

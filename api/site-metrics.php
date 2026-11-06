<?php
declare(strict_types=1);
require __DIR__.'/shop-common.php';
require __DIR__.'/site-metrics-common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') shop_answer(405, ['error'=>'method_not_allowed']);
if (($_COOKIE['pdg_statistics'] ?? '') !== 'yes' ||
    !in_array($_SERVER['HTTP_ORIGIN'] ?? '', ['https://pdgsystems.bg','https://www.pdgsystems.bg'], true)) {
    shop_answer(403, ['error'=>'consent_required']);
}
$data = json_decode(file_get_contents('php://input', false, null, 0, 1024), true);
$event = $data['event'] ?? '';
$source = $data['source'] ?? '';
$item = $data['item'] ?? '';
$categories = ['all','solar','panels','inverters','batteries','mounting','electrical','protection','enclosures','accessories',
    'bms','battery_accessories','storage','chargers','energy_management','system_cabinets'];
if (!in_array($source, ['google','facebook','direct','other'], true) ||
    !in_array($event, ['visit','phone','enquiry','solar_cad','electric_cad','registration','category','product','cart_add'], true) ||
    !is_string($item) ||
    ($event === 'category' ? !in_array($item, $categories, true) :
        ($event === 'product' ? !preg_match('/^[1-9][0-9]{0,9}$/D', $item) : $item !== ''))) {
    shop_answer(422, ['error'=>'invalid_event']);
}
try {
    shop_session();
    $minute = intdiv(time(), 60);
    if (($_SESSION['metric_minute'] ?? null) !== $minute) {
        $_SESSION['metric_minute'] = $minute;
        $_SESSION['metric_count'] = 0;
    }
    if (++$_SESSION['metric_count'] > 30) shop_answer(429, ['error'=>'try_later']);
    session_write_close();
    $db = shop_db();
    pdg_metrics_schema($db);
    $q = $db->prepare('INSERT INTO pdg_site_metrics (day,event_name,source,item) VALUES (CURDATE(),?,?,?)
        ON DUPLICATE KEY UPDATE total=total+1');
    $q->execute([$event,$source,$item]);
    shop_answer(200, ['ok'=>true]);
} catch (Throwable $e) {
    shop_answer(503, ['error'=>'service_unavailable']);
}

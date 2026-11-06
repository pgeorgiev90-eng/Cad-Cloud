<?php
declare(strict_types=1);
require __DIR__.'/admin-common.php';
require __DIR__.'/site-metrics-common.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') pdg_answer(405, ['error'=>'method_not_allowed']);
    [$db] = pdg_admin_session();
    pdg_metrics_schema($db);
    $events = $db->query("SELECT event_name,source,SUM(total) AS total
        FROM pdg_site_metrics WHERE day >= CURDATE()-INTERVAL 29 DAY GROUP BY event_name,source")->fetchAll();
    $categories = $db->query("SELECT item,SUM(total) AS total FROM pdg_site_metrics
        WHERE day >= CURDATE()-INTERVAL 29 DAY AND event_name='category'
        GROUP BY item ORDER BY total DESC,item LIMIT 10")->fetchAll();
    $products = $db->query("SELECT p.id,p.name,SUM(m.total) AS total FROM pdg_site_metrics m JOIN products p ON p.id=CAST(m.item AS UNSIGNED)
        WHERE m.day >= CURDATE()-INTERVAL 29 DAY AND m.event_name='product'
        GROUP BY p.id,p.name ORDER BY total DESC,p.id LIMIT 10")->fetchAll();
    pdg_answer(200, ['events'=>$events,'categories'=>$categories,'products'=>$products]);
} catch (Throwable $e) {
    pdg_answer(503, ['error'=>'service_unavailable']);
}

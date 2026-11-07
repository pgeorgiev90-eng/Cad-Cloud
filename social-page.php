<?php
declare(strict_types=1);
require_once __DIR__.'/api/social-metadata.php';
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-cache');
$base = 'https://pdgsystems.bg/';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$productPage = $path === '/product.html';
$catalogPage = $path === '/catalog.html';
if (!$productPage && !$catalogPage) { http_response_code(404); exit('Page not found'); }
$template = file_get_contents(__DIR__.($productPage ? '/product.html' : '/catalog.html'));
$data = [
    'title' => 'Продуктов каталог | PDG Systems',
    'description' => 'Инвертори, батерии, конструкции и електроапаратура. Технически характеристики и оборудване от PDG Systems.',
    'url' => $base.'catalog.html'
];
try {
    if ($productPage) {
        $rawId = $_GET['id'] ?? null;
        $id = is_string($rawId) && preg_match('/^[1-9][0-9]*$/D', $rawId)
            ? filter_var($rawId, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]) : false;
        $p = false;
        if ($id !== false) {
            $db = pdg_social_db();
            $q = $db->prepare('SELECT id,brand,category,code,name,image_url FROM products WHERE id=? AND active=1');
            $q->execute([$id]);
            $p = $q->fetch();
        }
        if (!$p) {
            http_response_code(404);
            header('X-Robots-Tag: noindex');
            $data['title'] = 'Продуктът не е намерен | PDG Systems';
        } else {
            $description = trim($p['brand'].' · '.$p['category'].' · Код: '.$p['code'].'. Технически характеристики и запитване към PDG Systems.');
            try {
                $q = $db->prepare("SELECT value FROM pdg_product_fields WHERE product_id=? AND label='Описание' ORDER BY sort_order,id LIMIT 1");
                $q->execute([$id]);
                $full = trim(strip_tags((string)$q->fetchColumn()));
                if ($full !== '') $description = mb_substr(preg_replace('/\\s+/u', ' ', $full), 0, 200, 'UTF-8');
            } catch (PDOException $e) {
                if ($e->getCode() !== '42S02') throw $e;
            }
            $data = [
                'title' => $p['name'].' | PDG Systems',
                'description' => $description,
                'url' => $base.'product.html?id='.$p['id'],
                'image' => $p['image_url'] ?: $base.'assets/pdg-social.jpg',
                'alt' => $p['brand'].' '.$p['name'],
                'type' => 'product'
            ];
        }
    } else {
        $sections = [
            'inverters'=>'Инвертори', 'batteries'=>'Батерии', 'mounting'=>'Конструкции и крепежи',
            'bms'=>'BMS модули', 'battery_accessories'=>'Аксесоари за батерии', 'storage'=>'Системи за съхранение',
            'chargers'=>'Зарядни станции', 'energy_management'=>'Енергийно управление', 'system_cabinets'=>'Системни шкафове',
            'panels'=>'Фотоволтаични панели', 'electrical'=>'Електроапаратура', 'protection'=>'Защити и апаратура',
            'enclosures'=>'Табла и кутии', 'accessories'=>'Кабели и аксесоари'
        ];
        $params = []; $label = '';
        $section = $_GET['section'] ?? '';
        if (is_string($section) && isset($sections[$section])) {
            $params['section'] = $section;
            $label = $sections[$section];
        }
        foreach (['brand','category'] as $key) {
            $value = $_GET[$key] ?? '';
            if (!is_string($value) || $value === '' || mb_strlen($value, 'UTF-8') > 300) continue;
            $db = $db ?? pdg_social_db();
            $q = $db->prepare('SELECT 1 FROM products WHERE active=1 AND '.$key.'=? LIMIT 1');
            $q->execute([$value]);
            if ($q->fetchColumn()) { $params[$key] = $value; $label = $value; }
        }
        if ($label !== '') {
            $data['title'] = $label.' | PDG Systems';
            $data['description'] = $label.' — продуктов каталог на PDG Systems. Разгледайте оборудването, техническите характеристики и снимките и изпратете запитване.';
            $data['url'] = $base.'catalog.html?'.http_build_query($params, '', '&', PHP_QUERY_RFC3986);
        }
    }
} catch (Throwable $e) {
    http_response_code(503);
    header('Retry-After: 300');
    header('X-Robots-Tag: noindex');
    $data['title'] = 'Каталогът временно е недостъпен | PDG Systems';
}
echo pdg_social_render($template, $data);

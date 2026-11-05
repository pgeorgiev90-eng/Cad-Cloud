<?php
declare(strict_types=1);

require __DIR__ . '/../api/schrack-shop-bootstrap.php';
$settings = require dirname(__DIR__, 2) . '/pdg-shop-db.php';
$db = new PDO(
    'mysql:host='.$settings['host'].';dbname='.$settings['database'].';charset=utf8mb4',
    $settings['username'],
    $settings['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$json = file_get_contents(__DIR__ . '/../database/schrack-shop-catalog.json');
$items = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
$fixture = array_values(array_filter($items, fn($item) => !empty($item['image'])))[0];
$find = $db->prepare("SELECT id,price,image_url FROM products WHERE brand='Schrack Technik' AND code=?");
$find->execute([$fixture['code']]);
$before = $find->fetch(PDO::FETCH_ASSOC);
$stale = $db->prepare("UPDATE products SET image_url=NULL, price=123.45 WHERE id=?");
$stale->execute([$before['id']]);
$reset = $db->prepare('DELETE FROM pdg_catalog_migrations WHERE name=?');
$reset->execute(['schrack_shop_' . substr(hash('sha256', $json), 0, 24)]);
pdg_import_schrack_shop($db);
$find->execute([$fixture['code']]);
$after = $find->fetch(PDO::FETCH_ASSOC);
if ($after['id'] !== $before['id'] || $after['price'] !== '123.45' || $after['image_url'] !== $fixture['image']) {
    throw new RuntimeException('Existing product photo was not refreshed safely');
}
echo "PASS: photo refresh preserves product ID and administrator price\n";

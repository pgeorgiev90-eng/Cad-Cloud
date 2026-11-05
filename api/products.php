<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
  $config = dirname(__DIR__, 2) . '/pdg-shop-db.php';
  if (!is_file($config)) { http_response_code(503); echo json_encode(['error'=>'database_not_configured']); exit; }
  $settings = require $config;
  if (!is_array($settings)) { throw new RuntimeException('Invalid configuration'); }
  $pdo = new PDO('mysql:host='.($settings['host']??'localhost').';dbname='.($settings['database']??'').';charset=utf8mb4', $settings['username']??'', $settings['password']??'', [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
  // One-time, idempotent bootstrap from version-controlled catalog data.
  // Only the server's bundled SQL is executed; no user-supplied SQL is accepted.
  $schema = dirname(__DIR__) . '/database/schema.sql';
  $seed = dirname(__DIR__) . '/database/import-catalog.sql';
  if (is_file($schema) && is_file($seed)) {
    $pdo->exec(file_get_contents($schema));
    $count = (int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
    if ($count === 0 && (int)$pdo->query("SELECT GET_LOCK('pdg_catalog_seed_v1', 10)")->fetchColumn() === 1) {
      try {
        if ((int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn() === 0) {
          $sql = file_get_contents($seed);
          foreach (preg_split('/;\\s*(?:\\r?\\n|$)/', $sql) as $statement) {
            $statement = trim(preg_replace('/^--[^\\r\\n]*[\\r\\n]+/m', '', $statement));
            if ($statement !== '') $pdo->exec($statement);
          }
        }
      } finally {
        $pdo->query("SELECT RELEASE_LOCK('pdg_catalog_seed_v1')");
      }
    }
  }
  require_once __DIR__.'/product-phase-bootstrap.php';
  pdg_seed_inverter_phases($pdo);
  require_once __DIR__ . '/product-spec-bootstrap.php';
  pdg_seed_product_specifications($pdo);
  require_once __DIR__.'/product-category-bootstrap.php';
  pdg_classify_catalog_products($pdo);
  require_once __DIR__.'/product-content-bootstrap.php';
  pdg_seed_product_content($pdo);
  require_once __DIR__.'/schrack-shop-bootstrap.php';
  pdg_import_schrack_shop($pdo);
  $rows=$pdo->query('SELECT id, brand, category, code, name, price, image_url AS imageUrl, image_index AS imageIndex, (SELECT value FROM pdg_product_fields WHERE product_id=products.id AND label=\'Описание\' ORDER BY id LIMIT 1) AS description, (SELECT value FROM pdg_product_fields WHERE product_id=products.id AND label=\'Бележка за снимката\' ORDER BY id LIMIT 1) AS imageCaption FROM products WHERE active=1 ORDER BY id')->fetchAll();
  echo json_encode(['products'=>$rows],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $e) { http_response_code(503); echo json_encode(['error'=>'catalog_unavailable']); }

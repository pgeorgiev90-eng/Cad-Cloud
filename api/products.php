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
  $rows=$pdo->query('SELECT brand, category, code, name, price, image_url AS imageUrl, image_index AS imageIndex FROM products WHERE active=1 ORDER BY id')->fetchAll();
  echo json_encode(['products'=>$rows],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $e) { http_response_code(503); echo json_encode(['error'=>'catalog_unavailable']); }

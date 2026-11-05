<?php
declare(strict_types=1);
require dirname(__DIR__).'/api/product-phase-bootstrap.php';
// Isolated CI database only. No application configuration or production credentials are loaded.
$db=new PDO('mysql:host=127.0.0.1;dbname=pdg_migration_test;charset=utf8mb4','root','ci-only-password',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db->exec(file_get_contents(dirname(__DIR__).'/database/schema.sql'));
$rows=json_decode(file_get_contents(dirname(__DIR__).'/database/inverter-phases-v1.json'),true);
$insert=$db->prepare("INSERT INTO products(brand,category,name,code) VALUES('SolaX','Инвертори',?,?)");
foreach($rows as $r)$insert->execute([$r['name'],$r['name']]);
pdg_seed_inverter_phases($db);
$count=(int)$db->query("SELECT COUNT(*) FROM pdg_product_fields WHERE label='Брой фази'")->fetchColumn();
if($count!==45)throw new RuntimeException('Phase migration did not populate 45 models');
$wrong=(int)$db->query("SELECT COUNT(*) FROM pdg_product_fields f JOIN products p ON p.id=f.product_id WHERE f.label='Брой фази' AND ((p.name LIKE 'X1-%' AND f.value<>'1') OR(p.name LIKE 'X3-%' AND f.value<>'3'))")->fetchColumn();
if($wrong)throw new RuntimeException('Invalid migrated phases');
$id=(int)$db->query('SELECT MIN(id) FROM products')->fetchColumn();
$db->exec("UPDATE pdg_product_fields SET value='3' WHERE product_id=$id AND label='Брой фази'");
$db->exec('DELETE FROM pdg_catalog_migrations');
pdg_seed_inverter_phases($db);
pdg_seed_inverter_phases($db);
if((int)$db->query("SELECT value FROM pdg_product_fields WHERE product_id=$id AND label='Брой фази'")->fetchColumn()!==3)throw new RuntimeException('Migration overwrote administrator edit');
if((int)$db->query("SELECT COUNT(*) FROM pdg_product_fields WHERE label='Брой фази'")->fetchColumn()!==45)throw new RuntimeException('Duplicate fields');
echo "PASS: isolated phase migration, 45 models, idempotence and preserved administrator edits\n";

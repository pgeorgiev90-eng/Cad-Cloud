<?php
declare(strict_types=1);
require dirname(__DIR__).'/api/product-phase-bootstrap.php';
require dirname(__DIR__).'/api/product-spec-bootstrap.php';
// This test uses only the isolated CI MySQL service.
$db=new PDO('mysql:host=127.0.0.1;dbname=pdg_migration_test;charset=utf8mb4','root','ci-only-password',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$rows=json_decode(file_get_contents(dirname(__DIR__).'/database/catalog-specifications-v1.json'),true);
$find=$db->prepare('SELECT id FROM products WHERE brand=? AND category=? AND code=? AND name=?');
$insert=$db->prepare('INSERT INTO products(brand,category,code,name) VALUES(?,?,?,?)');
foreach($rows as $r){$m=$r['match'];$values=[$m['brand'],$m['category'],$m['code'],$m['name']];$find->execute($values);if(!$find->fetchColumn())$insert->execute($values);}
pdg_seed_inverter_phases($db);
$product=(int)$db->query("SELECT id FROM products WHERE name='X1-BOOST-5K-G4' LIMIT 1")->fetchColumn();
$q=$db->prepare('INSERT INTO pdg_product_fields(product_id,label,value) VALUES(?,?,?)');$q->execute([$product,'Номинална AC мощност (kW)','5.1']);
pdg_seed_product_specifications($db);
pdg_seed_product_specifications($db);
foreach($rows as $r){$m=$r['match'];$find->execute([$m['brand'],$m['category'],$m['code'],$m['name']]);$id=(int)$find->fetchColumn();$q=$db->prepare('SELECT COUNT(*) FROM pdg_product_fields WHERE product_id=?');$q->execute([$id]);if((int)$q->fetchColumn()<3)throw new RuntimeException('Missing product specifications');}
$q=$db->prepare('SELECT value FROM pdg_product_fields WHERE product_id=? AND label=?');$q->execute([$product,'Номинална AC мощност (kW)']);if($q->fetchColumn()!=='5.1')throw new RuntimeException('Administrator correction was overwritten');
if((int)$db->query("SELECT COUNT(*) FROM pdg_product_spec_sources WHERE version='catalog_specifications_v1'")->fetchColumn()!==204)throw new RuntimeException('Missing provenance records');
$duplicates=(int)$db->query('SELECT COUNT(*) FROM (SELECT product_id,label,COUNT(*) c FROM pdg_product_fields GROUP BY product_id,label HAVING c>1) x')->fetchColumn();if($duplicates)throw new RuntimeException('Duplicate imported fields');
echo "PASS: all 204 products populated, variant matching, idempotence, separate provenance and administrator corrections preserved\n";

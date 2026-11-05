<?php
declare(strict_types=1);
require dirname(__DIR__).'/api/product-category-bootstrap.php';
$db=new PDO('mysql:host=127.0.0.1;dbname=pdg_migration_test;charset=utf8mb4','root','ci-only-password',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$before=$db->query('SELECT id,brand,code,name,price FROM products ORDER BY id')->fetchAll();
pdg_classify_catalog_products($db);pdg_classify_catalog_products($db);
foreach(['Инвертори'=>45,'Батерии'=>5,'BMS модули'=>5,'Аксесоари за батерии'=>1,'Системи за съхранение'=>4] as $category=>$expected){
 $q=$db->prepare('SELECT COUNT(*) FROM products WHERE category=?');$q->execute([$category]);if((int)$q->fetchColumn()!==$expected)throw new RuntimeException('Invalid category: '.$category);
}
if((int)$db->query("SELECT COUNT(*) FROM products WHERE category='Батерии и аксесоари'")->fetchColumn()!==0)throw new RuntimeException('Unclassified mixed category');
$after=$db->query('SELECT id,brand,code,name,price FROM products ORDER BY id')->fetchAll();if($before!==$after)throw new RuntimeException('Product identities or prices changed');
$id=(int)$db->query("SELECT id FROM products WHERE name='TB-HS51'")->fetchColumn();
$q=$db->prepare('UPDATE products SET category=? WHERE id=?');$q->execute(['Специални батерии',$id]);pdg_classify_catalog_products($db);
$check=$db->prepare('SELECT category FROM products WHERE id=?');$check->execute([$id]);if($check->fetchColumn()!=='Специални батерии')throw new RuntimeException('Administrator category edit overwritten');
$q->execute(['Батерии',$id]);
echo "PASS: technical-role classification, separate batteries/BMS/accessories, unchanged IDs/prices and preserved administrator edits\n";

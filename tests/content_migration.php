<?php
declare(strict_types=1);
require dirname(__DIR__).'/api/product-content-bootstrap.php';
$db=new PDO('mysql:host=127.0.0.1;dbname=pdg_migration_test;charset=utf8mb4','root','ci-only-password',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$rows=json_decode(file_get_contents(dirname(__DIR__).'/database/catalog-content-v1.json'),true,512,JSON_THROW_ON_ERROR);
$before=$db->query('SELECT id,brand,category,code,name,price,image_url,image_index FROM products ORDER BY id')->fetchAll();
$id=(int)$db->query("SELECT id FROM products WHERE code='TRB-D10' LIMIT 1")->fetchColumn();
$q=$db->prepare('INSERT INTO pdg_product_fields(product_id,label,value) VALUES(?,?,?)');$q->execute([$id,'Описание','Administrator description']);
$q=$db->prepare('UPDATE products SET image_url=? WHERE id=?');$q->execute(['https://example.com/administrator.webp',$id]);
pdg_seed_product_content($db);pdg_seed_product_content($db);
$find=$db->prepare('SELECT id,image_url,image_index FROM products WHERE brand=? AND category=? AND code=? AND name=?');
$fields=$db->prepare("SELECT value FROM pdg_product_fields WHERE product_id=? AND label='Описание'");
foreach($rows as $r){$m=$r['match'];$find->execute([$m['brand'],$m['category'],$m['code'],$m['name']]);$p=$find->fetch();if(!$p)throw new RuntimeException('Missing exact variant');$fields->execute([$p['id']]);if(!$fields->fetchColumn())throw new RuntimeException('Missing description');if(isset($r['imageUrl'])&&!$p['image_url']&&$p['image_index']===null)throw new RuntimeException('Missing image');}
$fields->execute([$id]);if($fields->fetchColumn()!=='Administrator description')throw new RuntimeException('Description overwritten');
$find->execute(['Enerack','МИНИ РЕЙЛ','TRB-D10','Релса мини рейл R26мм L385мм']);if($find->fetch()['image_url']!=='https://example.com/administrator.webp')throw new RuntimeException('Image overwritten');
$after=$db->query('SELECT id,brand,category,code,name,price,image_url,image_index FROM products ORDER BY id')->fetchAll();
foreach($before as $i=>$p){foreach(['id','brand','category','code','name','price','image_index'] as $k)if($p[$k]!==$after[$i][$k])throw new RuntimeException('Product identity/price changed');if(($p['image_url']||$p['image_index']!==null)&&$p['image_url']!==$after[$i]['image_url'])throw new RuntimeException('Existing image replaced');}
if((int)$db->query('SELECT COUNT(*) FROM pdg_product_content_sources')->fetchColumn()!==204)throw new RuntimeException('Missing provenance');
if((int)$db->query("SELECT COUNT(*) FROM (SELECT product_id,COUNT(*) c FROM pdg_product_fields WHERE label='Описание' GROUP BY product_id HAVING c>1) t")->fetchColumn())throw new RuntimeException('Duplicate descriptions');
echo "PASS: 204 descriptions, missing images populated, exact variants, idempotence, preserved admin content, existing images and prices\n";

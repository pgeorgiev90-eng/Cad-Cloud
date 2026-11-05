<?php
declare(strict_types=1);
// One-time additive migration from a reviewed, exact model list. Never infer from X1/X3 at runtime.
function pdg_seed_inverter_phases(PDO $db): void {
 $db->exec('CREATE TABLE IF NOT EXISTS pdg_catalog_migrations (name VARCHAR(190) NOT NULL PRIMARY KEY,applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
 $version='inverter_phases_v1';$q=$db->prepare('SELECT name FROM pdg_catalog_migrations WHERE name=?');$q->execute([$version]);if($q->fetchColumn())return;
 if((int)$db->query("SELECT GET_LOCK('pdg_inverter_phases_v1',5)")->fetchColumn()!==1)return;
 try{
  $q->execute([$version]);if($q->fetchColumn())return;
  $db->exec('CREATE TABLE IF NOT EXISTS pdg_product_fields (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,product_id BIGINT UNSIGNED NOT NULL,label VARCHAR(100) NOT NULL,value TEXT NOT NULL,sort_order INT UNSIGNED NOT NULL DEFAULT 0,CONSTRAINT fk_pdg_fields_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,KEY idx_pdg_fields_product(product_id,sort_order)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
  $rows=json_decode((string)file_get_contents(dirname(__DIR__).'/database/inverter-phases-v1.json'),true,512,JSON_THROW_ON_ERROR);
  $db->beginTransaction();
  $product=$db->prepare("SELECT id FROM products WHERE brand='SolaX' AND name=? AND category='Инвертори' FOR UPDATE");
  $existing=$db->prepare('SELECT label FROM pdg_product_fields WHERE product_id=?');
  $insert=$db->prepare('INSERT INTO pdg_product_fields(product_id,label,value,sort_order) VALUES(?,?,?,?)');
  $aliases=['брой фази','фазност','фази','phase','phases','number of phases','ac phases'];
  foreach($rows as $row){
   if(!in_array($row['phases'],[1,3],true))throw new RuntimeException('Invalid phase seed');
   $product->execute([$row['name']]);foreach($product->fetchAll(PDO::FETCH_COLUMN) as $id){
    $existing->execute([$id]);$labels=array_map(fn($x)=>mb_strtolower(trim($x),'UTF-8'),$existing->fetchAll(PDO::FETCH_COLUMN));
    if(array_intersect($labels,$aliases))continue;
    $insert->execute([$id,'Брой фази',(string)$row['phases'],0]);
    if(!in_array('източник за фазност',$labels,true))$insert->execute([$id,'Източник за фазност',$row['source'],1]);
   }
  }
  $q=$db->prepare('INSERT INTO pdg_catalog_migrations(name) VALUES(?)');$q->execute([$version]);$db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 finally{$db->query("SELECT RELEASE_LOCK('pdg_inverter_phases_v1')");}
}

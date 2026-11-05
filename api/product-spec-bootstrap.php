<?php
declare(strict_types=1);
// Reviewed, versioned catalog facts. Match the complete variant identity, never SKU alone.
function pdg_seed_product_specifications(PDO $db): void {
 $version='catalog_specifications_v1';
 $q=$db->prepare('SELECT name FROM pdg_catalog_migrations WHERE name=?');$q->execute([$version]);if($q->fetchColumn())return;
 if((int)$db->query("SELECT GET_LOCK('pdg_catalog_specifications_v1',10)")->fetchColumn()!==1)return;
 try{
  $q->execute([$version]);if($q->fetchColumn())return;
  $rows=json_decode((string)file_get_contents(dirname(__DIR__).'/database/catalog-specifications-v1.json'),true,512,JSON_THROW_ON_ERROR);
  $db->exec('CREATE TABLE IF NOT EXISTS pdg_product_spec_sources(product_id BIGINT UNSIGNED NOT NULL,version VARCHAR(190) NOT NULL,sources_json TEXT NOT NULL,imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(product_id,version),CONSTRAINT fk_pdg_spec_source_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
  $db->beginTransaction();
  $find=$db->prepare('SELECT id FROM products WHERE brand=? AND category=? AND code=? AND name=? FOR UPDATE');
  $existing=$db->prepare('SELECT label FROM pdg_product_fields WHERE product_id=?');
  $insert=$db->prepare('INSERT INTO pdg_product_fields(product_id,label,value,sort_order) VALUES(?,?,?,?)');
  $source=$db->prepare('INSERT INTO pdg_product_spec_sources(product_id,version,sources_json) VALUES(?,?,?)');
  foreach($rows as $row){
   $m=$row['match'];$find->execute([$m['brand'],$m['category'],$m['code'],$m['name']]);
   foreach($find->fetchAll(PDO::FETCH_COLUMN) as $id){
    $existing->execute([$id]);$labels=array_map(fn($x)=>mb_strtolower(trim($x),'UTF-8'),$existing->fetchAll(PDO::FETCH_COLUMN));
    foreach($row['fields'] as $index=>$field){
     if(!is_string($field['label'])||!is_string($field['value'])||mb_strlen($field['label'],'UTF-8')>100||mb_strlen($field['value'],'UTF-8')>1000)throw new RuntimeException('Invalid specification bundle');
     $label=mb_strtolower(trim($field['label']),'UTF-8');
     if(in_array($label,$labels,true))continue; // Preserve administrator-entered values.
     $insert->execute([$id,$field['label'],$field['value'],10+$index]);$labels[]=$label;
    }
    $source->execute([$id,$version,json_encode($row['sources'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
   }
  }
  $q=$db->prepare('INSERT INTO pdg_catalog_migrations(name) VALUES(?)');$q->execute([$version]);$db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 finally{$db->query("SELECT RELEASE_LOCK('pdg_catalog_specifications_v1')");}
}

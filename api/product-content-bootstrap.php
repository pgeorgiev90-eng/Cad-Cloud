<?php
declare(strict_types=1);
// Add missing content only. Full variant matching protects reused mounting SKUs.
function pdg_seed_product_content(PDO $db): void {
 $version='catalog_content_v1';
 $q=$db->prepare('SELECT name FROM pdg_catalog_migrations WHERE name=?');
 $q->execute([$version]);if($q->fetchColumn())return;
 if((int)$db->query("SELECT GET_LOCK('pdg_catalog_content_v1',10)")->fetchColumn()!==1)throw new RuntimeException('Catalog content migration busy');
 try{
  $q->execute([$version]);if($q->fetchColumn())return;
  $rows=json_decode((string)file_get_contents(dirname(__DIR__).'/database/catalog-content-v1.json'),true,512,JSON_THROW_ON_ERROR);
  $db->exec('CREATE TABLE IF NOT EXISTS pdg_product_content_sources(product_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,sources_json TEXT NOT NULL,CONSTRAINT fk_pdg_content_product FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
  $db->beginTransaction();
  $find=$db->prepare('SELECT id FROM products WHERE brand=? AND category=? AND code=? AND name=? FOR UPDATE');
  $fields=$db->prepare('SELECT label FROM pdg_product_fields WHERE product_id=?');
  $insert=$db->prepare('INSERT INTO pdg_product_fields(product_id,label,value,sort_order) VALUES(?,?,?,?)');
  $image=$db->prepare("UPDATE products SET image_url=? WHERE id=? AND (image_url IS NULL OR TRIM(image_url)='') AND image_index IS NULL");
  $provenance=$db->prepare('INSERT INTO pdg_product_content_sources(product_id,sources_json) VALUES(?,?)');
  foreach($rows as $r){
   if(!is_string($r['description'])||mb_strlen($r['description'],'UTF-8')>1000)throw new RuntimeException('Invalid product description');
   $m=$r['match'];$find->execute([$m['brand'],$m['category'],$m['code'],$m['name']]);
   foreach($find->fetchAll(PDO::FETCH_COLUMN) as $id){
    $fields->execute([$id]);$labels=array_map(fn($v)=>mb_strtolower(trim($v),'UTF-8'),$fields->fetchAll(PDO::FETCH_COLUMN));
    if(!in_array('описание',$labels,true))$insert->execute([$id,'Описание',$r['description'],90]);
    if(isset($r['imageUrl'])){
     if(!preg_match('~^https://pdgsystems\.bg/assets/products/[a-z0-9-]+\.webp$~D',$r['imageUrl']))throw new RuntimeException('Invalid product image');
     $image->execute([$r['imageUrl'],$id]);
     if($image->rowCount()===1&&!in_array('бележка за снимката',$labels,true))$insert->execute([$id,'Бележка за снимката',$r['imageCaption'],91]);
    }
    $provenance->execute([$id,json_encode(['description'=>$r['sources'],'image'=>$r['imageSource']??null],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);
   }
  }
  $q=$db->prepare('INSERT INTO pdg_catalog_migrations(name) VALUES(?)');$q->execute([$version]);$db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 finally{$db->query("SELECT RELEASE_LOCK('pdg_catalog_content_v1')");}
}

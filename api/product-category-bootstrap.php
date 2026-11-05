<?php
declare(strict_types=1);
function pdg_classify_catalog_products(PDO $db): void {
 $version='catalog_battery_categories_v1';$q=$db->prepare('SELECT name FROM pdg_catalog_migrations WHERE name=?');$q->execute([$version]);if($q->fetchColumn())return;
 if((int)$db->query("SELECT GET_LOCK('pdg_catalog_categories_v1',10)")->fetchColumn()!==1)return;
 try{
  $q->execute([$version]);if($q->fetchColumn())return;
  $db->beginTransaction();
  // Use the technical role stored on each article; a BMS is not a battery module.
  $update=$db->prepare("UPDATE products p JOIN pdg_product_fields f ON f.product_id=p.id SET p.category=? WHERE p.brand='SolaX' AND p.category='Батерии и аксесоари' AND f.label=? AND f.value=?");
  $update->execute(['Батерии','Тип устройство','Батериен модул']);
  $update->execute(['Батерии','Тип устройство','Батериен модул master/slave']);
  $update->execute(['BMS модули','Тип устройство','BMS / управляващ модул']);
  $update->execute(['Аксесоари за батерии','Тип компонент','Основа за фиксиране на батериен клъстер']);
  $q=$db->prepare('INSERT INTO pdg_catalog_migrations(name) VALUES(?)');$q->execute([$version]);$db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
 finally{$db->query("SELECT RELEASE_LOCK('pdg_catalog_categories_v1')");}
}

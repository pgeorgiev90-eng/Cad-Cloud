<?php
declare(strict_types=1);

function pdg_import_schrack_shop(PDO $db): void {
    $path = dirname(__DIR__) . '/database/schrack-shop-catalog.json';
    $json = file_get_contents($path);
    if ($json === false) throw new RuntimeException('Schrack catalog unavailable');
    $version = 'schrack_shop_' . substr(hash('sha256', $json), 0, 24);
    $migration = $db->prepare('SELECT name FROM pdg_catalog_migrations WHERE name=?');
    $migration->execute([$version]);
    if ($migration->fetchColumn()) return;
    if ((int)$db->query("SELECT GET_LOCK('pdg_schrack_shop',10)")->fetchColumn() !== 1) {
        throw new RuntimeException('Schrack import busy');
    }
    try {
        $migration->execute([$version]);
        if ($migration->fetchColumn()) return;
        $items = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        $existing = $db->prepare("SELECT id FROM products WHERE brand IN ('Schrack','Schrack Technik') AND REPLACE(code,'-','')=? LIMIT 1");
        $insert = $db->prepare('INSERT INTO products (brand,category,code,name,image_url,price) VALUES (?,?,?,?,?,?)');
        $field = $db->prepare('INSERT INTO pdg_product_fields(product_id,label,value,sort_order) VALUES (?,?,?,?)');
        $db->beginTransaction();
        foreach ($items as $item) {
            $existing->execute([str_replace('-', '', $item['code'])]);
            if ($existing->fetchColumn()) continue;
            $insert->execute(['Schrack Technik',$item['category'],$item['code'],$item['name'],$item['image'] ?: null,$item['price']]);
            if ($item['source']) {
                $field->execute([$db->lastInsertId(),'Страница на производителя',$item['source'],50]);
            }
        }
        $db->prepare('INSERT INTO pdg_catalog_migrations(name) VALUES(?)')->execute([$version]);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    } finally {
        $db->query("SELECT RELEASE_LOCK('pdg_schrack_shop')");
    }
}

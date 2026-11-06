<?php
declare(strict_types=1);

function pdg_metrics_schema(PDO $db): void {
    $db->exec('CREATE TABLE IF NOT EXISTS pdg_site_metrics (
        day DATE NOT NULL,
        event_name VARCHAR(30) NOT NULL,
        source VARCHAR(16) NOT NULL,
        item VARCHAR(40) NOT NULL,
        total BIGINT UNSIGNED NOT NULL DEFAULT 1,
        PRIMARY KEY (day,event_name,source,item)
    ) ENGINE=InnoDB');
}

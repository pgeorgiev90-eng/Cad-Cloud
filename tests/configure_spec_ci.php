<?php
declare(strict_types=1);
// Hard-coded isolated CI service only; never read application secrets here.
$settings=['host'=>'127.0.0.1','database'=>'pdg_migration_test','username'=>'root','password'=>'ci-only-password'];
file_put_contents(dirname(__DIR__,2).'/pdg-shop-db.php','<?php return '.var_export($settings,true).';');

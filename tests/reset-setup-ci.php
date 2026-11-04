<?php
declare(strict_types=1);
// Only runs against the isolated CI service, never the production database.
$db=new PDO('mysql:host=127.0.0.1;dbname=pdg_test;charset=utf8mb4','root','test-root-password',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('DELETE FROM pdg_users');
$db->exec('DELETE FROM pdg_login_attempts');

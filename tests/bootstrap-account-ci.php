<?php
declare(strict_types=1);
// CI-only setup: use a throwaway MySQL service and known fixture credentials.
$pdo=new PDO('mysql:host=127.0.0.1;dbname=pdg_test;charset=utf8mb4','root','test-root-password',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
foreach (['database/schema.sql','database/accounts-schema.sql'] as $file) $pdo->exec(file_get_contents($file));
$q=$pdo->prepare('INSERT INTO pdg_users (email,password_hash,role) VALUES (?,?,?)');
$q->execute(['admin@example.test',password_hash('Admin-test-123456',PASSWORD_DEFAULT),'admin']);
$q->execute(['customer@example.test',password_hash('Customer-test-123456',PASSWORD_DEFAULT),'customer']);
$config='<?php return '.var_export(['host'=>'127.0.0.1','database'=>'pdg_test','username'=>'root','password'=>'test-root-password','registration_enabled'=>true,'setup_secret'=>'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef','setup_expires_at'=>time()+1800],true).';';
file_put_contents(dirname(__DIR__,2).'/pdg-shop-db.php',$config);
file_put_contents(sys_get_temp_dir().'/pdg-test-https.php',"<?php \$_SERVER['HTTPS']='on';");

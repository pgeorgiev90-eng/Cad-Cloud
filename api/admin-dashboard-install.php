<?php
declare(strict_types=1);
require_once __DIR__.'/admin-common.php';
try {
 [$db,$id]=pdg_admin_session();
 if($_SERVER['REQUEST_METHOD']!=='POST')pdg_answer(405,['error'=>'method_not_allowed']);
 $schema=file_get_contents(dirname(__DIR__).'/database/admin-dashboard-schema.sql');
 if($schema===false)throw new RuntimeException('schema');
 foreach(preg_split('/;\s*(?:\r?\n|$)/',$schema) as $statement){
  $statement=trim(preg_replace('/^--[^\r\n]*[\r\n]+/m','',$statement));
  if($statement!=='')$db->exec($statement);
 }
 pdg_answer(200,['ok'=>true]);
} catch(Throwable $e){pdg_answer(503,['error'=>'installation_failed']);}

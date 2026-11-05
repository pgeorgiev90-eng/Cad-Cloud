<?php
declare(strict_types=1);
require __DIR__.'/shop-common.php';require __DIR__.'/electric-common.php';
if($_SERVER['REQUEST_METHOD']!=='GET')shop_answer(405,['error'=>'method_not_allowed']);
try{$db=shop_db();electric_bootstrap($db);$query=substr(trim((string)($_GET['q']??'')),0,100);$products=electric_products($db,$query);if(!$products&&($_GET['lookup']??'')==='1'&&$query!==''){$p=electric_import_article($db,$query);if($p)$products=[$p];}$rates=array_values(electric_rates($db));shop_answer(200,['products'=>$products,'busbarRates'=>$rates,'currency'=>'EUR','labour_included'=>false]);}catch(Throwable $e){shop_answer(503,['error'=>'catalog_unavailable']);}

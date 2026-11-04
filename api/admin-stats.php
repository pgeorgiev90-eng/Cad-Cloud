<?php
declare(strict_types=1);
require_once __DIR__.'/admin-common.php';
try{
 [$db,$actor]=pdg_admin_session();if($_SERVER['REQUEST_METHOD']!=='GET')pdg_answer(405,['error'=>'method_not_allowed']);
 $totals=$db->query("SELECT COUNT(DISTINCT CASE WHEN viewed_at>=CURDATE() THEN visitor_hash END) AS today, COUNT(DISTINCT CASE WHEN viewed_at>=DATE_FORMAT(CURDATE(),'%Y-%m-01') THEN visitor_hash END) AS month FROM pdg_product_views")->fetch();
 $live=$db->query("SELECT p.id,p.name,p.code,u.email,MAX(v.viewed_at) AS last_seen FROM pdg_product_views v JOIN products p ON p.id=v.product_id LEFT JOIN pdg_users u ON u.id=v.user_id WHERE v.viewed_at >= NOW() - INTERVAL 90 SECOND GROUP BY v.visitor_hash,p.id,p.name,p.code,u.email ORDER BY last_seen DESC LIMIT 100")->fetchAll();
 $popular=$db->query("SELECT p.id,p.name,p.code,COUNT(DISTINCT v.visitor_hash) AS visitors FROM pdg_product_views v JOIN products p ON p.id=v.product_id WHERE v.viewed_at>=DATE_FORMAT(CURDATE(),'%Y-%m-01') GROUP BY p.id,p.name,p.code ORDER BY visitors DESC LIMIT 20")->fetchAll();
 $dailyRows=$db->query("SELECT DATE(viewed_at) AS day,COUNT(DISTINCT visitor_hash) AS visitors FROM pdg_product_views WHERE viewed_at>=CURDATE()-INTERVAL 6 DAY AND viewed_at<CURDATE()+INTERVAL 1 DAY GROUP BY DATE(viewed_at) ORDER BY day")->fetchAll();
 $counts=[];foreach($dailyRows as $row)$counts[$row['day']]=(int)$row['visitors'];
 $today=new DateTimeImmutable((string)$db->query('SELECT CURDATE()')->fetchColumn());$daily=[];
 for($i=6;$i>=0;$i--){$day=$today->modify("-$i days")->format('Y-m-d');$daily[]=['day'=>$day,'visitors'=>$counts[$day]??0];}
 pdg_answer(200,['daily'=>$daily,'today'=>(int)$totals['today'],'month'=>(int)$totals['month'],'live'=>$live,'popular'=>$popular]);
}catch(Throwable $e){pdg_answer(503,['error'=>'service_unavailable']);}

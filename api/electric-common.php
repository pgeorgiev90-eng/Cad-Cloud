<?php
declare(strict_types=1);
require_once __DIR__.'/customer-pricing.php';
function electric_bootstrap(PDO $db): void {
 $db->exec(file_get_contents(dirname(__DIR__).'/database/electric-cad-schema.sql'));
 $file=dirname(__DIR__).'/database/electrical-catalog.json';if(!is_file($file))throw new RuntimeException('catalog');
 $hash=hash_file('sha256',$file);$q=$db->prepare('SELECT setting_value FROM pdg_electric_settings WHERE setting_key=?');$q->execute(['catalog_revision']);if($q->fetchColumn()===$hash)return;
 if((int)$db->query("SELECT GET_LOCK('pdg_electric_import',10)")->fetchColumn()!==1)throw new RuntimeException('lock');
 try{$data=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);$db->beginTransaction();$q=$db->prepare('INSERT INTO pdg_electric_products(sku,product_json) VALUES(?,?) ON DUPLICATE KEY UPDATE product_json=VALUES(product_json)');foreach($data['products'] as $p){$q->execute([$p['sku'],json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);} $q=$db->prepare('INSERT INTO pdg_electric_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)');$q->execute(['catalog_revision',$hash]);$db->commit();}catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}finally{$db->query("SELECT RELEASE_LOCK('pdg_electric_import')");}
}
function electric_reference(): array {
 static $data=null;if($data!==null)return $data;$file=dirname(__DIR__).'/database/electrical-reference-prices.json';$data=is_file($file)?json_decode(file_get_contents($file),true):[];return is_array($data)?$data:[];
}
function electric_unit_cents(string $sku,$override): ?int {
 if($override!==null)return (int)$override;$key=preg_replace('/[^A-Z0-9]/','',strtoupper($sku));$c=electric_reference()['products'][$key]??null;return is_int($c)&&$c>=0?$c:null;
}
function electric_rates(PDO $db): array {
 $rates=electric_reference()['busbarRates']??[];foreach($rates as $key=>&$r){$r['profile_key']=$key;$r['priceSource']='schrack_2026_06';}unset($r);
 foreach($db->query('SELECT * FROM pdg_electric_busbar_rates ORDER BY width_mm,thickness_mm')->fetchAll() as $r){$r['priceSource']='admin';$rates[$r['profile_key']]=$r;}return $rates;
}
function electric_products(PDO $db,string $query='',bool $admin=false): array {
 $q=$db->prepare('SELECT sku,product_json,price_cents,active FROM pdg_electric_products WHERE '.($admin?'1=1':'active=1').' AND (sku LIKE ? OR product_json LIKE ?) ORDER BY sku LIMIT 2000');$q->execute(['%'.$query.'%','%'.$query.'%']);$out=[];foreach($q as $row){$p=json_decode($row['product_json'],true,512,JSON_THROW_ON_ERROR);$c=electric_unit_cents($row['sku'],$row['price_cents']);$p['unitPrice']=$c===null?null:$c/100;$p['priceSource']=$row['price_cents']!==null?'admin':($c===null?null:'schrack_2026_06');$p['active']=(bool)$row['active'];$out[]=$p;}return $out;
}
function electric_money($v): ?int {if($v===null||$v==='')return null;if(!is_string($v)||!preg_match('/^(?:0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/D',$v))throw new InvalidArgumentException('price');return (int)round((float)$v*100);}
function electric_shop_key(string $sku): string {
 return rtrim(strtoupper(trim($sku)), '-');
}
function electric_shop_parts(PDO $db): array {
 $parts=[];
 $rows=$db->query("SELECT code,name,category,price FROM products WHERE active=1 ORDER BY id");
 foreach($rows as $row){
  if(!preg_match('~^Електроапаратура(?:\s*/|$)~u',$row['category']))continue;
  $parts[electric_shop_key($row['code'])]??=$row;
 }
 return $parts;
}
function electric_materials(PDO $db,array $input,int $discount=0): array {
 $parts=$input['parts']??null;$bars=$input['busbars']??[];if(!is_array($parts)||count($parts)>500||!is_array($bars)||count($bars)>300)throw new InvalidArgumentException('parts');$lines=[];$total=0;$missing=0;$enclosures=0;
 $q=$db->prepare('SELECT product_json,price_cents FROM pdg_electric_products WHERE sku=? AND active=1');
 $shop=electric_shop_parts($db);
 foreach($parts as $part){
  if(!is_array($part)||!is_string($part['sku']??null)||!is_int($part['quantity']??null)||$part['quantity']<1||$part['quantity']>500)throw new InvalidArgumentException('part');
  $q->execute([$part['sku']]);
  $row=$q->fetch();
  $store=$shop[electric_shop_key($part['sku'])]??null;
  if(!$row&&!$store)throw new InvalidArgumentException('unknown_product');
  $p=$row?json_decode($row['product_json'],true):null;
  $isEnclosure=$p?($p['type']??'')==='ENCLOSURE':str_contains($store['category'],'Табла и корпуси');
  if($isEnclosure)$enclosures+=$part['quantity'];
  $unit=$store?((float)$store['price']>0?(int)round((float)$store['price']*100):null):electric_unit_cents($part['sku'],$row['price_cents']);
  if($store&&$unit!==null)$unit=pdg_discounted_cents($unit,$discount);
  $amount=$unit===null?null:$unit*$part['quantity'];
  if($amount===null)$missing++;else $total+=$amount;
  $lines[]=['sku'=>$part['sku'],'name'=>$p['name']??$store['name'],'quantity'=>$part['quantity'],'unit'=>'бр.','unit_cents'=>$unit,'line_cents'=>$amount];
 }
 $rates=electric_rates($db);
 foreach($bars as $bar){$width=$bar['width']??null;$thickness=$bar['thickness']??null;$points=$bar['points']??null;if(!is_numeric($width)||!is_numeric($thickness)||$width<2||$width>100||$thickness<1||$thickness>20||!is_array($points)||count($points)<2||count($points)>500)throw new InvalidArgumentException('bar');$length=0;$prev=null;foreach($points as $p){foreach(['x'=>1600,'y'=>2400,'z'=>300] as $key=>$max)if(!isset($p[$key])||!is_numeric($p[$key])||!is_finite((float)$p[$key])||$p[$key]<0||$p[$key]>$max)throw new InvalidArgumentException('point');if($prev!==null)$length+=sqrt(($p['x']-$prev['x'])**2+($p['y']-$prev['y'])**2+($p['z']-$prev['z'])**2);$prev=$p;}$metres=round($length,3)/1000;$key=sprintf('%.2fx%.2f',(float)$width,(float)$thickness);$price=isset($rates[$key])?(int)$rates[$key]['price_per_m_cents']:null;$amount=$price===null?null:(int)round($metres*$price);if($amount===null)$missing++;else$total+=$amount;$lines[]=['sku'=>$key,'name'=>'Медна шина '.$width.' × '.$thickness.' mm','quantity'=>$metres,'unit'=>'m','unit_cents'=>$price,'line_cents'=>$amount];}
 if($enclosures!==1||count($lines)===0)throw new InvalidArgumentException('empty');return ['lines'=>$lines,'materials_cents'=>$total,'missing_prices'=>$missing,'currency'=>'EUR','labour_included'=>false,'vat_percent'=>20,'vat_cents'=>(int)round($total*.2),'total_cents'=>$total+(int)round($total*.2)];
}
function electric_import_article(PDO $db,string $code): ?array {
 $code=preg_replace('/[^A-Z0-9]/','',strtoupper($code));if(strlen($code)<6||strlen($code)>20)return null;
 $indexFile=dirname(__DIR__).'/database/electrical-source-index.json';if(!is_file($indexFile))return null;
 $index=json_decode(file_get_contents($indexFile),true);$url=$index[$code]??null;if(!is_string($url)||!preg_match('#^https://www\.schrack\.bg/shop/[a-z0-9/_-]+\.html$#D',$url))return null;
 if((int)$db->query("SELECT GET_LOCK('pdg_electric_source',0)")->fetchColumn()!==1)throw new RuntimeException('source_busy');
 try{
 $last=$db->query("SELECT setting_value FROM pdg_electric_settings WHERE setting_key='source_access'")->fetchColumn();if(time()-(int)$last<5)throw new RuntimeException('source_busy');
 $q=$db->prepare("INSERT INTO pdg_electric_settings(setting_key,setting_value) VALUES('source_access',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)");$q->execute([(string)time()]);
 $ctx=stream_context_create(['http'=>['method'=>'GET','timeout'=>8,'follow_location'=>0,'max_redirects'=>0,'user_agent'=>'PDG Electric CAD public catalogue lookup']]);$raw=@file_get_contents($url,false,$ctx,0,1800000);if(!is_string($raw)||strlen($raw)<1000)throw new RuntimeException('source_unavailable');
 if(!preg_match('/itemprop="name" content="([^"]+)"/u',$raw,$name)||!preg_match('/Артикул\s*#:\s*(?:<[^>]+>\s*)*([A-Z0-9-]{6,25})/u',$raw,$sku)||preg_replace('/[^A-Z0-9]/','',$sku[1])!==$code)throw new RuntimeException('source_format');
 $clean=static fn($s)=>trim(preg_replace('/\s+/u',' ',html_entity_decode(strip_tags($s),ENT_QUOTES|ENT_HTML5,'UTF-8')));$attrs=[];preg_match_all('/<tr[^>]*>\s*<th[^>]*>(.*?)<\/th>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/su',$raw,$matches,PREG_SET_ORDER);foreach($matches as $m)$attrs[$clean($m[1])]=$clean($m[2]);
 $num=static function($key)use($attrs){return preg_match('/[0-9]+(?:[,.][0-9]+)?/',$attrs[$key]??'',$m)?(float)str_replace(',','.',$m[0]):null;};
 $width=$num('Нето широчина');$height=$num('Нето височина');$depth=$num('Дълбочина');if(!$width||!$height||!$depth||$width>1600||$height>2400||$depth>1000)throw new RuntimeException('source_dimensions');
 $title=$clean($name[1]);$lower=mb_strtolower($title);$box=str_contains($lower,'табло')&&$width>=200&&$height>=200;$type=$box?'ENCLOSURE':(str_contains($lower,'дефектноток')?'RCD':(str_contains($lower,'контактор')?'CONTACT':'MCB'));$image='';if(preg_match('/<img[^>]+id=[\'\"]desktop-large-img[\'\"][^>]+src=[\'\"]([^\'\"]+)/u',$raw,$m)&&preg_match('#^https://image\.schrackcdn\.com/[a-zA-Z0-9_./-]+\.jpg$#D',$m[1]))$image=$m[1];
 $p=['sku'=>$sku[1],'name'=>$title,'manufacturer'=>'Schrack Technik','category'=>$box?'Табла и корпуси':'DIN апаратура','type'=>$type,'modules'=>$box?0:(int)ceil($width/18),'widthMm'=>$width,'heightMm'=>$height,'depthMm'=>$depth,'rating'=>($attrs['Криви на изключване']??'').($attrs['Номинален ток']??''),'ean'=>$attrs['EAN-Code']??'','imageUrl'=>$image,'sourceUrl'=>$url,'poles'=>(int)($num('Полюси')??1),'unitPrice'=>null,'currency'=>'EUR','specifications'=>array_intersect_key($attrs,array_flip(['Редове','Брой модули на ред','редови монтаж']))];
 $q=$db->prepare('INSERT INTO pdg_electric_products(sku,product_json) VALUES(?,?) ON DUPLICATE KEY UPDATE product_json=VALUES(product_json)');$q->execute([$p['sku'],json_encode($p,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$c=electric_unit_cents($p['sku'],null);$p['unitPrice']=$c===null?null:$c/100;$p['priceSource']=$c===null?null:'schrack_2026_06';return $p;
 }finally{$db->query("SELECT RELEASE_LOCK('pdg_electric_source')");}
}

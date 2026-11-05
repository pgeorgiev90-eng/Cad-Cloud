<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function solar_answer(int $status,array $body): void {http_response_code($status);echo json_encode($body,JSON_UNESCAPED_UNICODE);exit;}
if($_SERVER['REQUEST_METHOD']!=='GET')solar_answer(405,['error'=>'method_not_allowed']);
$values=[];
foreach(['lat'=>[-90,90],'lon'=>[-180,180],'angle'=>[0,80],'azimuth'=>[0,359.999],'loss'=>[0,50]] as $key=>$range){
 $v=filter_input(INPUT_GET,$key,FILTER_VALIDATE_FLOAT);
 if($v===false||$v===null||!is_finite((float)$v)||$v<$range[0]||$v>$range[1])solar_answer(422,['error'=>'invalid_parameters']);
 $values[$key]=round((float)$v,$key==='lat'||$key==='lon'?4:2);
}
// Fixed upstream and validated numeric inputs: never accept a URL from callers.
$params=['lat'=>$values['lat'],'lon'=>$values['lon'],'angle'=>$values['angle'],'aspect'=>$values['azimuth']-180,'loss'=>$values['loss'],'peakpower'=>1,'pvtechchoice'=>'crystSi','mountingplace'=>'free','usehorizon'=>1,'outputformat'=>'json'];
$cache=sys_get_temp_dir().'/pdg-pvgis-'.hash('sha256',json_encode($params)).'.json';
if(is_file($cache)&&filemtime($cache)>time()-86400){$data=json_decode((string)file_get_contents($cache),true);if(is_array($data)&&isset($data['annual_kwh_per_kwp']))solar_answer(200,$data);}
if(!function_exists('curl_init'))solar_answer(503,['error'=>'yield_unavailable']);
$curl=curl_init('https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?'.http_build_query($params));
curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>30,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_USERAGENT=>'PDG-Systems-Solar-Quote/1.0',CURLOPT_HTTPHEADER=>['Accept: application/json']]);
$raw=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE);curl_close($curl);
if($status!==200||!is_string($raw)||strlen($raw)>2000000)solar_answer(503,['error'=>'yield_unavailable']);
$data=json_decode($raw,true);$annual=$data['outputs']['totals']['fixed']['E_y']??null;
if(!is_numeric($annual)||!is_finite((float)$annual)||(float)$annual<=0)solar_answer(503,['error'=>'yield_unavailable']);
$result=['annual_kwh_per_kwp'=>(float)$annual,'source'=>'PVGIS 5.3 / European Commission JRC','radiation_database'=>$data['inputs']['meteo_data']['radiation_db']??null,'year_min'=>$data['inputs']['meteo_data']['year_min']??null,'year_max'=>$data['inputs']['meteo_data']['year_max']??null,'parameters'=>$values];
@file_put_contents($cache,json_encode($result),LOCK_EX);
solar_answer(200,$result);

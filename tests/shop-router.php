<?php
// Local CI server only; never uploaded to the production host.
$_SERVER['HTTPS']='on';
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if (str_starts_with($path,'/api/') && str_ends_with($path,'.php')) {
    $file=dirname(__DIR__).$path;
    if (is_file($file)) {require $file;return true;}
}
return false;

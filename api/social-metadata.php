<?php
declare(strict_types=1);

// Public metadata only. Prices, sessions and customer data are never read here.
function pdg_social_escape(string $text): string {
    return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function pdg_social_tags(array $data): string {
    $e = 'pdg_social_escape';
    $title = $e($data['title']);
    $description = $e($data['description']);
    $url = $e($data['url']);
    $image = $data['image'] ?? 'https://pdgsystems.bg/assets/pdg-social.jpg';
    if (!filter_var($image, FILTER_VALIDATE_URL) || strtolower((string)parse_url($image, PHP_URL_SCHEME)) !== 'https') {
        $image = 'https://pdgsystems.bg/assets/pdg-social.jpg';
    }
    // Some catalog thumbnails are only 25 px wide and cannot form a social preview.
    $imagePath = parse_url($image, PHP_URL_PATH);
    if (strtolower((string)parse_url($image, PHP_URL_HOST)) === 'pdgsystems.bg' && is_string($imagePath) && str_starts_with($imagePath, '/assets/')) {
        $local = realpath(dirname(__DIR__).$imagePath);
        $assets = realpath(dirname(__DIR__).'/assets');
        $size = $local && $assets && str_starts_with($local, $assets.DIRECTORY_SEPARATOR) ? @getimagesize($local) : false;
        if (!$size || $size[0] < 200 || $size[1] < 200) $image = 'https://pdgsystems.bg/assets/pdg-social.jpg';
    }
    $defaultImage = $image === 'https://pdgsystems.bg/assets/pdg-social.jpg';
    $image = $e($image);
    $alt = $e($defaultImage ? 'PDG Systems — електроуслуги, фотоволтаици и електрически табла' : ($data['alt'] ?? $data['title']));
    $type = ($data['type'] ?? '') === 'product' ? 'product' : 'website';
    $html = "<!-- PDG SOCIAL START -->\n<title>$title</title>\n"
        . "<meta name=\"description\" content=\"$description\">\n"
        . "<link rel=\"canonical\" href=\"$url\">\n"
        . "<meta property=\"og:type\" content=\"$type\">\n"
        . "<meta property=\"og:site_name\" content=\"PDG Systems\">\n"
        . "<meta property=\"og:locale\" content=\"bg_BG\">\n"
        . "<meta property=\"og:title\" content=\"$title\">\n"
        . "<meta property=\"og:description\" content=\"$description\">\n"
        . "<meta property=\"og:url\" content=\"$url\">\n"
        . "<meta property=\"og:image\" content=\"$image\">\n"
        . "<meta property=\"og:image:secure_url\" content=\"$image\">\n"
        . "<meta property=\"og:image:alt\" content=\"$alt\">\n";
    if ($defaultImage) {
        $html .= "<meta property=\"og:image:type\" content=\"image/jpeg\">\n"
            . "<meta property=\"og:image:width\" content=\"1200\">\n"
            . "<meta property=\"og:image:height\" content=\"630\">\n";
    }
    $html .= "<meta name=\"twitter:card\" content=\"summary_large_image\">\n"
        . "<meta name=\"twitter:title\" content=\"$title\">\n"
        . "<meta name=\"twitter:description\" content=\"$description\">\n"
        . "<meta name=\"twitter:image\" content=\"$image\">\n"
        . "<meta name=\"twitter:image:alt\" content=\"$alt\">\n"
        . "<!-- PDG SOCIAL END -->";
    return $html;
}
function pdg_social_render(string $template, array $data): string {
    $tags = pdg_social_tags($data);
    $html = preg_replace_callback('/<!-- PDG SOCIAL START -->.*?<!-- PDG SOCIAL END -->/s', fn() => $tags, $template, 1, $count);
    if ($count !== 1 || $html === null) {
        throw new RuntimeException('Social metadata template missing');
    }
    return $html;
}
function pdg_social_db(): PDO {
    $path = dirname(__DIR__, 2) . '/pdg-shop-db.php';
    if (!is_file($path)) throw new RuntimeException('Database configuration missing');
    $s = require $path;
    if (!is_array($s)) throw new RuntimeException('Invalid database configuration');
    return new PDO('mysql:host='.($s['host']??'localhost').';dbname='.($s['database']??'').';charset=utf8mb4',
        $s['username']??'', $s['password']??'', [
            PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES=>false
        ]);
}

<?php
declare(strict_types=1);
require __DIR__.'/../api/social-metadata.php';
function check(bool $ok): void { if (!$ok) throw new RuntimeException('Metadata assertion failed'); }
$template = '<html><head><!-- PDG SOCIAL START -->old<!-- PDG SOCIAL END --></head><body>Unchanged</body></html>';
$data = ['title'=>'Инвертор "A" & <script>', 'description'=>'Български текст & характеристики', 'url'=>'https://pdgsystems.bg/product.html?id=1&test=2', 'image'=>'javascript:alert(1)', 'type'=>'product'];
$html = pdg_social_render($template, $data);
check(str_contains($html, '&quot;A&quot; &amp; &lt;script&gt;'));
check(!str_contains($html, 'javascript:'));
check(str_contains($html, 'https://pdgsystems.bg/assets/pdg-social.jpg'));
check(str_contains($html, 'content="1200"'));
check(substr_count($html, 'property="og:title"') === 1);
check(str_contains($html, '<body>Unchanged</body>'));
check(str_contains($html, 'id=1&amp;test=2'));
$data['image'] = 'https://example.com/product.jpg';
$html = pdg_social_render($template, $data);
check(!str_contains($html, 'og:image:width'));
check(str_contains($html, 'https://example.com/product.jpg'));
echo "Metadata escaping, fallback image, canonical URL and template checks passed\n";

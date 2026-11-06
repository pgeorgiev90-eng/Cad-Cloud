<?php
declare(strict_types=1);
require_once __DIR__.'/admin-common.php';

function pdg_require_cad_page(string $editor): void {
    try {
        pdg_account_session(false, '/auth.html?next='.rawurlencode($editor));
        session_write_close();
        header('Content-Type: text/html; charset=utf-8');
    } catch (Throwable $e) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        exit('Входът в CAD временно е недостъпен. Опитайте отново след малко.');
    }
}

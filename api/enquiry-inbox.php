<?php
declare(strict_types=1);
require __DIR__.'/admin-common.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['GET', 'POST'], true)) pdg_answer(405, ['error'=>'method_not_allowed']);
    [$db] = pdg_admin_session();
    $db->exec('CREATE TABLE IF NOT EXISTS pdg_enquiry_reads (
        enquiry_id BIGINT UNSIGNED PRIMARY KEY,
        read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB');
    $join = "FROM pdg_electric_enquiries e LEFT JOIN pdg_enquiry_reads r ON r.enquiry_id=e.id";
    $unread = "r.enquiry_id IS NULL AND e.status <> 'reviewed'";
    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input', false, null, 0, 1024), true);
        $ref = $data['reference'] ?? null;
        if (!is_string($ref) || !preg_match('/^[a-f0-9]{24}$/D', $ref)) pdg_answer(422, ['error'=>'invalid_reference']);
        $q = $db->prepare('SELECT id FROM pdg_electric_enquiries WHERE public_ref=?');
        $q->execute([$ref]);
        $id = $q->fetchColumn();
        if (!$id) pdg_answer(404, ['error'=>'not_found']);
        $q = $db->prepare('INSERT INTO pdg_enquiry_reads (enquiry_id) VALUES (?) ON DUPLICATE KEY UPDATE enquiry_id=enquiry_id');
        $q->execute([$id]);
        pdg_answer(200, ['unread'=>(int)$db->query("SELECT COUNT(*) $join WHERE $unread")->fetchColumn()]);
    }
    $rows = $db->query("SELECT e.public_ref,e.customer_name,e.email,e.phone,e.project_name,e.material_json,e.created_at,
        ($unread) AS unread $join ORDER BY unread DESC,e.id DESC LIMIT 50")->fetchAll();
    foreach ($rows as &$row) {
        $details = json_decode($row['material_json'], true);
        unset($row['material_json']);
        $row['source'] = ($details['source'] ?? '') === 'website_contact' ? 'site' : 'electric';
        $row['message'] = $row['source'] === 'site' ? ($details['message'] ?? '') : '';
        $row['unread'] = (bool)$row['unread'];
    }
    unset($row);
    pdg_answer(200, ['enquiries'=>$rows, 'csrf'=>$_SESSION['csrf'],
        'unread'=>(int)$db->query("SELECT COUNT(*) $join WHERE $unread")->fetchColumn()]);
} catch (Throwable $e) {
    error_log('PDG enquiry inbox: '.get_class($e));
    pdg_answer(503, ['error'=>'service_unavailable']);
}

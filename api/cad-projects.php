<?php
declare(strict_types=1);
require __DIR__.'/admin-common.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    if (!in_array($method, ['GET','POST'], true)) pdg_answer(405, ['error'=>'method_not_allowed']);
    [$db, $user] = pdg_account_session($method === 'GET');
    $view = $_GET['view'] ?? '';
    if ($method === 'GET' && $view === 'enquiries') {
        $rows = $db->query('SELECT public_ref,customer_name,email,phone,project_name,material_json,status,created_at FROM pdg_electric_enquiries ORDER BY id DESC LIMIT 50')->fetchAll();
        foreach ($rows as &$row) {
            $details = json_decode($row['material_json'], true);
            unset($row['material_json']);
            $row['source'] = ($details['source'] ?? '') === 'website_contact' ? 'site' : 'electric';
            $row['message'] = $row['source'] === 'site' ? ($details['message'] ?? '') : '';
        }
        unset($row);
        pdg_answer(200, ['enquiries'=>$rows]);
    }

    $db->exec("CREATE TABLE IF NOT EXISTS pdg_cad_projects (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        editor VARCHAR(12) NOT NULL,
        project_name VARCHAR(120) NOT NULL,
        snapshot MEDIUMTEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY owner_editor_name (user_id,editor,project_name),
        KEY recent (updated_at,id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if ($method === 'POST') {
        $limit = 1048576;
        $raw = file_get_contents('php://input', false, null, 0, $limit+1);
        if (strlen($raw) > $limit) pdg_answer(413, ['error'=>'project_too_large']);
        $data = json_decode($raw, true, 128);
        $name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
        $editor = $data['editor'] ?? null;
        $project = $data['project'] ?? null;
        if ($name === '' || mb_strlen($name) > 120 || !in_array($editor, ['solar','electric'], true) || !is_array($project)) {
            pdg_answer(422, ['error'=>'invalid_project']);
        }
        $valid = $editor === 'solar'
            ? ($project['version'] ?? null) === 1 && is_array($project['planes'] ?? null) && count($project['planes']) > 0
            : ($project['version'] ?? null) === 2 && is_array($project['items'] ?? null) && is_array($project['busbars'] ?? null);
        if (!$valid) pdg_answer(422, ['error'=>'invalid_project']);
        $save = $db->prepare('INSERT INTO pdg_cad_projects (user_id,editor,project_name,snapshot) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE snapshot=VALUES(snapshot),updated_at=CURRENT_TIMESTAMP');
        $save->execute([$user,$editor,$name,json_encode($project, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
        pdg_answer(200, ['ok'=>true]);
    }

    if (isset($_GET['id'])) {
        $id = filter_var($_GET['id'], FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
        if (!$id) pdg_answer(422, ['error'=>'invalid_project']);
        $q = $db->prepare('SELECT editor,project_name,snapshot FROM pdg_cad_projects WHERE id=?');
        $q->execute([$id]);
        $row = $q->fetch();
        if (!$row) pdg_answer(404, ['error'=>'not_found']);
        pdg_answer(200, ['name'=>$row['project_name'],'editor'=>$row['editor'],'project'=>json_decode($row['snapshot'], true, 128, JSON_THROW_ON_ERROR)]);
    }

    $search = $_GET['q'] ?? '';
    $editor = $_GET['editor'] ?? '';
    $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1,'max_range'=>10000]]);
    if (!is_string($search) || mb_strlen($search) > 120 || !in_array($editor, ['', 'solar', 'electric'], true) || !$page) {
        pdg_answer(422, ['error'=>'invalid_filter']);
    }
    $offset = ($page - 1) * 30;
    $q = $db->prepare("SELECT p.id,p.editor,p.project_name,p.updated_at,u.email FROM pdg_cad_projects p JOIN pdg_users u ON u.id=p.user_id
        WHERE (?='' OR p.editor=?) AND (p.project_name LIKE ? OR u.email LIKE ?)
        ORDER BY p.updated_at DESC,p.id DESC LIMIT 31 OFFSET $offset");
    $term = '%'.trim($search).'%';
    $q->execute([$editor,$editor,$term,$term]);
    $rows = $q->fetchAll();
    pdg_answer(200, ['projects'=>array_slice($rows,0,30),'more'=>count($rows)>30]);
} catch (Throwable $e) {
    error_log('PDG CAD projects: '.get_class($e));
    pdg_answer(503, ['error'=>'service_unavailable']);
}

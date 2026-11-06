<?php
declare(strict_types=1);

require __DIR__.'/shop-common.php';

try {
    shop_session();
    if ($_SERVER['REQUEST_METHOD']==='GET') {
        $key = $_SESSION['contact_key'] ?? '';
        if ($key === '' || isset($_SESSION['contact_result'])) {
            $key = $_SESSION['contact_key'] = bin2hex(random_bytes(24));
            unset($_SESSION['contact_result']);
        }
        shop_answer(200, ['csrf'=>$_SESSION['csrf'], 'request_key'=>$key]);
    }

    $input = shop_input();
    $key = $input['request_key'] ?? '';
    if (!is_string($key) || $key === '' || !hash_equals($_SESSION['contact_key'] ?? '', $key)) {
        shop_answer(409, ['error'=>'request_expired']);
    }
    if (isset($_SESSION['contact_result'])) {
        shop_answer(200, $_SESSION['contact_result']);
    }
    if (time() - (int)($_SESSION['contact_last'] ?? 0) < 30) {
        shop_answer(429, ['error'=>'try_later']);
    }
    $fields = [];
    foreach (['name'=>160, 'email'=>190, 'message'=>3000] as $field=>$limit) {
        $value = $input[$field] ?? null;
        if (!is_string($value) || trim($value)==='' || mb_strlen($value, 'UTF-8') > $limit) {
            shop_answer(422, ['error'=>'invalid_contact']);
        }
        $fields[$field] = trim($value);
    }
    if (($input['website'] ?? '') !== '' || !filter_var($fields['email'], FILTER_VALIDATE_EMAIL)) {
        shop_answer(422, ['error'=>'invalid_contact']);
    }

    $db = shop_db();
    $ref = substr(hash('sha256', $key), 0, 24);
    $payload = ['source'=>'website_contact', 'message'=>$fields['message']];
    $insert = $db->prepare('INSERT INTO pdg_electric_enquiries (public_ref,customer_name,email,phone,project_name,material_json,materials_cents,missing_prices) VALUES (?,?,?,?,?,?,0,0)');
    $insert->execute([$ref, $fields['name'], $fields['email'], '', 'Запитване от сайта', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    $result = ['ok'=>true, 'reference'=>$ref];
    $_SESSION['contact_last'] = time();
    $_SESSION['contact_result'] = $result;

    $body = "Запитване от pdgsystems.bg\nНомер: $ref\nИме: {$fields['name']}\nИмейл: {$fields['email']}\n\n{$fields['message']}";
    $headers = [
        'From'=>'no-reply@pdgsystems.bg',
        'Reply-To'=>$fields['email'],
        'Content-Type'=>'text/plain; charset=UTF-8',
    ];
    try {
        $accepted = mail('pdg2019@abv.bg', 'PDG Systems - Website enquiry '.$ref, $body, $headers);
    } catch (Throwable $e) {
        $accepted = false;
    }
    if (!$accepted) error_log('PDG contact notification failed for '.$ref);
    $result['notification_accepted'] = $accepted;
    $_SESSION['contact_result'] = $result;
    shop_answer(201, $result);
} catch (Throwable $e) {
    error_log('PDG contact enquiry failed: '.get_class($e));
    shop_answer(503, ['error'=>'service_unavailable']);
}

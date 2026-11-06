<?php
declare(strict_types=1);

function pdg_pricing_account(PDO $db, bool $keepSession=false): ?array {
    if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS']==='off' || empty($_COOKIE['PDGSESSION'])) return null;
    ini_set('session.use_strict_mode','1');
    ini_set('session.use_only_cookies','1');
    session_name('PDGSESSION');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
    if (!session_start()) return null;
    $id=(int)($_SESSION['user']['id']??0);
    $now=time();
    $started=(int)($_SESSION['login_at']??0);
    $last=(int)($_SESSION['last_activity']??0);
    $valid=$id>0 && $started>0 && $last>0 && $now-$last<=1800 && $now-$started<=43200;
    if ($valid) $_SESSION['last_activity']=$now;
    if (!$keepSession || !$valid) session_write_close();
    if (!$valid) return null;
    $q=$db->prepare('SELECT id,role FROM pdg_users WHERE id=? AND is_active=1');
    $q->execute([$id]);
    $user=$q->fetch();
    if (!$user) {
        if ($keepSession) session_write_close();
        return null;
    }
    $discount=0;
    if ($user['role']==='customer') {
        try {
            $q=$db->prepare('SELECT discount_bp FROM pdg_customer_discounts WHERE user_id=?');
            $q->execute([$id]);
            $discount=(int)$q->fetchColumn();
        } catch (PDOException $e) {
            if ($e->getCode()!=='42S02') throw $e;
        }
    }
    return ['id'=>$id,'discount_bp'=>max(0,min(10000,$discount))];
}

function pdg_discounted_cents(int $cents, int $discount): int {
    return intdiv($cents*(10000-$discount)+5000,10000);
}

function pdg_product_price($price, ?array $account): ?string {
    if ($account===null || $price===null || (float)$price<=0) return null;
    $cents=pdg_discounted_cents((int)round((float)$price*100),$account['discount_bp']);
    return intdiv($cents,100).'.'.str_pad((string)($cents%100),2,'0',STR_PAD_LEFT);
}

function pdg_discount_schema(PDO $db): void {
    $db->exec('CREATE TABLE IF NOT EXISTS pdg_customer_discounts (
        user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
        discount_bp SMALLINT UNSIGNED NOT NULL,
        FOREIGN KEY (user_id) REFERENCES pdg_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB');
}

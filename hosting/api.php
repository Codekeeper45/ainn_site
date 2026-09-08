<?php
declare(strict_types=1);
// Compatible with the React editor API. Private files are executable PHP guards,
// additionally denied by Apache; this also protects against nginx static bypass.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
// Compatibility with the provider's initial PHP 7.4 runtime.
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $s, string $prefix): bool { return strncmp($s, $prefix, strlen($prefix)) === 0; }
}
if (!function_exists('str_contains')) {
    function str_contains(string $s, string $part): bool { return $part === '' || strpos($s, $part) !== false; }
}
if (!function_exists('array_is_list')) {
    function array_is_list(array $a): bool { return $a === [] || array_keys($a) === range(0, count($a)-1); }
}
function reply(int $status, $data): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
const GUARD = "<?php http_response_code(404); exit; ?>\n";
function loadPrivate(string $path, $default) {
    if (!is_file($path)) return $default;
    $raw = file_get_contents($path);
    if ($raw === false || !str_starts_with($raw, GUARD)) throw new RuntimeException('Invalid private data');
    return json_decode(substr($raw, strlen(GUARD)), true, 64, JSON_THROW_ON_ERROR);
}
function storePrivate(string $path, $data): void {
    $temp = $path . '.' . bin2hex(random_bytes(8)) . '.php';
    $raw = GUARD . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    if (file_put_contents($temp, $raw, LOCK_EX) !== strlen($raw)) throw new RuntimeException('Write failed');
    chmod($temp, 0600);
    if (!rename($temp, $path)) { unlink($temp); throw new RuntimeException('Rename failed'); }
}
function body(int $limit = 131072): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) reply(413, ['error'=>'Слишком большой запрос.']);
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if (strlen($raw) > $limit) reply(413, ['error'=>'Слишком большой запрос.']);
    try { $v = json_decode($raw, true, 64, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { reply(400, ['error'=>'Некорректный JSON.']); }
    if (!is_array($v)) reply(400, ['error'=>'Ожидается объект JSON.']);
    return $v;
}
function text($v, int $n): string { return is_string($v) ? mb_substr($v, 0, $n, 'UTF-8') : ''; }
function imageUrl($v): bool {
    return is_string($v) && preg_match('~^/(uploads|assets)/[a-zA-Z0-9_./-]+$~D', $v) === 1 && !str_contains($v, '..');
}
function normalize(array $v): array {
    $texts = []; $images = []; $collections = [];
    foreach (array_slice(is_array($v['texts'] ?? null) ? $v['texts'] : [], 0, 1200, true) as $k=>$s) {
        if (strlen((string)$k) <= 260 && is_string($s)) $texts[$k] = text($s, 6000);
    }
    foreach (array_slice(is_array($v['images'] ?? null) ? $v['images'] : [], 0, 300, true) as $k=>$s) {
        if (strlen((string)$k) > 260 || !is_array($s)) continue;
        $url = is_string($s['url'] ?? null) ? $s['url'] : '';
        if ($url !== '' && !imageUrl($url)) continue;
        $images[$k] = ['url'=>$url,'removed'=>(bool)($s['removed'] ?? false),'kind'=>($s['kind'] ?? '') === 'background' ? 'background' : 'image'];
    }
    $schema = json_decode(file_get_contents(__DIR__.'/collections.json'), true, 64, JSON_THROW_ON_ERROR);
    foreach ($schema as $id=>$collection) {
        $raw = $v['collections'][$id] ?? null;
        if (!is_array($raw) || !array_is_list($raw)) continue;
        $items = []; $seen = [];
        foreach (array_slice($raw, 0, $collection['maxItems']) as $row) {
            if (!is_array($row)) continue;
            $key = trim(text($row['id'] ?? '', 80));
            if ($key === '' || isset($seen[$key])) $key = 'item-'.bin2hex(random_bytes(12));
            $seen[$key] = true; $item = ['id'=>$key];
            foreach ($collection['fields'] as $field) {
                $name = $field['name']; $value = $row[$name] ?? null;
                switch ($field['type']) {
                    case 'text': case 'textarea': $item[$name] = text($value, $field['maxLength'] ?? 500); break;
                    case 'boolean': $item[$name] = (bool)$value; break;
                    case 'image': $item[$name] = imageUrl($value) ? $value : ''; break;
                    case 'select': $item[$name] = in_array($value, array_column($field['options'], 'value'), true) ? $value : ''; break;
                    case 'list':
                        $list = array_values(array_filter(is_array($value) ? $value : [], fn($x)=>is_string($x) && trim($x) !== ''));
                        $item[$name] = array_map(fn($x)=>text($x, $field['itemMaxLength'] ?? 200), array_slice($list, 0, $field['maxItems'] ?? 12)); break;
                }
            }
            if (is_string($row['slug'] ?? null) && preg_match('/^[\w-]{1,80}$/D', $row['slug'])) $item['slug'] = $row['slug'];
            foreach (['width','height'] as $dimension) if (is_int($row[$dimension] ?? null) || is_float($row[$dimension] ?? null)) $item[$dimension] = min(10000,max(1,(int)round($row[$dimension])));
            $items[] = $item;
        }
        $collections[$id] = $items;
    }
    return ['version'=>1,'updatedAt'=>is_string($v['updatedAt'] ?? null) ? $v['updatedAt'] : null,'texts'=>(object)$texts,'images'=>(object)$images,'collections'=>(object)$collections];
}
try {
    $private = __DIR__.'/_private';
    $config = loadPrivate($private.'/config.php', []);
    if (!isset($config['user'], $config['passwordHash'])) reply(503, ['error'=>'Админка не настроена.']);
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $method = $_SERVER['REQUEST_METHOD'];
    if ($path === '/api/content' && $method === 'GET') reply(200, normalize(loadPrivate($private.'/content.php', [])));

    // --- Public endpoint: Submit contact lead ---
    if ($path === '/api/contact' && $method === 'POST') {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '') {
            $originHost = parse_url($origin, PHP_URL_HOST);
            $serverHost = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
            if ($originHost !== $serverHost && !in_array($originHost, ['remont360.kz', 'www.remont360.kz', '127.0.0.1', 'localhost'], true)) {
                reply(403, ['error' => 'Запрос отклонён.']);
            }
        }
        $lock = fopen($private.'/rate-lock.php', 'c+');
        if ($lock && flock($lock, LOCK_EX)) {
            $rates = loadPrivate($private.'/contact-rates.php', []);
            $rates = array_filter($rates, fn($r) => ($r['until'] ?? 0) > time());
            $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
            $r = $rates[$ip] ?? ['count' => 0, 'until' => time() + 600];
            if ($r['count'] >= 20) {
                flock($lock, LOCK_UN); fclose($lock);
                reply(429, ['error' => 'Слишком много запросов. Пожалуйста, подождите или напишите нам в WhatsApp.']);
            }
            $r['count']++;
            $rates[$ip] = $r;
            storePrivate($private.'/contact-rates.php', $rates);
            flock($lock, LOCK_UN); fclose($lock);
        }

        $input = body(65536);
        $name = trim(text($input['name'] ?? '', 80));
        $phone = trim(text($input['phone'] ?? '', 50));
        $details = trim(text($input['details'] ?? '', 2000));

        if (mb_strlen($name) < 2) reply(400, ['error' => 'Укажите ваше имя (минимум 2 символа).']);
        $digits = preg_replace('/\D/', '', $phone);
        if (strlen($digits) < 10 || strlen($digits) > 15) reply(400, ['error' => 'Укажите корректный номер телефона (10–15 цифр).']);

        $lead = [
            'id' => 'lead-' . bin2hex(random_bytes(6)),
            'createdAt' => gmdate('Y-m-d\TH:i:s.000\Z'),
            'name' => $name,
            'phone' => $phone,
            'details' => $details,
            'ip' => hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        ];

        $leads = loadPrivate($private . '/leads.php', []);
        if (!is_array($leads)) $leads = [];
        array_unshift($leads, $lead);
        if (count($leads) > 300) $leads = array_slice($leads, 0, 300);
        storePrivate($private . '/leads.php', $leads);

        // Send email notification to info@remont360.kz
        $subEncoded = '=?UTF-8?B?' . base64_encode("Новая заявка: {$name} ({$phone})") . '?=';
        $bodyMail = "Новая заявка с сайта https://remont360.kz\n\n"
                  . "Имя: {$name}\n"
                  . "Телефон: {$phone}\n";
        if ($details !== '') $bodyMail .= "Детали / Бриф: {$details}\n";
        $bodyMail .= "Дата: " . date('d.m.Y H:i:s') . "\n";
        $headers = "From: info@remont360.kz\r\n"
                 . "Reply-To: info@remont360.kz\r\n"
                 . "Content-Type: text/plain; charset=UTF-8\r\n"
                 . "X-Mailer: PHP/" . phpversion();
        @mail('info@remont360.kz', $subEncoded, $bodyMail, $headers);

        reply(200, [
            'success' => true,
            'message' => 'Заявка успешно принята! Мы перезвоним вам в ближайшее время.',
            'leadId' => $lead['id'],
        ]);
    }

    // --- Public endpoint: Submit client review ---
    if ($path === '/api/review' && $method === 'POST') {
        $input = body(65536);
        $name = trim(text($input['name'] ?? '', 80));
        $object = trim(text($input['object'] ?? '', 80));
        $review = trim(text($input['review'] ?? '', 2000));
        if (mb_strlen($name) < 2) reply(400, ['error' => 'Укажите ваше имя.']);
        if (mb_strlen($review) < 20) reply(400, ['error' => 'Опишите впечатление подробнее (минимум 20 символов).']);
        $item = [
            'id' => 'review-' . bin2hex(random_bytes(6)),
            'createdAt' => gmdate('Y-m-d\TH:i:s.000\Z'),
            'name' => $name,
            'object' => $object,
            'review' => $review,
            'ip' => hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        ];
        $reviews = loadPrivate($private . '/reviews.php', []);
        if (!is_array($reviews)) $reviews = [];
        array_unshift($reviews, $item);
        if (count($reviews) > 200) $reviews = array_slice($reviews, 0, 200);
        storePrivate($private . '/reviews.php', $reviews);
        reply(200, ['success' => true, 'message' => 'Спасибо за отзыв! Он появится на сайте после модерации.']);
    }
    if ($method !== 'GET') {
        if (($_SERVER['HTTP_X_ADMIN_REQUEST'] ?? '') !== '1') reply(403, ['error'=>'Запрос отклонён.']);
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== explode(':', $_SERVER['HTTP_HOST'])[0]) reply(403, ['error'=>'Запрос отклонён.']);
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', '28800');
    session_name('skp_admin');
    session_set_cookie_params(['lifetime'=>28800,'path'=>'/','secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off','httponly'=>true,'samesite'=>'Strict']);
    if (!session_start()) throw new RuntimeException('Session unavailable');
    $authenticated = ($_SESSION['authenticated'] ?? false) && ($_SESSION['expires'] ?? 0) > time();
    if ($authenticated) $_SESSION['expires'] = time() + 28800;
    if ($path === '/api/admin/session' && $method === 'GET') reply(200, ['authenticated'=>(bool)$authenticated,'user'=>$config['user'],'demoCredentials'=>null,'saveEnabled'=>$config['saveEnabled'] ?? true]);
    if ($path === '/api/admin/login' && $method === 'POST') {
        $input = body();
        // One locked rate store avoids per-IP file proliferation and parallel bypass.
        $lock = fopen($private.'/rate-lock.php', 'c+');
        if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Rate lock');
        $rates = loadPrivate($private.'/rates.php', []);
        $rates = array_filter($rates, fn($r)=>$r['until'] > time());
        $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
        $r = $rates[$ip] ?? ['count'=>0,'until'=>time()+600];
        if ($r['count'] >= 10 || count($rates) > 10000) { flock($lock, LOCK_UN); fclose($lock); reply(429,['error'=>'Слишком много попыток. Повторите позже.']); }
        $valid = hash_equals($config['user'], text($input['username'] ?? '', 200)) && password_verify(text($input['password'] ?? '', 4096), $config['passwordHash']);
        if ($valid) unset($rates[$ip]); else { $r['count']++; $rates[$ip] = $r; }
        storePrivate($private.'/rates.php', $rates);
        flock($lock, LOCK_UN); fclose($lock);
        if (!$valid) reply(401, ['error'=>'Неверный логин или пароль.']);
        session_regenerate_id(true);
        $_SESSION = ['authenticated'=>true,'expires'=>time()+28800];
        reply(200,['authenticated'=>true,'user'=>$config['user']]);
    }
    if ($path === '/api/admin/logout' && $method === 'POST') {
        $_SESSION = []; session_destroy();
        setcookie('skp_admin','',['expires'=>1,'path'=>'/','httponly'=>true,'secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off','samesite'=>'Strict']);
        reply(200,['authenticated'=>false]);
    }
    if (!$authenticated) reply(401,['error'=>'Требуется вход в админ-панель.']);
    if ($path === '/api/admin/content' && $method === 'PUT') {
        if (!($config['saveEnabled'] ?? true)) reply(423,['error'=>'Сохранение временно отключено.']);
        $v = normalize(body(2097152)); $v['updatedAt'] = gmdate('Y-m-d\TH:i:s.000\Z');
        storePrivate($private.'/content.php', $v); reply(200,$v);
    }
    if ($path === '/api/admin/upload' && $method === 'POST') {
        if (!($config['saveEnabled'] ?? true)) reply(423,['error'=>'Сохранение временно отключено.']);
        $v = body(12582912);
        if (!preg_match('~^data:(image/(?:jpeg|png|webp|gif));base64,([a-zA-Z0-9+/=]+)$~D', text($v['data'] ?? '',12582912), $m)) reply(400,['error'=>'Поддерживаются JPG, PNG, WebP и GIF.']);
        $bytes = base64_decode($m[2], true);
        if ($bytes === false || strlen($bytes) === 0 || strlen($bytes) > 8388608) reply(413,['error'=>'Размер изображения должен быть не больше 8 МБ.']);
        $info = @getimagesizefromstring($bytes);
        if (!$info || ($info['mime'] ?? '') !== $m[1] || $info[0] > 10000 || $info[1] > 10000 || $info[0]*$info[1] > 40000000) reply(400,['error'=>'Некорректное изображение или слишком большое разрешение.']);
        $ext = ['image/jpeg'=>'.jpg','image/png'=>'.png','image/webp'=>'.webp','image/gif'=>'.gif'][$m[1]];
        $name = bin2hex(random_bytes(16)).$ext;
        if (file_put_contents(__DIR__.'/uploads/'.$name,$bytes,LOCK_EX) !== strlen($bytes)) throw new RuntimeException('Upload write failed');
        reply(201,['url'=>'/uploads/'.$name]);
    }
    if ($path === '/api/admin/leads' && $method === 'GET') {
        $leads = loadPrivate($private . '/leads.php', []);
        reply(200, ['leads' => is_array($leads) ? $leads : []]);
    }
    if ($path === '/api/admin/leads' && $method === 'DELETE') {
        $input = body();
        $id = text($input['id'] ?? '', 80);
        $leads = loadPrivate($private . '/leads.php', []);
        if (is_array($leads)) {
            $leads = array_values(array_filter($leads, fn($l) => ($l['id'] ?? '') !== $id));
            storePrivate($private . '/leads.php', $leads);
        }
        reply(200, ['leads' => $leads]);
    }
    reply(404,['error'=>'API route not found.']);
} catch (Throwable $e) {
    error_log('Site API: '.$e->getMessage());
    reply(500,['error'=>'Внутренняя ошибка сервера.']);
}

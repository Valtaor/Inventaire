<?php
/**
 * Database connection helper for the inventory application.
 *
 * Exposes a lazy connector so repeated calls can retry the database if the
 * first attempt (for example during theme bootstrap) fails.
 */

declare(strict_types=1);

/**
 * Returns the database configuration, prioritising WordPress constants when
 * they are available.
 *
 * @return array{host:string,user:string,pass:string,name:string,charset:string}
 */
function inventory_db_get_default_config(): array
{
    $config = [
        'host' => 'db50000543572.hosting-data.io',
        'user' => 'dbo50000543572',
        'pass' => '14Juillet@',
        'name' => 'dbs521868',
        'charset' => 'utf8',
    ];

    if (
        defined('DB_HOST') && defined('DB_USER') && defined('DB_PASSWORD') && defined('DB_NAME')
    ) {
        $config['host'] = (string) DB_HOST;
        $config['user'] = (string) DB_USER;
        $config['pass'] = (string) DB_PASSWORD;
        $config['name'] = (string) DB_NAME;
        if (defined('DB_CHARSET') && DB_CHARSET !== '') {
            $config['charset'] = (string) DB_CHARSET;
        }
    }

    return $config;
}

/**
 * Attempts to establish a PDO connection using the provided (or default)
 * configuration.
 */
function inventory_db_connect(?array $overrideConfig = null): ?PDO
{
    $config = inventory_db_get_default_config();
    if (is_array($overrideConfig)) {
        $config = array_merge($config, $overrideConfig);
    }

    $dsnHost = $config['host'];
    $dsnExtras = '';
    $pdoOptions = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];

    if (strpos($dsnHost, ':') !== false) {
        [$rawHost, $portOrSocket] = explode(':', $dsnHost, 2);
        $rawHost = trim($rawHost);
        $portOrSocket = trim($portOrSocket);

        if ($portOrSocket !== '') {
            if (ctype_digit($portOrSocket)) {
                $dsnHost = $rawHost;
                $dsnExtras = ';port=' . $portOrSocket;
            } else {
                $dsnHost = $rawHost;
                if (defined('PDO::MYSQL_ATTR_UNIX_SOCKET')) {
                    $pdoOptions[PDO::MYSQL_ATTR_UNIX_SOCKET] = $portOrSocket;
                }
            }
        }
    }

    if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
        $pdoOptions[PDO::MYSQL_ATTR_INIT_COMMAND] = 'SET NAMES ' . $config['charset'];
    }

    $dsn = sprintf(
        'mysql:host=%s%s;dbname=%s;charset=%s',
        $dsnHost,
        $dsnExtras,
        $config['name'],
        $config['charset']
    );

    try {
        return new PDO(
            $dsn,
            $config['user'],
            $config['pass'],
            $pdoOptions
        );
    } catch (PDOException $exception) {
        if (function_exists('error_log')) {
            error_log('[Inventory] Connexion base impossible : ' . $exception->getMessage());
        }

        return null;
    }
}

/**
 * Returns a shared PDO instance. Setting $forceReconnect to true triggers a new
 * connection attempt, allowing recovery after transient outages.
 */
function inventory_db_get_pdo(bool $forceReconnect = false): ?PDO
{
    static $pdo = null;

    if ($forceReconnect || !$pdo instanceof PDO) {
        $pdo = inventory_db_connect();
    }

    return $pdo;
}

// Maintain backwards compatibility with older includes that expect $pdo.
$pdo = inventory_db_get_pdo();
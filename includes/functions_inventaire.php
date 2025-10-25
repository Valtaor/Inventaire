<?php
/**
 * Fonctions AJAX Inventaire – BellaFrance
 * Compatible avec le script-inventaire.js
 */

if (!defined('ABSPATH')) {
    exit; // Sécurité
}

/**
 * Connexion PDO
 */
function inventory_db_get_pdo($forceReconnect = false)
{
    static $pdo = null;
    if ($pdo instanceof PDO && !$forceReconnect) {
        return $pdo;
    }

    try {
        global $wpdb;
        $dsn = "mysql:host={$wpdb->dbhost};dbname={$wpdb->dbname};charset=utf8mb4";
        $pdo = new PDO($dsn, $wpdb->dbuser, $wpdb->dbpassword, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        error_log('Inventory - Connexion PDO échouée : ' . $e->getMessage());
        $pdo = null;
    }

    return $pdo;
}

/**
 * Vérification de la table inventaire
 */
function inventory_db_ensure_table()
{
    global $wpdb;
    $table = $wpdb->prefix . 'inventaire';
    $charset = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE IF NOT EXISTS $table (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(255) NOT NULL,
        reference VARCHAR(255) DEFAULT NULL,
        emplacement VARCHAR(255) DEFAULT NULL,
        prix_achat DECIMAL(10,2) DEFAULT 0,
        prix_vente DECIMAL(10,2) DEFAULT 0,
        prix_vente_ebay DECIMAL(10,2) DEFAULT NULL,
        prix_vente_lbc DECIMAL(10,2) DEFAULT NULL,
        prix_vente_vinted DECIMAL(10,2) DEFAULT NULL,
        prix_vente_autre DECIMAL(10,2) DEFAULT NULL,
        stock INT DEFAULT 0,
        a_completer TINYINT(1) DEFAULT 0,
        notes TEXT,
        description TEXT,
        date_achat DATE DEFAULT NULL,
        image VARCHAR(255) DEFAULT NULL,
        date_created DATETIME DEFAULT CURRENT_TIMESTAMP
    ) $charset;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);

    // Migration : Ajouter les colonnes de prix par plateforme si elles n'existent pas
    inventory_db_migrate_price_columns();

    // Création de la table ventes
    inventory_db_ensure_sales_table();
}

/**
 * Vérification de la table ventes
 */
function inventory_db_ensure_sales_table()
{
    global $wpdb;
    $table = $wpdb->prefix . 'inventaire_ventes';
    $charset = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE IF NOT EXISTS $table (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        produit_id INT UNSIGNED NOT NULL,
        produit_nom VARCHAR(255) NOT NULL,
        produit_reference VARCHAR(255) DEFAULT NULL,
        quantite INT UNSIGNED NOT NULL DEFAULT 1,
        prix_vente DECIMAL(10,2) NOT NULL,
        plateforme VARCHAR(50) DEFAULT NULL,
        frais DECIMAL(10,2) DEFAULT 0,
        prix_achat_unitaire DECIMAL(10,2) DEFAULT 0,
        date_vente DATE NOT NULL,
        notes TEXT,
        date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_produit_id (produit_id),
        INDEX idx_date_vente (date_vente),
        INDEX idx_plateforme (plateforme)
    ) $charset;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);
}

/**
 * Migration : Ajoute les colonnes de prix par plateforme si elles n'existent pas
 */
function inventory_db_migrate_price_columns()
{
    global $wpdb;
    $table = $wpdb->prefix . 'inventaire';

    // Vérifier si la table existe
    $table_exists = $wpdb->get_var("SHOW TABLES LIKE '$table'");
    if (!$table_exists) {
        return;
    }

    // Liste des nouvelles colonnes à ajouter
    $new_columns = [
        'prix_vente_ebay' => 'DECIMAL(10,2) DEFAULT NULL AFTER prix_vente',
        'prix_vente_lbc' => 'DECIMAL(10,2) DEFAULT NULL AFTER prix_vente_ebay',
        'prix_vente_vinted' => 'DECIMAL(10,2) DEFAULT NULL AFTER prix_vente_lbc',
        'prix_vente_autre' => 'DECIMAL(10,2) DEFAULT NULL AFTER prix_vente_vinted',
    ];

    foreach ($new_columns as $column => $definition) {
        // Vérifier si la colonne existe déjà
        $column_exists = $wpdb->get_results("SHOW COLUMNS FROM $table LIKE '$column'");

        if (empty($column_exists)) {
            // Ajouter la colonne
            $wpdb->query("ALTER TABLE $table ADD COLUMN $column $definition");
        }
    }
}

/**
 * Récupération de tous les produits
 */
function inventory_get_products()
{
    $pdo = inventory_db_get_pdo();
    if (!$pdo) {
        wp_send_json_error(['message' => 'Connexion à la base impossible']);
        return;
    }

    $stmt = $pdo->query("SELECT * FROM {$GLOBALS['wpdb']->prefix}inventaire ORDER BY id DESC");
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($data) {
        $upload_dir = wp_get_upload_dir();
        foreach ($data as &$product) {
            if (!empty($product['image']) && !preg_match('#^https?://#', $product['image'])) {
                $product['image'] = trailingslashit($upload_dir['baseurl']) . ltrim($product['image'], '/');
            }
        }
        unset($product);
    }

    wp_send_json_success($data);
    return;
}
add_action('wp_ajax_get_products', 'inventory_get_products');
add_action('wp_ajax_nopriv_get_products', 'inventory_get_products');

/**
 * Ajout d’un produit
 */
function inventory_add_product()
{
    $pdo = inventory_db_get_pdo();
    if (!$pdo) {
        wp_send_json_error(['message' => 'Connexion à la base impossible']);
        return;
    }

    $fields = [
        'nom'               => sanitize_text_field($_POST['nom'] ?? ''),
        'reference'         => sanitize_text_field($_POST['reference'] ?? ''),
        'emplacement'       => sanitize_text_field($_POST['emplacement'] ?? ''),
        'prix_achat'        => floatval($_POST['prix_achat'] ?? 0),
        'prix_vente'        => floatval($_POST['prix_vente'] ?? 0),
        'prix_vente_ebay'   => !empty($_POST['prix_vente_ebay']) ? floatval($_POST['prix_vente_ebay']) : null,
        'prix_vente_lbc'    => !empty($_POST['prix_vente_lbc']) ? floatval($_POST['prix_vente_lbc']) : null,
        'prix_vente_vinted' => !empty($_POST['prix_vente_vinted']) ? floatval($_POST['prix_vente_vinted']) : null,
        'prix_vente_autre'  => !empty($_POST['prix_vente_autre']) ? floatval($_POST['prix_vente_autre']) : null,
        'stock'             => intval($_POST['stock'] ?? 0),
        'a_completer'       => isset($_POST['a_completer']) ? 1 : 0,
        'notes'             => sanitize_textarea_field($_POST['notes'] ?? ''),
        'description'       => sanitize_textarea_field($_POST['description'] ?? ''),
        'date_achat'        => sanitize_text_field($_POST['date_achat'] ?? ''),
        'image'             => '',
    ];

    // Gestion image
    $imageField = null;
    if (!empty($_FILES['image']['name'])) {
        $imageField = 'image';
    } elseif (!empty($_FILES['product-image']['name'])) {
        // Compatibilité avec l'ancien nom de champ
        $imageField = 'product-image';
    }

    if ($imageField) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        $upload = wp_handle_upload($_FILES[$imageField], ['test_form' => false]);
        if (!isset($upload['error'])) {
            $fields['image'] = $upload['url'];
        } else {
            wp_send_json_error(['message' => 'Erreur upload image : ' . $upload['error']]);
            return;
        }
    }

    try {
        $sql = "INSERT INTO {$GLOBALS['wpdb']->prefix}inventaire
                (nom, reference, emplacement, prix_achat, prix_vente, prix_vente_ebay, prix_vente_lbc, prix_vente_vinted, prix_vente_autre, stock, a_completer, notes, description, date_achat, image)
                VALUES (:nom, :reference, :emplacement, :prix_achat, :prix_vente, :prix_vente_ebay, :prix_vente_lbc, :prix_vente_vinted, :prix_vente_autre, :stock, :a_completer, :notes, :description, :date_achat, :image)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($fields);
        wp_send_json_success(['id' => $pdo->lastInsertId()]);
        return;
    } catch (PDOException $e) {
        wp_send_json_error(['message' => 'Erreur base de données : ' . $e->getMessage()]);
        return;
    }
}
add_action('wp_ajax_add_product', 'inventory_add_product');
add_action('wp_ajax_nopriv_add_product', 'inventory_add_product');

/**
 * Édition d’un produit
 */
function inventory_edit_product()
{
    $pdo = inventory_db_get_pdo();
    if (!$pdo) {
        wp_send_json_error(['message' => 'Connexion à la base impossible']);
        return;
    }

    $id = intval($_POST['id'] ?? 0);
    if ($id <= 0) {
        wp_send_json_error(['message' => 'Identifiant produit invalide.']);
        return;
    }

    $fields = [
        'nom'               => sanitize_text_field($_POST['nom'] ?? ''),
        'reference'         => sanitize_text_field($_POST['reference'] ?? ''),
        'emplacement'       => sanitize_text_field($_POST['emplacement'] ?? ''),
        'prix_achat'        => floatval($_POST['prix_achat'] ?? 0),
        'prix_vente'        => floatval($_POST['prix_vente'] ?? 0),
        'prix_vente_ebay'   => !empty($_POST['prix_vente_ebay']) ? floatval($_POST['prix_vente_ebay']) : null,
        'prix_vente_lbc'    => !empty($_POST['prix_vente_lbc']) ? floatval($_POST['prix_vente_lbc']) : null,
        'prix_vente_vinted' => !empty($_POST['prix_vente_vinted']) ? floatval($_POST['prix_vente_vinted']) : null,
        'prix_vente_autre'  => !empty($_POST['prix_vente_autre']) ? floatval($_POST['prix_vente_autre']) : null,
        'stock'             => intval($_POST['stock'] ?? 0),
        'a_completer'       => isset($_POST['a_completer']) ? 1 : 0,
        'notes'             => sanitize_textarea_field($_POST['notes'] ?? ''),
        'description'       => sanitize_textarea_field($_POST['description'] ?? ''),
        'date_achat'        => sanitize_text_field($_POST['date_achat'] ?? ''),
        'image'             => null,
    ];

    $existingImage = esc_url_raw($_POST['existing_image'] ?? '');

    $imageField = null;
    if (!empty($_FILES['image']['name'])) {
        $imageField = 'image';
    } elseif (!empty($_FILES['product-image']['name'])) {
        $imageField = 'product-image';
    }

    if ($imageField) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        $upload = wp_handle_upload($_FILES[$imageField], ['test_form' => false]);
        if (!isset($upload['error'])) {
            $fields['image'] = $upload['url'];
        } else {
            wp_send_json_error(['message' => 'Erreur upload image : ' . $upload['error']]);
            return;
        }
    } elseif (!empty($existingImage)) {
        $fields['image'] = $existingImage;
    }

    if ($fields['date_achat'] === '') {
        $fields['date_achat'] = null;
    }

    try {
        $sql = "UPDATE {$GLOBALS['wpdb']->prefix}inventaire
                SET nom = :nom,
                    reference = :reference,
                    emplacement = :emplacement,
                    prix_achat = :prix_achat,
                    prix_vente = :prix_vente,
                    prix_vente_ebay = :prix_vente_ebay,
                    prix_vente_lbc = :prix_vente_lbc,
                    prix_vente_vinted = :prix_vente_vinted,
                    prix_vente_autre = :prix_vente_autre,
                    stock = :stock,
                    a_completer = :a_completer,
                    notes = :notes,
                    description = :description,
                    date_achat = :date_achat,
                    image = :image
                WHERE id = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':nom' => $fields['nom'],
            ':reference' => $fields['reference'],
            ':emplacement' => $fields['emplacement'],
            ':prix_achat' => $fields['prix_achat'],
            ':prix_vente' => $fields['prix_vente'],
            ':prix_vente_ebay' => $fields['prix_vente_ebay'],
            ':prix_vente_lbc' => $fields['prix_vente_lbc'],
            ':prix_vente_vinted' => $fields['prix_vente_vinted'],
            ':prix_vente_autre' => $fields['prix_vente_autre'],
            ':stock' => $fields['stock'],
            ':a_completer' => $fields['a_completer'],
            ':notes' => $fields['notes'],
            ':description' => $fields['description'],
            ':date_achat' => $fields['date_achat'],
            ':image' => $fields['image'],
            ':id' => $id,
        ]);

        wp_send_json_success(['id' => $id]);
        return;
    } catch (PDOException $e) {
        wp_send_json_error(['message' => 'Erreur base de données : ' . $e->getMessage()]);
        return;
    }
}
add_action('wp_ajax_edit_product', 'inventory_edit_product');

/**
 * Mise à jour d’un champ produit
 */
function inventory_update_product()
{
    $id = intval($_POST['id'] ?? 0);
    $field = sanitize_key($_POST['field'] ?? '');
    $value = $_POST['value'] ?? '';

    if ($id <= 0 || !$field) {
        wp_send_json_error(['message' => 'Paramètres invalides.']);
        return;
    }

    $pdo = inventory_db_get_pdo();
    if (!$pdo) {
        wp_send_json_error(['message' => 'Connexion à la base impossible']);
        return;
    }

    $allowed = ['nom', 'reference', 'emplacement', 'prix_achat', 'prix_vente', 'prix_vente_ebay', 'prix_vente_lbc', 'prix_vente_vinted', 'prix_vente_autre', 'stock', 'a_completer', 'notes', 'description', 'date_achat'];
    if (!in_array($field, $allowed, true)) {
        wp_send_json_error(['message' => 'Champ non autorisé.']);
        return;
    }

    try {
        $sql = "UPDATE {$GLOBALS['wpdb']->prefix}inventaire SET {$field} = :value WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':value' => $value, ':id' => $id]);
        wp_send_json_success(['field' => $field, 'value' => $value]);
        return;
    } catch (PDOException $e) {
        wp_send_json_error(['message' => 'Erreur base de données : ' . $e->getMessage()]);
        return;
    }
}
add_action('wp_ajax_update_product', 'inventory_update_product');

/**
 * Suppression d’un produit
 */
function inventory_delete_product()
{
    $id = intval($_POST['id'] ?? 0);
    if ($id <= 0) {
        wp_send_json_error(['message' => 'ID invalide.']);
        return;
    }

    $pdo = inventory_db_get_pdo();
    if (!$pdo) {
        wp_send_json_error(['message' => 'Connexion à la base impossible']);
        return;
    }

    try {
        $sql = "DELETE FROM {$GLOBALS['wpdb']->prefix}inventaire WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        wp_send_json_success(['deleted' => $id]);
        return;
    } catch (PDOException $e) {
        wp_send_json_error(['message' => 'Erreur base de données : ' . $e->getMessage()]);
        return;
    }
}
add_action('wp_ajax_delete_product', 'inventory_delete_product');

/**
 * Initialisation à l'activation
 */
function inventory_activate()
{
    inventory_db_ensure_table();
}
register_activation_hook(__FILE__, 'inventory_activate');

/**
 * Enregistrer une vente
 */
function inventory_add_sale()
{
    $pdo = inventory_db_get_pdo();
    if (!$pdo) {
        wp_send_json_error(['message' => 'Connexion à la base impossible']);
        return;
    }

    $produit_id = intval($_POST['produit_id'] ?? 0);
    if ($produit_id <= 0) {
        wp_send_json_error(['message' => 'Produit invalide']);
        return;
    }

    // Récupérer les informations du produit
    try {
        $stmt = $pdo->prepare("SELECT * FROM {$GLOBALS['wpdb']->prefix}inventaire WHERE id = :id");
        $stmt->execute([':id' => $produit_id]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$product) {
            wp_send_json_error(['message' => 'Produit non trouvé']);
            return;
        }

        $quantite = intval($_POST['quantite'] ?? 1);
        if ($quantite <= 0) {
            wp_send_json_error(['message' => 'Quantité invalide']);
            return;
        }

        if ($product['stock'] < $quantite) {
            wp_send_json_error(['message' => 'Stock insuffisant']);
            return;
        }

        $fields = [
            'produit_id' => $produit_id,
            'produit_nom' => $product['nom'],
            'produit_reference' => $product['reference'],
            'quantite' => $quantite,
            'prix_vente' => floatval($_POST['prix_vente'] ?? 0),
            'plateforme' => sanitize_text_field($_POST['plateforme'] ?? ''),
            'frais' => floatval($_POST['frais'] ?? 0),
            'prix_achat_unitaire' => floatval($product['prix_achat'] ?? 0),
            'date_vente' => sanitize_text_field($_POST['date_vente'] ?? date('Y-m-d')),
            'notes' => sanitize_textarea_field($_POST['notes'] ?? ''),
        ];

        // Insérer la vente
        $sql = "INSERT INTO {$GLOBALS['wpdb']->prefix}inventaire_ventes
                (produit_id, produit_nom, produit_reference, quantite, prix_vente, plateforme, frais, prix_achat_unitaire, date_vente, notes)
                VALUES (:produit_id, :produit_nom, :produit_reference, :quantite, :prix_vente, :plateforme, :frais, :prix_achat_unitaire, :date_vente, :notes)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($fields);

        $sale_id = $pdo->lastInsertId();

        // Mettre à jour le stock
        $new_stock = $product['stock'] - $quantite;
        $stmt = $pdo->prepare("UPDATE {$GLOBALS['wpdb']->prefix}inventaire SET stock = :stock WHERE id = :id");
        $stmt->execute([':stock' => $new_stock, ':id' => $produit_id]);

        wp_send_json_success([
            'id' => $sale_id,
            'new_stock' => $new_stock
        ]);
        return;
    } catch (PDOException $e) {
        wp_send_json_error(['message' => 'Erreur base de données : ' . $e->getMessage()]);
        return;
    }
}
add_action('wp_ajax_add_sale', 'inventory_add_sale');

/**
 * Récupérer toutes les ventes
 */
function inventory_get_sales()
{
    $pdo = inventory_db_get_pdo();
    if (!$pdo) {
        wp_send_json_error(['message' => 'Connexion à la base impossible']);
        return;
    }

    try {
        $stmt = $pdo->query("SELECT * FROM {$GLOBALS['wpdb']->prefix}inventaire_ventes ORDER BY date_vente DESC, id DESC");
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        wp_send_json_success($data);
        return;
    } catch (PDOException $e) {
        wp_send_json_error(['message' => 'Erreur base de données : ' . $e->getMessage()]);
        return;
    }
}
add_action('wp_ajax_get_sales', 'inventory_get_sales');
add_action('wp_ajax_nopriv_get_sales', 'inventory_get_sales');

/**
 * Supprimer une vente
 */
function inventory_delete_sale()
{
    $pdo = inventory_db_get_pdo();
    if (!$pdo) {
        wp_send_json_error(['message' => 'Connexion à la base impossible']);
        return;
    }

    $id = intval($_POST['id'] ?? 0);
    if ($id <= 0) {
        wp_send_json_error(['message' => 'ID invalide']);
        return;
    }

    try {
        // Récupérer la vente avant de la supprimer pour restaurer le stock
        $stmt = $pdo->prepare("SELECT * FROM {$GLOBALS['wpdb']->prefix}inventaire_ventes WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $sale = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$sale) {
            wp_send_json_error(['message' => 'Vente non trouvée']);
            return;
        }

        // Restaurer le stock
        $stmt = $pdo->prepare("UPDATE {$GLOBALS['wpdb']->prefix}inventaire SET stock = stock + :quantite WHERE id = :produit_id");
        $stmt->execute([
            ':quantite' => $sale['quantite'],
            ':produit_id' => $sale['produit_id']
        ]);

        // Supprimer la vente
        $stmt = $pdo->prepare("DELETE FROM {$GLOBALS['wpdb']->prefix}inventaire_ventes WHERE id = :id");
        $stmt->execute([':id' => $id]);

        wp_send_json_success(['deleted' => $id]);
        return;
    } catch (PDOException $e) {
        wp_send_json_error(['message' => 'Erreur base de données : ' . $e->getMessage()]);
        return;
    }
}
add_action('wp_ajax_delete_sale', 'inventory_delete_sale');

/**
 * Obtenir les statistiques des ventes
 */
function inventory_get_sales_stats()
{
    $pdo = inventory_db_get_pdo();
    if (!$pdo) {
        wp_send_json_error(['message' => 'Connexion à la base impossible']);
        return;
    }

    try {
        $stmt = $pdo->query("
            SELECT
                COUNT(*) as total_ventes,
                SUM(quantite) as total_articles_vendus,
                SUM(prix_vente * quantite) as chiffre_affaires,
                SUM(frais) as total_frais,
                SUM((prix_vente * quantite) - (prix_achat_unitaire * quantite) - frais) as marge_nette,
                AVG(prix_vente) as prix_moyen
            FROM {$GLOBALS['wpdb']->prefix}inventaire_ventes
        ");
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        // Statistiques par plateforme
        $stmt = $pdo->query("
            SELECT
                plateforme,
                COUNT(*) as nb_ventes,
                SUM(quantite) as articles_vendus,
                SUM(prix_vente * quantite) as ca
            FROM {$GLOBALS['wpdb']->prefix}inventaire_ventes
            WHERE plateforme IS NOT NULL AND plateforme != ''
            GROUP BY plateforme
            ORDER BY ca DESC
        ");
        $by_platform = $stmt->fetchAll(PDO::FETCH_ASSOC);

        wp_send_json_success([
            'global' => $stats,
            'by_platform' => $by_platform
        ]);
        return;
    } catch (PDOException $e) {
        wp_send_json_error(['message' => 'Erreur base de données : ' . $e->getMessage()]);
        return;
    }
}
add_action('wp_ajax_get_sales_stats', 'inventory_get_sales_stats');
add_action('wp_ajax_nopriv_get_sales_stats', 'inventory_get_sales_stats');

/**
 * Vérification de la table à chaque chargement (pour les migrations)
 */
add_action('after_setup_theme', 'inventory_db_ensure_table');

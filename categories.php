<?php
/**
 * Gestion des catégories et tags pour l'inventaire.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!is_user_logged_in()) {
    return;
}
?>
<div id="inventory-taxonomy-manager" class="inventory-taxonomy-manager">
    <section class="inventory-card taxonomy-card taxonomy-categories">
        <div class="taxonomy-header">
            <div>
                <h3><?php echo esc_html('Catégories Inventaire perso'); ?></h3>
                <p><?php echo esc_html('Structurez vos collections avec des catégories personnalisées.'); ?></p>
            </div>
            <button type="button" class="inventory-button ghost-button" id="reset-category-form"><?php echo esc_html('Nouvelle catégorie'); ?></button>
        </div>
        <form id="inventory-category-form" class="taxonomy-form">
            <input type="hidden" id="category-id" value="" />
            <div class="taxonomy-fields">
                <div class="taxonomy-field">
                    <label for="category-name"><?php echo esc_html('Nom'); ?></label>
                    <input type="text" id="category-name" class="form-control" placeholder="<?php echo esc_attr('Ex : Bagues vintage'); ?>" required />
                </div>
                <div class="taxonomy-field taxonomy-field-color">
                    <label for="category-color"><?php echo esc_html('Couleur'); ?></label>
                    <input type="color" id="category-color" value="#c47b83" />
                </div>
                <div class="taxonomy-field">
                    <label for="category-icon"><?php echo esc_html('Icône (emoji ou classe)'); ?></label>
                    <input type="text" id="category-icon" class="form-control" placeholder="<?php echo esc_attr('💎 ou texte court'); ?>" />
                </div>
            </div>
            <div class="taxonomy-actions">
                <button type="submit" class="inventory-button primary-button"><?php echo esc_html('Enregistrer la catégorie'); ?></button>
            </div>
        </form>
        <div class="taxonomy-list-wrapper">
            <ul id="inventory-category-list" class="taxonomy-list" aria-live="polite"></ul>
        </div>
    </section>

    <section class="inventory-card taxonomy-card taxonomy-tags">
        <div class="taxonomy-header">
            <div>
                <h3><?php echo esc_html('Tags Inventaire perso'); ?></h3>
                <p><?php echo esc_html('Ajoutez des mots-clés pour retrouver rapidement vos pièces.'); ?></p>
            </div>
            <button type="button" class="inventory-button ghost-button" id="reset-tag-form"><?php echo esc_html('Nouveau tag'); ?></button>
        </div>
        <form id="inventory-tag-form" class="taxonomy-form">
            <input type="hidden" id="tag-id" value="" />
            <div class="taxonomy-fields">
                <div class="taxonomy-field">
                    <label for="tag-name"><?php echo esc_html('Nom du tag'); ?></label>
                    <input type="text" id="tag-name" class="form-control" placeholder="<?php echo esc_attr('Ex : Art déco, perles...'); ?>" required />
                </div>
            </div>
            <div class="taxonomy-actions">
                <button type="submit" class="inventory-button primary-button"><?php echo esc_html('Enregistrer le tag'); ?></button>
            </div>
        </form>
        <div class="taxonomy-list-wrapper">
            <ul id="inventory-tag-list" class="taxonomy-list" aria-live="polite"></ul>
        </div>
    </section>
</div>
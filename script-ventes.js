(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var settings = window.inventorySettings || {};
    var ajaxUrl = settings.ajaxUrl || window.ajaxurl;
    if (!ajaxUrl) {
      return;
    }

    // Éléments du DOM
    var saleModalOverlay = document.getElementById('sale-modal-overlay');
    var saleModalClose = document.getElementById('sale-modal-close');
    var saleModalCancel = document.getElementById('sale-modal-cancel');
    var saleForm = document.getElementById('sale-form');
    var saleProductId = document.getElementById('sale-product-id');
    var saleProductInfo = document.getElementById('sale-product-info');
    var saleQuantite = document.getElementById('sale-quantite');
    var salePlateforme = document.getElementById('sale-plateforme');
    var salePrixVente = document.getElementById('sale-prix-vente');
    var saleFrais = document.getElementById('sale-frais');
    var saleDateVente = document.getElementById('sale-date-vente');
    var saleNotes = document.getElementById('sale-notes');
    var saleStockHint = document.getElementById('sale-stock-hint');
    var salePriceHint = document.getElementById('sale-price-hint');
    var saleSubmitButton = document.getElementById('sale-submit-button');

    var currentProduct = null;

    // Ouvrir le modal de vente
    window.openSaleModal = function (product) {
      if (!product || !saleModalOverlay) return;

      currentProduct = product;

      // Remplir les informations du produit
      if (saleProductId) saleProductId.value = product.id;
      if (saleProductInfo) {
        saleProductInfo.innerHTML = '<strong>' + (product.nom || '') + '</strong><br><small>Réf: ' + (product.reference || '') + '</small>';
      }

      // Définir la quantité max
      if (saleQuantite) {
        saleQuantite.max = product.stock || 1;
        saleQuantite.value = 1;
      }

      // Hint de stock
      if (saleStockHint) {
        saleStockHint.textContent = 'Stock disponible : ' + (product.stock || 0);
      }

      // Pré-remplir le prix selon la plateforme sélectionnée
      if (salePlateforme && salePrixVente) {
        salePlateforme.value = '';
        salePrixVente.value = '';
        salePriceHint.textContent = '';
      }

      // Date par défaut à aujourd'hui
      if (saleDateVente) {
        var today = new Date().toISOString().split('T')[0];
        saleDateVente.value = today;
      }

      // Réinitialiser les autres champs
      if (saleFrais) saleFrais.value = '0';
      if (saleNotes) saleNotes.value = '';

      // Afficher le modal
      saleModalOverlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    };

    // Fermer le modal
    function closeSaleModal() {
      if (saleModalOverlay) {
        saleModalOverlay.style.display = 'none';
        document.body.style.overflow = '';
      }
      currentProduct = null;
    }

    if (saleModalClose) {
      saleModalClose.addEventListener('click', closeSaleModal);
    }

    if (saleModalCancel) {
      saleModalCancel.addEventListener('click', closeSaleModal);
    }

    // Fermer en cliquant sur l'overlay
    if (saleModalOverlay) {
      saleModalOverlay.addEventListener('click', function (e) {
        if (e.target === saleModalOverlay) {
          closeSaleModal();
        }
      });
    }

    // Suggérer le prix selon la plateforme
    if (salePlateforme && salePrixVente && salePriceHint) {
      salePlateforme.addEventListener('change', function () {
        if (!currentProduct) return;

        var platform = this.value;
        var suggestedPrice = 0;

        switch (platform) {
          case 'ebay':
            suggestedPrice = currentProduct.prix_vente_ebay;
            break;
          case 'lbc':
            suggestedPrice = currentProduct.prix_vente_lbc;
            break;
          case 'vinted':
            suggestedPrice = currentProduct.prix_vente_vinted;
            break;
          case 'autre':
            suggestedPrice = currentProduct.prix_vente_autre;
            break;
        }

        if (suggestedPrice && suggestedPrice > 0) {
          salePrixVente.value = suggestedPrice;
          salePriceHint.textContent = 'Prix suggéré pour ' + platform + ' : ' + formatCurrency(suggestedPrice);
        } else {
          salePriceHint.textContent = 'Aucun prix défini pour cette plateforme';
        }
      });
    }

    // Soumettre le formulaire de vente
    if (saleForm) {
      saleForm.addEventListener('submit', function (e) {
        e.preventDefault();

        if (!currentProduct || !saleSubmitButton) return;

        saleSubmitButton.disabled = true;

        var formData = new FormData(saleForm);
        formData.append('action', 'add_sale');
        formData.append('produit_id', currentProduct.id);

        fetch(ajaxUrl, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
        })
          .then(function (response) {
            if (!response.ok) {
              throw new Error('Erreur réseau');
            }
            return response.json();
          })
          .then(function (json) {
            if (!json || !json.success) {
              throw new Error((json && json.data && json.data.message) || 'Erreur');
            }

            // Fermer le modal
            closeSaleModal();

            // Afficher un message de succès
            if (window.showToast) {
              window.showToast('Vente enregistrée avec succès !', 'success');
            }

            // Rafraîchir les produits et statistiques
            if (window.fetchProducts) {
              window.fetchProducts();
            }
          })
          .catch(function (error) {
            if (window.showToast) {
              window.showToast('Erreur lors de l\'enregistrement de la vente : ' + (error && error.message ? error.message : ''), 'error');
            }
          })
          .finally(function () {
            if (saleSubmitButton) {
              saleSubmitButton.disabled = false;
            }
          });
      });
    }

    function formatCurrency(amount) {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
      }).format(amount);
    }
  });
})();

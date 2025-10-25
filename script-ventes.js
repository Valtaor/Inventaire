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

            // Rafraîchir les produits et les ventes
            if (window.fetchProducts) {
              window.fetchProducts();
            }
            fetchSales();
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

    // Éléments de l'historique des ventes
    var salesTableBody = document.getElementById('sales-table-body');
    var emptySalesState = document.getElementById('empty-sales-state');
    var filterSalesPlatform = document.getElementById('filterSalesPlatform');
    var filterSalesDateStart = document.getElementById('filterSalesDateStart');
    var filterSalesDateEnd = document.getElementById('filterSalesDateEnd');
    var exportSalesBtn = document.getElementById('export-sales-csv');

    var allSales = [];
    var filteredSales = [];

    // Charger les ventes
    function fetchSales() {
      fetch(ajaxUrl + '?action=get_sales', {
        method: 'GET',
        credentials: 'same-origin'
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Erreur réseau');
          }
          return response.json();
        })
        .then(function (json) {
          if (json && json.success && json.data) {
            allSales = json.data;
            applyFilters();
            fetchSalesStats();
          }
        })
        .catch(function (error) {
          console.error('Erreur chargement ventes:', error);
        });
    }

    // Appliquer les filtres
    function applyFilters() {
      filteredSales = allSales.filter(function (sale) {
        // Filtre plateforme
        if (filterSalesPlatform && filterSalesPlatform.value && sale.plateforme !== filterSalesPlatform.value) {
          return false;
        }

        // Filtre date début
        if (filterSalesDateStart && filterSalesDateStart.value && sale.date_vente < filterSalesDateStart.value) {
          return false;
        }

        // Filtre date fin
        if (filterSalesDateEnd && filterSalesDateEnd.value && sale.date_vente > filterSalesDateEnd.value) {
          return false;
        }

        return true;
      });

      renderSales();
      updateFilteredStats();
    }

    // Afficher les ventes
    function renderSales() {
      if (!salesTableBody) return;

      salesTableBody.innerHTML = '';

      if (filteredSales.length === 0) {
        if (emptySalesState) {
          emptySalesState.style.display = 'block';
        }
        return;
      }

      if (emptySalesState) {
        emptySalesState.style.display = 'none';
      }

      filteredSales.forEach(function (sale) {
        var row = document.createElement('tr');

        // Date
        var dateCell = document.createElement('td');
        dateCell.textContent = formatDate(sale.date_vente);
        row.appendChild(dateCell);

        // Produit
        var produitCell = document.createElement('td');
        produitCell.innerHTML = '<strong>' + (sale.produit_nom || '') + '</strong><br><small>Réf: ' + (sale.produit_reference || '') + '</small>';
        row.appendChild(produitCell);

        // Quantité
        var qteCell = document.createElement('td');
        qteCell.textContent = sale.quantite || 0;
        row.appendChild(qteCell);

        // Plateforme
        var plateformeCell = document.createElement('td');
        if (sale.plateforme) {
          var badge = document.createElement('span');
          badge.className = 'platform-badge ' + sale.plateforme.toLowerCase();
          badge.textContent = sale.plateforme.toUpperCase();
          plateformeCell.appendChild(badge);
        } else {
          plateformeCell.textContent = '—';
        }
        row.appendChild(plateformeCell);

        // Prix vente
        var prixCell = document.createElement('td');
        prixCell.textContent = formatCurrency(Number(sale.prix_vente) * Number(sale.quantite));
        row.appendChild(prixCell);

        // Frais
        var fraisCell = document.createElement('td');
        fraisCell.textContent = formatCurrency(Number(sale.frais || 0));
        row.appendChild(fraisCell);

        // Marge
        var margeCell = document.createElement('td');
        var marge = (Number(sale.prix_vente) * Number(sale.quantite)) - (Number(sale.prix_achat_unitaire) * Number(sale.quantite)) - Number(sale.frais || 0);
        margeCell.textContent = formatCurrency(marge);
        margeCell.className = marge >= 0 ? 'margin-positive' : 'margin-negative';
        row.appendChild(margeCell);

        // Actions
        var actionsCell = document.createElement('td');
        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'inventory-action-btn is-danger';
        deleteBtn.textContent = 'Supprimer';
        deleteBtn.addEventListener('click', function () {
          if (confirm('Supprimer cette vente ? Le stock sera restauré.')) {
            deleteSale(sale.id);
          }
        });
        actionsCell.appendChild(deleteBtn);
        row.appendChild(actionsCell);

        salesTableBody.appendChild(row);
      });
    }

    // Supprimer une vente
    function deleteSale(id) {
      var formData = new FormData();
      formData.append('action', 'delete_sale');
      formData.append('id', id);

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

          if (window.showToast) {
            window.showToast('Vente supprimée, stock restauré', 'success');
          }

          if (window.fetchProducts) {
            window.fetchProducts();
          }
          fetchSales();
        })
        .catch(function (error) {
          if (window.showToast) {
            window.showToast('Erreur lors de la suppression : ' + (error && error.message ? error.message : ''), 'error');
          }
        });
    }

    // Charger les statistiques
    function fetchSalesStats() {
      fetch(ajaxUrl + '?action=get_sales_stats', {
        method: 'GET',
        credentials: 'same-origin'
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Erreur réseau');
          }
          return response.json();
        })
        .then(function (json) {
          if (json && json.success && json.data) {
            updateGlobalStats(json.data.global);
          }
        })
        .catch(function (error) {
          console.error('Erreur stats ventes:', error);
        });
    }

    // Mettre à jour les statistiques globales
    function updateGlobalStats(stats) {
      var countEl = document.getElementById('stat-sales-count');
      if (countEl) {
        countEl.textContent = stats.total_ventes || 0;
      }

      var qtyEl = document.getElementById('stat-sales-quantity');
      if (qtyEl) {
        qtyEl.textContent = stats.total_articles_vendus || 0;
      }

      var revenueEl = document.getElementById('stat-sales-revenue');
      if (revenueEl) {
        revenueEl.textContent = formatCurrency(Number(stats.chiffre_affaires || 0));
      }

      var marginEl = document.getElementById('stat-sales-margin');
      if (marginEl) {
        marginEl.textContent = formatCurrency(Number(stats.marge_nette || 0));
      }
    }

    // Mettre à jour les stats filtrées
    function updateFilteredStats() {
      var totalSales = filteredSales.length;
      var totalQty = filteredSales.reduce(function (sum, sale) {
        return sum + Number(sale.quantite || 0);
      }, 0);
      var totalRevenue = filteredSales.reduce(function (sum, sale) {
        return sum + (Number(sale.prix_vente) * Number(sale.quantite));
      }, 0);
      var totalMargin = filteredSales.reduce(function (sum, sale) {
        return sum + ((Number(sale.prix_vente) * Number(sale.quantite)) - (Number(sale.prix_achat_unitaire) * Number(sale.quantite)) - Number(sale.frais || 0));
      }, 0);

      var countEl = document.getElementById('stat-sales-count');
      if (countEl) countEl.textContent = totalSales;

      var qtyEl = document.getElementById('stat-sales-quantity');
      if (qtyEl) qtyEl.textContent = totalQty;

      var revenueEl = document.getElementById('stat-sales-revenue');
      if (revenueEl) revenueEl.textContent = formatCurrency(totalRevenue);

      var marginEl = document.getElementById('stat-sales-margin');
      if (marginEl) marginEl.textContent = formatCurrency(totalMargin);
    }

    // Export CSV
    if (exportSalesBtn) {
      exportSalesBtn.addEventListener('click', function () {
        if (filteredSales.length === 0) {
          if (window.showToast) {
            window.showToast('Aucune vente à exporter', 'error');
          }
          return;
        }

        var header = ['Date', 'Produit', 'Référence', 'Quantité', 'Plateforme', 'Prix vente', 'Frais', 'Prix achat', 'Marge', 'Notes'];
        var rows = filteredSales.map(function (sale) {
          var marge = (Number(sale.prix_vente) * Number(sale.quantite)) - (Number(sale.prix_achat_unitaire) * Number(sale.quantite)) - Number(sale.frais || 0);
          return [
            sale.date_vente,
            sale.produit_nom,
            sale.produit_reference,
            sale.quantite,
            sale.plateforme,
            sale.prix_vente,
            sale.frais,
            sale.prix_achat_unitaire,
            marge.toFixed(2),
            sale.notes
          ].map(function (value) {
            var stringValue = value === null || value === undefined ? '' : String(value);
            if (stringValue.indexOf('"') !== -1 || stringValue.indexOf(';') !== -1) {
              stringValue = '"' + stringValue.replace(/"/g, '""') + '"';
            }
            return stringValue;
          }).join(';');
        });

        var csvContent = header.join(';') + '\n' + rows.join('\n');
        var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'ventes_' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        if (window.showToast) {
          window.showToast('Export CSV réussi', 'success');
        }
      });
    }

    // Écouter les filtres
    if (filterSalesPlatform) {
      filterSalesPlatform.addEventListener('change', applyFilters);
    }

    if (filterSalesDateStart) {
      filterSalesDateStart.addEventListener('change', applyFilters);
    }

    if (filterSalesDateEnd) {
      filterSalesDateEnd.addEventListener('change', applyFilters);
    }

    // Fonctions utilitaires
    function formatCurrency(amount) {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
      }).format(amount);
    }

    function formatDate(dateStr) {
      if (!dateStr) return '—';
      var parts = dateStr.split('-');
      if (parts.length === 3) {
        return parts[2] + '/' + parts[1] + '/' + parts[0];
      }
      return dateStr;
    }

    // Charger les ventes au démarrage
    fetchSales();
  });
})();

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var settings = window.inventorySettings || {};
    var ajaxUrl = settings.ajaxUrl || window.ajaxurl;
    if (!ajaxUrl) {
      return;
    }

    var page = document.querySelector('.inventory-page');
    var form = document.getElementById('inventory-form');
    var tableBody = document.getElementById('inventory-table-body');
    var emptyState = document.getElementById('empty-state');
    var toastStack = document.querySelector('.inventory-toast-stack');
    var submitButton = document.getElementById('submit-button');
    var themeToggle = document.getElementById('themeToggle');
    var searchInput = document.getElementById('inventory-search');
    var quickFilterButtons = Array.prototype.slice.call(document.querySelectorAll('.quick-filter-btn'));
    var filterCasier = document.getElementById('filterCasier');
    var filterStatus = document.getElementById('filterStatus');
    var exportButton = document.getElementById('export-csv');
    var mobileAddItem = document.getElementById('mobileAddItem');
    var mobileScrollInventory = document.getElementById('mobileScrollInventory');
    var mobileScrollStats = document.getElementById('mobileScrollStats');
    var statsCard = document.getElementById('statsCard');
    var inventoryCard = document.getElementById('inventoryCard');
    var photoInput = document.getElementById('product-image');
    var imagePreview = document.getElementById('image-preview');
    var previewContainer = document.getElementById('photoPreviewContainer');
    var cancelEditButton = document.getElementById('cancel-edit');
    var productIdInput = document.getElementById('product-id');
    var existingImageInput = document.getElementById('product-existing-image');
    var nameInput = document.getElementById('product-name');
    var referenceInput = document.getElementById('product-reference');
    var locationInput = document.getElementById('product-location');
    var stockInput = document.getElementById('product-stock');
    var purchaseInput = document.getElementById('product-prix-achat');
    var saleEbayInput = document.getElementById('product-prix-vente-ebay');
    var saleLbcInput = document.getElementById('product-prix-vente-lbc');
    var saleVintedInput = document.getElementById('product-prix-vente-vinted');
    var saleAutreInput = document.getElementById('product-prix-vente-autre');
    var dateInput = document.getElementById('product-date');
    var notesInput = document.getElementById('product-notes');
    var descriptionInput = document.getElementById('product-description');
    var incompleteInput = document.getElementById('product-incomplete');

    var uploadsUrl = settings.uploadsUrl || '';
    var i18n = settings.i18n || {};
    var currencyFormatter = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    });

    var allProducts = [];
    var filteredProducts = [];
    var currentPreviewUrl = null;
    var formMode = 'create';
    var currentEditId = null;
    var filterState = {
      quickStatus: 'all',
      casier: 'all',
      status: 'all',
      search: ''
    };

    function prefersDark() {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function applyTheme(theme) {
      if (!page) {
        return;
      }
      page.setAttribute('data-theme', theme);
      localStorage.setItem('inventory-theme', theme);
      if (themeToggle) {
        themeToggle.setAttribute('aria-pressed', theme === 'dark');
      }
    }

    function initialiseTheme() {
      var stored = null;
      try {
        stored = localStorage.getItem('inventory-theme');
      } catch (error) {
        stored = null;
      }
      var theme = stored || (prefersDark() ? 'dark' : 'light');
      applyTheme(theme);
    }

    initialiseTheme();

    if (themeToggle) {
      themeToggle.addEventListener('click', function () {
        var next = (page && page.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
        applyTheme(next);
      });
    }

    function showToast(message, type) {
      if (!toastStack || !message) {
        return;
      }
      var toast = document.createElement('div');
      toast.className = 'inventory-toast inventory-toast--' + (type || 'success');
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.textContent = message;
      toastStack.appendChild(toast);
      window.setTimeout(function () {
        toast.classList.add('is-visible');
      }, 20);
      window.setTimeout(function () {
        toast.classList.remove('is-visible');
        window.setTimeout(function () {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 4000);
    }

    function normalizeImage(url) {
      if (!url) {
        return '';
      }
      if (/^https?:\/\//i.test(url)) {
        return url;
      }
      if (uploadsUrl) {
        return uploadsUrl.replace(/\/?$/, '/') + url.replace(/^\//, '');
      }
      return url;
    }

    function formatCurrency(value) {
      var numeric = Number.parseFloat(value || 0);
      if (!Number.isFinite(numeric)) {
        numeric = 0;
      }
      return currencyFormatter.format(numeric);
    }

    function formatDate(value) {
      if (!value) {
        return '';
      }
      try {
        var date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleDateString('fr-FR');
        }
      } catch (error) {
        return value;
      }
      return value;
    }

    function setSubmitButtonLabel(isEdit) {
      if (!submitButton) {
        return;
      }
      var label = isEdit ? (i18n.updateLabel || 'Mettre à jour le produit') : (i18n.submitLabel || 'Ajouter à l\'inventaire');
      submitButton.textContent = label;
    }

    setSubmitButtonLabel(false);

    function updateEmptyState(list) {
      if (!emptyState) {
        return;
      }
      if (!list || !list.length) {
        emptyState.removeAttribute('hidden');
      } else {
        emptyState.setAttribute('hidden', 'hidden');
      }
    }

    function createTextElement(tag, className, text) {
      var element = document.createElement(tag);
      if (className) {
        element.className = className;
      }
      if (text) {
        element.textContent = text;
      }
      return element;
    }

    function buildStatusBadge(product) {
      var container = document.createElement('div');
      container.className = 'inventory-status';

      var inStock = Number(product.stock) > 0;
      var status = createTextElement('span', 'inventory-status-pill ' + (inStock ? 'is-success' : 'is-danger'), inStock ? (i18n.statusInStock || 'En stock') : (i18n.statusOutOfStock || 'Rupture'));
      container.appendChild(status);

      if (Number(product.a_completer) === 1) {
        container.appendChild(createTextElement('span', 'inventory-status-pill is-warning', i18n.statusIncomplete || 'À compléter'));
      }

      return container;
    }

    function buildFollowUpCell(product) {
      var container = document.createElement('div');
      container.className = 'inventory-follow-up';

      if (product.notes) {
        container.appendChild(createTextElement('p', 'inventory-follow-up-note', product.notes));
      }

      if (product.description) {
        container.appendChild(createTextElement('p', 'inventory-follow-up-description', product.description));
      }

      if (!product.notes && !product.description) {
        container.appendChild(createTextElement('p', 'inventory-follow-up-empty', '—'));
      }

      return container;
    }

    function buildInfoCell(product) {
      var list = document.createElement('ul');
      list.className = 'inventory-meta-list';

      var casier = product.emplacement ? product.emplacement : '';
      if (casier) {
        var casierItem = createTextElement('li', 'inventory-meta-item', casier);
        casierItem.setAttribute('data-meta-label', i18n.columnCasier || 'Casier');
        list.appendChild(casierItem);
      }

      var purchase = Number.parseFloat(product.prix_achat || 0);

      var purchaseItem = createTextElement('li', 'inventory-meta-item', formatCurrency(purchase));
      purchaseItem.setAttribute('data-meta-label', i18n.labelPurchase || 'Achat');
      list.appendChild(purchaseItem);

      // Affichage des prix de vente par plateforme
      var platforms = [
        { key: 'prix_vente_ebay', label: 'eBay' },
        { key: 'prix_vente_lbc', label: 'LBC' },
        { key: 'prix_vente_vinted', label: 'Vinted' },
        { key: 'prix_vente_autre', label: 'Autre' }
      ];

      platforms.forEach(function(platform) {
        var price = product[platform.key];
        if (price !== null && price !== undefined && price !== '' && Number.parseFloat(price) > 0) {
          var priceItem = createTextElement('li', 'inventory-meta-item', formatCurrency(Number.parseFloat(price)));
          priceItem.setAttribute('data-meta-label', platform.label);
          list.appendChild(priceItem);
        }
      });

      if (product.date_achat) {
        var dateItem = createTextElement('li', 'inventory-meta-item', formatDate(product.date_achat));
        dateItem.setAttribute('data-meta-label', i18n.labelDate || 'Acheté le');
        list.appendChild(dateItem);
      }

      return list;
    }

    function renderProducts(list) {
      if (!tableBody) {
        return;
      }
      tableBody.innerHTML = '';

      list.forEach(function (product) {
        var row = document.createElement('tr');
        row.dataset.id = product.id;

        var photoCell = document.createElement('td');
        photoCell.className = 'inventory-cell-photo';
        var photoWrapper = document.createElement('div');
        photoWrapper.className = 'inventory-photo-wrapper';
        if (product.image) {
          var image = document.createElement('img');
          image.src = normalizeImage(product.image);
          image.alt = product.nom ? product.nom : '';
          image.loading = 'lazy';
          image.width = 64;
          image.height = 64;
          photoWrapper.appendChild(image);
        } else {
          var placeholder = document.createElement('div');
          placeholder.className = 'inventory-photo-placeholder';
          placeholder.textContent = product.nom ? product.nom.charAt(0).toUpperCase() : '•';
          photoWrapper.appendChild(placeholder);
        }
        photoCell.appendChild(photoWrapper);
        row.appendChild(photoCell);

        var titleCell = document.createElement('td');
        titleCell.className = 'inventory-cell-title';
        titleCell.appendChild(createTextElement('span', 'inventory-item-title', product.nom || '—'));
        if (product.reference) {
          titleCell.appendChild(createTextElement('span', 'inventory-item-reference', product.reference));
        }
        row.appendChild(titleCell);

        var infoCell = document.createElement('td');
        infoCell.className = 'inventory-cell-meta';
        infoCell.appendChild(buildInfoCell(product));
        row.appendChild(infoCell);

        var quantityCell = document.createElement('td');
        quantityCell.className = 'inventory-cell-quantity';
        quantityCell.appendChild(createTextElement('span', 'inventory-quantity', String(product.stock || 0)));
        row.appendChild(quantityCell);

        var followUpCell = document.createElement('td');
        followUpCell.className = 'inventory-cell-follow';
        followUpCell.appendChild(buildFollowUpCell(product));
        row.appendChild(followUpCell);

        var statusCell = document.createElement('td');
        statusCell.className = 'inventory-cell-status';
        statusCell.appendChild(buildStatusBadge(product));
        row.appendChild(statusCell);

        var actionsCell = document.createElement('td');
        actionsCell.className = 'inventory-cell-actions';

        var editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'inventory-action-btn';
        editButton.dataset.action = 'edit';
        editButton.dataset.id = product.id;
        editButton.textContent = i18n.editLabel || 'Modifier';
        actionsCell.appendChild(editButton);

        // Bouton Vendre (seulement si stock > 0)
        if (product.stock > 0) {
          var sellButton = document.createElement('button');
          sellButton.type = 'button';
          sellButton.className = 'btn-sell';
          sellButton.dataset.action = 'sell';
          sellButton.dataset.id = product.id;
          sellButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>Vendu';
          sellButton.addEventListener('click', function() {
            if (window.openSaleModal) {
              window.openSaleModal(product);
            }
          });
          actionsCell.appendChild(sellButton);
        }

        var toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'inventory-action-btn';
        toggleButton.dataset.action = 'toggle-incomplete';
        toggleButton.dataset.id = product.id;
        toggleButton.textContent = Number(product.a_completer) === 1 ? (i18n.toggleComplete || 'Marquer comme complet') : (i18n.toggleIncomplete || 'Marquer comme à compléter');
        actionsCell.appendChild(toggleButton);

        var deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'inventory-action-btn is-danger';
        deleteButton.dataset.action = 'delete';
        deleteButton.dataset.id = product.id;
        deleteButton.textContent = i18n.deleteConfirm ? i18n.deleteConfirm.replace(' ?', '') : 'Supprimer';
        actionsCell.appendChild(deleteButton);

        row.appendChild(actionsCell);

        tableBody.appendChild(row);
      });

      updateEmptyState(list);
    }

    function sum(list, accessor) {
      return list.reduce(function (total, item) {
        var value = accessor(item);
        var numeric = Number.parseFloat(value || 0);
        if (!Number.isFinite(numeric)) {
          numeric = 0;
        }
        return total + numeric;
      }, 0);
    }

    function getAverageSalePrice(product) {
      var prices = [
        product.prix_vente_ebay,
        product.prix_vente_lbc,
        product.prix_vente_vinted,
        product.prix_vente_autre
      ].filter(function(p) {
        return p !== null && p !== undefined && p !== '' && Number.parseFloat(p) > 0;
      }).map(function(p) {
        return Number.parseFloat(p);
      });

      if (prices.length === 0) return 0;
      return prices.reduce(function(a, b) { return a + b; }, 0) / prices.length;
    }

    function updateStats() {
      var totalArticles = sum(allProducts, function (item) {
        return item.stock;
      });
      var outOfStock = allProducts.filter(function (item) {
        return Number(item.stock) <= 0;
      }).length;
      var totalSale = sum(allProducts, function (item) {
        return getAverageSalePrice(item) * Number(item.stock || 0);
      });
      var totalPurchase = sum(allProducts, function (item) {
        return Number(item.prix_achat) * Number(item.stock || 0);
      });
      var totalMargin = totalSale - totalPurchase;
      var lowStock = allProducts.filter(function (item) {
        return Number(item.stock) > 0 && Number(item.stock) <= 1;
      }).length;
      var incomplete = allProducts.filter(function (item) {
        return Number(item.a_completer) === 1;
      }).length;
      var averageMargin = allProducts.length ? totalMargin / allProducts.length : 0;

      var totalArticlesEl = document.getElementById('stat-total-articles');
      if (totalArticlesEl) {
        totalArticlesEl.textContent = String(totalArticles);
      }
      var outOfStockEl = document.getElementById('stat-out-of-stock');
      if (outOfStockEl) {
        outOfStockEl.textContent = String(outOfStock);
      }
      var valeurVenteEl = document.getElementById('stat-valeur-vente');
      if (valeurVenteEl) {
        valeurVenteEl.textContent = formatCurrency(totalSale);
      }
      var valeurAchatEl = document.getElementById('stat-valeur-achat');
      if (valeurAchatEl) {
        valeurAchatEl.textContent = formatCurrency(totalPurchase);
      }
      var margeTotaleEl = document.getElementById('stat-marge-totale');
      if (margeTotaleEl) {
        margeTotaleEl.textContent = formatCurrency(totalMargin);
      }
      var lowStockEl = document.getElementById('stat-low-stock');
      if (lowStockEl) {
        lowStockEl.textContent = String(lowStock);
      }
      var incompleteEl = document.getElementById('stat-incomplete');
      if (incompleteEl) {
        incompleteEl.textContent = String(incomplete);
      }
      var averageMarginEl = document.getElementById('stat-average-margin');
      if (averageMarginEl) {
        averageMarginEl.textContent = formatCurrency(averageMargin);
      }
    }

    function matchesStatus(product, status) {
      if (!status || status === 'all') {
        return true;
      }
      if (status === 'en-stock') {
        return Number(product.stock) > 0;
      }
      if (status === 'rupture') {
        return Number(product.stock) <= 0;
      }
      if (status === 'incomplet') {
        return Number(product.a_completer) === 1;
      }
      return true;
    }

    function applyFilters() {
      filteredProducts = allProducts.filter(function (product) {
        if (!matchesStatus(product, filterState.quickStatus)) {
          return false;
        }
        if (!matchesStatus(product, filterState.status)) {
          return false;
        }
        if (filterState.casier !== 'all') {
          var emplacement = (product.emplacement || '').toLowerCase();
          if (emplacement !== filterState.casier.toLowerCase()) {
            return false;
          }
        }
        if (filterState.search) {
          var query = filterState.search.toLowerCase();
          var haystack = [product.nom, product.reference, product.notes, product.description]
            .map(function (value) {
              return (value || '').toString().toLowerCase();
            })
            .join(' ');
          if (haystack.indexOf(query) === -1) {
            return false;
          }
        }
        return true;
      });
      renderProducts(filteredProducts);
    }

    function populateFilters() {
      if (filterCasier) {
        var selectedCasier = filterCasier.value;
        filterCasier.innerHTML = '';
        var defaultOption = document.createElement('option');
        defaultOption.value = 'all';
        defaultOption.textContent = i18n.filterAllCasiers || 'Tous les casiers';
        filterCasier.appendChild(defaultOption);
        var casiers = Array.from(new Set(allProducts
          .map(function (product) { return product.emplacement; })
          .filter(function (value) { return !!value; })
        )).sort();
        casiers.forEach(function (casier) {
          var option = document.createElement('option');
          option.value = casier;
          option.textContent = casier;
          if (casier === selectedCasier) {
            option.selected = true;
          }
          filterCasier.appendChild(option);
        });
      }

      if (filterStatus && filterStatus.options.length === 1) {
        var statuses = [
          { value: 'all', label: i18n.filterAllStatus || 'Tous les statuts' },
          { value: 'en-stock', label: i18n.statusInStock || 'En stock' },
          { value: 'rupture', label: i18n.statusOutOfStock || 'Rupture' },
          { value: 'incomplet', label: i18n.statusIncomplete || 'À compléter' }
        ];
        filterStatus.innerHTML = '';
        statuses.forEach(function (status) {
          var option = document.createElement('option');
          option.value = status.value;
          option.textContent = status.label;
          filterStatus.appendChild(option);
        });
      }
    }

    function fetchProducts() {
      var url = ajaxUrl;
      if (url.indexOf('?') === -1) {
        url += '?action=get_products';
      } else {
        url += '&action=get_products';
      }

      return fetch(url, {
        credentials: 'same-origin'
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Network error');
          }
          return response.json();
        })
        .then(function (json) {
          if (!json || !json.success) {
            throw new Error((json && json.data && json.data.message) || 'Erreur');
          }
          allProducts = (json.data || []).map(function (product) {
            product.image = normalizeImage(product.image);
            return product;
          });
          populateFilters();
          updateStats();
          applyFilters();
        })
        .catch(function (error) {
          showToast(i18n.loadError || 'Impossible de charger les produits.', 'error');
          if (window.console && console.error) {
            console.error(error);
          }
        });
    }

    function submitForm(event) {
      if (!form) {
        return;
      }
      event.preventDefault();
      var isEditing = formMode === 'edit';
      var formData = new FormData(form);
      formData.append('action', isEditing ? 'edit_product' : 'add_product');

      if (isEditing) {
        var editId = currentEditId || (productIdInput ? productIdInput.value : '');
        if (!editId) {
          showToast(i18n.toastEditError || 'Erreur lors de la mise à jour du produit.', 'error');
          return;
        }
        formData.append('id', editId);
        if (existingImageInput) {
          formData.append('existing_image', existingImageInput.value || '');
        }
      }

      if (submitButton) {
        submitButton.disabled = true;
      }
      if (cancelEditButton && isEditing) {
        cancelEditButton.disabled = true;
      }

      fetch(ajaxUrl, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Network error');
          }
          return response.json();
        })
        .then(function (json) {
          if (!json || !json.success) {
            throw new Error((json && json.data && json.data.message) || 'Erreur');
          }
          form.reset();
          exitEditMode();
          resetPreview();
          var successMessage = isEditing ? (i18n.toastEditSuccess || 'Produit mis à jour.') : (i18n.toastAddSuccess || 'Produit ajouté avec succès.');
          showToast(successMessage, 'success');
          return fetchProducts();
        })
        .catch(function (error) {
          var failureMessage = isEditing ? (i18n.toastEditError || 'Erreur lors de la mise à jour du produit.') : (i18n.toastAddError || 'Erreur lors de l\'ajout du produit.');
          showToast(failureMessage + ' ' + (error && error.message ? error.message : ''), 'error');
        })
        .finally(function () {
          if (submitButton) {
            submitButton.disabled = false;
          }
          if (cancelEditButton) {
            cancelEditButton.disabled = false;
          }
        });
    }

    function resetPreview() {
      if (imagePreview) {
        imagePreview.src = '';
        imagePreview.classList.add('is-empty');
      }
      if (previewContainer) {
        previewContainer.classList.remove('has-image');
      }
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
        currentPreviewUrl = null;
      }
    }

    function exitEditMode() {
      formMode = 'create';
      currentEditId = null;
      if (productIdInput) {
        productIdInput.value = '';
      }
      if (existingImageInput) {
        existingImageInput.value = '';
      }
      setSubmitButtonLabel(false);
      if (cancelEditButton) {
        cancelEditButton.hidden = true;
        cancelEditButton.disabled = false;
      }
    }

    function startEditing(product) {
      if (!product || !form) {
        return;
      }
      formMode = 'edit';
      currentEditId = product.id;
      if (cancelEditButton) {
        cancelEditButton.hidden = false;
        cancelEditButton.disabled = false;
      }
      form.reset();
      resetPreview();
      if (productIdInput) {
        productIdInput.value = product.id ? String(product.id) : '';
      }
      if (nameInput) {
        nameInput.value = product.nom || '';
      }
      if (referenceInput) {
        referenceInput.value = product.reference || '';
      }
      if (locationInput) {
        locationInput.value = product.emplacement || '';
      }
      if (stockInput) {
        stockInput.value = product.stock !== null && product.stock !== undefined ? String(product.stock) : '';
      }
      if (purchaseInput) {
        purchaseInput.value = product.prix_achat !== null && product.prix_achat !== undefined ? String(product.prix_achat) : '';
      }
      if (saleEbayInput) {
        saleEbayInput.value = product.prix_vente_ebay !== null && product.prix_vente_ebay !== undefined ? String(product.prix_vente_ebay) : '';
      }
      if (saleLbcInput) {
        saleLbcInput.value = product.prix_vente_lbc !== null && product.prix_vente_lbc !== undefined ? String(product.prix_vente_lbc) : '';
      }
      if (saleVintedInput) {
        saleVintedInput.value = product.prix_vente_vinted !== null && product.prix_vente_vinted !== undefined ? String(product.prix_vente_vinted) : '';
      }
      if (saleAutreInput) {
        saleAutreInput.value = product.prix_vente_autre !== null && product.prix_vente_autre !== undefined ? String(product.prix_vente_autre) : '';
      }
      if (dateInput) {
        dateInput.value = product.date_achat || '';
      }
      if (notesInput) {
        notesInput.value = product.notes || '';
      }
      if (descriptionInput) {
        descriptionInput.value = product.description || '';
      }
      if (incompleteInput) {
        incompleteInput.checked = Number(product.a_completer) === 1;
      }
      if (existingImageInput) {
        existingImageInput.value = product.image ? normalizeImage(product.image) : '';
      }
      if (product.image && imagePreview) {
        imagePreview.src = normalizeImage(product.image);
        imagePreview.classList.remove('is-empty');
        if (previewContainer) {
          previewContainer.classList.add('has-image');
        }
      }
      setSubmitButtonLabel(true);
      scrollToElement(form);
      if (nameInput) {
        window.setTimeout(function () {
          nameInput.focus();
          nameInput.select();
        }, 50);
      }
    }

    function handlePhotoChange(event) {
      if (!imagePreview) {
        return;
      }
      if (existingImageInput) {
        existingImageInput.value = '';
      }
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
        currentPreviewUrl = null;
      }
      var files = event.target.files;
      if (files && files[0]) {
        currentPreviewUrl = URL.createObjectURL(files[0]);
        imagePreview.src = currentPreviewUrl;
        imagePreview.classList.remove('is-empty');
        if (previewContainer) {
          previewContainer.classList.add('has-image');
        }
      } else {
        resetPreview();
      }
    }

    function requestUpdate(id, field, value, successMessage, errorMessage) {
      var updateData = new FormData();
      updateData.append('action', 'update_product');
      updateData.append('id', id);
      updateData.append('field', field);
      updateData.append('value', value);

      return fetch(ajaxUrl, {
        method: 'POST',
        body: updateData,
        credentials: 'same-origin'
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Network error');
          }
          return response.json();
        })
        .then(function (json) {
          if (!json || !json.success) {
            throw new Error((json && json.data && json.data.message) || 'Erreur');
          }
          showToast(successMessage, 'success');
          return fetchProducts();
        })
        .catch(function (error) {
          showToast(errorMessage + ' ' + (error && error.message ? error.message : ''), 'error');
        });
    }

    function handleTableClick(event) {
      var target = event.target;
      if (!target || !target.dataset) {
        return;
      }
      var action = target.dataset.action;
      var id = target.dataset.id;
      if (!action || !id) {
        return;
      }

      if (action === 'edit') {
        var editable = allProducts.find(function (item) {
          return String(item.id) === String(id);
        });
        if (editable) {
          startEditing(editable);
        }
        return;
      }

      if (action === 'delete') {
        var confirmMessage = i18n.deleteConfirm || 'Supprimer cet article ?';
        if (window.confirm(confirmMessage)) {
          var deleteData = new FormData();
          deleteData.append('action', 'delete_product');
          deleteData.append('id', id);

          fetch(ajaxUrl, {
            method: 'POST',
            body: deleteData,
            credentials: 'same-origin'
          })
            .then(function (response) {
              if (!response.ok) {
                throw new Error('Network error');
              }
              return response.json();
            })
            .then(function (json) {
              if (!json || !json.success) {
                throw new Error((json && json.data && json.data.message) || 'Erreur');
              }
              showToast(i18n.toastDeleteSuccess || 'Produit supprimé.', 'success');
              if (currentEditId && String(currentEditId) === String(id)) {
                if (form) {
                  form.reset();
                }
                resetPreview();
                exitEditMode();
              }
              fetchProducts();
            })
            .catch(function (error) {
              showToast((i18n.toastDeleteError || 'Suppression impossible.') + ' ' + (error && error.message ? error.message : ''), 'error');
            });
        }
      }

      if (action === 'toggle-incomplete') {
        var product = allProducts.find(function (item) {
          return String(item.id) === String(id);
        });
        if (!product) {
          return;
        }
        var nextValue = Number(product.a_completer) === 1 ? 0 : 1;
        if (currentEditId && String(currentEditId) === String(id) && incompleteInput) {
          incompleteInput.checked = nextValue === 1;
        }
        requestUpdate(
          id,
          'a_completer',
          String(nextValue),
          nextValue === 1 ? (i18n.markedIncomplete || 'Objet marqué à compléter.') : (i18n.markedComplete || 'Objet marqué complet.'),
          i18n.toastUpdateError || 'Mise à jour impossible.'
        );
      }
    }

    function handleSearch(event) {
      filterState.search = (event.target.value || '').trim();
      applyFilters();
    }

    function handleQuickFilterClick(event) {
      var button = event.currentTarget;
      var value = button.getAttribute('data-status-filter');
      filterState.quickStatus = value;
      quickFilterButtons.forEach(function (btn) {
        btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
      });
      applyFilters();
    }

    function handleCasierChange(event) {
      filterState.casier = event.target.value;
      applyFilters();
    }

    function handleStatusChange(event) {
      filterState.status = event.target.value;
      applyFilters();
    }

    function scrollToElement(element) {
      if (!element) {
        return;
      }
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function exportCsv() {
      var rows = filteredProducts.length ? filteredProducts : allProducts;
      if (!rows.length) {
        showToast('Aucune donnée à exporter.', 'error');
        return;
      }
      var header = ['ID', 'Nom', 'Référence', 'Casier', 'Prix achat', 'Prix vente eBay', 'Prix vente LBC', 'Prix vente Vinted', 'Prix vente Autre', 'Stock', 'À compléter', 'Notes', 'Description', 'Date achat', 'Image'];
      var body = rows.map(function (product) {
        return [
          product.id,
          product.nom,
          product.reference,
          product.emplacement,
          product.prix_achat,
          product.prix_vente_ebay,
          product.prix_vente_lbc,
          product.prix_vente_vinted,
          product.prix_vente_autre,
          product.stock,
          product.a_completer,
          product.notes,
          product.description,
          product.date_achat,
          product.image
        ].map(function (value) {
          var stringValue = value === null || value === undefined ? '' : String(value);
          if (stringValue.indexOf('"') !== -1 || stringValue.indexOf(';') !== -1) {
            stringValue = '"' + stringValue.replace(/"/g, '""') + '"';
          }
          return stringValue;
        }).join(';');
      });
      var csvContent = header.join(';') + '\n' + body.join('\n');
      var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'inventaire.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    if (form) {
      form.addEventListener('submit', submitForm);
    }

    if (photoInput) {
      photoInput.addEventListener('change', handlePhotoChange);
    }

    if (cancelEditButton) {
      cancelEditButton.addEventListener('click', function () {
        if (form) {
          form.reset();
        }
        resetPreview();
        exitEditMode();
      });
    }

    if (tableBody) {
      tableBody.addEventListener('click', handleTableClick);
    }

    if (searchInput) {
      searchInput.addEventListener('input', handleSearch);
    }

    quickFilterButtons.forEach(function (button) {
      button.addEventListener('click', handleQuickFilterClick);
    });

    if (filterCasier) {
      filterCasier.addEventListener('change', handleCasierChange);
    }

    if (filterStatus) {
      filterStatus.addEventListener('change', handleStatusChange);
    }

    if (exportButton) {
      exportButton.addEventListener('click', exportCsv);
    }

    if (mobileAddItem) {
      mobileAddItem.addEventListener('click', function () {
        scrollToElement(form);
      });
    }

    if (mobileScrollInventory) {
      mobileScrollInventory.addEventListener('click', function () {
        scrollToElement(inventoryCard);
      });
    }

    if (mobileScrollStats) {
      mobileScrollStats.addEventListener('click', function () {
        scrollToElement(statsCard);
      });
    }

    // Exposer les fonctions nécessaires globalement pour le module de ventes
    window.showToast = showToast;
    window.fetchProducts = fetchProducts;

    // ========================================
    // Gestion du menu de navigation latéral
    // ========================================
    var sidebar = document.getElementById('sidebarNav');
    var sidebarToggle = document.getElementById('sidebarToggle');
    var sidebarLinks = document.querySelectorAll('.sidebar-link');
    var inventoryPage = document.querySelector('.inventory-page');

    // Toggle sidebar
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', function () {
        if (sidebar) {
          sidebar.classList.toggle('collapsed');
        }
        if (inventoryPage) {
          inventoryPage.classList.toggle('sidebar-collapsed');
        }
        // Sauvegarder l'état via AJAX
        var data = new FormData();
        data.append('action', 'save_sidebar_state');
        data.append('collapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
        fetch(ajaxUrl, {
          method: 'POST',
          body: data,
          credentials: 'same-origin'
        }).catch(function () {
          // Ignorer les erreurs
        });
      });
    }

    // Restaurer l'état du sidebar via AJAX
    var sidebarUrl = ajaxUrl;
    if (sidebarUrl.indexOf('?') === -1) {
      sidebarUrl += '?action=get_sidebar_state';
    } else {
      sidebarUrl += '&action=get_sidebar_state';
    }

    fetch(sidebarUrl, {
      credentials: 'same-origin'
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (json) {
        if (json && json.success && json.data && json.data.collapsed === '1') {
          if (sidebar) {
            sidebar.classList.add('collapsed');
          }
          if (inventoryPage) {
            inventoryPage.classList.add('sidebar-collapsed');
          }
        }
      })
      .catch(function () {
        // Ignorer les erreurs
      });

    // Gestion des liens de navigation
    sidebarLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();

        // Sauvegarder les données du formulaire avant la navigation
        saveFormData();

        // Mettre à jour les liens actifs
        sidebarLinks.forEach(function (l) {
          l.classList.remove('active');
        });
        link.classList.add('active');

        // Naviguer vers la section
        var sectionId = link.getAttribute('data-section');
        var targetSection = document.getElementById(sectionId);
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Fermer le menu en mode mobile
        if (window.innerWidth <= 992 && sidebar) {
          sidebar.classList.remove('mobile-open');
        }
      });
    });

    // ========================================
    // Sauvegarde automatique du formulaire
    // ========================================
    var formFieldsToSave = [
      'product-name',
      'product-reference',
      'product-location',
      'product-stock',
      'product-prix-achat',
      'product-prix-vente-ebay',
      'product-prix-vente-lbc',
      'product-prix-vente-vinted',
      'product-prix-vente-autre',
      'product-date',
      'product-notes',
      'product-description',
      'product-incomplete'
    ];

    function saveFormData() {
      if (!form || formMode === 'edit') {
        return; // Ne pas sauvegarder en mode édition
      }

      var formData = {};
      formFieldsToSave.forEach(function (fieldId) {
        var field = document.getElementById(fieldId);
        if (field) {
          if (field.type === 'checkbox') {
            formData[fieldId] = field.checked;
          } else {
            formData[fieldId] = field.value;
          }
        }
      });

      var data = new FormData();
      data.append('action', 'save_draft');
      data.append('form_data', JSON.stringify(formData));

      fetch(ajaxUrl, {
        method: 'POST',
        body: data,
        credentials: 'same-origin'
      }).catch(function (error) {
        // Ignorer les erreurs silencieusement
        if (window.console && console.error) {
          console.error('Erreur sauvegarde brouillon:', error);
        }
      });
    }

    function loadFormData() {
      if (!form || formMode === 'edit') {
        return; // Ne pas charger en mode édition
      }

      var url = ajaxUrl;
      if (url.indexOf('?') === -1) {
        url += '?action=get_draft';
      } else {
        url += '&action=get_draft';
      }

      fetch(url, {
        credentials: 'same-origin'
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Network error');
          }
          return response.json();
        })
        .then(function (json) {
          if (json && json.success && json.data && json.data.data) {
            var formData = JSON.parse(json.data.data);
            formFieldsToSave.forEach(function (fieldId) {
              var field = document.getElementById(fieldId);
              if (field && formData[fieldId] !== undefined) {
                if (field.type === 'checkbox') {
                  field.checked = formData[fieldId];
                } else if (formData[fieldId]) {
                  field.value = formData[fieldId];
                }
              }
            });
          }
        })
        .catch(function (error) {
          // Ignorer les erreurs silencieusement
          if (window.console && console.error) {
            console.error('Erreur chargement brouillon:', error);
          }
        });
    }

    function clearFormData() {
      var data = new FormData();
      data.append('action', 'delete_draft');

      fetch(ajaxUrl, {
        method: 'POST',
        body: data,
        credentials: 'same-origin'
      }).catch(function (error) {
        // Ignorer les erreurs silencieusement
        if (window.console && console.error) {
          console.error('Erreur suppression brouillon:', error);
        }
      });
    }

    // Charger les données sauvegardées au démarrage
    loadFormData();

    // Sauvegarder automatiquement lors de la saisie
    if (form) {
      formFieldsToSave.forEach(function (fieldId) {
        var field = document.getElementById(fieldId);
        if (field) {
          field.addEventListener('input', function () {
            if (formMode !== 'edit') {
              saveFormData();
            }
          });
          if (field.type === 'checkbox') {
            field.addEventListener('change', function () {
              if (formMode !== 'edit') {
                saveFormData();
              }
            });
          }
        }
      });
    }

    // Effacer les données sauvegardées après soumission réussie
    var originalSubmitForm = submitForm;
    submitForm = function(event) {
      originalSubmitForm(event);
      // Ajouter un délai pour s'assurer que la soumission est réussie
      window.setTimeout(function() {
        if (formMode === 'create') {
          clearFormData();
        }
      }, 1000);
    };

    // Remplacer la fonction submitForm dans le formulaire
    if (form) {
      form.removeEventListener('submit', originalSubmitForm);
      form.addEventListener('submit', submitForm);
    }

    // En mode mobile, ajouter un bouton burger
    if (window.innerWidth <= 992) {
      var mobileBurger = document.createElement('button');
      mobileBurger.className = 'mobile-menu-toggle';
      mobileBurger.setAttribute('aria-label', 'Menu');
      mobileBurger.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>';

      mobileBurger.addEventListener('click', function () {
        if (sidebar) {
          sidebar.classList.toggle('mobile-open');
        }
      });

      document.body.appendChild(mobileBurger);
    }

    fetchProducts();
  });
})();

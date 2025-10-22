document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector("#table-inventaire tbody");
  const form = document.querySelector("#form-ajout");

  function refresh() {
    fetch(ajaxUrl + "?action=get_products")
      .then(r => r.json())
      .then(res => {
        if (!res.success) return;
        table.innerHTML = "";
        res.data.forEach(p => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${p.image ? `<img src="${p.image}" class="thumb">` : "—"}</td>
            <td contenteditable data-id="${p.id}" data-field="nom">${p.nom}</td>
            <td contenteditable data-id="${p.id}" data-field="reference">${p.reference || ""}</td>
            <td contenteditable data-id="${p.id}" data-field="stock">${p.stock}</td>
            <td contenteditable data-id="${p.id}" data-field="prix_achat">${p.prix_achat}</td>
            <td contenteditable data-id="${p.id}" data-field="prix_vente">${p.prix_vente}</td>
            <td><button class="btn btn-sm btn-outline-danger del" data-id="${p.id}">✖</button></td>
          `;
          table.appendChild(tr);
        });
      });
  }

  refresh();

  form.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(form);
    fd.append("action","add_product");
    fetch(ajaxUrl,{method:"POST",body:fd})
      .then(r=>r.json())
      .then(res=>{
        if(res.success){form.reset();refresh();}
        else alert(res.data.message);
      });
  });

  table.addEventListener("blur", e => {
    if (e.target.matches("[contenteditable]")) {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const value = e.target.textContent.trim();
      const fd = new FormData();
      fd.append("action","update_product");
      fd.append("id",id); fd.append("field",field); fd.append("value",value);
      fetch(ajaxUrl,{method:"POST",body:fd});
    }
  }, true);

  table.addEventListener("click", e => {
    if (e.target.classList.contains("del")) {
      if (!confirm("Supprimer ?")) return;
      const fd=new FormData();
      fd.append("action","delete_product");
      fd.append("id",e.target.dataset.id);
      fetch(ajaxUrl,{method:"POST",body:fd}).then(()=>refresh());
    }
  });
});

(function () {
  var Cart = window.AmaCart;
  var money = Cart.money;
  var K = Cart.keys;

  var itemsEl = document.getElementById('cart-items');
  var emptyEl = document.getElementById('cart-empty');
  var detailsEl = document.getElementById('cart-details');
  var summaryEl = document.getElementById('cart-summary');
  var totalEl = document.getElementById('cart-total');
  var titleEl = document.getElementById('cart-title');

  var couriers = window.__COURIERS__ || [];
  var modal = document.getElementById('courier-modal');

  // Por las dudas de que el navegador restaure una versión vieja de esta página
  // (por ejemplo al volver con el botón "atrás", que en varios navegadores
  // restaura la página tal cual había quedado, incluso con este modal abierto),
  // lo forzamos cerrado apenas se ejecuta el script.
  if (modal) modal.hidden = true;

  function render() {
    var cart = Cart.getCart();
    var ids = Object.keys(cart);

    Cart.loadProducts().then(function (products) {
      var byId = {};
      products.forEach(function (p) {
        byId[p.id] = p;
      });

      var validIds = ids.filter(function (id) {
        return byId[Cart.parseKey(id).productId];
      });

      if (!validIds.length) {
        emptyEl.hidden = false;
        itemsEl.hidden = true;
        detailsEl.hidden = true;
        summaryEl.hidden = true;
        titleEl.textContent = 'Carrito';
        // Si el carrito está vacío no tiene sentido elegir transportadora:
        // nos aseguramos de que el modal esté cerrado siempre en este caso.
        if (modal) modal.hidden = true;
        return;
      }

      emptyEl.hidden = true;
      itemsEl.hidden = false;
      detailsEl.hidden = false;
      summaryEl.hidden = false;
      titleEl.textContent = 'Carrito (' + validIds.reduce(function (s, id) { return s + cart[id]; }, 0) + ')';

      itemsEl.innerHTML = '';
      var total = 0;
      validIds.forEach(function (id) {
        var parsed = Cart.parseKey(id);
        var p = byId[parsed.productId];
        var qty = cart[id];
        var price = Cart.productPrice(p);
        total += price * qty;
        var img = (p.images && p.images[0]) || '/placeholder.svg?text=' + encodeURIComponent(p.name);

        var variantLabel = '';
        if (parsed.variantId && p.variants) {
          var v = p.variants.find(function (vv) {
            return String(vv.id) === String(parsed.variantId);
          });
          if (v) variantLabel = v.label;
        }

        var row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML =
          '<img src="' + img + '" alt="">' +
          '<div class="cart-item__info">' +
            '<p class="cart-item__name">' + escapeHtml(p.name) +
              (variantLabel ? ' <span class="cart-item__variant">(' + escapeHtml(variantLabel) + ')</span>' : '') +
            '</p>' +
            (p.track_stock ? '<p class="cart-item__stock">Disponible: ' + p.stock + '</p>' : '') +
            '<p class="price">' + money(price) + '</p>' +
          '</div>' +
          '<div class="qty-stepper">' +
            '<button type="button" class="qty-btn" data-action="dec">' + (qty === 1 ? '🗑' : '−') + '</button>' +
            '<span class="qty-value">' + qty + '</span>' +
            '<button type="button" class="qty-btn" data-action="inc">+</button>' +
          '</div>';

        row.querySelector('[data-action="inc"]').addEventListener('click', function () {
          Cart.addToCart(id, 1);
        });
        row.querySelector('[data-action="dec"]').addEventListener('click', function () {
          Cart.addToCart(id, -1);
        });

        itemsEl.appendChild(row);
      });

      totalEl.textContent = money(total);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  document.getElementById('btn-clear-cart').addEventListener('click', function () {
    Cart.clearCart();
  });

  // Observación
  var obsEl = document.getElementById('observation');
  var obsCount = document.getElementById('obs-count');
  obsEl.value = localStorage.getItem(K.OBS_KEY) || '';
  obsCount.textContent = obsEl.value.length;
  obsEl.addEventListener('input', function () {
    localStorage.setItem(K.OBS_KEY, obsEl.value);
    obsCount.textContent = obsEl.value.length;
  });

  // Forma de entrega
  var radios = document.querySelectorAll('input[name="delivery"]');
  var savedDelivery = localStorage.getItem(K.DELIVERY_KEY);
  var courierChosenEl = document.getElementById('courier-chosen');

  function updateCourierChosenDisplay() {
    var courier = JSON.parse(localStorage.getItem(K.COURIER_KEY) || 'null');
    if (courier) {
      courierChosenEl.hidden = false;
      courierChosenEl.innerHTML =
        '<strong>' + escapeHtml(courier.name) + '</strong> — ' + escapeHtml(courier.note || '') +
        '<span class="courier-chosen__change">Cambiar ›</span>';
    } else {
      courierChosenEl.hidden = true;
    }
  }

  radios.forEach(function (r) {
    if (r.value === savedDelivery) r.checked = true;
    r.addEventListener('change', function () {
      localStorage.setItem(K.DELIVERY_KEY, r.value);
    });
  });
  updateCourierChosenDisplay();

  // Un radio que ya está marcado no dispara el evento "change" al tocarlo de
  // nuevo (solo dispara cuando cambia de estado) — por eso antes, una vez
  // elegida "Entrega" y una transportadora, no había forma de volver a tocar
  // esa opción para cambiarla: el modal simplemente no se volvía a abrir.
  // Escuchando el "click" de toda la opción (que sí ocurre siempre) y
  // revisando si el radio quedó marcado, el selector se puede reabrir tanto
  // la primera vez como cualquier otra vez después para cambiar de opción.
  var entregaOption = document.getElementById('delivery-entrega').closest('.delivery-option');
  if (entregaOption) {
    entregaOption.addEventListener('click', function () {
      if (document.getElementById('delivery-entrega').checked && couriers.length) {
        openCourierModal();
      }
    });
  }

  // Modal de transportadora
  var courierList = document.getElementById('courier-list');
  var selectBtn = document.getElementById('courier-select-btn');
  var selectedCourierId = null;

  function openCourierModal() {
    courierList.innerHTML = '';
    var current = JSON.parse(localStorage.getItem(K.COURIER_KEY) || 'null');
    selectedCourierId = current ? current.id : (couriers[0] && couriers[0].id);

    couriers.forEach(function (c) {
      var opt = document.createElement('label');
      opt.className = 'courier-option';
      opt.innerHTML =
        '<input type="radio" name="courier" value="' + c.id + '" ' + (c.id === selectedCourierId ? 'checked' : '') + '>' +
        '<span><strong>' + escapeHtml(c.name) + (c.cost ? ' - ' + money(c.cost) : ' - $ a cargo del comprador') + '</strong>' +
        '<p>' + escapeHtml(c.note || 'A cargo del comprador') + '</p></span>';
      opt.querySelector('input').addEventListener('change', function () {
        selectedCourierId = c.id;
      });
      courierList.appendChild(opt);
    });

    modal.hidden = false;
  }

  function closeCourierModal() {
    modal.hidden = true;
    if (!localStorage.getItem(K.COURIER_KEY)) {
      // no eligió transportadora todavía: revertir a "sin selección"
      document.getElementById('delivery-entrega').checked = false;
    }
  }

  document.getElementById('courier-modal-close').addEventListener('click', closeCourierModal);

  // Tocar el fondo oscuro (fuera del panel) también cierra el modal, y lo
  // mismo con la tecla Escape — así nunca queda "trabado" en pantalla sin
  // forma de salir.
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeCourierModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeCourierModal();
  });

  selectBtn.addEventListener('click', function () {
    var courier = couriers.find(function (c) {
      return c.id === selectedCourierId;
    });
    if (courier) {
      localStorage.setItem(K.COURIER_KEY, JSON.stringify(courier));
      updateCourierChosenDisplay();
    }
    modal.hidden = true;
  });

  document.getElementById('btn-continue').addEventListener('click', function () {
    var delivery = localStorage.getItem(K.DELIVERY_KEY);
    if (!delivery) {
      alert('Elegí una forma de entrega para continuar.');
      return;
    }
    if (delivery === 'entrega' && couriers.length && !localStorage.getItem(K.COURIER_KEY)) {
      openCourierModal();
      return;
    }
    window.location.href = '/finalizar';
  });

  document.addEventListener('cart:changed', render);
  render();

  // Si el navegador restaura esta página desde su caché (por ejemplo al volver
  // con el botón "atrás" del celular), "pageshow" avisa con persisted=true.
  // En ese caso volvemos a calcular todo desde cero: cerramos el modal (por si
  // había quedado abierto en la versión cacheada) y re-renderizamos el carrito
  // con los datos actuales, en vez de mostrar la foto vieja de la página.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      if (modal) modal.hidden = true;
      render();
    }
  });
})();

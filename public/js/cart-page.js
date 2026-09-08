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

  function render() {
    var cart = Cart.getCart();
    var ids = Object.keys(cart);

    Cart.loadProducts().then(function (products) {
      var byId = {};
      products.forEach(function (p) {
        byId[p.id] = p;
      });

      var validIds = ids.filter(function (id) {
        return byId[id];
      });

      if (!validIds.length) {
        emptyEl.hidden = false;
        itemsEl.hidden = true;
        detailsEl.hidden = true;
        summaryEl.hidden = true;
        titleEl.textContent = 'Carrito';
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
        var p = byId[id];
        var qty = cart[id];
        var price = Cart.productPrice(p);
        total += price * qty;
        var img = (p.images && p.images[0]) || '/placeholder.svg?text=' + encodeURIComponent(p.name);

        var row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML =
          '<img src="' + img + '" alt="">' +
          '<div class="cart-item__info">' +
            '<p class="cart-item__name">' + escapeHtml(p.name) + '</p>' +
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
      courierChosenEl.innerHTML = '<strong>' + escapeHtml(courier.name) + '</strong> — ' + escapeHtml(courier.note || '');
    } else {
      courierChosenEl.hidden = true;
    }
  }

  radios.forEach(function (r) {
    if (r.value === savedDelivery) r.checked = true;
    r.addEventListener('change', function () {
      localStorage.setItem(K.DELIVERY_KEY, r.value);
      if (r.value === 'entrega' && couriers.length) {
        openCourierModal();
      }
    });
  });
  updateCourierChosenDisplay();

  // Modal de transportadora
  var modal = document.getElementById('courier-modal');
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

  document.getElementById('courier-modal-close').addEventListener('click', function () {
    modal.hidden = true;
    if (!localStorage.getItem(K.COURIER_KEY)) {
      // no eligió transportadora todavía: revertir a "sin selección"
      document.getElementById('delivery-entrega').checked = false;
    }
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
})();

(function () {
  var Cart = window.AmaCart;
  var money = Cart.money;
  var K = Cart.keys;
  var settings = window.__SETTINGS__ || {};

  var delivery = localStorage.getItem(K.DELIVERY_KEY);
  var courier = JSON.parse(localStorage.getItem(K.COURIER_KEY) || 'null');
  var observation = localStorage.getItem(K.OBS_KEY) || '';

  if (delivery === 'entrega') {
    document.getElementById('address-field').hidden = false;
    document.getElementById('address').required = true;
    document.getElementById('city').required = true;
    document.getElementById('department').required = true;
  }

  var cartItemsCache = [];
  var subtotal = 0;

  function renderSummary() {
    var cart = Cart.getCart();
    var ids = Object.keys(cart);
    if (!ids.length) {
      window.location.href = '/carrito';
      return;
    }
    Cart.loadProducts().then(function (products) {
      var byId = {};
      products.forEach(function (p) {
        byId[p.id] = p;
      });
      subtotal = 0;
      cartItemsCache = [];
      var count = 0;
      ids.forEach(function (id) {
        var parsed = Cart.parseKey(id);
        var p = byId[parsed.productId];
        if (!p) return;
        var price = Cart.productPrice(p);
        subtotal += price * cart[id];
        count += cart[id];
        var variantLabel = '';
        if (parsed.variantId && p.variants) {
          var v = p.variants.find(function (vv) {
            return String(vv.id) === String(parsed.variantId);
          });
          if (v) variantLabel = v.label;
        }
        cartItemsCache.push({ id: p.id, name: p.name, price: price, qty: cart[id], variant: variantLabel });
      });

      document.getElementById('summary-count').textContent =
        count + (count === 1 ? ' artículo' : ' artículos');
      document.getElementById('summary-subtotal').textContent = money(subtotal);

      document.getElementById('summary-delivery-label').textContent =
        delivery === 'entrega' ? 'Entrega' + (courier ? ' (' + courier.name + ')' : '') : 'Retirada';
      document.getElementById('summary-delivery-value').textContent =
        delivery === 'entrega' ? (courier && courier.cost ? money(courier.cost) : 'Gratis / a coordinar') : 'Sin costo';

      updateTotal();
    });
  }

  function currentPaymentMethod() {
    var checked = document.querySelector('input[name="payment"]:checked');
    return checked ? checked.value : null;
  }

  function updateTotal() {
    var total = subtotal;
    var method = currentPaymentMethod();
    var pct = Number(settings.mercadopago_surcharge_pct || 0);
    if (method === 'mercadopago' && pct > 0) {
      total = total * (1 + pct / 100);
    }
    document.getElementById('summary-total').textContent = money(total);

    if (method === 'efectivo') {
      var amount = Number(document.getElementById('cashAmount').value) || 0;
      document.getElementById('cashChange').textContent = money(Math.max(0, amount - total));
    }
    return total;
  }

  // Mostrar/ocultar detalles según método de pago elegido
  document.querySelectorAll('input[name="payment"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      var cashExtra = document.getElementById('cash-extra');
      var transferExtra = document.getElementById('transfer-extra');
      if (cashExtra) cashExtra.hidden = radio.value !== 'efectivo';
      if (transferExtra) transferExtra.hidden = radio.value !== 'transferencia';
      updateTotal();
    });
  });

  var cashAmountInput = document.getElementById('cashAmount');
  if (cashAmountInput) cashAmountInput.addEventListener('input', updateTotal);

  document.getElementById('checkout-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var errorEl = document.getElementById('form-error');
    errorEl.hidden = true;

    var method = currentPaymentMethod();
    if (!method) {
      errorEl.textContent = 'Elegí un método de pago.';
      errorEl.hidden = false;
      return;
    }

    var total = updateTotal();
    var payload = {
      items: cartItemsCache,
      deliveryMethod: delivery,
      courierName: courier ? courier.name : '',
      address: document.getElementById('address') ? document.getElementById('address').value : '',
      city: document.getElementById('city') ? document.getElementById('city').value : '',
      department: document.getElementById('department') ? document.getElementById('department').value : '',
      paymentMethod: method,
      cashAmount: method === 'efectivo' ? Number(cashAmountInput.value) || 0 : 0,
      customerName: document.getElementById('customerName').value,
      phone: settings.country_code + ' ' + document.getElementById('phone').value,
      observation: observation,
    };

    var btn = document.getElementById('btn-submit-order');
    btn.disabled = true;

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, data: data };
        });
      })
      .then(function (res) {
        if (!res.ok) {
          throw new Error(res.data.error || 'No se pudo enviar el pedido.');
        }
        Cart.clearCart();
        localStorage.removeItem(K.OBS_KEY);
        localStorage.removeItem(K.DELIVERY_KEY);
        localStorage.removeItem(K.COURIER_KEY);
        window.location.href = res.data.whatsappUrl;
      })
      .catch(function (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        btn.disabled = false;
      });
  });

  renderSummary();
})();

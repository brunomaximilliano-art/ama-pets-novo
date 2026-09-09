// Lógica de carrito compartida por todas las páginas de la tienda.
// El carrito se guarda en localStorage: { "<productId>": qty, ... }
(function () {
  var CART_KEY = 'amapets_cart';
  var OBS_KEY = 'amapets_observation';
  var DELIVERY_KEY = 'amapets_delivery'; // 'entrega' | 'retirada'
  var COURIER_KEY = 'amapets_courier'; // { id, name }

  function money(n) {
    var num = Number(n) || 0;
    var parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return '$ ' + parts[0] + ',' + parts[1];
  }

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent('cart:changed'));
  }
  function setQty(id, qty) {
    var cart = getCart();
    if (qty <= 0) delete cart[id];
    else cart[id] = qty;
    saveCart(cart);
  }
  function addToCart(id, delta) {
    var cart = getCart();
    var current = cart[id] || 0;
    setQty(id, current + delta);
  }
  function clearCart() {
    localStorage.removeItem(CART_KEY);
    document.dispatchEvent(new CustomEvent('cart:changed'));
  }

  var productsPromise = null;
  function loadProducts() {
    if (!productsPromise) {
      productsPromise = fetch('/api/products').then(function (r) {
        return r.json();
      });
    }
    return productsPromise;
  }

  function productPrice(p) {
    return p.promo_price != null && Number(p.promo_price) < Number(p.price)
      ? Number(p.promo_price)
      : Number(p.price);
  }

  function renderCartBar() {
    var bar = document.getElementById('cart-bar');
    // En la propia página del carrito ya existe su propia barra de total +
    // "Continuar para finalizar" (#cart-summary). La barra "Ver carrito" es
    // la que se muestra en las demás páginas para llevarte al carrito —
    // mostrarla también acá arriba de la de verdad tapaba el botón de
    // continuar y daba la sensación de que la página se quedaba "trabada".
    var onCartPage = !!document.getElementById('cart-summary');
    if (bar && onCartPage) bar.hidden = true;

    var cart = getCart();
    var ids = Object.keys(cart);
    if (!ids.length) {
      if (bar && !onCartPage) bar.hidden = true;
      updateBadge(0);
      return;
    }
    loadProducts().then(function (products) {
      var byId = {};
      products.forEach(function (p) {
        byId[p.id] = p;
      });
      var total = 0;
      var count = 0;
      ids.forEach(function (id) {
        var p = byId[id];
        if (!p) return;
        total += productPrice(p) * cart[id];
        count += cart[id];
      });
      if (count === 0) {
        if (bar && !onCartPage) bar.hidden = true;
        updateBadge(0);
        return;
      }
      if (bar && !onCartPage) {
        bar.hidden = false;
        document.getElementById('cart-bar-total').textContent = money(total);
        document.getElementById('cart-bar-count').textContent =
          count + (count === 1 ? ' artículo' : ' artículos');
      }
      updateBadge(count);
    });
  }

  function updateBadge(count) {
    var badge = document.getElementById('cart-badge');
    if (!badge) return;
    if (count > 0) {
      badge.hidden = false;
      badge.textContent = count;
    } else {
      badge.hidden = true;
    }
  }

  // Widget "Añadir" / stepper en la página de producto
  function initProductWidget() {
    var widget = document.getElementById('add-to-cart-widget');
    if (!widget) return;
    var root = document.querySelector('.product-detail');
    var id = String(root.dataset.productId);
    var btnAdd = document.getElementById('btn-add');
    var stepper = document.getElementById('qty-stepper');
    var qtyValue = document.getElementById('qty-value');
    var btnPlus = document.getElementById('qty-plus');
    var btnRemove = document.getElementById('qty-remove');

    function refresh() {
      var cart = getCart();
      var qty = cart[id] || 0;
      if (qty > 0) {
        btnAdd.hidden = true;
        stepper.hidden = false;
        qtyValue.textContent = qty;
      } else {
        btnAdd.hidden = false;
        stepper.hidden = true;
      }
    }

    btnAdd.addEventListener('click', function () {
      addToCart(id, 1);
      refresh();
    });
    btnPlus.addEventListener('click', function () {
      addToCart(id, 1);
      refresh();
    });
    btnRemove.addEventListener('click', function () {
      var cart = getCart();
      var qty = (cart[id] || 0) - 1;
      setQty(id, qty);
      refresh();
    });

    refresh();
  }

  function initCookieBanner() {
    var banner = document.getElementById('cookie-banner');
    if (!banner) return;
    if (!localStorage.getItem('amapets_cookies_ok')) banner.hidden = false;
    var btn = document.getElementById('cookie-accept');
    if (btn) {
      btn.addEventListener('click', function () {
        localStorage.setItem('amapets_cookies_ok', '1');
        banner.hidden = true;
      });
    }
  }

  document.addEventListener('cart:changed', renderCartBar);
  document.addEventListener('DOMContentLoaded', function () {
    renderCartBar();
    initProductWidget();
    initCookieBanner();
  });

  window.AmaCart = {
    money: money,
    getCart: getCart,
    saveCart: saveCart,
    setQty: setQty,
    addToCart: addToCart,
    clearCart: clearCart,
    loadProducts: loadProducts,
    productPrice: productPrice,
    keys: { OBS_KEY: OBS_KEY, DELIVERY_KEY: DELIVERY_KEY, COURIER_KEY: COURIER_KEY },
  };
})();

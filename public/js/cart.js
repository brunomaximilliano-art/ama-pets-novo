// Lógica de carrito compartida por todas las páginas de la tienda.
// El carrito se guarda en localStorage: { "<clave>": qty, ... }
// La clave es el id del producto solo ("5"), o el id del producto más el id
// de la opción elegida ("5__v12") cuando el producto tiene talles/colores.
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

  function keyFor(productId, variantId) {
    return variantId ? String(productId) + '__v' + variantId : String(productId);
  }
  function parseKey(key) {
    var s = String(key);
    var idx = s.indexOf('__v');
    if (idx === -1) return { productId: s, variantId: null };
    return { productId: s.slice(0, idx), variantId: s.slice(idx + 3) };
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
        var p = byId[parseKey(id).productId];
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

  // Widget de cantidad + "Añadir" en la página de producto.
  // Ahora el flujo es: primero la persona elige cuántas unidades quiere con
  // el selector (sin tocar el carrito todavía), y recién al tocar "Añadir"
  // se agregan esas unidades de una sola vez.
  function initProductWidget() {
    var widget = document.getElementById('add-to-cart-widget');
    if (!widget) return;
    var root = document.querySelector('.product-detail');
    var id = String(root.dataset.productId);
    var variantsEnabled = root.dataset.variantsEnabled === '1';
    var btnAdd = document.getElementById('btn-add');
    var qtyValue = document.getElementById('qty-value');
    var btnPlus = document.getElementById('qty-plus');
    var btnMinus = document.getElementById('qty-minus');
    var inCartNote = document.getElementById('in-cart-note');
    var variantPicker = document.getElementById('variant-picker');
    var variantOptions = variantPicker ? Array.prototype.slice.call(variantPicker.querySelectorAll('.variant-option')) : [];

    var selectedQty = 1;
    var selectedVariantId = null;
    var selectedVariantLabel = null;

    function cartKey() {
      return keyFor(id, selectedVariantId);
    }

    function updateAddAvailability() {
      if (!variantsEnabled) return;
      // Sin opciones en stock, o con opciones pero ninguna elegida todavía:
      // no se puede añadir al carrito.
      btnAdd.disabled = !variantOptions.length || !selectedVariantId;
    }

    variantOptions.forEach(function (opt) {
      opt.addEventListener('click', function () {
        variantOptions.forEach(function (o) {
          o.classList.remove('is-selected');
        });
        opt.classList.add('is-selected');
        selectedVariantId = opt.dataset.variantId;
        selectedVariantLabel = opt.dataset.variantLabel;
        updateAddAvailability();
        renderInCart();
      });
    });

    function renderQty() {
      qtyValue.textContent = selectedQty;
      btnMinus.disabled = selectedQty <= 1;
    }

    function renderInCart() {
      if (!inCartNote) return;
      if (variantsEnabled && !selectedVariantId) {
        inCartNote.hidden = true;
        return;
      }
      var cart = getCart();
      var qty = cart[cartKey()] || 0;
      if (qty > 0) {
        inCartNote.hidden = false;
        inCartNote.textContent =
          'Ya tienes ' + qty + (qty === 1 ? ' unidad' : ' unidades') +
          (selectedVariantLabel ? ' (' + selectedVariantLabel + ')' : '') +
          ' de este producto en el carrito.';
      } else {
        inCartNote.hidden = true;
      }
    }

    btnPlus.addEventListener('click', function () {
      selectedQty += 1;
      renderQty();
    });
    btnMinus.addEventListener('click', function () {
      if (selectedQty > 1) selectedQty -= 1;
      renderQty();
    });
    btnAdd.addEventListener('click', function () {
      if (variantsEnabled && !selectedVariantId) return;
      addToCart(cartKey(), selectedQty);
      renderInCart();
      selectedQty = 1;
      renderQty();

      var originalText = btnAdd.textContent;
      btnAdd.textContent = '¡Añadido! ✓';
      btnAdd.disabled = true;
      setTimeout(function () {
        btnAdd.textContent = originalText;
        updateAddAvailability();
      }, 1000);
    });

    document.addEventListener('cart:changed', renderInCart);

    updateAddAvailability();
    renderQty();
    renderInCart();
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

    // El carrito tiene su propia barra fija abajo de todo (el resumen con el
    // botón "Continuar para finalizar", o la barra "Ver carrito"), que ocupa
    // el mismo lugar que este aviso de cookies y le tapaba el botón por
    // completo. Lo mantenemos siempre arriba de esa barra, recalculando cada
    // vez que cambia de tamaño o de visibilidad.
    function reposition() {
      if (banner.hidden) return;
      var summary = document.getElementById('cart-summary');
      var bar = document.getElementById('cart-bar');
      var offset = 0;
      if (summary && !summary.hidden) offset = summary.offsetHeight;
      else if (bar && !bar.hidden) offset = bar.offsetHeight;
      banner.style.bottom = offset + 'px';
    }
    var watchTargets = [document.getElementById('cart-summary'), document.getElementById('cart-bar')].filter(Boolean);
    if (watchTargets.length && window.MutationObserver) {
      var obs = new MutationObserver(reposition);
      watchTargets.forEach(function (el) {
        obs.observe(el, { attributes: true, attributeFilter: ['hidden'] });
      });
    }
    reposition();
    window.addEventListener('resize', reposition);
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
    keyFor: keyFor,
    parseKey: parseKey,
    keys: { OBS_KEY: OBS_KEY, DELIVERY_KEY: DELIVERY_KEY, COURIER_KEY: COURIER_KEY },
  };
})();

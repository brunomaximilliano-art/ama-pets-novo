// Interacciones de la interfaz que no tienen que ver con el carrito: el menú
// lateral (hambúrguer), el buscador y el alternador de vista grilla/lista.
// Todo acá revisa que el elemento exista antes de usarlo, porque este script
// se carga en todas las páginas del sitio, y no todas tienen estos elementos.
(function () {
  // ---- Menú lateral con las categorías en vertical ----
  var menuToggle = document.getElementById('menu-toggle');
  var drawer = document.getElementById('nav-drawer');
  var drawerBackdrop = document.getElementById('nav-drawer-backdrop');
  var drawerClose = document.getElementById('nav-drawer-close');

  function openDrawer() {
    if (!drawer) return;
    drawer.hidden = false;
    if (drawerBackdrop) drawerBackdrop.hidden = false;
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.hidden = true;
    if (drawerBackdrop) drawerBackdrop.hidden = true;
  }
  if (menuToggle) menuToggle.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && !drawer.hidden) closeDrawer();
  });

  // ---- Buscador: el ícono de lupa muestra/oculta la barra de búsqueda ----
  var searchToggle = document.getElementById('search-toggle');
  var searchForm = document.getElementById('site-search');
  var searchInput = document.getElementById('site-search-input');
  if (searchToggle && searchForm) {
    searchToggle.addEventListener('click', function () {
      searchForm.hidden = !searchForm.hidden;
      if (!searchForm.hidden && searchInput) searchInput.focus();
    });
  }
  // Si venimos de /buscar con una palabra ya escrita, dejamos la barra abierta.
  if (searchInput && searchInput.value && searchForm) searchForm.hidden = false;

  // ---- Alternar vista en grilla / lista de los listados de productos ----
  var VIEW_KEY = 'amapets_view';
  var viewButtons = document.querySelectorAll('[data-view]');
  var grids = document.querySelectorAll('.product-grid');

  function applyView(view) {
    grids.forEach(function (g) {
      g.classList.toggle('product-grid--list', view === 'list');
    });
    viewButtons.forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-view') === view);
    });
  }

  if (viewButtons.length && grids.length) {
    var saved = 'grid';
    try {
      saved = localStorage.getItem(VIEW_KEY) || 'grid';
    } catch (e) {
      /* ignorar: navegación privada u otro bloqueo de localStorage */
    }
    applyView(saved);
    viewButtons.forEach(function (b) {
      b.addEventListener('click', function () {
        var view = b.getAttribute('data-view');
        try {
          localStorage.setItem(VIEW_KEY, view);
        } catch (e) {
          /* ignorar */
        }
        applyView(view);
      });
    });
  }
})();

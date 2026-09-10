// Las fotos que salen directo del celular suelen pesar varios MB, y el
// servidor solo acepta imágenes de hasta 4MB (límite necesario para que
// Vercel no corte la subida antes). Para que la persona no se encuentre con
// un error solo por elegir una foto "normal" del celular, achicamos la
// imagen en el propio navegador (ancho/alto máximo + calidad JPEG) justo
// antes de enviar el formulario. Si la imagen ya es chica, o algo falla al
// procesarla, se envía tal cual vino, sin bloquear nada.
(function () {
  var MAX_DIM = 1600;
  var QUALITY = 0.82;
  var SKIP_UNDER_BYTES = 900 * 1024; // no vale la pena tocar fotos que ya son livianas

  function supported() {
    return !!(window.HTMLCanvasElement && window.File && window.DataTransfer);
  }

  function compressFile(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type) || file.type === 'image/gif' || file.size <= SKIP_UNDER_BYTES) {
        resolve(file);
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(file);
          return;
        }
        if (w > MAX_DIM || h > MAX_DIM) {
          if (w >= h) {
            h = Math.round(h * (MAX_DIM / w));
            w = MAX_DIM;
          } else {
            w = Math.round(w * (MAX_DIM / h));
            h = MAX_DIM;
          }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          function (blob) {
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            var newName = file.name.replace(/\.\w+$/, '') + '.jpg';
            try {
              resolve(new File([blob], newName, { type: 'image/jpeg' }));
            } catch (e) {
              resolve(file);
            }
          },
          'image/jpeg',
          QUALITY
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
  }

  function setupForm(form) {
    var inputs = Array.prototype.slice.call(form.querySelectorAll('input[type=file][accept^="image/"]'));
    if (!inputs.length) return;
    var busy = false;

    form.addEventListener('submit', function (e) {
      if (busy) return; // segundo submit (ya comprimido): dejar pasar
      var hasFiles = inputs.some(function (inp) {
        return inp.files && inp.files.length;
      });
      if (!hasFiles) return;

      e.preventDefault();
      busy = true;
      var submitBtn = form.querySelector('button[type=submit]');
      var originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Optimizando fotos...';
      }

      Promise.all(
        inputs.map(function (inp) {
          if (!inp.files || !inp.files.length) return Promise.resolve();
          return Promise.all(Array.prototype.slice.call(inp.files).map(compressFile)).then(function (files) {
            var dt = new DataTransfer();
            files.forEach(function (f) {
              dt.items.add(f);
            });
            inp.files = dt.files;
          });
        })
      )
        .then(function () {
          form.submit();
        })
        .catch(function () {
          form.submit();
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
        });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!supported()) return;
    Array.prototype.slice.call(document.querySelectorAll('form[enctype="multipart/form-data"]')).forEach(setupForm);
  });
})();

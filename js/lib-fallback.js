      // CDN fallback loader: if local libs failed to load, fetch from CDN
      (function () {
        function loadScript(src) {
          var s = document.createElement('script');
          s.src = src;
          document.head.appendChild(s);
        }
        if (typeof htmlToImage === 'undefined') {
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js');
        }
        if (typeof JSZip === 'undefined') {
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }
      })();

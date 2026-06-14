      // CDN fallback loader: if local libs failed to load, fetch from CDN
      (function () {
        function loadScript(src, integrity) {
          var s = document.createElement('script');
          s.src = src;
          s.integrity = integrity;
          s.crossOrigin = 'anonymous';
          document.head.appendChild(s);
        }
        if (typeof htmlToImage === 'undefined') {
          loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js',
            'sha384-YAj4cGTKsNinHUzylwDJDDZEpC6gnqNubmrp9eerckq7+gwWjABe5s2plXl3uUKb'
          );
        }
        if (typeof JSZip === 'undefined') {
          loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
            'sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG'
          );
        }
        if (typeof XLSX === 'undefined') {
          loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
            'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw'
          );
        }
      })();

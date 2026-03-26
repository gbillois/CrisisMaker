STANDALONE DISTRIBUTION
=======================

To distribute CrisisMaker as a standalone ZIP that works offline,
place these two library files in this directory:

1. html-to-image.min.js
   Download from: https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js

2. jszip.min.js
   Download from: https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js

The index.html is configured to load from js/lib/ first and fall back
to the CDN if the local files are not found.

When distributing as a ZIP, include:
  - index.html
  - css/main.css
  - js/*.js
  - js/lib/html-to-image.min.js
  - js/lib/jszip.min.js

Note: Google Fonts are loaded from the internet for HD template quality.
If offline, templates will render with system font fallbacks (still functional).


      // Level 1: File System Access API (Chrome/Edge)
      let _fileHandle = null;

      const supportsFileSystemAccess = () => typeof window !== 'undefined' && 'showSaveFilePicker' in window;

      function buildProjectFileData({ forFile = false } = {}) {
        if (typeof captureVideoDebriefProjectState === 'function') captureVideoDebriefProjectState();
        appState.scenario.video_debrief = loadVideoDebriefDraft(appState.scenario.video_debrief);
        const exportData = JSON.parse(JSON.stringify(appState.scenario));
        // A file keeps the exercise clock paused where it is: reopened days later, it must not
        // resume from the old start time (the browser autosave keeps it running).
        if (forFile && exportData.play?.running && typeof playNow === 'function') {
          exportData.play = { ...exportData.play, offset_min: Math.round(playNow(appState.scenario) * 100) / 100, running: false, run_since: null };
        }
        exportData.debrief = normalizeDebrief(exportData.debrief, exportData);
        exportData.settings = { ...exportData.settings, ai_api_key: '', azure_api_key: '', azure_speech_key: '' };
        exportData.llm_prompts = extractLLMPrompts();
        delete exportData._llm_prompts;
        return exportData;
      }

      async function saveToFileFirstTime() {
        if (!supportsFileSystemAccess()) return false;
        try {
          _fileHandle = await window.showSaveFilePicker({
            suggestedName: `${slugify(appState.scenario.name || 'crisismaker')}.crisismaker.json`,
            types: [{ description: 'CrisisMaker Project', accept: { 'application/json': ['.json'] } }] // Chrome refuses an extension longer than 16 characters.
          });
          return await writeToFile();
        } catch (e) {
          if (e.name !== 'AbortError') CrisisError.log(e, { operation: 'Open save file picker' });
          return false;
        }
      }

      async function writeToFile() {
        if (!_fileHandle) return false;
        try {
          const exportData = buildProjectFileData({ forFile: true });
          const writable = await _fileHandle.createWritable();
          await writable.write(JSON.stringify(exportData, null, 2));
          await writable.close();
          return true;
        } catch (e) {
          CrisisError.log(e, { operation: 'Write project file' });
          _fileHandle = null; // handle invalidated
          return false;
        }
      }

      // Picker only: parsing is done by the caller so a bad file is reported, not retried.
      // Returns null on cancel; throws only when the picker itself fails.
      async function pickFileWithFileSystemAPI() {
        if (!supportsFileSystemAccess() || typeof window.showOpenFilePicker !== 'function') return null;
        try {
          const [handle] = await window.showOpenFilePicker({
            types: [{
              description: 'CrisisMaker Project',
              accept: {
                'application/json': ['.json'], // .crisismaker.json too: Chrome refuses a longer extension.
                'application/zip': ['.zip']
              }
            }]
          });
          return { handle, file: await handle.getFile() };
        } catch (e) {
          if (e.name === 'AbortError') return { cancelled: true }; // user cancelled
          throw e;
        }
      }

      // ── LLM prompts persistence ──────────────────────────────────────
      function extractLLMPrompts() {
        const state = appState.llmState;
        const prompts = {};
        for (const zone of ['scenario', 'actors', 'stimulus', 'stimuli_batch', 'debrief']) {
          if (state[zone] && state[zone].text) {
            prompts[zone] = state[zone].text;
          }
        }
        return prompts;
      }

      function restoreLLMPrompts(llmPrompts) {
        if (!llmPrompts || typeof llmPrompts !== 'object') return;
        for (const zone of ['scenario', 'actors', 'stimulus', 'stimuli_batch', 'debrief']) {
          if (llmPrompts[zone] && appState.llmState[zone]) {
            appState.llmState[zone].text = llmPrompts[zone];
          }
        }
      }

      /* A CSV cell for Excel: quoted, and neutralised when it would start a formula
         (a title or note beginning with = + - @ would otherwise be evaluated). */
      function csvCell(value) {
        const text = String(value ?? '');
        return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
      }

      /* Photos are stored in the project as data URLs: at most 1600 px, JPEG, so a few photos
         cannot fill the browser storage. Small images (and SVG) are kept as they are. */
      function downscaleImageFile(file, maxSide = 1600, quality = 0.85) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error || new Error('The image could not be read.'));
          reader.onload = () => {
            const original = String(reader.result || '');
            if (file.size < 250000 || /svg|gif/.test(file.type)) { resolve(original); return; }
            const img = new Image();
            img.onerror = () => resolve(original);
            img.onload = () => {
              const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
              canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
              canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
              const resized = canvas.toDataURL('image/jpeg', quality);
              resolve(resized.length < original.length ? resized : original);
            };
            img.src = original;
          };
          reader.readAsDataURL(file);
        });
      }

      // Level 2: localStorage (always active). Returns true when the project was saved.
      let _lastQuotaToast = 0;
      function saveLocal(showToast = true) {
        try {
          appState.scenario.updated_at = new Date().toISOString();
          const scenarioToSave = buildProjectFileData();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarioToSave));
          const settingsToSave = { ...appState.scenario.settings, ai_api_key: '', azure_api_key: '', azure_speech_key: '' };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
          persistProviderSettings(appState.scenario.settings);
          if (showToast) pushToast(tt('Scenario saved locally.', 'Scénario enregistré localement.', 'Szenario lokal gespeichert.'), 'success');
          return true;
        } catch (error) {
          if (error.name === 'QuotaExceededError') {
            // Once every 5 minutes, not at every autosave.
            if (showToast || Date.now() - _lastQuotaToast > 300000) {
              _lastQuotaToast = Date.now();
              pushToast(tt('Browser storage full: this project is NOT saved in the browser. Save it to a file (JSON) and remove large photos or videos.', 'Stockage navigateur plein : ce projet n\'est PAS enregistré dans le navigateur. Enregistrez-le dans un fichier (JSON) et retirez les grandes photos ou vidéos.', 'Browserspeicher voll: Dieses Projekt ist NICHT im Browser gespeichert. Als Datei (JSON) speichern und große Fotos oder Videos entfernen.'), 'error');
            }
          } else {
            pushToast(tt(`Local save failed: ${error.message}`, `Échec de la sauvegarde locale : ${error.message}`, `Lokales Speichern fehlgeschlagen: ${error.message}`), 'error');
          }
          return false;
        }
      }

      // Auto-save: calls both localStorage and File System API
      async function autoSave() {
        appState.scenario.updated_at = new Date().toISOString();
        const savedLocally = saveLocal(false);
        const savedFile = _fileHandle ? await writeToFile() : false;
        updateSaveIndicator(savedLocally || savedFile);
      }

      function updateSaveIndicator(saved = true) {
        const el = document.getElementById('save-indicator');
        if (!el) return;
        const now = new Date();
        el.classList.toggle('is-error', !saved);
        const msg = !saved
          ? tt('Not saved: storage full', 'Non enregistré : stockage plein', 'Nicht gespeichert: Speicher voll')
          : _fileHandle
          ? tt(`Saved (file + browser)`, `Sauvegardé (fichier + navigateur)`, `Gespeichert (Datei + Browser)`)
          : tt(`Saved (browser)`, `Sauvegardé (navigateur)`, `Gespeichert (Browser)`);
        el.textContent = msg;
        el.title = now.toLocaleTimeString();
      }

      function startAutoSave() {
        const interval = (appState.scenario?.settings?.auto_save_interval_seconds || 30) * 1000;
        if (interval > 0) setInterval(autoSave, interval);
      }

      function loadProviderSettings() {
        const secrets = typeof sessionStorage !== 'undefined' ? sessionStorage : localStorage;
        // Migrate legacy persistent secrets to session-only storage.
        for (const key of [PROVIDER_STORAGE_KEYS.apiKey, PROVIDER_STORAGE_KEYS.azureApiKeyStore, PROVIDER_STORAGE_KEYS.azureSpeechKeyStore]) {
          const legacyValue = localStorage.getItem(key);
          if (legacyValue && !secrets.getItem(key)) secrets.setItem(key, legacyValue);
          if (secrets !== localStorage) localStorage.removeItem(key);
        }
        localStorage.removeItem(PROVIDER_STORAGE_KEYS.azureApiKey);
        localStorage.removeItem('crisisstim_api_key');
        const result = {
          ai_provider: localStorage.getItem(PROVIDER_STORAGE_KEYS.aiProvider) || undefined,
          ollama_mode: localStorage.getItem(PROVIDER_STORAGE_KEYS.ollamaMode) || undefined,
          ollama_endpoint: localStorage.getItem(PROVIDER_STORAGE_KEYS.ollamaEndpoint) || undefined,
          azure_endpoint: localStorage.getItem(PROVIDER_STORAGE_KEYS.azureEndpoint) || undefined,
          azure_deployment: localStorage.getItem(PROVIDER_STORAGE_KEYS.azureDeployment) || undefined,
          confidentiality_acknowledged: localStorage.getItem(PROVIDER_STORAGE_KEYS.confidentialityAcknowledged) === 'true'
        };
        // Only include API keys in result if they are actually stored in dedicated keys,
        // otherwise leave them undefined so embedded values in the scenario JSON are preserved
        const apiKey = secrets.getItem(PROVIDER_STORAGE_KEYS.apiKey);
        if (apiKey) result.ai_api_key = apiKey;
        const azureApiKey = secrets.getItem(PROVIDER_STORAGE_KEYS.azureApiKeyStore);
        if (azureApiKey) result.azure_api_key = azureApiKey;
        const azureSpeechKey = secrets.getItem(PROVIDER_STORAGE_KEYS.azureSpeechKeyStore);
        if (azureSpeechKey) result.azure_speech_key = azureSpeechKey;
        const azureSpeechRegion = localStorage.getItem(PROVIDER_STORAGE_KEYS.azureSpeechRegion);
        if (azureSpeechRegion) result.azure_speech_region = azureSpeechRegion;
        return result;
      }

      function restoreApiKeysFromStorage(settings) {
        const secrets = typeof sessionStorage !== 'undefined' ? sessionStorage : localStorage;
        const apiKey = secrets.getItem(PROVIDER_STORAGE_KEYS.apiKey);
        if (apiKey) settings.ai_api_key = apiKey;
        const azureApiKey = secrets.getItem(PROVIDER_STORAGE_KEYS.azureApiKeyStore);
        if (azureApiKey) settings.azure_api_key = azureApiKey;
        const speechKey = secrets.getItem(PROVIDER_STORAGE_KEYS.azureSpeechKeyStore);
        if (speechKey) settings.azure_speech_key = speechKey;
        const speechRegion = localStorage.getItem(PROVIDER_STORAGE_KEYS.azureSpeechRegion);
        if (speechRegion) settings.azure_speech_region = speechRegion;
      }

      function persistProviderSettings(settings) {
        const secrets = typeof sessionStorage !== 'undefined' ? sessionStorage : localStorage;
        localStorage.setItem(PROVIDER_STORAGE_KEYS.aiProvider, settings.ai_provider || 'anthropic');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.ollamaMode, settings.ollama_mode || 'local');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.ollamaEndpoint, settings.ollama_endpoint || 'http://localhost:11434');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.azureEndpoint, settings.azure_endpoint || '');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.azureDeployment, settings.azure_deployment || '');
        // API keys are stored in dedicated keys, separate from project data (never exported in project files)
        if (settings.ai_api_key) {
          secrets.setItem(PROVIDER_STORAGE_KEYS.apiKey, settings.ai_api_key);
        } else {
          secrets.removeItem(PROVIDER_STORAGE_KEYS.apiKey);
        }
        if (settings.azure_api_key) {
          secrets.setItem(PROVIDER_STORAGE_KEYS.azureApiKeyStore, settings.azure_api_key);
        } else {
          secrets.removeItem(PROVIDER_STORAGE_KEYS.azureApiKeyStore);
        }
        if (settings.azure_speech_key) {
          secrets.setItem(PROVIDER_STORAGE_KEYS.azureSpeechKeyStore, settings.azure_speech_key);
        } else {
          secrets.removeItem(PROVIDER_STORAGE_KEYS.azureSpeechKeyStore);
        }
        localStorage.setItem(PROVIDER_STORAGE_KEYS.azureSpeechRegion, settings.azure_speech_region || 'westeurope');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.confidentialityAcknowledged, settings.confidentiality_acknowledged ? 'true' : 'false');
      }


      // ── PNG AI metadata injection ──────────────────────────────────────
      // Embeds tEXt chunks and XMP/IPTC DigitalSourceType into a PNG data URL.
      const PngMetadata = (() => {
        // CRC32 lookup table (PNG uses CRC32/ISO 3309)
        const crcTable = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
          let c = n;
          for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          crcTable[n] = c;
        }
        function crc32(bytes) {
          let crc = 0xFFFFFFFF;
          for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
          return (crc ^ 0xFFFFFFFF) >>> 0;
        }

        function makeTextChunk(keyword, text) {
          const encoder = new TextEncoder();
          const kwBytes = encoder.encode(keyword);
          const txtBytes = encoder.encode(text);
          // tEXt: keyword + 0x00 + text
          const data = new Uint8Array(kwBytes.length + 1 + txtBytes.length);
          data.set(kwBytes, 0);
          data[kwBytes.length] = 0;
          data.set(txtBytes, kwBytes.length + 1);
          return buildChunk('tEXt', data);
        }

        function makeItxtChunk(keyword, text) {
          const encoder = new TextEncoder();
          const kwBytes = encoder.encode(keyword);
          const txtBytes = encoder.encode(text);
          // iTXt: keyword + 0x00 + compressionFlag(0) + compressionMethod(0) + languageTag + 0x00 + translatedKeyword + 0x00 + text
          const data = new Uint8Array(kwBytes.length + 1 + 2 + 1 + 1 + txtBytes.length);
          let offset = 0;
          data.set(kwBytes, offset); offset += kwBytes.length;
          data[offset++] = 0; // null separator
          data[offset++] = 0; // compression flag (no compression)
          data[offset++] = 0; // compression method
          data[offset++] = 0; // empty language tag + null separator
          data[offset++] = 0; // empty translated keyword + null separator
          data.set(txtBytes, offset);
          return buildChunk('iTXt', data);
        }

        function buildChunk(type, data) {
          const encoder = new TextEncoder();
          const typeBytes = encoder.encode(type);
          const chunk = new Uint8Array(4 + 4 + data.length + 4);
          // Length (4 bytes, big-endian)
          const len = data.length;
          chunk[0] = (len >>> 24) & 0xFF;
          chunk[1] = (len >>> 16) & 0xFF;
          chunk[2] = (len >>> 8) & 0xFF;
          chunk[3] = len & 0xFF;
          // Type (4 bytes)
          chunk.set(typeBytes, 4);
          // Data
          chunk.set(data, 8);
          // CRC over type + data
          const crcInput = new Uint8Array(4 + data.length);
          crcInput.set(typeBytes, 0);
          crcInput.set(data, 4);
          const crcVal = crc32(crcInput);
          const crcOffset = 8 + data.length;
          chunk[crcOffset] = (crcVal >>> 24) & 0xFF;
          chunk[crcOffset + 1] = (crcVal >>> 16) & 0xFF;
          chunk[crcOffset + 2] = (crcVal >>> 8) & 0xFF;
          chunk[crcOffset + 3] = crcVal & 0xFF;
          return chunk;
        }

        const XMP_TEMPLATE = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/">
      <dc:description>
        <rdf:Alt><rdf:li xml:lang="x-default">AI-generated crisis exercise stimulus created with CrisisMaker by Wavestone</rdf:li></rdf:Alt>
      </dc:description>
      <Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType>
      <photoshop:Credit>CrisisMaker by Wavestone</photoshop:Credit>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

        function injectMetadata(dataUrl) {
          // Decode base64 PNG from data URL
          const base64 = dataUrl.split(',')[1];
          const binaryStr = atob(base64);
          const original = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) original[i] = binaryStr.charCodeAt(i);

          // Find IEND chunk (last 12 bytes: length(4) + "IEND"(4) + CRC(4))
          // Search backwards for "IEND"
          let iendPos = -1;
          for (let i = original.length - 12; i >= 8; i--) {
            if (original[i + 4] === 0x49 && original[i + 5] === 0x45 && original[i + 6] === 0x4E && original[i + 7] === 0x44) {
              iendPos = i;
              break;
            }
          }
          if (iendPos < 0) return dataUrl; // malformed PNG, return as-is

          // Build metadata chunks
          const chunks = [
            makeTextChunk('Software', 'CrisisMaker by Wavestone'),
            makeTextChunk('Source', 'CrisisMaker - AI-generated crisis exercise stimulus'),
            makeTextChunk('Comment', 'This image was generated using artificial intelligence for crisis exercise simulation purposes.'),
            makeItxtChunk('XML:com.adobe.xmp', XMP_TEMPLATE)
          ];

          // Calculate total size of new chunks
          const totalNewBytes = chunks.reduce((sum, c) => sum + c.length, 0);

          // Build new PNG: [before IEND] + [metadata chunks] + [IEND]
          const result = new Uint8Array(original.length + totalNewBytes);
          result.set(original.subarray(0, iendPos), 0);
          let writePos = iendPos;
          for (const chunk of chunks) {
            result.set(chunk, writePos);
            writePos += chunk.length;
          }
          result.set(original.subarray(iendPos), writePos);

          // Re-encode to data URL
          let binary = '';
          for (let i = 0; i < result.length; i++) binary += String.fromCharCode(result[i]);
          return 'data:image/png;base64,' + btoa(binary);
        }

        return { injectMetadata };
      })();

      /* Webfonts for the exported images. Left to itself, html-to-image resolves the url()s of
         fonts/fonts.css with a <base> element, which the page's CSP (base-uri 'none') refuses:
         every font is then requested at the site root (404) and the PNG falls back to system
         fonts. Here the @font-face rules are read once from the page's style sheets, the fonts
         a node really uses are inlined as data: URLs (fetched once, then cached) and handed to
         html-to-image as fontEmbedCSS. The single-file build already carries data: URLs. */
      const ExportFonts = {
        faces: null,
        inlined: new Map(),
        failed: new Set(),
        family(value) {
          return String(value || '').trim().replace(/^['"]|['"]$/g, '').trim().toLowerCase();
        },
        /* Every @font-face rule of the page, with the address its relative url()s resolve against. */
        list() {
          if (this.faces) return this.faces;
          const faces = [];
          Array.from(document.styleSheets || []).forEach((sheet) => {
            let rules = [];
            try { rules = Array.from(sheet.cssRules || []); } catch (_) { return; }
            rules.filter((rule) => rule.type === CSSRule.FONT_FACE_RULE).forEach((rule) => {
              faces.push({ family: this.family(rule.style.getPropertyValue('font-family')), cssText: rule.cssText, base: sheet.href || document.baseURI });
            });
          });
          if (faces.length) this.faces = faces;
          return faces;
        },
        dataUrl(url) {
          if (!this.inlined.has(url)) {
            this.inlined.set(url, fetch(url).then((response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.blob();
            }).then((blob) => new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(blob);
            })));
          }
          return this.inlined.get(url);
        },
        async inline(face) {
          let css = face.cssText;
          for (const match of face.cssText.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
            if (/^data:/i.test(match[2])) continue;
            css = css.replace(match[0], `url("${await this.dataUrl(new URL(match[2], face.base).href)}")`);
          }
          return css;
        },
        /* The fontEmbedCSS for one node: only the families it uses. A font that cannot be read
           is left out (the image then uses a system font), never requested at a wrong address. */
        async cssFor(node) {
          const faces = this.list();
          if (!faces.length || !node) return '';
          const used = new Set();
          [node, ...node.querySelectorAll('*')].forEach((element) => {
            String(getComputedStyle(element).fontFamily || '').split(',').forEach((name) => used.add(this.family(name)));
          });
          const parts = await Promise.all(faces.filter((face) => used.has(face.family)).map((face) => this.inline(face).catch((error) => {
            if (!this.failed.has(face.cssText) && typeof CrisisError !== 'undefined') CrisisError.log(error, { operation: 'Embed a webfont in an exported image', detail: face.family });
            this.failed.add(face.cssText);
            return '';
          })));
          return parts.filter(Boolean).join('\n');
        }
      };

      /* All the PNG exports go through here, so every image carries the bundled webfonts. */
      async function renderNodeToPng(node, options) {
        const fontEmbedCSS = await ExportFonts.cssFor(node);
        // A still image: scrolling TV tickers are frozen with their text in view (they start off-screen).
        node.classList.add('is-exporting');
        try { return await htmlToImage.toPng(node, { ...options, fontEmbedCSS }); }
        finally { node.classList.remove('is-exporting'); }
      }

      const ExportEngine = {
        async exportStimulus(stimulus) {
          try {
            let dataUrl;
            if (this.isVideoStimulus(stimulus)) {
              dataUrl = await this.renderVideoStimulusFrame(stimulus);
            } else {
              let element = document.getElementById(`render-${stimulus.id}`) || document.getElementById('fullscreen-preview');
              let sandbox = null;
              if (!element) {
                sandbox = document.createElement('div');
                sandbox.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
                document.body.appendChild(sandbox);
                sandbox.innerHTML = renderStimulusPreview(stimulus, `export-sandbox-${stimulus.id}`);
                element = sandbox.firstElementChild;
              }
              try {
                dataUrl = await renderNodeToPng(element, { quality: 1.0, pixelRatio: 2, backgroundColor: '#FFFFFF' });
              } finally {
                if (sandbox) document.body.removeChild(sandbox);
              }
            }
            dataUrl = PngMetadata.injectMetadata(dataUrl);
            this.downloadDataUrl(dataUrl, this.filenameForStimulus(stimulus));
            pushToast(tt('Stimulus exported as PNG.', 'Stimulus exporté en PNG.', 'Stimulus als PNG exportiert.'), 'success');
          } catch (error) {
            throw CrisisError.wrap(error, {
              operation: 'Export stimulus PNG',
              detail: `Stimulus id=${stimulus?.id || 'unknown'}, channel=${stimulus?.channel || 'unknown'}`
            });
          }
        },
        async exportRawEmail(stimulus) {
          if (!stimulus) throw new Error(tt('No stimulus selected.', 'Aucun stimulus sélectionné.', 'Kein Stimulus ausgewählt.'));
          if (!this.isEmailStimulus(stimulus)) throw new Error(tt('Only email stimuli can be exported as .eml.', 'Seuls les stimuli e-mail peuvent être exportés en .eml.', 'Nur E-Mail-Stimuli können als .eml exportiert werden.'));
          try {
            const content = this.buildRawEmailContent(stimulus);
            const blob = new Blob([content], { type: 'message/rfc822' });
            downloadBlob(blob, this.filenameForRawEmail(stimulus));
            pushToast(tt('Email exported as .eml.', 'E-mail exporté en .eml.', 'E-Mail als .eml exportiert.'), 'success');
          } catch (error) {
            throw CrisisError.wrap(error, {
              operation: 'Export email EML',
              detail: `Stimulus id=${stimulus.id}, subject=${stimulus.fields?.subject || stimulus.channel}`
            });
          }
        },
        async exportAll() {
          const zip = new JSZip();
          const stimuli = getSortedStimuli();
          if (!stimuli.length) throw new Error(tt('No stimulus to export.', 'Aucun stimulus à exporter.', 'Kein Stimulus zum Exportieren vorhanden.'));
          const sandbox = document.createElement('div');
          sandbox.style.position = 'fixed';
          sandbox.style.left = '-99999px';
          sandbox.style.top = '0';
          document.body.appendChild(sandbox);
          const failures = [];
          const skipped = [];
          // Exported another way (a video inject as a still image): listed, not counted as a failure.
          const notes = [];
          try {
            for (let i = 0; i < stimuli.length; i++) {
              const stimulus = stimuli[i];
              const isVideo = this.isVideoStimulus(stimulus);
              appState.ui.exportAllProgress = { current: i + 1, total: stimuli.length, isVideo };
              if (typeof App !== 'undefined') App.render();
              try {
                let still = !isVideo;
                if (isVideo) {
                  try {
                    const { blob: clipBlob } = await this.renderVideoStimulusClip(stimulus);
                    zip.file(this.filenameForStimulus(stimulus, 'webm'), clipBlob);
                  } catch (videoError) {
                    // A video this browser cannot read or encode: the inject is still exported, as a
                    // still image of its screen (headline, ticker), and the reason is listed.
                    CrisisError.log(videoError, { operation: 'Render video stimulus for ZIP export', detail: `Stimulus id=${stimulus?.id || 'unknown'}` });
                    notes.push(`${this.playPrefix(stimulus)} ${sbStimulusLabel(stimulus)}: ${tt('video not rendered, exported as a still image', 'vidéo non rendue, exportée en image fixe', 'Video nicht gerendert, als Standbild exportiert')} (${videoError?.message || videoError})`);
                    still = true;
                  }
                }
                if (still) {
                  sandbox.innerHTML = renderStimulusPreview(stimulus, `zip-${stimulus.id}`);
                  // The still image of a video inject: its video is replaced by a dark frame, which the
                  // image renderer can draw (an unreadable video makes it fail).
                  if (isVideo) sandbox.querySelectorAll('video').forEach((video) => {
                    const frame = document.createElement('div');
                    frame.className = video.className;
                    frame.style.cssText = `${video.getAttribute('style') || ''};background:#0b1220;`;
                    video.replaceWith(frame);
                  });
                  const node = sandbox.firstElementChild;
                  if (!node) throw new Error(tt('Rendered stimulus preview is empty.', 'L’aperçu du stimulus rendu est vide.', 'Die gerenderte Stimulus-Vorschau ist leer.'));
                  let dataUrl = await renderNodeToPng(node, { quality: 1.0, pixelRatio: 2, backgroundColor: '#FFFFFF' });
                  dataUrl = PngMetadata.injectMetadata(dataUrl);
                  zip.file(this.filenameForStimulus(stimulus), dataUrl.split(',')[1], { base64: true });
                }
              } catch (error) {
                // One inject that cannot be rendered (a video under file://, a broken image) is
                // listed in export_errors.txt; the others are still exported.
                CrisisError.log(error, { operation: 'Render stimulus for ZIP export', detail: `Stimulus id=${stimulus?.id || 'unknown'}, channel=${stimulus?.channel || 'unknown'}` });
                const reason = error?.message || (typeof Event !== 'undefined' && error instanceof Event ? tt(`a resource of the inject could not be loaded (${error.type})`, `une ressource de l'inject n'a pas pu être chargée (${error.type})`, `eine Ressource des Injects konnte nicht geladen werden (${error.type})`) : String(error));
                failures.push(`${this.playPrefix(stimulus)} ${sbStimulusLabel(stimulus)}: ${reason}`);
                skipped.push(this.skippedLabel(stimulus));
              }
            }
            if (skipped.length === stimuli.length) throw new Error(tt('No inject could be rendered.', 'Aucun inject n\'a pu être rendu.', 'Kein Inject konnte gerendert werden.') + ` ${failures[0] || ''}`);
            const exportData = buildProjectFileData({ forFile: true });
            const json = JSON.stringify(exportData, null, 2);
            const crisisSlug = slugify(appState.scenario.name);
            zip.file(`${crisisSlug}.json`, json);
            zip.file(`${crisisSlug}_chronogram.csv`, this.chronogramCsv(stimuli));
            if (failures.length || notes.length) zip.file('export_errors.txt', [...failures, ...notes].join('\r\n'));
            const blob = await zip.generateAsync({ type: 'blob' });
            downloadBlob(blob, `${crisisSlug}.zip`);
            if (skipped.length) pushToast(this.skippedMessage(skipped), 'warning', 15000);
            else pushToast(tt('ZIP archive generated.', 'Archive ZIP générée.', 'ZIP-Archiv erstellt.'), 'success');
          } catch (error) {
            throw CrisisError.wrap(error, {
              operation: 'Export all stimuli ZIP',
              detail: [`Stimuli=${stimuli.length}`, `project=${appState.scenario.name || 'untitled'}`, error?.detail].filter(Boolean).join(', ')
            });
          } finally {
            appState.ui.exportAllProgress = null;
            document.body.removeChild(sandbox);
          }
        },
        /* "#07 STONAWAVE: ONGOING CYBERATTACK": how a skipped inject is named in the warning. */
        skippedLabel(stimulus) {
          const number = ExerciseModel.numbers(appState.scenario).get(stimulus.id);
          const title = String(sbStimulusLabel(stimulus) || channelLabel(stimulus.channel) || '').replace(/\s+/g, ' ').trim();
          return `${number ? `#${String(number).padStart(2, '0')} ` : ''}${title.length > 60 ? `${title.slice(0, 59).trimEnd()}…` : title}`;
        },
        /* The warning shown after the download when some injects are not in the ZIP. */
        skippedMessage(skipped) {
          const shown = skipped.slice(0, 5).join('; ');
          const more = skipped.length - 5;
          const n = skipped.length;
          return tt(
            `ZIP downloaded without ${n} inject${n > 1 ? 's' : ''} that could not be rendered: ${shown}${more > 0 ? ` and ${more} more` : ''}. Details in export_errors.txt in the archive.`,
            `ZIP téléchargé sans ${n} inject${n > 1 ? 's' : ''} qui n'${n > 1 ? 'ont' : 'a'} pas pu être rendu${n > 1 ? 's' : ''} : ${shown}${more > 0 ? ` et ${more} autre${more > 1 ? 's' : ''}` : ''}. Détails dans export_errors.txt dans l'archive.`,
            `ZIP ohne ${n} Inject${n > 1 ? 's' : ''} heruntergeladen, die nicht gerendert werden konnten: ${shown}${more > 0 ? ` und ${more} weitere` : ''}. Details in export_errors.txt im Archiv.`
          );
        },
        /* Play order number and time, so the files sort in the order the pilot sends them. */
        playPrefix(stimulus) {
          const numbers = ExerciseModel.numbers(appState.scenario);
          const width = Math.max(2, String(ExerciseModel.numberTop(numbers)).length);
          const number = String(numbers.get(stimulus.id) || 0).padStart(width, '0');
          const minutes = Math.max(0, Math.round(Number(stimulus.timestamp_offset_minutes) || 0));
          return `${number}_H+${String(Math.floor(minutes / 60)).padStart(2, '0')}-${String(minutes % 60).padStart(2, '0')}`;
        },
        filenameForStimulus(stimulus, ext = 'png') {
          const actor = getActor(stimulus.actor_id);
          return `${this.playPrefix(stimulus)}_${stimulus.channel}_${slugify(actor?.name || 'acteur')}.${ext}`;
        },
        /* The chronogram for the pilot: one line per stimulus, in play order (Excel-friendly). */
        chronogramCsv(stimuli) {
          const project = appState.scenario;
          const quote = csvCell;
          const header = ['#', tt('Time', 'Heure', 'Zeit'), tt('Simulated time', 'Heure simulée', 'Simulierte Zeit'), tt('Phase', 'Phase', 'Phase'), tt('Recipient cell', 'Cellule destinataire', 'Empfängerzelle'), tt('Channel', 'Canal', 'Kanal'), tt('Sender', 'Émetteur', 'Absender'), tt('Title', 'Titre', 'Titel'), tt('Status', 'Statut', 'Status'), tt('File', 'Fichier', 'Datei')];
          const numbers = ExerciseModel.numbers(project);
          const rows = stimuli.map((stimulus, index) => {
            const phase = ExerciseModel.phaseOfStimulus(project, stimulus);
            const cell = ExerciseModel.cell(project, stimulus);
            return [numbers.get(stimulus.id) || index + 1, sbFormatOffset(stimulus.timestamp_offset_minutes), project.scenario.start_date ? sbClockTime(stimulus.timestamp_offset_minutes, project.scenario.start_date) : '',
              phase?.title || '', cell?.name || '', channelLabel(stimulus.channel), getActor(stimulus.actor_id)?.name || '', sbStimulusLabel(stimulus),
              typeof playStatusLabel === 'function' ? playStatusLabel(stimulus.status) : stimulus.status, this.filenameForStimulus(stimulus, this.isVideoStimulus(stimulus) ? 'webm' : 'png')];
          });
          return '\ufeff' + [header, ...rows].map((row) => row.map(quote).join(';')).join('\r\n');
        },
        filenameForRawEmail(stimulus) {
          const actor = getActor(stimulus.actor_id);
          return `${this.playPrefix(stimulus)}_${slugify(stimulus.fields.subject || stimulus.channel)}_${slugify(actor?.name || 'actor')}.eml`;
        },
        isEmailStimulus(stimulus) {
          return Boolean(stimulus?.channel && String(stimulus.channel).startsWith('email_'));
        },
        isVideoStimulus(stimulus) {
          return Boolean(stimulus?.channel === 'breaking_news_tv' && appState.videoFiles?.[stimulus.id]?.objectUrl);
        },
        // html-to-image cannot rasterize <video> elements (it serializes the DOM to an SVG
        // data URI and decodes it as an <img>, which fails for embedded video). Grab a still
        // frame via canvas instead, matching the approach used by exportVideo().
        async renderVideoStimulusFrame(stimulus) {
          const videoInfo = appState.videoFiles[stimulus.id];
          this.assertVideoExportable(videoInfo);
          const W = 1280, H = 720;
          const srcVideo = document.createElement('video');
          srcVideo.src = videoInfo.objectUrl;
          srcVideo.muted = true;
          srcVideo.playsInline = true;
          await new Promise((resolve, reject) => {
            srcVideo.addEventListener('loadedmetadata', resolve, { once: true });
            srcVideo.addEventListener('error', () => reject(new Error(tt('Failed to load video file.', 'Impossible de charger le fichier vidéo.', 'Videodatei konnte nicht geladen werden.'))), { once: true });
            srcVideo.load();
          });
          srcVideo.currentTime = Math.min(1, (srcVideo.duration || 2) / 2);
          await new Promise((resolve) => srcVideo.addEventListener('seeked', resolve, { once: true }));

          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(srcVideo, 0, 0, W, H);
          const overlayImg = await this._renderOverlayImage(stimulus, W, H);
          if (overlayImg) ctx.drawImage(overlayImg, 0, 0, W, H);
          const watermarkImg = await this._renderWatermarkImage(stimulus, W, H);
          if (watermarkImg) ctx.drawImage(watermarkImg, 0, 0, W, H);
          try {
            return canvas.toDataURL('image/png');
          } catch (error) {
            if (error?.name === 'SecurityError') {
              throw new Error(tt(
                'The video attached to this inject is treated as coming from a restricted origin, so the browser refuses to export it (this typically happens when CrisisMaker is opened directly from a local file instead of a web server). Try opening the app through a local web server, or re-upload the video for this inject.',
                'La vidéo attachée à cet inject est considérée comme provenant d’une origine restreinte, donc le navigateur refuse de l’exporter (cela arrive généralement quand CrisisMaker est ouvert directement depuis un fichier local plutôt que via un serveur web). Essayez d’ouvrir l’application via un serveur web local, ou réimportez la vidéo pour cet inject.',
                'Das an diesen Inject angehängte Video wird als aus einer eingeschränkten Quelle stammend behandelt, weshalb der Browser den Export verweigert (dies passiert typischerweise, wenn CrisisMaker direkt aus einer lokalen Datei statt über einen Webserver geöffnet wird). Öffnen Sie die App über einen lokalen Webserver, oder laden Sie das Video für diesen Inject erneut hoch.'
              ));
            }
            throw error;
          }
        },
        buildRawEmailContent(stimulus) {
          const fields = stimulus.fields || {};
          const actor = getActor(stimulus.actor_id);
          const line = (label, value) => `${label}: ${value || ''}`;
          const headers = [
            line('From', this.formatMailbox(fields.from_name || actor?.name, fields.from_email)),
            line('To', fields.to || ''),
            line('Cc', fields.cc || ''),
            line('Subject', fields.subject || ''),
            line('Date', fields.date || ''),
            line('Importance', fields.importance || (fields.severity ? String(fields.severity).toUpperCase() : 'normal')),
            line('X-Unsent', '1')
          ];
          if (fields.reference) headers.push(line('X-Reference', fields.reference));
          if (fields.has_attachment && fields.attachment_name) headers.push(line('X-Attachment-Placeholder', fields.attachment_name));
          const body = this.normalizeEmailBody(sanitizeBody(fields.body));
          return `${headers.join('\r\n')}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${body}`;
        },
        formatMailbox(name, email) {
          if (name && email) return `${name} <${email}>`;
          return name || email || '';
        },
        normalizeEmailBody(value) {
          const html = String(value || '').trim();
          return html.startsWith('<!DOCTYPE html>') ? html : `<!DOCTYPE html><html><body>${html}</body></html>`;
        },
        downloadDataUrl(dataUrl, filename) {
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = filename;
          link.click();
        },

        // ── Audio export: download audio file ──
        async exportAudio(stimulus) {
          if (!stimulus) throw new Error(tt('No stimulus selected.', 'Aucun stimulus sélectionné.', 'Kein Stimulus ausgewählt.'));
          const audioInfo = appState.audioFiles?.[stimulus.id];
          if (!audioInfo?.blob && !audioInfo?.objectUrl) throw new Error(tt('No audio file attached to this inject. Generate or upload audio first.', 'Aucun fichier audio attaché à cet inject. Générez ou importez un audio d\'abord.', 'Keine Audiodatei an diesen Inject angehängt. Generieren oder laden Sie zuerst Audio hoch.'));
          const actor = getActor(stimulus.actor_id);
          const ext = (audioInfo.fileName || '').split('.').pop() || 'wav';
          const voiceLabel = stimulus.fields.audio_character || stimulus.fields.voice_type || 'custom';
          const filename = `${slugify(appState.scenario.name)}_H+${String(Math.floor(stimulus.timestamp_offset_minutes / 60)).padStart(2, '0')}_audio_${slugify(voiceLabel)}_${slugify(actor?.name || 'actor')}.${ext}`;
          try {
            if (audioInfo.blob) {
              downloadBlob(audioInfo.blob, filename);
            } else {
              // Fetch from objectUrl
              const resp = await fetch(audioInfo.objectUrl).catch((error) => {
                throw CrisisError.wrap(error, { operation: 'Read audio object URL for export', detail: `Stimulus id=${stimulus.id}` });
              });
              if (!resp.ok) throw await CrisisError.fromHttpResponse(resp, { operation: 'Read audio object URL for export' });
              const blob = await resp.blob();
              downloadBlob(blob, filename);
            }
            pushToast(tt('Audio exported.', 'Audio exporté.', 'Audio exportiert.'), 'success');
          } catch (error) {
            throw CrisisError.wrap(error, {
              operation: 'Export audio file',
              detail: `Stimulus id=${stimulus.id}, file=${audioInfo.fileName || filename}`
            });
          }
        },

        // ── Video export: composite video + TV overlay → WebM ──
        async exportVideo(stimulus) {
          if (!stimulus) throw new Error(tt('No stimulus selected.', 'Aucun stimulus sélectionné.', 'Kein Stimulus ausgewählt.'));
          const videoInfo = appState.videoFiles?.[stimulus.id];
          if (!videoInfo?.objectUrl) throw new Error(tt('No video file attached to this inject.', 'Aucun fichier vidéo attaché à cet inject.', 'Keine Videodatei an diesen Inject angehängt.'));
          try {
            const { blob } = await this.renderVideoStimulusClip(stimulus);
            downloadBlob(blob, this.filenameForStimulus(stimulus, 'webm'));
            pushToast(tt('Video exported with overlays.', 'Vidéo exportée avec les incrustations.', 'Video mit Overlay exportiert.'), 'success');
          } catch (error) {
            throw CrisisError.wrap(error, {
              operation: 'Export video with overlays',
              detail: `Stimulus id=${stimulus?.id || 'unknown'}, source=${videoInfo?.fileName || videoInfo?.objectUrl || 'attached video'}`
            });
          }
        },
        // Composites the source video + TV overlay + watermark into a WebM blob by
        // recording a canvas in real time (playback duration ≈ encoding duration).
        // Shared by the single "Export video" button and the ZIP-all export.
        async renderVideoStimulusClip(stimulus) {
          const videoInfo = appState.videoFiles[stimulus.id];
          this.assertVideoExportable(videoInfo);

          // 1. Create an offscreen video element to read source frames
          const srcVideo = document.createElement('video');
          srcVideo.src = videoInfo.objectUrl;
          srcVideo.muted = false;
          srcVideo.playsInline = true;
          await new Promise((resolve, reject) => {
            srcVideo.addEventListener('loadedmetadata', resolve, { once: true });
            srcVideo.addEventListener('error', () => reject(new Error(tt('Failed to load video file.', 'Impossible de charger le fichier vidéo.', 'Videodatei konnte nicht geladen werden.'))), { once: true });
            srcVideo.load();
          });

          const W = 1280, H = 720;
          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          const ctx = canvas.getContext('2d');

          // 2. Render the selected TV overlay to a static PNG image
          const overlayPng = await this._renderOverlayImage(stimulus, W, H);

          // 3. Also render the watermark overlay
          const watermarkPng = await this._renderWatermarkImage(stimulus, W, H);

          // 4. Set up MediaRecorder on the canvas stream (+ audio tracks from source video)
          const fps = 30;
          const stream = canvas.captureStream(fps);
          if (srcVideo.captureStream) {
            srcVideo.captureStream().getAudioTracks().forEach(track => stream.addTrack(track));
          }
          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
            : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
            : 'video/webm';
          const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
          const chunks = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

          const recordingDone = new Promise((resolve) => { recorder.onstop = resolve; });

          // 5. Start recording + playing
          recorder.start();
          srcVideo.currentTime = 0;
          await srcVideo.play();

          // 6. Draw loop: video frame + overlay on each animation frame
          let stopped = false;
          const drawFrame = () => {
            if (stopped) return;
            ctx.drawImage(srcVideo, 0, 0, W, H);
            if (overlayPng) ctx.drawImage(overlayPng, 0, 0, W, H);
            if (watermarkPng) ctx.drawImage(watermarkPng, 0, 0, W, H);
            requestAnimationFrame(drawFrame);
          };
          drawFrame();

          // 7. Wait for video to end
          await new Promise((resolve) => {
            srcVideo.addEventListener('ended', resolve, { once: true });
          });
          stopped = true;
          recorder.stop();
          srcVideo.pause();
          await recordingDone;

          return { blob: new Blob(chunks, { type: mimeType }), mimeType };
        },
        // The bundled default TV news video is served from a relative path, not a blob:
        // URL. Opened via file://, the browser gives it an opaque origin distinct from the
        // page's own, so drawing it onto an export canvas taints the canvas and any later
        // read (toDataURL, captureStream) throws a SecurityError. Fail fast with a clear
        // message instead of waiting through a real-time recording that would just error out.
        assertVideoExportable(videoInfo) {
          if (videoInfo.isBundledDefault && typeof location !== 'undefined' && location.protocol === 'file:') {
            throw new Error(tt(
              'This TV inject still uses the bundled default video, which cannot be exported while CrisisMaker is opened directly from a local file (file://). Open it through a local web server instead (e.g. run "python3 -m http.server" in the app folder and browse to http://localhost:8000), or upload your own video for this inject.',
              'Cet inject TV utilise encore la vidéo par défaut intégrée, qui ne peut pas être exportée tant que CrisisMaker est ouvert directement depuis un fichier local (file://). Ouvrez l’application via un serveur web local à la place (ex. lancez "python3 -m http.server" dans le dossier de l’app puis allez sur http://localhost:8000), ou importez votre propre vidéo pour cet inject.',
              'Dieser TV-Inject verwendet noch das mitgelieferte Standardvideo, das nicht exportiert werden kann, solange CrisisMaker direkt aus einer lokalen Datei (file://) geöffnet ist. Öffnen Sie die App stattdessen über einen lokalen Webserver (z. B. "python3 -m http.server" im App-Ordner ausführen und http://localhost:8000 aufrufen), oder laden Sie für diesen Inject ein eigenes Video hoch.'
            ));
          }
        },

        async _renderOverlayImage(stimulus, w, h) {
          const overlayHtml = TemplateEngine.renderOverlay(stimulus, appState.scenario);
          if (!overlayHtml) return null;
          const sandbox = document.createElement('div');
          sandbox.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;z-index:-1;';
          sandbox.innerHTML = `<div style="width:${w}px;height:${h}px;position:relative;">${overlayHtml}</div>`;
          document.body.appendChild(sandbox);
          const node = sandbox.firstElementChild;
          try {
            const dataUrl = await renderNodeToPng(node, { quality: 1.0, pixelRatio: 1, backgroundColor: null, width: w, height: h });
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = dataUrl;
            });
            return img;
          } finally {
            document.body.removeChild(sandbox);
          }
        },

        async _renderWatermarkImage(stimulus, w, h) {
          const wmHtml = renderWatermarkOverlay(stimulus);
          if (!wmHtml) return null;
          const sandbox = document.createElement('div');
          sandbox.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;z-index:-1;';
          sandbox.innerHTML = `<div style="width:${w}px;height:${h}px;position:relative;">${wmHtml}</div>`;
          document.body.appendChild(sandbox);
          const node = sandbox.firstElementChild;
          try {
            const dataUrl = await renderNodeToPng(node, { quality: 1.0, pixelRatio: 1, backgroundColor: null, width: w, height: h });
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = dataUrl;
            });
            return img;
          } finally {
            document.body.removeChild(sandbox);
          }
        }
      };


      async function saveScenarioToFile() {
        try {
          const exportData = buildProjectFileData({ forFile: true });
          const json = JSON.stringify(exportData, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          downloadBlob(blob, `${slugify(appState.scenario.name)}.json`);
          pushToast(tt('Scenario exported as JSON.', 'Scénario exporté en JSON.', 'Szenario als JSON exportiert.'), 'success');
        } catch (error) {
          throw CrisisError.wrap(error, { operation: 'Export scenario JSON', detail: `Project=${appState.scenario.name || 'untitled'}` });
        }
      }

      async function loadScenarioFromFile() {
        // Try File System Access API first (Chrome/Edge). Only a picker failure falls back
        // to the classic input; a cancel stays silent and a bad file shows an error.
        let picked = null;
        try {
          picked = await pickFileWithFileSystemAPI();
        } catch (e) {
          CrisisError.log(e, { operation: 'Open project with File System Access API' });
        }
        if (picked?.cancelled) return;
        if (picked?.file) {
          const { file, handle } = picked;
          let data;
          try {
            data = await parseProjectFile(file);
          } catch (error) {
            CrisisError.toast(error, { operation: 'Import project file', fileName: file.name, fileSize: file.size });
            return;
          }
          // Save back to this file only when it is a JSON project (never over a ZIP).
          if (applyLoadedScenario(data)) _fileHandle = /\.zip$/i.test(file.name) ? null : handle;
          return;
        }
        // Fallback: classic file input (element must be in DOM for Safari/Firefox compatibility)
        await new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,.crisismaker.json,.crisisstim.json,.zip,application/json,application/zip';
          input.style.display = 'none';
          document.body.appendChild(input);
          const cleanup = () => { if (input.parentNode) input.remove(); };
          input.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            cleanup();
            if (!file) {
              resolve();
              return;
            }
            parseProjectFile(file)
              .then((data) => applyLoadedScenario(data))
              .catch((error) => {
                CrisisError.toast(error, {
                  operation: 'Import project file',
                  fileName: file.name,
                  fileSize: file.size
                });
              })
              .finally(() => resolve());
          }, { once: true });
          input.addEventListener('cancel', () => { cleanup(); resolve(); }, { once: true });
          input.click();
        });
      }

      async function parseProjectFile(file) {
        const isZip = /\.zip$/i.test(file.name || '') || file.type === 'application/zip';
        if (isZip) return await parseProjectZip(file);
        try {
          return JSON.parse(await file.text());
        } catch (error) {
          throw CrisisError.wrap(error, {
            operation: 'Parse project JSON',
            fileName: file.name,
            fileSize: file.size,
            message: tt(`Invalid JSON file: ${error.message}`, `Fichier JSON invalide : ${error.message}`, `Ungültige JSON-Datei: ${error.message}`)
          });
        }
      }

      async function parseProjectZip(file) {
        if (typeof JSZip === 'undefined') {
          throw new Error(tt('ZIP support is not available.', 'Le support ZIP est indisponible.', 'ZIP-Unterstützung ist nicht verfügbar.'));
        }
        let zip;
        try {
          zip = await JSZip.loadAsync(file);
        } catch (error) {
          throw CrisisError.wrap(error, {
            operation: 'Open project ZIP',
            fileName: file.name,
            fileSize: file.size,
            message: tt(`Invalid ZIP file: ${error.message}`, `Fichier ZIP invalide : ${error.message}`, `Ungültige ZIP-Datei: ${error.message}`)
          });
        }

        const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.json$/i.test(entry.name));
        if (!entries.length) {
          throw new Error(tt('No JSON project found in ZIP.', 'Aucun projet JSON trouvé dans le ZIP.', 'Kein JSON-Projekt in der ZIP-Datei gefunden.'));
        }

        const preferred = entries.find((entry) => /\.(crisismaker|crisisstim)\.json$/i.test(entry.name)) || entries[0];
        const imageEntries = Object.values(zip.files).filter((entry) => !entry.dir && /\.(png|jpe?g|webp|gif|svg)$/i.test(entry.name));
        try {
          const raw = await preferred.async('string');
          const parsed = JSON.parse(raw);
          parsed.__zipImport = {
            imageCount: imageEntries.length,
            imageNames: imageEntries.slice(0, 5).map((entry) => entry.name)
          };
          return parsed;
        } catch (error) {
          throw CrisisError.wrap(error, {
            operation: 'Parse JSON inside project ZIP',
            fileName: preferred.name,
            message: tt(`Invalid JSON in ZIP: ${error.message}`, `JSON invalide dans le ZIP : ${error.message}`, `Ungültiges JSON in der ZIP-Datei: ${error.message}`)
          });
        }
      }

      function applyLoadedScenario(data) {
        try {
          const zipImport = data?.__zipImport;
          if (zipImport) delete data.__zipImport;
          // Not a CrisisMaker project (a template, another app's JSON…): refuse instead of
          // filling the gaps with the demo and saving over the current project.
          if (!data || typeof data !== 'object' || Array.isArray(data) || (!Array.isArray(data.stimuli) && !(data.scenario && typeof data.scenario === 'object'))) {
            throw new Error(tt('This file is not a CrisisMaker project.', 'Ce fichier n\'est pas un projet CrisisMaker.', 'Diese Datei ist kein CrisisMaker-Projekt.'));
          }
          const migrated = migrateScenario(data);
          // Pre-sync custom templates so normalizeStimulus can find them during merge,
          // and put the current ones back if the file turns out to be unreadable.
          const previousTemplates = appState.scenario.custom_templates;
          if (Array.isArray(migrated.custom_templates)) {
            appState.scenario.custom_templates = migrated.custom_templates;
          }
          // The interface stays in the language chosen here, whatever the language of the file's author.
          const language = appState.scenario.settings?.language;
          try {
            appState.scenario = mergeScenario(migrated);
            if (language) appState.scenario.settings.language = language;
          } catch (error) {
            appState.scenario.custom_templates = previousTemplates;
            throw error;
          }
          appState.scenario.video_debrief = persistVideoDebriefDraft(appState.scenario.video_debrief);
          appState.videoFiles = makeDefaultVideoFiles(appState.scenario);
          restoreApiKeysFromStorage(appState.scenario.settings);
          appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
          if (appState.checkerState) Object.assign(appState.checkerState, { analysisResult: null, analysisError: null, challengeRestoredFor: null });
          // Restore LLM prompt texts from saved data
          appState.llmState = makeDefaultLLMState();
          restoreLLMPrompts(data.llm_prompts);
          appState.route = 'scenario';
          appState.launchScreenOpen = false;
          saveLocal(false);
          App.render();
          pushToast(tt('Scenario loaded successfully.', 'Scénario chargé avec succès.', 'Szenario erfolgreich geladen.'), 'success');
          if (zipImport?.imageCount) {
            const sample = zipImport.imageNames.length ? ` (${zipImport.imageNames.join(', ')})` : '';
            pushToast(
              tt(
                `${zipImport.imageCount} rendered image(s) found in the ZIP${sample}. Stimulus previews are regenerated from project data after import.`,
                `${zipImport.imageCount} image(s) rendue(s) trouvée(s) dans le ZIP${sample}. Les aperçus sont régénérés à partir des données du projet après import.`,
                `${zipImport.imageCount} gerenderte(s) Bild(er) in der ZIP-Datei gefunden${sample}. Stimulus-Vorschauen werden nach dem Import aus den Projektdaten neu generiert.`
              ),
              'info'
            );
          }
          return true;
        } catch (error) {
          CrisisError.toast(error, { operation: 'Apply imported project data' });
          return false;
        }
      }

      function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

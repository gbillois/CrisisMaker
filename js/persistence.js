
      // Level 1: File System Access API (Chrome/Edge)
      let _fileHandle = null;

      const supportsFileSystemAccess = () => typeof window !== 'undefined' && 'showSaveFilePicker' in window;

      async function saveToFileFirstTime() {
        if (!supportsFileSystemAccess()) return false;
        try {
          _fileHandle = await window.showSaveFilePicker({
            suggestedName: `${slugify(appState.scenario.name || 'crisismaker')}.crisismaker.json`,
            types: [{ description: 'CrisisMaker Project', accept: { 'application/json': ['.crisismaker.json', '.crisisstim.json', '.json'] } }]
          });
          return await writeToFile();
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('File picker error', e);
          return false;
        }
      }

      async function writeToFile() {
        if (!_fileHandle) return false;
        try {
          const exportData = JSON.parse(JSON.stringify(appState.scenario));
          exportData.settings = { ...exportData.settings, ai_api_key: '', azure_api_key: '' }; // never export keys
          const writable = await _fileHandle.createWritable();
          await writable.write(JSON.stringify(exportData, null, 2));
          await writable.close();
          return true;
        } catch (e) {
          console.warn('File write failed', e);
          _fileHandle = null; // handle invalidated
          return false;
        }
      }

      async function openWithFileSystemAPI() {
        if (!supportsFileSystemAccess()) return null;
        try {
          const [handle] = await window.showOpenFilePicker({
            types: [{
              description: 'CrisisMaker Project',
              accept: {
                'application/json': ['.crisismaker.json', '.crisisstim.json', '.json'],
                'application/zip': ['.zip']
              }
            }]
          });
          _fileHandle = handle;
          const file = await handle.getFile();
          return await parseProjectFile(file);
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('File open error', e);
          return null;
        }
      }

      // Level 2: localStorage (always active)
      function saveLocal(showToast = true) {
        try {
          appState.scenario.updated_at = new Date().toISOString();
          const scenarioToSave = JSON.parse(JSON.stringify(appState.scenario));
          scenarioToSave.settings = { ...scenarioToSave.settings, ai_api_key: '', azure_api_key: '' }; // never store keys in project data
          localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarioToSave));
          const settingsToSave = { ...appState.scenario.settings, ai_api_key: '', azure_api_key: '' };
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
          persistProviderSettings(appState.scenario.settings);
          if (showToast) pushToast(tt('Scenario saved locally.', 'Scénario enregistré localement.'), 'success');
        } catch (error) {
          if (error.name === 'QuotaExceededError') {
            pushToast(tt('Browser storage full. Export your project as JSON.', 'Stockage navigateur plein. Exportez votre projet en JSON.'), 'error');
          } else {
            pushToast(tt(`Local save failed: ${error.message}`, `Échec de la sauvegarde locale : ${error.message}`), 'error');
          }
        }
      }

      // Auto-save: calls both localStorage and File System API
      async function autoSave() {
        appState.scenario.updated_at = new Date().toISOString();
        saveLocal(false);
        if (_fileHandle) await writeToFile();
        updateSaveIndicator();
      }

      function updateSaveIndicator() {
        const el = document.getElementById('save-indicator');
        if (!el) return;
        const now = new Date();
        const msg = _fileHandle
          ? tt(`Saved (file + browser)`, `Sauvegardé (fichier + navigateur)`)
          : tt(`Saved (browser)`, `Sauvegardé (navigateur)`);
        el.textContent = msg;
        el.title = now.toLocaleTimeString();
      }

      function startAutoSave() {
        const interval = (appState.scenario?.settings?.auto_save_interval_seconds || 30) * 1000;
        if (interval > 0) setInterval(autoSave, interval);
      }

      function loadProviderSettings() {
        // Clean up legacy separate API key storage
        localStorage.removeItem(PROVIDER_STORAGE_KEYS.azureApiKey);
        localStorage.removeItem('crisisstim_api_key');
        const result = {
          ai_provider: localStorage.getItem(PROVIDER_STORAGE_KEYS.aiProvider) || undefined,
          azure_endpoint: localStorage.getItem(PROVIDER_STORAGE_KEYS.azureEndpoint) || undefined,
          azure_deployment: localStorage.getItem(PROVIDER_STORAGE_KEYS.azureDeployment) || undefined
        };
        // Only include API keys in result if they are actually stored in dedicated keys,
        // otherwise leave them undefined so embedded values in the scenario JSON are preserved
        const apiKey = localStorage.getItem(PROVIDER_STORAGE_KEYS.apiKey);
        if (apiKey) result.ai_api_key = apiKey;
        const azureApiKey = localStorage.getItem(PROVIDER_STORAGE_KEYS.azureApiKeyStore);
        if (azureApiKey) result.azure_api_key = azureApiKey;
        return result;
      }

      function persistProviderSettings(settings) {
        localStorage.setItem(PROVIDER_STORAGE_KEYS.aiProvider, settings.ai_provider || 'anthropic');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.azureEndpoint, settings.azure_endpoint || '');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.azureDeployment, settings.azure_deployment || '');
        // API keys are stored in dedicated keys, separate from project data (never exported in project files)
        if (settings.ai_api_key) {
          localStorage.setItem(PROVIDER_STORAGE_KEYS.apiKey, settings.ai_api_key);
        } else {
          localStorage.removeItem(PROVIDER_STORAGE_KEYS.apiKey);
        }
        if (settings.azure_api_key) {
          localStorage.setItem(PROVIDER_STORAGE_KEYS.azureApiKeyStore, settings.azure_api_key);
        } else {
          localStorage.removeItem(PROVIDER_STORAGE_KEYS.azureApiKeyStore);
        }
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

      const ExportEngine = {
        async exportStimulus(stimulus) {
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
            let dataUrl = await htmlToImage.toPng(element, { quality: 1.0, pixelRatio: 2, backgroundColor: '#FFFFFF' });
            dataUrl = PngMetadata.injectMetadata(dataUrl);
            this.downloadDataUrl(dataUrl, this.filenameForStimulus(stimulus));
            pushToast(tt('Stimulus exported as PNG.', 'Stimulus exporté en PNG.'), 'success');
          } finally {
            if (sandbox) document.body.removeChild(sandbox);
          }
        },
        async exportRawEmail(stimulus) {
          if (!stimulus) throw new Error(tt('No stimulus selected.', 'Aucun stimulus sélectionné.'));
          if (!this.isEmailStimulus(stimulus)) throw new Error(tt('Only email stimuli can be exported as .eml.', 'Seuls les stimuli e-mail peuvent être exportés en .eml.'));
          const content = this.buildRawEmailContent(stimulus);
          const blob = new Blob([content], { type: 'message/rfc822' });
          downloadBlob(blob, this.filenameForRawEmail(stimulus));
          pushToast(tt('Email exported as .eml.', 'E-mail exporté en .eml.'), 'success');
        },
        async exportAll() {
          const zip = new JSZip();
          const stimuli = getSortedStimuli();
          if (!stimuli.length) throw new Error(tt('No stimulus to export.', 'Aucun stimulus à exporter.'));
          const sandbox = document.createElement('div');
          sandbox.style.position = 'fixed';
          sandbox.style.left = '-99999px';
          sandbox.style.top = '0';
          document.body.appendChild(sandbox);
          for (const stimulus of stimuli) {
            sandbox.innerHTML = renderStimulusPreview(stimulus, `zip-${stimulus.id}`);
            const node = sandbox.firstElementChild;
            let dataUrl = await htmlToImage.toPng(node, { quality: 1.0, pixelRatio: 2, backgroundColor: '#FFFFFF' });
            dataUrl = PngMetadata.injectMetadata(dataUrl);
            zip.file(this.filenameForStimulus(stimulus), dataUrl.split(',')[1], { base64: true });
          }
          document.body.removeChild(sandbox);
          const blob = await zip.generateAsync({ type: 'blob' });
          downloadBlob(blob, `crisismaker_${slugify(appState.scenario.name)}_exports.zip`);
          pushToast(tt('ZIP archive generated.', 'Archive ZIP générée.'), 'success');
        },
        filenameForStimulus(stimulus) {
          const actor = getActor(stimulus.actor_id);
          return `${slugify(appState.scenario.name)}_H+${String(Math.floor(stimulus.timestamp_offset_minutes / 60)).padStart(2, '0')}_${stimulus.channel}_${slugify(actor?.name || 'acteur')}.png`;
        },
        filenameForRawEmail(stimulus) {
          const actor = getActor(stimulus.actor_id);
          return `${slugify(appState.scenario.name)}_H+${String(Math.floor(stimulus.timestamp_offset_minutes / 60)).padStart(2, '0')}_${slugify(stimulus.fields.subject || stimulus.channel)}_${slugify(actor?.name || 'actor')}.eml`;
        },
        isEmailStimulus(stimulus) {
          return Boolean(stimulus?.channel && String(stimulus.channel).startsWith('email_'));
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
        }
      };


      async function saveScenarioToFile() {
        const exportData = JSON.parse(JSON.stringify(appState.scenario));
        exportData.settings = { ...exportData.settings, ai_api_key: '', azure_api_key: '' };
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        downloadBlob(blob, `crisismaker_${slugify(appState.scenario.name)}_${new Date().toISOString().slice(0, 10)}.json`);
        pushToast(tt('Scenario exported as JSON.', 'Scénario exporté en JSON.'), 'success');
      }

      async function loadScenarioFromFile() {
        // Try File System Access API first (Chrome/Edge)
        if (supportsFileSystemAccess()) {
          const data = await openWithFileSystemAPI();
          if (!data) return;
          applyLoadedScenario(data);
          return;
        }
        // Fallback: classic file input
        await new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,.crisismaker.json,.crisisstim.json,.zip,application/json,application/zip';
          input.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              resolve();
              return;
            }
            parseProjectFile(file)
              .then((data) => applyLoadedScenario(data))
              .catch((error) => {
                pushToast(tt(`Import failed: ${error.message}`, `Import échoué : ${error.message}`), 'error');
              })
              .finally(() => resolve());
          }, { once: true });
          input.click();
        });
      }

      async function parseProjectFile(file) {
        const isZip = /\.zip$/i.test(file.name || '') || file.type === 'application/zip';
        if (isZip) return await parseProjectZip(file);
        try {
          return JSON.parse(await file.text());
        } catch (error) {
          throw new Error(tt(`Invalid JSON file: ${error.message}`, `Fichier JSON invalide : ${error.message}`));
        }
      }

      async function parseProjectZip(file) {
        if (typeof JSZip === 'undefined') {
          throw new Error(tt('ZIP support is not available.', 'Le support ZIP est indisponible.'));
        }
        let zip;
        try {
          zip = await JSZip.loadAsync(file);
        } catch (error) {
          throw new Error(tt(`Invalid ZIP file: ${error.message}`, `Fichier ZIP invalide : ${error.message}`));
        }

        const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.json$/i.test(entry.name));
        if (!entries.length) {
          throw new Error(tt('No JSON project found in ZIP.', 'Aucun projet JSON trouvé dans le ZIP.'));
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
          throw new Error(tt(`Invalid JSON in ZIP: ${error.message}`, `JSON invalide dans le ZIP : ${error.message}`));
        }
      }

      function applyLoadedScenario(data) {
        try {
          const zipImport = data?.__zipImport;
          if (zipImport) delete data.__zipImport;
          const migrated = migrateScenario(data);
          // Pre-sync custom templates so normalizeStimulus can find them during merge
          if (Array.isArray(migrated.custom_templates)) {
            appState.scenario.custom_templates = migrated.custom_templates;
          }
          appState.scenario = mergeScenario(migrated);
          // restore API keys from dedicated localStorage keys (never stored in project files)
          const savedApiKey = localStorage.getItem(PROVIDER_STORAGE_KEYS.apiKey);
          if (savedApiKey) appState.scenario.settings.ai_api_key = savedApiKey;
          const savedAzureApiKey = localStorage.getItem(PROVIDER_STORAGE_KEYS.azureApiKeyStore);
          if (savedAzureApiKey) appState.scenario.settings.azure_api_key = savedAzureApiKey;
          appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
          appState.route = 'project';
          appState.launchScreenOpen = false;
          App.render();
          pushToast(tt('Scenario loaded successfully.', 'Scénario chargé avec succès.'), 'success');
          if (zipImport?.imageCount) {
            const sample = zipImport.imageNames.length ? ` (${zipImport.imageNames.join(', ')})` : '';
            pushToast(
              tt(
                `${zipImport.imageCount} rendered image(s) found in the ZIP${sample}. Stimulus previews are regenerated from project data after import.`,
                `${zipImport.imageCount} image(s) rendue(s) trouvée(s) dans le ZIP${sample}. Les aperçus sont régénérés à partir des données du projet après import.`
              ),
              'info'
            );
          }
        } catch (error) {
          pushToast(tt(`Load failed: ${error.message}`, `Chargement échoué : ${error.message}`), 'error');
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

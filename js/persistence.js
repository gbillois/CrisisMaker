
      // Level 1: File System Access API (Chrome/Edge)
      let _fileHandle = null;

      const supportsFileSystemAccess = () => typeof window !== 'undefined' && 'showSaveFilePicker' in window;

      async function saveToFileFirstTime() {
        if (!supportsFileSystemAccess()) return false;
        try {
          _fileHandle = await window.showSaveFilePicker({
            suggestedName: `${slugify(appState.scenario.name || 'crisisstim')}.crisisstim.json`,
            types: [{ description: 'CrisisStim Project', accept: { 'application/json': ['.crisisstim.json', '.json'] } }]
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
            types: [{ description: 'CrisisStim Project', accept: { 'application/json': ['.crisisstim.json', '.json'] } }]
          });
          _fileHandle = handle;
          const file = await handle.getFile();
          return JSON.parse(await file.text());
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('File open error', e);
          return null;
        }
      }

      // Level 2: localStorage (always active)
      function saveLocal(showToast = true) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.scenario));
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(appState.scenario.settings));
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
        return {
          ai_provider: localStorage.getItem(PROVIDER_STORAGE_KEYS.aiProvider) || undefined,
          azure_endpoint: localStorage.getItem(PROVIDER_STORAGE_KEYS.azureEndpoint) || undefined,
          azure_api_key: localStorage.getItem(PROVIDER_STORAGE_KEYS.azureApiKey) || undefined,
          azure_deployment: localStorage.getItem(PROVIDER_STORAGE_KEYS.azureDeployment) || undefined
        };
      }

      function persistProviderSettings(settings) {
        localStorage.setItem(PROVIDER_STORAGE_KEYS.aiProvider, settings.ai_provider || 'anthropic');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.azureEndpoint, settings.azure_endpoint || '');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.azureApiKey, settings.azure_api_key || '');
        localStorage.setItem(PROVIDER_STORAGE_KEYS.azureDeployment, settings.azure_deployment || '');
      }


      const ExportEngine = {
        async exportStimulus(stimulus) {
          const element = document.getElementById(`render-${stimulus.id}`) || document.getElementById('fullscreen-preview');
          if (!element) throw new Error(tt('No rendered stimulus is available to export.', 'Aucun rendu disponible à exporter.'));
          const dataUrl = await htmlToImage.toPng(element, { quality: 1.0, pixelRatio: 2, backgroundColor: '#FFFFFF' });
          this.downloadDataUrl(dataUrl, this.filenameForStimulus(stimulus));
          pushToast(tt('Stimulus exported as PNG.', 'Stimulus exporté en PNG.'), 'success');
        },
        async exportRawEmail(stimulus) {
          if (!stimulus) throw new Error(tt('No stimulus selected.', 'Aucun stimulus sélectionné.'));
          if (!this.isEmailStimulus(stimulus)) throw new Error(tt('Only email stimuli can be exported as .msg.', 'Seuls les stimuli e-mail peuvent être exportés en .msg.'));
          const content = this.buildRawEmailContent(stimulus);
          const blob = new Blob([content], { type: 'application/vnd.ms-outlook' });
          downloadBlob(blob, this.filenameForRawEmail(stimulus));
          pushToast(tt('Email exported as .msg.', 'E-mail exporté en .msg.'), 'success');
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
            const dataUrl = await htmlToImage.toPng(node, { quality: 1.0, pixelRatio: 2, backgroundColor: '#FFFFFF' });
            zip.file(this.filenameForStimulus(stimulus), dataUrl.split(',')[1], { base64: true });
          }
          document.body.removeChild(sandbox);
          const blob = await zip.generateAsync({ type: 'blob' });
          downloadBlob(blob, `crisisstim_${slugify(appState.scenario.name)}_exports.zip`);
          pushToast(tt('ZIP archive generated.', 'Archive ZIP générée.'), 'success');
        },
        filenameForStimulus(stimulus) {
          const actor = getActor(stimulus.actor_id);
          return `${slugify(appState.scenario.name)}_H+${String(Math.floor(stimulus.timestamp_offset_minutes / 60)).padStart(2, '0')}_${stimulus.channel}_${slugify(actor?.name || 'acteur')}.png`;
        },
        filenameForRawEmail(stimulus) {
          const actor = getActor(stimulus.actor_id);
          return `${slugify(appState.scenario.name)}_H+${String(Math.floor(stimulus.timestamp_offset_minutes / 60)).padStart(2, '0')}_${slugify(stimulus.fields.subject || stimulus.channel)}_${slugify(actor?.name || 'actor')}.msg`;
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
          const body = this.normalizeEmailBody(fields.body || '');
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


      function saveScenarioToFile() {
        const json = JSON.stringify(appState.scenario, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        downloadBlob(blob, `crisisstim_${slugify(appState.scenario.name)}_${new Date().toISOString().slice(0, 10)}.json`);
        pushToast(tt('Scenario exported as JSON.', 'Scénario exporté en JSON.'), 'success');
      }

      function loadScenarioFromFile() {
        // Try File System Access API first (Chrome/Edge)
        if (supportsFileSystemAccess()) {
          openWithFileSystemAPI().then((data) => {
            if (!data) return;
            applyLoadedScenario(data);
          });
          return;
        }
        // Fallback: classic file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.crisisstim.json,application/json';
        input.addEventListener('change', (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            try {
              applyLoadedScenario(JSON.parse(loadEvent.target.result));
            } catch (error) {
              pushToast(tt(`Invalid JSON file: ${error.message}`, `Fichier JSON invalide : ${error.message}`), 'error');
            }
          };
          reader.readAsText(file);
        });
        input.click();
      }

      function applyLoadedScenario(data) {
        try {
          appState.scenario = mergeScenario(migrateScenario(data));
          // restore API key from localStorage (never stored in file)
          const savedApiKey = localStorage.getItem('crisisstim_api_key');
          if (savedApiKey && !appState.scenario.settings.ai_api_key) {
            appState.scenario.settings.ai_api_key = savedApiKey;
          }
          appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
          appState.route = 'project';
          App.render();
          pushToast(tt('Scenario loaded successfully.', 'Scénario chargé avec succès.'), 'success');
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


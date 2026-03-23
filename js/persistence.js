
      function saveLocal(showToast = true) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.scenario));
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(appState.scenario.settings));
          persistProviderSettings(appState.scenario.settings);
          if (showToast) pushToast(tt('Scenario saved locally.', 'Scénario enregistré localement.'), 'success');
        } catch (error) {
          pushToast(tt(`Local save failed: ${error.message}`, `Échec de la sauvegarde locale : ${error.message}`), 'error');
        }
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
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            try {
              appState.scenario = mergeScenario(JSON.parse(loadEvent.target.result));
              appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
              App.render();
              pushToast(tt('Scenario loaded successfully.', 'Scénario chargé avec succès.'), 'success');
            } catch (error) {
              pushToast(tt(`Invalid JSON file: ${error.message}`, `Fichier JSON invalide : ${error.message}`), 'error');
            }
          };
          reader.readAsText(file);
        });
        input.click();
      }

      function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }


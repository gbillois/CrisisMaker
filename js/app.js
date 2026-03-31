      const appState = {
        route: 'project',
        selectedStimulusId: null,
        stimulusModalId: null,
        slideshowIndex: 0,
        settingsDrawerOpen: false,
        launchScreenOpen: true,
        scenario: loadInitialScenario(),
        toasts: [],
        videoFiles: {},  // stimulusId → { objectUrl, fileName } — in-memory only, never persisted
        audioFiles: {},  // stimulusId → { objectUrl, fileName, blob } — in-memory only, never persisted
        libraryFilter: { channel: '', status: '', actorId: '', sort: 'timeline' },
        historyModalStimulusId: null,
        libraryExpandedId: null,
        llmState: makeDefaultLLMState(),
        ui: {
          stimuliTimelineHeight: 255,
          stimuliEditorWidth: 42,
          stimulusModalEditorWidth: 50,
          timelineZoom: 1.0,
          actionLoading: {}
        },
        connectionTest: { status: 'idle', message: '', checkedAt: null, provider: '' },
        chronogramImportAutonomy: 'mostly_autonomous',
        chronogramImport: null,
        checkerState: {
          mode: 'file',
          file: null,
          parsedData: null,
          sheets: [],
          selectedSheet: '',
          columnMapping: {},
          columnMappingLoading: false,
          analysisResult: null,
          analysisLoading: false,
          analysisError: null,
          llmLogs: [],
          checklist: {},
          activeAxisTab: 0
        }
      };

      const App = {
        init() {
          this.bindBeforeUnload();
          this.startAutosave();
          this.render();
        },
        bindBeforeUnload() {
          window.addEventListener('beforeunload', () => saveLocal());
        },
        startAutosave() {
          startAutoSave();
        },
        render() {
          const root = document.getElementById('app');
          setDocumentLanguage();
          // Load HD fonts if needed
          if (appState.scenario.settings.template_quality === 'hd') ensureHDFonts();
          // Sync custom template channels into CHANNEL_META
          (appState.scenario.custom_templates || []).forEach(tpl => {
            if (tpl.template_id && !CHANNEL_META[tpl.template_id]) {
              CHANNEL_META[tpl.template_id] = { label: tpl.name || tpl.label || tpl.template_id, color: tpl.color || '#8B5CF6', category: tpl.category || 'Custom' };
            }
          });
          root.innerHTML = renderAppShell();
          bindGlobalEvents();
          bindCheckerEvents();
          bindStimuliSplitters();
          bindStimulusModalSplitter();
          renderToasts();
        }
      };

      function ensureHDFonts() {
        // All fonts (including HD variants) are now bundled locally in fonts/fonts.css
        // No additional loading needed - all weights and styles are included offline
      }

      async function importCustomTemplate() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.crisistemplate.json,.json';
        input.style.display = 'none';
        document.body.appendChild(input);
        const cleanup = () => { if (input.parentNode) input.remove(); };
        return new Promise((resolve) => {
          input.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            cleanup();
            if (!file) { resolve(); return; }
            if (file.size > 2 * 1024 * 1024) {
              pushToast(tt('Template file too large (max 2 MB).', 'Fichier template trop volumineux (max 2 Mo).', 'Vorlagendatei zu groß (max. 2 MB).'), 'error');
              resolve(); return;
            }
            try {
              const text = await file.text();
              const data = JSON.parse(text);
              // Normalize label field
              if (!data.label && data.name) data.label = data.name;
              if (!data.name && data.label) data.name = data.label;
              // Build defaults from fields if not provided
              if (!data.defaults && Array.isArray(data.fields)) {
                data.defaults = {};
                data.fields.forEach(f => { if (f.placeholder) data.defaults[f.name || f.key] = f.placeholder; });
              }
              // Normalize field keys (spec uses "name", internal uses "key")
              if (Array.isArray(data.fields)) {
                data.fields = data.fields.map(f => ({
                  key: f.key || f.name,
                  label: f.label || f.name || f.key,
                  type: f.type === 'html' ? 'textarea' : (f.type || 'text'),
                  required: f.required || false
                }));
              }
              const errors = validateCustomTemplate(data);
              if (errors.length) {
                pushToast(errors.join(' '), 'error');
                resolve(); return;
              }
              const existing = appState.scenario.custom_templates || [];
              if (existing.some(t => t.template_id === data.template_id)) {
                pushToast(tt(`A custom template with id "${data.template_id}" already exists. Remove it first.`, `Un template personnalisé avec l'id "${data.template_id}" existe déjà. Supprimez-le d'abord.`, `Eine benutzerdefinierte Vorlage mit der ID "${data.template_id}" existiert bereits. Bitte zuerst entfernen.`), 'error');
                resolve(); return;
              }
              appState.scenario.custom_templates = [...existing, data];
              saveLocal();
              App.render();
              pushToast(tt(`Template "${data.name || data.label}" imported.`, `Template "${data.name || data.label}" importé.`, `Vorlage „${data.name || data.label}" importiert.`), 'success');
            } catch (err) {
              pushToast(tt(`Import failed: ${err.message}`, `Import échoué : ${err.message}`, `Import fehlgeschlagen: ${err.message}`), 'error');
            }
            resolve();
          }, { once: true });
          input.addEventListener('cancel', () => { cleanup(); resolve(); }, { once: true });
          input.click();
        });
      }

      function bindGlobalEvents() {
        document.querySelectorAll('[data-route]').forEach((button) => {
          button.addEventListener('click', () => {
            appState.route = button.dataset.route;
            App.render();
          });
        });

        document.querySelectorAll('[data-bind]').forEach((input) => {
          input.addEventListener('change', () => {
            let val = input.value;
            if (input.dataset.bind === 'settings.watermark_enabled' || input.dataset.bind === 'settings.watermark_audio_enabled') val = (val === 'true');
            else if (input.dataset.bind === 'settings.watermark_opacity' || input.dataset.bind === 'settings.watermark_rotation' || input.dataset.bind === 'settings.watermark_text_size') val = Number(val);
            setByPath(appState.scenario, input.dataset.bind, val);
            if (input.dataset.bind === 'settings.ai_provider') {
              const models = DEFAULT_MODELS[input.value];
              if (models?.length) appState.scenario.settings.ai_model = models[0];
            }
            if (input.dataset.bind === 'settings.template_quality' && input.value === 'hd') {
              ensureHDFonts();
            }
            if (input.dataset.bind.startsWith('settings.')) {
              appState.connectionTest = { status: 'idle', message: '', checkedAt: null, provider: '' };
            }
            persistProviderSettings(appState.scenario.settings);
            App.render();
          });
        });

        document.querySelectorAll('[data-actor-bind]').forEach((input) => {
          input.addEventListener('change', () => {
            const [actorId, ...pathParts] = input.dataset.actorBind.split('.');
            const actor = getActor(actorId);
            if (!actor) return;
            actor[pathParts.join('.')] = input.value;
            if (pathParts.join('.') === 'name') actor.avatar_initials = initialsFromName(input.value);
            App.render();
          });
        });

        document.querySelectorAll('[data-stimulus-bind]').forEach((input) => {
          input.addEventListener('change', () => {
            const [stimulusId, property] = input.dataset.stimulusBind.split('.');
            const stimulus = getStimulus(stimulusId);
            if (!stimulus) return;
            if (property === 'timestamp_offset_minutes') stimulus.timestamp_offset_minutes = Number(input.value);
            else if (property === 'channel') replaceStimulusTemplate(stimulus, input.value);
            else if (property === 'template_id') replaceArticleVariant(stimulus, input.value);
            else stimulus[property] = input.value;
            App.render();
          });
        });

        document.querySelectorAll('[data-stimulus-field]').forEach((input) => {
          const eventName = input.tagName === 'TEXTAREA' || input.type === 'text' ? 'input' : 'change';
          input.addEventListener(eventName, () => {
            const [stimulusId, fieldName] = input.dataset.stimulusField.split('.');
            const stimulus = getStimulus(stimulusId);
            if (!stimulus) return;
            let value = input.value;
            if (input.tagName === 'TEXTAREA' && fieldName === 'reaction_types') {
              try { value = JSON.parse(value); } catch { value = value.split(',').map((item) => item.trim()).filter(Boolean); }
            }
            if (input.tagName === 'TEXTAREA' && fieldName === 'awards') {
              try { value = JSON.parse(value); } catch { value = value.split(',').map((item) => item.trim()).filter(Boolean); }
            }
            if (input.tagName === 'TEXTAREA' && fieldName === 'top_comment') {
              try { value = JSON.parse(value); } catch { value = { text: value }; }
            }
            if (String(value) === 'true') value = true;
            if (String(value) === 'false') value = false;
            if (input.type === 'number') value = Number(value);
            stimulus.fields[fieldName] = value;
            stimulus.manual_overrides[fieldName] = value;
            const previewHost = document.querySelector('.preview-stage');
            if (previewHost) previewHost.innerHTML = renderStimulusPreview(stimulus);
          });
        });

        document.querySelectorAll('[data-stimulus-photo]').forEach((input) => {
          input.addEventListener('change', () => {
            const [stimulusId, fieldName] = input.dataset.stimulusPhoto.split('.');
            const stimulus = getStimulus(stimulusId);
            if (!stimulus || !input.files?.[0]) return;
            const reader = new FileReader();
            reader.onload = (e) => {
              stimulus.fields[fieldName] = e.target.result;
              stimulus.manual_overrides[fieldName] = e.target.result;
              App.render();
            };
            reader.readAsDataURL(input.files[0]);
          });
        });

        // Video file picker for breaking_news_tv — stored in-memory only
        document.querySelectorAll('[data-stimulus-video]').forEach((input) => {
          input.addEventListener('change', () => {
            const stimulusId = input.dataset.stimulusVideo;
            const stimulus = getStimulus(stimulusId);
            if (!stimulus || !input.files?.[0]) return;
            // Revoke previous blob URL to avoid memory leaks
            if (appState.videoFiles[stimulusId]?.objectUrl) {
              URL.revokeObjectURL(appState.videoFiles[stimulusId].objectUrl);
            }
            const file = input.files[0];
            appState.videoFiles[stimulusId] = {
              objectUrl: URL.createObjectURL(file),
              fileName: file.name
            };
            App.render();
          });
        });

        // Audio file picker for audio_message — stored in-memory only
        document.querySelectorAll('[data-stimulus-audio]').forEach((input) => {
          input.addEventListener('change', () => {
            const stimulusId = input.dataset.stimulusAudio;
            const stimulus = getStimulus(stimulusId);
            if (!stimulus || !input.files?.[0]) return;
            if (appState.audioFiles[stimulusId]?.objectUrl) {
              URL.revokeObjectURL(appState.audioFiles[stimulusId].objectUrl);
            }
            const file = input.files[0];
            const blob = file;
            appState.audioFiles[stimulusId] = {
              objectUrl: URL.createObjectURL(file),
              fileName: file.name,
              blob
            };
            stimulus.fields.duration = '';
            // Try to read duration
            const tempAudio = new Audio(appState.audioFiles[stimulusId].objectUrl);
            tempAudio.addEventListener('loadedmetadata', () => {
              if (isFinite(tempAudio.duration)) {
                const mins = Math.floor(tempAudio.duration / 60);
                const secs = Math.floor(tempAudio.duration % 60);
                stimulus.fields.duration = `${mins}:${String(secs).padStart(2, '0')}`;
                App.render();
              }
            });
            App.render();
          });
        });

        document.querySelectorAll('[data-stimulus-watermark]').forEach((input) => {
          input.addEventListener('change', () => {
            const [stimulusId, prop] = input.dataset.stimulusWatermark.split('.');
            const stimulus = getStimulus(stimulusId);
            if (!stimulus) return;
            if (prop === 'override') {
              if (input.value === 'true') {
                const settings = appState.scenario.settings || {};
                stimulus.watermark = {
                  enabled: settings.watermark_enabled !== false,
                  text: settings.watermark_text || 'EXERCISE EXERCISE EXERCISE',
                  text_size: settings.watermark_text_size ?? 16,
                  position_v: settings.watermark_position_v || 'top',
                  position_h: settings.watermark_position_h || 'center',
                  opacity: settings.watermark_opacity ?? 50,
                  rotation: settings.watermark_rotation ?? 0
                };
              } else {
                stimulus.watermark = null;
              }
            } else if (stimulus.watermark) {
              let val = input.value;
              if (prop === 'enabled') val = (val === 'true');
              else if (prop === 'opacity' || prop === 'rotation' || prop === 'text_size') val = Number(val);
              stimulus.watermark[prop] = val;
            }
            App.render();
          });
        });

        document.querySelectorAll('[data-llm-zone]').forEach((textarea) => {
          textarea.addEventListener('input', () => {
            appState.llmState[textarea.dataset.llmZone].text = textarea.value;
          });
        });

        document.querySelectorAll('[data-action]').forEach((button) => {
          button.addEventListener('click', handleAction);
        });

        document.querySelectorAll('[data-library-filter]').forEach((select) => {
          select.addEventListener('change', () => {
            appState.libraryFilter[select.dataset.libraryFilter] = select.value;
            App.render();
          });
        });
      }

      function makeDefaultLLMState() {
        return {
          scenario:      { text: '', collapsed: false, loading: false, error: null, lastFilledCount: 0 },
          actors:        { text: '', collapsed: false, loading: false, error: null, pendingActors: null },
          stimulus:      { text: '', collapsed: false, loading: false, error: null, lastFilledCount: 0 },
          stimuli_batch: { text: '', collapsed: false, loading: false, error: null, lastFilledCount: 0 }
        };
      }

      function confirmClearData() {
        return window.confirm(tt(
          'Clear all current scenario data? This will remove actors, stimuli, and browser autosave for this project.',
          'Effacer toutes les données du scénario en cours ? Cela supprimera les acteurs, les stimuli et la sauvegarde navigateur de ce projet.',
          'Alle aktuellen Szenariodaten löschen? Dadurch werden Akteure, Stimuli und die Browser-Autospeicherung für dieses Projekt entfernt.'
        ));
      }

      function clearScenarioData() {
        const preservedSettings = { ...appState.scenario.settings };
        appState.scenario = emptyScenario(preservedSettings);
        appState.selectedStimulusId = null;
        appState.slideshowIndex = 0;
        appState.historyModalStimulusId = null;
        appState.libraryExpandedId = null;
        appState.libraryFilter = { channel: '', status: '', actorId: '', sort: 'timeline' };
        appState.llmState = makeDefaultLLMState();
        _fileHandle = null;
        saveLocal(false);
        App.render();
        pushToast(tt('Scenario data cleared.', 'Données du scénario effacées.', 'Szenariodaten gelöscht.'), 'success');
      }

      async function handleAction(event) {
        const action = event.currentTarget.dataset.action;
        try {
          switch (action) {
            case 'show-launch-screen':
              appState.launchScreenOpen = true;
              App.render();
              break;
            case 'close-launch-screen':
              appState.launchScreenOpen = false;
              App.render();
              break;
            case 'toggle-settings-drawer':
              appState.settingsDrawerOpen = !appState.settingsDrawerOpen;
              App.render();
              break;
            case 'toggle-confidentiality-acknowledged': {
              appState.scenario.settings.confidentiality_acknowledged = event.currentTarget.checked;
              persistProviderSettings(appState.scenario.settings);
              App.render();
              break;
            }
            case 'toggle-api-key': {
              const input = document.getElementById('api-key-input');
              input.type = input.type === 'password' ? 'text' : 'password';
              break;
            }
            case 'toggle-azure-speech-key': {
              const input = document.getElementById('azure-speech-key-input');
              if (input) input.type = input.type === 'password' ? 'text' : 'password';
              break;
            }
            case 'save-local': saveLocal(); break;
            case 'save-file': {
              if (_fileHandle) {
                await writeToFile();
                pushToast(tt('Saved to file.', 'Sauvegardé dans le fichier.', 'In Datei gespeichert.'), 'success');
              } else {
                await saveToFileFirstTime();
                App.render();
              }
              break;
            }
            case 'nav-scenario': appState.route = 'scenario'; App.render(); break;
            case 'nav-stimuli': appState.route = 'stimuli'; App.render(); break;
            case 'nav-library': appState.route = 'library'; App.render(); break;
            case 'new-scenario': {
              appState.scenario = emptyScenario();
              appState.selectedStimulusId = null;
              appState.route = 'project';
              appState.launchScreenOpen = false;
              App.render();
              pushToast(tt('New scenario initialized.', 'Nouveau scénario initialisé.', 'Neues Szenario initialisiert.'), 'success');
              break;
            }
            case 'load-example': {
              appState.scenario = defaultScenario();
              appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
              appState.route = 'project';
              appState.launchScreenOpen = false;
              App.render();
              pushToast(tt('Example scenario loaded.', 'Scénario exemple chargé.', 'Beispielszenario geladen.'), 'success');
              break;
            }
            case 'save-json':
              await withActionProgress(action, async () => {
                await saveScenarioToFile();
              });
              break;
            case 'load-json':
              await loadScenarioFromFile();
              break;
            case 'export-all':
              await withActionProgress(action, async () => {
                await ExportEngine.exportAll();
              });
              break;
            case 'import-custom-template':
              await importCustomTemplate();
              break;
            case 'delete-custom-template': {
              const tplId = event.currentTarget.dataset.templateId;
              appState.scenario.custom_templates = (appState.scenario.custom_templates || []).filter(t => t.template_id !== tplId);
              delete CHANNEL_META[tplId];
              saveLocal();
              App.render();
              pushToast(tt('Custom template removed.', 'Template personnalisé supprimé.', 'Benutzerdefinierte Vorlage entfernt.'), 'success');
              break;
            }
            case 'clear-data':
              if (confirmClearData()) clearScenarioData();
              break;
            case 'checker-set-mode': {
              const newMode = event.currentTarget.dataset.mode;
              if (newMode && appState.checkerState.mode !== newMode) {
                appState.checkerState.mode = newMode;
                appState.checkerState.analysisResult = null;
                appState.checkerState.analysisError = null;
                appState.checkerState.llmLogs = [];
                App.render();
              }
              break;
            }
            case 'checker-clear-file':
              checkerClearFile();
              break;
            case 'checker-analyze':
              checkerRunAnalysis();
              break;
            case 'checker-toggle-llm-stream':
              appState.checkerState.showLLMStream = !appState.checkerState.showLLMStream;
              App.render();
              break;
            case 'checker-select-axis': {
              const idx = parseInt(event.currentTarget.dataset.axisIndex, 10);
              if (!isNaN(idx)) { appState.checkerState.activeAxisTab = idx; App.render(); }
              break;
            }
            case 'checker-export-report':
              checkerExportReport();
              break;
            case 'checker-export-report-docx':
              checkerExportReportDocx();
              break;
            case 'test-connection': {
              const provider = appState.scenario.settings.ai_provider;
              appState.connectionTest = {
                status: 'testing',
                message: tt('Checking the AI connection…', 'Vérification de la connexion IA…', 'KI-Verbindung wird geprüft…'),
                checkedAt: null,
                provider
              };
              App.render();
              try {
                const result = await AITextGenerator.testConnection();
                appState.connectionTest = {
                  status: 'success',
                  message: result?.message || tt('Connection confirmed. The provider returned a valid response.', 'Connexion confirmée. Le fournisseur a renvoyé une réponse valide.', 'Verbindung bestätigt. Der Anbieter hat eine gültige Antwort zurückgegeben.'),
                  checkedAt: new Date().toISOString(),
                  provider
                };
                App.render();
                pushToast(tt('AI connection validated.', 'Connexion IA validée.', 'KI-Verbindung validiert.'), 'success');
              } catch (error) {
                appState.connectionTest = {
                  status: 'error',
                  message: error.message || tt('The AI connection test failed.', 'Le test de connexion IA a échoué.', 'Der KI-Verbindungstest ist fehlgeschlagen.'),
                  checkedAt: new Date().toISOString(),
                  provider
                };
                App.render();
                throw error;
              }
              break;
            }
            case 'add-actor': addActor(); break;
            case 'duplicate-actor': duplicateActor(event.currentTarget.dataset.actorId); break;
            case 'delete-actor': deleteActor(event.currentTarget.dataset.actorId); break;
            case 'generate-sample-actors': generateSampleActors(); break;
            case 'add-stimulus': addStimulus(); break;
            case 'select-stimulus': {
              const sid = event.currentTarget.dataset.stimulusId;
              appState.selectedStimulusId = sid;
              appState.stimulusModalId = sid;
              App.render();
              break;
            }
            case 'open-stimulus-modal': {
              appState.stimulusModalId = event.currentTarget.dataset.stimulusId;
              App.render();
              break;
            }
            case 'close-stimulus-modal': {
              appState.stimulusModalId = null;
              appState.ui.mobilePreviewVisible = false;
              App.render();
              break;
            }
            case 'toggle-mobile-preview': {
              appState.ui.mobilePreviewVisible = !appState.ui.mobilePreviewVisible;
              App.render();
              break;
            }
            case 'clear-stimulus-content': {
              const s = getStimulus(event.currentTarget.dataset.stimulusId);
              if (s) {
                const tpl = getTemplateDefinition(s);
                s.fields = deepClone(tpl.defaults);
                s.generated_text = {};
                s.manual_overrides = {};
                await autoSave();
                App.render();
              }
              break;
            }
            case 'clear-photo': {
              const s = getStimulus(event.currentTarget.dataset.stimulusId);
              if (s) {
                const fieldName = event.currentTarget.dataset.fieldName;
                s.fields[fieldName] = '';
                s.manual_overrides[fieldName] = '';
                App.render();
              }
              break;
            }
            case 'clear-video': {
              const sid = event.currentTarget.dataset.stimulusId;
              if (appState.videoFiles[sid]?.objectUrl) {
                URL.revokeObjectURL(appState.videoFiles[sid].objectUrl);
              }
              delete appState.videoFiles[sid];
              App.render();
              break;
            }
            case 'export-video':
              await withActionProgress(action, async () => {
                await ExportEngine.exportVideo(getStimulus(event.currentTarget.dataset.stimulusId));
              });
              break;
            case 'generate-tts':
              await withActionProgress(action, async () => {
                await generateTTS(event.currentTarget.dataset.stimulusId);
              });
              break;
            case 'play-audio': {
              const audioInfo = appState.audioFiles?.[event.currentTarget.dataset.stimulusId];
              if (audioInfo?.objectUrl) {
                if (window._crisismakerAudioPlayer) { window._crisismakerAudioPlayer.pause(); }
                window._crisismakerAudioPlayer = new Audio(audioInfo.objectUrl);
                window._crisismakerAudioPlayer.play();
              }
              break;
            }
            case 'stop-audio': {
              if (window._crisismakerAudioPlayer) { window._crisismakerAudioPlayer.pause(); }
              break;
            }
            case 'rewind-audio': {
              if (window._crisismakerAudioPlayer) { window._crisismakerAudioPlayer.currentTime = 0; }
              break;
            }
            case 'clear-audio': {
              const sid = event.currentTarget.dataset.stimulusId;
              if (appState.audioFiles[sid]?.objectUrl) {
                URL.revokeObjectURL(appState.audioFiles[sid].objectUrl);
              }
              delete appState.audioFiles[sid];
              App.render();
              break;
            }
            case 'export-audio':
              await ExportEngine.exportAudio(getStimulus(event.currentTarget.dataset.stimulusId));
              break;
            case 'duplicate-stimulus': duplicateStimulus(event.currentTarget.dataset.stimulusId); break;
            case 'delete-stimulus': deleteStimulus(event.currentTarget.dataset.stimulusId, event.currentTarget.dataset.confirm === 'true'); break;
            case 'move-stimulus-up': {
              const sorted = getSortedStimuli();
              const idx = sorted.findIndex(s => s.id === event.currentTarget.dataset.stimulusId);
              if (idx > 0) {
                const current = getStimulus(sorted[idx].id);
                const above = getStimulus(sorted[idx - 1].id);
                const tempTime = current.timestamp_offset_minutes;
                current.timestamp_offset_minutes = above.timestamp_offset_minutes;
                above.timestamp_offset_minutes = tempTime;
                await autoSave(); App.render();
              }
              break;
            }
            case 'move-stimulus-down': {
              const sorted = getSortedStimuli();
              const idx = sorted.findIndex(s => s.id === event.currentTarget.dataset.stimulusId);
              if (idx >= 0 && idx < sorted.length - 1) {
                const current = getStimulus(sorted[idx].id);
                const below = getStimulus(sorted[idx + 1].id);
                const tempTime = current.timestamp_offset_minutes;
                current.timestamp_offset_minutes = below.timestamp_offset_minutes;
                below.timestamp_offset_minutes = tempTime;
                await autoSave(); App.render();
              }
              break;
            }
            case 'timeline-zoom-in': appState.ui.timelineZoom = Math.min(3.0, (appState.ui.timelineZoom || 1.0) + 0.25); App.render(); break;
            case 'timeline-zoom-out': appState.ui.timelineZoom = Math.max(0.5, (appState.ui.timelineZoom || 1.0) - 0.25); App.render(); break;
            case 'expand-library-card': {
              const sid = event.currentTarget.dataset.stimulusId;
              appState.libraryExpandedId = appState.libraryExpandedId === sid ? null : sid;
              App.render();
              break;
            }
            case 'generate-stimulus': await generateStimulus(event.currentTarget.dataset.stimulusId); break;
            case 'generate-field': await generateStimulus(event.currentTarget.dataset.stimulusId, event.currentTarget.dataset.fieldName); break;
            case 'export-png':
              await withActionProgress(action, async () => {
                await ExportEngine.exportStimulus(getStimulus(event.currentTarget.dataset.stimulusId));
              });
              break;
            case 'export-msg': await ExportEngine.exportRawEmail(getStimulus(event.currentTarget.dataset.stimulusId)); break;
            case 'preview-prev': appState.slideshowIndex = Math.max(0, appState.slideshowIndex - 1); App.render(); break;
            case 'preview-next': appState.slideshowIndex = Math.min(getSortedStimuli().length - 1, appState.slideshowIndex + 1); App.render(); break;
            case 'goto-stimuli': appState.selectedStimulusId = event.currentTarget.dataset.stimulusId; appState.route = 'stimuli'; App.render(); break;
            case 'preview-select': appState.slideshowIndex = Number(event.currentTarget.dataset.index); App.render(); break;
            case 'cycle-status': {
              const s = getStimulus(event.currentTarget.dataset.stimulusId);
              if (s) { const cycle = ['draft', 'ready', 'sent']; s.status = cycle[(cycle.indexOf(s.status) + 1) % cycle.length]; await autoSave(); App.render(); }
              break;
            }
            case 'edit-in-stimuli': appState.selectedStimulusId = event.currentTarget.dataset.stimulusId; appState.route = 'stimuli'; App.render(); break;
            case 'show-history': {
              appState.historyModalStimulusId = event.currentTarget.dataset.stimulusId;
              App.render();
              break;
            }
            case 'close-history': {
              appState.historyModalStimulusId = null;
              App.render();
              break;
            }
            case 'restore-version': {
              const s = getStimulus(event.currentTarget.dataset.stimulusId);
              if (s) { restoreVersion(s, Number(event.currentTarget.dataset.versionIndex)); await autoSave(); App.render(); }
              break;
            }
            case 'llm-collapse': {
              const zone = event.currentTarget.dataset.zone;
              appState.llmState[zone].collapsed = !appState.llmState[zone].collapsed;
              App.render();
              break;
            }
            case 'llm-clear': {
              const zone = event.currentTarget.dataset.zone;
              appState.llmState[zone].text = '';
              appState.llmState[zone].error = null;
              appState.llmState[zone].lastFilledCount = 0;
              if (zone === 'actors') appState.llmState.actors.pendingActors = null;
              App.render();
              break;
            }
            case 'llm-dismiss-banner': {
              const zone = event.currentTarget.dataset.zone;
              appState.llmState[zone].lastFilledCount = 0;
              App.render();
              break;
            }
            case 'llm-generate-scenario': {
              const state = appState.llmState.scenario;
              if (!state.text.trim()) { state.error = 'empty'; App.render(); break; }
              state.loading = true; state.error = null; state.lastFilledCount = 0; App.render();
              try {
                const result = await AITextGenerator.generateScenario(state.text);
                let filled = 0;
                if (result.client) {
                  if (result.client.name) { appState.scenario.client.name = result.client.name; filled++; }
                  if (result.client.sector) { appState.scenario.client.sector = result.client.sector; filled++; }
                  if (result.client.language) { appState.scenario.client.language = result.client.language; filled++; }
                }
                if (result.scenario) {
                  if (result.scenario.type) { appState.scenario.scenario.type = result.scenario.type; filled++; }
                  if (result.scenario.summary) { appState.scenario.scenario.summary = result.scenario.summary; filled++; }
                  if (result.scenario.detailed_context) { appState.scenario.scenario.detailed_context = result.scenario.detailed_context; filled++; }
                  if (result.scenario.start_date) { appState.scenario.scenario.start_date = result.scenario.start_date.slice(0, 16); filled++; }
                  if (result.scenario.timezone) { appState.scenario.scenario.timezone = result.scenario.timezone; filled++; }
                }
                state.loading = false;
                state.lastFilledCount = filled;
                App.render();
                highlightLLMFields(['client.name', 'client.sector', 'client.language', 'scenario.type', 'scenario.summary', 'scenario.detailed_context', 'scenario.start_date', 'scenario.timezone']);
              } catch (err) {
                state.loading = false;
                state.error = classifyLLMError(err);
                App.render();
              }
              break;
            }
            case 'llm-generate-actors': {
              const state = appState.llmState.actors;
              if (!state.text.trim()) { state.error = 'empty'; App.render(); break; }
              state.loading = true; state.error = null; state.pendingActors = null; App.render();
              try {
                const result = await AITextGenerator.generateActors(state.text, appState.scenario);
                const actors = Array.isArray(result) ? result : (result.actors || []);
                state.loading = false;
                state.pendingActors = actors;
                App.render();
              } catch (err) {
                state.loading = false;
                state.error = classifyLLMError(err);
                App.render();
              }
              break;
            }
            case 'llm-generate-stimulus': {
              const state = appState.llmState.stimulus;
              const selected = getStimulus(appState.stimulusModalId) || getSelectedStimulus();
              if (!selected) break;
              if (!state.text.trim()) { state.error = 'empty'; App.render(); break; }
              state.loading = true; state.error = null; state.lastFilledCount = 0; App.render();
              try {
                const result = await AITextGenerator.generateStimulusConfig(state.text, appState.scenario, appState.scenario.actors);
                const multiple = Array.isArray(result) ? result : (Array.isArray(result?.stimuli) ? result.stimuli : null);
                if (multiple) {
                  await handleMultiStimulusResult(multiple, state.text);
                  state.lastFilledCount = multiple.length;
                } else {
                  await applyStimulusConfig(selected, result);
                  const filled = Object.keys(result.fields || {}).length + 3;
                  state.lastFilledCount = filled;
                }
                state.loading = false;
                App.render();
              } catch (err) {
                state.loading = false;
                state.error = classifyLLMError(err);
                App.render();
              }
              break;
            }
            case 'llm-generate-stimuli_batch': {
              const state = appState.llmState.stimuli_batch;
              if (!state.text.trim()) { state.error = 'empty'; App.render(); break; }
              state.loading = true; state.error = null; state.lastFilledCount = 0; App.render();
              try {
                const result = await AITextGenerator.generateStimulusConfig(state.text, appState.scenario, appState.scenario.actors);
                const configs = Array.isArray(result) ? result : (Array.isArray(result?.stimuli) ? result.stimuli : [result]);
                const addedCount = await handleMultiStimulusResult(configs, state.text);
                state.loading = false;
                state.lastFilledCount = addedCount;
                App.render();
              } catch (err) {
                state.loading = false;
                state.error = classifyLLMError(err);
                App.render();
              }
              break;
            }
            case 'llm-actor-add': {
              const idx = Number(event.currentTarget.dataset.idx);
              const pending = appState.llmState.actors.pendingActors;
              if (!pending || !pending[idx]) break;
              addActorFromLLM(pending[idx]);
              appState.llmState.actors.pendingActors = pending.filter((_, i) => i !== idx);
              if (appState.llmState.actors.pendingActors.length === 0) appState.llmState.actors.pendingActors = null;
              App.render();
              break;
            }
            case 'llm-actor-ignore': {
              const idx = Number(event.currentTarget.dataset.idx);
              const pending = appState.llmState.actors.pendingActors;
              if (!pending) break;
              appState.llmState.actors.pendingActors = pending.filter((_, i) => i !== idx);
              if (appState.llmState.actors.pendingActors.length === 0) appState.llmState.actors.pendingActors = null;
              App.render();
              break;
            }
            case 'llm-actor-add-all': {
              const pending = appState.llmState.actors.pendingActors;
              if (!pending) break;
              pending.forEach((actor) => addActorFromLLM(actor));
              appState.llmState.actors.pendingActors = null;
              App.render();
              pushToast(tt('All actors added.', 'Tous les acteurs ajoutés.', 'Alle Akteure hinzugefügt.'), 'success');
              break;
            }
            case 'llm-actor-ignore-all': {
              appState.llmState.actors.pendingActors = null;
              App.render();
              break;
            }
            // ─── Chronogram Import actions ───
            case 'import-chronogram-ia': {
              if (!isLLMAvailable()) {
                pushToast(tt('Configure an API key in settings first.', 'Configurez une clé API dans les paramètres d\'abord.', 'Bitte zuerst einen API-Schlüssel in den Einstellungen konfigurieren.'), 'error');
                break;
              }
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.xlsx,.xls';
              input.addEventListener('change', async () => {
                const file = input.files[0];
                if (!file) return;
                try {
                  if (typeof XLSX === 'undefined') throw new Error(tt('SheetJS library not loaded. Check your internet connection.', 'Bibliothèque SheetJS non chargée. Vérifiez votre connexion internet.', 'SheetJS-Bibliothek nicht geladen. Bitte Internetverbindung prüfen.'));
                  const arrayBuffer = await file.arrayBuffer();
                  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                  const excelData = ChronogramImport.prepareExcelForLLM(workbook);
                  appState.chronogramImport = {
                    phase: 'config',
                    fileName: file.name,
                    file: file,
                    workbook: workbook,
                    excelData: excelData,
                    options: {
                      createActors: true,
                      detectImplicit: true,
                      mainSheet: ChronogramImport.detectMainSheet(workbook.SheetNames),
                      userContext: ''
                    },
                    progress: null,
                    result: null,
                    error: null
                  };
                  App.render();
                } catch (err) {
                  pushToast(err.message || tt('Failed to read Excel file.', 'Impossible de lire le fichier Excel.', 'Excel-Datei konnte nicht gelesen werden.'), 'error');
                }
              });
              input.click();
              break;
            }
            case 'chronogram-toggle-llm-stream': {
              if (appState.chronogramImport) {
                appState.chronogramImport.showLLMStream = !appState.chronogramImport.showLLMStream;
                App.render();
              }
              break;
            }
            case 'chronogram-cancel': {
              appState.chronogramImport = null;
              App.render();
              break;
            }
            case 'chronogram-launch-import': {
              const state = appState.chronogramImport;
              if (!state) break;
              // Read options from DOM before switching phase
              document.querySelectorAll('[data-chrono-option]').forEach(el => {
                const key = el.dataset.chronoOption;
                if (key === 'autonomyMode') {
                  appState.chronogramImportAutonomy = el.value;
                } else if (el.type === 'checkbox') {
                  state.options[key] = el.checked;
                } else if (el.tagName === 'SELECT') {
                  state.options[key] = el.value;
                } else {
                  state.options[key] = el.value;
                }
              });
              state.phase = 'progress';
              state.progress = { step: 1, totalSteps: 3, message: '', details: '' };
              state.llmLogs = [];
              state.error = null;
              App.render();
              // Run pipeline async
              (async () => {
                try {
                  const onLog = (entry) => {
                    const logs = appState.chronogramImport?.llmLogs;
                    if (!logs) return;
                    if (entry.type === 'start') {
                      logs.push({ id: Date.now(), stepNum: entry.stepNum, stepLabel: entry.stepLabel, userPromptPreview: entry.userPromptPreview, responseText: '', status: 'streaming' });
                      App.render();
                      setTimeout(() => { const p = document.getElementById('llm-stream-panel'); if (p) p.scrollTop = p.scrollHeight; }, 30);
                    } else if (entry.type === 'chunk') {
                      const last = logs[logs.length - 1];
                      if (!last || last.status !== 'streaming') return;
                      last.responseText += entry.text;
                      const contentEl = document.getElementById('llm-stream-content');
                      if (contentEl) contentEl.innerHTML = renderLLMLogs(logs);
                      const panel = document.getElementById('llm-stream-panel');
                      if (panel) panel.scrollTop = panel.scrollHeight;
                      const indicatorText = document.getElementById('chronogram-stream-indicator-text');
                      if (indicatorText) {
                        const chars = (last.responseText || '').length;
                        indicatorText.textContent = `${tt('Receiving LLM response', 'Réception de la réponse LLM', 'LLM-Antwort wird empfangen')} — ${chars.toLocaleString()} ${tt('chars', 'car.', 'Zeichen')}`;
                      }
                    } else if (entry.type === 'done' || entry.type === 'error') {
                      const last = logs[logs.length - 1];
                      if (last) last.status = entry.type;
                      App.render();
                      setTimeout(() => { const p = document.getElementById('llm-stream-panel'); if (p) p.scrollTop = p.scrollHeight; }, 30);
                    }
                  };
                  const result = await ChronogramImport.importChronogramIA(
                    state.file,
                    state.options,
                    (step, totalSteps, message, details) => {
                      state.progress = { step, totalSteps, message, details };
                      App.render();
                    },
                    onLog
                  );
                  state.result = result;
                  const autonomy = appState.chronogramImportAutonomy;
                  if (autonomy === 'fully_autonomous') {
                    // Auto-apply
                    const summary = ChronogramImport.applyImport(appState.scenario, result);
                    state.phase = 'result';
                    state.appliedSummary = summary;
                    saveLocal(false);
                    App.render();
                    pushToast(tt(
                      `AI import complete: ${summary.stimuli_created} stimuli, ${summary.actors_created} actors created.`,
                      `Import IA terminé : ${summary.stimuli_created} stimuli, ${summary.actors_created} acteurs créés.`,
                      `KI-Import abgeschlossen: ${summary.stimuli_created} Stimuli, ${summary.actors_created} Akteure erstellt.`
                    ), 'success');
                  } else if (autonomy === 'fully_validated') {
                    // Build validation queue: actors first, then stimuli
                    const queue = [];
                    (result.actors || []).forEach(a => queue.push({ ...a, _type: 'actor' }));
                    (result.stimuli || []).forEach(s => queue.push({ ...s, _type: 'stimulus' }));
                    state.validationQueue = queue;
                    state.validationIndex = 0;
                    state.acceptedItems = [];
                    state.acceptedCount = 0;
                    state.skippedCount = 0;
                    state.phase = 'validation';
                    App.render();
                  } else {
                    // mostly_autonomous: show result modal
                    state.phase = 'result';
                    App.render();
                  }
                } catch (err) {
                  state.error = err.message;
                  state.phase = 'result';
                  App.render();
                  pushToast(err.message, 'error');
                }
              })();
              break;
            }
            case 'chronogram-accept-all': {
              const state = appState.chronogramImport;
              if (!state || !state.result) break;
              const summary = ChronogramImport.applyImport(appState.scenario, state.result);
              appState.chronogramImport = null;
              saveLocal(false);
              App.render();
              pushToast(tt(
                `Import applied: ${summary.stimuli_created} stimuli, ${summary.actors_created} actors.`,
                `Import appliqué : ${summary.stimuli_created} stimuli, ${summary.actors_created} acteurs.`,
                `Import angewendet: ${summary.stimuli_created} Stimuli, ${summary.actors_created} Akteure.`
              ), 'success');
              break;
            }
            case 'chronogram-reject-all': {
              appState.chronogramImport = null;
              App.render();
              pushToast(tt('Import cancelled.', 'Import annulé.', 'Import abgebrochen.'), 'info');
              break;
            }
            case 'chronogram-modify': {
              const state = appState.chronogramImport;
              if (!state || !state.result) break;
              const summary = ChronogramImport.applyImport(appState.scenario, state.result);
              appState.chronogramImport = null;
              appState.route = 'library';
              saveLocal(false);
              App.render();
              pushToast(tt(
                `${summary.stimuli_created} stimuli imported as drafts. Review them in the Library.`,
                `${summary.stimuli_created} stimuli importés en brouillon. Vérifiez-les dans la Bibliothèque.`,
                `${summary.stimuli_created} Stimuli als Entwürfe importiert. In der Bibliothek überprüfen.`
              ), 'success');
              break;
            }
            case 'chronogram-accept-item': {
              const state = appState.chronogramImport;
              if (!state || !state.validationQueue) break;
              const item = state.validationQueue[state.validationIndex];
              if (item) {
                if (!state.acceptedItems) state.acceptedItems = [];
                state.acceptedItems.push(item);
                state.acceptedCount = (state.acceptedCount || 0) + 1;
              }
              state.validationIndex = (state.validationIndex || 0) + 1;
              App.render();
              break;
            }
            case 'chronogram-skip-item': {
              const state = appState.chronogramImport;
              if (!state || !state.validationQueue) break;
              state.skippedCount = (state.skippedCount || 0) + 1;
              state.validationIndex = (state.validationIndex || 0) + 1;
              App.render();
              break;
            }
            case 'chronogram-finish-validation': {
              const state = appState.chronogramImport;
              if (!state) break;
              const accepted = state.acceptedItems || [];
              const acceptedActors = accepted.filter(i => i._type === 'actor');
              const acceptedStimuli = accepted.filter(i => i._type === 'stimulus');
              // Build a filtered import result
              const filteredResult = {
                actors: acceptedActors.map(a => { const { _type, ...rest } = a; return rest; }),
                stimuli: acceptedStimuli.map(s => { const { _type, ...rest } = s; return rest; }),
                warnings: state.result?.warnings || [],
                skipped_rows: state.result?.skipped_rows || [],
                synopsis: state.result?.synopsis
              };
              const summary = ChronogramImport.applyImport(appState.scenario, filteredResult);
              appState.chronogramImport = null;
              saveLocal(false);
              App.render();
              pushToast(tt(
                `Import applied: ${summary.stimuli_created} stimuli, ${summary.actors_created} actors.`,
                `Import appliqué : ${summary.stimuli_created} stimuli, ${summary.actors_created} acteurs.`,
                `Import angewendet: ${summary.stimuli_created} Stimuli, ${summary.actors_created} Akteure.`
              ), 'success');
              break;
            }
            default: console.warn(tt('Unhandled action', 'Action non gérée', 'Nicht behandelte Aktion'), action);
          }
        } catch (error) {
          console.error(error);
          pushToast(error.message || 'Une erreur est survenue.', 'error');
        }
      }

      async function withActionProgress(action, task) {
        appState.ui.actionLoading[action] = true;
        App.render();
        try {
          return await task();
        } finally {
          appState.ui.actionLoading[action] = false;
          App.render();
        }
      }

      function addActor() {
        appState.scenario.actors.push({ id: uid('actor'), name: tt('New actor', 'Nouvel acteur', 'Neuer Akteur'), role: 'internal', organization: appState.scenario.client.name, title: tt('Title / role', 'Titre / fonction', 'Titel / Funktion'), language: appState.scenario.client.language || 'en', avatar_initials: 'NA', avatar_url: '' });
        App.render();
      }

      function duplicateActor(actorId) {
        const actor = getActor(actorId);
        if (!actor) return;
        appState.scenario.actors.push({ ...deepClone(actor), id: uid('actor'), name: `${actor.name} ${tt('(copy)', '(copie)', '(Kopieren)')}` });
        App.render();
      }

      function deleteActor(actorId) {
        if (appState.scenario.actors.length === 1) throw new Error(tt('At least one actor is required.', 'Au moins un acteur est requis.', 'Mindestens ein Akteur ist erforderlich.'));
        appState.scenario.actors = appState.scenario.actors.filter((actor) => actor.id !== actorId);
        appState.scenario.stimuli.forEach((stimulus) => {
          if (stimulus.actor_id === actorId) stimulus.actor_id = appState.scenario.actors[0].id;
        });
        App.render();
      }

      function generateSampleActors() {
        const clientName = appState.scenario.client.name || 'Client';
        const additions = [
          { name: 'Sophie Laurent', role: 'journalist', organization: 'Les Echos', title: 'Cyber reporter', country: 'FR' },
          { name: 'Marc Riviere', role: 'analyst', organization: 'Delta Advisory', title: 'Threat analyst', country: 'FR' },
          { name: 'Nora Benali', role: 'partner', organization: 'Cloud provider', title: 'Client relationship lead', country: 'FR' }
        ];
        additions.forEach((item) => appState.scenario.actors.push({ id: uid('actor'), avatar_initials: initialsFromName(item.name), avatar_url: '', ...item, organization: item.organization.replace('Client', clientName) }));
        App.render();
        pushToast(tt('Sample actors added.', 'Acteurs types ajoutés.', 'Beispielakteure hinzugefügt.'), 'success');
      }

      function addStimulus() {
        const actorId = appState.scenario.actors[0]?.id;
        const stimulus = makeStimulus('email_internal', actorId, nextStimulusOffset());
        appState.scenario.stimuli.push(stimulus);
        appState.selectedStimulusId = stimulus.id;
        appState.stimulusModalId = stimulus.id;
        App.render();
      }

      function duplicateStimulus(stimulusId) {
        const stimulus = getStimulus(stimulusId);
        if (!stimulus) return;
        const copy = deepClone(stimulus);
        copy.id = uid('stimulus');
        copy.timestamp_offset_minutes += 15;
        appState.scenario.stimuli.push(copy);
        appState.selectedStimulusId = copy.id;
        appState.stimulusModalId = copy.id;
        App.render();
      }

      function deleteStimulus(stimulusId, requireConfirm = false) {
        if (requireConfirm) {
          const s = getStimulus(stimulusId);
          const label = s ? (s.fields.subject || s.fields.headline || s.fields.title || channelLabel(s.channel)) : '';
          const msg = tt(`Delete this stimulus?\n"${label}"`, `Supprimer ce stimulus ?\n"${label}"`, `Diesen Stimulus löschen?\n„${label}"`);
          if (!window.confirm(msg)) return;
        }
        appState.scenario.stimuli = appState.scenario.stimuli.filter((stimulus) => stimulus.id !== stimulusId);
        appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
        if (appState.stimulusModalId === stimulusId) appState.stimulusModalId = null;
        if (requireConfirm && appState.libraryExpandedId === stimulusId) appState.libraryExpandedId = null;
        App.render();
      }

      function sortStimuli() {
        appState.scenario.stimuli.sort((a, b) => a.timestamp_offset_minutes - b.timestamp_offset_minutes);
      }

      async function generateStimulus(stimulusId, fieldName = null) {
        const stimulus = getStimulus(stimulusId);
        if (!stimulus) return;
        if (stimulus.generation_mode === 'manual') return; // respect manual mode
        appState.ui.generatingField = { stimulusId, fieldName };
        App.render();
        let generated;
        try {
          const guided = stimulus.generation_mode === 'ai_guided' ? stimulus.generation_prompt : null;
          generated = await AITextGenerator.generateForStimulus(stimulus, fieldName, guided);
        } finally {
          appState.ui.generatingField = null;
        }
        // Build the new fields state (merge generated into current for field-level regen)
        const newFields = deepClone(stimulus.fields);
        Object.entries(generated).forEach(([key, value]) => {
          if (!fieldName || fieldName === key) newFields[key] = value;
          stimulus.generated_text[key] = value;
        });
        if (fieldName && generated[fieldName] === undefined) {
          const first = Object.values(generated)[0];
          if (first !== undefined) newFields[fieldName] = first;
        }
        // saveStimulus pushes current fields to history, then sets fields to newFields
        saveStimulus(stimulus, newFields, fieldName
          ? tt(`AI: regenerated ${fieldName}`, `IA : régénération de ${fieldName}`, `KI: ${fieldName} neu generiert`)
          : tt('AI: full generation', 'IA : génération complète', 'KI: vollständige Generierung'));
        stimulus.status = 'ready';
        App.render();
      }

      // ── TTS helpers ──────────────────────────────────────────────────
      function resolveTTSLanguage(stimulus) {
        if (stimulus.fields.tts_language) return stimulus.fields.tts_language;
        const l = appState.scenario.settings.inject_language || appState.scenario.settings.language || 'en';
        if (l === 'fr') return 'fr-FR';
        if (l === 'de') return 'de-DE';
        if (l === 'en') return 'en-US';
        return 'en-US';
      }

      async function generateTTS(stimulusId) {
        const stimulus = getStimulus(stimulusId);
        if (!stimulus) return;
        const text = stimulus.fields.text;
        if (!text?.trim()) {
          pushToast(tt('Enter text to generate audio.', 'Saisissez du texte pour générer l\'audio.', 'Geben Sie Text ein, um Audio zu generieren.'), 'error');
          return;
        }
        const voiceType = stimulus.fields.voice_type || 'cybercriminal';
        const speed = Math.max(0.5, Math.min(2, Number(stimulus.fields.tts_speed) || 1));
        const pitch = Math.max(0.1, Math.min(2, Number(stimulus.fields.tts_pitch) || 1));
        const ttsProvider = stimulus.fields.tts_provider || 'browser';
        const ttsLang = resolveTTSLanguage(stimulus);

        try {
          let audioBlob;
          if (ttsProvider === 'azure_speech') {
            const { azure_speech_key, azure_speech_region } = appState.scenario.settings;
            if (!azure_speech_key) {
              pushToast(tt('Azure Speech API key not configured. Go to Settings.', 'Clé API Azure Speech non configurée. Allez dans les Paramètres.', 'Azure Speech API-Schlüssel nicht konfiguriert. Gehen Sie zu den Einstellungen.'), 'error');
              return;
            }
            audioBlob = await synthesizeWithAzureSpeech(text, voiceType, ttsLang, speed, pitch, stimulus.fields.azure_voice, azure_speech_key, azure_speech_region || 'westeurope');
          } else {
            if (!window.speechSynthesis) {
              pushToast(tt('Your browser does not support speech synthesis.', 'Votre navigateur ne supporte pas la synthèse vocale.', 'Ihr Browser unterstützt keine Sprachsynthese.'), 'error');
              return;
            }
            audioBlob = await synthesizeWithBrowser(text, voiceType, ttsLang, speed, pitch);
          }

          // Apply cybercriminal effects if needed
          if (voiceType === 'cybercriminal') {
            try {
              audioBlob = await applyCybercriminalEffects(audioBlob);
            } catch (e) {
              console.warn('Effect processing failed, using raw audio', e);
            }
          }

          // Prepend audio watermark if enabled
          if (appState.scenario.settings.watermark_enabled !== false && appState.scenario.settings.watermark_audio_enabled !== false) {
            try {
              audioBlob = await prependAudioWatermark(audioBlob, ttsLang);
            } catch (e) {
              console.warn('Audio watermark failed, using raw audio', e);
            }
          }

          if (appState.audioFiles[stimulusId]?.objectUrl) {
            URL.revokeObjectURL(appState.audioFiles[stimulusId].objectUrl);
          }
          const ext = ttsProvider === 'azure_speech' ? 'wav' : 'wav';
          appState.audioFiles[stimulusId] = {
            objectUrl: URL.createObjectURL(audioBlob),
            fileName: `${slugify(stimulus.fields.title || 'audio')}_${voiceType}_${ttsLang}.${ext}`,
            blob: audioBlob
          };
          // Read duration
          const tempAudio = new Audio(appState.audioFiles[stimulusId].objectUrl);
          tempAudio.addEventListener('loadedmetadata', () => {
            if (isFinite(tempAudio.duration)) {
              const mins = Math.floor(tempAudio.duration / 60);
              const secs = Math.floor(tempAudio.duration % 60);
              stimulus.fields.duration = `${mins}:${String(secs).padStart(2, '0')}`;
              App.render();
            }
          });
          pushToast(tt('Audio generated successfully.', 'Audio généré avec succès.', 'Audio erfolgreich generiert.'), 'success');
        } catch (err) {
          console.error('TTS generation failed', err);
          pushToast(tt(`Audio generation failed: ${err.message}`, `La génération audio a échoué : ${err.message}`, `Audio-Generierung fehlgeschlagen: ${err.message}`), 'error');
        }
        App.render();
      }

      // ── Azure Speech TTS ──────────────────────────────────────────────
      async function synthesizeWithAzureSpeech(text, voiceType, lang, speed, pitch, azureVoice, apiKey, region) {
        // Determine voice name
        let voiceName = azureVoice;
        if (!voiceName) {
          const voices = AZURE_SPEECH_VOICES[lang] || AZURE_SPEECH_VOICES['en-US'];
          if (voiceType === 'radio_female' || voiceType === 'cybercriminal') {
            voiceName = (voices.find(v => v.gender === (voiceType === 'radio_female' ? 'female' : 'male')) || voices[0]).value;
          } else if (voiceType === 'radio_male') {
            voiceName = (voices.find(v => v.gender === 'male') || voices[0]).value;
          } else {
            voiceName = voices[0].value;
          }
        }

        // Build SSML
        const ratePercent = Math.round((speed - 1) * 100);
        const pitchPercent = Math.round((pitch - 1) * 50);
        const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">
  <voice name="${voiceName}">
    <prosody rate="${ratePercent >= 0 ? '+' : ''}${ratePercent}%" pitch="${pitchPercent >= 0 ? '+' : ''}${pitchPercent}%">
      ${escapedText}
    </prosody>
  </voice>
</speak>`;

        const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
            'User-Agent': 'CrisisMaker'
          },
          body: ssml
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          throw new Error(`Azure Speech API error ${response.status}: ${errText || response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return new Blob([arrayBuffer], { type: 'audio/wav' });
      }

      // ── Browser SpeechSynthesis with language-aware voice selection ───
      function synthesizeWithBrowser(text, voiceType, lang, speed, pitch) {
        return new Promise((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang;
          utterance.rate = speed;

          // Wait for voices to be loaded
          let voices = speechSynthesis.getVoices();
          if (!voices.length) {
            speechSynthesis.addEventListener('voiceschanged', () => {
              voices = speechSynthesis.getVoices();
            }, { once: true });
            // Short delay to let voices load
            setTimeout(() => { voices = speechSynthesis.getVoices(); }, 100);
          }

          // Filter voices by language first
          const langPrefix = lang.split('-')[0]; // e.g. 'fr' from 'fr-FR'
          const langVoices = voices.filter(v => v.lang === lang || v.lang.startsWith(langPrefix));
          const pool = langVoices.length > 0 ? langVoices : voices;

          if (voiceType === 'radio_female') {
            utterance.pitch = pitch;
            const femaleVoice = pool.find(v => /female|femme|zira|samantha|victoria|karen|amelie|alice|denise|sonia|jenny|katja|eloise|libby|aria|amala/i.test(v.name))
              || pool.find(v => /woman|girl/i.test(v.name));
            if (femaleVoice) utterance.voice = femaleVoice;
            else if (langVoices.length) utterance.voice = langVoices[0];
          } else if (voiceType === 'radio_male') {
            utterance.pitch = pitch;
            const maleVoice = pool.find(v => /\b(male|david|james|daniel|thomas|henri|ryan|guy|conrad|davis|mark|google.*male)\b/i.test(v.name))
              || pool.find(v => !/female|femme|woman|girl|zira|samantha|victoria|karen|amelie|alice|denise|sonia|jenny|katja/i.test(v.name));
            if (maleVoice) utterance.voice = maleVoice;
            else if (langVoices.length) utterance.voice = langVoices[0];
          } else {
            // Cybercriminal: deep pitch
            utterance.pitch = Math.min(pitch, 0.7);
            utterance.rate = Math.min(speed, 0.85);
            const deepVoice = pool.find(v => /\b(david|daniel|james|mark|henri|ryan|guy|conrad|davis|google.*male)\b/i.test(v.name));
            if (deepVoice) utterance.voice = deepVoice;
            else if (langVoices.length) utterance.voice = langVoices[0];
          }

          // MediaStream capture
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const dest = audioCtx.createMediaStreamDestination();
          const recorder = new MediaRecorder(dest.stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' });
          const chunks = [];
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

          let speechDone = false;

          utterance.onend = () => {
            speechDone = true;
            setTimeout(() => { recorder.stop(); }, 500);
          };
          utterance.onerror = (e) => {
            speechDone = true;
            recorder.stop();
            reject(new Error('Speech synthesis error: ' + (e.error || 'unknown')));
          };

          recorder.onstop = async () => {
            audioCtx.close();
            if (chunks.length > 0) {
              const rawBlob = new Blob(chunks, { type: recorder.mimeType });
              // Try to decode to WAV for consistency
              try {
                const ab = await rawBlob.arrayBuffer();
                const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
                const decoded = await decodeCtx.decodeAudioData(ab);
                decodeCtx.close();
                resolve(audioBufferToWavBlob(decoded));
              } catch (_) {
                resolve(rawBlob);
              }
            } else {
              // Fallback: generate tone placeholder
              resolve(fallbackSpeechCapture(text, voiceType, speed, pitch));
            }
          };

          recorder.start();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(dest);
          osc.start();
          speechSynthesis.speak(utterance);

          setTimeout(() => {
            if (!speechDone) {
              speechSynthesis.cancel();
              speechDone = true;
              recorder.stop();
            }
          }, 300000);
        });
      }

      function fallbackSpeechCapture(text, voiceType, speed, pitch) {
        return new Promise((resolve) => {
          const sampleRate = 22050;
          const duration = Math.max(2, text.length * 0.06);
          const numSamples = Math.floor(sampleRate * duration);
          const buffer = new ArrayBuffer(44 + numSamples * 2);
          const view = new DataView(buffer);
          const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
          writeStr(0, 'RIFF');
          view.setUint32(4, 36 + numSamples * 2, true);
          writeStr(8, 'WAVE');
          writeStr(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, 1, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, sampleRate * 2, true);
          view.setUint16(32, 2, true);
          view.setUint16(34, 16, true);
          writeStr(36, 'data');
          view.setUint32(40, numSamples * 2, true);
          for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            let sample = 0;
            if (voiceType === 'cybercriminal') {
              sample = Math.sin(2 * Math.PI * 120 * t) * 0.15 + Math.sin(2 * Math.PI * 180 * t) * 0.1;
            } else {
              sample = Math.sin(2 * Math.PI * 440 * t) * 0.05;
            }
            view.setInt16(44 + i * 2, sample * 32767, true);
          }
          resolve(new Blob([buffer], { type: 'audio/wav' }));
        });
      }

      // ── Audio watermark: prepend a spoken "Exercise" warning + tone ───
      async function prependAudioWatermark(audioBlob, lang) {
        const sampleRate = 24000;
        const watermarkText = appState.scenario.settings.watermark_text || 'EXERCISE EXERCISE EXERCISE';

        // Generate a 3-beep tone watermark (always works, no TTS dependency)
        const beepDuration = 0.15;
        const pauseDuration = 0.1;
        const numBeeps = 3;
        const totalBeepTime = numBeeps * beepDuration + (numBeeps - 1) * pauseDuration + 0.3;
        const beepSamples = Math.ceil(totalBeepTime * sampleRate);
        const beepBuffer = new Float32Array(beepSamples);

        for (let b = 0; b < numBeeps; b++) {
          const startSample = Math.floor((b * (beepDuration + pauseDuration)) * sampleRate);
          const endSample = startSample + Math.floor(beepDuration * sampleRate);
          for (let i = startSample; i < endSample && i < beepSamples; i++) {
            const t = (i - startSample) / sampleRate;
            // 1kHz warning tone with envelope
            const envelope = Math.min(1, Math.min(t / 0.01, (beepDuration - t + (i - startSample) / sampleRate * 0) / 0.01));
            beepBuffer[i] = Math.sin(2 * Math.PI * 1000 * t) * 0.35 * Math.min(1, t / 0.01, (beepDuration - (i - startSample) / sampleRate) / 0.01);
          }
        }

        // Decode the main audio
        const mainArrayBuffer = await audioBlob.arrayBuffer();
        let mainDecoded;
        try {
          const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
          mainDecoded = await tempCtx.decodeAudioData(mainArrayBuffer.slice(0));
          tempCtx.close();
        } catch (e) {
          return audioBlob; // Can't decode, return original
        }

        // Resample main audio to our target sample rate if needed
        const mainData = mainDecoded.getChannelData(0);
        const mainSampleRate = mainDecoded.sampleRate;
        let resampledMain;
        if (mainSampleRate !== sampleRate) {
          const ratio = mainSampleRate / sampleRate;
          const newLength = Math.floor(mainDecoded.length / ratio);
          resampledMain = new Float32Array(newLength);
          for (let i = 0; i < newLength; i++) {
            const srcIdx = i * ratio;
            const idx = Math.floor(srcIdx);
            const frac = srcIdx - idx;
            resampledMain[i] = (mainData[idx] || 0) * (1 - frac) + (mainData[Math.min(idx + 1, mainData.length - 1)] || 0) * frac;
          }
        } else {
          resampledMain = mainData;
        }

        // Concatenate: beep + main audio
        const totalLength = beepSamples + resampledMain.length;
        const combined = new Float32Array(totalLength);
        combined.set(beepBuffer, 0);
        combined.set(resampledMain, beepSamples);

        // Create AudioBuffer and convert to WAV
        const offCtx = new OfflineAudioContext(1, totalLength, sampleRate);
        const buf = offCtx.createBuffer(1, totalLength, sampleRate);
        buf.getChannelData(0).set(combined);
        const src = offCtx.createBufferSource();
        src.buffer = buf;
        src.connect(offCtx.destination);
        src.start();
        const rendered = await offCtx.startRendering();
        return audioBufferToWavBlob(rendered);
      }

      async function applyCybercriminalEffects(audioBlob) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        let decodedBuffer;
        try {
          decodedBuffer = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
          tempCtx.close();
        } catch (e) {
          tempCtx.close();
          return audioBlob;
        }
        const duration = decodedBuffer.duration + 0.5;
        const sampleRate = decodedBuffer.sampleRate;
        const offCtx = new OfflineAudioContext(1, Math.ceil(duration * sampleRate), sampleRate);

        const source = offCtx.createBufferSource();
        source.buffer = decodedBuffer;
        source.playbackRate.value = 0.85;

        // Distortion via WaveShaper
        const distortion = offCtx.createWaveShaper();
        const curve = new Float32Array(44100);
        for (let i = 0; i < curve.length; i++) {
          const x = (i * 2) / curve.length - 1;
          curve[i] = (Math.PI + 50) * x / (Math.PI + 50 * Math.abs(x));
        }
        distortion.curve = curve;
        distortion.oversample = '2x';

        const lowpass = offCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 2000;
        lowpass.Q.value = 1;

        const gain = offCtx.createGain();
        gain.gain.value = 1.2;

        source.connect(distortion);
        distortion.connect(lowpass);
        lowpass.connect(gain);
        gain.connect(offCtx.destination);
        source.start();

        const rendered = await offCtx.startRendering();
        return audioBufferToWavBlob(rendered);
      }

      function audioBufferToWavBlob(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataSize = length * blockAlign;
        const bufferSize = 44 + dataSize;
        const out = new ArrayBuffer(bufferSize);
        const view = new DataView(out);
        const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
        writeStr(0, 'RIFF');
        view.setUint32(4, bufferSize - 8, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));
        let offset = 44;
        for (let i = 0; i < length; i++) {
          for (let ch = 0; ch < numChannels; ch++) {
            const sample = Math.max(-1, Math.min(1, channels[ch][i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
          }
        }
        return new Blob([out], { type: 'audio/wav' });
      }

      function replaceStimulusTemplate(stimulus, newChannel) {
        const template = TEMPLATE_LIBRARY[newChannel] || TEMPLATE_LIBRARY.email_internal;
        stimulus.channel = newChannel;
        stimulus.template_id = template.template_id;
        stimulus.fields = deepClone(template.defaults);
      }

      function replaceArticleVariant(stimulus, templateId) {
        const template = ARTICLE_TEMPLATE_LIBRARY[templateId] || ARTICLE_TEMPLATE_LIBRARY.nyt;
        stimulus.template_id = template.template_id;
        const prevPhotoData = stimulus.fields?.photo_data;
        const prevHasPhoto = stimulus.fields?.has_photo;
        stimulus.fields = deepClone(template.defaults);
        if (prevPhotoData) stimulus.fields.photo_data = prevPhotoData;
        if (prevHasPhoto !== undefined) stimulus.fields.has_photo = prevHasPhoto;
      }

      function nextStimulusOffset() {
        return (Math.max(0, ...appState.scenario.stimuli.map((item) => item.timestamp_offset_minutes)) || 0) + 30;
      }

      function getActor(id) { return appState.scenario.actors.find((actor) => actor.id === id); }
      function getStimulus(id) { return appState.scenario.stimuli.find((stimulus) => stimulus.id === id); }
      function getSelectedStimulus() {
        if (!appState.selectedStimulusId) appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
        return getStimulus(appState.selectedStimulusId);
      }
      function getSortedStimuli() { return [...appState.scenario.stimuli].sort((a, b) => a.timestamp_offset_minutes - b.timestamp_offset_minutes); }


      function slugify(input) {
        return String(input || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'stimulus';
      }

      function normalizeProviderSettingsInPlace(settings) {
        if (!['anthropic', 'openai', 'azure_openai', 'google_gemini'].includes(settings.ai_provider)) settings.ai_provider = 'anthropic';
        const providerModels = DEFAULT_MODELS[settings.ai_provider] || DEFAULT_MODELS.anthropic;
        if (!providerModels.includes(settings.ai_model)) settings.ai_model = providerModels[0];
        settings.ai_api_key = settings.ai_api_key || '';
        settings.azure_endpoint = settings.azure_endpoint || '';
        settings.azure_api_key = settings.azure_api_key || '';
        settings.azure_deployment = settings.azure_deployment || '';
        settings.azure_speech_key = settings.azure_speech_key || '';
        settings.azure_speech_region = settings.azure_speech_region || 'westeurope';
      }

      function renderProviderSummary(settings) {
        if (settings.ai_provider === 'azure_openai') {
          return `Azure OpenAI / ${escapeHtml(settings.azure_deployment || tt('deployment not set', 'déploiement non défini', 'Deployment nicht festgelegt'))}`;
        }
        if (settings.ai_provider === 'openai') {
          return `OpenAI / ${escapeHtml(settings.ai_model || tt('model not set', 'modèle non défini', 'Modell nicht festgelegt'))}`;
        }
        if (settings.ai_provider === 'google_gemini') {
          return `Google Gemini / ${escapeHtml(settings.ai_model || tt('model not set', 'modèle non défini', 'Modell nicht festgelegt'))}`;
        }
        return `Anthropic / ${escapeHtml(settings.ai_model || tt('model not set', 'modèle non défini', 'Modell nicht festgelegt'))}`;
      }

      function setByPath(target, path, value) {
        const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);
        const parts = path.split('.');
        const last = parts.pop();
        if (BLOCKED.has(last) || parts.some(p => BLOCKED.has(p))) return;
        let ref = target;
        parts.forEach((part) => { ref = ref[part]; });
        ref[last] = value;
      }

      function bindStimuliSplitters() {
        const workspace = document.querySelector('[data-stimuli-workspace]');
        if (!workspace) return;
        const panelHandle = workspace.querySelector('[data-resize-handle="editor-width"]');
        if (panelHandle) panelHandle.addEventListener('pointerdown', (event) => startStimuliResize(event, 'editor-width', workspace));

        // Pinch-to-zoom on timeline
        const timeline = workspace.querySelector('[data-timeline-scroll]');
        if (timeline) {
          let lastPinchDist = null;
          timeline.addEventListener('touchstart', (event) => {
            if (event.touches.length === 2) {
              const dx = event.touches[0].clientX - event.touches[1].clientX;
              const dy = event.touches[0].clientY - event.touches[1].clientY;
              lastPinchDist = Math.sqrt(dx * dx + dy * dy);
            } else {
              lastPinchDist = null;
            }
          }, { passive: true });
          timeline.addEventListener('touchmove', (event) => {
            if (event.touches.length === 2 && lastPinchDist !== null) {
              const dx = event.touches[0].clientX - event.touches[1].clientX;
              const dy = event.touches[0].clientY - event.touches[1].clientY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const delta = dist - lastPinchDist;
              lastPinchDist = dist;
              if (Math.abs(delta) > 2) {
                const step = delta > 0 ? 0.05 : -0.05;
                appState.ui.timelineZoom = Math.min(3.0, Math.max(0.5, (appState.ui.timelineZoom || 1.0) + step));
                App.render();
              }
            }
          }, { passive: true });
        }
      }

      function bindStimulusModalSplitter() {
        const modal = document.querySelector('[data-stimulus-modal-body]');
        if (!modal) return;
        const handle = modal.querySelector('[data-resize-handle="stimulus-modal-width"]');
        if (!handle) return;
        handle.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          const bounds = modal.getBoundingClientRect();
          const pointerId = event.pointerId;
          const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
          const onMove = (moveEvent) => {
            const widthPercent = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
            appState.ui.stimulusModalEditorWidth = Math.round(clamp(widthPercent, 25, 75));
            modal.style.setProperty('--stimulus-modal-editor-width', `${appState.ui.stimulusModalEditorWidth}%`);
            modal.style.setProperty('--stimulus-modal-preview-width', `${100 - appState.ui.stimulusModalEditorWidth}%`);
          };
          const stop = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
            if (modal.hasPointerCapture?.(pointerId)) modal.releasePointerCapture(pointerId);
            document.body.classList.remove('is-resizing-panels');
          };
          document.body.classList.add('is-resizing-panels');
          if (modal.setPointerCapture) modal.setPointerCapture(pointerId);
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', stop);
          window.addEventListener('pointercancel', stop);
        });
      }

      function startStimuliResize(event, type, workspace) {
        if (!workspace) return;
        event.preventDefault();
        const bounds = workspace.getBoundingClientRect();
        const pointerId = event.pointerId;
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const onMove = (moveEvent) => {
          if (type === 'timeline-height') {
            const height = clamp(moveEvent.clientY - bounds.top, 190, Math.max(190, bounds.height - 260));
            appState.ui.stimuliTimelineHeight = Math.round(height);
          } else {
            const widthPercent = ((moveEvent.clientX - bounds.left) / bounds.width) * 100;
            appState.ui.stimuliEditorWidth = Math.round(clamp(widthPercent, 28, 72));
          }
          workspace.style.setProperty('--stimuli-timeline-height', `${appState.ui.stimuliTimelineHeight}px`);
          workspace.style.setProperty('--stimuli-editor-width', `${appState.ui.stimuliEditorWidth}%`);
          workspace.style.setProperty('--stimuli-preview-width', `${100 - appState.ui.stimuliEditorWidth}%`);
        };
        const stop = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', stop);
          window.removeEventListener('pointercancel', stop);
          if (workspace.hasPointerCapture?.(pointerId)) workspace.releasePointerCapture(pointerId);
          document.body.classList.remove('is-resizing-panels');
        };
        document.body.classList.add('is-resizing-panels');
        if (workspace.setPointerCapture) workspace.setPointerCapture(pointerId);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
      }

      function initialsFromName(name) {
        return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'NA';
      }

      function parseArrayField(value) {
        if (Array.isArray(value)) return value;
        try { return JSON.parse(value || '[]'); } catch { return String(value || '').split(',').map((item) => item.trim()).filter(Boolean); }
      }

      function parseObjectField(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) return value;
        try { return JSON.parse(value || '{}'); } catch { return {}; }
      }

      function formatMetric(value) {
        const num = Number(value || 0);
        if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace('.0', '')}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1).replace('.0', '')}K`;
        return String(num);
      }

      function formatFtAuthor(value) {
        const text = String(value || '');
        const match = text.match(/^(.*?)(\s+in\s+.+)$/i);
        if (!match) return escapeHtml(text);
        return `${escapeHtml(match[1])}<em>${escapeHtml(match[2])}</em>`;
      }

      function subredditInitials(value) {
        return String(value || 'r').replace(/^r\//i, '').split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'R';
      }

      function renderAward(name) {
        const value = String(name || '').toLowerCase();
        const label = value === 'gold' ? '★' : value === 'silver' ? '✦' : '✋';
        return `<span class="award-pill"><span class="award-icon ${escapeAttribute(value)}">${label}</span><span>${escapeHtml(name)}</span></span>`;
      }

      function escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      }
      function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

      function sanitizeBody(html) {
        const raw = String(html ?? '');
        if (!raw) return '';
        return raw
          .replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, '')
          .replace(/<script[\s>\/][^>]*>/gi, '')
          .replace(/<iframe[\s>][\s\S]*?<\/iframe\s*>/gi, '')
          .replace(/<iframe[\s>\/][^>]*>/gi, '')
          .replace(/<object[\s>][\s\S]*?<\/object\s*>/gi, '')
          .replace(/<embed[\s>\/][^>]*>/gi, '')
          .replace(/<link[\s>\/][^>]*>/gi, '')
          .replace(/<form[\s>][\s\S]*?<\/form\s*>/gi, '')
          .replace(/<meta[\s>\/][^>]*>/gi, '')
          .replace(/<base[\s>\/][^>]*>/gi, '')
          .replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
          .replace(/javascript\s*:/gi, 'about:invalid')
          .replace(/data\s*:\s*text\/html/gi, 'about:invalid');
      }

      function iconReply() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"></path></svg>'; }
      function iconGift() { return '<svg viewBox="0 0 24 24"><path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8"></path><path d="M2 7h20v5H2z"></path><path d="M12 21V7"></path><path d="M12 7H8.5a2.5 2.5 0 1 1 0-5c2.2 0 3.5 2.1 3.5 5z"></path><path d="M12 7h3.5a2.5 2.5 0 1 0 0-5c-2.2 0-3.5 2.1-3.5 5z"></path></svg>'; }
      function iconBookmark() { return '<svg viewBox="0 0 24 24"><path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z"></path></svg>'; }
      function iconComment() { return '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'; }
      function iconLock() { return '<svg viewBox="0 0 24 24"><path d="M7 10V7a5 5 0 0 1 10 0v3"></path><rect x="5" y="10" width="14" height="10" rx="2" ry="2"></rect></svg>'; }
      function iconRedditArrow(extraClass = '') { return `<svg class="${extraClass}" viewBox="0 0 24 24"><path d="M12 6l6 9H6z"></path></svg>`; }
      function iconReplyAll() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9V5l-7 7 7 7v-4.1c2.3 0 4.2.3 5.9 1"></path><path d="M14 9V5l7 7-7 7v-4.1c-3.3 0-6.1.8-8.4 2.5"></path></svg>'; }
      function iconForward() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"></path></svg>'; }
      function iconRetweet() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>'; }
      function iconLike() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6c-1.5-1.5-4-1.5-5.5 0L12 7.9 8.7 4.6c-1.5-1.5-4-1.5-5.5 0s-1.5 4 0 5.5l3.3 3.3L12 21l5.5-7.6 3.3-3.3c1.5-1.5 1.5-4 0-5.5z"></path></svg>'; }
      function iconViews() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>'; }
      function iconShare() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"></line></svg>'; }
      function verifiedBadge(type) {
        const fill = type === 'gold' ? '#f2b10c' : type === 'grey' ? '#8392a5' : '#1d9bf0';
        return `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="${fill}"></circle><path d="M17.2 8.8l-6.1 6.4-3-2.9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
      }

      function highlightLLMFields(bindPaths) {
        setTimeout(() => {
          bindPaths.forEach((path) => {
            document.querySelectorAll(`[data-bind="${path}"]`).forEach((el) => {
              el.classList.add('llm-field-highlight');
            });
          });
          setTimeout(() => {
            document.querySelectorAll('.llm-field-highlight').forEach((el) => {
              el.classList.remove('llm-field-highlight');
            });
          }, 5000);
        }, 50);
      }

      function addActorFromLLM(actorData) {
        appState.scenario.actors.push({
          id: uid('actor'),
          name: actorData.name || tt('New actor', 'Nouvel acteur', 'Neuer Akteur'),
          role: actorData.role || 'internal',
          organization: actorData.organization || appState.scenario.client.name,
          title: actorData.title || '',
          language: actorData.language || appState.scenario.client.language || 'en',
          avatar_initials: initialsFromName(actorData.name || ''),
          avatar_url: ''
        });
      }

      function resolveActorFromName(nameOrNull) {
        if (!nameOrNull) return null;
        const lower = String(nameOrNull).toLowerCase().trim();
        return appState.scenario.actors.find((a) => a.name.toLowerCase().trim() === lower) || null;
      }

      async function applyStimulusConfig(stimulus, config) {
        if (config.channel && config.channel !== stimulus.channel) {
          replaceStimulusTemplate(stimulus, config.channel);
        }
        if (config.template_id && config.channel === 'article_press') {
          replaceArticleVariant(stimulus, config.template_id);
        }
        const resolvedActor = resolveActorFromName(config.actor_id);
        if (resolvedActor) {
          stimulus.actor_id = resolvedActor.id;
        } else if (config.source_label) {
          stimulus.source_label = config.source_label;
        }
        if (config.timestamp_offset_minutes !== undefined) {
          stimulus.timestamp_offset_minutes = Number(config.timestamp_offset_minutes) || 0;
        }
        stimulus.generation_mode = 'ai_guided';
        if (config.generation_prompt) stimulus.generation_prompt = config.generation_prompt;
        else if (appState.llmState.stimulus.text) stimulus.generation_prompt = appState.llmState.stimulus.text;
        if (config.fields && typeof config.fields === 'object') {
          Object.entries(config.fields).forEach(([key, value]) => {
            if (value !== undefined && value !== null) stimulus.fields[key] = value;
          });
        }
        stimulus.updated_at = new Date().toISOString();
      }

      async function handleMultiStimulusResult(configs, fallbackPrompt = '') {
        const validConfigs = configs.filter((config) => config && typeof config === 'object');
        validConfigs.forEach((config) => {
          const actorId = appState.scenario.actors[0]?.id;
          const stimulus = makeStimulus(config.channel || 'email_internal', actorId, config.timestamp_offset_minutes || 0, config.template_id || null);
          if (!config.generation_prompt && fallbackPrompt) config.generation_prompt = fallbackPrompt;
          applyStimulusConfig(stimulus, config);
          appState.scenario.stimuli.push(stimulus);
        });
        appState.selectedStimulusId = appState.scenario.stimuli[appState.scenario.stimuli.length - 1]?.id || null;
        if (validConfigs.length > 0) {
          pushToast(tt(`${validConfigs.length} stimuli added to timeline.`, `${validConfigs.length} stimuli ajoutés à la timeline.`, `${validConfigs.length} Stimuli zum Zeitplan hinzugefügt.`), 'success');
        }
        return validConfigs.length;
      }

      App.init();

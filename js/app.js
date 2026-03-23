      const appState = {
        route: 'project',
        selectedStimulusId: null,
        slideshowIndex: 0,
        settingsDrawerOpen: false,
        scenario: loadInitialScenario(),
        toasts: [],
        libraryFilter: { channel: '', status: '', actorId: '', sort: 'timeline' },
        historyModalStimulusId: null,
        llmState: makeDefaultLLMState()
        ui: {
          stimuliTimelineHeight: 255,
          stimuliEditorWidth: 42
        },
        llmState: {
          scenario: { text: '', collapsed: false, loading: false, error: null, lastFilledCount: 0 },
          actors:   { text: '', collapsed: false, loading: false, error: null, pendingActors: null },
          stimulus: { text: '', collapsed: false, loading: false, error: null, lastFilledCount: 0 }
        },
        connectionTest: { status: 'idle', message: '', checkedAt: null, provider: '' }
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
          root.innerHTML = renderAppShell();
          bindGlobalEvents();
          bindStimuliSplitters();
          renderToasts();
        }
      };

      function bindGlobalEvents() {
        document.querySelectorAll('[data-route]').forEach((button) => {
          button.addEventListener('click', () => {
            appState.route = button.dataset.route;
            App.render();
          });
        });

        document.querySelectorAll('[data-bind]').forEach((input) => {
          input.addEventListener('change', () => {
            setByPath(appState.scenario, input.dataset.bind, input.value);
            if (input.dataset.bind === 'settings.ai_provider') {
              const models = DEFAULT_MODELS[input.value];
              if (models?.length) appState.scenario.settings.ai_model = models[0];
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
          scenario: { text: '', collapsed: false, loading: false, error: null, lastFilledCount: 0 },
          actors:   { text: '', collapsed: false, loading: false, error: null, pendingActors: null },
          stimulus: { text: '', collapsed: false, loading: false, error: null, lastFilledCount: 0 }
        };
      }

      function confirmClearData() {
        return window.confirm(tt(
          'Clear all current scenario data? This will remove actors, stimuli, and browser autosave for this project.',
          'Effacer toutes les données du scénario en cours ? Cela supprimera les acteurs, les stimuli et la sauvegarde navigateur de ce projet.'
        ));
      }

      function clearScenarioData() {
        const preservedSettings = { ...appState.scenario.settings };
        appState.scenario = emptyScenario(preservedSettings);
        appState.selectedStimulusId = null;
        appState.slideshowIndex = 0;
        appState.historyModalStimulusId = null;
        appState.libraryFilter = { channel: '', status: '', actorId: '', sort: 'timeline' };
        appState.llmState = makeDefaultLLMState();
        _fileHandle = null;
        saveLocal(false);
        App.render();
        pushToast(tt('Scenario data cleared.', 'Données du scénario effacées.'), 'success');
      }

      async function handleAction(event) {
        const action = event.currentTarget.dataset.action;
        try {
          switch (action) {
            case 'toggle-settings-drawer':
              appState.settingsDrawerOpen = !appState.settingsDrawerOpen;
              App.render();
              break;
            case 'toggle-api-key': {
              const input = document.getElementById('api-key-input');
              input.type = input.type === 'password' ? 'text' : 'password';
              break;
            }
            case 'save-local': saveLocal(); break;
            case 'save-file': {
              if (_fileHandle) {
                await writeToFile();
                pushToast(tt('Saved to file.', 'Sauvegardé dans le fichier.'), 'success');
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
              appState.scenario = defaultScenario();
              appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
              appState.route = 'project';
              App.render();
              pushToast(tt('New scenario initialized.', 'Nouveau scénario initialisé.'), 'success');
              break;
            }
            case 'save-json': saveScenarioToFile(); break;
            case 'load-json': loadScenarioFromFile(); break;
            case 'export-all': await ExportEngine.exportAll(); break;
            case 'clear-data':
              if (confirmClearData()) clearScenarioData();
              break;
            case 'test-connection': {
              const provider = appState.scenario.settings.ai_provider;
              appState.connectionTest = {
                status: 'testing',
                message: tt('Checking the AI connection…', 'Vérification de la connexion IA…'),
                checkedAt: null,
                provider
              };
              App.render();
              try {
                const result = await AITextGenerator.testConnection();
                appState.connectionTest = {
                  status: 'success',
                  message: result?.message || tt('Connection confirmed. The provider returned a valid response.', 'Connexion confirmée. Le fournisseur a renvoyé une réponse valide.'),
                  checkedAt: new Date().toISOString(),
                  provider
                };
                App.render();
                pushToast(tt('AI connection validated.', 'Connexion IA validée.'), 'success');
              } catch (error) {
                appState.connectionTest = {
                  status: 'error',
                  message: error.message || tt('The AI connection test failed.', 'Le test de connexion IA a échoué.'),
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
            case 'select-stimulus': appState.selectedStimulusId = event.currentTarget.dataset.stimulusId; App.render(); break;
            case 'duplicate-stimulus': duplicateStimulus(event.currentTarget.dataset.stimulusId); break;
            case 'delete-stimulus': deleteStimulus(event.currentTarget.dataset.stimulusId); break;
            case 'sort-stimuli': sortStimuli(); App.render(); break;
            case 'generate-stimulus': await generateStimulus(event.currentTarget.dataset.stimulusId); break;
            case 'generate-field': await generateStimulus(event.currentTarget.dataset.stimulusId, event.currentTarget.dataset.fieldName); break;
            case 'export-png': await ExportEngine.exportStimulus(getStimulus(event.currentTarget.dataset.stimulusId)); break;
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
              const selected = getSelectedStimulus();
              if (!selected) break;
              if (!state.text.trim()) { state.error = 'empty'; App.render(); break; }
              state.loading = true; state.error = null; state.lastFilledCount = 0; App.render();
              try {
                const result = await AITextGenerator.generateStimulusConfig(state.text, appState.scenario, appState.scenario.actors);
                if (Array.isArray(result)) {
                  await handleMultiStimulusResult(result);
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
              pushToast(tt('All actors added.', 'Tous les acteurs ajoutés.'), 'success');
              break;
            }
            case 'llm-actor-ignore-all': {
              appState.llmState.actors.pendingActors = null;
              App.render();
              break;
            }
            default: console.warn(tt('Unhandled action', 'Action non gérée'), action);
          }
        } catch (error) {
          console.error(error);
          pushToast(error.message || 'Une erreur est survenue.', 'error');
        }
      }

      function addActor() {
        appState.scenario.actors.push({ id: uid('actor'), name: tt('New actor', 'Nouvel acteur'), role: 'internal', organization: appState.scenario.client.name, title: tt('Title / role', 'Titre / fonction'), language: appState.scenario.client.language || 'en', avatar_initials: 'NA', avatar_url: '' });
        App.render();
      }

      function duplicateActor(actorId) {
        const actor = getActor(actorId);
        if (!actor) return;
        appState.scenario.actors.push({ ...deepClone(actor), id: uid('actor'), name: `${actor.name} ${tt('(copy)', '(copie)')}` });
        App.render();
      }

      function deleteActor(actorId) {
        if (appState.scenario.actors.length === 1) throw new Error(tt('At least one actor is required.', 'Au moins un acteur est requis.'));
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
        pushToast(tt('Sample actors added.', 'Acteurs types ajoutés.'), 'success');
      }

      function addStimulus() {
        const actorId = appState.scenario.actors[0]?.id;
        const stimulus = makeStimulus('email_internal', actorId, nextStimulusOffset());
        appState.scenario.stimuli.push(stimulus);
        appState.selectedStimulusId = stimulus.id;
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
        App.render();
      }

      function deleteStimulus(stimulusId) {
        appState.scenario.stimuli = appState.scenario.stimuli.filter((stimulus) => stimulus.id !== stimulusId);
        appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
        App.render();
      }

      function sortStimuli() {
        appState.scenario.stimuli.sort((a, b) => a.timestamp_offset_minutes - b.timestamp_offset_minutes);
      }

      async function generateStimulus(stimulusId, fieldName = null) {
        const stimulus = getStimulus(stimulusId);
        if (!stimulus) return;
        if (stimulus.generation_mode === 'manual') return; // respect manual mode
        pushToast(tt('Generation in progress…', 'Génération en cours…'), 'success');
        const guided = stimulus.generation_mode === 'ai_guided' ? stimulus.generation_prompt : null;
        const generated = await AITextGenerator.generateForStimulus(stimulus, fieldName, guided);
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
          ? tt(`AI: regenerated ${fieldName}`, `IA : régénération de ${fieldName}`)
          : tt('AI: full generation', 'IA : génération complète'));
        stimulus.status = 'ready';
        App.render();
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
        stimulus.fields = deepClone(template.defaults);
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
        if (!['anthropic', 'openai', 'azure_openai'].includes(settings.ai_provider)) settings.ai_provider = 'anthropic';
        const providerModels = DEFAULT_MODELS[settings.ai_provider] || DEFAULT_MODELS.anthropic;
        if (!providerModels.includes(settings.ai_model)) settings.ai_model = providerModels[0];
        settings.ai_api_key = settings.ai_api_key || '';
        settings.azure_endpoint = settings.azure_endpoint || '';
        settings.azure_api_key = settings.azure_api_key || '';
        settings.azure_deployment = settings.azure_deployment || '';
      }

      function renderProviderSummary(settings) {
        if (settings.ai_provider === 'azure_openai') {
          return `Azure OpenAI / ${escapeHtml(settings.azure_deployment || tt('deployment not set', 'déploiement non défini'))}`;
        }
        if (settings.ai_provider === 'openai') {
          return `OpenAI / ${escapeHtml(settings.ai_model || tt('model not set', 'modèle non défini'))}`;
        }
        return `Anthropic / ${escapeHtml(settings.ai_model || tt('model not set', 'modèle non défini'))}`;
      }

      function setByPath(target, path, value) {
        const parts = path.split('.');
        const last = parts.pop();
        let ref = target;
        parts.forEach((part) => { ref = ref[part]; });
        ref[last] = value;
      }

      function bindStimuliSplitters() {
        const workspace = document.querySelector('[data-stimuli-workspace]');
        if (!workspace) return;
        const timelineHandle = workspace.querySelector('[data-resize-handle="timeline-height"]');
        const panelHandle = workspace.querySelector('[data-resize-handle="editor-width"]');
        if (timelineHandle) timelineHandle.addEventListener('pointerdown', (event) => startStimuliResize(event, 'timeline-height', workspace));
        if (panelHandle) panelHandle.addEventListener('pointerdown', (event) => startStimuliResize(event, 'editor-width', workspace));
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
          name: actorData.name || tt('New actor', 'Nouvel acteur'),
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

      async function handleMultiStimulusResult(configs) {
        configs.forEach((config) => {
          const actorId = appState.scenario.actors[0]?.id;
          const stimulus = makeStimulus(config.channel || 'email_internal', actorId, config.timestamp_offset_minutes || 0, config.template_id || null);
          applyStimulusConfig(stimulus, config);
          appState.scenario.stimuli.push(stimulus);
        });
        appState.selectedStimulusId = appState.scenario.stimuli[appState.scenario.stimuli.length - 1]?.id || null;
        pushToast(tt(`${configs.length} stimuli added to timeline.`, `${configs.length} stimuli ajoutés à la timeline.`), 'success');
      }

      App.init();

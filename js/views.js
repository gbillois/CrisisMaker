      function getLLMErrorMessage(errorCode) {
        const messages = {
          auth:      tt('Invalid API key. Check it in Settings.', 'Clé API invalide. Vérifiez-la dans les Paramètres.', 'Ungültiger API-Schlüssel. Überprüfen Sie ihn in den Einstellungen.'),
          quota:     tt('API quota exceeded. Retry later or change model.', 'Quota API dépassé. Réessayez plus tard ou changez de modèle.', 'API-Kontingent überschritten. Versuchen Sie es später erneut oder wechseln Sie das Modell.'),
          network:   tt('Connection error. Check your internet connection and retry.', 'Erreur de connexion. Vérifiez votre connexion internet et réessayez.', 'Verbindungsfehler. Überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.'),
          malformed: tt('Generation failed. Try rephrasing your description.', 'La génération a échoué. Essayez de reformuler votre description.', 'Generierung fehlgeschlagen. Versuchen Sie, Ihre Beschreibung umzuformulieren.'),
          empty:     tt('Describe what you want before generating.', 'Décrivez ce que vous voulez avant de générer.', 'Beschreiben Sie, was Sie generieren möchten, bevor Sie starten.')
        };
        return messages[errorCode] || errorCode;
      }

      /* A short hint from the HTTP status, then the full detail (provider, model, status,
         code, provider message) to investigate. */
      function classifyLLMError(err) {
        const status = Number(err?.status) || 0;
        const text = `${err?.message || ''} ${err?.code || ''}`;
        const hint = status === 401 || status === 403 || /invalid[_ ]api[_ ]key|incorrect api key/i.test(text) ? 'auth'
          : status === 429 || /insufficient_quota|rate limit/i.test(text) ? 'quota'
            : !status && /failed to fetch|network error|load failed/i.test(text) ? 'network' : '';
        const detail = `${CrisisError.format(err, { operation: 'LLM generation' })}\n${tt('Details in Settings → Technical log.', 'Détails dans Paramètres → Journal technique.', 'Details unter Einstellungen → Technisches Protokoll.')}`;
        return hint ? `${getLLMErrorMessage(hint)}\n${detail}` : detail;
      }

      function renderLLMConfigBlock(zone, placeholder, options = {}) {
        const state = appState.llmState[zone];
        const available = isLLMAvailable();
        const collapsed = state.collapsed;
        const loading = state.loading;
        const title = options.title || tt('Edit with AI', 'Modifier avec l’IA', 'Mit KI bearbeiten');
        const subtitle = options.subtitle || tt(
          'Describe what you want in natural language. If information is missing, the LLM will fill in the most likely values.',
          'Décrivez ce que vous voulez en langage naturel. Si des informations manquent, le LLM complétera avec les valeurs les plus probables.',
          'Beschreiben Sie auf natürliche Sprache, was Sie möchten. Fehlen Informationen, ergänzt das LLM die wahrscheinlichsten Werte.'
        );

        const generateLabel = loading
          ? `<span class="ai-spinner"></span>${options.loadingLabel || tt('Generating…', 'Génération en cours…', 'Wird generiert…')}`
          : `${sbUiIcon('sparkles', 14)} ${options.generateLabel || tt('Generate', 'Générer', 'Generieren')}`;
        const disabledAttr = (!available || loading) ? 'disabled' : '';
        const noKeyTooltip = !available
          ? escapeAttribute(tt(
              'Configure your API key in Settings to use this feature.',
              'Configurez votre clé API dans les Paramètres pour utiliser cette fonctionnalité.',
              'Konfigurieren Sie Ihren API-Schlüssel in den Einstellungen, um diese Funktion zu nutzen.'
            ))
          : '';

        const errorHtml = state.error && state.error !== 'empty'
          ? `<div class="llm-error-banner${['quota', 'network', 'malformed'].includes(state.error) ? ' llm-warning' : ''}">${escapeHtml(getLLMErrorMessage(state.error))}</div>`
          : '';

        const rawResponseHtml = state.rawResponse
          ? `<details class="llm-raw-response"${state.error ? ' open' : ''}>
              <summary>${tt('LLM response', 'Retour du LLM', 'LLM-Antwort')}</summary>
              <pre>${escapeHtml(state.rawResponse)}</pre>
             </details>`
          : '';

        const pendingActorsHtml = (zone === 'actors' && state.pendingActors && state.pendingActors.length > 0)
          ? renderPendingActorsPanel(state.pendingActors)
          : '';

        const successMessage = options.successMessage
          ? options.successMessage(state.lastFilledCount)
          : tt(`${state.lastFilledCount} field(s) pre-filled by the LLM. Check and adjust if needed.`, `${state.lastFilledCount} champ(s) pré-rempli(s) par le LLM. Vérifiez et ajustez si nécessaire.`, `${state.lastFilledCount} Feld(er) vom LLM vorausgefüllt. Überprüfen und anpassen falls nötig.`);

        const successBannerHtml = (zone !== 'actors' && state.lastFilledCount > 0 && !loading && !state.error)
          ? `<div class="llm-success-banner">
              <span>${sbUiIcon('checkCircle', 14)} ${successMessage}</span>
              <button data-action="llm-dismiss-banner" data-zone="${zone}">${tt('OK', 'OK', 'OK')}</button>
             </div>`
          : '';

        return `
          <div class="llm-config-block${collapsed ? ' collapsed' : ''}" id="llm-block-${zone}">
            <div class="llm-config-header">
              <span class="llm-config-title">${sbUiIcon('bot', 16)} ${title}</span>
              <button class="btn-llm-collapse" data-action="llm-collapse" data-zone="${zone}">
                ${collapsed ? sbUiIcon('chevronRight', 13) + ' ' + tt('Expand', 'Développer', 'Erweitern') : sbUiIcon('down', 13) + ' ' + tt('Reduce', 'Réduire', 'Reduzieren')}
              </button>
            </div>
            <div class="llm-config-body">
              <p class="llm-config-subtitle">${subtitle}</p>
              <textarea
                data-llm-zone="${zone}"
                placeholder="${escapeAttribute(placeholder)}"
                class="${state.error === 'empty' ? 'textarea-error' : ''}"
              >${escapeHtml(state.text || '')}</textarea>
              ${errorHtml}
              ${rawResponseHtml}
              <div class="llm-config-actions">
                <button class="btn-llm-generate" data-action="llm-generate-${zone}" ${disabledAttr}
                  ${noKeyTooltip ? `title="${noKeyTooltip}"` : ''}
                >${generateLabel}</button>
                <button class="btn-llm-clear" data-action="llm-clear" data-zone="${zone}">${tt('Clear', 'Effacer', 'Löschen')}</button>
              </div>
              ${successBannerHtml}
              ${pendingActorsHtml}
            </div>
          </div>
        `;
      }

      function renderPendingActorsPanel(pendingActors) {
        const actorCount = appState.scenario.actors.length;
        const warningHtml = actorCount > 0
          ? `<p class="llm-actors-warning">${tt(
              `The table already contains ${actorCount} actor(s). Generated actors will be added. To replace all actors, clear the table first.`,
              `Le tableau contient déjà ${actorCount} acteur(s). Les acteurs générés seront ajoutés. Pour tout remplacer, videz d'abord le tableau.`,
              `Die Tabelle enthält bereits ${actorCount} Akteur(e). Generierte Akteure werden hinzugefügt. Um alle zu ersetzen, leeren Sie zuerst die Tabelle.`
            )}</p>`
          : '';
        return `
          <div class="llm-actors-panel">
            ${warningHtml}
            ${pendingActors.map((actor, idx) => `
              <div class="llm-actor-row" id="llm-actor-row-${idx}">
                <div class="llm-actor-info">
                  <strong>${escapeHtml(actor.name)}</strong>
                  <span>${escapeHtml(roleLabel(actor.role))} · ${escapeHtml(actor.organization)} · ${escapeHtml(actor.title)} · ${escapeHtml(actor.language)}</span>
                </div>
                <button class="btn btn-primary" style="font-size:12px;padding:4px 10px;" data-action="llm-actor-add" data-idx="${idx}">${tt('Add', 'Ajouter', 'Hinzufügen')}</button>
                <button class="btn btn-ghost" style="font-size:12px;padding:4px 10px;" data-action="llm-actor-ignore" data-idx="${idx}">${tt('Ignore', 'Ignorer', 'Ignorieren')}</button>
              </div>
            `).join('')}
            <div class="llm-actors-global-actions">
              <button class="btn btn-primary" data-action="llm-actor-add-all">${tt('Add all', 'Tout ajouter', 'Alle hinzufügen')}</button>
              <button class="btn btn-ghost" data-action="llm-actor-ignore-all">${tt('Ignore all', 'Tout ignorer', 'Alle ignorieren')}</button>
            </div>
          </div>
        `;
      }

      function actionButtonLabel(action, defaultLabel, loadingLabel) {
        return appState.ui?.actionLoading?.[action] ? loadingLabel : defaultLabel;
      }

      function exportAllProgressLabel(defaultLabel, loadingLabel) {
        const progress = appState.ui?.exportAllProgress;
        if (!progress) return actionButtonLabel('export-all', defaultLabel, loadingLabel);
        const suffix = progress.isVideo ? tt(' (video…)', ' (vidéo…)', ' (Video…)') : '';
        return `${tt('Exporting', 'Export', 'Export')} ${progress.current}/${progress.total}${suffix}`;
      }

      function pushToast(message, type = 'success', duration = 4200) {
        const id = uid('toast');
        appState.toasts.push({ id, message, type });
        renderToasts();
        setTimeout(() => {
          appState.toasts = appState.toasts.filter((toast) => toast.id !== id);
          renderToasts();
        }, duration);
      }

      function renderToasts() {
        const root = document.getElementById('toast-root');
        root.innerHTML = appState.toasts.map((toast) => `<div class="toast ${toast.type}">${escapeHtml(toast.message)}</div>`).join('');
      }

      function renderAppShell() {
        const vc = viewConfig();
        return `
          <div class="app-shell">
            ${appState.launchScreenOpen ? renderLaunchScreen() : ''}
            <header class="app-header">
              <div class="brand-bar">
                <a class="brand-lockup" href="https://www.wavestone.com/" target="_blank" rel="noopener noreferrer" title="Wavestone">
                  ${wavestoneLogo()}
                  <span class="brand-divider" aria-hidden="true"></span>
                  ${crisisMakerIcon(26, 'cm-icon brand-mark')}
                  <span class="brand-product">Crisis<b>Maker</b></span>
                </a>
                <div class="brand-project">
                  <span class="brand-project-label">${tt('Current exercise', 'Exercice en cours', 'Aktuelle Übung')}</span>
                  <span class="nav-project-name">${escapeHtml(appState.scenario.name || tt('CrisisMaker project', 'Projet CrisisMaker', 'CrisisMaker-Projekt'))}</span>
                </div>
                <div class="brand-actions">
                  <span id="save-indicator" class="save-indicator"></span>
                  ${(() => {
                    /* Configured is not reachable: a failed connection test, or a model list that could not be
                       fetched from the configured server, says so instead of "AI connected". */
                    const provider = appState.scenario.settings.ai_provider;
                    const unreachable = isLLMAvailable() && ((appState.connectionTest?.status === 'error' && appState.connectionTest.provider === provider)
                      || (appState.aiModelCatalog?.provider === provider && appState.aiModelCatalog.status === 'error'));
                    const tone = !isLLMAvailable() ? 'is-off' : unreachable ? 'is-error' : 'is-live';
                    const label = !isLLMAvailable() ? tt('AI disconnected', 'IA déconnectée', 'KI getrennt') : unreachable ? tt('AI unreachable', 'IA injoignable', 'KI nicht erreichbar') : tt('AI connected', 'IA connectée', 'KI verbunden');
                    return `<button class="ai-status ${tone}" data-action="toggle-settings-drawer" title="${tt('AI connection settings', 'Paramètres de connexion IA', 'KI-Verbindungseinstellungen')}">${label}</button>`;
                  })()}
                  <button class="nav-gear-btn" data-action="show-launch-screen" title="${tt('Home', 'Accueil', 'Startseite')}">
                    ${svgHome()}
                  </button>
                  <button class="nav-gear-btn" data-action="save-local" title="${tt('Save', 'Sauvegarder', 'Speichern')}">
                    ${svgSave()}
                  </button>
                  <button class="nav-gear-btn ${appState.settingsDrawerOpen ? 'active' : ''}" data-action="toggle-settings-drawer" title="${tt('Settings', 'Paramètres', 'Einstellungen')}">
                    ${svgGear()}
                  </button>
                </div>
              </div>
              <nav class="nav-topbar" aria-label="${tt('Workspace', 'Espace de travail', 'Arbeitsbereich')}">
                <div class="nav-topbar-left">
                  ${renderNavIconButton('project', svgFolder(), tt('Project', 'Projet', 'Projekt'))}
                  ${renderNavIconButton('scenario', svgTarget(), tt('Context', 'Contexte', 'Kontext'))}
                  ${renderNavIconButton('storyline', svgStoryboard(), 'Main storyline')}
                  ${renderNavIconButton('cells', svgUsers(), 'Cells & actors')}
                  ${renderNavIconButton('detailed', svgPen(), 'Detailed storyline')}
                  ${renderNavIconButton('library', svgGrid(), tt('Injects library', 'Bibliothèque d’injects', 'Inject-Bibliothek'))}
                  ${renderNavIconButton('summary', svgShieldCheck(), 'Check & Challenge')}
                  ${renderNavIconButton('play', svgBroadcast(), 'Play')}
                  ${renderNavIconButton('evaluation', svgEvaluation(), tt('Evaluation', 'Évaluation', 'Bewertung'))}
                  ${renderNavIconButton('debrief', svgDebrief(), tt('Debrief', 'Debrief', 'Debrief'))}
                </div>
              </nav>
            </header>

            <div class="settings-drawer ${appState.settingsDrawerOpen ? 'open' : ''}" role="dialog" aria-modal="true" aria-label="${tt('Settings', 'Paramètres', 'Einstellungen')}" aria-hidden="${appState.settingsDrawerOpen ? 'false' : 'true'}" ${appState.settingsDrawerOpen ? '' : 'inert'}>
              <div class="settings-drawer-header">
                <h3>${tt('Settings', 'Paramètres', 'Einstellungen')}</h3>
                <button class="btn btn-secondary" data-action="toggle-settings-drawer" aria-label="Close">${sbUiIcon('close', 16)}</button>
              </div>
              <div class="settings-drawer-body">
                <article class="card settings-agent-card">
                  <div class="section-header"><div><h3>${sbUiIcon('bot', 16)} ${tt('AI agent', 'Agent IA', 'KI-Agent')}</h3><p class="subtle">${tt('The agent builds and updates the exercise from any tab. Its console lets you run it directly, review every step and undo a run.', 'L\'agent construit et met à jour l\'exercice depuis chaque onglet. Sa console permet de le lancer directement, de suivre chaque étape et d\'annuler une exécution.', 'Der Agent erstellt und aktualisiert die Übung aus jedem Tab. In seiner Konsole starten Sie ihn direkt, prüfen jeden Schritt und machen einen Lauf rückgängig.')}</p></div></div>
                  <button class="btn btn-secondary" data-agent-action="open-console">${sbUiIcon('open', 14)} ${tt('Open the agent console', 'Ouvrir la console de l\'agent', 'Agent-Konsole öffnen')}</button>
                </article>
                ${renderSettingsView()}
              </div>
            </div>

            <main class="content ${appState.route === 'debrief' && debriefPart() === 'video' ? 'content-video-debrief' : ''} ${appState.route === 'debrief' ? 'content-debrief' : ''} ${['storyline', 'detailed', 'builder', 'stimuli'].includes(appState.route) ? 'content-builder' : ''}">
              ${vc ? `<section class="topbar">
                <div class="page-title">
                  <h2>${vc.title}</h2>
                  <p>${vc.subtitle}</p>
                </div>
              </section>` : ''}
              ${renderCurrentView()}
            </main>
            ${appState.historyModalStimulusId ? renderHistoryModal(getStimulus(appState.historyModalStimulusId)) : ''}
            ${appState.stimulusModalId ? renderStimulusModal(getStimulus(appState.stimulusModalId)) : ''}
            ${appState.chronogramImport ? renderChronogramImportModals() : ''}
            ${appState.techLogOpen ? renderTechLogModal() : ''}
            ${renderAssistant()}
          </div>
        `;
      }

      /* Settings → Technical log: every AI attempt and error of the session, keys masked. */
      function renderTechLogModal() {
        const entries = typeof CrisisTechLog !== 'undefined' ? CrisisTechLog.entries : [];
        const failed = entries.filter((entry) => entry.kind === 'error' || entry.ok === false).length;
        return `
          <div class="modal-backdrop tech-log-backdrop">
            <div class="modal-box tech-log-box" role="dialog" aria-modal="true" aria-label="Technical log">
              <div class="modal-header">
                <h3>${tt('Technical log', 'Journal technique', 'Technisches Protokoll')} <small>${entries.length} ${tt('entries', 'entrées', 'Einträge')}${failed ? ` · ${failed} ${tt('failed', 'en échec', 'fehlgeschlagen')}` : ''}</small></h3>
                <button class="btn btn-secondary" data-action="tech-log-close" aria-label="Close">${sbUiIcon('close', 16)}</button>
              </div>
              <div class="modal-body">
                <p class="helper">${tt('Every AI call of this session (provider, model, size of the request, duration, HTTP status, stop reason, attempt, start of the reply) and every error, newest first. API keys are masked and prompts are never recorded, but replies may contain exercise content. Kept in memory only: a reload clears it.', 'Chaque appel IA de la session (fournisseur, modèle, taille de la requête, durée, statut HTTP, raison d’arrêt, tentative, début de la réponse) et chaque erreur, du plus récent au plus ancien. Les clés API sont masquées et les prompts ne sont jamais enregistrés, mais les réponses peuvent contenir du contenu de l’exercice. En mémoire seulement : un rechargement l’efface.', 'Jeder KI-Aufruf dieser Sitzung (Anbieter, Modell, Anfragegröße, Dauer, HTTP-Status, Stoppgrund, Versuch, Anfang der Antwort) und jeder Fehler, neueste zuerst. API-Schlüssel sind maskiert, Prompts werden nie gespeichert, Antworten können aber Übungsinhalte enthalten. Nur im Speicher: Neuladen löscht es.')}</p>
                <div class="actions tech-log-actions">
                  <button class="btn btn-secondary btn-sm" data-action="tech-log-refresh">${sbUiIcon('undo', 13)} ${tt('Refresh', 'Actualiser', 'Aktualisieren')}</button>
                  <button class="btn btn-secondary btn-sm" data-action="tech-log-copy">${tt('Copy', 'Copier', 'Kopieren')}</button>
                  <button class="btn btn-primary btn-sm" data-action="tech-log-download">${sbUiIcon('download', 13)} ${tt('Download (.txt)', 'Télécharger (.txt)', 'Herunterladen (.txt)')}</button>
                  <button class="btn btn-ghost btn-sm" data-action="tech-log-clear">${tt('Clear', 'Effacer', 'Leeren')}</button>
                </div>
                <pre class="tech-log-pre">${escapeHtml(typeof CrisisTechLog !== 'undefined' ? CrisisTechLog.text() : '')}</pre>
              </div>
            </div>
          </div>`;
      }

      function renderNavIconButton(route, iconSvg, label) {
        const isActive = appState.route === route;
        return `<button class="nav-icon-btn ${isActive ? 'active' : ''}" data-route="${route}" title="${label}">
          ${iconSvg}
          <span>${label}</span>
        </button>`;
      }

      // Official Wavestone wordmark, taken from the header of wavestone.com. It inherits
      // its color from CSS (currentColor), so the same mark works on light and dark bands.
      const WAVESTONE_LOGO_PATH = 'M208.544 37.996c-2.614.042-5.105-.49-7.534-1.36-2.931-1.05-5.357-2.774-7.088-5.32-1.249-1.838-2.093-3.872-2.111-6.104-.014-1.71.018-3.46.373-5.122.425-1.99 1.465-3.741 2.916-5.289 2.532-2.704 5.636-4.248 9.315-4.774 1.234-.176 2.49-.563 3.703-.466 2.274.18 4.548.532 6.772 1.023 2.147.473 4.016 1.599 5.708 2.977 1.405 1.143 2.419 2.57 3.26 4.138 1.018 1.904 1.359 3.99 1.391 6.06.028 1.895-.401 3.788-1.175 5.602-.833 1.951-2.206 3.468-3.742 4.836-.901.801-2.022 1.46-3.161 1.9-1.745.673-3.568 1.17-5.395 1.599-1.043.245-2.153.207-3.235.297l.003.003Zm-.057-3.191c.898-.11 1.795-.2 2.689-.339 1.887-.297 3.487-1.257 4.658-2.615 1.905-2.207 2.621-4.956 2.692-7.789.036-1.385-.372-2.788-.656-4.17-.738-3.567-2.951-5.844-6.538-6.807-2.273-.612-4.487-.443-6.757.348-3.243 1.127-4.835 3.527-5.648 6.49-.596 2.177-.585 4.46-.213 6.713.327 1.965 1.121 3.73 2.473 5.23 1.93 2.144 4.452 2.897 7.3 2.935v.004ZM159.506 15.91c-2.696-1.74-5.573-2.642-8.56-3.064-2.618-.37-5.243-.217-7.669 1.116-1.401.77-2.096 2.88-.216 3.931 1.365.763 2.88 1.31 4.381 1.786 1.926.611 3.955.933 5.856 1.61 1.863.663 3.768 1.405 5.385 2.49 1.788 1.195 2.842 3.019 2.962 5.26.096 1.818-.362 3.438-1.497 4.864-1.266 1.596-2.994 2.543-4.934 3.154a19.396 19.396 0 0 1-8.407.743c-2.168-.287-4.346-.76-6.407-1.454-2.057-.695-3.976-1.77-6.084-2.736l2.065-2.922c1.834.853 3.54 1.754 5.328 2.455 2.682 1.05 5.488 1.548 8.397 1.275 1.504-.142 3.018-.397 4.214-1.33 2.313-1.803 1.359-3.285-.607-4.414-2.426-1.396-5.271-1.82-7.988-2.512a28.462 28.462 0 0 1-3.643-1.184c-1.359-.55-2.672-1.199-3.764-2.215-2.129-1.979-2.657-4.352-1.948-7.063.699-2.664 2.65-4.18 5.112-5.13 3.182-1.23 6.509-1.596 9.879-1.036 2.2.366 4.364.957 6.528 1.513 1.45.373 1.61.656 1.61 2.131v2.732h.007Zm113.459-1.99v8.004h15.357v3.32h-15.329v8.075h17.006v3.71H266.52V10.25h23.111v3.671h-16.669.003ZM129.656 37.022H106.35v-26.77h23.111v3.665H112.66v8.014h15.488v3.299h-15.495v8.079h17.003v3.713Zm128.958.608c-7.896-5.955-15.722-11.855-23.714-17.886V37.01h-3.693V9.585c8.003 6.035 15.896 11.99 23.888 18.018V10.169h3.519V37.63Zm-226.567.27L16.41 10.204h1.1c2.011 0 4.022.062 6.027-.028.89-.041 1.44.26 1.82.947 1.014 1.837 1.99 3.696 3.008 5.53.727 1.305 1.518 2.577 2.245 3.882.703 1.258 1.352 2.54 2.044 3.8.202.366.471.694.77 1.122.9-1.582 1.713-3.077 2.596-4.535a135.44 135.44 0 0 1 3.239-5.105c1.199-1.793 2.387-3.596 3.724-5.289 1.72-2.183 3.566-4.273 5.396-6.373A62.574 62.574 0 0 1 51.689.65c.333-.324.883-.584 1.348-.608 1.44-.08 2.887-.027 4.593-.027C46.041 10.8 37.486 23.316 32.043 37.9h.004Zm31.429-5.586c-4.3 0-8.525.007-12.753-.01-.522 0-.766.183-.997.636-.65 1.264-1.366 2.494-2.09 3.723-.106.183-.375.38-.574.384-1.444.03-2.884.017-4.523.017 5.161-9.21 10.252-18.287 15.406-27.482 5.14 9.174 10.21 18.228 15.392 27.485h-2.951c-1.004 0-2.019-.076-3.012.021-.961.093-1.504-.231-1.908-1.067-.603-1.244-1.306-2.442-1.99-3.703v-.004ZM56.76 20.19c-1.685 3.06-3.256 5.917-4.838 8.787h9.688l-4.846-8.787h-.004Zm44.035-9.983-15.431 27.53c-5.18-9.24-10.28-18.342-15.42-27.513h7.254c3.047 5.51 6.101 11.023 9.198 16.619.383-.608.763-1.147 1.075-1.724.677-1.247 1.287-2.532 1.98-3.768.695-1.25 1.479-2.456 2.188-3.7a343.308 343.308 0 0 0 2.976-5.344c.327-.597.571-1.24.908-1.83.086-.149.387-.256.59-.26 1.5-.02 2.997-.01 4.685-.01h-.003Zm79.939 26.801h-6.513V13.865h-10.032V10.2h26.489v3.72h-9.94v23.088h-.004Zm-165.172.716L0 10.266h8.354c.798 1.361 1.618 2.712 2.39 4.083.71 1.26 1.36 2.55 2.051 3.817.696 1.268 1.412 2.528 2.122 3.79.99 1.754 1.99 3.502 2.976 5.257.514.915 1.032 1.83 1.504 2.766.128.253.241.65.128.854-1.2 2.162-2.448 4.3-3.682 6.445-.072.121-.15.235-.288.442l.007.004Z';
      function wavestoneLogo(className = 'wavestone-logo') {
        return `<svg class="${className}" viewBox="0 0 290 38" role="img" aria-label="Wavestone" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="${WAVESTONE_LOGO_PATH}"/></svg>`;
      }

      function svgBroadcast() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.2 7.8a6 6 0 0 1 0 8.4"></path><path d="M7.8 16.2a6 6 0 0 1 0-8.4"></path><path d="M19.1 4.9a10 10 0 0 1 0 14.2"></path><path d="M4.9 19.1a10 10 0 0 1 0-14.2"></path></svg>'; }
      function svgUsers() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4"></circle><path d="M2 21a7 7 0 0 1 14 0"></path><path d="M16 4a4 4 0 0 1 0 8"></path><path d="M22 21a7 7 0 0 0-5-6.7"></path></svg>'; }
      function svgStoryboard() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M2 9h20"></path><path d="M6 13h5"></path><path d="M9 16h8"></path><path d="M14 13h4"></path><path d="M7 4v5"></path><path d="M12 4v5"></path><path d="M17 4v5"></path></svg>'; }
      function svgFolder() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'; }
      function svgTarget() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>'; }
      function svgPen() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>'; }
      function svgGrid() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'; }
      function svgDebrief() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"></path><path d="M4 16h5l3-4 3 2 5-7"></path><circle cx="9" cy="16" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="15" cy="14" r="1"></circle><circle cx="20" cy="7" r="1"></circle></svg>'; }
      function svgEvaluation() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M9 3v2h6V3"></path><path d="m9 11 1.5 1.5L13 10"></path><path d="M9 16h6"></path></svg>'; }
      function svgVideo() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="14" rx="2"></rect><path d="m17 10 4-2v8l-4-2z"></path><path d="m9 9 4 3-4 3z"></path></svg>'; }
      function svgShieldCheck() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>'; }
      function svgGear() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'; }
      function svgSave() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>'; }
      function svgHome() { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>'; }

      /* One card per tab, in the order of the nav; a click opens that tab. */
      function renderLaunchFeatureCards() {
        const cards = [
          ['project', svgFolder(), tt('Project', 'Projet', 'Projekt'), tt('The exercise at a glance, projects to open, save and export, and a library of ready-made scenarios to start from.', 'L’exercice en un coup d’œil, les projets à ouvrir, sauvegarder et exporter, et une bibliothèque de scénarios prêts à l’emploi pour démarrer.', 'Die Übung auf einen Blick, Projekte zum Öffnen, Speichern und Exportieren sowie eine Bibliothek fertiger Szenarien als Ausgangspunkt.')],
          ['scenario', svgTarget(), tt('Context', 'Contexte', 'Kontext'), tt('Set the client, duration, simulated dates, cells, players and languages, describe your objectives and ideas, and let the AI agent build the exercise with you.', 'Renseignez le client, la durée, les dates simulées, les cellules, les joueurs et les langues, décrivez vos objectifs et vos idées, et laissez l’agent IA construire l’exercice avec vous.', 'Auftraggeber, Dauer, simulierte Daten, Zellen, Spieler und Sprachen festlegen, Ziele und Ideen beschreiben und die Übung gemeinsam mit dem KI-Agenten aufbauen.')],
          ['storyline', svgStoryboard(), 'Main storyline', tt('Lay out the phases of the crisis on a single timeline and write what happens in each one, by hand or with AI.', 'Disposez les phases de la crise sur une timeline unique et décrivez ce qui se passe dans chacune, à la main ou avec l’IA.', 'Die Phasen der Krise auf einer einzigen Zeitachse anordnen und beschreiben, was in jeder passiert, von Hand oder mit KI.')],
          ['cells', svgUsers(), 'Cells & actors', tt('Create the player cells and their participants, and the simulated actors who send injects: attackers, press, authorities.', 'Créez les cellules de joueurs et leurs participants, et les acteurs simulés qui envoient les injects : attaquants, presse, autorités.', 'Spielerzellen und ihre Teilnehmer anlegen sowie die simulierten Akteure, die Injects senden: Angreifer, Presse, Behörden.')],
          ['detailed', svgPen(), 'Detailed storyline', tt('Pick a cell and plan its injects under the main storyline, then write them with AI and keep them in sync.', 'Choisissez une cellule et planifiez ses injects sous la storyline principale, puis rédigez-les avec l’IA et gardez-les synchronisés.', 'Eine Zelle wählen und ihre Injects unter der Haupt-Storyline planen, dann mit KI schreiben und synchron halten.')],
          ['library', svgGrid(), tt('Injects library', 'Bibliothèque d’injects', 'Inject-Bibliothek'), tt('Every inject of the scenario, gathered by phase and filterable by cell: preview them for facilitation and export them as styled images or a ZIP.', 'Tous les injects du scénario, regroupés par phase et filtrables par cellule : prévisualisez-les pour l’animation et exportez-les en images stylées ou en ZIP.', 'Alle Injects des Szenarios, nach Phase gruppiert und nach Zelle filterbar: für die Moderation ansehen und als gestaltete Bilder oder ZIP exportieren.')],
          ['summary', svgShieldCheck(), 'Check & Challenge', tt('Know whether the exercise is ready to play: live consistency checks, the load of each cell by phase, one AI challenge on coverage, pacing and realism, and a ready-to-play checklist.', 'Sachez si l’exercice est prêt à être joué : contrôles de cohérence en continu, charge de chaque cellule par phase, un challenge IA sur la couverture, le rythme et le réalisme, et une checklist « Prêt à jouer ».', 'Wissen, ob die Übung spielbereit ist: laufende Konsistenzprüfungen, Last jeder Zelle pro Phase, eine KI-Challenge zu Abdeckung, Tempo und Realismus und eine Spielbereit-Checkliste.')],
          ['play', svgBroadcast(), 'Play', tt('Run the exercise live: a permanent control bar with the clock, current phase and next inject, a vertical chronogram to send each inject on time, and an exercise log.', 'Animez l’exercice en direct : un bandeau de pilotage avec l’horloge, la phase en cours et le prochain inject, un chronogramme vertical pour envoyer chaque inject à temps, et un journal de l’exercice.', 'Übung live durchführen: Steuerleiste mit Uhr, aktueller Phase und nächstem Inject, vertikales Chronogramm zum pünktlichen Senden und ein Übungsprotokoll.')],
          ['evaluation', svgEvaluation(), tt('Evaluation', 'Évaluation', 'Bewertung'), tt('Assess the players against each objective and inject: marks and observations per criterion, completed with AI when you wish.', 'Évaluez les joueurs sur chaque objectif et chaque inject : notes et observations par critère, complétées avec l’IA si vous le souhaitez.', 'Die Spieler anhand jedes Ziels und Injects bewerten: Noten und Beobachtungen pro Kriterium, auf Wunsch mit KI ergänzt.')],
          ['debrief', svgDebrief(), tt('Debrief', 'Debrief', 'Debrief'), tt('Three ways to debrief: Slide debrief, a PowerPoint deck with the timeline and key messages; Story debrief, an interactive page revealing the hidden scenario; Video debrief, a documentary MP4 produced in your browser.', 'Trois façons de débriefer : Slide debrief, un deck PowerPoint avec la timeline et les messages clés ; Story debrief, une page interactive qui révèle le scénario caché ; Video debrief, un MP4 documentaire produit dans votre navigateur.', 'Drei Arten der Nachbesprechung: Slide debrief, ein PowerPoint-Deck mit Zeitachse und Kernbotschaften; Story debrief, eine interaktive Seite, die das verborgene Szenario zeigt; Video debrief, ein dokumentarisches MP4, im Browser erstellt.')]
        ];
        return cards.map(([route, icon, title, text]) => `<button type="button" class="launch-feature-card" data-action="launch-open-route" data-launch-route="${route}" title="${escapeAttribute(tt(`Open ${title}`, `Ouvrir ${title}`, `${title} öffnen`))}">
                      <div class="launch-feature-icon">${icon}</div>
                      <strong>${escapeHtml(title)}</strong>
                      <p>${escapeHtml(text)}</p>
                    </button>`).join('');
      }

      function renderLaunchScreen() {
        const llmAvailable = isLLMAvailable();
        return `
          <div class="launch-screen-overlay" data-action="close-launch-screen" role="dialog" aria-modal="true" aria-label="${tt('CrisisMaker welcome', 'Bienvenue dans CrisisMaker', 'Willkommen bei CrisisMaker')}">
            <div class="launch-screen" onclick="event.stopPropagation()">

              <div class="launch-hero">
                <button class="launch-hero-close" data-action="close-launch-screen" title="${tt('Close', 'Fermer', 'Schließen')}">${sbUiIcon('close', 16)}</button>
                <div class="launch-brand">
                  ${wavestoneLogo('wavestone-logo wavestone-logo-light')}
                  <span class="brand-divider" aria-hidden="true"></span>
                  <span class="hero-kicker">CrisisMaker</span>
                </div>
                <h1 class="launch-hero-title">${tt('Design, run, and debrief crisis exercises.', 'Concevez, animez et débriefez vos exercices de crise.', 'Entwerfen, leiten und debriefen Sie Krisenübungen.')}</h1>
                <p class="launch-hero-desc">${tt('A platform to design and run crisis exercises: build the scenario and its phases, organise the player cells and their objectives, plan and write the injects of each phase, play the exercise, then debrief it.', 'Une plateforme pour concevoir et animer des exercices de crise : construisez le scénario et ses phases, organisez les cellules de joueurs et leurs objectifs, planifiez et rédigez les injects de chaque phase, jouez l’exercice, puis débriefez-le.', 'Eine Plattform zum Entwerfen und Durchführen von Krisenübungen: Szenario und Phasen aufbauen, Spielerzellen und ihre Ziele organisieren, die Injects jeder Phase planen und schreiben, die Übung spielen und nachbesprechen.')}</p>
                <div class="launch-hero-stats">
                  <div class="hero-stat">
                    <strong>${tt('Stand alone or AI powered', 'Autonome ou propulsé par l\'IA', 'Eigenständig oder KI-gestützt')}</strong>
                    <span>${llmAvailable ? tt('AI connected — ready for automatic content generation', 'IA connectée — prête pour la génération automatique de contenu', 'KI verbunden — bereit für automatische Inhaltsgenerierung') : tt('Depending on your requirements — configure an API key in Settings to unlock AI features', 'Selon vos besoins — configurez une clé API dans les Paramètres pour activer les fonctions IA', 'Je nach Bedarf — konfigurieren Sie einen API-Schlüssel in den Einstellungen, um KI-Funktionen freizuschalten')}</span>
                  </div>
                  <div class="hero-stat">
                    <strong>${tt('Local-first', 'Local d\'abord', 'Lokal-zuerst')}</strong>
                    <span>${tt('Data stays in your browser — no server, no account', 'Vos données restent dans votre navigateur — sans serveur ni compte', 'Daten bleiben in Ihrem Browser — kein Server, kein Konto')}</span>
                  </div>
                  <div class="hero-stat">
                    <strong>${tt('Export-ready', 'Prêt à l\'export', 'Exportbereit')}</strong>
                    <span>${tt('.json · .zip · styled images · interactive HTML · MP4 video', '.json · .zip · images stylées · HTML interactif · vidéo MP4', '.json · .zip · gestaltete Bilder · interaktives HTML · MP4-Video')}</span>
                  </div>
                </div>
              </div>

              <div class="launch-body">
                <div>
                  <div class="welcome-block-title" style="margin-bottom:14px;">${tt('What you can do', 'Ce que vous pouvez faire', 'Was Sie tun können')}</div>
                  <div class="launch-features">
                    ${renderLaunchFeatureCards()}
                  </div>
                </div>

                <div>
                  <div class="welcome-block-title" style="margin-bottom:14px;">${tt('Getting started', 'Pour commencer', 'Erste Schritte')}</div>
                  <div class="launch-tips">
                    <div class="launch-tip">
                      <div class="launch-tip-num">1</div>
                      <span><strong>Frame the exercise</strong>: pick a scenario in the Project library if you like, then fill in the Context tab and generate the exercise with AI.</span>
                    </div>
                    <div class="launch-tip">
                      <div class="launch-tip-num">2</div>
                      <span><strong>Shape the main storyline</strong>: adjust the phases on the timeline and describe what happens in each, then set up the cells and actors.</span>
                    </div>
                    <div class="launch-tip">
                      <div class="launch-tip-num">3</div>
                      <span><strong>Detail each cell</strong>: in Detailed storyline, plan and write the injects of every cell, then challenge the whole exercise in Check &amp; Challenge.</span>
                    </div>
                    <div class="launch-tip">
                      <div class="launch-tip-num">4</div>
                      <span>${tt('<strong>Run the exercise</strong>: in Play, start the clock and send each numbered inject on time; the exercise log records everything and can be saved.', '<strong>Animez l’exercice</strong> : dans Play, lancez l’horloge et envoyez chaque inject numéroté à temps ; le journal de l’exercice consigne tout et peut être enregistré.', '<strong>Übung durchführen</strong>: in Play die Uhr starten und jeden nummerierten Inject pünktlich senden; das Übungsprotokoll hält alles fest und kann gespeichert werden.')}</span>
                    </div>
                    <div class="launch-tip">
                      <div class="launch-tip-num">5</div>
                      <span>${tt('<strong>Evaluate and debrief</strong>: mark the players in Evaluation, then debrief with a slide deck, an interactive story page or a documentary video.', '<strong>Évaluez et débriefez</strong> : notez les joueurs dans Évaluation, puis débriefez avec un deck de slides, une page interactive qui raconte l’histoire ou une vidéo documentaire.', '<strong>Bewerten und nachbesprechen</strong>: die Spieler in Bewertung benoten, dann mit einem Foliensatz, einer interaktiven Story-Seite oder einem Dokumentarvideo nachbesprechen.')}</span>
                    </div>
                    <div class="launch-tip">
                      <div class="launch-tip-num">${sbUiIcon('star', 13)}</div>
                      <span>${tt('<strong>Start from an existing exercise</strong>: load its chronogram (.xlsx, .xls or .pptx) in the Context tab to use it as a reference for the agent, or challenge it as is in Check &amp; Challenge.', '<strong>Partez d’un exercice existant</strong> : chargez son chronogramme (.xlsx, .xls ou .pptx) dans l’onglet Contexte pour qu’il serve de référence à l’agent, ou challengez-le tel quel dans Check &amp; Challenge.', '<strong>Von einer bestehenden Übung ausgehen</strong>: Chronogramm (.xlsx, .xls oder .pptx) im Tab Kontext laden, als Referenz für den Agenten nutzen oder direkt in Check &amp; Challenge hinterfragen.')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="launch-actions">
                <button class="btn btn-primary launch-start-btn" data-action="close-launch-screen">${tt('Ready to start a crisis?', 'Prêt à démarrer une crise ?', 'Bereit, eine Krise zu starten?')} →</button>
              </div>

              <div class="launch-footer">
                <span>© 2026 Wavestone — ${tt('All rights reserved.', 'Tous droits réservés.', 'Alle Rechte vorbehalten.')}</span>
                <a href="./LICENSE" target="_blank" rel="noopener noreferrer">${tt('View License', 'Voir la licence', 'Lizenz anzeigen')}</a>
              </div>

            </div>
          </div>
        `;
      }

      function viewConfig() {
        if (appState.route === 'checker') appState.route = 'summary';
        const map = {
          project: {
            title: tt('Project', 'Projet', 'Projekt'),
            subtitle: tt('Project summary, data and scenario library.', 'Synthèse, données et bibliothèque de scénarios.', 'Projektübersicht, Daten und Szenario-Bibliothek.')
          },
          scenario: {
            title: tt('Context', 'Contexte', 'Kontext'),
            subtitle: tt('Frame the exercise, then build it with the AI agent.', 'Cadrez l\'exercice, puis construisez-le avec l\'agent IA.', 'Übung einordnen und mit dem KI-Agenten erstellen.')
          },
          cells: {
            title: 'Cells & actors',
            subtitle: tt('Player cells and the simulated actors who send injects.', 'Cellules de joueurs et acteurs simulés qui envoient les injects.', 'Spielerzellen und simulierte Akteure, die Injects senden.')
          },
          play: {
            title: 'Play',
            subtitle: tt('Run the exercise live: start the clock, send each inject on time and keep the exercise log.', 'Animez l\'exercice en direct : lancez l\'horloge, envoyez chaque inject à temps et tenez le journal de l\'exercice.', 'Übung live durchführen: Uhr starten, jeden Inject pünktlich senden und das Übungsprotokoll führen.')
          },
          summary: {
            title: 'Check & Challenge',
            subtitle: tt('Is the exercise ready to play? Live checks, an AI challenge and the readiness checklist.', 'L\'exercice est-il prêt à jouer ? Contrôles en continu, challenge IA et checklist de préparation.', 'Ist die Übung spielbereit? Laufende Prüfungen, KI-Challenge und Bereitschafts-Checkliste.')
          },
          stimuli: {
            title: 'Detailed storyline',
            subtitle: tt('Write the injects and generate their content.', 'Rédigez les injects et générez leur contenu.', 'Injects schreiben und Inhalte generieren.')
          },
          evaluation: {
            title: tt('Evaluation', 'Évaluation', 'Bewertung'),
            subtitle: tt('One evaluation sheet per cell, to adjust and download for the evaluators.', 'Une grille d’évaluation par cellule, à ajuster et télécharger pour les évaluateurs.', 'Ein Bewertungsbogen pro Zelle, anpassbar und für die Bewertenden herunterladbar.')
          },
          library: {
            title: tt('Injects library', 'Bibliothèque d’injects', 'Inject-Bibliothek'),
            subtitle: tt('Every inject of the scenario, phase by phase.', 'Tous les injects du scénario, phase par phase.', 'Alle Injects des Szenarios, Phase für Phase.')
          },
          agent: {
            title: 'Agent',
            subtitle: tt('Build and challenge the exercise with controlled AI tools.', 'Construisez et challengez l\'exercice avec des outils IA contrôlés.', 'Übung mit kontrollierten KI-Werkzeugen erstellen und hinterfragen.')
          },
          debrief: {
            title: 'Debrief',
            subtitle: debriefPart() === 'video'
              ? tt('Turn the crisis story into a documentary video, produced right in your browser.', 'Transformez le récit de crise en vidéo documentaire, produite directement dans votre navigateur.', 'Krisengeschichte als Dokumentarvideo, direkt im Browser produziert.') + ' <a href="https://www.youtube.com/watch?v=TOQqu7rdkPw" target="_blank" rel="noopener">' + tt('See an example', 'Voir un exemple', 'Beispiel ansehen') + '</a>'
              : debriefPart() === 'story'
                ? tt('Build an interactive timeline that reveals what really happened.', 'Construisez une timeline interactive qui révèle ce qui s\'est vraiment passé.', 'Interaktive Zeitleiste erstellen, die zeigt, was wirklich geschah.')
                : 'Three ways to debrief the exercise: a slide deck, an interactive story page, a documentary video.'
          }
        };
        return map[appState.route] || null;
      }

      function renderCurrentView() {
        if (appState.route === 'builder') appState.route = 'storyline';
        if (appState.route === 'stimuli') appState.route = 'detailed';
        if (appState.route === 'checker') appState.route = 'summary';
        if (appState.route === 'project') return renderProjectView();
        if (appState.route === 'scenario') return renderScenarioView();
        if (appState.route === 'storyline') return renderStorylineView();
        if (appState.route === 'cells') return renderCellsView();
        if (appState.route === 'detailed') return renderDetailedView();
        if (appState.route === 'summary') return renderSummaryView();
        if (appState.route === 'play') return renderPlayView();
        if (appState.route === 'evaluation') return renderEvaluationView();
        if (appState.route === 'library') return renderLibraryView();
        if (appState.route === 'debrief') return renderDebriefView();
        if (appState.route === 'agent') return renderAgentView();
        return renderProjectView();
      }

      /* The studio iframe lives outside the re-rendered page (see mountVideoDebrief): this is
         only the slot it is placed over, so re-renders never reload it. */
      const VIDEO_DEBRIEF_SRC = 'video-debrief/index.html?integrated=2';
      function renderVideoDebriefView() {
        return `<section class="video-debrief-workspace" id="video-debrief-slot" aria-label="${escapeAttribute(tt('Video Debrief studio', 'Studio Video Debrief', 'Video-Debrief-Studio'))}"></section>`;
      }

      function renderProjectView() {
        const project = appState.scenario;
        StoryboardHistory.ensure(project);
        if (!Array.isArray(project.cells)) project.cells = [];
        if (!project.exercise) project.exercise = { players_count: '', cells_count: '' };
        return sbWithRenderMemo(() => {
          sbCaptureFocus();
          return `
          <section class="tab-page pj-page">
            ${renderProjectSummary(project)}
            ${renderProjectData()}
            ${renderProjectLibrary(project)}
          </section>`;
        });
      }

      // Block 1: who the exercise is for and how big it is.
      function renderProjectSummary(project) {
        const storyboard = sbStoryboard();
        const items = sbExerciseItems(project);
        const phases = sbMainBlocks(storyboard);
        const duration = Math.max(storyboard.duration_minutes, ...items.map((item) => item.time));
        const written = items.filter((item) => item.stimulus).length;
        const players = project.cells.reduce((sum, cell) => sum + cell.players.length, 0);
        const configured = project.stimuli.length || project.client.name || project.scenario.summary || storyboard.blocks.length;
        const lastSaved = project.updated_at
          ? new Date(project.updated_at).toLocaleString()
          : tt('Not saved yet', 'Pas encore sauvegardé', 'Noch nicht gespeichert');
        const facts = [
          [tt('Client', 'Client', 'Auftraggeber'), project.client.name],
          [tt('Sector', 'Secteur', 'Sektor'), project.client.sector],
          [tt('Scenario', 'Scénario', 'Szenario'), project.scenario.type],
          [tt('Start', 'Début', 'Start'), project.scenario.start_date ? formatLocalDateTime(project.scenario.start_date) : '']
        ];
        const metric = (value, label, foot = '') => `<div class="pj-metric"><span class="pj-metric-label">${escapeHtml(label)}</span><strong class="pj-metric-value">${value}</strong>${foot ? `<span class="pj-metric-foot">${escapeHtml(foot)}</span>` : ''}</div>`;
        return `
          <article class="card card-accent pj-summary">
            <div class="pj-summary-head">
              <div class="pj-summary-title">
                <span class="page-eyebrow">${tt('Project summary', 'Synthèse du projet', 'Projektübersicht')}</span>
                <h3>${escapeHtml(project.name || tt('Untitled project', 'Projet sans titre', 'Projekt ohne Titel'))}</h3>
                <dl class="pj-facts">${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`).join('')}</dl>
              </div>
              <div class="pj-saved">${sbUiIcon('save', 14)}<span>${tt('Last saved locally', 'Dernière sauvegarde locale', 'Zuletzt lokal gespeichert')}<strong>${escapeHtml(lastSaved)}</strong></span></div>
            </div>
            <div class="pj-metrics">
              ${metric(escapeHtml(sbFormatDuration(duration)), tt('Duration', 'Durée', 'Dauer'))}
              ${metric(phases.length, tt('Phases', 'Phases', 'Phasen'))}
              ${metric(`${written}<small>/${items.length}</small>`, tt('Injects written', 'Injects rédigés', 'Geschriebene Injects'), tt('written / planned', 'rédigés / prévus', 'geschrieben / geplant'))}
              ${metric(project.cells.length, tt('Cells', 'Cellules', 'Zellen'))}
              ${metric(players || escapeHtml(project.exercise.players_count || 0), tt('Players', 'Joueurs', 'Spieler'))}
              ${metric(project.actors.length, tt('Actors', 'Acteurs', 'Akteure'))}
            </div>
            ${configured ? '' : `<div class="pj-empty">
              <p class="subtle">${tt('No scenario configured yet. Start from the library below, or define the client, crisis context and actors.', 'Aucun scénario configuré. Partez de la bibliothèque ci-dessous, ou définissez le client, le contexte de crise et les acteurs.', 'Noch kein Szenario konfiguriert. Starten Sie mit der Bibliothek unten oder definieren Sie Auftraggeber, Krisenkontext und Akteure.')}</p>
              <button class="btn btn-primary btn-sm" data-action="nav-scenario">${tt('Configure the scenario', 'Configurer le scénario', 'Szenario konfigurieren')} ${sbUiIcon('chevronRight', 14)}</button>
            </div>`}
          </article>`;
      }

      // Block 2: every way to bring a project in, and every way to take it out.
      function renderProjectData() {
        const llmAvailable = isLLMAvailable();
        const exporting = !!appState.ui?.actionLoading?.['export-all'];
        const button = (action, icon, label, hint, extra = '') => `<button class="btn btn-secondary pj-action" data-action="${action}" ${extra}>${sbUiIcon(icon, 18)}<span><strong>${label}</strong><small>${hint}</small></span></button>`;
        const noKey = escapeAttribute(tt('Configure an AI connection in Settings to import an Excel timeline', 'Configurez une connexion IA dans les Paramètres pour importer une chronologie Excel', 'Konfigurieren Sie eine KI-Verbindung in den Einstellungen, um einen Excel-Zeitplan zu importieren'));
        return `
          <article class="card pj-data">
            <div class="section-header">
              <div><h3>${tt('Project data', 'Données du projet', 'Projektdaten')}</h3><p class="subtle">${tt('Start or open a project, then save and export it. Everything stays in your browser until you export.', 'Démarrez ou ouvrez un projet, puis sauvegardez-le et exportez-le. Tout reste dans votre navigateur jusqu\'à l\'export.', 'Starten oder öffnen Sie ein Projekt, dann speichern und exportieren Sie es. Alles bleibt bis zum Export in Ihrem Browser.')}</p></div>
            </div>
            <div class="pj-row">
              <span class="pj-row-label">${tt('Start', 'Démarrer', 'Starten')}</span>
              <div class="pj-actions">
                ${button('new-scenario', 'filePlus', tt('New', 'Nouveau', 'Neu'), tt('Blank project', 'Projet vierge', 'Leeres Projekt'))}
                ${button('project-scroll-library', 'book', tt('Create from library', 'Créer depuis la bibliothèque', 'Aus Bibliothek erstellen'), tt('Ready-made scenario', 'Scénario prêt à l\'emploi', 'Fertiges Szenario'))}
                ${button('load-json', 'folderOpen', tt('Open', 'Ouvrir', 'Öffnen'), '.json · .zip')}
                ${button('import-chronogram-ia', 'sheet', tt('Import Excel', 'Importer Excel', 'Excel importieren'), tt('AI-assisted timeline import', 'Import de chronologie assisté par IA', 'KI-gestützter Zeitplan-Import'), llmAvailable ? '' : `disabled title="${noKey}"`)}
                ${button('load-example', 'demo', tt('Load a demo', 'Charger une démo', 'Demo laden'), tt('StonaWave ransomware', 'Rançongiciel StonaWave', 'StonaWave-Ransomware'))}
              </div>
            </div>
            <div class="pj-row">
              <span class="pj-row-label">${tt('Save & export', 'Sauvegarder & exporter', 'Speichern & exportieren')}</span>
              <div class="pj-actions">
                ${button('save-local', 'save', tt('Save locally', 'Sauvegarder localement', 'Lokal speichern'), tt('Browser storage', 'Stockage du navigateur', 'Browser-Speicher'))}
                ${button('save-json', 'braces', tt('Export text content', 'Exporter le contenu texte', 'Textinhalt exportieren'), 'JSON')}
                ${button('export-all', exporting ? 'clock' : 'archive', exportAllProgressLabel(tt('Export all injects', 'Exporter tous les injects', 'Alle Injects exportieren'), tt('Exporting…', 'Export en cours…', 'Wird exportiert…')), tt('Styled images · .zip', 'Images stylées · .zip', 'Gestaltete Bilder · .zip'), exporting ? 'disabled' : '')}
              </div>
            </div>
          </article>`;
      }

      // Block 3: the scenario library, with template import and export.
      function renderProjectLibrary(project) {
        const storyboard = sbStoryboard();
        return `
          <article class="card sb-context pj-library" id="project-library" data-sb-scope>
            <div class="section-header">
              <div><h3>${tt('Scenario library', 'Bibliothèque de scénarios', 'Szenario-Bibliothek')}</h3><p class="subtle">${tt('Ready-made scenarios with their phases, cells and injects. Load one, then set the key information and generate the scenario in Context.', 'Des scénarios prêts à l\'emploi avec leurs phases, cellules et injects. Chargez-en un, puis renseignez les informations clés et générez le scénario dans Contexte.', 'Fertige Szenarien mit Phasen, Zellen und Injects. Laden Sie eines, geben Sie die Kerninformationen ein und generieren Sie das Szenario im Kontext.')}</p></div>
              <div class="actions">
                <button class="btn btn-secondary btn-sm" data-sb-action="export-current" ${storyboard.blocks.length ? '' : `disabled title="${escapeAttribute(tt('The current storyline is empty', 'La storyline actuelle est vide', 'Die aktuelle Storyline ist leer'))}"`}>${sbUiIcon('download', 14)} ${tt('Export current', 'Exporter l\'actuel', 'Aktuelles exportieren')}</button>
                <button class="btn btn-secondary btn-sm" data-sb-action="import-template">${sbUiIcon('upload', 14)} ${tt('Import a template file', 'Importer un fichier modèle', 'Vorlagendatei importieren')}</button>
                ${storyboard.blocks.length ? `<button class="btn btn-ghost btn-sm" data-route="storyline">${tt('Current storyline', 'Storyline actuelle', 'Aktuelle Storyline')} · ${sbMainBlocks(storyboard).length} ${tt('phases', 'phases', 'Phasen')} ${sbUiIcon('chevronRight', 14)}</button>` : ''}
              </div>
            </div>
            ${renderSbStatusBar()}
            ${sbUI().libraryIntent === 'new' ? `<p class="cx-template pj-library-intent">${sbUiIcon('book', 14)} ${tt('Pick a scenario and select Load: it starts a new project.', 'Choisissez un scénario et cliquez sur Charger : il démarre un nouveau projet.', 'Wählen Sie ein Szenario und dann Laden: es startet ein neues Projekt.')} <button class="btn btn-ghost btn-xs" data-sb-action="library-intent-clear">${tt('Cancel', 'Annuler', 'Abbrechen')}</button></p>` : ''}
            ${renderSbLibrary()}
            ${sbUI().modal === 'preview' ? renderSbPreviewModal() : sbUI().modal === 'load-choice' ? renderSbLoadChoiceModal() : ''}
          </article>`;
      }

      /* The main-storyline phase an inject belongs to: its linked phase, else the phase at its time. */
      function libraryPhaseOf(stimulus) {
        return ExerciseModel.phaseOfStimulus(appState.scenario, stimulus);
      }

      function renderLibraryView() {
        const allStimuli = getSortedStimuli();
        if (!allStimuli.length) {
          return `<section class="grid" style="max-width:600px; margin: 60px auto; text-align:center;">
            <p class="subtle">No injects yet. Build the scenario and its phases, then plan and write the injects of each phase in the Detailed storyline.</p>
            <button class="btn btn-primary" data-action="nav-stimuli">Go to Detailed storyline</button>
          </section>`;
        }
        const f = appState.libraryFilter;
        const phases = appState.scenario.storyboard ? sbMainBlocks(appState.scenario.storyboard) : [];
        const cells = appState.scenario.cells || [];
        let filtered = allStimuli;
        if (f.phase) filtered = filtered.filter((s) => (libraryPhaseOf(s)?.id || 'none') === f.phase);
        if (f.cellId) filtered = filtered.filter((s) => sbReaches(s.cell_id || 'none', f.cellId));
        if (f.channel) filtered = filtered.filter((s) => s.channel === f.channel);
        if (f.status) filtered = filtered.filter((s) => s.status === f.status);
        if (f.actorId) filtered = filtered.filter((s) => s.actor_id === f.actorId);
        if (f.sort === 'updated') filtered = [...filtered].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        else if (f.sort === 'channel') filtered = [...filtered].sort((a, b) => a.channel.localeCompare(b.channel));
        else if (f.sort === 'actor') filtered = [...filtered].sort((a, b) => (getActor(a.actor_id)?.name || '').localeCompare(getActor(b.actor_id)?.name || ''));
        // Default: the scenario's order, phase by phase (already sorted by time).

        const channelOptions = [...new Set(allStimuli.map((s) => s.channel))].sort();
        const actorOptions = appState.scenario.actors;
        const byPhase = !f.sort || f.sort === 'timeline';
        const groups = byPhase
          ? [...phases.map((phase) => ({ phase, items: filtered.filter((s) => libraryPhaseOf(s) === phase) })), { phase: null, items: filtered.filter((s) => !libraryPhaseOf(s)) }].filter((group) => group.items.length)
          : [{ phase: undefined, items: filtered }];
        const renderGroup = (group) => {
          if (group.phase === undefined) return `<div class="library-card-grid">${group.items.map((s) => renderLibraryCard(s)).join('')}</div>`;
          const phase = group.phase;
          const color = phase ? sbBlockColor(phase, appState.scenario.storyboard) : 'var(--line-strong)';
          const planned = phase ? phase.stimuli_target : 0;
          return `<section class="library-phase" style="--phase-color:${escapeAttribute(color)}">
            <header class="library-phase-head">
              <span class="library-phase-time">${phase ? `${escapeHtml(sbFormatOffset(phase.start_minutes))} – ${escapeHtml(sbFormatOffset(sbBlockEnd(phase)))}` : ''}</span>
              <strong>${phase ? escapeHtml(phase.title) : tt('Outside the storyline', 'Hors storyline', 'Außerhalb der Storyline')}</strong>
              <span class="library-phase-count">${group.items.length}${phase && planned ? ` / ${planned} ${tt('planned', 'prévus', 'geplant')}` : ''} ${tt('injects', 'injects', 'Injects')}</span>
              ${phase?.brief ? `<p>${escapeHtml(phase.brief)}</p>` : ''}
            </header>
            <div class="library-card-grid">${group.items.map((s) => renderLibraryCard(s)).join('')}</div>
          </section>`;
        };

        return `
          <section class="grid">
            ${renderPlayGenerate(playReadiness(appState.scenario))}
            <div class="library-filter-bar">
              <select data-library-filter="phase">
                <option value="">${tt('All phases', 'Toutes les phases', 'Alle Phasen')}</option>
                ${phases.map((phase) => `<option value="${phase.id}" ${f.phase === phase.id ? 'selected' : ''}>${escapeHtml(`${sbFormatOffset(phase.start_minutes)} · ${phase.title}`)}</option>`).join('')}
                <option value="none" ${f.phase === 'none' ? 'selected' : ''}>${tt('Outside the storyline', 'Hors storyline', 'Außerhalb der Storyline')}</option>
              </select>
              <select data-library-filter="cellId">
                <option value="">${tt('All cells', 'Toutes les cellules', 'Alle Zellen')}</option>
                ${cells.map((cell) => `<option value="${cell.id}" ${f.cellId === cell.id ? 'selected' : ''}>${escapeHtml(cell.name)}</option>`).join('')}
                <option value="none" ${f.cellId === 'none' ? 'selected' : ''}>${tt('No recipient cell', 'Sans cellule destinataire', 'Ohne Empfängerzelle')}</option>
              </select>
              <select data-library-filter="channel">
                <option value="">${tt('All channels', 'Tous les types', 'Alle Kanäle')}</option>
                ${channelOptions.map((ch) => `<option value="${ch}" ${f.channel === ch ? 'selected' : ''}>${escapeHtml(channelLabel(ch))}</option>`).join('')}
              </select>
              <select data-library-filter="status">
                <option value="">${tt('All statuses', 'Tous les statuts', 'Alle Status')}</option>
                <option value="draft" ${f.status === 'draft' ? 'selected' : ''}>${tt('Draft', 'Brouillon', 'Entwurf')}</option>
                <option value="ready" ${f.status === 'ready' ? 'selected' : ''}>${tt('Ready', 'Prêt', 'Bereit')}</option>
                <option value="sent" ${f.status === 'sent' ? 'selected' : ''}>${tt('Sent', 'Envoyé', 'Gesendet')}</option>
              </select>
              <select data-library-filter="actorId">
                <option value="">${tt('All actors', 'Tous les acteurs', 'Alle Akteure')}</option>
                ${actorOptions.map((a) => `<option value="${a.id}" ${f.actorId === a.id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
              </select>
              <select data-library-filter="sort">
                <option value="timeline" ${f.sort === 'timeline' ? 'selected' : ''}>${tt('By phase', 'Par phase', 'Nach Phase')}</option>
                <option value="updated" ${f.sort === 'updated' ? 'selected' : ''}>${tt('Sort: last modified', 'Tri : modifié', 'Sortierung: Zuletzt geändert')}</option>
                <option value="channel" ${f.sort === 'channel' ? 'selected' : ''}>${tt('Sort: channel', 'Tri : type', 'Sortierung: Kanal')}</option>
                <option value="actor" ${f.sort === 'actor' ? 'selected' : ''}>${tt('Sort: actor', 'Tri : acteur', 'Sortierung: Akteur')}</option>
              </select>
              <span style="color:var(--muted); font-size:0.85rem; margin-left:auto;">${filtered.length}/${allStimuli.length} ${tt('injects', 'injects', 'Injects')}</span>
              <button class="btn btn-primary" data-action="add-stimulus">${tt('+ Add inject', '+ Ajouter un inject', '+ Inject hinzufügen')}</button>
              <button class="btn btn-secondary" data-action="import-custom-template">${tt('Import template', 'Importer un template', 'Vorlage importieren')}</button>
            </div>
            ${(appState.scenario.custom_templates || []).length ? `
              <div class="custom-templates-section">
                <h4>${tt('Custom templates', 'Templates personnalisés', 'Benutzerdefinierte Vorlagen')}</h4>
                <div class="custom-templates-list">
                  ${appState.scenario.custom_templates.map(tpl => `
                    <div class="custom-template-chip">
                      <span class="custom-template-dot" style="background:${escapeAttribute(tpl.color || '#8B5CF6')};"></span>
                      <span>${escapeHtml(tpl.name || tpl.label || tpl.template_id)}</span>
                      <button class="btn-chip-delete" data-action="delete-custom-template" data-template-id="${escapeAttribute(tpl.template_id)}" title="${tt('Remove', 'Supprimer', 'Entfernen')}">${sbUiIcon('close', 16)}</button>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            ${groups.map(renderGroup).join('') || `<p class="subtle">${tt('No inject matches these filters.', 'Aucun inject ne correspond à ces filtres.', 'Kein Inject entspricht diesen Filtern.')}</p>`}
          </section>
        `;
      }

      function renderStoryboardLinkBadge(stimulus) {
        if (typeof sbStimulusStatus !== 'function' || !appState.scenario.storyboard) return '';
        const status = sbStimulusStatus(appState.scenario, stimulus);
        if (!status) return '';
        const block = status.block ? ` · ${status.block.title}` : '';
        return ` <span class="sb-status is-${status.key}" title="${escapeAttribute(`Storyline${block}`)}">${escapeHtml(status.label)}</span>`;
      }

      function renderLibraryCard(stimulus) {
        const meta = CHANNEL_META[stimulus.channel] || CHANNEL_META.email_internal;
        const actor = getActor(stimulus.actor_id);
        const h = Math.floor(stimulus.timestamp_offset_minutes / 60);
        const m = String(stimulus.timestamp_offset_minutes % 60).padStart(2, '0');
        const statusColors = { draft: '#888', ready: '#2a7a2a', sent: '#1a3e6f' };
        const versionCount = stimulus.history ? stimulus.history.length : 0;
        const isExpanded = appState.libraryExpandedId === stimulus.id;
        const titleText = stimulus.fields.subject || stimulus.fields.headline || stimulus.fields.thread_title || stimulus.fields.text || stimulus.fields.title || '—';
        return `
          <div class="library-card${isExpanded ? ' expanded' : ''}">
            <div class="library-card-header" style="background:${meta.color};">
              <span class="library-card-channel">${escapeHtml(channelLabel(stimulus.channel))}</span>
              <span class="library-card-time">H+${h}:${m}</span>
            </div>
            <div class="library-card-body">
              <div class="library-card-actor">${escapeHtml(actor?.name || tt('No actor', 'Sans acteur', 'Kein Akteur'))}${renderStoryboardLinkBadge(stimulus)}</div>
              <div class="library-card-desc library-card-title-btn" data-action="expand-library-card" data-stimulus-id="${stimulus.id}" title="${tt('Click to preview', 'Cliquer pour prévisualiser', 'Klicken zur Vorschau')}">${escapeHtml(titleText.slice(0, 60))}${titleText.length > 60 ? '…' : ''} ${sbUiIcon(isExpanded ? 'up' : 'down', 12)}</div>
            </div>
            ${isExpanded ? `
            <div class="library-card-preview-expand">
              <div class="library-card-preview-inner">${renderStimulusPreview(stimulus, `lib-preview-${stimulus.id}`)}</div>
            </div>` : ''}
            <div class="library-card-footer">
              <button class="pill pill-status" style="background:${statusColors[stimulus.status] || '#888'}; color:#fff; border:none; cursor:pointer;" data-action="cycle-status" data-stimulus-id="${stimulus.id}" title="${tt('Click to change status', 'Cliquer pour changer le statut', 'Klicken zum Status ändern')}">${escapeHtml(stimulus.status)}${versionCount > 0 ? ` · v${versionCount + 1}` : ''}</button>
              <div class="library-card-actions">
                <button class="btn btn-xs" data-action="edit-in-stimuli" data-stimulus-id="${stimulus.id}" title="${tt('Edit', 'Éditer', 'Bearbeiten')}">${sbUiIcon('edit', 14)}</button>
                <button class="btn btn-xs" data-action="duplicate-stimulus" data-stimulus-id="${stimulus.id}" title="${tt('Duplicate', 'Dupliquer', 'Duplizieren')}">${sbUiIcon('copy', 14)}</button>
                ${String(stimulus.channel || '').startsWith('email_') ? `<button class="btn btn-xs" data-action="export-msg" data-stimulus-id="${stimulus.id}" title="${tt('Export .eml file', 'Exporter le fichier .eml', '.eml-Datei exportieren')}">${sbUiIcon('mail', 14)}</button>` : ''}
                <button class="btn btn-xs" data-action="export-png" data-stimulus-id="${stimulus.id}" title="${tt('Export PNG', 'Exporter PNG', 'PNG exportieren')}" ${appState.ui?.actionLoading?.['export-png'] ? 'disabled' : ''}>${appState.ui?.actionLoading?.['export-png'] ? sbUiIcon('clock', 14) : sbUiIcon('image', 14)}</button>
                <button class="btn btn-xs btn-danger" data-action="delete-stimulus" data-stimulus-id="${stimulus.id}" data-confirm="true" title="${tt('Delete', 'Supprimer', 'Löschen')}">${sbUiIcon('trash', 14)}</button>
              </div>
            </div>
          </div>
        `;
      }

      function renderSettingsView() {
        const settings = appState.scenario.settings;
        const models = availableAIModels(settings);
        const isAnthropic = settings.ai_provider === 'anthropic';
        const isOpenAI = settings.ai_provider === 'openai';
        const isOpenRouter = settings.ai_provider === 'openrouter';
        const isAzure = settings.ai_provider === 'azure_openai';
        const isGemini = settings.ai_provider === 'google_gemini';
        const isMistral = settings.ai_provider === 'mistral';
        const isOllama = settings.ai_provider === 'ollama';
        const isOllamaCloud = isOllama && settings.ollama_mode === 'cloud';
        const providerLabel = isAzure ? 'Azure OpenAI' : isGemini ? 'Google Gemini' : isMistral ? 'Mistral' : isOllama ? 'Ollama' : isOpenRouter ? 'OpenRouter' : isOpenAI ? 'OpenAI' : 'Anthropic';
        const modelCatalog = appState.aiModelCatalog || makeDefaultAIModelCatalog();
        const modelCatalogApplies = modelCatalog.provider === settings.ai_provider;
        const modelCatalogStatus = modelCatalogApplies ? modelCatalog.status : 'idle';
        const modelCatalogMessage = modelCatalogStatus === 'loading'
          ? tt('Loading models from the provider…', 'Chargement des modèles depuis le fournisseur…', 'Modelle werden vom Anbieter geladen…')
          : modelCatalogStatus === 'success'
          ? tt(`${modelCatalog.models.length} models loaded from the provider.`, `${modelCatalog.models.length} modèles chargés depuis le fournisseur.`, `${modelCatalog.models.length} Modelle vom Anbieter geladen.`)
          : modelCatalogStatus === 'error'
          ? tt(`Default list shown. Provider API: ${modelCatalog.error}`, `Liste de repli affichée. API fournisseur : ${modelCatalog.error}`, `Standardliste wird angezeigt. Anbieter-API: ${modelCatalog.error}`)
          : modelCatalogStatus === 'missing-key'
          ? tt('Default list shown. Enter an API key to load available models.', 'Liste de repli affichée. Saisissez une clé API pour charger les modèles disponibles.', 'Standardliste wird angezeigt. Geben Sie einen API-Schlüssel ein, um verfügbare Modelle zu laden.')
          : tt('The model list will be loaded dynamically from the provider.', 'La liste des modèles sera chargée dynamiquement depuis le fournisseur.', 'Die Modellliste wird dynamisch vom Anbieter geladen.');
        const connectionTest = appState.connectionTest || { status: 'idle', message: '', checkedAt: null, provider: '' };
        const connectionStatusLabels = {
          testing: tt('Testing…', 'Test en cours…', 'Wird getestet…'),
          success: tt('Confirmed', 'Confirmé', 'Bestätigt'),
          error: tt('Failed', 'Échec', 'Fehlgeschlagen')
        };
        const connectionStatusColors = {
          testing: { background: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
          success: { background: '#ECFDF5', border: '#A7F3D0', text: '#047857' },
          error: { background: '#FEF2F2', border: '#FECACA', text: '#B91C1C' }
        };
        const statusTone = connectionStatusColors[connectionTest.status];
        const checkedAt = connectionTest.checkedAt ? formatLocalDateTime(connectionTest.checkedAt) : '';
        return `
          <section class="grid cols-2">
            <article class="card">
              <div class="section-header"><h3>${tt('AI connection', 'Connexion IA', 'KI-Verbindung')}</h3></div>
              ${!isLLMAvailable() ? `<div style="background:#FEF9C3;border:1px solid #FDE68A;border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:13px;color:#78350F;">${tt('AI provider configuration is incomplete. AI generation features are disabled.', 'La configuration du fournisseur IA est incomplète. Les fonctionnalités de génération par IA sont désactivées.', 'Die Konfiguration des KI-Anbieters ist unvollständig. KI-Generierungsfunktionen sind deaktiviert.')}</div>` : ''}
              <div style="background:#FEF2F2;border:2px solid #DC2626;border-radius:8px;padding:14px 16px;margin-bottom:16px;color:#991B1B;">
                <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${sbUiIcon('alert', 15)} ${tt('Confidentiality warning', 'Avertissement de confidentialité des données', 'Vertraulichkeitswarnung')}</div>
                <div style="font-size:13px;line-height:1.5;margin-bottom:10px;">
                  ${tt(
                    'For confidentiality reasons, the use of AI and the provider used must be explicitly approved by the organization for which the exercise is being conducted.',
                    "Pour des raisons de confidentialité, l'usage de l'IA et le fournisseur utilisé doivent être approuvés explicitement par la structure pour laquelle l'exercice est réalisé.",
                    'Aus Vertraulichkeitsgründen müssen der Einsatz von KI und der verwendete Anbieter ausdrücklich von der Organisation genehmigt werden, für die die Übung durchgeführt wird.'
                  )}
                </div>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;">
                  <input type="checkbox" data-action="toggle-confidentiality-acknowledged" ${settings.confidentiality_acknowledged ? 'checked' : ''} style="width:18px;height:18px;accent-color:#DC2626;cursor:pointer;">
                  ${tt("I have written approval", "Je dispose d'une validation écrite", "Ich verfüge über eine schriftliche Genehmigung")}
                </label>
              </div>
              <div class="field-grid cols-2" ${!settings.confidentiality_acknowledged ? 'style="opacity:0.4;pointer-events:none;"' : ''}>
                <label class="field">${tt('AI provider', 'Fournisseur IA', 'KI-Anbieter')}
                  <select data-bind="settings.ai_provider">
                    <option value="anthropic" ${settings.ai_provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                    <option value="openai" ${settings.ai_provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="openrouter" ${settings.ai_provider === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
                    <option value="azure_openai" ${settings.ai_provider === 'azure_openai' ? 'selected' : ''}>Azure OpenAI</option>
                    <option value="google_gemini" ${settings.ai_provider === 'google_gemini' ? 'selected' : ''}>Google Gemini</option>
                    <option value="mistral" ${settings.ai_provider === 'mistral' ? 'selected' : ''}>Mistral</option>
                    <option value="ollama" ${settings.ai_provider === 'ollama' ? 'selected' : ''}>Ollama</option>
                  </select>
                </label>
                ${(isAnthropic || isOpenAI || isOpenRouter || isGemini || isMistral || isOllama) ? `
                  <label class="field">${tt('Model', 'Modèle', 'Modell')}
                    <div style="display:flex;gap:8px;">
                      <select data-bind="settings.ai_model" style="min-width:0;">
                        ${models.map((model) => `<option value="${escapeAttribute(model)}" ${settings.ai_model === model ? 'selected' : ''}>${escapeHtml(model)}</option>`).join('')}
                      </select>
                      <button class="btn btn-secondary" data-action="refresh-ai-models" title="${tt('Refresh model list', 'Actualiser la liste des modèles', 'Modellliste aktualisieren')}" ${modelCatalogStatus === 'loading' ? 'disabled' : ''}>⟳</button>
                    </div>
                    <p class="helper">${escapeHtml(modelCatalogMessage)}</p>
                  </label>
                  ${!isOllama ? `<div style="grid-column: 1 / -1;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;padding:10px 12px;font-size:13px;color:#1D4ED8;">Demande de clé Wavestone : <a href="https://cowork-website.cloudexperienceassets.com/api/files/aicybmaker.html#index.html" target="_blank" rel="noopener" style="color:inherit;font-weight:700;">https://cowork-website.cloudexperienceassets.com/api/files/aicybmaker.html#index.html</a></div>` : ''}
                  ${isOllama ? `
                    <label class="field" style="grid-column: 1 / -1;">${tt('Ollama service', 'Service Ollama', 'Ollama-Dienst')}
                      <select data-bind="settings.ollama_mode">
                        <option value="local" ${!isOllamaCloud ? 'selected' : ''}>${tt('Local models', 'Modèles locaux', 'Lokale Modelle')}</option>
                        <option value="cloud" ${isOllamaCloud ? 'selected' : ''}>Ollama Cloud</option>
                      </select>
                    </label>
                    ${!isOllamaCloud ? `<label class="field" style="grid-column: 1 / -1;">${tt('Local Ollama server URL', 'URL du serveur Ollama local', 'Lokale Ollama-Server-URL')}
                      <input type="url" data-bind="settings.ollama_endpoint" value="${escapeAttribute(settings.ollama_endpoint || 'http://localhost:11434')}" placeholder="http://localhost:11434">
                    </label>` : ''}
                  ` : ''}
                  ${(!isOllama || isOllamaCloud) ? `<label class="field" style="grid-column: 1 / -1;">${isOllamaCloud ? tt('Ollama Cloud API key', 'Clé API Ollama Cloud', 'Ollama-Cloud-API-Schlüssel') : isGemini ? tt('Google Gemini API key', 'Clé API Google Gemini', 'Google Gemini-API-Schlüssel') : isMistral ? tt('Mistral API key', 'Clé API Mistral', 'Mistral-API-Schlüssel') : isOpenRouter ? tt('OpenRouter API key', 'Clé API OpenRouter', 'OpenRouter-API-Schlüssel') : isOpenAI ? tt('OpenAI API key', 'Clé API OpenAI', 'OpenAI-API-Schlüssel') : tt('Anthropic API key', 'Clé API Anthropic', 'Anthropic-API-Schlüssel')}
                    <div style="display:flex; gap:10px;">
                      <input id="api-key-input" type="password" data-bind="settings.ai_api_key" value="${escapeAttribute(settings.ai_api_key)}" placeholder="${isOllamaCloud ? 'Ollama Cloud API key' : isGemini ? 'AIza...' : isMistral ? 'Mistral API key' : isOpenRouter ? 'sk-or-v1-...' : isOpenAI ? 'sk-proj-...' : 'sk-ant-...'}">
                      <button class="btn btn-secondary" data-action="toggle-api-key" aria-label="Show or hide the key">${sbUiIcon('eye', 16)}</button>
                    </div>
                    <p class="helper">${tt('Kept for this browser session only and never saved in project files: enter it again after closing the browser.', 'Conservée pour cette session du navigateur uniquement, jamais enregistrée dans les fichiers projet : saisissez-la de nouveau après avoir fermé le navigateur.', 'Nur für diese Browsersitzung gespeichert, nie in Projektdateien: nach dem Schließen des Browsers erneut eingeben.')}</p>
                  </label>` : ''}
                ` : ''}
                ${isAzure ? `
                  <label class="field">${tt('Azure endpoint', 'Endpoint Azure', 'Azure-Endpunkt')}
                    <input type="url" data-bind="settings.azure_endpoint" value="${escapeAttribute(settings.azure_endpoint || '')}" placeholder="https://<resource>.openai.azure.com/openai/v1">
                  </label>
                  <label class="field">${tt('Deployment name', 'Nom du déploiement', 'Bereitstellungsname')}
                    <input type="text" data-bind="settings.azure_deployment" value="${escapeAttribute(settings.azure_deployment || '')}" placeholder="gpt-4o">
                  </label>
                  <label class="field">${tt('API version', 'Version de l\'API', 'API-Version')}
                    <input type="text" data-bind="settings.azure_api_version" value="${escapeAttribute(settings.azure_api_version || DEFAULT_AZURE_API_VERSION)}" placeholder="${DEFAULT_AZURE_API_VERSION}">
                    <p class="helper">${tt('Used for resource-root endpoints. Foundry endpoints and URLs ending in /openai/v1 use v1 without a date. No separate region is needed; use the endpoint and deployment from the same Azure resource.', 'Utilisée pour les endpoints racine. Les endpoints Foundry et les URL se terminant par /openai/v1 utilisent v1 sans date. Aucune région séparée : utilisez l’endpoint et le déploiement de la même ressource Azure.', 'Gilt für Ressourcen-Stammendpunkte. Foundry-Endpunkte und URLs mit /openai/v1 verwenden v1 ohne Datum. Keine separate Region nötig; Endpunkt und Bereitstellung müssen zur selben Azure-Ressource gehören.')}</p>
                    <p class="helper">${tt('If the browser blocks a direct Azure request, it is retried through the DeckSeeder Cloudflare relay, including the API key and prompt.', 'Si le navigateur bloque une requête Azure directe, elle est réessayée via le relais Cloudflare DeckSeeder, avec la clé API et le prompt.', 'Blockiert der Browser eine direkte Azure-Anfrage, wird sie über das DeckSeeder-Cloudflare-Relay einschließlich API-Schlüssel und Prompt erneut gesendet.')}</p>
                  </label>
                  <div style="grid-column: 1 / -1;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;padding:10px 12px;font-size:13px;color:#1D4ED8;">Demande de clé Wavestone : <a href="https://cowork-website.cloudexperienceassets.com/api/files/aicybmaker.html#index.html" target="_blank" rel="noopener" style="color:inherit;font-weight:700;">https://cowork-website.cloudexperienceassets.com/api/files/aicybmaker.html#index.html</a></div>
                  <label class="field" style="grid-column: 1 / -1;">${tt('Azure API key', 'Clé API Azure', 'Azure-API-Schlüssel')}
                    <div style="display:flex; gap:10px;">
                      <input id="api-key-input" type="password" data-bind="settings.azure_api_key" value="${escapeAttribute(settings.azure_api_key || '')}" placeholder="Azure API key">
                      <button class="btn btn-secondary" data-action="toggle-api-key" aria-label="Show or hide the key">${sbUiIcon('eye', 16)}</button>
                    </div>
                  </label>
                ` : ''}
              </div>
              <div class="field-grid cols-2">
                <label class="field">${tt("Application language", "Langue de l'application", 'Anwendungssprache')}
                  <select data-bind="settings.language">
                    <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
                    <option value="fr" ${settings.language === 'fr' ? 'selected' : ''}>Français</option>
                    <option value="de" ${settings.language === 'de' ? 'selected' : ''}>Deutsch</option>
                  </select>
                  <p class="helper">${tt('Auto-detected from your browser on first load.', 'Détectée automatiquement depuis votre navigateur au premier chargement.', 'Beim ersten Laden automatisch aus Ihrem Browser erkannt.')}</p>
                </label>
                <label class="field">${tt('Template rendering', 'Rendu des templates', 'Vorlagen-Rendering')}
                  <select data-bind="settings.template_quality">
                    <option value="basic" ${settings.template_quality === 'basic' ? 'selected' : ''}>Basic — ${tt('Fast, lightweight', 'Léger, rapide', 'Schnell, leichtgewichtig')}</option>
                    <option value="hd" ${settings.template_quality === 'hd' ? 'selected' : ''}>HD — ${tt('High fidelity, realistic', 'Haute fidélité, réaliste', 'Hochauflösend, realistisch')}</option>
                  </select>
                </label>
              </div>
              <div class="actions" style="margin-top:18px;">
                <button class="btn btn-primary" data-action="test-connection" ${connectionTest.status === 'testing' ? 'disabled' : ''}>${connectionTest.status === 'testing' ? `<span class="ai-spinner"></span>${tt('Testing…', 'Test en cours…', 'Wird getestet…')}` : tt('Test connection', 'Tester la connexion', 'Verbindung testen')}</button>
                <button class="btn btn-secondary" data-action="save-local">${tt('Save locally', 'Sauvegarder localement', 'Lokal speichern')}</button>
                <button class="btn btn-ghost" data-action="tech-log-open" title="${tt('Every AI call and error of this session, to investigate a failure', 'Chaque appel IA et chaque erreur de la session, pour analyser un échec', 'Jeder KI-Aufruf und jeder Fehler dieser Sitzung, zur Fehleranalyse')}">${sbUiIcon('sheet', 14)} ${tt('Technical log', 'Journal technique', 'Technisches Protokoll')}${typeof CrisisTechLog !== 'undefined' && CrisisTechLog.entries.length ? ` (${CrisisTechLog.entries.length})` : ''}</button>
              </div>
              ${statusTone ? `
                <div style="margin-top:14px;padding:12px 14px;border-radius:8px;border:1px solid ${statusTone.border};background:${statusTone.background};color:${statusTone.text};">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <strong>${connectionStatusLabels[connectionTest.status]}</strong>
                    ${checkedAt ? `<span style="font-size:12px;opacity:0.8;">${tt('Checked at', 'Vérifié à', 'Geprüft um')} ${checkedAt}</span>` : ''}
                  </div>
                  <div style="margin-top:6px;font-size:13px;line-height:1.4;">${escapeHtml(connectionTest.message)}</div>
                </div>
              ` : ''}
              <p class="helper" style="margin-top:14px;">${tt(`The ${providerLabel} settings stay in your browser and are only sent to the selected provider.`, `Les paramètres ${providerLabel} restent dans votre navigateur et ne sont transmis qu'au fournisseur sélectionné.`, `Die ${providerLabel}-Einstellungen verbleiben in Ihrem Browser und werden nur an den ausgewählten Anbieter übermittelt.`)}</p>
              ${isAzure ? `<p class="helper">${tt('Azure OpenAI uses your deployment name; availability depends on your Azure resource and region.', 'Azure OpenAI utilise le nom de votre déploiement ; la disponibilité dépend de votre ressource Azure et de votre région.', 'Azure OpenAI verwendet Ihren Bereitstellungsnamen; die Verfügbarkeit hängt von Ihrer Azure-Ressource und Region ab.')}</p>` : ''}
              ${isGemini ? `<p class="helper">${tt('Get your Gemini API key from Google AI Studio (aistudio.google.com).', 'Obtenez votre clé API Gemini depuis Google AI Studio (aistudio.google.com).', 'Holen Sie sich Ihren Gemini-API-Schlüssel von Google AI Studio (aistudio.google.com).')}</p>` : ''}
              ${isMistral ? `<p class="helper">${tt('Get your Mistral API key from La Plateforme / Mistral AI Console.', 'Obtenez votre clé API Mistral depuis La Plateforme / la console Mistral AI.', 'Holen Sie sich Ihren Mistral-API-Schlüssel über La Plateforme / die Mistral AI Console.')}</p>` : ''}
              ${isOllama ? `<p class="helper">${isOllamaCloud
                ? tt('Create an API key at ollama.com/settings/keys. Cloud requests use the same Cloudflare relay as DeckSeeder.', 'Créez une clé API sur ollama.com/settings/keys. Les requêtes Cloud utilisent le même relais Cloudflare que DeckSeeder.', 'Erstellen Sie einen API-Schlüssel unter ollama.com/settings/keys. Cloud-Anfragen verwenden denselben Cloudflare-Relay wie DeckSeeder.')
                : `${tt('Local Ollama does not require an API key. Start Ollama, pull a model, then refresh the model list.', 'Ollama local ne nécessite pas de clé API. Démarrez Ollama, téléchargez un modèle, puis actualisez la liste.', 'Lokales Ollama benötigt keinen API-Schlüssel. Starten Sie Ollama, laden Sie ein Modell herunter und aktualisieren Sie dann die Modellliste.')} ${tt('For GitHub Pages, allow OLLAMA_ORIGINS=https://gbillois.github.io in Ollama.', 'Pour GitHub Pages, autorisez OLLAMA_ORIGINS=https://gbillois.github.io dans Ollama.', 'Für GitHub Pages muss OLLAMA_ORIGINS=https://gbillois.github.io in Ollama erlaubt sein.')}`}</p>` : ''}
            </article>
            <article class="card">
              <div class="section-header"><h3>${tt('Export watermark', 'Filigrane d\'export', 'Export-Wasserzeichen')}</h3></div>
              <div class="field-grid cols-2">
                <label class="field">${tt('Watermark enabled', 'Filigrane activé', 'Wasserzeichen aktiviert')}
                  <select data-bind="settings.watermark_enabled">
                    <option value="true" ${settings.watermark_enabled !== false ? 'selected' : ''}>${tt('Yes', 'Oui', 'Ja')}</option>
                    <option value="false" ${settings.watermark_enabled === false ? 'selected' : ''}>${tt('No', 'Non', 'Nein')}</option>
                  </select>
                </label>
                <label class="field">${tt('Text', 'Texte', 'Text')}
                  <input type="text" data-bind="settings.watermark_text" value="${escapeAttribute(settings.watermark_text || 'EXERCISE EXERCISE EXERCISE')}">
                </label>
                <label class="field">${tt('Text size (pt)', 'Taille du texte (pt)', 'Textgröße (pt)')}
                  <input type="number" min="6" max="120" step="1" data-bind="settings.watermark_text_size" value="${settings.watermark_text_size ?? 16}">
                </label>
                <label class="field">${tt('Vertical position', 'Position verticale', 'Vertikale Position')}
                  <select data-bind="settings.watermark_position_v">
                    <option value="top" ${settings.watermark_position_v === 'top' ? 'selected' : ''}>${tt('Top', 'Haut', 'Oben')}</option>
                    <option value="middle" ${settings.watermark_position_v === 'middle' ? 'selected' : ''}>${tt('Middle', 'Milieu', 'Mitte')}</option>
                    <option value="bottom" ${settings.watermark_position_v === 'bottom' ? 'selected' : ''}>${tt('Bottom', 'Bas', 'Unten')}</option>
                  </select>
                </label>
                <label class="field">${tt('Horizontal position', 'Position horizontale', 'Horizontale Position')}
                  <select data-bind="settings.watermark_position_h">
                    <option value="left" ${settings.watermark_position_h === 'left' ? 'selected' : ''}>${tt('Left', 'Gauche', 'Links')}</option>
                    <option value="center" ${settings.watermark_position_h === 'center' ? 'selected' : ''}>${tt('Center', 'Centre', 'Mitte')}</option>
                    <option value="right" ${settings.watermark_position_h === 'right' ? 'selected' : ''}>${tt('Right', 'Droite', 'Rechts')}</option>
                  </select>
                </label>
                <label class="field">${tt('Opacity (%)', 'Opacité (%)', 'Deckkraft (%)')}
                  <input type="number" min="0" max="100" step="5" data-bind="settings.watermark_opacity" value="${settings.watermark_opacity ?? 50}">
                </label>
                <label class="field">${tt('Rotation', 'Rotation', 'Drehung')}
                  <select data-bind="settings.watermark_rotation">
                    <option value="0" ${String(settings.watermark_rotation) === '0' ? 'selected' : ''}>0°</option>
                    <option value="45" ${String(settings.watermark_rotation) === '45' ? 'selected' : ''}>45°</option>
                    <option value="90" ${String(settings.watermark_rotation) === '90' ? 'selected' : ''}>90°</option>
                    <option value="135" ${String(settings.watermark_rotation) === '135' ? 'selected' : ''}>135°</option>
                    <option value="180" ${String(settings.watermark_rotation) === '180' ? 'selected' : ''}>180°</option>
                  </select>
                </label>
              </div>
              <label class="field">${tt('Audio watermark', 'Filigrane audio', 'Audio-Wasserzeichen')}
                  <select data-bind="settings.watermark_audio_enabled">
                    <option value="true" ${settings.watermark_audio_enabled !== false ? 'selected' : ''}>${tt('Yes — prepend spoken "Exercise" warning', 'Oui — ajouter un avertissement vocal "Exercice"', 'Ja — gesprochene "Übung"-Warnung voranstellen')}</option>
                    <option value="false" ${settings.watermark_audio_enabled === false ? 'selected' : ''}>${tt('No', 'Non', 'Nein')}</option>
                  </select>
                </label>
              <p class="helper" style="margin-top:14px;">${tt('The watermark is overlaid on all exported injects. Each inject can override these defaults. The audio watermark prepends a spoken warning before generated audio.', 'Le filigrane est superposé sur tous les stimuli exportés. Chaque stimulus peut personnaliser ces réglages. Le filigrane audio ajoute un avertissement vocal avant l\'audio généré.', 'Das Wasserzeichen wird über alle exportierten Injects gelegt. Jeder Inject kann diese Standardeinstellungen überschreiben. Das Audio-Wasserzeichen stellt eine gesprochene Warnung vor das generierte Audio.')}</p>
            </article>
            <article class="card">
              <div class="section-header"><h3>${tt('Azure Speech TTS', 'Azure Speech TTS', 'Azure Speech TTS')}</h3></div>
              <p style="margin:0 0 12px; font-size:0.82rem; color:var(--text-muted, #6b7280);">${tt(
                'Azure Cognitive Services Speech provides high-quality neural voices for audio message generation. Configure your API key here, then select "Azure Speech" as TTS provider in each audio inject.',
                'Azure Cognitive Services Speech fournit des voix neuronales de haute qualité pour la génération de messages audio. Configurez votre clé API ici, puis sélectionnez "Azure Speech" comme fournisseur TTS dans chaque inject audio.',
                'Azure Cognitive Services Speech bietet hochwertige neuronale Stimmen für die Audio-Nachrichtengenerierung. Konfigurieren Sie Ihren API-Schlüssel hier und wählen Sie dann "Azure Speech" als TTS-Anbieter in jedem Audio-Inject.'
              )}</p>
              <div class="field-grid cols-2">
                <div style="grid-column: 1 / -1;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;padding:10px 12px;font-size:13px;color:#1D4ED8;">Demande de clé Wavestone : <a href="https://cowork-website.cloudexperienceassets.com/api/files/aicybmaker.html#index.html" target="_blank" rel="noopener" style="color:inherit;font-weight:700;">https://cowork-website.cloudexperienceassets.com/api/files/aicybmaker.html#index.html</a></div>
                <label class="field">${tt('Azure Speech API key', 'Clé API Azure Speech', 'Azure Speech API-Schlüssel')}
                  <div style="display:flex; gap:10px;">
                    <input id="azure-speech-key-input" type="password" data-bind="settings.azure_speech_key" value="${escapeAttribute(settings.azure_speech_key || '')}" placeholder="${tt('Enter your Azure Speech key', 'Entrez votre clé Azure Speech', 'Geben Sie Ihren Azure Speech-Schlüssel ein')}">
                    <button class="btn btn-secondary" data-action="toggle-azure-speech-key" aria-label="Show or hide the key">${sbUiIcon('eye', 16)}</button>
                  </div>
                </label>
                <label class="field">${tt('Azure region', 'Région Azure', 'Azure-Region')}
                  <select data-bind="settings.azure_speech_region">
                    ${['westeurope', 'eastus', 'eastus2', 'westus', 'westus2', 'northeurope', 'southeastasia', 'eastasia', 'centralus', 'uksouth', 'francecentral', 'germanywestcentral', 'japaneast', 'australiaeast', 'canadacentral'].map(r => `<option value="${r}" ${(settings.azure_speech_region || 'westeurope') === r ? 'selected' : ''}>${r}</option>`).join('')}
                  </select>
                </label>
              </div>
              <p class="helper" style="margin-top:14px;">${tt('The Azure Speech key stays in your browser and is only sent to Microsoft Azure. Get your key from the Azure portal → Cognitive Services → Speech.', 'La clé Azure Speech reste dans votre navigateur et n\'est transmise qu\'à Microsoft Azure. Obtenez votre clé depuis le portail Azure → Cognitive Services → Speech.', 'Der Azure Speech-Schlüssel verbleibt in Ihrem Browser und wird nur an Microsoft Azure gesendet. Holen Sie sich Ihren Schlüssel im Azure-Portal → Cognitive Services → Speech.')}</p>
            </article>
          </section>
          <div style="padding:18px 0 4px;">
            <button class="btn btn-secondary" data-action="load-json" style="width:100%;">${tt('Open (.json or .zip)', 'Ouvrir (.json ou .zip)', 'Öffnen (.json oder .zip)')}</button>
          </div>
        `;
      }

      function renderScenarioView() {
        const project = appState.scenario;
        StoryboardHistory.ensure(project);
        if (!Array.isArray(project.cells)) project.cells = [];
        if (!project.exercise) project.exercise = { players_count: '', cells_count: '' };
        return sbWithRenderMemo(() => {
          sbCaptureFocus();
          return `
          <section class="tab-page sc-page">
            ${renderContextGlance(project)}
            ${renderContextBrief(project)}
          </section>`;
        });
      }



      function renderStimulusEditorModal(stimulus) {
        const library = getTemplateDefinition(stimulus);
        const actorOptions = appState.scenario.actors.map((actor) => `<option value="${actor.id}" ${stimulus.actor_id === actor.id ? 'selected' : ''}>${escapeHtml(actor.name)} — ${escapeHtml(actor.title)}</option>`).join('');
        return `
          <div class="field-grid cols-2">
            <label class="field" style="grid-column:1/-1;">${tt('Inject name', 'Nom de l\'inject', 'Inject-Name')}
              <input type="text" data-stimulus-bind="${stimulus.id}.name" value="${escapeAttribute(stimulus.name || '')}" placeholder="${tt('Give this inject a name…', 'Donnez un nom à cet inject…', 'Geben Sie diesem Inject einen Namen…')}">
            </label>
            <label class="field">${tt('Inject type', 'Type d\'inject', 'Inject-Typ')}
              <select data-stimulus-bind="${stimulus.id}.channel">${Object.entries(CHANNEL_META).map(([channel]) => `<option value="${channel}" ${stimulus.channel === channel ? 'selected' : ''}>${channelLabel(channel)}</option>`).join('')}</select>
            </label>
            ${stimulus.channel === 'article_press' ? `<label class="field">${tt('Press template', 'Template presse', 'Presse-Vorlage')}
              <select data-stimulus-bind="${stimulus.id}.template_id">${Object.values(ARTICLE_TEMPLATE_LIBRARY).map((template) => `<option value="${template.template_id}" ${stimulus.template_id === template.template_id ? 'selected' : ''}>${escapeHtml(template.label)}</option>`).join('')}</select>
            </label>` : stimulus.channel === 'breaking_news_tv' ? `<label class="field">${tt('TV channel style', 'Style de chaîne TV', 'TV-Senderstil')}
              <select data-stimulus-bind="${stimulus.id}.template_id">${Object.values(TV_TEMPLATE_LIBRARY).map((template) => `<option value="${template.template_id}" ${stimulus.template_id === template.template_id ? 'selected' : ''}>${escapeHtml(template.label)}</option>`).join('')}</select>
            </label>` : '<div></div>'}
            <label class="field">${tt('Source actor', 'Acteur émetteur', 'Absender-Akteur')}
              <select data-stimulus-bind="${stimulus.id}.actor_id">${actorOptions}</select>
            </label>
            <label class="field">${tt('Timeline (minutes)', 'Timeline (minutes)', 'Zeitplan (Minuten)')}
              <input type="number" min="0" step="5" data-stimulus-bind="${stimulus.id}.timestamp_offset_minutes" value="${stimulus.timestamp_offset_minutes}">
            </label>
            ${typeof renderStimulusLinks === 'function' ? renderStimulusLinks(appState.scenario, stimulus) : ''}
          </div>

          <div class="actions" style="margin:16px 0 4px;">
            <button class="btn btn-secondary" data-action="clear-stimulus-content" data-stimulus-id="${stimulus.id}">${tt('Clear content', 'Effacer le contenu', 'Inhalt löschen')}</button>
            <button class="btn btn-danger" data-action="delete-stimulus" data-stimulus-id="${stimulus.id}" data-confirm="true">${tt('Delete', 'Supprimer', 'Löschen')}</button>
          </div>

          <div style="margin-top:16px;">
            ${renderLLMConfigBlock('stimulus', tt(
              'Ex: "A Le Monde article about the attack by journalist Jean Dupont, at H+2. Alarming but factual, mentioning impact on 2 million customers."',
              'Ex: "Un tweet indigné d\'un client B2C qui ne peut plus accéder à son compte bancaire. H+1." Ou : "Email interne du RSSI au comité de crise, H+0."',
              'Bsp.: „Ein Spiegel-Artikel über den Angriff von Journalist Max Müller, bei H+2. Alarmierend aber sachlich, mit Hinweis auf 2 Millionen betroffene Kunden."'
            ))}
          </div>

          <div class="field-grid" style="margin-top:16px;">
            ${library.fields.map((spec) => renderFieldControl(stimulus, spec)).join('')}
          </div>

          ${stimulus.channel === 'breaking_news_tv' ? renderVideoFileControl(stimulus) : ''}
          ${stimulus.channel === 'audio_message' ? renderAudioControls(stimulus) : ''}

          ${stimulus.channel !== 'audio_message' ? renderStimulusWatermarkControls(stimulus) : ''}
        `;
      }

      function renderVideoFileControl(stimulus) {
        const video = appState.videoFiles?.[stimulus.id];
        return `
          <div style="margin-top:16px; border:1px solid var(--border, #e5e7eb); border-radius:8px; padding:14px 16px;">
            <p style="margin:0 0 10px; font-size:0.88rem; font-weight:600; color:var(--text-muted, #6b7280);">${tt('Background video', 'Vidéo de fond', 'Hintergrundvideo')}</p>
            <p style="margin:0 0 10px; font-size:0.8rem; color:var(--text-muted, #6b7280);">${tt(
              'The bundled anchor video loads by default. Select a local video file to replace it for this inject.',
              'La vidéo présentateur intégrée est chargée par défaut. Sélectionnez un fichier vidéo local pour la remplacer pour cet inject.',
              'Das integrierte Nachrichtensprecher-Video wird standardmäßig geladen. Wählen Sie eine lokale Videodatei, um es für diesen Inject zu ersetzen.'
            )}</p>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <label class="btn btn-secondary" style="cursor:pointer; margin:0;">
                ${tt('Select video…', 'Sélectionner une vidéo…', 'Video auswählen…')}
                <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" data-stimulus-video="${stimulus.id}" style="display:none;">
              </label>
              ${video ? `
                <span style="font-size:0.82rem; color:var(--text-muted, #6b7280);">${sbUiIcon('paperclip', 13)} ${escapeHtml(video.fileName)}</span>
                <button class="btn btn-ghost" data-action="clear-video" data-stimulus-id="${stimulus.id}">${tt('Remove', 'Supprimer', 'Entfernen')}</button>
              ` : ''}
            </div>
          </div>
        `;
      }

      function renderAudioControls(stimulus) {
        const audioInfo = appState.audioFiles?.[stimulus.id];
        const hasAudio = !!audioInfo;
        const mode = stimulus.fields.audio_mode || 'create';
        const character = stimulus.fields.audio_character || 'attacker_best';
        const provider = stimulus.fields.tts_provider || 'browser';
        const lang = stimulus.fields.tts_language || (() => { const l = appState.scenario.settings.inject_language || appState.scenario.settings.language || 'en'; if (l === 'fr') return 'fr-FR'; if (l === 'de') return 'de-DE'; if (l === 'en') return 'en-US'; return 'en-US'; })();
        const wmType = stimulus.fields.audio_watermark_type || 'beeps';
        const wmText = stimulus.fields.audio_watermark_text || 'EXERCISE';
        const azureKey = appState.scenario.settings.azure_speech_key;
        const uiLang = appState.scenario.settings.language || 'en';
        const _gf = appState.ui?.generatingField;
        const _textGenerating = _gf && _gf.stimulusId === stimulus.id && (_gf.fieldName === 'text' || _gf.fieldName === null);

        const CHARACTER_OPTIONS = [
          { value: 'male',           label: tt('Male', 'Homme', 'Männlich') },
          { value: 'female',         label: tt('Female', 'Femme', 'Weiblich') },
          { value: 'attacker_best',  label: tt('Attacker Best', 'Attaquant Best', 'Angreifer Best') },
          { value: 'attacker_drama', label: tt('Attacker Drama', 'Attaquant Drama', 'Angreifer Drama') },
          { value: 'attacker_techno',label: tt('Attacker Techno', 'Attaquant Techno', 'Angreifer Techno') }
        ];

        // Determine gender from character for Azure voice filtering
        const characterGender = (character === 'female') ? 'female' : 'male';
        const allAzureVoices = AZURE_SPEECH_VOICES[lang] || AZURE_SPEECH_VOICES['en-US'] || [];
        // Filter voices by gender; show all if filtering yields none
        const genderFilteredVoices = allAzureVoices.filter(v => v.gender === characterGender);
        const azureVoices = genderFilteredVoices.length > 0 ? genderFilteredVoices : allAzureVoices;

        // Auto-select first matching voice if current azure_voice is not in the filtered list
        if (provider === 'azure_speech' && azureVoices.length > 0 && !azureVoices.some(v => v.value === stimulus.fields.azure_voice)) {
          stimulus.fields.azure_voice = azureVoices[0].value;
        }

        return `
          <div style="margin-top:16px; border:1px solid var(--border, #e5e7eb); border-radius:8px; padding:14px 16px;">
            <p style="margin:0 0 12px; font-size:0.88rem; font-weight:600; color:var(--text-muted, #6b7280);">${tt('Audio message', 'Message audio', 'Audionachricht')}</p>

            <!-- Mode toggle -->
            <div style="display:flex; gap:0; margin-bottom:16px; border:1px solid var(--border, #e5e7eb); border-radius:6px; overflow:hidden; width:fit-content;">
              <label style="margin:0; padding:7px 18px; cursor:pointer; font-size:0.85rem; font-weight:500; background:${mode === 'upload' ? 'var(--accent, #2563eb)' : 'transparent'}; color:${mode === 'upload' ? '#fff' : 'var(--text, #111)'}; transition:background 0.15s;">
                <input type="radio" name="audio-mode-${stimulus.id}" value="upload" data-stimulus-field="${stimulus.id}.audio_mode" ${mode === 'upload' ? 'checked' : ''} style="display:none;">
                ${tt('Upload', 'Importer', 'Hochladen')}
              </label>
              <label style="margin:0; padding:7px 18px; cursor:pointer; font-size:0.85rem; font-weight:500; background:${mode === 'create' ? 'var(--accent, #2563eb)' : 'transparent'}; color:${mode === 'create' ? '#fff' : 'var(--text, #111)'}; transition:background 0.15s;">
                <input type="radio" name="audio-mode-${stimulus.id}" value="create" data-stimulus-field="${stimulus.id}.audio_mode" ${mode === 'create' ? 'checked' : ''} style="display:none;">
                ${tt('Create', 'Créer', 'Erstellen')}
              </label>
            </div>

            ${mode === 'upload' ? `
              <!-- Upload mode -->
              <div>
                <label class="btn btn-secondary" style="cursor:pointer; margin:0 0 12px;">
                  ${tt('Choose audio file…', 'Choisir un fichier audio…', 'Audiodatei auswählen…')}
                  <input type="file" accept="audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mpeg,audio/*" data-stimulus-audio="${stimulus.id}" style="display:none;">
                </label>
                ${hasAudio ? `<p style="margin:4px 0 0; font-size:0.82rem; color:var(--text-muted, #6b7280);">${sbUiIcon('paperclip', 13)} ${escapeHtml(audioInfo.fileName)}</p>` : ''}
              </div>
            ` : `
              <!-- Create mode -->
              <div class="field-grid cols-2" style="margin-bottom:14px;">

                <!-- 0. Model -->
                <label class="field" style="grid-column:1/-1;">
                  ${tt('0. Model', '0. Modèle', '0. Modell')}
                  <select data-stimulus-field="${stimulus.id}.tts_provider">
                    <option value="browser" ${provider === 'browser' ? 'selected' : ''}>${tt('Browser (built-in)', 'Navigateur (intégré)', 'Browser (eingebaut)')}</option>
                    <option value="azure_speech" ${provider === 'azure_speech' ? 'selected' : ''}>Azure Speech (Neural)</option>
                  </select>
                  ${provider === 'azure_speech' && !azureKey ? `<p style="margin:4px 0 0; font-size:0.78rem; color:#b91c1c;">${sbUiIcon('alert', 13)} ${tt('Azure Speech requires an API key. Configure it in Settings.', 'Azure Speech nécessite une clé API. Configurez-la dans les Paramètres.', 'Azure Speech erfordert einen API-Schlüssel. Konfigurieren Sie ihn in den Einstellungen.')}</p>` : ''}
                </label>

                <!-- 1. Character -->
                <label class="field" style="grid-column:1/-1;">
                  ${tt('1. Character', '1. Personnage', '1. Charakter')}
                  <select data-stimulus-field="${stimulus.id}.audio_character">
                    ${CHARACTER_OPTIONS.map(o => `<option value="${o.value}" ${character === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                  </select>
                </label>

                ${provider === 'azure_speech' ? `
                <!-- Azure voice -->
                <label class="field" style="grid-column:1/-1;">
                  ${tt('Azure voice', 'Voix Azure', 'Azure-Stimme')}
                  <select data-stimulus-field="${stimulus.id}.azure_voice">
                    ${azureVoices.map(v => `<option value="${v.value}" ${(stimulus.fields.azure_voice || '') === v.value ? 'selected' : ''}>${v.label} — ${v.value}</option>`).join('')}
                  </select>
                </label>
                ` : ''}

                <!-- 2. Language -->
                <label class="field" style="grid-column:1/-1;">
                  ${tt('2. Language', '2. Langue', '2. Sprache')}
                  <select data-stimulus-field="${stimulus.id}.tts_language">
                    ${TTS_LANGUAGES.map(l => `<option value="${l.value}" ${lang === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
                  </select>
                </label>

                <!-- 3. Text -->
                <label class="field" style="grid-column:1/-1;">
                  ${tt('3. Text to speak', '3. Texte à lire', '3. Sprechtext')}
                  <textarea data-stimulus-field="${stimulus.id}.text" style="min-height:120px;">${escapeHtml(stimulus.fields.text || '')}</textarea>
                  <div class="actions" style="margin-top:4px;">
                    <button class="btn btn-ghost" style="font-size:0.82rem; padding:6px 10px;" data-action="generate-field" data-stimulus-id="${stimulus.id}" data-field-name="text" ${_textGenerating ? 'disabled' : ''}>${_textGenerating ? `<span class="ai-spinner-primary"></span>${tt('Generating…', 'Génération en cours…', 'Wird generiert…')}` : `${sbUiIcon('sparkles', 14)} ${tt('Regenerate text', 'Régénérer le texte', 'Text neu generieren')}`}</button>
                  </div>
                </label>

              </div>
            `}

            <!-- Watermark -->
            <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border, #e5e7eb);">
              <p style="margin:0 0 8px; font-size:0.82rem; font-weight:600; color:var(--text-muted, #6b7280);">${tt('Watermark (prepended to export)', 'Filigrane (ajouté au début de l\'export)', 'Wasserzeichen (dem Export vorangestellt)')}</p>
              <div style="display:flex; gap:10px; align-items:flex-start; flex-wrap:wrap;">
                <label class="field" style="margin:0; min-width:160px;">
                  <select data-stimulus-field="${stimulus.id}.audio_watermark_type">
                    <option value="beeps" ${wmType === 'beeps' ? 'selected' : ''}>${tt('3 beeps', '3 bips', '3 Pieptöne')}</option>
                    <option value="text" ${wmType === 'text' ? 'selected' : ''}>${tt('Text (spoken)', 'Texte (lu)', 'Text (gesprochen)')}</option>
                  </select>
                </label>
                ${wmType === 'text' ? `
                <label class="field" style="margin:0; flex:1; min-width:200px;">
                  <input type="text" data-stimulus-field="${stimulus.id}.audio_watermark_text" value="${escapeAttribute(wmText)}" placeholder="EXERCISE">
                </label>
                ` : ''}
              </div>
            </div>

            <!-- Audio player (if audio is ready) -->
            ${hasAudio ? `
              <div style="margin-top:12px; padding:10px 14px; background:var(--bg-alt, #f1f5f9); border-radius:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span style="font-size:0.82rem; color:var(--text-muted, #6b7280); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sbUiIcon('headphones', 13)} ${escapeHtml(audioInfo.fileName || tt('Audio ready', 'Audio prêt', 'Audio bereit'))}</span>
                <button class="btn btn-xs btn-secondary" data-action="play-audio" data-stimulus-id="${stimulus.id}">${sbUiIcon('play', 12)} ${tt('Play', 'Écouter', 'Abspielen')}</button>
                <button class="btn btn-xs btn-secondary" data-action="stop-audio" data-stimulus-id="${stimulus.id}">${sbUiIcon('pause', 12)} ${tt('Pause', 'Pause', 'Pause')}</button>
                <button class="btn btn-xs btn-secondary" data-action="rewind-audio" data-stimulus-id="${stimulus.id}">${sbUiIcon('rewind', 12)} ${tt('Rewind', 'Rembobiner', 'Zurückspulen')}</button>
                <button class="btn btn-xs btn-success" data-action="export-audio" data-stimulus-id="${stimulus.id}">${tt('Export', 'Exporter', 'Exportieren')}</button>
                <button class="btn btn-ghost btn-xs" data-action="clear-audio" data-stimulus-id="${stimulus.id}">${tt('Remove', 'Supprimer', 'Entfernen')}</button>
              </div>
            ` : ''}
          </div>
        `;
      }

      function renderStimulusWatermarkControls(stimulus) {
        const wm = stimulus.watermark || {};
        const hasOverride = stimulus.watermark !== null;
        return `
          <div style="margin-top:16px; border:1px solid var(--border, #e5e7eb); border-radius:8px; padding:14px 16px;">
            <p style="margin:0 0 10px; font-size:0.88rem; font-weight:600; color:var(--text-muted, #6b7280);">${tt('Watermark override', 'Filigrane personnalisé', 'Wasserzeichen überschreiben')}</p>
            <div class="field-grid cols-2">
              <label class="field">${tt('Override watermark', 'Personnaliser le filigrane', 'Wasserzeichen anpassen')}
                <select data-stimulus-watermark="${stimulus.id}.override">
                  <option value="false" ${!hasOverride ? 'selected' : ''}>${tt('Use global settings', 'Utiliser les réglages globaux', 'Globale Einstellungen verwenden')}</option>
                  <option value="true" ${hasOverride ? 'selected' : ''}>${tt('Custom for this inject', 'Personnalisé pour cet inject', 'Angepasst für diesen Inject')}</option>
                </select>
              </label>
              ${hasOverride ? `
                <label class="field">${tt('Enabled', 'Activé', 'Aktiviert')}
                  <select data-stimulus-watermark="${stimulus.id}.enabled">
                    <option value="true" ${wm.enabled !== false ? 'selected' : ''}>${tt('Yes', 'Oui', 'Ja')}</option>
                    <option value="false" ${wm.enabled === false ? 'selected' : ''}>${tt('No', 'Non', 'Nein')}</option>
                  </select>
                </label>
                <label class="field" style="grid-column:1/-1;">${tt('Text', 'Texte', 'Text')}
                  <input type="text" data-stimulus-watermark="${stimulus.id}.text" value="${escapeAttribute(wm.text || 'EXERCISE EXERCISE EXERCISE')}">
                </label>
                <label class="field">${tt('Text size (pt)', 'Taille du texte (pt)', 'Textgröße (pt)')}
                  <input type="number" min="6" max="120" step="1" data-stimulus-watermark="${stimulus.id}.text_size" value="${wm.text_size ?? 16}">
                </label>
                <label class="field">${tt('Vertical position', 'Position verticale', 'Vertikale Position')}
                  <select data-stimulus-watermark="${stimulus.id}.position_v">
                    <option value="top" ${wm.position_v === 'top' || !wm.position_v ? 'selected' : ''}>${tt('Top', 'Haut', 'Oben')}</option>
                    <option value="middle" ${wm.position_v === 'middle' ? 'selected' : ''}>${tt('Middle', 'Milieu', 'Mitte')}</option>
                    <option value="bottom" ${wm.position_v === 'bottom' ? 'selected' : ''}>${tt('Bottom', 'Bas', 'Unten')}</option>
                  </select>
                </label>
                <label class="field">${tt('Horizontal position', 'Position horizontale', 'Horizontale Position')}
                  <select data-stimulus-watermark="${stimulus.id}.position_h">
                    <option value="left" ${wm.position_h === 'left' ? 'selected' : ''}>${tt('Left', 'Gauche', 'Links')}</option>
                    <option value="center" ${wm.position_h === 'center' || !wm.position_h ? 'selected' : ''}>${tt('Center', 'Centre', 'Mitte')}</option>
                    <option value="right" ${wm.position_h === 'right' ? 'selected' : ''}>${tt('Right', 'Droite', 'Rechts')}</option>
                  </select>
                </label>
                <label class="field">${tt('Opacity (%)', 'Opacité (%)', 'Deckkraft (%)')}
                  <input type="number" min="0" max="100" step="5" data-stimulus-watermark="${stimulus.id}.opacity" value="${wm.opacity ?? 50}">
                </label>
                <label class="field">${tt('Rotation', 'Rotation', 'Drehung')}
                  <select data-stimulus-watermark="${stimulus.id}.rotation">
                    <option value="0" ${String(wm.rotation || 0) === '0' ? 'selected' : ''}>0°</option>
                    <option value="45" ${String(wm.rotation || 0) === '45' ? 'selected' : ''}>45°</option>
                    <option value="90" ${String(wm.rotation || 0) === '90' ? 'selected' : ''}>90°</option>
                    <option value="135" ${String(wm.rotation || 0) === '135' ? 'selected' : ''}>135°</option>
                    <option value="180" ${String(wm.rotation || 0) === '180' ? 'selected' : ''}>180°</option>
                  </select>
                </label>
              ` : ''}
            </div>
          </div>
        `;
      }

      function renderStimulusModal(stimulus) {
        if (!stimulus) return '';
        const editorWidth = appState.ui?.stimulusModalEditorWidth || 50;
        const h = Math.floor(stimulus.timestamp_offset_minutes / 60);
        const m = String(stimulus.timestamp_offset_minutes % 60).padStart(2, '0');
        const meta = CHANNEL_META[stimulus.channel] || CHANNEL_META.email_internal;
        return `
          <div class="modal-backdrop">
            <div class="modal-box modal-box-stimulus">
              <div class="modal-header">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span class="stimulus-modal-channel-dot" style="background:${meta.color};"></span>
                  <div>
                    <h3 style="margin:0;">${escapeHtml(stimulus.name || channelLabel(stimulus.channel))}</h3>
                    <p class="subtle" style="margin:0; font-size:0.82rem;">${escapeHtml(channelLabel(stimulus.channel))} · H+${h}:${m}</p>
                  </div>
                </div>
                <div class="actions">
                  <button class="btn btn-secondary mobile-preview-toggle" data-action="toggle-mobile-preview">${appState.ui?.mobilePreviewVisible ? tt('Editor', 'Éditeur', 'Editor') : tt('Preview', 'Aperçu', 'Vorschau')}</button>
                  ${(stimulus.history?.length > 0) ? `<button class="btn btn-secondary" data-action="show-history" data-stimulus-id="${stimulus.id}">${tt('History', 'Historique', 'Verlauf')} (${stimulus.history.length})</button>` : ''}
                  <button class="btn btn-secondary" data-action="duplicate-stimulus" data-stimulus-id="${stimulus.id}">${tt('Duplicate', 'Dupliquer', 'Duplizieren')}</button>
                  <button class="btn btn-secondary" data-action="close-stimulus-modal" aria-label="Close">${sbUiIcon('close', 16)}</button>
                </div>
              </div>
              <div class="modal-body-stimulus${appState.ui?.mobilePreviewVisible ? ' mobile-preview-active' : ''}" data-stimulus-modal-body style="--stimulus-modal-editor-width:${editorWidth}%; --stimulus-modal-preview-width:${100 - editorWidth}%;">
                <div class="stimulus-modal-left">
                  ${renderStimulusEditorModal(stimulus)}
                </div>
                <div class="resize-handle resize-handle-vertical" data-resize-handle="stimulus-modal-width" role="separator" aria-orientation="vertical" aria-label="${tt('Resize editor and preview', 'Redimensionner l\'éditeur et la prévisualisation', 'Editor und Vorschau in der Größe ändern')}"></div>
                <div class="stimulus-modal-right">
                  <div class="preview-toolbar-inline">
                    ${String(stimulus.channel || '').startsWith('email_') ? `<button class="btn btn-secondary" data-action="export-msg" data-stimulus-id="${stimulus.id}">${tt('Export .eml', 'Exporter .eml', '.eml exportieren')}</button>` : ''}
                    ${appState.videoFiles?.[stimulus.id] && stimulus.channel === 'breaking_news_tv' ? `<button class="btn btn-secondary" data-action="export-video" data-stimulus-id="${stimulus.id}" ${appState.ui?.actionLoading?.['export-video'] ? 'disabled' : ''}>${actionButtonLabel('export-video', tt('Export video', 'Exporter la vidéo', 'Video exportieren'), tt('Encoding…', 'Encodage…', 'Wird codiert…'))}</button>` : ''}
                    ${stimulus.channel === 'audio_message' ? `
                      ${(stimulus.fields.audio_mode || 'create') === 'create' ? `
                        <button class="btn btn-primary" data-action="generate-tts" data-stimulus-id="${stimulus.id}" ${appState.ui?.actionLoading?.['generate-tts'] ? 'disabled' : ''}>${appState.ui?.actionLoading?.['generate-tts'] ? `<span class="ai-spinner"></span>${tt('Generating…', 'Génération…', 'Wird generiert…')}` : tt('Generate audio', 'Générer l\'audio', 'Audio generieren')}</button>
                      ` : ''}
                      ${appState.audioFiles?.[stimulus.id] ? `
                        <button class="btn btn-secondary" data-action="play-audio" data-stimulus-id="${stimulus.id}">${sbUiIcon('play', 12)} ${tt('Play', 'Lecture', 'Abspielen')}</button>
                        <button class="btn btn-secondary" data-action="stop-audio" data-stimulus-id="${stimulus.id}">${sbUiIcon('pause', 12)} ${tt('Pause', 'Pause', 'Pause')}</button>
                        <button class="btn btn-secondary" data-action="rewind-audio" data-stimulus-id="${stimulus.id}">${sbUiIcon('rewind', 12)} ${tt('Rewind', 'Rembobiner', 'Zurückspulen')}</button>
                        <button class="btn btn-success" data-action="export-audio" data-stimulus-id="${stimulus.id}">${tt('Export audio', 'Exporter l\'audio', 'Audio exportieren')}</button>
                      ` : ''}
                    ` : ''}
                    ${stimulus.channel !== 'audio_message' ? `<button class="btn btn-secondary" data-action="export-png" data-stimulus-id="${stimulus.id}" ${appState.ui?.actionLoading?.['export-png'] ? 'disabled' : ''}>${actionButtonLabel('export-png', tt('Export PNG', 'Exporter PNG', 'PNG exportieren'), tt('Exporting…', 'Export en cours…', 'Wird exportiert…'))}</button>` : ''}
                  </div>
                  <div class="preview-shell stimuli-preview-shell" style="margin:0; border-radius:0; border:none; min-height:calc(100% - 44px);">
                    <div class="preview-stage${stimulus.channel === 'breaking_news_tv' ? ' video-stimulus-preview' : ''}">
                      ${renderStimulusPreview(stimulus)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      function renderFieldControl(stimulus, spec) {
        const value = stimulus.fields[spec.key];
        const bind = `data-stimulus-field="${stimulus.id}.${spec.key}"`;
        const _gf = appState.ui?.generatingField;
        const _fieldGenerating = _gf && _gf.stimulusId === stimulus.id && (_gf.fieldName === spec.key || _gf.fieldName === null);
        const genBtn = `<div class="actions" style="margin-top:4px;"><button class="btn btn-ghost" style="font-size:0.82rem; padding:6px 10px;" data-action="generate-field" data-stimulus-id="${stimulus.id}" data-field-name="${spec.key}" ${_fieldGenerating ? 'disabled' : ''}>${_fieldGenerating ? `<span class="ai-spinner-primary"></span>${tt('Generating…', 'Génération en cours…', 'Wird generiert…')}` : `${sbUiIcon('sparkles', 14)} ${tt('Regenerate', 'Régénérer', 'Neu generieren')}`}</button></div>`;
        if (spec.type === 'textarea') {
          const content = Array.isArray(value) ? JSON.stringify(value) : String(value ?? '');
          return `
            <label class="field">${escapeHtml(spec.label)}
              <textarea ${bind}>${escapeHtml(content)}</textarea>
              ${genBtn}
            </label>
          `;
        }
        if (spec.type === 'select') {
          // For TTS provider, show a hint when azure is selected but no key configured
          const isProviderField = spec.key === 'tts_provider';
          const azureHint = isProviderField && String(value) === 'azure_speech' && !appState.scenario.settings.azure_speech_key
            ? `<p style="margin:4px 0 0; font-size:0.78rem; color:#b91c1c;">${sbUiIcon('alert', 13)} ${tt('Azure Speech requires an API key. Configure it in Settings.', 'Azure Speech nécessite une clé API. Configurez-la dans les Paramètres.', 'Azure Speech erfordert einen API-Schlüssel. Konfigurieren Sie ihn in den Einstellungen.')}</p>`
            : '';
          const providerLabels = isProviderField ? { browser: tt('Browser (built-in)', 'Navigateur (intégré)', 'Browser (eingebaut)'), azure_speech: 'Azure Speech (Neural)' } : {};
          return `
            <label class="field">${escapeHtml(spec.label)}
              <select ${bind}>
                ${(spec.options || []).map((option) => `<option value="${option}" ${String(value) === String(option) ? 'selected' : ''}>${isProviderField ? (providerLabels[option] || option) : option}</option>`).join('')}
              </select>
              ${azureHint}
              ${genBtn}
            </label>
          `;
        }
        if (spec.type === 'tts_language_select') {
          const effectiveLang = value || (() => { const l = appState.scenario.settings.inject_language || appState.scenario.settings.language || 'en'; if (l === 'fr') return 'fr-FR'; if (l === 'de') return 'de-DE'; return 'en-US'; })();
          return `
            <label class="field">${escapeHtml(spec.label)}
              <select ${bind}>
                <option value="" ${!value ? 'selected' : ''}>${tt('Auto (from interface language)', 'Auto (depuis la langue de l\'interface)', 'Auto (von der Oberflächensprache)')}</option>
                ${TTS_LANGUAGES.map(l => `<option value="${l.value}" ${String(value) === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
              </select>
            </label>
          `;
        }
        if (spec.type === 'azure_voice_select') {
          const provider = stimulus.fields.tts_provider || 'browser';
          if (provider !== 'azure_speech') return '';
          const lang = stimulus.fields.tts_language || (() => { const l = appState.scenario.settings.inject_language || appState.scenario.settings.language || 'en'; if (l === 'fr') return 'fr-FR'; if (l === 'de') return 'de-DE'; return 'en-US'; })();
          const charGender = (stimulus.fields.audio_character === 'female') ? 'female' : 'male';
          const allVoices = AZURE_SPEECH_VOICES[lang] || AZURE_SPEECH_VOICES['en-US'] || [];
          const filteredVoices = allVoices.filter(v => v.gender === charGender);
          const voices = filteredVoices.length > 0 ? filteredVoices : allVoices;
          // Auto-select first matching voice if current value is not in the filtered list
          if (voices.length > 0 && !voices.some(v => v.value === String(value))) {
            stimulus.fields.azure_voice = voices[0].value;
          }
          return `
            <label class="field">${escapeHtml(spec.label)}
              <select ${bind}>
                ${voices.map(v => `<option value="${v.value}" ${String(stimulus.fields.azure_voice || value) === v.value ? 'selected' : ''}>${v.label} — ${v.value}</option>`).join('')}
              </select>
            </label>
          `;
        }
        if (spec.type === 'attacker_voice_select') {
          if (stimulus.fields.voice_type !== 'cybercriminal') return '';
          const uiLang = appState.scenario.settings.language || 'en';
          return `
            <label class="field">${escapeHtml(spec.label)}
              <select ${bind}>
                ${Object.entries(ATTACKER_VOICE_PRESETS).map(([k, preset]) => {
                  const label = preset.label[uiLang] || preset.label.en;
                  return `<option value="${k}" ${String(value) === k ? 'selected' : ''}>${label}</option>`;
                }).join('')}
              </select>
            </label>
          `;
        }
        if (spec.type === 'checkbox') {
          return `
            <label class="field">${escapeHtml(spec.label)}
              <select ${bind}><option value="true" ${value ? 'selected' : ''}>${tt('Yes', 'Oui', 'Ja')}</option><option value="false" ${!value ? 'selected' : ''}>${tt('No', 'Non', 'Nein')}</option></select>
            </label>
          `;
        }
        if (spec.type === 'photo_upload') {
          const hasImage = value && String(value).startsWith('data:');
          return `
            <div class="field" style="grid-column:1/-1;">
              <span style="display:block; margin-bottom:6px; font-size:0.85rem; color:var(--text-muted, #6b7280);">${escapeHtml(spec.label)}</span>
              ${hasImage ? `<img src="${escapeAttribute(value)}" style="width:100%; max-height:180px; object-fit:cover; border-radius:6px; margin-bottom:8px; display:block;" alt="">` : ''}
              <div style="display:flex; gap:8px; align-items:center;">
                <label class="btn btn-secondary" style="cursor:pointer; margin:0;">
                  ${tt('Upload photo', 'Télécharger une photo', 'Foto hochladen')}
                  <input type="file" accept="image/*" data-stimulus-photo="${stimulus.id}.${spec.key}" style="display:none;">
                </label>
                ${hasImage ? `<button class="btn btn-ghost" data-action="clear-photo" data-stimulus-id="${stimulus.id}" data-field-name="${spec.key}">${tt('Remove', 'Supprimer', 'Entfernen')}</button>` : ''}
              </div>
            </div>
          `;
        }
        return `
          <label class="field">${escapeHtml(spec.label)}
            <input type="${spec.type}" ${bind} value="${escapeAttribute(value ?? '')}">
            ${genBtn}
          </label>
        `;
      }


      function resolveWatermarkConfig(stimulus) {
        const settings = appState.scenario?.settings || {};
        if (stimulus.watermark) return stimulus.watermark;
        return {
          enabled: settings.watermark_enabled !== false,
          text: settings.watermark_text || 'EXERCISE EXERCISE EXERCISE',
          text_size: settings.watermark_text_size ?? 16,
          position_v: settings.watermark_position_v || 'top',
          position_h: settings.watermark_position_h || 'center',
          opacity: settings.watermark_opacity ?? 50,
          rotation: settings.watermark_rotation ?? 0
        };
      }

      function renderWatermarkOverlay(stimulus) {
        const wm = resolveWatermarkConfig(stimulus);
        if (!wm.enabled) return '';
        const vMap = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
        const hMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
        const alignItems = vMap[wm.position_v] || 'center';
        const justifyContent = hMap[wm.position_h] || 'center';
        const opacity = Math.max(0, Math.min(100, Number(wm.opacity) || 50)) / 100;
        const rotation = Number(wm.rotation) || 0;
        const textSize = Math.max(6, Math.min(120, Number(wm.text_size) || 16));
        return `<div class="export-watermark-overlay" style="display:flex; align-items:${alignItems}; justify-content:${justifyContent};"><span class="export-watermark-text" style="opacity:${opacity}; transform:rotate(-${rotation}deg); font-size:${textSize}pt;">${escapeHtml(wm.text || '')}</span></div>`;
      }

      function renderStimulusPreview(stimulus, id = '', thumbnail = false) {
        const wrapperId = id || `render-${stimulus.id}`;
        const videoInfo = appState.videoFiles?.[stimulus.id];
        const hasVideo = videoInfo && stimulus.channel === 'breaking_news_tv';
        const watermark = renderWatermarkOverlay(stimulus);

        if (hasVideo) {
          const overlayBody = TemplateEngine.renderOverlay(stimulus, appState.scenario);
          return `<div id="${wrapperId}" class="render-frame tv-video-frame" style="position:relative; width:1280px; height:720px; transform:${thumbnail ? 'scale(0.22)' : 'none'}; transform-origin: top center; overflow:hidden;">
            <video class="tv-video-bg" src="${escapeAttribute(videoInfo.objectUrl)}" ${thumbnail ? '' : 'autoplay loop'} playsinline style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;"></video>
            <div class="tv-overlay-layer" style="position:absolute; inset:0; z-index:2;">${overlayBody}</div>
            <div style="position:absolute; inset:0; z-index:3;">${watermark}</div>
          </div>`;
        }

        const body = TemplateEngine.render(stimulus, getActor(stimulus.actor_id), appState.scenario);
        return `<div id="${wrapperId}" class="render-frame" style="position:relative; transform:${thumbnail ? 'scale(0.22)' : 'none'}; transform-origin: top center;">${body}${watermark}</div>`;
      }

      function renderHistoryModal(stimulus) {
        if (!stimulus) return '';
        const history = stimulus.history || [];
        const actor = getActor(stimulus.actor_id);
        return `
          <div class="modal-backdrop">
            <div class="modal-box">
              <div class="modal-header">
                <h3>${tt('Version history', 'Historique des versions', 'Versionsverlauf')} — ${escapeHtml(channelLabel(stimulus.channel))}</h3>
                <button class="btn btn-secondary" data-action="close-history" aria-label="Close">${sbUiIcon('close', 16)}</button>
              </div>
              <div class="modal-body">
                ${history.length === 0
                  ? `<p class="subtle" style="padding:16px;">${tt('No history yet. Generate content to create versions.', 'Aucun historique. Générez du contenu pour créer des versions.', 'Noch kein Verlauf. Generieren Sie Inhalt, um Versionen zu erstellen.')}</p>`
                  : history.map((version, index) => `
                    <div class="history-entry">
                      <div class="history-entry-meta">
                        <strong>v${history.length - index}</strong>
                        <span class="subtle">${new Date(version.saved_at).toLocaleString()}</span>
                        <span>${escapeHtml(version.change_summary || '')}</span>
                        <button class="btn btn-xs btn-secondary" data-action="restore-version" data-stimulus-id="${stimulus.id}" data-version-index="${index}">${tt('Restore', 'Restaurer', 'Wiederherstellen')}</button>
                      </div>
                      <div class="history-entry-preview">
                        ${Object.entries(version.fields).slice(0, 2).map(([k, v]) =>
                          `<div><span class="mono" style="color:var(--muted); font-size:0.75rem;">${escapeHtml(k)}</span>: ${escapeHtml(String(v || '').slice(0, 80))}${String(v || '').length > 80 ? '…' : ''}</div>`
                        ).join('')}
                      </div>
                    </div>
                  `).join('')
                }
              </div>
            </div>
          </div>
        `;
      }

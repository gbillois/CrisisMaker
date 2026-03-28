      function getLLMErrorMessage(errorCode) {
        const messages = {
          auth:      tt('Invalid API key. Check it in settings (⚙).', 'Clé API invalide. Vérifiez-la dans les paramètres (⚙).', 'Ungültiger API-Schlüssel. Überprüfen Sie ihn in den Einstellungen (⚙).'),
          quota:     tt('API quota exceeded. Retry later or change model.', 'Quota API dépassé. Réessayez plus tard ou changez de modèle.', 'API-Kontingent überschritten. Versuchen Sie es später erneut oder wechseln Sie das Modell.'),
          network:   tt('Connection error. Check your internet connection and retry.', 'Erreur de connexion. Vérifiez votre connexion internet et réessayez.', 'Verbindungsfehler. Überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.'),
          malformed: tt('Generation failed. Try rephrasing your description.', 'La génération a échoué. Essayez de reformuler votre description.', 'Generierung fehlgeschlagen. Versuchen Sie, Ihre Beschreibung umzuformulieren.'),
          empty:     tt('Describe what you want before generating.', 'Décrivez ce que vous voulez avant de générer.', 'Beschreiben Sie, was Sie generieren möchten, bevor Sie starten.')
        };
        return messages[errorCode] || errorCode;
      }

      function classifyLLMError(err) {
        const msg = err?.message || '';
        if (msg.includes('401') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('api key')) return 'auth';
        if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) return 'quota';
        if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('connection')) return 'network';
        return 'malformed';
      }

      function renderLLMConfigBlock(zone, placeholder, options = {}) {
        const state = appState.llmState[zone];
        const available = isLLMAvailable();
        const collapsed = state.collapsed;
        const loading = state.loading;
        const title = options.title || tt('Configure with LLM', 'Configurer avec le LLM', 'Mit LLM konfigurieren');
        const subtitle = options.subtitle || tt(
          'Describe what you want in natural language. If information is missing, the LLM will fill in the most likely values.',
          'Décrivez ce que vous voulez en langage naturel. Si des informations manquent, le LLM complétera avec les valeurs les plus probables.',
          'Beschreiben Sie auf natürliche Sprache, was Sie möchten. Fehlen Informationen, ergänzt das LLM die wahrscheinlichsten Werte.'
        );

        const generateLabel = loading
          ? `<span class="ai-spinner"></span>${options.loadingLabel || tt('Generating…', 'Génération en cours…')}`
          : (options.generateLabel || tt('Generate ✨', 'Générer ✨'));
        const disabledAttr = (!available || loading) ? 'disabled' : '';
        const noKeyTooltip = !available
          ? escapeAttribute(tt(
              'Configure your API key in settings (⚙) to use this feature.',
              'Configurez votre clé API dans les paramètres (⚙) pour utiliser cette fonctionnalité.',
              'Konfigurieren Sie Ihren API-Schlüssel in den Einstellungen (⚙), um diese Funktion zu nutzen.'
            ))
          : '';

        const errorHtml = state.error && state.error !== 'empty'
          ? `<div class="llm-error-banner${['quota', 'network', 'malformed'].includes(state.error) ? ' llm-warning' : ''}">${escapeHtml(getLLMErrorMessage(state.error))}</div>`
          : '';

        const pendingActorsHtml = (zone === 'actors' && state.pendingActors && state.pendingActors.length > 0)
          ? renderPendingActorsPanel(state.pendingActors)
          : '';

        const successMessage = options.successMessage
          ? options.successMessage(state.lastFilledCount)
          : tt(`${state.lastFilledCount} field(s) pre-filled by the LLM. Check and adjust if needed.`, `${state.lastFilledCount} champ(s) pré-rempli(s) par le LLM. Vérifiez et ajustez si nécessaire.`, `${state.lastFilledCount} Feld(er) vom LLM vorausgefüllt. Überprüfen und anpassen falls nötig.`);

        const successBannerHtml = (zone !== 'actors' && state.lastFilledCount > 0 && !loading && !state.error)
          ? `<div class="llm-success-banner">
              <span>✅ ${successMessage}</span>
              <button data-action="llm-dismiss-banner" data-zone="${zone}">${tt('OK', 'OK', 'OK')}</button>
             </div>`
          : '';

        return `
          <div class="llm-config-block${collapsed ? ' collapsed' : ''}" id="llm-block-${zone}">
            <div class="llm-config-header">
              <span class="llm-config-title">🤖 ${title}</span>
              <button class="btn-llm-collapse" data-action="llm-collapse" data-zone="${zone}">
                ${collapsed ? '▶ ' + tt('Expand', 'Développer', 'Erweitern') : '▼ ' + tt('Reduce', 'Réduire', 'Reduzieren')}
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

      function pushToast(message, type = 'success') {
        const id = uid('toast');
        appState.toasts.push({ id, message, type });
        renderToasts();
        setTimeout(() => {
          appState.toasts = appState.toasts.filter((toast) => toast.id !== id);
          renderToasts();
        }, 4200);
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
            <nav class="nav-topbar">
              <div class="nav-topbar-left">
                <button class="nav-icon-btn nav-home-btn" data-action="show-launch-screen" title="${tt('Home', 'Accueil', 'Startseite')}">
                  ${svgHome()}
                  <span>${tt('Home', 'Accueil', 'Startseite')}</span>
                </button>
                ${renderNavIconButton('project', svgFolder(), tt('Project', 'Projet', 'Projekt'))}
                ${renderNavIconButton('scenario', svgTarget(), tt('Scenario', 'Scénario', 'Szenario'))}
                ${renderNavIconButton('stimuli', svgPen(), tt('Timeline', 'Timeline', 'Zeitplan'))}
                ${renderNavIconButton('library', svgGrid(), tt('Injects', 'Injects', 'Injects'))}
                ${renderNavIconButton('checker', svgShieldCheck(), tt('Checker', 'Checker', 'Prüfer'))}
              </div>
              <div class="nav-topbar-center">
                <div class="nav-brand-block"><span class="nav-brand-eyebrow">${tt('CrisisMaker by Wavestone', 'CrisisMaker by Wavestone', 'CrisisMaker by Wavestone')}</span><span class="nav-project-name">${escapeHtml(appState.scenario.name || tt('CrisisMaker project', 'Projet CrisisMaker', 'CrisisMaker-Projekt'))}</span></div>
              </div>
              <div class="nav-topbar-right">
                <span id="save-indicator" style="color:rgba(255,255,255,0.5); font-size:0.75rem; margin-right:8px;"></span>
                <button class="nav-gear-btn" data-action="save-local" title="${tt('Save', 'Sauvegarder', 'Speichern')}">
                  ${svgSave()}
                </button>
                <button class="nav-gear-btn ${appState.settingsDrawerOpen ? 'active' : ''}" data-action="toggle-settings-drawer" title="${tt('Settings', 'Paramètres', 'Einstellungen')}">
                  ${svgGear()}
                </button>
              </div>
            </nav>

            <div class="settings-drawer ${appState.settingsDrawerOpen ? 'open' : ''}">
              <div class="settings-drawer-header">
                <h3>${tt('Settings', 'Paramètres', 'Einstellungen')}</h3>
                <button class="btn btn-secondary" data-action="toggle-settings-drawer">✕</button>
              </div>
              <div class="settings-drawer-body">
                ${renderSettingsView()}
              </div>
            </div>

            <main class="content">
              ${vc ? `<section class="topbar">
                <div class="page-title">
                  <h2>${vc.title}</h2>
                  <p>${vc.subtitle}</p>
                </div>
                <div class="status-pills">
                  <span class="pill pill-project">${escapeHtml(appState.scenario.name || tt('Untitled', 'Sans titre', 'Ohne Titel'))}</span>
                  <span class="pill">${appState.scenario.actors.length} ${tt('actors', 'acteurs', 'Akteure')}</span>
                  <span class="pill">${appState.scenario.stimuli.length} ${tt('stimuli', 'stimuli', 'Stimuli')}</span>
                  <span class="pill ${isLLMAvailable() ? 'pill-ai-live' : 'pill-ai-off'}">${isLLMAvailable() ? tt('AI - Live', 'IA - Active', 'KI - Aktiv') : tt('AI - Disconnected', 'IA - Déconnectée', 'KI - Getrennt')}</span>
                </div>
              </section>` : ''}
              ${renderCurrentView()}
            </main>
            ${appState.historyModalStimulusId ? renderHistoryModal(getStimulus(appState.historyModalStimulusId)) : ''}
            ${appState.stimulusModalId ? renderStimulusModal(getStimulus(appState.stimulusModalId)) : ''}
            ${appState.chronogramImport ? renderChronogramImportModals() : ''}
          </div>
        `;
      }

      function renderNavIconButton(route, iconSvg, label) {
        const isActive = appState.route === route;
        return `<button class="nav-icon-btn ${isActive ? 'active' : ''}" data-route="${route}" title="${label}">
          ${iconSvg}
          <span>${label}</span>
        </button>`;
      }

      function svgFolder() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'; }
      function svgTarget() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>'; }
      function svgPen() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>'; }
      function svgGrid() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>'; }
      function svgShieldCheck() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>'; }
      function svgGear() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'; }
      function svgSave() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>'; }
      function svgHome() { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>'; }

      function renderLaunchScreen() {
        const llmAvailable = isLLMAvailable();
        return `
          <div class="launch-screen-overlay" data-action="close-launch-screen">
            <div class="launch-screen" onclick="event.stopPropagation()">

              <div class="launch-hero">
                <button class="launch-hero-close" data-action="close-launch-screen" title="${tt('Close', 'Fermer', 'Schließen')}">✕</button>
                <span class="hero-kicker">${tt('CrisisMaker by Wavestone', 'CrisisMaker by Wavestone', 'CrisisMaker by Wavestone')}</span>
                <h1 class="launch-hero-title">${tt('Accelerate crisis exercises inject creation.', 'Accélérez la création d\'injects pour les exercices de crise.', 'Beschleunigen Sie die Erstellung von Injects für Krisenübungen.')}</h1>
                <p class="launch-hero-desc">${tt('A complete studio to prepare realistic scenarios, generate crisis injects, and export polished deliverables — all from your browser, with no server required.', 'Un studio complet pour préparer des scénarios réalistes, générer des injects de crise et exporter des livrables soignés — depuis votre navigateur, sans serveur requis.', 'Ein vollständiges Studio zur Vorbereitung realistischer Szenarien, Generierung von Krisen-Injects und Export fertiger Lieferobjekte — alles im Browser, ohne Server.')}</p>
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
                    <span>${tt('.json · .zip · styled images', '.json · .zip · images stylées', '.json · .zip · gestaltete Bilder')}</span>
                  </div>
                </div>
              </div>

              <div class="launch-body">
                <div>
                  <div class="welcome-block-title" style="margin-bottom:14px;">${tt('What you can do', 'Ce que vous pouvez faire', 'Was Sie tun können')}</div>
                  <div class="launch-features">
                    <div class="launch-feature-card">
                      <div class="launch-feature-icon">${svgFolder()}</div>
                      <strong>${tt('Project', 'Projet', 'Projekt')}</strong>
                      <p>${tt('Create, open, save and export your crisis exercise projects. Import existing Excel timelines with AI assistance.', 'Créez, ouvrez, sauvegardez et exportez vos projets. Importez des chronologies Excel existantes avec l\'aide de l\'IA.', 'Erstellen, öffnen, speichern und exportieren Sie Ihre Krisenübungsprojekte. Importieren Sie vorhandene Excel-Zeitpläne mit KI-Unterstützung.')}</p>
                    </div>
                    <div class="launch-feature-card">
                      <div class="launch-feature-icon">${svgTarget()}</div>
                      <strong>${tt('Scenario', 'Scénario', 'Szenario')}</strong>
                      <p>${tt('Define the client organisation, crisis type, timeline and actors who will receive injects during the exercise.', 'Définissez l\'organisation cliente, le type de crise, la chronologie et les acteurs qui recevront les injects.', 'Definieren Sie die Kundenorganisation, den Krisentyp, den Zeitplan und die Akteure, die während der Übung Injects erhalten.')}</p>
                    </div>
                    <div class="launch-feature-card">
                      <div class="launch-feature-icon">${svgPen()}</div>
                      <strong>${tt('Timeline', 'Timeline', 'Zeitplan')}</strong>
                      <p>${tt('Write or AI-generate realistic crisis injects: emails, SMS, calls, social posts and more — with polished visual templates.', 'Rédigez ou générez par IA des injects réalistes : emails, SMS, appels, posts sociaux — avec des gabarits visuels soignés.', 'Schreiben oder generieren Sie mit KI realistische Krisen-Injects: E-Mails, SMS, Anrufe, Social-Media-Beiträge und mehr — mit ansprechenden visuellen Vorlagen.')}</p>
                    </div>
                    <div class="launch-feature-card">
                      <div class="launch-feature-icon">${svgGrid()}</div>
                      <strong>${tt('Injects', 'Injects', 'Injects')}</strong>
                      <p>${tt('Browse, filter and preview all injects. Export them as styled images or download the complete package as a ZIP.', 'Parcourez, filtrez et prévisualisez tous les injects. Exportez-les en images ou téléchargez le package complet en ZIP.', 'Durchsuchen, filtern und vorab anzeigen Sie alle Injects. Exportieren Sie sie als gestaltete Bilder oder laden Sie das komplette Paket als ZIP herunter.')}</p>
                    </div>
                    <div class="launch-feature-card">
                      <div class="launch-feature-icon">${svgShieldCheck()}</div>
                      <strong>${tt('Crisis Checker', 'Crisis Checker', 'Krisen-Prüfer')}</strong>
                      <p>${tt('Audit any crisis exercise chronogram — import an .xlsx, .xls or .pptx file (or use your current scenario) and let the AI analyze coverage, pacing, actor balance and realism, then export a quality report.', 'Auditez n\'importe quel chronogramme — importez un fichier .xlsx, .xls ou .pptx (ou utilisez votre scénario actuel) et laissez l\'IA analyser la couverture, le rythme, l\'équilibre des acteurs et le réalisme, puis exportez un rapport qualité.', 'Prüfen Sie beliebige Krisenübungs-Chronogramme — importieren Sie eine .xlsx-, .xls- oder .pptx-Datei (oder verwenden Sie Ihr aktuelles Szenario) und lassen Sie die KI Abdeckung, Tempo, Akteur-Balance und Realismus analysieren, dann exportieren Sie einen Qualitätsbericht.')}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div class="welcome-block-title" style="margin-bottom:14px;">${tt('Getting started', 'Pour commencer', 'Erste Schritte')}</div>
                  <div class="launch-tips">
                    <div class="launch-tip">
                      <div class="launch-tip-num">1</div>
                      <span>${tt('<strong>Set up your scenario</strong> — define the client, crisis type and actors in the Scenario tab.', '<strong>Configurez votre scénario</strong> — définissez le client, le type de crise et les acteurs dans l\'onglet Scénario.', '<strong>Richten Sie Ihr Szenario ein</strong> — definieren Sie den Auftraggeber, den Krisentyp und die Akteure im Szenario-Tab.')}</span>
                    </div>
                    <div class="launch-tip">
                      <div class="launch-tip-num">2</div>
                      <span>${tt('<strong>Create your injects</strong> — add messages, calls or social posts in the Timeline editor, with optional AI content generation.', '<strong>Créez vos injects</strong> — ajoutez des messages, appels ou posts dans l\'éditeur Timeline, avec génération de contenu IA en option.', '<strong>Erstellen Sie Ihre Injects</strong> — fügen Sie Nachrichten, Anrufe oder Social-Media-Beiträge im Zeitplan-Editor hinzu, mit optionaler KI-Inhaltsgenerierung.')}</span>
                    </div>
                    <div class="launch-tip">
                      <div class="launch-tip-num">3</div>
                      <span>${tt('<strong>Export your deliverables</strong> — use the Injects view to preview everything, then export a ZIP with all styled injects ready for facilitation.', '<strong>Exportez vos livrables</strong> — utilisez la vue Injects pour tout prévisualiser, puis exportez un ZIP avec tous les injects prêts pour l\'animation.', '<strong>Exportieren Sie Ihre Lieferobjekte</strong> — verwenden Sie die Injects-Ansicht zur Vorschau, dann exportieren Sie ein ZIP mit allen gestalteten Injects für die Übungsleitung.')}</span>
                    </div>
                    <div class="launch-tip">
                      <div class="launch-tip-num">★</div>
                      <span>${tt('<strong>Audit an existing timeline</strong> — open the Crisis Checker tab to import a chronogram file or analyze your current scenario with AI: get a quality score, heatmaps, and an actionable checklist.', '<strong>Auditez une timeline existante</strong> — ouvrez l\'onglet Crisis Checker pour importer un chronogramme ou analyser votre scénario actuel avec l\'IA : obtenez un score qualité, des heatmaps et une checklist actionnable.', '<strong>Prüfen Sie einen vorhandenen Zeitplan</strong> — öffnen Sie den Krisen-Prüfer-Tab, um eine Chronogramm-Datei zu importieren oder Ihr aktuelles Szenario mit KI zu analysieren: erhalten Sie einen Qualitätsscore, Heatmaps und eine umsetzbare Checkliste.')}</span>
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
        const map = {
          project: {
            title: tt('Project', 'Projet', 'Projekt'),
            subtitle: tt('Create, open, save and export your crisis exercise project.', 'Créez, ouvrez, sauvegardez et exportez votre projet d\'exercice de crise.', 'Erstellen, öffnen, speichern und exportieren Sie Ihr Krisenübungsprojekt.')
          },
          scenario: {
            title: tt('Crisis scenario', 'Scénario de crise', 'Krisen-Szenario'),
            subtitle: tt('Define the client, context, and actors involved in the exercise.', 'Définissez le client, le contexte et les acteurs impliqués dans l\'exercice.', 'Definieren Sie den Auftraggeber, den Kontext und die an der Übung beteiligten Akteure.')
          },
          stimuli: {
            title: tt('Timeline', 'Timeline', 'Zeitplan'),
            subtitle: tt('Create realistic injects and generate their content with AI.', 'Créez des injects réalistes et générez leur contenu avec l\'IA.', 'Erstellen Sie realistische Injects und generieren Sie deren Inhalt mit KI.')
          },
          library: {
            title: tt('Injects', 'Injects', 'Injects'),
            subtitle: tt('Browse, filter, and manage all injects in your project.', 'Parcourez, filtrez et gérez tous les injects de votre projet.', 'Durchsuchen, filtern und verwalten Sie alle Injects in Ihrem Projekt.')
          },
          checker: {
            title: tt('Crisis Checker', 'Crisis Checker', 'Krisen-Prüfer'),
            subtitle: tt('Import a crisis exercise chronogram and analyze it automatically.', 'Importez un chronogramme d\'exercice de crise et analysez-le automatiquement.', 'Importieren Sie ein Krisenübungs-Chronogramm und analysieren Sie es automatisch.')
          }
        };
        return map[appState.route] || null;
      }

      function renderCurrentView() {
        if (appState.route === 'project') return renderProjectView();
        if (appState.route === 'scenario') return renderScenarioView();
        if (appState.route === 'stimuli') return renderStimuliView();
        if (appState.route === 'library') return renderLibraryView();
        if (appState.route === 'checker') return renderCheckerView();
        return renderProjectView();
      }

      function renderProjectView() {
        const s = appState.scenario;
        const llmAvailable = isLLMAvailable();
        const hasStimuliOrConfig = s.stimuli.length > 0 || s.client.name || s.scenario.summary;
        const lastSavedStr = s.updated_at
          ? new Date(s.updated_at).toLocaleString()
          : tt('Not saved yet', 'Pas encore sauvegardé', 'Noch nicht gespeichert');

        return `
          <section class="grid" style="max-width:800px;">
            <article class="card">
              <div class="section-header" style="margin-bottom:10px;">
                <span style="font-size:0.78rem; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted);">${tt('Current crisis project', 'Projet de crise actuel', 'Aktuelles Krisenübungsprojekt')}</span>
                <h3 style="margin:4px 0 0;">${escapeHtml(s.name || tt('Untitled project', 'Projet sans titre', 'Projekt ohne Titel'))}</h3>
              </div>
              ${hasStimuliOrConfig ? `
                <div class="field-grid cols-3" style="font-size:0.9rem; color:var(--muted); margin-bottom:10px;">
                  <div><strong>${tt('Client', 'Client', 'Auftraggeber')}:</strong> ${escapeHtml(s.client.name || '—')}</div>
                  <div><strong>${tt('Sector', 'Secteur', 'Sektor')}:</strong> ${escapeHtml(s.client.sector || '—')}</div>
                  <div><strong>${tt('Scenario', 'Scénario', 'Szenario')}:</strong> ${escapeHtml(s.scenario.type || '—')}</div>
                  <div><strong>${tt('Actors', 'Acteurs', 'Akteure')}:</strong> ${s.actors.length}</div>
                  <div><strong>${tt('Stimuli', 'Stimuli', 'Stimuli')}:</strong> ${s.stimuli.length}</div>
                  <div><strong>${tt('Start', 'Début', 'Start')}:</strong> ${escapeHtml(s.scenario.start_date ? formatLocalDateTime(s.scenario.start_date) : '—')}</div>
                </div>
              ` : `
                <div style="margin:8px 0 14px;">
                  <p class="subtle" style="margin:0 0 12px;">${tt('No scenario configured yet. Define the client, crisis context and actors to get started.', 'Aucun scénario configuré. Définissez le client, le contexte de crise et les acteurs pour commencer.', 'Noch kein Szenario konfiguriert. Definieren Sie den Auftraggeber, den Krisenkontext und die Akteure, um loszulegen.')}</p>
                  <button class="btn btn-primary" data-action="nav-scenario">${tt('Configure the scenario', 'Configurer le scénario', 'Szenario konfigurieren')} →</button>
                </div>
              `}
              <div style="font-size:0.8rem; color:var(--muted); border-top:1px solid var(--border); padding-top:8px; margin-top:4px;">
                ${tt('Last saved locally:', 'Dernière sauvegarde locale :', 'Zuletzt lokal gespeichert:')} <strong>${escapeHtml(lastSavedStr)}</strong>
              </div>
            </article>

            <div class="welcome-block">
              <h3 class="welcome-block-title">${tt('Project', 'Projet', 'Projekt')}</h3>
              <div class="grid cols-4" style="gap:16px;">
                <article class="card" style="text-align:center; cursor:pointer; padding:20px 16px;" data-action="new-scenario">
                  <div style="font-size:1.5rem; margin-bottom:8px;">➕</div>
                  <strong>${tt('New', 'Nouveau', 'Neu')}</strong>
                  <p class="subtle" style="font-size:0.85rem; margin-top:4px;">${tt('Start from scratch', 'Partir de zéro', 'Von vorne beginnen')}</p>
                </article>
                <article class="card" style="text-align:center; cursor:pointer; padding:20px 16px;" data-action="load-json">
                  <div style="font-size:1.5rem; margin-bottom:8px;">📂</div>
                  <strong>${tt('Open', 'Ouvrir', 'Öffnen')}</strong>
                  <p class="subtle" style="font-size:0.85rem; margin-top:4px;">.json / .crisismaker.json / .zip</p>
                </article>
                <article class="card ${!llmAvailable ? 'card-disabled' : ''}" style="text-align:center; cursor:${llmAvailable ? 'pointer' : 'not-allowed'}; padding:20px 16px;" ${llmAvailable ? 'data-action="import-chronogram-ia"' : `title="${escapeAttribute(tt('Configure an API key in settings to use this feature', 'Configurez une clé API dans les paramètres pour utiliser cette fonctionnalité', 'Konfigurieren Sie einen API-Schlüssel in den Einstellungen, um diese Funktion zu nutzen'))}"`}>
                  <div style="font-size:1.5rem; margin-bottom:8px;">📊</div>
                  <strong>${tt('Import existing timeline', 'Importer une chronologie', 'Vorhandenen Zeitplan importieren')}</strong>
                  <p class="subtle" style="font-size:0.85rem; margin-top:4px;">${tt('AI-powered Excel import', 'Import Excel par IA', 'KI-gestützter Excel-Import')}</p>
                </article>
                <article class="card" style="text-align:center; cursor:pointer; padding:20px 16px;" data-action="load-example">
                  <div style="font-size:1.5rem; margin-bottom:8px;">🎯</div>
                  <strong>${tt('Example', 'Exemple', 'Beispiel')}</strong>
                  <p class="subtle" style="font-size:0.85rem; margin-top:4px;">${tt('Load a sample scenario', 'Charger un scénario exemple', 'Beispielszenario laden')}</p>
                </article>
              </div>
            </div>

            <div class="welcome-block" style="margin-top:8px;">
              <h3 class="welcome-block-title">${tt('Save & Export', 'Sauvegarder & Exporter', 'Speichern & Exportieren')}</h3>
              <div class="grid cols-3" style="gap:16px;">
                <article class="card" style="text-align:center; cursor:pointer; padding:20px 16px;" data-action="save-local">
                  <div style="font-size:1.5rem; margin-bottom:8px;">💾</div>
                  <strong>${tt('Save locally', 'Sauvegarder localement', 'Lokal speichern')}</strong>
                  <p class="subtle" style="font-size:0.85rem; margin-top:4px;">${tt('Browser storage + file', 'Stockage navigateur + fichier', 'Browser-Speicher + Datei')}</p>
                </article>
                <article class="card" style="text-align:center; cursor:pointer; padding:20px 16px;" data-action="save-json">
                  <div style="font-size:1.5rem; margin-bottom:8px;">⇩</div>
                  <strong>${tt('Export text content', 'Exporter le contenu texte', 'Textinhalt exportieren')}</strong>
                  <p class="subtle" style="font-size:0.85rem; margin-top:4px;">${tt('Download as .json', 'Télécharger en .json', 'Herunterladen als .json')}</p>
                </article>
                <article class="card" style="text-align:center; cursor:pointer; padding:20px 16px;" data-action="export-all">
                  <div style="font-size:1.5rem; margin-bottom:8px;">🗜️</div>
                  <strong>${tt('Export all injects', 'Exporter tous les injects', 'Alle Injects exportieren')}</strong>
                  <p class="subtle" style="font-size:0.85rem; margin-top:4px;">${tt('Download as .zip', 'Télécharger en .zip', 'Herunterladen als .zip')}</p>
                </article>
              </div>
            </div>
          </section>
        `;
      }

      function renderLibraryView() {
        const allStimuli = getSortedStimuli();
        if (!allStimuli.length) {
          return `<section class="grid" style="max-width:600px; margin: 60px auto; text-align:center;">
            <p class="subtle">${tt('No injects yet. Create some in the Timeline view.', 'Aucun inject encore. Créez-en dans la vue Timeline.', 'Noch keine Injects. Erstellen Sie welche in der Zeitplan-Ansicht.')}</p>
            <button class="btn btn-primary" data-action="nav-stimuli">${tt('Go to Timeline', 'Aller à la Timeline', 'Zum Zeitplan')}</button>
          </section>`;
        }
        const f = appState.libraryFilter;
        let filtered = allStimuli;
        if (f.channel) filtered = filtered.filter((s) => s.channel === f.channel);
        if (f.status) filtered = filtered.filter((s) => s.status === f.status);
        if (f.actorId) filtered = filtered.filter((s) => s.actor_id === f.actorId);
        if (f.sort === 'updated') filtered = [...filtered].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
        else if (f.sort === 'channel') filtered = [...filtered].sort((a, b) => a.channel.localeCompare(b.channel));
        else if (f.sort === 'actor') filtered = [...filtered].sort((a, b) => (getActor(a.actor_id)?.name || '').localeCompare(getActor(b.actor_id)?.name || ''));
        // default sort = timeline (already sorted by getSortedStimuli)

        const channelOptions = [...new Set(allStimuli.map((s) => s.channel))].sort();
        const actorOptions = appState.scenario.actors;

        return `
          <section class="grid">
            <div class="library-filter-bar">
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
                <option value="timeline" ${f.sort === 'timeline' ? 'selected' : ''}>${tt('Sort: timeline', 'Tri : timeline', 'Sortierung: Zeitplan')}</option>
                <option value="updated" ${f.sort === 'updated' ? 'selected' : ''}>${tt('Sort: last modified', 'Tri : modifié', 'Sortierung: Zuletzt geändert')}</option>
                <option value="channel" ${f.sort === 'channel' ? 'selected' : ''}>${tt('Sort: channel', 'Tri : type', 'Sortierung: Kanal')}</option>
                <option value="actor" ${f.sort === 'actor' ? 'selected' : ''}>${tt('Sort: actor', 'Tri : acteur', 'Sortierung: Akteur')}</option>
              </select>
              <span style="color:var(--muted); font-size:0.85rem; margin-left:auto;">${filtered.length}/${allStimuli.length} ${tt('injects', 'injects', 'Injects')}</span>
              <button class="btn btn-primary" data-action="add-stimulus">${tt('+ Add inject', '+ Ajouter un inject', '+ Inject hinzufügen')}</button>
              <button class="btn btn-secondary" data-action="export-all">${tt('Export ZIP', 'Exporter ZIP', 'ZIP exportieren')}</button>
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
                      <button class="btn-chip-delete" data-action="delete-custom-template" data-template-id="${escapeAttribute(tpl.template_id)}" title="${tt('Remove', 'Supprimer', 'Entfernen')}">✕</button>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            <div class="library-card-grid">
              ${filtered.map((s) => renderLibraryCard(s)).join('')}
            </div>
          </section>
        `;
      }

      function renderLibraryCard(stimulus) {
        const meta = CHANNEL_META[stimulus.channel] || CHANNEL_META.email_internal;
        const actor = getActor(stimulus.actor_id);
        const h = Math.floor(stimulus.timestamp_offset_minutes / 60);
        const m = String(stimulus.timestamp_offset_minutes % 60).padStart(2, '0');
        const statusColors = { draft: '#888', ready: '#2a7a2a', sent: '#1a3e6f' };
        const versionCount = stimulus.history ? stimulus.history.length : 0;
        const isExpanded = appState.libraryExpandedId === stimulus.id;
        const titleText = stimulus.fields.subject || stimulus.fields.headline || stimulus.fields.text || stimulus.fields.title || '—';
        return `
          <div class="library-card${isExpanded ? ' expanded' : ''}">
            <div class="library-card-header" style="background:${meta.color};">
              <span class="library-card-channel">${escapeHtml(channelLabel(stimulus.channel))}</span>
              <span class="library-card-time">H+${h}:${m}</span>
            </div>
            <div class="library-card-body">
              <div class="library-card-actor">${escapeHtml(actor?.name || tt('No actor', 'Sans acteur', 'Kein Akteur'))}</div>
              <div class="library-card-desc library-card-title-btn" data-action="expand-library-card" data-stimulus-id="${stimulus.id}" title="${tt('Click to preview', 'Cliquer pour prévisualiser', 'Klicken zur Vorschau')}">${escapeHtml(titleText.slice(0, 60))}${titleText.length > 60 ? '…' : ''} ${isExpanded ? '▲' : '▼'}</div>
            </div>
            ${isExpanded ? `
            <div class="library-card-preview-expand">
              <div class="library-card-preview-inner">${renderStimulusPreview(stimulus, `lib-preview-${stimulus.id}`)}</div>
            </div>` : ''}
            <div class="library-card-footer">
              <button class="pill pill-status" style="background:${statusColors[stimulus.status] || '#888'}; color:#fff; border:none; cursor:pointer;" data-action="cycle-status" data-stimulus-id="${stimulus.id}" title="${tt('Click to change status', 'Cliquer pour changer le statut', 'Klicken zum Status ändern')}">${escapeHtml(stimulus.status)}${versionCount > 0 ? ` · v${versionCount + 1}` : ''}</button>
              <div class="library-card-actions">
                <button class="btn btn-xs" data-action="edit-in-stimuli" data-stimulus-id="${stimulus.id}" title="${tt('Edit', 'Éditer', 'Bearbeiten')}">✏️</button>
                <button class="btn btn-xs" data-action="duplicate-stimulus" data-stimulus-id="${stimulus.id}" title="${tt('Duplicate', 'Dupliquer', 'Duplizieren')}">⧉</button>
                ${String(stimulus.channel || '').startsWith('email_') ? `<button class="btn btn-xs" data-action="export-msg" data-stimulus-id="${stimulus.id}" title="${tt('Export .eml file', 'Exporter le fichier .eml', '.eml-Datei exportieren')}">✉️</button>` : ''}
                <button class="btn btn-xs" data-action="export-png" data-stimulus-id="${stimulus.id}" title="${tt('Export PNG', 'Exporter PNG', 'PNG exportieren')}" ${appState.ui?.actionLoading?.['export-png'] ? 'disabled' : ''}>${appState.ui?.actionLoading?.['export-png'] ? '…' : '⤓'}</button>
                <button class="btn btn-xs btn-danger" data-action="delete-stimulus" data-stimulus-id="${stimulus.id}" data-confirm="true" title="${tt('Delete', 'Supprimer', 'Löschen')}">✕</button>
              </div>
            </div>
          </div>
        `;
      }

      function renderSettingsView() {
        const settings = appState.scenario.settings;
        const models = DEFAULT_MODELS[settings.ai_provider] || [];
        const isAnthropic = settings.ai_provider === 'anthropic';
        const isOpenAI = settings.ai_provider === 'openai';
        const isAzure = settings.ai_provider === 'azure_openai';
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
              ${!isLLMAvailable() ? `<div style="background:#FEF9C3;border:1px solid #FDE68A;border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:13px;color:#78350F;">${tt('No API key configured. AI generation features are disabled.', 'Aucune clé API configurée. Les fonctionnalités de génération par IA sont désactivées.', 'Kein API-Schlüssel konfiguriert. KI-Generierungsfunktionen sind deaktiviert.')}</div>` : ''}
              <div class="field-grid cols-2">
                <label class="field">${tt('AI provider', 'Fournisseur IA', 'KI-Anbieter')}
                  <select data-bind="settings.ai_provider">
                    <option value="anthropic" ${settings.ai_provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                    <option value="openai" ${settings.ai_provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="azure_openai" ${settings.ai_provider === 'azure_openai' ? 'selected' : ''}>Azure OpenAI</option>
                  </select>
                </label>
                ${(isAnthropic || isOpenAI) ? `
                  <label class="field">${tt('Model', 'Modèle', 'Modell')}
                    <select data-bind="settings.ai_model">
                      ${models.map((model) => `<option value="${model}" ${settings.ai_model === model ? 'selected' : ''}>${model}</option>`).join('')}
                    </select>
                  </label>
                  <label class="field" style="grid-column: 1 / -1;">${isOpenAI ? tt('OpenAI API key', 'Clé API OpenAI', 'OpenAI-API-Schlüssel') : tt('Anthropic API key', 'Clé API Anthropic', 'Anthropic-API-Schlüssel')}
                    <div style="display:flex; gap:10px;">
                      <input id="api-key-input" type="password" data-bind="settings.ai_api_key" value="${escapeAttribute(settings.ai_api_key)}" placeholder="${isOpenAI ? 'sk-proj-...' : 'sk-ant-...'}">
                      <button class="btn btn-secondary" data-action="toggle-api-key">👁️</button>
                    </div>
                  </label>
                ` : ''}
                ${isAzure ? `
                  <label class="field">${tt('Azure endpoint', 'Endpoint Azure', 'Azure-Endpunkt')}
                    <input type="url" data-bind="settings.azure_endpoint" value="${escapeAttribute(settings.azure_endpoint || '')}" placeholder="https://<resource>.openai.azure.com/">
                  </label>
                  <label class="field">${tt('Deployment name', 'Nom du déploiement', 'Bereitstellungsname')}
                    <input type="text" data-bind="settings.azure_deployment" value="${escapeAttribute(settings.azure_deployment || '')}" placeholder="gpt-4o">
                  </label>
                  <label class="field" style="grid-column: 1 / -1;">${tt('Azure API key', 'Clé API Azure', 'Azure-API-Schlüssel')}
                    <div style="display:flex; gap:10px;">
                      <input id="api-key-input" type="password" data-bind="settings.azure_api_key" value="${escapeAttribute(settings.azure_api_key || '')}" placeholder="Azure API key">
                      <button class="btn btn-secondary" data-action="toggle-api-key">👁️</button>
                    </div>
                  </label>
                ` : ''}
                <label class="field">${tt("Application language", "Langue de l'application", 'Anwendungssprache')}
                  <select data-bind="settings.language">
                    <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
                    <option value="fr" ${settings.language === 'fr' ? 'selected' : ''}>Français</option>
                    <option value="de" ${settings.language === 'de' ? 'selected' : ''}>Deutsch</option>
                  </select>
                  <p class="helper">${tt('Auto-detected from your browser on first load.', 'Détectée automatiquement depuis votre navigateur au premier chargement.', 'Beim ersten Laden automatisch aus Ihrem Browser erkannt.')}</p>
                </label>
                <label class="field">${tt('Force interface language', 'Forcer la langue de l\'interface', 'Oberflächensprache erzwingen')}
                  <select data-action="set-forced-language">
                    <option value="" ${!getForcedLanguage() ? 'selected' : ''}>${tt('Follow project setting', 'Suivre le paramètre du projet', 'Projekteinstellung verwenden')}</option>
                    <option value="en" ${getForcedLanguage() === 'en' ? 'selected' : ''}>English</option>
                    <option value="fr" ${getForcedLanguage() === 'fr' ? 'selected' : ''}>Français</option>
                    <option value="de" ${getForcedLanguage() === 'de' ? 'selected' : ''}>Deutsch</option>
                  </select>
                  <p class="helper">${tt('When set, overrides the project language and persists across all projects.', 'Si défini, remplace la langue du projet et s\'applique à tous les projets.', 'Wenn gesetzt, überschreibt die Projektsprache und gilt für alle Projekte.')}</p>
                </label>
                <label class="field">${tt('Template rendering', 'Rendu des templates', 'Vorlagen-Rendering')}
                  <select data-bind="settings.template_quality">
                    <option value="basic" ${settings.template_quality === 'basic' ? 'selected' : ''}>Basic — ${tt('Fast, lightweight', 'Léger, rapide', 'Schnell, leichtgewichtig')}</option>
                    <option value="hd" ${settings.template_quality === 'hd' ? 'selected' : ''}>HD — ${tt('High fidelity, realistic', 'Haute fidélité, réaliste', 'Hochauflösend, realistisch')}</option>
                  </select>
                </label>
              </div>
              <div class="actions" style="margin-top:18px;">
                <button class="btn btn-primary" data-action="test-connection" ${connectionTest.status === 'testing' ? 'disabled' : ''}>${connectionTest.status === 'testing' ? `<span class="ai-spinner"></span>${tt('Testing…', 'Test en cours…')}` : tt('Test connection', 'Tester la connexion')}</button>
                <button class="btn btn-secondary" data-action="save-local">${tt('Save locally', 'Sauvegarder localement')}</button>
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
              <p class="helper" style="margin-top:14px;">${tt(`The ${isAzure ? 'Azure OpenAI' : isOpenAI ? 'OpenAI' : 'Anthropic'} settings stay in your browser and are only sent to the selected provider.`, `Les paramètres ${isAzure ? 'Azure OpenAI' : isOpenAI ? 'OpenAI' : 'Anthropic'} restent dans votre navigateur et ne sont transmis qu'au fournisseur sélectionné.`, `Die ${isAzure ? 'Azure OpenAI' : isOpenAI ? 'OpenAI' : 'Anthropic'}-Einstellungen verbleiben in Ihrem Browser und werden nur an den ausgewählten Anbieter übermittelt.`)}</p>
              ${(isOpenAI || isAzure) ? `<p class="helper">${tt('The OpenAI model dropdown is a curated list of current general-purpose chat-compatible model IDs. Azure availability still depends on your deployed model and region.', 'La liste déroulante OpenAI propose une sélection de modèles généralistes récents compatibles chat. La disponibilité dans Azure dépend toujours de votre déploiement et de votre région.', 'Das OpenAI-Modell-Dropdown ist eine kuratierte Liste aktueller Allzweck-Chat-kompatibler Modell-IDs. Die Azure-Verfügbarkeit hängt weiterhin von Ihrem bereitgestellten Modell und Ihrer Region ab.')}</p>` : ''}
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
              <p class="helper" style="margin-top:14px;">${tt('The watermark is overlaid on all exported injects. Each inject can override these defaults.', 'Le filigrane est superposé sur tous les stimuli exportés. Chaque stimulus peut personnaliser ces réglages.', 'Das Wasserzeichen wird über alle exportierten Injects gelegt. Jeder Inject kann diese Standardeinstellungen überschreiben.')}</p>
            </article>
          </section>
        `;
      }

      function renderScenarioView() {
        const scenario = appState.scenario;
        const sectors = [
          ['Banking', 'Banque'], ['Energy', 'Énergie'], ['Healthcare', 'Santé'], ['Transport', 'Transport'],
          ['Industry', 'Industrie'], ['Telecom', 'Telecom'], ['Retail', 'Retail'], ['Public sector', 'Public'], ['Other', 'Autre']
        ];
        const types = [['Ransomware', 'Ransomware'], ['Data Breach', 'Data Breach'], ['Supply Chain', 'Supply Chain'], ['DDoS', 'DDoS'], ['Insider Threat', 'Insider Threat'], ['Other', 'Autre']];
        const langOptions = LANGUAGES.map((l) => `<option value="${l.value}" ${(scenario.client.language || 'en') === l.value ? 'selected' : ''}>${l.label}</option>`).join('');
        const scenarioPlaceholder = tt(
          'Ex: "A French bank hit by a ransomware attack. The attackers encrypted all the trading systems. The attack started Monday morning at 8am CET."',
          'Ex: "Exercice de crise pour un hôpital français (CHU de Lyon). Scénario : fuite de données patients via un prestataire compromis. Début le 15 mars 2026 à 8h."',
          'Bsp.: „Eine deutsche Bank wurde von einem Ransomware-Angriff getroffen. Die Angreifer verschlüsselten alle Handelssysteme. Der Angriff begann am Montagmorgen um 8 Uhr MEZ."'
        );
        const actorsPlaceholder = tt(
          'Ex: "I need journalists from Le Monde and the Financial Times, an ANSSI authority, 2 internal actors (the CISO and the CEO), and an angry B2C customer on Twitter."',
          'Ex: "Génère des acteurs réalistes pour ce scénario. Je veux un mix de journalistes FR et internationaux, les autorités pertinentes, et des acteurs internes."',
          'Bsp.: „Ich benötige Journalisten von Spiegel und der Financial Times, eine BSI-Behörde, 2 interne Akteure (CISO und CEO) und einen verärgerten B2C-Kunden auf Twitter."'
        );
        return `
          <section class="grid">
            ${renderLLMConfigBlock('scenario', scenarioPlaceholder)}
            <article class="card">
              <div class="section-header"><h3>${tt('Client', 'Client', 'Auftraggeber')}</h3></div>
              <div class="field-grid cols-2">
                <label class="field">${tt('Client name', 'Nom du client', 'Name des Auftraggebers')}<input type="text" data-bind="client.name" value="${escapeAttribute(scenario.client.name)}"></label>
                <label class="field">${tt('Sector', 'Secteur', 'Sektor')}
                  <select data-bind="client.sector">${sectors.map(([en, fr]) => `<option value="${en}" ${scenario.client.sector === en || scenario.client.sector === fr ? 'selected' : ''}>${tt(en, fr)}</option>`).join('')}</select>
                </label>
                <label class="field">${tt('Primary language', 'Langue principale', 'Primärsprache')}
                  <select data-bind="client.language">${langOptions}</select>
                </label>
                <label class="field">${tt('Inject language', 'Langue des injects', 'Sprache der Injects')}
                  <select data-bind="settings.inject_language">
                    ${LANGUAGES.map((l) => `<option value="${l.value}" ${(scenario.settings.inject_language || 'en') === l.value ? 'selected' : ''}>${l.label}</option>`).join('')}
                  </select>
                </label>
                <p class="helper" style="grid-column:1/-1">${tt('Default language for AI-generated inject content (emails, social posts, memos). Press articles keep their publication\'s native language.', 'Langue par défaut pour le contenu des injects générés par IA (emails, posts, mémos). Les articles de presse conservent la langue de leur publication.', 'Standardsprache für KI-generierte Inject-Inhalte (E-Mails, Social-Media-Beiträge, Memos). Presseartikel behalten die Sprache ihrer Publikation.')}</p>
                <label class="field">${tt('Logo (URL or data URI)', 'Logo (URL ou data URI)', 'Logo (URL oder Data-URI)')}<input type="url" data-bind="client.logo_url" value="${escapeAttribute(scenario.client.logo_url || '')}" placeholder="https://..."></label>
              </div>
            </article>

            <article class="card">
              <div class="section-header"><h3>${tt('Scenario / Threat', 'Scénario / Menace', 'Szenario / Bedrohung')}</h3></div>
              <div class="field-grid cols-2">
                <label class="field">${tt('Scenario name', 'Nom du scénario', 'Szenarioname')}<input type="text" data-bind="name" value="${escapeAttribute(scenario.name)}"></label>
                <label class="field">${tt('Type', 'Type', 'Typ')}
                  <select data-bind="scenario.type">${types.map(([en, fr]) => `<option value="${en}" ${scenario.scenario.type === en || scenario.scenario.type === fr ? 'selected' : ''}>${tt(en, fr)}</option>`).join('')}</select>
                </label>
                <label class="field">${tt('Start date', 'Date de début', 'Startdatum')}<input type="datetime-local" data-bind="scenario.start_date" value="${escapeAttribute(scenario.scenario.start_date)}"></label>
                <label class="field">${tt('Timezone', 'Fuseau horaire', 'Zeitzone')}
                  <select data-bind="scenario.timezone">${TIMEZONES.map((item) => `<option value="${item}" ${scenario.scenario.timezone === item ? 'selected' : ''}>${item}</option>`).join('')}</select>
                </label>
                <label class="field" style="grid-column: 1 / -1;">${tt('Scenario summary', 'Résumé du scénario', 'Szenariozusammenfassung')}
                  <textarea data-bind="scenario.summary">${escapeHtml(scenario.scenario.summary)}</textarea>
                  <span class="helper">${tt('Injected into all AI prompts for content generation.', 'Injecté dans tous les prompts IA pour la génération de contenu.', 'In alle KI-Prompts zur Inhaltsgenerierung eingefügt.')}</span>
                </label>
                <label class="field" style="grid-column: 1 / -1;">${tt('Detailed context (optional)', 'Contexte détaillé (optionnel)', 'Detaillierter Kontext (optional)')}
                  <textarea data-bind="scenario.detailed_context" rows="5" placeholder="${tt('Timeline, affected systems, attack vector, compromised data...', 'Chronologie, systèmes affectés, vecteur d\'attaque, données compromises...', 'Zeitplan, betroffene Systeme, Angriffsvektor, kompromittierte Daten...')}">${escapeHtml(scenario.scenario.detailed_context || '')}</textarea>
                </label>
              </div>
            </article>

            <article class="card">
              <div class="section-header">
                <div>
                  <h3>${tt('Simulated actors', 'Acteurs simulés', 'Simulierte Akteure')}</h3>
                  <p class="subtle">${tt('Actors available to sign or emit injects.', 'Acteurs disponibles pour signer ou émettre les stimuli.', 'Akteure, die Injects unterzeichnen oder aussenden können.')}</p>
                </div>
                <div class="actions">
                  <button class="btn btn-secondary" data-action="generate-sample-actors">${tt('Generate sample actors', 'Générer des acteurs types', 'Beispielakteure generieren')}</button>
                  <button class="btn btn-primary" data-action="add-actor">${tt('Add actor', 'Ajouter un acteur', 'Akteur hinzufügen')}</button>
                </div>
              </div>
              ${renderLLMConfigBlock('actors', actorsPlaceholder)}
              <div style="overflow-x:auto;">
                <table class="table">
                  <thead><tr><th>${tt('Name', 'Nom', 'Name')}</th><th>${tt('Role', 'Rôle', 'Rolle')}</th><th>${tt('Organization', 'Organisation', 'Organisation')}</th><th>${tt('Title', 'Titre', 'Titel')}</th><th>${tt('Language', 'Langue', 'Sprache')}</th><th>${tt('Actions', 'Actions', 'Aktionen')}</th></tr></thead>
                  <tbody>
                    ${scenario.actors.map((actor) => {
                      const actorLangOpts = LANGUAGES.map((l) => `<option value="${l.value}" ${(actor.language || 'en') === l.value ? 'selected' : ''}>${l.label}</option>`).join('');
                      return `<tr>
                        <td><input type="text" data-actor-bind="${actor.id}.name" value="${escapeAttribute(actor.name)}"></td>
                        <td>
                          <select data-actor-bind="${actor.id}.role">
                            ${ROLES.map((role) => `<option value="${role.value}" ${actor.role === role.value ? 'selected' : ''}>${escapeHtml(roleLabel(role.value))}</option>`).join('')}
                          </select>
                        </td>
                        <td><input type="text" data-actor-bind="${actor.id}.organization" value="${escapeAttribute(actor.organization)}"></td>
                        <td><input type="text" data-actor-bind="${actor.id}.title" value="${escapeAttribute(actor.title)}"></td>
                        <td>
                          <select data-actor-bind="${actor.id}.language">${actorLangOpts}</select>
                        </td>
                        <td>
                          <div class="actions">
                            <button class="btn btn-ghost" data-action="duplicate-actor" data-actor-id="${actor.id}">${tt('Duplicate', 'Dupliquer', 'Duplizieren')}</button>
                            <button class="btn btn-danger" data-action="delete-actor" data-actor-id="${actor.id}">${tt('Delete', 'Supprimer', 'Löschen')}</button>
                          </div>
                        </td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        `;
      }

      function renderStimuliView() {
        const maxOffset = Math.max(360, ...appState.scenario.stimuli.map((item) => item.timestamp_offset_minutes));
        const zoom = appState.ui?.timelineZoom || 1.0;
        const hourWidth = Math.round(108 * zoom);
        const width = Math.max(900, (Math.ceil(maxOffset / 60) + 1) * hourWidth + 120);
        const ticks = Array.from({ length: Math.ceil(maxOffset / 60) + 2 }, (_, index) => index);
        const timelineHeight = appState.ui?.stimuliTimelineHeight || 255;
        const sortedStimuli = getSortedStimuli();
        return `
          <section class="stimuli-workspace" data-stimuli-workspace style="--stimuli-timeline-height:${timelineHeight}px;">
            <article class="card stimuli-timeline-panel">
              <div class="section-header">
                <h3>${tt('Timeline', 'Timeline', 'Zeitplan')}</h3>
                <div class="actions">
                  <div class="timeline-zoom-controls">
                    <button class="btn btn-xs" data-action="timeline-zoom-out" title="${tt('Zoom out', 'Dézoomer', 'Herauszoomen')}">−</button>
                    <span class="timeline-zoom-label">${Math.round(zoom * 100)}%</span>
                    <button class="btn btn-xs" data-action="timeline-zoom-in" title="${tt('Zoom in', 'Zoomer', 'Hineinzoomen')}">+</button>
                  </div>
                  <button class="btn btn-primary" data-action="add-stimulus">${tt('+ Add inject', '+ Ajouter un inject', '+ Inject hinzufügen')}</button>
                  <button class="btn btn-secondary" data-action="sort-stimuli">${tt('Sort', 'Trier', 'Sortieren')}</button>
                </div>
              </div>
              ${renderLLMConfigBlock('stimuli_batch', tt(
                'Ex: "Create 12 injects from H+0 to H+6 mixing internal emails, customer complaints, press coverage, regulator outreach, and social posts. Keep the tone escalating but credible."',
                'Ex : "Crée 12 injects de H+0 à H+6 en mélangeant emails internes, plaintes clients, couverture presse, sollicitations du régulateur et posts sociaux. Fais monter la tension de façon crédible."',
                'Bsp.: „Erstellen Sie 12 Injects von H+0 bis H+6 mit internen E-Mails, Kundenbeschwerden, Presseberichterstattung, Regulierungsbehörden-Kontakten und Social-Media-Posts. Eskalation glaubwürdig gestalten."'
              ), {
                title: tt('Mass create with LLM', 'Création en lot avec le LLM', 'Massenerstellung mit LLM'),
                subtitle: tt(
                  'Describe the batch you want above the timeline and the LLM will add multiple injects directly to it.',
                  'Décrivez le lot souhaité au-dessus de la timeline et le LLM ajoutera directement plusieurs injects.',
                  'Beschreiben Sie den gewünschten Batch über dem Zeitplan und das LLM fügt mehrere Injects direkt hinzu.'
                ),
                generateLabel: tt('Generate batch ✨', 'Générer le lot ✨', 'Batch generieren ✨'),
                loadingLabel: tt('Generating batch…', 'Génération du lot…', 'Batch wird generiert…'),
                successMessage: (count) => tt(`${count} inject(s) added to the timeline. Review and adjust them if needed.`, `${count} inject(s) ajouté(s) à la timeline. Vérifiez-les et ajustez-les si besoin.`, `${count} Inject(s) zum Zeitplan hinzugefügt. Überprüfen und anpassen falls nötig.`)
              })}
              <div class="timeline" data-timeline-scroll>
                <div class="timeline-track" style="width:${width}px;">
                  ${ticks.map((tick) => `<div class="timeline-tick" style="left:${tick * hourWidth}px;">H+${tick}</div>`).join('')}
                  ${appState.scenario.stimuli.map((stimulus, index) => renderStimulusCard(stimulus, index, hourWidth)).join('')}
                </div>
              </div>
            </article>
            ${sortedStimuli.length > 0 ? `
            <div class="stimuli-table-panel">
              <table class="stimuli-table">
                <thead>
                  <tr>
                    <th>${tt('Time', 'Heure', 'Uhrzeit')}</th>
                    <th>${tt('Type', 'Type', 'Typ')}</th>
                    <th>${tt('Name / Subject', 'Nom / Sujet', 'Name / Betreff')}</th>
                    <th>${tt('Actor', 'Acteur', 'Akteur')}</th>
                    <th>${tt('Status', 'Statut', 'Status')}</th>
                    <th>${tt('Actions', 'Actions', 'Aktionen')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${sortedStimuli.map((s) => {
                    const meta = CHANNEL_META[s.channel] || CHANNEL_META.email_internal;
                    const actor = getActor(s.actor_id);
                    const h = Math.floor(s.timestamp_offset_minutes / 60);
                    const m = String(s.timestamp_offset_minutes % 60).padStart(2, '0');
                    const titleText = s.fields?.subject || s.fields?.headline || s.fields?.title || s.fields?.text || s.name || '—';
                    const statusColors = { draft: '#888', ready: '#2a7a2a', sent: '#1a3e6f' };
                    return `
                      <tr class="stimuli-table-row${appState.selectedStimulusId === s.id ? ' selected' : ''}" data-action="select-stimulus" data-stimulus-id="${s.id}">
                        <td class="stimuli-table-time"><strong>H+${h}:${m}</strong></td>
                        <td class="stimuli-table-type"><span class="stimuli-table-channel-pill" style="background:${meta.color};">${escapeHtml(channelLabel(s.channel))}</span></td>
                        <td class="stimuli-table-content">${escapeHtml(titleText.slice(0, 100))}${titleText.length > 100 ? '…' : ''}</td>
                        <td class="stimuli-table-actor">${escapeHtml(actor?.name || tt('No actor', 'Sans acteur', 'Kein Akteur'))}</td>
                        <td class="stimuli-table-status"><span class="pill pill-status" style="background:${statusColors[s.status] || '#888'}; color:#fff; cursor:pointer;" data-action="cycle-status" data-stimulus-id="${s.id}" title="${tt('Click to change status', 'Cliquer pour changer le statut', 'Klicken zum Status ändern')}">${escapeHtml(s.status)}</span></td>
                        <td class="stimuli-table-actions">
                          <button class="btn btn-xs" data-action="open-stimulus-modal" data-stimulus-id="${s.id}" title="${tt('Edit', 'Éditer', 'Bearbeiten')}">✏️</button>
                          <button class="btn btn-xs" data-action="duplicate-stimulus" data-stimulus-id="${s.id}" title="${tt('Duplicate', 'Dupliquer', 'Duplizieren')}">⧉</button>
                          <button class="btn btn-xs" data-action="export-png" data-stimulus-id="${s.id}" title="${tt('Export PNG', 'Exporter PNG', 'PNG exportieren')}">⤓</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>` : ''}
          </section>
        `;
      }

      function renderStimulusCard(stimulus, index, hourWidth = 108) {
        const meta = CHANNEL_META[stimulus.channel] || CHANNEL_META.email_internal;
        const left = (stimulus.timestamp_offset_minutes / 60) * hourWidth;
        const top = 24 + (index % 3) * 58;
        const actor = getActor(stimulus.actor_id);
        return `
          <div class="stimulus-card ${appState.selectedStimulusId === stimulus.id ? 'selected' : ''}" data-action="select-stimulus" data-stimulus-id="${stimulus.id}" style="left:${left}px; top:${top}px; background:${meta.color};">
            <strong>${escapeHtml(channelLabel(stimulus.channel))}</strong>
            <small>${escapeHtml(actor?.name || tt('No actor', 'Sans acteur', 'Kein Akteur'))}</small>
            <small>H+${Math.floor(stimulus.timestamp_offset_minutes / 60)}:${String(stimulus.timestamp_offset_minutes % 60).padStart(2, '0')}</small>
            ${stimulus.name ? `<small>${escapeHtml(stimulus.name)}</small>` : ''}
          </div>
        `;
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
            </label>` : '<div></div>'}
            <label class="field">${tt('Source actor', 'Acteur émetteur', 'Absender-Akteur')}
              <select data-stimulus-bind="${stimulus.id}.actor_id">${actorOptions}</select>
            </label>
            <label class="field">${tt('Timeline (minutes)', 'Timeline (minutes)', 'Zeitplan (Minuten)')}
              <input type="number" min="0" step="5" data-stimulus-bind="${stimulus.id}.timestamp_offset_minutes" value="${stimulus.timestamp_offset_minutes}">
            </label>
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

          ${renderStimulusWatermarkControls(stimulus)}
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
                  ${(stimulus.history?.length > 0) ? `<button class="btn btn-secondary" data-action="show-history" data-stimulus-id="${stimulus.id}">${tt('History', 'Historique', 'Verlauf')} (${stimulus.history.length})</button>` : ''}
                  <button class="btn btn-secondary" data-action="duplicate-stimulus" data-stimulus-id="${stimulus.id}">${tt('Duplicate', 'Dupliquer', 'Duplizieren')}</button>
                  <button class="btn btn-secondary" data-action="close-stimulus-modal">✕</button>
                </div>
              </div>
              <div class="modal-body-stimulus" data-stimulus-modal-body style="--stimulus-modal-editor-width:${editorWidth}%; --stimulus-modal-preview-width:${100 - editorWidth}%;">
                <div class="stimulus-modal-left">
                  ${renderStimulusEditorModal(stimulus)}
                </div>
                <div class="resize-handle resize-handle-vertical" data-resize-handle="stimulus-modal-width" role="separator" aria-orientation="vertical" aria-label="${tt('Resize editor and preview', 'Redimensionner l\'éditeur et la prévisualisation', 'Editor und Vorschau in der Größe ändern')}"></div>
                <div class="stimulus-modal-right">
                  <div class="preview-toolbar-inline">
                    ${String(stimulus.channel || '').startsWith('email_') ? `<button class="btn btn-secondary" data-action="export-msg" data-stimulus-id="${stimulus.id}">${tt('Export .eml', 'Exporter .eml', '.eml exportieren')}</button>` : ''}
                    <button class="btn btn-secondary" data-action="export-png" data-stimulus-id="${stimulus.id}" ${appState.ui?.actionLoading?.['export-png'] ? 'disabled' : ''}>${actionButtonLabel('export-png', tt('Export PNG', 'Exporter PNG', 'PNG exportieren'), tt('Exporting…', 'Export en cours…', 'Wird exportiert…'))}</button>
                  </div>
                  <div class="preview-shell stimuli-preview-shell" style="margin:0; border-radius:0; border:none; min-height:calc(100% - 44px);">
                    <div class="preview-stage">
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
        const genBtn = `<div class="actions" style="margin-top:4px;"><button class="btn btn-ghost" style="font-size:0.82rem; padding:6px 10px;" data-action="generate-field" data-stimulus-id="${stimulus.id}" data-field-name="${spec.key}" ${_fieldGenerating ? 'disabled' : ''}>${_fieldGenerating ? `<span class="ai-spinner-primary"></span>${tt('Generating…', 'Génération en cours…')}` : `✨ ${tt('Regenerate', 'Régénérer')}`}</button></div>`;
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
          return `
            <label class="field">${escapeHtml(spec.label)}
              <select ${bind}>
                ${(spec.options || []).map((option) => `<option value="${option}" ${String(value) === String(option) ? 'selected' : ''}>${option}</option>`).join('')}
              </select>
              ${genBtn}
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

      function renderPreviewView() {
        const stimuli = getSortedStimuli();
        if (!stimuli.length) {
          return `<article class="card"><p class="subtle">${tt('No inject to preview.', 'Aucun inject à prévisualiser.', 'Kein Inject zur Vorschau.')}</p></article>`;
        }
        const index = Math.min(appState.slideshowIndex, stimuli.length - 1);
        const current = stimuli[index];
        return `
          <section class="grid">
            <article class="preview-toolbar">
              <div>
                <strong>${escapeHtml(channelLabel(current.channel))}</strong>
                <div class="subtle">${escapeHtml(getActor(current.actor_id)?.name || tt('No actor', 'Sans acteur', 'Kein Akteur'))} · H+${Math.floor(current.timestamp_offset_minutes / 60)}:${String(current.timestamp_offset_minutes % 60).padStart(2, '0')}</div>
              </div>
              <div class="actions">
                <button class="btn btn-secondary" data-action="preview-prev">← ${tt('Previous', 'Précédent', 'Zurück')}</button>
                <button class="btn btn-secondary" data-action="preview-next">${tt('Next', 'Suivant', 'Weiter')} →</button>
                <button class="btn btn-primary" data-action="goto-stimuli" data-stimulus-id="${current.id}">${tt('Edit', 'Éditer', 'Bearbeiten')}</button>
                ${String(current.channel || '').startsWith('email_') ? `<button class="btn btn-secondary" data-action="export-msg" data-stimulus-id="${current.id}">${tt('Export .eml file', 'Exporter le fichier .eml', '.eml-Datei exportieren')}</button>` : ''}
                <button class="btn btn-success" data-action="export-png" data-stimulus-id="${current.id}" ${appState.ui?.actionLoading?.['export-png'] ? 'disabled' : ''}>${actionButtonLabel('export-png', tt('Export PNG', 'Exporter PNG', 'PNG exportieren'), tt('Exporting…', 'Export en cours…', 'Wird exportiert…'))}</button>
              </div>
            </article>
            <article class="preview-shell">
              <div class="preview-stage">${renderStimulusPreview(current, 'fullscreen-preview')}</div>
            </article>
            <article class="card">
              <div class="section-header"><h3>${tt('Inject slideshow', 'Diaporama d\'injects', 'Inject-Diashow')}</h3></div>
              <div class="thumb-grid">
                ${stimuli.map((stimulus, idx) => `
                  <div class="thumb-card">
                    <div class="thumb-preview">${renderStimulusPreview(stimulus, `thumb-slide-${stimulus.id}`, true)}</div>
                    <div class="thumb-body">
                      <strong>${escapeHtml(channelLabel(stimulus.channel))}</strong>
                      <p class="subtle">${escapeHtml(getActor(stimulus.actor_id)?.name || tt('No actor', 'Sans acteur', 'Kein Akteur'))} · H+${Math.floor(stimulus.timestamp_offset_minutes / 60)}:${String(stimulus.timestamp_offset_minutes % 60).padStart(2, '0')}</p>
                      <button class="btn btn-secondary" data-action="preview-select" data-index="${idx}">${tt('Show', 'Afficher', 'Anzeigen')}</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </article>
          </section>
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
        const body = TemplateEngine.render(stimulus, getActor(stimulus.actor_id), appState.scenario);
        const watermark = renderWatermarkOverlay(stimulus);
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
                <button class="btn btn-secondary" data-action="close-history">✕</button>
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

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
            <nav class="nav-topbar">
              <div class="nav-topbar-left">
                ${renderNavIconButton(‘project’, svgFolder(), tt(‘Project’, ‘Projet’))}
                ${renderNavIconButton(‘scenario’, svgTarget(), tt(‘Scenario’, ‘Scénario’))}
                ${renderNavIconButton(‘stimuli’, svgPen(), tt(‘Stimuli’, ‘Stimuli’))}
                ${renderNavIconButton(‘library’, svgGrid(), tt(‘Library’, ‘Bibliothèque’))}
              </div>
              <div class="nav-topbar-center">
                <span class="nav-project-name">${escapeHtml(appState.scenario.name || ‘CrisisStim’)}</span>
              </div>
              <div class="nav-topbar-right">
                <span id="save-indicator" style="color:rgba(255,255,255,0.5); font-size:0.75rem; margin-right:8px;"></span>
                <button class="nav-gear-btn ${appState.settingsDrawerOpen ? ‘active’ : ‘’}" data-action="toggle-settings-drawer" title="${tt(‘Settings’, ‘Paramètres’)}">
                  ${svgGear()}
                </button>
              </div>
            </nav>

            <div class="settings-drawer ${appState.settingsDrawerOpen ? ‘open’ : ‘’}">
              <div class="settings-drawer-header">
                <h3>${tt(‘Settings’, ‘Paramètres’)}</h3>
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
                  <span class="pill">${appState.scenario.stimuli.length} ${tt(‘stimuli’, ‘stimuli’)}</span>
                  <span class="pill">${appState.scenario.actors.length} ${tt(‘actors’, ‘acteurs’)}</span>
                  <span class="pill">${renderProviderSummary(appState.scenario.settings)}</span>
                </div>
              </section>` : ‘’}
              ${renderCurrentView()}
            </main>
            ${appState.historyModalStimulusId ? renderHistoryModal(getStimulus(appState.historyModalStimulusId)) : ‘’}
          </div>
        `;
      }

      function renderNavIconButton(route, iconSvg, label) {
        const isActive = appState.route === route;
        return `<button class="nav-icon-btn ${isActive ? ‘active’ : ‘’}" data-route="${route}" title="${label}">
          ${iconSvg}
          <span>${label}</span>
        </button>`;
      }

      function svgFolder() { return ‘<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>’; }
      function svgTarget() { return ‘<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>’; }
      function svgPen() { return ‘<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>’; }
      function svgGrid() { return ‘<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>’; }
      function svgGear() { return ‘<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>’; }

      function viewConfig() {
        const map = {
          project: {
            title: tt(‘Project’, ‘Projet’),
            subtitle: tt(‘Create, open, save and export your crisis exercise project.’, ‘Créez, ouvrez, sauvegardez et exportez votre projet d\’exercice de crise.’)
          },
          scenario: {
            title: tt(‘Crisis scenario’, ‘Scénario de crise’),
            subtitle: tt(‘Define the client, context, and actors involved in the exercise.’, ‘Définissez le client, le contexte et les acteurs impliqués dans l\’exercice.’)
          },
          stimuli: {
            title: tt(‘Stimuli editor’, ‘Éditeur de stimuli’),
            subtitle: tt(‘Create realistic stimuli and generate their content with AI.’, ‘Créez des stimuli réalistes et générez leur contenu avec l\’IA.’)
          },
          library: {
            title: tt(‘Stimulus library’, ‘Bibliothèque de stimuli’),
            subtitle: tt(‘Browse, filter, and manage all stimuli in your project.’, ‘Parcourez, filtrez et gérez tous les stimuli de votre projet.’)
          }
        };
        return map[appState.route] || null;
      }

      function renderCurrentView() {
        if (appState.route === ‘project’) return renderProjectView();
        if (appState.route === ‘scenario’) return renderScenarioView();
        if (appState.route === ‘stimuli’) return renderStimuliView();
        if (appState.route === ‘library’) return renderLibraryView();
        return renderProjectView();
      }

      function renderProjectView() {
        const s = appState.scenario;
        const hasStimuliOrConfig = s.stimuli.length > 0 || s.client.name || s.scenario.summary;
        if (!hasStimuliOrConfig) {
          return `
            <section class="grid" style="max-width:700px; margin: 40px auto;">
              <div style="text-align:center; padding: 20px 0 30px;">
                <h1 style="font-size:2rem; margin:0; font-weight:800;">CrisisStim</h1>
                <p style="color:var(--muted); font-size:1rem; margin-top:8px;">${tt(‘Stimulus generator for cyber crisis exercises’, ‘Générateur de stimuli pour exercices de crise cyber’)}</p>
              </div>
              <div class="grid cols-3" style="gap:20px;">
                <article class="card" style="text-align:center; cursor:pointer; padding:28px 20px;" data-action="new-scenario">
                  <div style="font-size:2rem; margin-bottom:12px;">➕</div>
                  <strong>${tt(‘New scenario’, ‘Nouveau scénario’)}</strong>
                  <p class="subtle" style="font-size:0.88rem; margin-top:6px;">${tt(‘Start from scratch’, ‘Partir de zéro’)}</p>
                </article>
                <article class="card" style="text-align:center; cursor:pointer; padding:28px 20px;" data-action="load-json">
                  <div style="font-size:2rem; margin-bottom:12px;">📂</div>
                  <strong>${tt(‘Open a file’, ‘Ouvrir un fichier’)}</strong>
                  <p class="subtle" style="font-size:0.88rem; margin-top:6px;">.json ${tt(‘or’, ‘ou’)} .crisisstim.json</p>
                </article>
                <article class="card" style="text-align:center; cursor:pointer; padding:28px 20px;" data-action="nav-scenario">
                  <div style="font-size:2rem; margin-bottom:12px;">▶️</div>
                  <strong>${tt(‘Continue’, ‘Continuer’)}</strong>
                  <p class="subtle" style="font-size:0.88rem; margin-top:6px;">${tt(‘Use current scenario’, ‘Utiliser le scénario actuel’)}</p>
                </article>
              </div>
            </section>
          `;
        }
        return `
          <section class="grid" style="max-width:800px;">
            <article class="card">
              <div class="section-header">
                <h3>${escapeHtml(s.name)}</h3>
                <div class="actions">
                  <button class="btn btn-primary" data-action="save-local">${tt(‘Save’, ‘Sauvegarder’)} 💾</button>
                  <button class="btn btn-secondary" data-action="save-json">${tt(‘Export JSON’, ‘Exporter JSON’)} ⇩</button>
                  <button class="btn btn-secondary" data-action="export-all">${tt(‘Export ZIP’, ‘Exporter ZIP’)} 🗜️</button>
                  <button class="btn btn-secondary" data-action="new-scenario">${tt(‘New’, ‘Nouveau’)} ↺</button>
                </div>
              </div>
              <div class="field-grid cols-3" style="font-size:0.9rem; color:var(--muted);">
                <div><strong>${tt(‘Client’, ‘Client’)}:</strong> ${escapeHtml(s.client.name || ‘—‘)}</div>
                <div><strong>${tt(‘Sector’, ‘Secteur’)}:</strong> ${escapeHtml(s.client.sector || ‘—‘)}</div>
                <div><strong>${tt(‘Scenario’, ‘Scénario’)}:</strong> ${escapeHtml(s.scenario.type || ‘—‘)}</div>
                <div><strong>${tt(‘Actors’, ‘Acteurs’)}:</strong> ${s.actors.length}</div>
                <div><strong>${tt(‘Stimuli’, ‘Stimuli’)}:</strong> ${s.stimuli.length}</div>
                <div><strong>${tt(‘Start’, ‘Début’)}:</strong> ${escapeHtml(s.scenario.start_date ? formatLocalDateTime(s.scenario.start_date) : ‘—‘)}</div>
              </div>
            </article>
            <div class="actions" style="margin-top:8px;">
              <button class="btn btn-primary" data-action="nav-scenario">${tt(‘Edit scenario’, ‘Éditer le scénario’)} →</button>
              <button class="btn btn-primary" data-action="nav-stimuli">${tt(‘Edit stimuli’, ‘Éditer les stimuli’)} →</button>
              <button class="btn btn-secondary" data-action="load-json">${tt(‘Open another file’, ‘Ouvrir un autre fichier’)}</button>
            </div>
          </section>
        `;
      }

      function renderLibraryView() {
        const allStimuli = getSortedStimuli();
        if (!allStimuli.length) {
          return `<section class="grid" style="max-width:600px; margin: 60px auto; text-align:center;">
            <p class="subtle">${tt(‘No stimuli yet. Create some in the Stimuli view.’, ‘Aucun stimulus encore. Créez-en dans la vue Stimuli.’)}</p>
            <button class="btn btn-primary" data-action="nav-stimuli">${tt(‘Go to Stimuli’, ‘Aller aux Stimuli’)}</button>
          </section>`;
        }
        const f = appState.libraryFilter;
        let filtered = allStimuli;
        if (f.channel) filtered = filtered.filter((s) => s.channel === f.channel);
        if (f.status) filtered = filtered.filter((s) => s.status === f.status);
        if (f.actorId) filtered = filtered.filter((s) => s.actor_id === f.actorId);
        if (f.sort === ‘updated’) filtered = [...filtered].sort((a, b) => (b.updated_at || ‘’).localeCompare(a.updated_at || ‘’));
        else if (f.sort === ‘channel’) filtered = [...filtered].sort((a, b) => a.channel.localeCompare(b.channel));
        else if (f.sort === ‘actor’) filtered = [...filtered].sort((a, b) => (getActor(a.actor_id)?.name || ‘’).localeCompare(getActor(b.actor_id)?.name || ‘’));
        // default sort = timeline (already sorted by getSortedStimuli)

        const channelOptions = [...new Set(allStimuli.map((s) => s.channel))].sort();
        const actorOptions = appState.scenario.actors;

        return `
          <section class="grid">
            <div class="library-filter-bar">
              <select data-library-filter="channel">
                <option value="">${tt(‘All channels’, ‘Tous les canaux’)}</option>
                ${channelOptions.map((ch) => `<option value="${ch}" ${f.channel === ch ? ‘selected’ : ‘’}>${escapeHtml(channelLabel(ch))}</option>`).join(‘’)}
              </select>
              <select data-library-filter="status">
                <option value="">${tt(‘All statuses’, ‘Tous les statuts’)}</option>
                <option value="draft" ${f.status === ‘draft’ ? ‘selected’ : ‘’}>${tt(‘Draft’, ‘Brouillon’)}</option>
                <option value="ready" ${f.status === ‘ready’ ? ‘selected’ : ‘’}>${tt(‘Ready’, ‘Prêt’)}</option>
                <option value="sent" ${f.status === ‘sent’ ? ‘selected’ : ‘’}>${tt(‘Sent’, ‘Envoyé’)}</option>
              </select>
              <select data-library-filter="actorId">
                <option value="">${tt(‘All actors’, ‘Tous les acteurs’)}</option>
                ${actorOptions.map((a) => `<option value="${a.id}" ${f.actorId === a.id ? ‘selected’ : ‘’}>${escapeHtml(a.name)}</option>`).join(‘’)}
              </select>
              <select data-library-filter="sort">
                <option value="timeline" ${f.sort === ‘timeline’ ? ‘selected’ : ‘’}>${tt(‘Sort: timeline’, ‘Tri : timeline’)}</option>
                <option value="updated" ${f.sort === ‘updated’ ? ‘selected’ : ‘’}>${tt(‘Sort: last modified’, ‘Tri : modifié’)}</option>
                <option value="channel" ${f.sort === ‘channel’ ? ‘selected’ : ‘’}>${tt(‘Sort: channel’, ‘Tri : canal’)}</option>
                <option value="actor" ${f.sort === ‘actor’ ? ‘selected’ : ‘’}>${tt(‘Sort: actor’, ‘Tri : acteur’)}</option>
              </select>
              <span style="color:var(--muted); font-size:0.85rem; margin-left:auto;">${filtered.length}/${allStimuli.length} ${tt(‘stimuli’, ‘stimuli’)}</span>
              <button class="btn btn-secondary" data-action="export-all">${tt(‘Export ZIP’, ‘Exporter ZIP’)}</button>
            </div>
            <div class="library-card-grid">
              ${filtered.map((s) => renderLibraryCard(s)).join(‘’)}
            </div>
          </section>
        `;
      }

      function renderLibraryCard(stimulus) {
        const meta = CHANNEL_META[stimulus.channel] || CHANNEL_META.email_internal;
        const actor = getActor(stimulus.actor_id);
        const h = Math.floor(stimulus.timestamp_offset_minutes / 60);
        const m = String(stimulus.timestamp_offset_minutes % 60).padStart(2, ‘0’);
        const statusColors = { draft: ‘#888’, ready: ‘#2a7a2a’, sent: ‘#1a3e6f’ };
        const versionCount = stimulus.history ? stimulus.history.length : 0;
        return `
          <div class="library-card">
            <div class="library-card-header" style="background:${meta.color};">
              <span class="library-card-channel">${escapeHtml(channelLabel(stimulus.channel))}</span>
              <span class="library-card-time">H+${h}:${m}</span>
            </div>
            <div class="library-card-body">
              <div class="library-card-actor">${escapeHtml(actor?.name || tt(‘No actor’, ‘Sans acteur’))}</div>
              <div class="library-card-desc">${escapeHtml(stimulus.fields.subject || stimulus.fields.headline || stimulus.fields.text || stimulus.fields.title || ‘—‘).slice(0, 60)}</div>
            </div>
            <div class="library-card-footer">
              <button class="pill pill-status" style="background:${statusColors[stimulus.status] || ‘#888’}; color:#fff; border:none; cursor:pointer;" data-action="cycle-status" data-stimulus-id="${stimulus.id}" title="${tt(‘Click to change status’, ‘Cliquer pour changer le statut’)}">${escapeHtml(stimulus.status)}${versionCount > 0 ? ` · v${versionCount + 1}` : ‘’}</button>
              <div class="library-card-actions">
                <button class="btn btn-xs" data-action="edit-in-stimuli" data-stimulus-id="${stimulus.id}" title="${tt(‘Edit’, ‘Éditer’)}">✏️</button>
                <button class="btn btn-xs" data-action="duplicate-stimulus" data-stimulus-id="${stimulus.id}" title="${tt(‘Duplicate’, ‘Dupliquer’)}">⧉</button>
                <button class="btn btn-xs" data-action="export-png" data-stimulus-id="${stimulus.id}" title="${tt(‘Export PNG’, ‘Exporter PNG’)}">⤓</button>
                <button class="btn btn-xs btn-danger" data-action="delete-stimulus" data-stimulus-id="${stimulus.id}" title="${tt(‘Delete’, ‘Supprimer’)}">✕</button>
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
        return `
          <section class="grid cols-2">
            <article class="card">
              <div class="section-header"><h3>${tt('AI connection', 'Connexion IA')}</h3></div>
              <div class="field-grid cols-2">
                <label class="field">${tt('AI provider', 'Fournisseur IA')}
                  <select data-bind="settings.ai_provider">
                    <option value="anthropic" ${settings.ai_provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                    <option value="openai" ${settings.ai_provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                    <option value="azure_openai" ${settings.ai_provider === 'azure_openai' ? 'selected' : ''}>Azure OpenAI</option>
                  </select>
                </label>
                ${(isAnthropic || isOpenAI) ? `
                  <label class="field">${tt('Model', 'Modèle')}
                    <select data-bind="settings.ai_model">
                      ${models.map((model) => `<option value="${model}" ${settings.ai_model === model ? 'selected' : ''}>${model}</option>`).join('')}
                    </select>
                  </label>
                  <label class="field" style="grid-column: 1 / -1;">${isOpenAI ? tt('OpenAI API key', 'Clé API OpenAI') : tt('Anthropic API key', 'Clé API Anthropic')}
                    <div style="display:flex; gap:10px;">
                      <input id="api-key-input" type="password" data-bind="settings.ai_api_key" value="${escapeAttribute(settings.ai_api_key)}" placeholder="${isOpenAI ? 'sk-proj-...' : 'sk-ant-...'}">
                      <button class="btn btn-secondary" data-action="toggle-api-key">👁️</button>
                    </div>
                  </label>
                ` : ''}
                ${isAzure ? `
                  <label class="field">${tt('Azure endpoint', 'Endpoint Azure')}
                    <input type="url" data-bind="settings.azure_endpoint" value="${escapeAttribute(settings.azure_endpoint || '')}" placeholder="https://<resource>.openai.azure.com/">
                  </label>
                  <label class="field">${tt('Deployment name', 'Nom du déploiement')}
                    <input type="text" data-bind="settings.azure_deployment" value="${escapeAttribute(settings.azure_deployment || '')}" placeholder="gpt-4o">
                  </label>
                  <label class="field" style="grid-column: 1 / -1;">${tt('Azure API key', 'Clé API Azure')}
                    <div style="display:flex; gap:10px;">
                      <input id="api-key-input" type="password" data-bind="settings.azure_api_key" value="${escapeAttribute(settings.azure_api_key || '')}" placeholder="Azure API key">
                      <button class="btn btn-secondary" data-action="toggle-api-key">👁️</button>
                    </div>
                  </label>
                ` : ''}
                <label class="field">${tt('Application language', 'Langue de l’application')}
                  <select data-bind="settings.language">
                    <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
                    <option value="fr" ${settings.language === 'fr' ? 'selected' : ''}>Français</option>
                  </select>
                </label>
              </div>
              <div class="actions" style="margin-top:18px;">
                <button class="btn btn-primary" data-action="test-connection">${tt('Test connection', 'Tester la connexion')}</button>
                <button class="btn btn-secondary" data-action="save-local">${tt('Save locally', 'Sauvegarder localement')}</button>
              </div>
              <p class="helper" style="margin-top:14px;">${tt(`The ${isAzure ? 'Azure OpenAI' : isOpenAI ? 'OpenAI' : 'Anthropic'} settings stay in your browser and are only sent to the selected provider.`, `Les paramètres ${isAzure ? 'Azure OpenAI' : isOpenAI ? 'OpenAI' : 'Anthropic'} restent dans votre navigateur et ne sont transmis qu’au fournisseur sélectionné.`)}</p>
            </article>
            <article class="card">
              <div class="section-header"><h3>${tt('Included modules', 'Modules implémentés')}</h3></div>
              <div class="tag-row">
                <span class="tag">ScenarioManager</span>
                <span class="tag">StimulusEditor</span>
                <span class="tag">TemplateEngine</span>
                <span class="tag">AITextGenerator</span>
                <span class="tag">ExportEngine</span>
                <span class="tag">UIRouter</span>
              </div>
              <p class="subtle" style="margin-top:18px;">${tt('The application runs serverless in a single HTML file. External dependencies are loaded via CDN for PNG and ZIP exports.', 'L’application fonctionne sans serveur dans un seul fichier HTML. Les dépendances externes sont chargées via CDN pour les exports PNG et ZIP.')}</p>
              <div class="field-grid" style="margin-top:20px;">
                <div class="card" style="padding:16px; background:var(--surface-alt); box-shadow:none;">
                  <h4>${tt('Generation tips', 'Conseils de génération')}</h4>
                  <ul class="helper">
                    <li>${tt('Use a precise scenario summary to get consistent stimuli.', 'Utilisez un résumé de scénario précis pour obtenir des stimuli cohérents.')}</li>
                    <li>${tt('Add multiple actors to vary perspectives.', 'Renseignez plusieurs acteurs pour varier les points de vue.')}</li>
                    <li>${tt('Manual editing remains available after generation for every field.', 'L’édition manuelle reste possible après génération sur chaque champ.')}</li>
                  </ul>
                </div>
                <div class="card" style="padding:16px; background:var(--surface-alt); box-shadow:none;">
                  <h4>${tt('Quick validation', 'Validation rapide')}</h4>
                  <ul class="helper">
                    <li>${tt('High-resolution PNG export (pixelRatio 2).', 'Export PNG en haute résolution (pixelRatio 2).')}</li>
                    <li>${tt('Autosave every 30 seconds.', 'Auto-sauvegarde toutes les 30 secondes.')}</li>
                    <li>${tt('Full scenario import/export in JSON.', 'Import / export complet du scénario en JSON.')}</li>
                  </ul>
                </div>
              </div>
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
        return `
          <section class="grid">
            <article class="card">
              <div class="section-header"><h3>${tt('Client', 'Client')}</h3></div>
              <div class="field-grid cols-2">
                <label class="field">${tt('Client name', 'Nom du client')}<input type="text" data-bind="client.name" value="${escapeAttribute(scenario.client.name)}"></label>
                <label class="field">${tt('Sector', 'Secteur')}
                  <select data-bind="client.sector">${sectors.map(([en, fr]) => `<option value="${en}" ${scenario.client.sector === en || scenario.client.sector === fr ? 'selected' : ''}>${tt(en, fr)}</option>`).join('')}</select>
                </label>
                <label class="field">${tt('Primary language', 'Langue principale')}
                  <select data-bind="client.language">${langOptions}</select>
                </label>
                <label class="field">${tt('Logo (URL or data URI)', 'Logo (URL ou data URI)')}<input type="url" data-bind="client.logo_url" value="${escapeAttribute(scenario.client.logo_url || '')}" placeholder="https://..."></label>
              </div>
            </article>

            <article class="card">
              <div class="section-header"><h3>${tt('Scenario / Threat', 'Scénario / Menace')}</h3></div>
              <div class="field-grid cols-2">
                <label class="field">${tt('Scenario name', 'Nom du scénario')}<input type="text" data-bind="name" value="${escapeAttribute(scenario.name)}"></label>
                <label class="field">${tt('Type', 'Type')}
                  <select data-bind="scenario.type">${types.map(([en, fr]) => `<option value="${en}" ${scenario.scenario.type === en || scenario.scenario.type === fr ? 'selected' : ''}>${tt(en, fr)}</option>`).join('')}</select>
                </label>
                <label class="field">${tt('Start date', 'Date de début')}<input type="datetime-local" data-bind="scenario.start_date" value="${escapeAttribute(scenario.scenario.start_date)}"></label>
                <label class="field">${tt('Timezone', 'Fuseau horaire')}
                  <select data-bind="scenario.timezone">${TIMEZONES.map((item) => `<option value="${item}" ${scenario.scenario.timezone === item ? 'selected' : ''}>${item}</option>`).join('')}</select>
                </label>
                <label class="field" style="grid-column: 1 / -1;">${tt('Scenario summary', 'Résumé du scénario')}
                  <textarea data-bind="scenario.summary">${escapeHtml(scenario.scenario.summary)}</textarea>
                  <span class="helper">${tt('Injected into all AI prompts for content generation.', 'Injecté dans tous les prompts IA pour la génération de contenu.')}</span>
                </label>
                <label class="field" style="grid-column: 1 / -1;">${tt('Detailed context (optional)', 'Contexte détaillé (optionnel)')}
                  <textarea data-bind="scenario.detailed_context" rows="5" placeholder="${tt('Timeline, affected systems, attack vector, compromised data...', 'Chronologie, systèmes affectés, vecteur d\'attaque, données compromises...')}">${escapeHtml(scenario.scenario.detailed_context || '')}</textarea>
                </label>
              </div>
            </article>

            <article class="card">
              <div class="section-header">
                <div>
                  <h3>${tt('Simulated actors', 'Acteurs simulés')}</h3>
                  <p class="subtle">${tt('Actors available to sign or emit stimuli.', 'Acteurs disponibles pour signer ou émettre les stimuli.')}</p>
                </div>
                <div class="actions">
                  <button class="btn btn-secondary" data-action="generate-sample-actors">${tt('Generate sample actors', 'Générer des acteurs types')}</button>
                  <button class="btn btn-primary" data-action="add-actor">${tt('Add actor', 'Ajouter un acteur')}</button>
                </div>
              </div>
              <div style="overflow-x:auto;">
                <table class="table">
                  <thead><tr><th>${tt('Name', 'Nom')}</th><th>${tt('Role', 'Rôle')}</th><th>${tt('Organization', 'Organisation')}</th><th>${tt('Title', 'Titre')}</th><th>${tt('Language', 'Langue')}</th><th>${tt('Actions', 'Actions')}</th></tr></thead>
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
                            <button class="btn btn-ghost" data-action="duplicate-actor" data-actor-id="${actor.id}">${tt('Duplicate', 'Dupliquer')}</button>
                            <button class="btn btn-danger" data-action="delete-actor" data-actor-id="${actor.id}">${tt('Delete', 'Supprimer')}</button>
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
        const selected = getSelectedStimulus();
        const maxOffset = Math.max(360, ...appState.scenario.stimuli.map((item) => item.timestamp_offset_minutes));
        const width = Math.max(980, (Math.ceil(maxOffset / 60) + 1) * 120 + 120);
        const ticks = Array.from({ length: Math.ceil(maxOffset / 60) + 2 }, (_, index) => index);
        return `
          <section class="grid">
            <article class="card">
              <div class="section-header">
                <h3>${tt(‘Timeline’, ‘Timeline’)}</h3>
                <div class="actions">
                  <button class="btn btn-primary" data-action="add-stimulus">${tt(‘+ Add stimulus’, ‘+ Ajouter un stimulus’)}</button>
                  <button class="btn btn-secondary" data-action="sort-stimuli">${tt(‘Sort’, ‘Trier’)}</button>
                </div>
              </div>
              <div class="timeline">
                <div class="timeline-track" style="width:${width}px;">
                  ${ticks.map((tick) => `<div class="timeline-tick" style="left:${tick * 120}px;">H+${tick}</div>`).join(‘’)}
                  ${appState.scenario.stimuli.map((stimulus, index) => renderStimulusCard(stimulus, index)).join(‘’)}
                </div>
              </div>
            </article>
            <section class="stimuli-split">
              <article class="stimuli-left-panel card">
                ${selected ? renderStimulusEditor(selected) : `<p class="subtle" style="padding:20px;">${tt(‘Select a stimulus from the timeline to edit it.’, ‘Sélectionnez un stimulus dans la timeline pour l\’éditer.’)}</p>`}
              </article>
              <article class="stimuli-right-panel">
                <div class="preview-toolbar-inline">
                  ${selected ? `<button class="btn btn-secondary" data-action="export-png" data-stimulus-id="${selected.id}">${tt(‘Export PNG’, ‘Exporter PNG’)}</button>` : ‘’}
                </div>
                <div class="preview-shell" style="margin:0; border-radius:0; border:none; min-height:calc(100% - 48px);">
                  <div class="preview-stage">
                    ${selected ? renderStimulusPreview(selected) : `<div class="subtle" style="padding:40px;">${tt(‘Select a stimulus to preview it.’, ‘Sélectionnez un stimulus pour le prévisualiser.’)}</div>`}
                  </div>
                </div>
              </article>
            </section>
          </section>
        `;
      }

      function renderStimulusCard(stimulus, index) {
        const meta = CHANNEL_META[stimulus.channel] || CHANNEL_META.email_internal;
        const left = (stimulus.timestamp_offset_minutes / 60) * 120;
        const top = 24 + (index % 3) * 58;
        const actor = getActor(stimulus.actor_id);
        return `
          <div class="stimulus-card ${appState.selectedStimulusId === stimulus.id ? 'selected' : ''}" data-action="select-stimulus" data-stimulus-id="${stimulus.id}" style="left:${left}px; top:${top}px; background:${meta.color};">
            <strong>${escapeHtml(channelLabel(stimulus.channel))}</strong>
            <small>${escapeHtml(actor?.name || tt('No actor', 'Sans acteur'))}</small>
            <small>H+${Math.floor(stimulus.timestamp_offset_minutes / 60)}:${String(stimulus.timestamp_offset_minutes % 60).padStart(2, '0')}</small>
            <small>${tt('Status', 'Statut')} : ${escapeHtml(stimulus.status)}</small>
          </div>
        `;
      }

      function renderStimulusEditor(stimulus) {
        const library = getTemplateDefinition(stimulus);
        const actorOptions = appState.scenario.actors.map((actor) => `<option value="${actor.id}" ${stimulus.actor_id === actor.id ? 'selected' : ''}>${escapeHtml(actor.name)} — ${escapeHtml(actor.title)}</option>`).join('');
        return `
          <div class="section-header">
            <div>
              <h3>${tt('Stimulus editor', 'Éditeur de stimulus')}</h3>
              <p class="subtle">${escapeHtml(channelLabel(stimulus.channel))} · ${tt('template', 'template')} <span class="mono">${escapeHtml(stimulus.template_id)}</span></p>
            </div>
            <div class="actions">
              ${(stimulus.history?.length > 0) ? `<button class="btn btn-secondary" data-action="show-history" data-stimulus-id="${stimulus.id}">${tt('History', 'Historique')} (${stimulus.history.length})</button>` : ''}
              <button class="btn btn-secondary" data-action="duplicate-stimulus" data-stimulus-id="${stimulus.id}">${tt('Duplicate', 'Dupliquer')}</button>
              <button class="btn btn-danger" data-action="delete-stimulus" data-stimulus-id="${stimulus.id}">${tt('Delete', 'Supprimer')}</button>
            </div>
          </div>

          <div class="field-grid cols-2">
            <label class="field">${tt('Channel', 'Canal')}
              <select data-stimulus-bind="${stimulus.id}.channel">${Object.entries(CHANNEL_META).map(([channel]) => `<option value="${channel}" ${stimulus.channel === channel ? 'selected' : ''}>${channelLabel(channel)}</option>`).join('')}</select>
            </label>
            ${stimulus.channel === 'article_press' ? `<label class="field">${tt('Press template', 'Template presse')}
              <select data-stimulus-bind="${stimulus.id}.template_id">${Object.values(ARTICLE_TEMPLATE_LIBRARY).map((template) => `<option value="${template.template_id}" ${stimulus.template_id === template.template_id ? 'selected' : ''}>${escapeHtml(template.label)}</option>`).join('')}</select>
            </label>` : ''}
            <label class="field">${tt('Source actor', 'Acteur émetteur')}
              <select data-stimulus-bind="${stimulus.id}.actor_id">${actorOptions}</select>
            </label>
            <label class="field">${tt('Timeline (minutes)', 'Timeline (minutes)')}
              <input type="number" min="0" step="5" data-stimulus-bind="${stimulus.id}.timestamp_offset_minutes" value="${stimulus.timestamp_offset_minutes}">
            </label>
            <label class="field">${tt('Status', 'Statut')}
              <select data-stimulus-bind="${stimulus.id}.status">${['draft', 'ready', 'sent'].map((value) => `<option value="${value}" ${stimulus.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select>
            </label>
          </div>

          <div class="field-grid cols-2" style="margin-top:14px;">
            <label class="field">${tt('Generation mode', 'Mode de génération')}
              <select data-stimulus-bind="${stimulus.id}.generation_mode">
                <option value="ai" ${(stimulus.generation_mode || 'ai') === 'ai' ? 'selected' : ''}>${tt('AI automatic', 'IA automatique')}</option>
                <option value="ai_guided" ${stimulus.generation_mode === 'ai_guided' ? 'selected' : ''}>${tt('AI guided', 'IA guidée')}</option>
                <option value="manual" ${stimulus.generation_mode === 'manual' ? 'selected' : ''}>${tt('Manual', 'Manuel')}</option>
              </select>
            </label>
          </div>

          ${stimulus.generation_mode === 'ai_guided' ? `
            <label class="field" style="margin-top:10px;">${tt('Generation instruction', 'Instruction de génération')}
              <textarea data-stimulus-bind="${stimulus.id}.generation_prompt" placeholder="${tt('Describe the desired content...', 'Décrivez le contenu souhaité...')}">${escapeHtml(stimulus.generation_prompt || '')}</textarea>
            </label>
          ` : ''}

          <div class="actions" style="margin:14px 0 12px;">
            ${stimulus.generation_mode !== 'manual' ? `<button class="btn btn-primary" data-action="generate-stimulus" data-stimulus-id="${stimulus.id}">${stimulus.generation_mode === 'ai_guided' ? tt('Generate from description', 'Générer depuis la description') : tt('Generate all', 'Tout générer')}</button>` : ''}
            <button class="btn btn-secondary" data-action="duplicate-stimulus" data-stimulus-id="${stimulus.id}">${tt('Duplicate', 'Dupliquer')}</button>
            <button class="btn btn-danger" data-action="delete-stimulus" data-stimulus-id="${stimulus.id}">${tt('Delete', 'Supprimer')}</button>
          </div>

          <div class="field-grid">
            ${library.fields.map((spec) => renderFieldControl(stimulus, spec)).join('')}
          </div>
        `;
      }

      function renderFieldControl(stimulus, spec) {
        const value = stimulus.fields[spec.key];
        const bind = `data-stimulus-field="${stimulus.id}.${spec.key}"`;
        const isManual = stimulus.generation_mode === 'manual';
        const genBtn = isManual ? '' : `<div class="actions" style="margin-top:4px;"><button class="btn btn-ghost" style="font-size:0.82rem; padding:6px 10px;" data-action="generate-field" data-stimulus-id="${stimulus.id}" data-field-name="${spec.key}">✨ ${tt('Regenerate', 'Régénérer')}</button></div>`;
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
              <select ${bind}><option value="true" ${value ? 'selected' : ''}>${tt('Yes', 'Oui')}</option><option value="false" ${!value ? 'selected' : ''}>${tt('No', 'Non')}</option></select>
            </label>
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
          return `<article class="card"><p class="subtle">${tt('No stimulus to preview.', 'Aucun stimulus à prévisualiser.')}</p></article>`;
        }
        const index = Math.min(appState.slideshowIndex, stimuli.length - 1);
        const current = stimuli[index];
        return `
          <section class="grid">
            <article class="preview-toolbar">
              <div>
                <strong>${escapeHtml(channelLabel(current.channel))}</strong>
                <div class="subtle">${escapeHtml(getActor(current.actor_id)?.name || tt('No actor', 'Sans acteur'))} · H+${Math.floor(current.timestamp_offset_minutes / 60)}:${String(current.timestamp_offset_minutes % 60).padStart(2, '0')}</div>
              </div>
              <div class="actions">
                <button class="btn btn-secondary" data-action="preview-prev">← ${tt('Previous', 'Précédent')}</button>
                <button class="btn btn-secondary" data-action="preview-next">${tt('Next', 'Suivant')} →</button>
                <button class="btn btn-primary" data-action="goto-stimuli" data-stimulus-id="${current.id}">${tt('Edit', 'Éditer')}</button>
                <button class="btn btn-success" data-action="export-png" data-stimulus-id="${current.id}">${tt('Export PNG', 'Exporter PNG')}</button>
              </div>
            </article>
            <article class="preview-shell">
              <div class="preview-stage">${renderStimulusPreview(current, 'fullscreen-preview')}</div>
            </article>
            <article class="card">
              <div class="section-header"><h3>${tt('Stimulus slideshow', 'Diaporama de stimuli')}</h3></div>
              <div class="thumb-grid">
                ${stimuli.map((stimulus, idx) => `
                  <div class="thumb-card">
                    <div class="thumb-preview">${renderStimulusPreview(stimulus, '', true)}</div>
                    <div class="thumb-body">
                      <strong>${escapeHtml(channelLabel(stimulus.channel))}</strong>
                      <p class="subtle">${escapeHtml(getActor(stimulus.actor_id)?.name || tt('No actor', 'Sans acteur'))} · H+${Math.floor(stimulus.timestamp_offset_minutes / 60)}:${String(stimulus.timestamp_offset_minutes % 60).padStart(2, '0')}</p>
                      <button class="btn btn-secondary" data-action="preview-select" data-index="${idx}">${tt('Show', 'Afficher')}</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </article>
          </section>
        `;
      }

      function renderStimulusPreview(stimulus, id = '', thumbnail = false) {
        const wrapperId = id || `render-${stimulus.id}`;
        const body = TemplateEngine.render(stimulus, getActor(stimulus.actor_id), appState.scenario);
        return `<div id="${wrapperId}" class="render-frame" style="transform:${thumbnail ? 'scale(0.22)' : 'none'}; transform-origin: top center;">${body}</div>`;
      }

      function renderHistoryModal(stimulus) {
        if (!stimulus) return '';
        const history = stimulus.history || [];
        const actor = getActor(stimulus.actor_id);
        return `
          <div class="modal-backdrop" data-action="close-history">
            <div class="modal-box" onclick="event.stopPropagation()">
              <div class="modal-header">
                <h3>${tt('Version history', 'Historique des versions')} — ${escapeHtml(channelLabel(stimulus.channel))}</h3>
                <button class="btn btn-secondary" data-action="close-history">✕</button>
              </div>
              <div class="modal-body">
                ${history.length === 0
                  ? `<p class="subtle" style="padding:16px;">${tt('No history yet. Generate content to create versions.', 'Aucun historique. Générez du contenu pour créer des versions.')}</p>`
                  : history.map((version, index) => `
                    <div class="history-entry">
                      <div class="history-entry-meta">
                        <strong>v${history.length - index}</strong>
                        <span class="subtle">${new Date(version.saved_at).toLocaleString()}</span>
                        <span>${escapeHtml(version.change_summary || '')}</span>
                        <button class="btn btn-xs btn-secondary" data-action="restore-version" data-stimulus-id="${stimulus.id}" data-version-index="${index}">${tt('Restore', 'Restaurer')}</button>
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

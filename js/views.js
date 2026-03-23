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
        return `
          <div class="app-shell">
            <aside class="sidebar">
              <div class="brand">
                <h1>CrisisStim <span class="brand-signature">by Wavestone</span></h1>
                <p>${tt('Standalone stimulus generator for cyber crisis exercises, delivered as a single serverless HTML file.', 'Générateur autonome de stimuli pour exercices de crise cyber, dans un seul fichier HTML sans serveur.')}</p>
              </div>

              <div>
                <div class="subtle" style="color: rgba(255,255,255,0.78); margin-bottom: 10px;">${tt('Navigation', 'Navigation')}</div>
                <div class="nav-list">
                  ${renderNavButton('settings', tt('Settings', 'Paramètres'), tt('API & language', 'API & langue'))}
                  ${renderNavButton('scenario', tt('Scenario', 'Scénario'), tt('Client, context, actors', 'Client, contexte, acteurs'))}
                  ${renderNavButton('stimuli', tt('Stimuli', 'Stimuli'), tt('Timeline & editing', 'Timeline & édition'))}
                  ${renderNavButton('preview', tt('Preview', 'Prévisualisation'), tt('Fullscreen & export', 'Plein écran & export'))}
                </div>
              </div>

              <div>
                <div class="subtle" style="color: rgba(255,255,255,0.78); margin-bottom: 10px;">${tt('Global tools', 'Outils globaux')}</div>
                <div class="toolbar-list">
                  <button class="toolbar-button" data-action="new-scenario">${tt('New scenario', 'Nouveau scénario')} <span>↺</span></button>
                  <button class="toolbar-button" data-action="save-json">${tt('Save JSON', 'Sauvegarder JSON')} <span>⇩</span></button>
                  <button class="toolbar-button" data-action="load-json">${tt('Load JSON', 'Charger JSON')} <span>⇧</span></button>
                  <button class="toolbar-button" data-action="save-local">${tt('Local save', 'Sauvegarde locale')} <span>💾</span></button>
                  <button class="toolbar-button" data-action="export-all">${tt('Full ZIP export', 'Export complet ZIP')} <span>🗜️</span></button>
                </div>
              </div>

              <div class="toolbar-note">
                <strong>${tt('Privacy.', 'Confidentialité.')}</strong><br>
                ${tt('Your API key is stored only in the browser (localStorage) and is sent only to the selected AI provider during generation.', 'Votre clé API est stockée uniquement dans le navigateur (localStorage) et n’est envoyée qu’au fournisseur IA sélectionné lors des appels de génération.')}
              </div>
            </aside>

            <main class="content">
              <section class="topbar">
                <div class="page-title">
                  <h2>${viewConfig().title}</h2>
                  <p>${viewConfig().subtitle}</p>
                </div>
                <div class="status-pills">
                  <span class="pill">${escapeHtml(appState.scenario.name)}</span>
                  <span class="pill">${appState.scenario.stimuli.length} ${tt('stimuli', 'stimuli')}</span>
                  <span class="pill">${appState.scenario.actors.length} ${tt('actors', 'acteurs')}</span>
                  <span class="pill">${renderProviderSummary(appState.scenario.settings)}</span>
                </div>
              </section>
              ${renderCurrentView()}
            </main>
          </div>
        `;
      }

      function renderNavButton(route, label, note) {
        return `<button class="nav-button ${appState.route === route ? 'active' : ''}" data-route="${route}"><span>${label}</span><small>${note}</small></button>`;
      }

      function viewConfig() {
        const map = {
          settings: {
            title: tt('AI settings', 'Paramètres IA'),
            subtitle: tt('Configure your AI provider, API key, and generation preferences.', 'Configurez votre fournisseur IA, la clé API et les préférences de génération.')
          },
          scenario: {
            title: tt('Crisis scenario', 'Scénario de crise'),
            subtitle: tt('Define the client, context, and actors involved in the exercise.', 'Définissez le client, le contexte et les acteurs impliqués dans l’exercice.')
          },
          stimuli: {
            title: tt('Timeline & editor', 'Timeline & éditeur'),
            subtitle: tt('Create realistic stimuli, generate their content, and adjust the rendering in real time.', 'Créez des stimuli réalistes, générez leur contenu et ajustez le rendu en temps réel.')
          },
          preview: {
            title: tt('Fullscreen preview', 'Prévisualisation plein écran'),
            subtitle: tt('Display, export, and browse stimuli in timeline order.', 'Affichez, exportez et faites défiler les stimuli dans l’ordre de la timeline.')
          }
        };
        return map[appState.route];
      }

      function renderCurrentView() {
        if (appState.route === 'settings') return renderSettingsView();
        if (appState.route === 'scenario') return renderScenarioView();
        if (appState.route === 'stimuli') return renderStimuliView();
        return renderPreviewView();
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
        return `
          <section class="grid">
            <article class="card">
              <div class="section-header"><h3>${tt('Client', 'Client')}</h3></div>
              <div class="field-grid cols-2">
                <label class="field">${tt('Client name', 'Nom du client')}<input type="text" data-bind="client.name" value="${escapeAttribute(scenario.client.name)}"></label>
                <label class="field">${tt('Sector', 'Secteur')}
                  <select data-bind="client.sector">${sectors.map(([en, fr]) => `<option value="${en}" ${scenario.client.sector === en || scenario.client.sector === fr ? 'selected' : ''}>${tt(en, fr)}</option>`).join('')}</select>
                </label>
                <label class="field">${tt('Country', 'Pays')}
                  <select data-bind="client.country">${COUNTRIES.map((country) => `<option value="${country}" ${scenario.client.country === country ? 'selected' : ''}>${country}</option>`).join('')}</select>
                </label>
                <label class="field">${tt('Logo (URL or data URI)', 'Logo (URL ou data URI)')}<input type="url" data-bind="client.logo_url" value="${escapeAttribute(scenario.client.logo_url)}" placeholder="https://..."></label>
              </div>
            </article>

            <article class="card">
              <div class="section-header"><h3>${tt('Scenario', 'Scénario')}</h3></div>
              <div class="field-grid cols-2">
                <label class="field">${tt('Scenario name', 'Nom du scénario')}<input type="text" data-bind="name" value="${escapeAttribute(scenario.name)}"></label>
                <label class="field">${tt('Type', 'Type')}
                  <select data-bind="scenario.type">${types.map(([en, fr]) => `<option value="${en}" ${scenario.scenario.type === en || scenario.scenario.type === fr ? 'selected' : ''}>${tt(en, fr)}</option>`).join('')}</select>
                </label>
                <label class="field">${tt('Start date', 'Date de début')}<input type="datetime-local" data-bind="scenario.start_date" value="${escapeAttribute(scenario.scenario.start_date)}"></label>
                <label class="field">${tt('Timezone', 'Fuseau horaire')}
                  <select data-bind="scenario.timezone">${TIMEZONES.map((item) => `<option value="${item}" ${scenario.scenario.timezone === item ? 'selected' : ''}>${item}</option>`).join('')}</select>
                </label>
                <label class="field" style="grid-column: 1 / -1;">${tt('Scenario summary', 'Résumé du scénario')}<textarea data-bind="scenario.summary">${escapeHtml(scenario.scenario.summary)}</textarea></label>
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
              <table class="table">
                <thead><tr><th>${tt('Name', 'Nom')}</th><th>${tt('Role', 'Rôle')}</th><th>${tt('Organization', 'Organisation')}</th><th>${tt('Title', 'Titre')}</th><th>${tt('Country', 'Pays')}</th><th>${tt('Actions', 'Actions')}</th></tr></thead>
                <tbody>
                  ${scenario.actors.map((actor) => `
                    <tr>
                      <td><input type="text" data-actor-bind="${actor.id}.name" value="${escapeAttribute(actor.name)}"></td>
                      <td>
                        <select data-actor-bind="${actor.id}.role">
                          ${ROLES.map((role) => `<option value="${role.value}" ${actor.role === role.value ? 'selected' : ''}>${escapeHtml(roleLabel(role.value))}</option>`).join('')}
                        </select>
                      </td>
                      <td><input type="text" data-actor-bind="${actor.id}.organization" value="${escapeAttribute(actor.organization)}"></td>
                      <td><input type="text" data-actor-bind="${actor.id}.title" value="${escapeAttribute(actor.title)}"></td>
                      <td>
                        <select data-actor-bind="${actor.id}.country">
                          ${COUNTRIES.map((country) => `<option value="${country}" ${actor.country === country ? 'selected' : ''}>${country}</option>`).join('')}
                        </select>
                      </td>
                      <td>
                        <div class="actions">
                          <button class="btn btn-ghost" data-action="duplicate-actor" data-actor-id="${actor.id}">${tt('Duplicate', 'Dupliquer')}</button>
                          <button class="btn btn-danger" data-action="delete-actor" data-actor-id="${actor.id}">${tt('Delete', 'Supprimer')}</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
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
                <div>
                  <h3>${tt('Visual timeline', 'Timeline visuelle')}</h3>
                  <p class="subtle">${tt('Horizontal relative-time axis with color-coded cards sorted chronologically.', 'Axe horizontal en temps relatif, cartes colorées par canal, triées chronologiquement.')}</p>
                </div>
                <div class="actions">
                  <button class="btn btn-primary" data-action="add-stimulus">${tt('+ Add stimulus', '+ Ajouter un stimulus')}</button>
                  <button class="btn btn-secondary" data-action="sort-stimuli">${tt('Sort timeline', 'Trier la timeline')}</button>
                </div>
              </div>
              <div class="timeline">
                <div class="timeline-track" style="width:${width}px;">
                  ${ticks.map((tick) => `<div class="timeline-tick" style="left:${tick * 120}px;">H+${tick}</div>`).join('')}
                  ${appState.scenario.stimuli.map((stimulus, index) => renderStimulusCard(stimulus, index)).join('')}
                </div>
              </div>
            </article>
            <section class="editor-layout">
              <article class="card">
                ${selected ? renderStimulusEditor(selected) : `<p class="subtle">${tt('Select a stimulus to edit it.', 'Sélectionnez un stimulus pour l’éditer.')}</p>`}
              </article>
              <article class="preview-shell">
                <div class="preview-stage">
                  ${selected ? renderStimulusPreview(selected) : `<div class="subtle">${tt('The preview will appear here.', 'La prévisualisation apparaîtra ici.')}</div>`}
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
            <strong>${escapeHtml(channelLabel(current.channel))}</strong>
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

          <div class="actions" style="margin:18px 0 16px;">
            <button class="btn btn-primary" data-action="generate-stimulus" data-stimulus-id="${stimulus.id}">${tt('Generate all', 'Tout générer')}</button>
            <button class="btn btn-success" data-action="export-png" data-stimulus-id="${stimulus.id}">${tt('Export PNG', 'Exporter PNG')}</button>
          </div>

          <div class="field-grid">
            ${library.fields.map((spec) => renderFieldControl(stimulus, spec)).join('')}
          </div>
        `;
      }

      function renderFieldControl(stimulus, spec) {
        const value = stimulus.fields[spec.key];
        const bind = `data-stimulus-field="${stimulus.id}.${spec.key}"`;
        if (spec.type === 'textarea') {
          const content = Array.isArray(value) ? JSON.stringify(value) : String(value ?? '');
          return `
            <label class="field">${escapeHtml(spec.label)}
              <textarea ${bind}>${escapeHtml(content)}</textarea>
              <div class="actions"><button class="btn btn-ghost" data-action="generate-field" data-stimulus-id="${stimulus.id}" data-field-name="${spec.key}">✨ ${tt('Generate this field', 'Générer ce champ')}</button></div>
            </label>
          `;
        }
        if (spec.type === 'select') {
          return `
            <label class="field">${escapeHtml(spec.label)}
              <select ${bind}>
                ${(spec.options || []).map((option) => `<option value="${option}" ${String(value) === String(option) ? 'selected' : ''}>${option}</option>`).join('')}
              </select>
              <div class="actions"><button class="btn btn-ghost" data-action="generate-field" data-stimulus-id="${stimulus.id}" data-field-name="${spec.key}">✨ ${tt('Generate this field', 'Générer ce champ')}</button></div>
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
            <div class="actions"><button class="btn btn-ghost" data-action="generate-field" data-stimulus-id="${stimulus.id}" data-field-name="${spec.key}">✨ ${tt('Generate this field', 'Générer ce champ')}</button></div>
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

      // ─── Chronogram AI Import: UI Modals ───

      function renderChronogramImportModals() {
        const state = appState.chronogramImport;
        if (!state) return '';
        switch (state.phase) {
          case 'config': return renderChronogramConfigModal();
          case 'progress': return renderChronogramProgressModal();
          case 'result': return renderChronogramResultModal();
          case 'validation': return renderChronogramValidationModal();
          default: return '';
        }
      }

      // ── Config Modal ──

      function renderChronogramConfigModal() {
        const state = appState.chronogramImport;
        if (!state || !state.excelData) return '';
        const ed = state.excelData;
        const totalRows = Object.values(ed.sheets).reduce((sum, s) => sum + s.row_count, 0);
        const detectedSheet = state.options.mainSheet || ChronogramImport.detectMainSheet(ed.sheet_names);
        const hasExisting = appState.scenario.stimuli.length > 0 || appState.scenario.actors.length > 0;
        const autonomy = appState.chronogramImportAutonomy || 'mostly_autonomous';

        return `
          <div class="modal-backdrop" data-action="chronogram-cancel">
            <div class="modal-box chronogram-modal" onclick="event.stopPropagation()">
              <div class="modal-header">
                <h3>${tt('AI Import - Chronogram', 'Import IA - Chronogramme')}</h3>
                <button class="btn btn-secondary" data-action="chronogram-cancel">✕</button>
              </div>
              <div class="chronogram-modal-body">
                <div class="chronogram-info-grid">
                  <div><strong>${tt('File', 'Fichier')} :</strong> ${escapeHtml(state.fileName)}</div>
                  <div><strong>${tt('Sheets detected', 'Feuilles détectées')} :</strong> ${ed.sheet_names.length}</div>
                  <div><strong>${tt('Estimated data rows', 'Lignes de données estimées')} :</strong> ~${totalRows}</div>
                </div>

                ${hasExisting ? `<div class="chronogram-warning-banner">
                  ⚠️ ${tt(
                    'This project already has stimuli and/or actors. Existing imported content will be replaced, new content will be added.',
                    'Ce projet contient déjà des stimuli et/ou des acteurs. Le contenu importé existant sera remplacé, le nouveau contenu sera ajouté.'
                  )}
                </div>` : ''}

                <div class="chronogram-options">
                  <h4>${tt('Options', 'Options')}</h4>
                  <label class="chronogram-checkbox">
                    <input type="checkbox" data-chrono-option="createActors" ${state.options.createActors ? 'checked' : ''}>
                    ${tt('Automatically create actors', 'Créer automatiquement les acteurs')}
                  </label>
                  <label class="chronogram-checkbox">
                    <input type="checkbox" data-chrono-option="detectImplicit" ${state.options.detectImplicit ? 'checked' : ''}>
                    ${tt('Detect and create implicit stimuli (attachments, social posts...)', 'Détecter et créer les stimuli implicites (PJ, posts réseaux sociaux...)')}
                  </label>
                </div>

                <div class="chronogram-field">
                  <label>${tt('Main sheet (auto-detected)', 'Feuille principale (auto-détectée)')} :</label>
                  <select data-chrono-option="mainSheet">
                    ${ed.sheet_names.map(name => `<option value="${escapeAttribute(name)}" ${name === detectedSheet ? 'selected' : ''}>${escapeHtml(name)} (${ed.sheets[name].row_count} ${tt('rows', 'lignes')})</option>`).join('')}
                  </select>
                </div>

                <div class="chronogram-field">
                  <label>${tt('Additional context for the LLM (optional)', 'Contexte additionnel pour le LLM (optionnel)')} :</label>
                  <textarea data-chrono-option="userContext" rows="3" placeholder="${escapeAttribute(tt(
                    'E.g. "The client is a French bank listed on CAC40. The exercise is about a ransomware via EDR supply chain."',
                    'Ex: "Le client est une banque française cotée au CAC40. L\'exercice porte sur un ransomware via supply chain EDR."'
                  ))}">${escapeHtml(state.options.userContext || '')}</textarea>
                </div>

                <div class="chronogram-field">
                  <label>${tt('Autonomy mode', 'Mode d\'autonomie')} :</label>
                  <select data-chrono-option="autonomyMode">
                    <option value="fully_validated" ${autonomy === 'fully_validated' ? 'selected' : ''}>${tt('Fully validated (confirm each item)', 'Entièrement validé (confirmer chaque élément)')}</option>
                    <option value="mostly_autonomous" ${autonomy === 'mostly_autonomous' ? 'selected' : ''}>${tt('Mostly autonomous (ask on ambiguities)', 'Principalement autonome (questions si doute)')}</option>
                    <option value="fully_autonomous" ${autonomy === 'fully_autonomous' ? 'selected' : ''}>${tt('Fully autonomous (LLM decides all)', 'Entièrement autonome (le LLM décide tout)')}</option>
                  </select>
                </div>

                <div class="chronogram-estimate subtle">
                  ⏱ ${tt('Estimate: ~3-5 API calls, ~30 seconds', 'Estimation : ~3-5 appels API, ~30 secondes')}
                </div>
              </div>
              <div class="chronogram-modal-footer">
                <button class="btn btn-secondary" data-action="chronogram-cancel">${tt('Cancel', 'Annuler')}</button>
                <button class="btn btn-primary" data-action="chronogram-launch-import">${tt('Launch AI import', 'Lancer l\'import IA')}</button>
              </div>
            </div>
          </div>
        `;
      }

      // ── Progress Modal ──

      function renderChronogramProgressModal() {
        const state = appState.chronogramImport;
        if (!state) return '';
        const p = state.progress || { step: 1, totalSteps: 3, message: '', details: '' };
        const pct = Math.round((p.step / p.totalSteps) * 100);

        const steps = [
          tt('Step 1: Analyze file structure', 'Étape 1 : Analyse de la structure du fichier'),
          tt('Step 2: Extract and classify stimuli', 'Étape 2 : Extraction et classification des stimuli'),
          tt('Step 3: Generate CrisisStim objects', 'Étape 3 : Génération des objets CrisisStim')
        ];

        return `
          <div class="modal-backdrop">
            <div class="modal-box chronogram-modal" onclick="event.stopPropagation()">
              <div class="modal-header">
                <h3>${tt('AI Import in progress...', 'Import IA en cours...')}</h3>
              </div>
              <div class="chronogram-modal-body">
                <div class="chronogram-progress-bar-container">
                  <div class="chronogram-progress-bar" style="width: ${pct}%"></div>
                </div>
                <div class="chronogram-progress-label">${tt('Step', 'Étape')} ${p.step}/${p.totalSteps}</div>

                <div class="chronogram-steps-list">
                  ${steps.map((label, i) => {
                    const stepNum = i + 1;
                    let icon = '○';
                    let cls = 'pending';
                    if (stepNum < p.step) { icon = '✅'; cls = 'done'; }
                    else if (stepNum === p.step) { icon = '🔄'; cls = 'active'; }
                    return `<div class="chronogram-step ${cls}">
                      <span class="chronogram-step-icon">${icon}</span>
                      <span class="chronogram-step-label">${label}</span>
                    </div>
                    ${stepNum === p.step && p.details ? `<div class="chronogram-step-details subtle">${escapeHtml(p.details)}</div>` : ''}`;
                  }).join('')}
                </div>

                ${state.error ? `<div class="chronogram-error-banner">${escapeHtml(state.error)}</div>` : ''}
              </div>
              <div class="chronogram-modal-footer">
                <button class="btn btn-secondary" data-action="chronogram-cancel">${tt('Cancel', 'Annuler')}</button>
              </div>
            </div>
          </div>
        `;
      }

      // ── Result Modal ──

      function renderChronogramResultModal() {
        const state = appState.chronogramImport;
        if (!state || !state.result) return '';
        const r = state.result;
        const stimuli = r.stimuli || [];
        const actors = r.actors || [];
        const warnings = r.warnings || [];
        const skipped = r.skipped_rows || [];
        const implicit = stimuli.filter(s => s.is_implicit);
        const totalRows = (r.structureAnalysis?.total_stimulus_rows) || '?';
        const autonomy = appState.chronogramImportAutonomy || 'mostly_autonomous';

        return `
          <div class="modal-backdrop" data-action="chronogram-cancel">
            <div class="modal-box chronogram-modal chronogram-result-modal" onclick="event.stopPropagation()">
              <div class="modal-header">
                <h3>${state.error
                  ? tt('AI Import failed', 'Import IA échoué')
                  : tt('AI Import complete', 'Import IA terminé')}</h3>
                <button class="btn btn-secondary" data-action="chronogram-cancel">✕</button>
              </div>
              <div class="chronogram-modal-body">
                ${state.error ? `<div class="chronogram-error-banner">${escapeHtml(state.error)}</div>` : ''}

                ${!state.error ? `
                <div class="chronogram-result-summary">
                  <h4>${tt('Summary', 'Résumé')}</h4>
                  <ul>
                    <li>${totalRows} ${tt('rows analyzed in chronogram', 'lignes analysées dans le chronogramme')}</li>
                    <li><strong>${stimuli.filter(s => !s.is_implicit).length}</strong> ${tt('main stimuli created', 'stimuli principaux créés')}</li>
                    ${implicit.length > 0 ? `<li><strong>${implicit.length}</strong> ${tt('implicit stimuli detected and created', 'stimuli implicites détectés et créés')}</li>` : ''}
                    <li><strong>${actors.length}</strong> ${tt('actors created', 'acteurs créés')}</li>
                    ${skipped.length > 0 ? `<li>${skipped.length} ${tt('rows skipped (DEBEX/FINEX, meta-animation)', 'lignes ignorées (DEBEX/FINEX, méta-animation)')}</li>` : ''}
                  </ul>
                </div>

                ${implicit.length > 0 ? `
                <div class="chronogram-result-section">
                  <h4>${tt('Implicit stimuli detected', 'Stimuli implicites détectés')}</h4>
                  <ul class="chronogram-implicit-list">
                    ${implicit.slice(0, 10).map(s => `<li>
                      <span class="pill" style="background:${CHANNEL_META[s.channel]?.color || '#888'}; color:#fff; font-size:0.75rem; padding:2px 8px; border-radius:8px;">${channelLabel(s.channel)}</span>
                      ${escapeHtml(s.generation_prompt || s.fields?.text?.slice(0, 60) || s.fields?.subject || '...')}
                    </li>`).join('')}
                    ${implicit.length > 10 ? `<li class="subtle">+${implicit.length - 10} ${tt('more...', 'autres...')}</li>` : ''}
                  </ul>
                </div>` : ''}

                ${warnings.length > 0 ? `
                <div class="chronogram-result-section">
                  <h4>⚠ ${tt('Warnings', 'Points d\'attention')} (${warnings.length})</h4>
                  <ul class="chronogram-warnings-list">
                    ${warnings.map(w => `<li>${escapeHtml(w.message)}</li>`).join('')}
                  </ul>
                </div>` : ''}
                ` : ''}
              </div>
              <div class="chronogram-modal-footer">
                ${state.error ? `
                  <button class="btn btn-secondary" data-action="chronogram-cancel">${tt('Close', 'Fermer')}</button>
                ` : `
                  <button class="btn btn-danger" data-action="chronogram-reject-all">${tt('Reject all', 'Tout rejeter')}</button>
                  ${autonomy !== 'fully_autonomous' ? `<button class="btn btn-secondary" data-action="chronogram-modify">${tt('Modify before validation', 'Modifier avant validation')}</button>` : ''}
                  <button class="btn btn-primary" data-action="chronogram-accept-all">${tt('Accept all', 'Tout accepter')}</button>
                `}
              </div>
            </div>
          </div>
        `;
      }

      // ── Validation Modal (Fully Validated mode) ──

      function renderChronogramValidationModal() {
        const state = appState.chronogramImport;
        if (!state || !state.validationQueue) return '';
        const queue = state.validationQueue;
        const idx = state.validationIndex || 0;
        if (idx >= queue.length) {
          // All items reviewed
          return `
            <div class="modal-backdrop" data-action="chronogram-cancel">
              <div class="modal-box chronogram-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                  <h3>${tt('Validation complete', 'Validation terminée')}</h3>
                  <button class="btn btn-secondary" data-action="chronogram-cancel">✕</button>
                </div>
                <div class="chronogram-modal-body">
                  <p>${tt(
                    `${state.acceptedCount || 0} items accepted, ${state.skippedCount || 0} items skipped.`,
                    `${state.acceptedCount || 0} éléments acceptés, ${state.skippedCount || 0} éléments ignorés.`
                  )}</p>
                </div>
                <div class="chronogram-modal-footer">
                  <button class="btn btn-primary" data-action="chronogram-finish-validation">${tt('Finish import', 'Terminer l\'import')}</button>
                </div>
              </div>
            </div>
          `;
        }

        const item = queue[idx];
        const isActor = item._type === 'actor';
        const channelColor = !isActor ? (CHANNEL_META[item.channel]?.color || '#888') : '#666';

        return `
          <div class="modal-backdrop">
            <div class="modal-box chronogram-modal" onclick="event.stopPropagation()">
              <div class="modal-header">
                <h3>${tt('Review item', 'Valider l\'élément')} ${idx + 1}/${queue.length}</h3>
              </div>
              <div class="chronogram-modal-body">
                <div class="chronogram-progress-bar-container">
                  <div class="chronogram-progress-bar" style="width: ${Math.round(((idx + 1) / queue.length) * 100)}%"></div>
                </div>

                ${isActor ? `
                  <div class="chronogram-validation-card">
                    <span class="pill" style="background:#666; color:#fff; font-size:0.75rem; padding:2px 8px; border-radius:8px;">${tt('Actor', 'Acteur')}</span>
                    <h4>${escapeHtml(item.name)}</h4>
                    <div class="chronogram-info-grid">
                      <div><strong>${tt('Role', 'Rôle')} :</strong> ${escapeHtml(item.role || '')}</div>
                      <div><strong>${tt('Organization', 'Organisation')} :</strong> ${escapeHtml(item.organization || '')}</div>
                      <div><strong>${tt('Title', 'Titre')} :</strong> ${escapeHtml(item.title || '')}</div>
                    </div>
                  </div>
                ` : `
                  <div class="chronogram-validation-card">
                    <span class="pill" style="background:${channelColor}; color:#fff; font-size:0.75rem; padding:2px 8px; border-radius:8px;">${channelLabel(item.channel)}</span>
                    ${item.is_implicit ? `<span class="pill" style="background:#f59e0b; color:#fff; font-size:0.75rem; padding:2px 8px; border-radius:8px;">${tt('Implicit', 'Implicite')}</span>` : ''}
                    <h4>${escapeHtml(item.generation_prompt || item.fields?.subject || item.fields?.headline || '...')}</h4>
                    <div class="chronogram-info-grid">
                      <div><strong>H+${item.timestamp_offset_minutes || 0}</strong></div>
                      <div><strong>${tt('From', 'De')} :</strong> ${escapeHtml(item.fields?.from_name || item.fields?.display_name || item.fields?.author_name || '?')}</div>
                      ${item.fields?.to ? `<div><strong>${tt('To', 'À')} :</strong> ${escapeHtml(item.fields.to)}</div>` : ''}
                    </div>
                    ${item.fields?.body ? `<div class="chronogram-content-preview">${escapeHtml((item.fields.body || '').slice(0, 300))}${(item.fields.body || '').length > 300 ? '...' : ''}</div>` : ''}
                    ${item.fields?.text ? `<div class="chronogram-content-preview">${escapeHtml((item.fields.text || '').slice(0, 300))}</div>` : ''}
                  </div>
                `}
              </div>
              <div class="chronogram-modal-footer">
                <button class="btn btn-secondary" data-action="chronogram-skip-item">${tt('Skip', 'Ignorer')}</button>
                <button class="btn btn-primary" data-action="chronogram-accept-item">${tt('Accept', 'Accepter')}</button>
              </div>
            </div>
          </div>
        `;
      }

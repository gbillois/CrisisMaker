      // ─── Crisis Checker Module ─────────────────────────────────────────────────
      // Autonomous view for importing and analyzing crisis exercise chronograms.
      // Phase 1: File import, parsing, column detection, preview
      // Phase 2: LLM analysis + results display
      // Phase 3: Checklist + export

      // ─── Column detection patterns (FR + EN) ─────────────────────────────────────
      const CHECKER_COLUMN_PATTERNS = {
        timestamp: [/^h\+/i, /horodatage/i, /heure/i, /time/i, /timestamp/i, /horaire/i, /^t\+/i, /^t$/i, /^h$/i],
        phase:     [/phase/i, /[eé]tape/i, /step/i, /^stade/i],
        sender:    [/[eé]metteur/i, /sender/i, /^from$/i, /source/i, /exp[eé]diteur/i, /envoy/i],
        recipient: [/destinataire/i, /recipient/i, /^to$/i, /target/i, /cellule/i, /cible/i],
        channel:   [/canal/i, /channel/i, /medium/i, /vecteur/i, /moyen/i, /support/i, /^type\s*de\s*com/i],
        content:   [/contenu/i, /description/i, /content/i, /texte/i, /message/i, /libell[eé]/i, /d[eé]tail/i, /objet/i],
        type:      [/^type$/i, /nature/i, /cat[eé]gorie/i, /category/i],
        conditional: [/conditionnel/i, /conditional/i, /^if$/i, /branch/i, /condition/i],
        theme:     [/th[eè]me/i, /theme/i, /dimension/i, /domaine/i, /domain/i]
      };

      const CHECKER_COLUMN_LABELS = {
        timestamp:   () => tt('Timestamp', 'Horodatage'),
        phase:       () => tt('Phase', 'Phase'),
        sender:      () => tt('Sender', 'Émetteur'),
        recipient:   () => tt('Recipient', 'Destinataire'),
        channel:     () => tt('Channel', 'Canal'),
        content:     () => tt('Content', 'Contenu'),
        type:        () => tt('Type', 'Type'),
        conditional: () => tt('Conditional', 'Conditionnel'),
        theme:       () => tt('Theme', 'Thème')
      };

      const CHECKER_SHEET_PATTERNS = [/chrono/i, /timeline/i, /stimuli/i, /inject/i];

      // ─── File parsing ─────────────────────────────────────────────────────────────

      async function checkerParseFile(file) {
        const name = file.name.toLowerCase();
        if (/\.xlsx?$/.test(name)) {
          return await checkerParseExcel(file);
        } else if (/\.pptx$/.test(name)) {
          return await checkerParsePptx(file);
        }
        throw new Error(tt(
          'Unsupported file format. Please upload .xlsx, .xls, or .pptx',
          'Format de fichier non supporté. Veuillez importer un fichier .xlsx, .xls ou .pptx'
        ));
      }

      async function checkerParseExcel(file) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        if (!sheetNames.length) {
          throw new Error(tt(
            'Could not parse the file. Please check the file format and content.',
            'Impossible de lire le fichier. Vérifiez le format et le contenu.'
          ));
        }

        // Auto-select best sheet
        let selectedSheet = sheetNames[0];
        for (const name of sheetNames) {
          if (CHECKER_SHEET_PATTERNS.some(p => p.test(name))) {
            selectedSheet = name;
            break;
          }
        }

        const sheetData = checkerReadSheet(workbook, selectedSheet);
        return {
          sheets: sheetNames,
          selectedSheet,
          headers: sheetData.headers,
          rows: sheetData.rows,
          workbook
        };
      }

      function checkerReadSheet(workbook, sheetName) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return { headers: [], rows: [] };
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
        if (!raw.length) return { headers: [], rows: [] };
        const headers = raw[0].map(h => String(h).trim());
        const rows = raw.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
        return { headers, rows };
      }

      async function checkerParsePptx(file) {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        // Find slide XML files
        const slideFiles = [];
        zip.forEach((path, entry) => {
          if (/^ppt\/slides\/slide\d+\.xml$/i.test(path)) {
            slideFiles.push({ path, entry });
          }
        });

        // Sort slides by number
        slideFiles.sort((a, b) => {
          const numA = parseInt(a.path.match(/slide(\d+)/)[1]);
          const numB = parseInt(b.path.match(/slide(\d+)/)[1]);
          return numA - numB;
        });

        const allTextRows = [];
        for (const { entry } of slideFiles) {
          const xml = await entry.async('string');
          const slideTexts = checkerExtractPptxText(xml);
          if (slideTexts.length) {
            allTextRows.push(slideTexts);
          }
        }

        // Try to reconstruct a tabular structure from slide texts
        // Each slide becomes one or more rows; each text element becomes a cell
        if (!allTextRows.length) {
          throw new Error(tt(
            'Could not parse the file. Please check the file format and content.',
            'Impossible de lire le fichier. Vérifiez le format et le contenu.'
          ));
        }

        // Find the max number of columns across all slides
        const maxCols = Math.max(...allTextRows.map(r => r.length));

        // Use first slide texts as potential headers if they look like headers
        const firstSlide = allTextRows[0];
        const headers = firstSlide.length >= 3
          ? firstSlide.map(h => String(h).trim())
          : Array.from({ length: maxCols }, (_, i) => `${tt('Column', 'Colonne')} ${String.fromCharCode(65 + i)}`);

        const rows = (firstSlide.length >= 3 ? allTextRows.slice(1) : allTextRows)
          .map(r => {
            // Pad short rows
            while (r.length < maxCols) r.push('');
            return r;
          });

        return {
          sheets: [tt('All slides', 'Toutes les slides')],
          selectedSheet: tt('All slides', 'Toutes les slides'),
          headers,
          rows,
          workbook: null,
          isPptx: true
        };
      }

      function checkerExtractPptxText(xmlString) {
        // Extract text from PowerPoint XML slide
        // Text is in <a:t> tags, grouped by <a:p> (paragraphs) within <p:sp> (shapes)
        const texts = [];
        const shapeRegex = /<p:sp\b[^>]*>[\s\S]*?<\/p:sp>/g;
        let shapeMatch;
        while ((shapeMatch = shapeRegex.exec(xmlString)) !== null) {
          const shape = shapeMatch[0];
          // Extract all text runs in this shape
          const textParts = [];
          const tRegex = /<a:t>([^<]*)<\/a:t>/g;
          let tMatch;
          while ((tMatch = tRegex.exec(shape)) !== null) {
            textParts.push(tMatch[1]);
          }
          const combined = textParts.join(' ').trim();
          if (combined) texts.push(combined);
        }
        return texts;
      }

      // ─── Column auto-detection ────────────────────────────────────────────────────

      function checkerAutoDetectColumns(headers) {
        const mapping = {};
        const usedIndices = new Set();

        for (const [colKey, patterns] of Object.entries(CHECKER_COLUMN_PATTERNS)) {
          mapping[colKey] = null;
          for (let i = 0; i < headers.length; i++) {
            if (usedIndices.has(i)) continue;
            const header = String(headers[i]).trim();
            if (!header) continue;
            if (patterns.some(p => p.test(header))) {
              mapping[colKey] = i;
              usedIndices.add(i);
              break;
            }
          }
        }

        return mapping;
      }

      // ─── LLM-based column detection ───────────────────────────────────────────────

      async function checkerAutoDetectColumnsLLM(headers, rows) {
        const colKeys = Object.keys(CHECKER_COLUMN_PATTERNS);
        const colDescriptions = {
          timestamp:   'Date/time offset of the inject (e.g. H+00:30, T+2h, heure)',
          phase:       'Exercise phase or stage name',
          sender:      'Who sends the stimulus (actor, entity, organization)',
          recipient:   'Who receives the stimulus (target cell, team, player)',
          channel:     'Communication channel (email, phone, SMS, press, social media, etc.)',
          content:     'Main content, text, or description of the stimulus',
          type:        'Type or category of the stimulus (e.g. inject, nudge, event)',
          conditional: 'Whether the stimulus is conditional or branching (optional/if)',
          theme:       'Theme, dimension, or domain of the stimulus'
        };

        const headerList = headers.map((h, i) => `[${i}] ${h}`).join('\n');
        const sampleRows = rows.slice(0, 5).map((row, ri) => {
          const cells = headers.map((_, ci) => String(row[ci] || '').trim().substring(0, 80));
          return `Row ${ri + 1}: ${cells.join(' | ')}`;
        }).join('\n');

        const roleDescriptions = colKeys.map(k => `- "${k}": ${colDescriptions[k]}`).join('\n');

        const systemPrompt = `You are an expert in crisis exercise chronograms (also called "chronogrammes d'exercice de crise" in French).
Your task is to map spreadsheet column headers to specific semantic roles used in crisis exercises.

Semantic roles to identify:
${roleDescriptions}

Rules:
- Each column index can be assigned to at most ONE role
- If no column clearly matches a role, set it to null
- Use 0-based integer column indices
- Respond ONLY with a valid JSON object, no explanation or markdown

Response format (strict JSON):
{"timestamp": <index|null>, "phase": <index|null>, "sender": <index|null>, "recipient": <index|null>, "channel": <index|null>, "content": <index|null>, "type": <index|null>, "conditional": <index|null>, "theme": <index|null>}`;

        const userPrompt = `COLUMN HEADERS:\n${headerList}\n\nSAMPLE DATA (first rows):\n${sampleRows}`;

        const result = await AITextGenerator.generate('checker_column_mapping', systemPrompt, userPrompt, true, 500);

        // Validate result: ensure indices are in range and not duplicated
        const mapping = {};
        const usedIndices = new Set();
        for (const key of colKeys) {
          const val = result[key];
          if (val !== null && val !== undefined && Number.isInteger(val) && val >= 0 && val < headers.length && !usedIndices.has(val)) {
            mapping[key] = val;
            usedIndices.add(val);
          } else {
            mapping[key] = null;
          }
        }
        return mapping;
      }

      // ─── Column letter helper ─────────────────────────────────────────────────────

      function checkerColLetter(index) {
        return String.fromCharCode(65 + (index % 26));
      }

      // ─── Render: Main Checker View ────────────────────────────────────────────────

      function renderCheckerView() {
        const cs = appState.checkerState;
        const mode = cs.mode || 'file';
        const hasData = mode === 'scenario'
          ? (appState.scenario.stimuli || []).length > 0
          : !!cs.parsedData;

        return `
          <section class="grid" style="max-width:960px; margin: 0 auto;">
            ${renderCheckerModeSelector()}
            ${mode === 'scenario'
              ? renderCheckerScenarioSummary()
              : (cs.parsedData ? renderCheckerImported() : renderCheckerDropZone())}
            ${hasData ? renderCheckerAnalyzeButton() : ''}
            ${renderCheckerResults()}
            ${renderCheckerChecklist()}
          </section>
        `;
      }

      // ─── Render: Mode Selector ────────────────────────────────────────────────────

      function renderCheckerModeSelector() {
        const cs = appState.checkerState;
        const mode = cs.mode || 'file';
        const stimuliCount = (appState.scenario.stimuli || []).length;

        return `
          <article class="card" style="padding:12px 16px;">
            <div class="checker-mode-selector">
              <button class="checker-mode-btn ${mode === 'scenario' ? 'active' : ''}"
                      data-action="checker-set-mode" data-mode="scenario">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>
                <span>
                  <span class="checker-mode-btn-title">${tt('Current Scenario', 'Scénario actuel')}</span>
                  <span class="checker-mode-btn-sub">${stimuliCount
                    ? tt(`${stimuliCount} stimuli loaded`, `${stimuliCount} stimuli chargés`)
                    : tt('No stimuli yet', 'Aucun stimulus pour l\'instant')}</span>
                </span>
              </button>
              <button class="checker-mode-btn ${mode === 'file' ? 'active' : ''}"
                      data-action="checker-set-mode" data-mode="file">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>
                  <span class="checker-mode-btn-title">${tt('Upload Timeline File', 'Importer un fichier timeline')}</span>
                  <span class="checker-mode-btn-sub">${tt('.xlsx, .xls, .pptx', '.xlsx, .xls, .pptx')}</span>
                </span>
              </button>
            </div>
          </article>
        `;
      }

      // ─── Render: Current Scenario Summary ────────────────────────────────────────

      function renderCheckerScenarioSummary() {
        const sc = appState.scenario;
        const stimuli = [...(sc.stimuli || [])].sort((a, b) =>
          (a.timestamp_offset_minutes || 0) - (b.timestamp_offset_minutes || 0));
        const actors = sc.actors || [];

        if (!stimuli.length) {
          return `
            <article class="card">
              <div style="text-align:center; padding:28px 0;">
                <p style="color:var(--muted); font-size:0.9rem;">${tt(
                  'No stimuli in the current scenario. Add stimuli in the Timeline tab first.',
                  'Aucun stimulus dans le scénario actuel. Ajoutez des stimuli dans l\'onglet Chronogramme d\'abord.'
                )}</p>
              </div>
            </article>
          `;
        }

        const actorMap = {};
        actors.forEach(a => { actorMap[a.id] = a; });

        const channels = [...new Set(stimuli.map(s => s.channel))];
        const maxOffset = Math.max(...stimuli.map(s => s.timestamp_offset_minutes || 0));
        const durationH = (maxOffset / 60).toFixed(1).replace(/\.0$/, '');

        const maxPreview = 8;
        const previewStimuli = stimuli.slice(0, maxPreview);

        return `
          <article class="card">
            <div class="section-header" style="margin-bottom:14px;">
              <div>
                <h3 style="margin:0 0 4px;">${escapeHtml(sc.name || tt('Untitled Scenario', 'Scénario sans titre'))}</h3>
                ${sc.scenario.type ? `<span class="badge badge-outline" style="font-size:0.8rem;">${escapeHtml(sc.scenario.type)}</span>` : ''}
              </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">
              <span class="checker-stat-pill"><strong>${stimuli.length}</strong>&nbsp;${tt('stimuli', 'stimuli')}</span>
              <span class="checker-stat-pill"><strong>${actors.length}</strong>&nbsp;${tt('actors', 'acteurs')}</span>
              <span class="checker-stat-pill"><strong>${channels.length}</strong>&nbsp;${tt('channels', 'canaux')}</span>
              <span class="checker-stat-pill"><strong>${durationH}h</strong>&nbsp;${tt('duration', 'durée')}</span>
            </div>
            ${sc.scenario.summary ? `<p style="font-size:0.88rem; color:var(--muted); margin:0 0 14px;">${escapeHtml(sc.scenario.summary)}</p>` : ''}
            <div class="checker-preview-table-wrap">
              <table class="checker-preview-table">
                <thead><tr>
                  <th class="checker-row-num">#</th>
                  <th>${tt('Time', 'Heure')}</th>
                  <th>${tt('Channel', 'Canal')}</th>
                  <th>${tt('Actor', 'Acteur')}</th>
                  <th>${tt('Content', 'Contenu')}</th>
                </tr></thead>
                <tbody>
                  ${previewStimuli.map((s, i) => {
                    const actor = actorMap[s.actor_id];
                    const mins = s.timestamp_offset_minutes || 0;
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    const tLabel = `H+${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
                    const content = s.name
                      || s.fields?.subject || s.fields?.headline
                      || s.fields?.breaking_headline || s.fields?.tweet_text
                      || s.fields?.post_text || s.fields?.content_text || '—';
                    return `<tr>
                      <td class="checker-row-num">${i + 1}</td>
                      <td><code style="font-size:0.8rem;">${escapeHtml(tLabel)}</code></td>
                      <td>${escapeHtml(channelLabel(s.channel))}</td>
                      <td>${actor ? escapeHtml(actor.name) : '—'}</td>
                      <td title="${escapeAttribute(String(content))}">${escapeHtml(String(content).substring(0, 80))}${String(content).length > 80 ? '…' : ''}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
              ${stimuli.length > maxPreview ? `<p style="text-align:center; margin-top:8px; font-size:0.82rem; color:var(--muted);">${tt(`Showing ${maxPreview} of ${stimuli.length} stimuli`, `Affichage de ${maxPreview} sur ${stimuli.length} stimuli`)}</p>` : ''}
            </div>
          </article>
        `;
      }

      // ─── Render: Drop Zone ────────────────────────────────────────────────────────

      function renderCheckerDropZone() {
        return `
          <article class="card">
            <div class="checker-dropzone" id="checker-dropzone">
              <div class="checker-dropzone-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="12"></line><line x1="15" y1="15" x2="12" y2="12"></line></svg>
              </div>
              <p class="checker-dropzone-title">${tt('Drop your chronogram file here', 'Déposez votre fichier chronogramme ici')}</p>
              <p class="checker-dropzone-sub">${tt('or click to browse', 'ou cliquez pour parcourir')}</p>
              <p class="checker-dropzone-formats">${tt('Supported: .xlsx, .xls, .pptx', 'Formats acceptés : .xlsx, .xls, .pptx')}</p>
              <input type="file" id="checker-file-input" accept=".xlsx,.xls,.pptx" style="display:none;">
            </div>
            ${appState.checkerState._fileError ? `<p class="checker-error-msg">${escapeHtml(appState.checkerState._fileError)}</p>` : ''}
          </article>
        `;
      }

      // ─── Render: Imported file view (preview + mapping) ───────────────────────────

      function renderCheckerImported() {
        const cs = appState.checkerState;
        const pd = cs.parsedData;
        return `
          <article class="card">
            <div class="section-header" style="margin-bottom:16px;">
              <h3>${escapeHtml(cs.file.name)} <span class="subtle" style="font-weight:normal; font-size:0.85rem;">(${pd.rows.length} ${tt('rows', 'lignes')})</span></h3>
              <div class="actions">
                <button class="btn btn-secondary" data-action="checker-clear-file">${tt('Clear', 'Effacer')} ✕</button>
              </div>
            </div>
            ${renderCheckerSheetSelector()}
            ${renderCheckerPreviewTable()}
            ${renderCheckerColumnMapping()}
          </article>
        `;
      }

      // ─── Render: Sheet selector (for multi-sheet Excel) ───────────────────────────

      function renderCheckerSheetSelector() {
        const cs = appState.checkerState;
        if (!cs.sheets || cs.sheets.length <= 1) return '';
        return `
          <div class="checker-sheet-tabs">
            ${cs.sheets.map(name => `
              <button class="checker-sheet-tab ${name === cs.selectedSheet ? 'active' : ''}"
                      data-action="checker-select-sheet" data-sheet-name="${escapeAttribute(name)}">
                ${escapeHtml(name)}
              </button>
            `).join('')}
          </div>
        `;
      }

      // ─── Render: Data preview table ───────────────────────────────────────────────

      function renderCheckerPreviewTable() {
        const cs = appState.checkerState;
        const pd = cs.parsedData;
        if (!pd || !pd.headers.length) {
          return `<p class="subtle">${tt('No data found in this sheet.', 'Aucune donnée trouvée dans cet onglet.')}</p>`;
        }

        const maxVisibleRows = 20;
        const displayRows = pd.rows.slice(0, maxVisibleRows);
        const hasMore = pd.rows.length > maxVisibleRows;

        return `
          <div class="checker-preview-table-wrap">
            <table class="checker-preview-table">
              <thead>
                <tr>
                  <th class="checker-row-num">#</th>
                  ${pd.headers.map((h, i) => `<th title="${escapeAttribute(h)}">${escapeHtml(h || `${checkerColLetter(i)}`)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${displayRows.map((row, ri) => `
                  <tr>
                    <td class="checker-row-num">${ri + 1}</td>
                    ${pd.headers.map((_, ci) => `<td title="${escapeAttribute(String(row[ci] || ''))}">${escapeHtml(String(row[ci] || '').substring(0, 120))}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${hasMore ? `<p class="subtle" style="text-align:center; margin-top:8px; font-size:0.82rem;">${tt(`Showing ${maxVisibleRows} of ${pd.rows.length} rows. Scroll to see more.`, `Affichage de ${maxVisibleRows} sur ${pd.rows.length} lignes. Faites défiler pour voir plus.`)}</p>` : ''}
          </div>
        `;
      }

      // ─── Render: Column mapping ───────────────────────────────────────────────────

      function renderCheckerColumnMapping() {
        const cs = appState.checkerState;
        const pd = cs.parsedData;
        const mapping = cs.columnMapping;
        if (!pd || !pd.headers.length) return '';

        const notDetected = tt('— Not detected —', '— Non détecté —');
        const hasMissing = Object.values(mapping).some(v => v === null);
        const isLoading = cs.columnMappingLoading;

        return `
          <div class="checker-mapping">
            <h4>
              ${tt('Column Mapping', 'Correspondance des colonnes')}
              ${isLoading ? `<span class="checker-mapping-ai-badge"><span class="checker-mapping-spinner"></span>${tt('AI detecting…', 'Détection IA en cours…')}</span>` : ''}
            </h4>
            <div class="checker-mapping-grid${isLoading ? ' checker-mapping-loading' : ''}">
              ${Object.keys(CHECKER_COLUMN_PATTERNS).map(colKey => {
                const val = mapping[colKey];
                const label = CHECKER_COLUMN_LABELS[colKey]();
                const isMissing = val === null;
                return `
                  <div class="checker-mapping-row">
                    <label>${label}:</label>
                    <select data-action="checker-update-mapping" data-col-key="${colKey}"${isLoading ? ' disabled' : ''}>
                      <option value="-1" ${isMissing ? 'selected' : ''}>${notDetected}</option>
                      ${pd.headers.map((h, i) => `<option value="${i}" ${val === i ? 'selected' : ''}>${tt('Column', 'Colonne')} ${checkerColLetter(i)} — "${escapeHtml(h)}"</option>`).join('')}
                    </select>
                    ${isMissing && !isLoading ? '<span class="checker-mapping-warn" title="' + escapeAttribute(tt('Not detected', 'Non détecté')) + '">⚠</span>' : ''}
                  </div>
                `;
              }).join('')}
            </div>
            ${hasMissing && !isLoading ? `<p class="checker-mapping-note">${tt('⚠ Missing columns will be flagged in the analysis.', '⚠ Les colonnes manquantes seront signalées dans l\'analyse.')}</p>` : ''}
            ${!isLoading ? `<p class="checker-mapping-hint">${tt('You can adjust the mapping manually using the dropdowns above.', 'Vous pouvez ajuster la correspondance manuellement via les menus ci-dessus.')}</p>` : ''}
          </div>
        `;
      }

      // ─── Event binding for checker (called from bindGlobalEvents) ─────────────────

      function bindCheckerEvents() {
        const dropzone = document.getElementById('checker-dropzone');
        const fileInput = document.getElementById('checker-file-input');
        if (dropzone) {
          dropzone.addEventListener('click', () => fileInput && fileInput.click());
          dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
          });
          dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
          });
          dropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) await checkerHandleFile(file);
          });
        }
        if (fileInput) {
          fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) await checkerHandleFile(file);
          });
        }

        // Column mapping dropdowns
        document.querySelectorAll('select[data-action="checker-update-mapping"]').forEach(sel => {
          sel.addEventListener('change', () => {
            const colKey = sel.dataset.colKey;
            const val = parseInt(sel.value, 10);
            appState.checkerState.columnMapping[colKey] = val === -1 ? null : val;
            App.render();
          });
        });

        // Sheet selector
        document.querySelectorAll('[data-action="checker-select-sheet"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const sheetName = btn.dataset.sheetName;
            checkerSwitchSheet(sheetName);
          });
        });

        // Checklist events
        bindCheckerChecklistEvents();
      }

      // ─── File handling ────────────────────────────────────────────────────────────

      async function checkerHandleFile(file) {
        const name = file.name.toLowerCase();
        if (!/\.(xlsx?|pptx)$/.test(name)) {
          appState.checkerState._fileError = tt(
            'Unsupported file format. Please upload .xlsx, .xls, or .pptx',
            'Format de fichier non supporté. Veuillez importer un fichier .xlsx, .xls ou .pptx'
          );
          App.render();
          return;
        }

        try {
          appState.checkerState._fileError = null;
          const result = await checkerParseFile(file);

          appState.checkerState.file = { name: file.name, size: file.size, type: file.type };
          appState.checkerState.parsedData = { headers: result.headers, rows: result.rows, workbook: result.workbook, isPptx: !!result.isPptx };
          appState.checkerState.sheets = result.sheets;
          appState.checkerState.selectedSheet = result.selectedSheet;
          appState.checkerState.columnMapping = checkerAutoDetectColumns(result.headers);
          appState.checkerState.columnMappingLoading = false;
          appState.checkerState.analysisResult = null;
          appState.checkerState.analysisError = null;
          appState.checkerState.checklist = {};

          // Load persisted checklist for this file
          checkerLoadChecklist();

          if (isLLMAvailable()) {
            appState.checkerState.columnMappingLoading = true;
            App.render();
            pushToast(tt(`File loaded: ${file.name}`, `Fichier chargé : ${file.name}`), 'success');
            try {
              const llmMapping = await checkerAutoDetectColumnsLLM(result.headers, result.rows);
              appState.checkerState.columnMapping = llmMapping;
            } catch (_llmErr) {
              // Keep regex fallback silently
            }
            appState.checkerState.columnMappingLoading = false;
            App.render();
          } else {
            App.render();
            pushToast(tt(`File loaded: ${file.name}`, `Fichier chargé : ${file.name}`), 'success');
          }
        } catch (err) {
          appState.checkerState._fileError = err.message;
          App.render();
        }
      }

      function checkerSwitchSheet(sheetName) {
        const cs = appState.checkerState;
        if (!cs.parsedData || !cs.parsedData.workbook) return;
        const sheetData = checkerReadSheet(cs.parsedData.workbook, sheetName);
        cs.selectedSheet = sheetName;
        cs.parsedData.headers = sheetData.headers;
        cs.parsedData.rows = sheetData.rows;
        cs.columnMapping = checkerAutoDetectColumns(sheetData.headers);
        cs.columnMappingLoading = false;
        cs.analysisResult = null;
        cs.analysisError = null;

        if (isLLMAvailable()) {
          cs.columnMappingLoading = true;
          App.render();
          checkerAutoDetectColumnsLLM(sheetData.headers, sheetData.rows)
            .then(llmMapping => { appState.checkerState.columnMapping = llmMapping; })
            .catch(() => { /* Keep regex fallback silently */ })
            .finally(() => {
              appState.checkerState.columnMappingLoading = false;
              App.render();
            });
        } else {
          App.render();
        }
      }

      function checkerClearFile() {
        const currentMode = appState.checkerState.mode || 'file';
        appState.checkerState = {
          mode: currentMode,
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
        };
        App.render();
      }

      // ─── Render: Analyze button ─────────────────────────────────────────────────

      function renderCheckerAnalyzeButton() {
        const cs = appState.checkerState;
        if (cs.analysisResult || cs.analysisLoading) return '';
        const llmOk = isLLMAvailable();
        const tooltip = !llmOk ? escapeAttribute(tt('Configure an API key in Settings to use this feature.', 'Configurez une clé API dans les Paramètres pour utiliser cette fonctionnalité.')) : '';
        return `
          <div style="text-align:center; margin: 8px 0;">
            ${!llmOk ? `<span title="${tooltip}" style="display:inline-block; cursor:not-allowed;">` : ''}
            <button class="btn btn-primary" data-action="checker-analyze"
                    ${!llmOk ? 'disabled style="pointer-events:none;"' : ''}>
              ${tt('Analyze Chronogram', 'Analyser le chronogramme')}
            </button>
            ${!llmOk ? '</span>' : ''}
          </div>
        `;
      }

      // ─── LLM Log Renderer (checker) ──────────────────────────────────────────────

      function renderCheckerLLMLogs(logs) {
        if (!logs || logs.length === 0) {
          return `<div class="llm-stream-empty">${tt('Waiting for LLM response\u2026', 'En attente de la réponse LLM\u2026')}</div>`;
        }
        return logs.map(entry => {
          const isStreaming = entry.status === 'streaming';
          const isError = entry.status === 'error';
          const responseDisplay = entry.responseText
            ? (entry.responseText.length > 3000 ? '\u2026' + entry.responseText.slice(-3000) : entry.responseText)
            : '';
          const cursor = isStreaming ? '<span class="llm-stream-cursor"></span>' : '';
          const assistantCls = isError ? 'error' : 'assistant';
          const assistantLabel = isError
            ? tt('Error', 'Erreur')
            : (isStreaming ? tt('Assistant (streaming\u2026)', 'Assistant (streaming\u2026)') : tt('Assistant', 'Assistant'));
          return `
            <div class="llm-log-entry">
              <div class="llm-role-label">\uD83E\uDDD1 ${escapeHtml(entry.stepLabel)}</div>
              <div class="llm-bubble user">${escapeHtml((entry.userPromptPreview || '').slice(0, 400))}${(entry.userPromptPreview || '').length >= 400 ? '\u2026' : ''}</div>
              <div class="llm-role-label">\uD83E\uDD16 ${assistantLabel}</div>
              <div class="llm-bubble ${assistantCls}">${escapeHtml(responseDisplay)}${cursor}</div>
            </div>`;
        }).join('');
      }

      // ─── Phase 2: LLM Analysis ───────────────────────────────────────────────────

      // ─── Serialization ────────────────────────────────────────────────────────────

      function checkerSerializeScenario() {
        const sc = appState.scenario;
        const stimuli = [...(sc.stimuli || [])].sort((a, b) =>
          (a.timestamp_offset_minutes || 0) - (b.timestamp_offset_minutes || 0));
        const actors = sc.actors || [];
        if (!stimuli.length) return null;

        const actorMap = {};
        actors.forEach(a => { actorMap[a.id] = a; });

        const maxOffset = Math.max(...stimuli.map(s => s.timestamp_offset_minutes || 0));
        const phaseCount = Math.max(2, Math.min(5, Math.ceil(maxOffset / 120)));
        const phaseSize = maxOffset > 0 ? maxOffset / phaseCount : 60;

        const getPhase = (mins) => {
          if (maxOffset === 0) return 'Phase 1';
          return `Phase ${Math.min(phaseCount, Math.floor(mins / phaseSize) + 1)}`;
        };

        const colKeys = ['timestamp', 'phase', 'sender', 'channel', 'content', 'type'];
        const header = 'LINE | ' + colKeys.map(k => CHECKER_COLUMN_LABELS[k]().toUpperCase()).join(' | ');
        const lines = [header];

        stimuli.forEach((s, i) => {
          const mins = s.timestamp_offset_minutes || 0;
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          const timestamp = `H+${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
          const phase = getPhase(mins);
          const actor = actorMap[s.actor_id];
          const sender = actor
            ? `${actor.name} (${roleLabel(actor.role)})`
            : (s.source_label || '—');
          const channel = channelLabel(s.channel);
          const content = s.name
            || s.fields?.subject || s.fields?.headline
            || s.fields?.breaking_headline || s.fields?.tweet_text
            || s.fields?.post_text || s.fields?.content_text || '—';
          const type = s.channel || '—';
          lines.push(`${i + 1} | ${[timestamp, phase, sender, channel, String(content).substring(0, 300), type].join(' | ')}`);
        });

        const actorList = actors.map(a =>
          `- ${a.name} (${roleLabel(a.role)}, ${a.organization || ''})`
        ).join('\n');

        const serialized = `SCENARIO: ${sc.name || 'Untitled'}
TYPE: ${sc.scenario?.type || '—'}
CLIENT: ${sc.client?.name || '—'} (${sc.client?.sector || '—'})
CONTEXT: ${sc.scenario?.summary || '—'}
DURATION: H+0 to H+${Math.round(maxOffset / 60)}h (${stimuli.length} stimuli)

ACTORS (${actors.length}):
${actorList || 'None'}

CHRONOGRAM DATA
Total stimuli: ${stimuli.length}

${lines.join('\n')}`;

        const detectedCols = colKeys;
        const missingCols = ['recipient', 'conditional', 'theme'];
        return { serialized, detectedCols, missingCols, truncated: false };
      }

      function checkerSerializeChronogram() {
        const cs = appState.checkerState;
        const pd = cs.parsedData;
        const mapping = cs.columnMapping;
        if (!pd) return '';

        const colKeys = Object.keys(CHECKER_COLUMN_PATTERNS);
        const detectedCols = colKeys.filter(k => mapping[k] !== null);
        const missingCols = colKeys.filter(k => mapping[k] === null);

        let lines = [];
        const headerLine = 'LINE | ' + colKeys.map(k => CHECKER_COLUMN_LABELS[k]().toUpperCase()).join(' | ');
        lines.push(headerLine);

        let truncated = false;
        const maxContentLen = pd.rows.length > 500 ? 150 : 500;
        if (pd.rows.length > 500) truncated = true;

        for (let i = 0; i < pd.rows.length; i++) {
          const row = pd.rows[i];
          const cells = colKeys.map(k => {
            const idx = mapping[k];
            if (idx === null) return '—';
            let val = String(row[idx] || '').trim();
            if (val.length > maxContentLen) val = val.substring(0, maxContentLen) + '…';
            return val;
          });
          lines.push(`${i + 1} | ${cells.join(' | ')}`);
        }

        const serialized = `CHRONOGRAM DATA
Total lines: ${pd.rows.length}
Columns detected: ${detectedCols.map(k => CHECKER_COLUMN_LABELS[k]()).join(', ') || 'none'}
Columns missing: ${missingCols.map(k => CHECKER_COLUMN_LABELS[k]()).join(', ') || 'none'}

${lines.join('\n')}`;

        return { serialized, detectedCols, missingCols, truncated };
      }

      // ─── Analysis prompt ──────────────────────────────────────────────────────────

      function checkerBuildPrompt(serialized, detectedCols, missingCols, concise = false) {
        const detectedStr = detectedCols.map(k => CHECKER_COLUMN_LABELS[k]()).join(', ') || 'none';
        const missingStr = missingCols.map(k => CHECKER_COLUMN_LABELS[k]()).join(', ') || 'none';

        const conciseNote = concise ? '\nSois plus concis dans tes constats. / Be more concise in your findings.\n' : '';

        return `Tu es un expert senior en gestion de crise et en conception d'exercices de crise. On te fournit un chronogramme d'exercice de crise sous forme de tableau. Chaque ligne représente un stimulus ou un événement du scénario.
You are a senior expert in crisis management and crisis exercise design. You are provided with a crisis exercise chronogram in tabular form. Each line represents a stimulus or scenario event.

Les colonnes disponibles sont / Available columns: ${detectedStr}
Les colonnes manquantes sont / Missing columns: ${missingStr}
${conciseNote}
Analyse le chronogramme selon les 5 axes ci-dessous. Pour chaque axe, produis :
1. Un verdict synthétique : satisfactory, acceptable, ou insufficient
2. La liste des constats positifs et négatifs, avec référence aux lignes concernées
3. Des recommandations concrètes pour corriger les défauts identifiés

Analyze the chronogram according to the 5 axes below. For each axis, produce:
1. A synthetic verdict: satisfactory, acceptable, or insufficient
2. The list of positive and negative findings, with reference to the relevant lines
3. Concrete recommendations to fix identified issues

---

AXE 1 : COMPLÉTUDE DE L'EXERCICE / EXERCISE COMPLETENESS

Couverture thématique — les grandes dimensions d'une crise sont-elles représentées ?
Thematic coverage — are the major dimensions of a crisis represented?
- Opérationnel / technique (Operational / technical)
- Communication interne (Internal communication)
- Communication externe (médias, réseaux sociaux) (External communication — media, social media)
- Juridique / réglementaire (notifications, conformité) (Legal / regulatory — notifications, compliance)
- RH / social (impact collaborateurs, partenaires sociaux) (HR / social — employee impact, social partners)
- Continuité d'activité (PCA/PRA, bascule, mode dégradé) (Business continuity — BCP/DRP, failover, degraded mode)
- Relations avec les autorités (régulateur, forces de l'ordre, ANSSI/CERT national) (Relations with authorities — regulator, law enforcement, national CERT)
- Parties prenantes externes (clients, fournisseurs, partenaires) (External stakeholders — clients, suppliers, partners)
- Financier / assurance (Financial / insurance)

Représentation des acteurs — toutes les catégories attendues apparaissent-elles comme émetteurs ou destinataires ?
Actor representation — do all expected categories appear as senders or recipients?
- Direction générale / COMEX (Senior management / COMEX)
- Cellule de crise décisionnelle (Decision-making crisis cell)
- Cellule de crise opérationnelle (Operational crisis cell)
- Communication / relations presse (Communication / press relations)
- Direction juridique (Legal department)
- Métiers directement impactés (Directly impacted business units)
- DSI / équipes techniques / SOC / CERT (IT / technical teams / SOC / CERT)
- Prestataires critiques (Critical service providers)
- Régulateurs / autorités (Regulators / authorities)

Couverture des livrables — le scénario pousse-t-il les joueurs à produire :
Deliverables coverage — does the scenario push players to produce:
- Communiqué de presse ou éléments de langage (Press release or talking points)
- Notification réglementaire (CNIL, ANSSI, autorité sectorielle) (Regulatory notification)
- Point de situation structuré (Structured situation report)
- Décision d'activation PCA/PRA (BCP/DRP activation decision)
- Tenue d'une main courante (Maintaining a log / chronolog)
- Communication interne (Internal communication)

Diversité des canaux — le scénario utilise-t-il une variété de canaux ?
Channel diversity — does the scenario use a variety of channels (email, call, alert, media, social media, messaging)?

---

AXE 2 : COHÉRENCE NARRATIVE / NARRATIVE COHERENCE

Structure en phases — les grandes phases sont-elles présentes et ordonnées logiquement ?
Phase structure — are the main phases present and logically ordered?
- Détection / signaux faibles (Detection / early warning signs)
- Alerte et mobilisation (Alert and mobilization)
- Gestion à chaud / réponse (Hot management / response)
- Stabilisation / reprise de contrôle (Stabilization / recovery)
- Démobilisation / clôture (Demobilization / closure)

Enchaînement causal — chaque événement découle-t-il logiquement du précédent ? (Causal chaining — does each event logically follow from the previous one?)
Progression de la gravité — la montée en puissance est-elle progressive ? (Severity progression — is the escalation gradual?)
Durée — la durée totale est-elle cohérente avec le type de crise simulée ? (Duration — is the total duration consistent with the type of crisis simulated?)
Richesse scénaristique — le scénario comporte-t-il au moins un dilemme décisionnel, un rebondissement, une phase d'incertitude ? (Scenario richness — does the scenario include at least one decision dilemma, a twist, a phase of uncertainty?)
Cohérence factuelle interne — les éléments factuels sont-ils cohérents d'un stimulus à l'autre ? (Internal factual consistency — are factual elements consistent from one stimulus to another?)

---

AXE 3 : COHÉRENCE DES STIMULI / STIMULUS COHERENCE

Complétude des métadonnées — chaque stimulus a-t-il un émetteur, un destinataire, un canal, un horodatage ? (Metadata completeness — does each stimulus have a sender, recipient, channel, timestamp?)
Logique informationnelle / Information logic:
- Un destinataire ne reçoit jamais une information qu'il est censé ignorer à ce stade (A recipient never receives information they are supposed to ignore at this stage)
- Un stimulus de réponse n'arrive pas avant son stimulus déclencheur (A response stimulus does not arrive before its trigger stimulus)
- Les délais de propagation sont réalistes (Propagation delays are realistic)
Cohérence factuelle inter-stimuli — pas de contradiction entre deux stimuli (Inter-stimuli factual consistency — no contradiction between stimuli)
Stimuli conditionnels — les stimuli dépendant d'une décision joueur sont-ils marqués ? (Conditional stimuli — are stimuli depending on player decisions marked?)

---

AXE 4 : RYTHME ET CHARGE PAR CELLULE / PACE AND WORKLOAD PER CELL

Continuité d'engagement — chaque cellule reçoit-elle des stimuli à intervalles suffisants ? Identifier les temps morts > 15 minutes. (Engagement continuity — does each cell receive stimuli at sufficient intervals? Identify gaps > 15 minutes.)
Gestion de la charge — y a-t-il des pics excessifs (> 3 stimuli en 5 min pour une cellule) ? (Workload management — are there excessive peaks?)
Dynamique — le rythme comporte-t-il des accélérations et des respirations ? (Dynamics — does the pace include accelerations and breathers?)
Produire un tableau synthétique : nombre de stimuli par cellule et par phase. (Produce a summary table: number of stimuli per cell and per phase.)

---

AXE 5 : GESTION DES ALÉAS ET FLEXIBILITÉ / CONTINGENCY MANAGEMENT AND FLEXIBILITY

Des injects alternatifs sont-ils prévus si les joueurs prennent une direction inattendue ? (Are alternative injects planned if players take an unexpected direction?)
Un mécanisme de "coup de pouce" existe-t-il si une cellule est bloquée ? (Does a "nudge" mechanism exist if a cell is stuck?)
Des stimuli de recadrage sont-ils prévus pour ramener le jeu sur les rails ? (Are reframing stimuli planned to bring the game back on track?)
Le scénario prévoit-il un mécanisme d'arrêt anticipé ? (Does the scenario provide an early stop mechanism?)

---

FORMAT DE SORTIE / OUTPUT FORMAT

Réponds UNIQUEMENT avec un objet JSON valide / Reply ONLY with a valid JSON object:

{
  "summary": "Synthèse globale en 3-4 phrases / Global summary in 3-4 sentences",
  "maturity": "first_draft | advanced_draft | ready_to_play",
  "axes": [
    {
      "id": 1,
      "title": "Complétude de l'exercice / Exercise Completeness",
      "verdict": "satisfactory | acceptable | insufficient",
      "positive": ["constat positif 1 / positive finding 1", "constat positif 2"],
      "negative": ["constat négatif 1 (lignes X-Y) / negative finding 1 (lines X-Y)", "constat négatif 2"],
      "recommendations": ["recommandation 1 / recommendation 1", "recommandation 2"]
    }
  ],
  "priority_actions": ["action prioritaire 1 / priority action 1", "action prioritaire 2", "action prioritaire 3"],
  "stimuli_per_cell_per_phase": {
    "cell_name_1": {"phase_1": 0, "phase_2": 0},
    "cell_name_2": {"phase_1": 0, "phase_2": 0}
  }
}

${serialized}`;
      }

      // ─── Run analysis ─────────────────────────────────────────────────────────────

      async function checkerRunAnalysis() {
        const cs = appState.checkerState;
        const mode = cs.mode || 'file';
        if (cs.analysisLoading) return;
        if (mode === 'file' && !cs.parsedData) return;
        if (mode === 'scenario' && !(appState.scenario.stimuli || []).length) return;

        cs.analysisLoading = true;
        cs.analysisError = null;
        cs.analysisResult = null;
        cs._rawResponse = null;
        cs.llmLogs = [];
        App.render();

        const stepLabel = tt('Chronogram Analysis', 'Analyse du chronogramme');

        const startLog = (userPromptPreview) => {
          cs.llmLogs.push({ id: Date.now(), stepLabel, userPromptPreview, responseText: '', status: 'streaming' });
          App.render();
        };

        const onChunk = (delta) => {
          const last = cs.llmLogs[cs.llmLogs.length - 1];
          if (last) {
            last.responseText += delta;
            const contentEl = document.getElementById('checker-llm-stream-content');
            if (contentEl) contentEl.innerHTML = renderCheckerLLMLogs(cs.llmLogs);
            const panel = document.getElementById('checker-llm-stream-panel');
            if (panel) panel.scrollTop = panel.scrollHeight;
            const indicatorText = document.getElementById('checker-stream-indicator-text');
            if (indicatorText) {
              const chars = (last.responseText || '').length;
              indicatorText.textContent = `${tt('Receiving LLM response', 'Réception de la réponse LLM')} — ${chars.toLocaleString()} ${tt('chars', 'car.')}`;
            }
          }
        };

        const finishLog = (status) => {
          const last = cs.llmLogs[cs.llmLogs.length - 1];
          if (last) last.status = status;
          App.render();
        };

        try {
          const { serialized, detectedCols, missingCols, truncated } = mode === 'scenario'
            ? checkerSerializeScenario()
            : checkerSerializeChronogram();
          if (truncated) {
            pushToast(tt(
              'Large chronogram detected. Content was summarized for analysis.',
              'Chronogramme volumineux détecté. Le contenu a été résumé pour l\'analyse.'
            ), 'info');
          }

          const prompt = checkerBuildPrompt(serialized, detectedCols, missingCols, false);
          const userPromptPreview = prompt.slice(0, 400);
          let result;
          try {
            startLog(userPromptPreview);
            result = await AITextGenerator.generateStreaming('checker_analysis', prompt, 'Reply in strict JSON.', onChunk, 8000);
            finishLog('done');
          } catch (firstErr) {
            finishLog('error');
            // Retry with lower max_tokens and concise instruction
            const concisePrompt = checkerBuildPrompt(serialized, detectedCols, missingCols, true);
            startLog(concisePrompt.slice(0, 400));
            result = await AITextGenerator.generateStreaming('checker_analysis', concisePrompt, 'Reply in strict JSON.', onChunk, 4096);
            finishLog('done');
          }

          cs.analysisResult = result;
          cs.analysisLoading = false;
          cs.activeAxisTab = 0;
          App.render();
          pushToast(tt('Analysis complete.', 'Analyse terminée.'), 'success');
        } catch (err) {
          finishLog('error');
          cs.analysisLoading = false;
          cs.analysisError = err.message;
          App.render();
        }
      }

      // ─── Render: Results section ──────────────────────────────────────────────────

      function renderCheckerResults() {
        const cs = appState.checkerState;

        if (cs.analysisLoading) {
          const showStream = !!cs.showLLMStream;
          const currentLog = cs.llmLogs && cs.llmLogs.length > 0 ? cs.llmLogs[cs.llmLogs.length - 1] : null;
          const isStreamingNow = currentLog && currentLog.status === 'streaming';
          const streamedChars = isStreamingNow ? (currentLog.responseText || '').length : 0;

          return `
            <article class="card checker-loading">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <strong>${tt('Analyzing…', 'Analyse en cours…')}</strong>
                <button class="btn btn-secondary btn-sm" data-action="checker-toggle-llm-stream">
                  ${showStream ? tt('Hide LLM stream', 'Masquer le flux LLM') : tt('Show LLM stream', 'Afficher le flux LLM')}
                </button>
              </div>
              <div class="${showStream ? 'checker-progress-layout' : ''}">
                <div class="checker-progress-left">
                  <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                    <span class="checker-spinner"></span>
                    <span>${tt('Analyzing chronogram across 5 quality axes', 'Analyse du chronogramme selon 5 axes qualité')}</span>
                  </div>
                  ${isStreamingNow ? `
                  <div class="chronogram-stream-indicator" style="margin-bottom:12px;" id="checker-stream-indicator">
                    <span class="chronogram-stream-dot"></span>
                    <span id="checker-stream-indicator-text">${tt('Receiving LLM response', 'Réception de la réponse LLM')} — ${streamedChars.toLocaleString()} ${tt('chars', 'car.')}</span>
                  </div>` : ''}
                  <div class="subtle" style="font-size:0.85rem;">
                    ⏱ ${tt('This may take 30–60 seconds', 'Cela peut prendre 30 à 60 secondes')}
                  </div>
                </div>
                ${showStream ? `
                <div class="checker-progress-right">
                  <div class="llm-stream-header">💬 ${tt('LLM Live Stream', 'Flux LLM en direct')}</div>
                  <div class="llm-stream-panel" id="checker-llm-stream-panel">
                    <div id="checker-llm-stream-content">${renderCheckerLLMLogs(cs.llmLogs || [])}</div>
                  </div>
                </div>` : ''}
              </div>
            </article>
          `;
        }

        if (cs.analysisError) {
          return `
            <article class="card">
              <div class="checker-error-msg">
                <strong>${tt('Analysis failed', 'Échec de l\'analyse')}</strong>: ${escapeHtml(cs.analysisError)}
              </div>
              <div class="actions" style="margin-top:12px;">
                <button class="btn btn-primary" data-action="checker-analyze">${tt('Retry', 'Réessayer')}</button>
              </div>
              ${cs._rawResponse ? `<details style="margin-top:12px;"><summary>${tt('Raw response', 'Réponse brute')}</summary><pre class="checker-raw-response">${escapeHtml(cs._rawResponse)}</pre></details>` : ''}
            </article>
          `;
        }

        if (!cs.analysisResult) return '';

        const r = cs.analysisResult;
        return `
          <article class="card checker-results">
            <div class="section-header" style="margin-bottom:16px;">
              <h3>${tt('Analysis Results', 'Résultats de l\'analyse')}</h3>
              <div class="actions">
                <button class="btn btn-secondary" data-action="checker-export-report">${tt('Export .md', 'Exporter .md')}</button>
                <button class="btn btn-secondary" data-action="checker-export-report-docx">${tt('Export .docx', 'Exporter .docx')}</button>
                <button class="btn btn-secondary" data-action="checker-analyze">${tt('Re-analyze', 'Ré-analyser')}</button>
              </div>
            </div>

            ${renderCheckerSummary(r)}
            ${renderCheckerPriorityActions(r)}
            ${renderCheckerAxes(r)}
            ${renderCheckerHeatmap(r)}
          </article>
        `;
      }

      // ─── Render: Summary block ────────────────────────────────────────────────────

      function renderCheckerSummary(result) {
        const maturity = result.maturity || 'first_draft';
        const maturityConfig = {
          first_draft:    { label: tt('First Draft', 'Premier brouillon'), cls: 'maturity-red' },
          advanced_draft: { label: tt('Advanced Draft', 'Brouillon avancé'), cls: 'maturity-orange' },
          ready_to_play:  { label: tt('Ready to Play', 'Prêt à jouer'), cls: 'maturity-green' }
        };
        const mc = maturityConfig[maturity] || maturityConfig.first_draft;

        return `
          <div class="checker-summary">
            <div class="checker-maturity-badge ${mc.cls}">${mc.label}</div>
            <p>${escapeHtml(result.summary || '')}</p>
          </div>
        `;
      }

      // ─── Render: Priority actions ─────────────────────────────────────────────────

      function renderCheckerPriorityActions(result) {
        const actions = result.priority_actions;
        if (!actions || !actions.length) return '';
        return `
          <div class="checker-priority-actions">
            <h4>${tt('Priority Actions', 'Actions prioritaires')}</h4>
            <ol>
              ${actions.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
            </ol>
          </div>
        `;
      }

      // ─── Render: Axes tabs + detail ───────────────────────────────────────────────

      function getAxisLabel(axis, i) {
        if (!axis.title) return tt('Axis', 'Axe') + ' ' + (axis.id || (i + 1));
        // Titles from AI are bilingual: "French part / English part"
        const parts = axis.title.split(' / ');
        return isFrenchUI() ? parts[0] : (parts[1] || parts[0]);
      }

      function renderCheckerAxes(result) {
        const axes = result.axes;
        if (!axes || !axes.length) return '';

        const activeIdx = appState.checkerState.activeAxisTab;
        const verdictIcons = {
          satisfactory: '✅',
          acceptable: '⚠️',
          insufficient: '❌'
        };

        return `
          <div class="checker-axes">
            <div class="checker-axes-tabs">
              ${axes.map((axis, i) => `
                <button class="checker-axis-tab ${i === activeIdx ? 'active' : ''} checker-axis-${axis.verdict || 'acceptable'}"
                        data-action="checker-select-axis" data-axis-index="${i}">
                  ${verdictIcons[axis.verdict] || '⚠️'} ${escapeHtml(getAxisLabel(axis, i))}
                </button>
              `).join('')}
            </div>
            ${renderCheckerAxisDetail(axes[activeIdx] || axes[0])}
          </div>
        `;
      }

      function renderCheckerAxisDetail(axis) {
        if (!axis) return '';
        const verdictIcons = { satisfactory: '✅', acceptable: '⚠️', insufficient: '❌' };
        return `
          <div class="checker-axis-detail">
            <h4>${escapeHtml(axis.title || '')} ${verdictIcons[axis.verdict] || ''}</h4>

            ${(axis.positive && axis.positive.length) ? `
              <div class="checker-findings-group">
                ${axis.positive.map(f => `<div class="checker-finding checker-finding-positive"><span class="checker-finding-icon">✓</span> ${escapeHtml(f)}</div>`).join('')}
              </div>
            ` : ''}

            ${(axis.negative && axis.negative.length) ? `
              <div class="checker-findings-group">
                ${axis.negative.map(f => `<div class="checker-finding checker-finding-negative"><span class="checker-finding-icon">✗</span> ${escapeHtml(f)}</div>`).join('')}
              </div>
            ` : ''}

            ${(axis.recommendations && axis.recommendations.length) ? `
              <div class="checker-findings-group">
                <h5>${tt('Recommendations', 'Recommandations')}</h5>
                ${axis.recommendations.map(r => `<div class="checker-finding checker-recommendation"><span class="checker-finding-icon">→</span> ${escapeHtml(r)}</div>`).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }

      // ─── Render: Heatmap (stimuli distribution) ───────────────────────────────────

      function renderCheckerHeatmap(result) {
        const data = result.stimuli_per_cell_per_phase;
        if (!data || !Object.keys(data).length) return '';

        const cells = Object.keys(data);
        const phaseSet = new Set();
        cells.forEach(c => Object.keys(data[c]).forEach(p => phaseSet.add(p)));
        const phases = [...phaseSet];

        return `
          <div class="checker-heatmap-section">
            <h4>${tt('Stimuli Distribution', 'Distribution des stimuli')}</h4>
            <div class="checker-heatmap-wrap">
              <table class="checker-heatmap">
                <thead>
                  <tr>
                    <th>${tt('Cell', 'Cellule')}</th>
                    ${phases.map(p => `<th>${escapeHtml(p)}</th>`).join('')}
                    <th><strong>${tt('Total', 'Total')}</strong></th>
                  </tr>
                </thead>
                <tbody>
                  ${cells.map(cell => {
                    const rowTotal = phases.reduce((sum, p) => sum + (data[cell][p] || 0), 0);
                    return `
                      <tr>
                        <td class="checker-heatmap-cell-name">${escapeHtml(cell)}</td>
                        ${phases.map(p => {
                          const v = data[cell][p] || 0;
                          return `<td class="checker-heatmap-cell" style="background:${checkerHeatmapColor(v)}">${v}</td>`;
                        }).join('')}
                        <td class="checker-heatmap-total"><strong>${rowTotal}</strong></td>
                      </tr>
                    `;
                  }).join('')}
                  <tr class="checker-heatmap-totals-row">
                    <td><strong>${tt('Total', 'Total')}</strong></td>
                    ${phases.map(p => {
                      const colTotal = cells.reduce((sum, c) => sum + (data[c][p] || 0), 0);
                      return `<td class="checker-heatmap-total"><strong>${colTotal}</strong></td>`;
                    }).join('')}
                    <td class="checker-heatmap-total"><strong>${cells.reduce((sum, c) => sum + phases.reduce((s, p) => s + (data[c][p] || 0), 0), 0)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      function checkerHeatmapColor(value) {
        if (value === 0) return '#f0f0f0';
        if (value <= 2) return '#c8e6c9';
        if (value <= 4) return '#66bb6a';
        if (value <= 7) return '#ffa726';
        return '#ef5350';
      }

      // ─── Phase 3: Checklist + Export ──────────────────────────────────────────────

      // ─── Checklist data ───────────────────────────────────────────────────────────

      function checkerGetChecklistCategories() {
        return [
          {
            key: 'playability',
            title: tt('Playability & Operational Feasibility', 'Jouabilité et faisabilité opérationnelle'),
            items: [
              tt('The number of stimuli is compatible with the size of the animation team',
                 'Le nombre de stimuli est compatible avec la taille de l\'équipe d\'animation'),
              tt('Animation roles are clearly assigned (who sends what, who plays which external role)',
                 'Les rôles d\'animation sont clairement répartis (qui envoie quoi, qui joue quel rôle externe)'),
              tt('Supporting materials are ready and consistent (fake articles, fake tweets, fake emails, notification templates)',
                 'Les supports sont prêts et cohérents (faux articles, faux tweets, faux mails, templates de notification)'),
              tt('Required tools are identified and available (room, phones, collaborative tools, chronolog)',
                 'Les outils nécessaires sont identifiés et disponibles (salle, téléphones, outils collaboratifs, main courante)'),
              tt('Instructions for facilitators are sufficiently precise',
                 'Les consignes pour les animateurs/facilitateurs sont suffisamment précises')
            ]
          },
          {
            key: 'observation',
            title: tt('Observation & Evaluation Framework', 'Dispositif d\'observation et d\'évaluation'),
            items: [
              tt('Observers are positioned in each cell',
                 'Des observateurs sont positionnés dans chaque cellule'),
              tt('An observation grid is provided with measurable criteria (reaction time, decision quality, coordination, communication)',
                 'Une grille d\'observation est fournie avec des critères mesurables (temps de réaction, qualité des décisions, coordination, communication)'),
              tt('Mandatory checkpoints (key decisions, expected escalations) are identified',
                 'Les points de passage obligés (décisions clés, escalades attendues) sont identifiés'),
              tt('The after-action review process is planned (hot debrief, cold debrief, questionnaire)',
                 'Le dispositif RETEX est prévu (hot debrief, cold debrief, questionnaire)')
            ]
          },
          {
            key: 'realism',
            title: tt('Realism & Credibility of Materials', 'Réalisme et crédibilité des supports'),
            items: [
              tt('Stimuli are written in a style consistent with their supposed sender',
                 'Les stimuli sont rédigés dans un style cohérent avec leur émetteur supposé'),
              tt('Factual elements (names, dates, figures, geography) are consistent with each other',
                 'Les éléments factuels (noms, dates, chiffres, géographie) sont cohérents entre eux'),
              tt('Fake media/social media content is visually credible',
                 'Les faux contenus médias/réseaux sociaux sont visuellement crédibles'),
              tt('Regulatory or contractual references mentioned are correct',
                 'Les références réglementaires ou contractuelles mentionnées sont correctes')
            ]
          }
        ];
      }

      // ─── Checklist persistence ────────────────────────────────────────────────────

      function checkerChecklistKey() {
        const cs = appState.checkerState;
        const name = cs.file ? cs.file.name : '_default';
        // Simple string hash
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        }
        return `crisis_checker_checklist_${Math.abs(hash)}`;
      }

      function checkerLoadChecklist() {
        try {
          const key = checkerChecklistKey();
          const stored = localStorage.getItem(key);
          if (stored) {
            appState.checkerState.checklist = JSON.parse(stored);
          }
        } catch (e) { /* ignore parse errors */ }
      }

      function checkerSaveChecklist() {
        try {
          const key = checkerChecklistKey();
          localStorage.setItem(key, JSON.stringify(appState.checkerState.checklist));
        } catch (e) { /* ignore quota errors */ }
      }

      // ─── Render: Checklist ────────────────────────────────────────────────────────

      function renderCheckerChecklist() {
        const cs = appState.checkerState;
        const categories = checkerGetChecklistCategories();
        const cl = cs.checklist || {};
        const checked = cl.checked || {};
        const customItems = cl.customItems || {};

        // Count totals
        let totalItems = 0;
        let checkedCount = 0;
        categories.forEach(cat => {
          const customs = customItems[cat.key] || [];
          const allItems = [...cat.items, ...customs];
          totalItems += allItems.length;
          allItems.forEach((_, i) => { if (checked[`${cat.key}_${i}`]) checkedCount++; });
        });

        const pct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
        const allDone = totalItems > 0 && checkedCount === totalItems;

        return `
          <article class="card checker-checklist">
            <div class="section-header" style="margin-bottom:16px;">
              <h3>${tt('Ready to Play Checklist', 'Checklist « Prêt à jouer »')}</h3>
              ${allDone ? `<span class="checker-maturity-badge maturity-green">${tt('Ready to Play', 'Prêt à jouer')} ✅</span>` : ''}
            </div>

            ${categories.map(cat => renderCheckerChecklistCategory(cat, checked, customItems)).join('')}

            <div class="checker-checklist-progress">
              <div class="checker-checklist-progress-bar">
                <div class="checker-checklist-progress-fill" style="width:${pct}%"></div>
              </div>
              <span class="checker-checklist-progress-text">${tt('Progress', 'Progression')} : ${checkedCount} / ${totalItems} ${tt('items checked', 'éléments cochés')}</span>
            </div>
          </article>
        `;
      }

      function renderCheckerChecklistCategory(category, checked, customItems) {
        const customs = customItems[category.key] || [];
        const allItems = [...category.items, ...customs];

        return `
          <div class="checker-checklist-category">
            <h4>${category.title}</h4>
            ${allItems.map((item, i) => {
              const key = `${category.key}_${i}`;
              const isCustom = i >= category.items.length;
              return `
                <label class="checker-checklist-item">
                  <input type="checkbox" ${checked[key] ? 'checked' : ''}
                         data-action="checker-toggle-check" data-check-key="${key}">
                  <span>${escapeHtml(item)}</span>
                  ${isCustom ? `<button class="checker-remove-custom" data-action="checker-remove-custom-item" data-cat-key="${category.key}" data-custom-index="${i - category.items.length}" title="${escapeAttribute(tt('Remove', 'Supprimer'))}">✕</button>` : ''}
                </label>
              `;
            }).join('')}
            <button class="checker-add-item" data-action="checker-add-custom-item" data-cat-key="${category.key}">
              + ${tt('Add custom item', 'Ajouter un élément')}
            </button>
          </div>
        `;
      }

      // ─── Checklist event binding ──────────────────────────────────────────────────

      function bindCheckerChecklistEvents() {
        document.querySelectorAll('[data-action="checker-toggle-check"]').forEach(cb => {
          cb.addEventListener('change', () => {
            const key = cb.dataset.checkKey;
            if (!appState.checkerState.checklist.checked) appState.checkerState.checklist.checked = {};
            appState.checkerState.checklist.checked[key] = cb.checked;
            checkerSaveChecklist();
            App.render();
          });
        });

        document.querySelectorAll('[data-action="checker-add-custom-item"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const catKey = btn.dataset.catKey;
            const text = prompt(tt('Enter custom checklist item:', 'Saisissez l\'élément personnalisé :'));
            if (!text || !text.trim()) return;
            if (!appState.checkerState.checklist.customItems) appState.checkerState.checklist.customItems = {};
            if (!appState.checkerState.checklist.customItems[catKey]) appState.checkerState.checklist.customItems[catKey] = [];
            appState.checkerState.checklist.customItems[catKey].push(text.trim());
            checkerSaveChecklist();
            App.render();
          });
        });

        document.querySelectorAll('[data-action="checker-remove-custom-item"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const catKey = btn.dataset.catKey;
            const idx = parseInt(btn.dataset.customIndex, 10);
            const customs = appState.checkerState.checklist.customItems?.[catKey];
            if (customs && idx >= 0 && idx < customs.length) {
              customs.splice(idx, 1);
              checkerSaveChecklist();
              App.render();
            }
          });
        });
      }

      // ─── Export Markdown report ───────────────────────────────────────────────────

      function checkerExportReport() {
        const cs = appState.checkerState;
        const r = cs.analysisResult;
        const mode = cs.mode || 'file';
        const fileName = mode === 'scenario'
          ? (appState.scenario.name || tt('Current Scenario', 'Scénario actuel'))
          : (cs.file ? cs.file.name : 'unknown');
        const date = new Date().toISOString().slice(0, 10);
        const categories = checkerGetChecklistCategories();
        const cl = cs.checklist || {};
        const checked = cl.checked || {};
        const customItems = cl.customItems || {};

        const verdictLabels = {
          satisfactory: '✅ Satisfactory / Satisfaisant',
          acceptable: '⚠️ Acceptable',
          insufficient: '❌ Insufficient / Insuffisant'
        };
        const maturityLabels = {
          first_draft: 'First Draft / Premier brouillon',
          advanced_draft: 'Advanced Draft / Brouillon avancé',
          ready_to_play: 'Ready to Play / Prêt à jouer'
        };

        let md = `# Crisis Checker Report — ${fileName}\nGenerated: ${date}\n\n`;

        if (r) {
          md += `## Summary / Synthèse\n**Maturity / Maturité**: ${maturityLabels[r.maturity] || r.maturity}\n\n${r.summary || ''}\n\n`;

          if (r.priority_actions && r.priority_actions.length) {
            md += `## Priority Actions / Actions prioritaires\n`;
            r.priority_actions.forEach((a, i) => { md += `${i + 1}. ${a}\n`; });
            md += '\n';
          }

          if (r.axes) {
            r.axes.forEach(axis => {
              md += `## ${tt('Axis', 'Axe')} ${axis.id}: ${axis.title} — ${verdictLabels[axis.verdict] || axis.verdict}\n\n`;
              if (axis.positive && axis.positive.length) {
                md += `### ${tt('Positive findings', 'Constats positifs')}\n`;
                axis.positive.forEach(f => { md += `- ✓ ${f}\n`; });
                md += '\n';
              }
              if (axis.negative && axis.negative.length) {
                md += `### ${tt('Negative findings', 'Constats négatifs')}\n`;
                axis.negative.forEach(f => { md += `- ✗ ${f}\n`; });
                md += '\n';
              }
              if (axis.recommendations && axis.recommendations.length) {
                md += `### ${tt('Recommendations', 'Recommandations')}\n`;
                axis.recommendations.forEach(rec => { md += `- → ${rec}\n`; });
                md += '\n';
              }
            });
          }

          // Heatmap table
          const data = r.stimuli_per_cell_per_phase;
          if (data && Object.keys(data).length) {
            const cells = Object.keys(data);
            const phaseSet = new Set();
            cells.forEach(c => Object.keys(data[c]).forEach(p => phaseSet.add(p)));
            const phases = [...phaseSet];

            md += `## ${tt('Stimuli Distribution', 'Distribution des stimuli')}\n\n`;
            md += `| ${tt('Cell', 'Cellule')} | ${phases.join(' | ')} | Total |\n`;
            md += `|${'----|'.repeat(phases.length + 2)}\n`;
            cells.forEach(cell => {
              const vals = phases.map(p => data[cell][p] || 0);
              const total = vals.reduce((s, v) => s + v, 0);
              md += `| ${cell} | ${vals.join(' | ')} | ${total} |\n`;
            });
            md += '\n';
          }
        }

        // Checklist
        md += `## ${tt('Ready to Play Checklist', 'Checklist « Prêt à jouer »')}\n\n`;
        let totalItems = 0, checkedCount = 0;
        categories.forEach(cat => {
          md += `### ${cat.title}\n`;
          const customs = customItems[cat.key] || [];
          const allItems = [...cat.items, ...customs];
          allItems.forEach((item, i) => {
            const key = `${cat.key}_${i}`;
            const isChecked = !!checked[key];
            md += `- [${isChecked ? 'x' : ' '}] ${item}\n`;
            totalItems++;
            if (isChecked) checkedCount++;
          });
          md += '\n';
        });
        md += `**${tt('Progress', 'Progression')}**: ${checkedCount} / ${totalItems}\n`;

        // Download
        const safeName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        downloadBlob(blob, `crisis_check_${safeName}_${date}.md`);
        pushToast(tt('Report exported.', 'Rapport exporté.'), 'success');
      }

      // ─── Export DOCX report ───────────────────────────────────────────────────

      function checkerExportReportDocx() {
        const cs = appState.checkerState;
        const r = cs.analysisResult;
        const mode = cs.mode || 'file';
        const fileName = mode === 'scenario'
          ? (appState.scenario.name || tt('Current Scenario', 'Scénario actuel'))
          : (cs.file ? cs.file.name : 'unknown');
        const date = new Date().toISOString().slice(0, 10);
        const categories = checkerGetChecklistCategories();
        const cl = cs.checklist || {};
        const checked = cl.checked || {};
        const customItems = cl.customItems || {};

        const verdictLabels = {
          satisfactory: 'Satisfactory / Satisfaisant',
          acceptable: 'Acceptable',
          insufficient: 'Insufficient / Insuffisant'
        };
        const maturityLabels = {
          first_draft: 'First Draft / Premier brouillon',
          advanced_draft: 'Advanced Draft / Brouillon avancé',
          ready_to_play: 'Ready to Play / Prêt à jouer'
        };

        function esc(str) {
          return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        }

        function run(text, bold, color) {
          const rPr = (bold || color)
            ? `<w:rPr>${bold ? '<w:b/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}</w:rPr>`
            : '';
          return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
        }

        function para(text, style) {
          const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
          if (!text) return `<w:p>${pPr}</w:p>`;
          return `<w:p>${pPr}${run(text)}</w:p>`;
        }

        function boldPara(label, value, style) {
          const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
          return `<w:p>${pPr}${run(label, true)}${run(value)}</w:p>`;
        }

        function listPara(text, numId) {
          return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${run(text)}</w:p>`;
        }

        function tableCell(text, isHeader) {
          const shd = isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="1F3864"/>' : '';
          const jc = isHeader ? '<w:jc w:val="center"/>' : '';
          const runXml = isHeader ? run(text, true, 'FFFFFF') : run(text);
          return `<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/></w:tcBorders>${shd}</w:tcPr><w:p>${jc ? `<w:pPr>${jc}</w:pPr>` : ''}${runXml}</w:p></w:tc>`;
        }

        function tableRow(cells, isHeader) {
          return `<w:tr>${cells.map(c => tableCell(c, isHeader)).join('')}</w:tr>`;
        }

        const body = [];

        body.push(para(`Crisis Checker Report — ${fileName}`, 'CrisisTitle'));
        body.push(para(`Generated: ${date}`, 'CrisisSubtitle'));
        body.push(para(''));

        if (r) {
          body.push(para(tt('Summary', 'Synthèse'), 'Heading1'));
          body.push(boldPara('Maturity / Maturité: ', maturityLabels[r.maturity] || r.maturity));
          if (r.summary) body.push(para(r.summary));
          body.push(para(''));

          if (r.priority_actions && r.priority_actions.length) {
            body.push(para(tt('Priority Actions', 'Actions prioritaires'), 'Heading1'));
            r.priority_actions.forEach(a => body.push(listPara(a, 2)));
            body.push(para(''));
          }

          if (r.axes) {
            r.axes.forEach(axis => {
              body.push(para(`${tt('Axis', 'Axe')} ${axis.id}: ${axis.title} — ${verdictLabels[axis.verdict] || axis.verdict}`, 'Heading1'));
              if (axis.positive && axis.positive.length) {
                body.push(para(tt('Positive findings', 'Constats positifs'), 'Heading2'));
                axis.positive.forEach(f => body.push(listPara(`✓ ${f}`, 1)));
              }
              if (axis.negative && axis.negative.length) {
                body.push(para(tt('Negative findings', 'Constats négatifs'), 'Heading2'));
                axis.negative.forEach(f => body.push(listPara(`✗ ${f}`, 1)));
              }
              if (axis.recommendations && axis.recommendations.length) {
                body.push(para(tt('Recommendations', 'Recommandations'), 'Heading2'));
                axis.recommendations.forEach(rec => body.push(listPara(`→ ${rec}`, 1)));
              }
              body.push(para(''));
            });
          }

          const data = r.stimuli_per_cell_per_phase;
          if (data && Object.keys(data).length) {
            body.push(para(tt('Stimuli Distribution', 'Distribution des stimuli'), 'Heading1'));
            const cells = Object.keys(data);
            const phaseSet = new Set();
            cells.forEach(c => Object.keys(data[c]).forEach(p => phaseSet.add(p)));
            const phases = [...phaseSet];
            const rows = [];
            rows.push(tableRow([tt('Cell', 'Cellule'), ...phases, 'Total'], true));
            cells.forEach(cell => {
              const vals = phases.map(p => String(data[cell][p] || 0));
              const total = vals.reduce((s, v) => s + parseInt(v, 10), 0);
              rows.push(tableRow([cell, ...vals, String(total)], false));
            });
            body.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows.join('')}</w:tbl>`);
            body.push(para(''));
          }
        }

        body.push(para(tt('Ready to Play Checklist', 'Checklist « Prêt à jouer »'), 'Heading1'));
        let totalItems = 0, checkedCount = 0;
        categories.forEach(cat => {
          body.push(para(cat.title, 'Heading2'));
          const customs = customItems[cat.key] || [];
          const allItems = [...cat.items, ...customs];
          allItems.forEach((item, i) => {
            const key = `${cat.key}_${i}`;
            const isChecked = !!checked[key];
            body.push(listPara(`${isChecked ? '☑' : '☐'} ${item}`, 1));
            totalItems++;
            if (isChecked) checkedCount++;
          });
        });
        body.push(para(''));
        body.push(boldPara(`${tt('Progress', 'Progression')}: `, `${checkedCount} / ${totalItems}`));

        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

        const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CrisisTitle">
    <w:name w:val="CrisisTitle"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="52"/><w:color w:val="1F3864"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CrisisSubtitle">
    <w:name w:val="CrisisSubtitle"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="320"/></w:pPr>
    <w:rPr><w:i/><w:sz w:val="24"/><w:color w:val="595959"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:spacing w:before="480" w:after="120"/><w:keepNext/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="1F3864"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="80"/><w:keepNext/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="720"/><w:spacing w:after="80"/></w:pPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>
</w:styles>`;

        const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>
      <w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>
      <w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

        const zip = new JSZip();

        zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

        zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

        const wordFolder = zip.folder('word');
        wordFolder.file('document.xml', documentXml);
        wordFolder.file('styles.xml', stylesXml);
        wordFolder.file('numbering.xml', numberingXml);
        wordFolder.folder('_rels').file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`);

        const docProps = zip.folder('docProps');
        docProps.file('core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Crisis Checker Report — ${esc(fileName)}</dc:title>
  <dc:creator>CrisisMaker by Wavestone</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`);
        docProps.file('app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>CrisisMaker by Wavestone</Application>
</Properties>`);

        zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
          .then(blob => {
            const safeName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
            downloadBlob(blob, `crisis_check_${safeName}_${date}.docx`);
            pushToast(tt('Report exported.', 'Rapport exporté.'), 'success');
          });
      }

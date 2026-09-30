      // ─── Crisis Checker Module ─────────────────────────────────────────────────
      // Autonomous view for importing and analyzing crisis exercise chronograms.
      // Phase 1: File import, parsing, column detection, preview
      // Phase 2: LLM analysis + results display
      // Phase 3: Checklist + export

      // Flat line icons for axis verdicts, colored by the verdict.
      function checkerVerdictIcons() {
        return {
          satisfactory: `<span class="verdict-icon is-good">${sbUiIcon('checkCircle', 15)}</span>`,
          acceptable: `<span class="verdict-icon is-mid">${sbUiIcon('alert', 15)}</span>`,
          insufficient: `<span class="verdict-icon is-low">${sbUiIcon('xCircle', 15)}</span>`
        };
      }

      // ─── Column detection patterns (FR + EN + DE) ────────────────────────────────
      const CHECKER_COLUMN_PATTERNS = {
        timestamp:   [/^h\+/i, /horodatage/i, /heure/i, /time/i, /timestamp/i, /horaire/i, /^t\+/i, /^t$/i, /^h$/i, /zeitstempel/i, /uhrzeit/i, /^z\+/i],
        phase:       [/phase/i, /[eé]tape/i, /step/i, /^stade/i, /schritt/i, /stufe/i],
        sender:      [/[eé]metteur/i, /sender/i, /^from$/i, /source/i, /exp[eé]diteur/i, /envoy/i, /absender/i, /^von$/i],
        recipient:   [/destinataire/i, /recipient/i, /^to$/i, /target/i, /cellule/i, /cible/i, /empf[äa]nger/i, /^an$/i],
        channel:     [/canal/i, /channel/i, /medium/i, /vecteur/i, /moyen/i, /support/i, /^type\s*de\s*com/i, /kanal/i, /kommunikationsweg/i],
        content:     [/contenu/i, /description/i, /content/i, /texte/i, /message/i, /libell[eé]/i, /d[eé]tail/i, /objet/i, /inhalt/i, /nachricht/i, /betreff/i],
        type:        [/^type$/i, /nature/i, /cat[eé]gorie/i, /category/i, /typ/i, /art$/i],
        conditional: [/conditionnel/i, /conditional/i, /^if$/i, /branch/i, /condition/i, /bedingt/i, /wenn/i],
        theme:       [/th[eè]me/i, /theme/i, /dimension/i, /domaine/i, /domain/i, /thema/i, /bereich/i]
      };

      const CHECKER_COLUMN_LABELS = {
        timestamp:   () => tt('Timestamp', 'Horodatage', 'Zeitstempel'),
        phase:       () => tt('Phase', 'Phase', 'Phase'),
        sender:      () => tt('Sender', 'Émetteur', 'Absender'),
        recipient:   () => tt('Recipient', 'Destinataire', 'Empfänger'),
        channel:     () => tt('Channel', 'Canal', 'Kanal'),
        content:     () => tt('Content', 'Contenu', 'Inhalt'),
        type:        () => tt('Type', 'Type', 'Typ'),
        conditional: () => tt('Conditional', 'Conditionnel', 'Bedingt'),
        theme:       () => tt('Theme', 'Thème', 'Thema')
      };

      const CHECKER_SHEET_PATTERNS = [/chrono/i, /timeline/i, /stimuli/i, /inject/i];

      // ─── File parsing ─────────────────────────────────────────────────────────────

      // Files the Context tab and Check & Challenge accept: a chronogram (.xlsx, .xls), a deck
      // (.pptx), a proposal or an exercise brief (.docx, .txt, .md).
      const CHECKER_FILE_TYPES = /\.(xlsx?|pptx|docx|txt|md|markdown)$/;
      const CHECKER_FILE_ACCEPT = '.xlsx,.xls,.pptx,.docx,.txt,.md';
      const checkerUnsupportedMessage = () => tt(
        'Unsupported file format. Please upload .pptx, .docx, .xlsx, .xls, .txt or .md (save an older .ppt or .doc in the current format first).',
        'Format de fichier non supporté. Importez un fichier .pptx, .docx, .xlsx, .xls, .txt ou .md (enregistrez d’abord un ancien .ppt ou .doc au format actuel).',
        'Nicht unterstütztes Dateiformat. Bitte laden Sie eine .pptx-, .docx-, .xlsx-, .xls-, .txt- oder .md-Datei hoch (ältere .ppt- oder .doc-Dateien zuerst im aktuellen Format speichern).'
      );

      async function checkerParseFile(file) {
        const name = file.name.toLowerCase();
        if (/\.xlsx?$/.test(name)) {
          return await checkerParseExcel(file);
        } else if (CHECKER_FILE_TYPES.test(name)) {
          return await checkerParseDocument(file);
        }
        throw new Error(checkerUnsupportedMessage());
      }

      async function checkerParseExcel(file) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        if (!sheetNames.length) {
          throw new Error(tt(
            'Could not parse the file. Please check the file format and content.',
            'Impossible de lire le fichier. Vérifiez le format et le contenu.',
            'Die Datei konnte nicht gelesen werden. Bitte überprüfen Sie Format und Inhalt.'
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

      /* A deck, a proposal or a brief: read as slides or sections (CrisisDocReader), then
         shown as tables Check & Challenge can map (the chronogram tables of the deck, its
         injects written one per slide, and every slide). The document itself is kept: the
         Context generation, the agent and the challenge read all of it, not only the tables. */
      async function checkerParseDocument(file) {
        const doc = await CrisisDocReader.read(file, file.name);
        const analysis = CrisisDocReader.analyze(doc, CHECKER_COLUMN_PATTERNS);
        if (!analysis.textLength) {
          throw new Error(tt(
            'No text found in this file: its slides may be pictures only.',
            'Aucun texte trouvé dans ce fichier : ses slides ne contiennent peut-être que des images.',
            'Kein Text in dieser Datei gefunden: Die Folien enthalten vielleicht nur Bilder.'
          ));
        }
        const view = analysis.views[analysis.defaultView];
        return {
          sheets: Object.keys(analysis.views),
          selectedSheet: analysis.defaultView,
          headers: view.headers,
          rows: view.rows,
          workbook: null,
          views: analysis.views,
          doc,
          analysis,
          isPptx: doc.kind === 'pptx'
        };
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




      // ─── Render: Drop Zone ────────────────────────────────────────────────────────

      function renderCheckerDropZone(options = {}) {
        const zone = `
            <div class="checker-dropzone${options.inner ? ' is-compact' : ''}" id="checker-dropzone">
              <div class="checker-dropzone-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="12" y2="12"></line><line x1="15" y1="15" x2="12" y2="12"></line></svg>
              </div>
              <p class="checker-dropzone-title">${options.title || tt('Drop your chronogram file here', 'Déposez votre fichier chronogramme ici', 'Chronogramm-Datei hier ablegen')}</p>
              <p class="checker-dropzone-sub">${tt('or click to browse', 'ou cliquez pour parcourir', 'oder klicken zum Durchsuchen')}</p>
              <p class="checker-dropzone-formats">${options.formats || tt('Supported: .pptx, .docx, .xlsx, .xls, .txt, .md', 'Formats acceptés : .pptx, .docx, .xlsx, .xls, .txt, .md', 'Unterstützt: .pptx, .docx, .xlsx, .xls, .txt, .md')}</p>
              <input type="file" id="checker-file-input" accept="${CHECKER_FILE_ACCEPT}" style="display:none;">
            </div>
            ${appState.checkerState._fileError ? `<p class="checker-error-msg">${escapeHtml(appState.checkerState._fileError)}</p>` : ''}`;
        return options.inner ? zone : `<article class="card">${zone}</article>`;
      }

      // ─── Render: Imported file view (preview + mapping) ───────────────────────────

      function renderCheckerImported(options = {}) {
        const cs = appState.checkerState;
        const pd = cs.parsedData;
        // Inside the Context tab: a compact file line, what was found, the details folded underneath.
        if (options.inner) {
          const doc = pd.doc;
          const analysis = pd.analysis;
          const unitLabel = doc?.unit === 'slide' ? tt('slides', 'slides', 'Folien') : tt('sections', 'sections', 'Abschnitte');
          const size = doc
            ? `${doc.slides.length} ${unitLabel}${analysis.chronogramRows ? ` · ${analysis.chronogramRows} ${tt('injects', 'injects', 'Injects')}` : ''}`
            : `${pd.rows.length} ${tt('rows', 'lignes', 'Zeilen')}`;
          const order = ['context', 'objectives', 'players', 'phases', 'incident', 'chronogram', 'facilitation', 'rules', 'debrief', 'proposal'];
          const found = analysis ? order.filter((key) => analysis.sections[key]?.length) : [];
          const challenge = !doc || analysis.chronogramRows;
          return `
          <div class="cx-file-loaded">
            <span class="cx-file-name">${sbUiIcon(doc ? 'book' : 'sheet', 16)} <strong>${escapeHtml(cs.file.name)}</strong> <span class="subtle">${escapeHtml(size)}${cs.columnMappingLoading ? ` · ${tt('mapping the columns…', 'association des colonnes…', 'Spalten werden zugeordnet…')}` : ''}</span></span>
            <span class="cx-file-actions">
              ${challenge ? `<button class="btn btn-secondary btn-sm" data-action="cc-challenge-file" title="${escapeAttribute(tt('Audit the chronogram of this file as it is in Check & Challenge', 'Auditer le chronogramme de ce fichier tel quel dans Check & Challenge', 'Das Chronogramm dieser Datei unverändert in Check & Challenge prüfen'))}">${sbUiIcon('checkCircle', 14)} ${tt('Challenge it', 'Le challenger', 'Hinterfragen')}</button>` : ''}
              <button class="btn btn-secondary btn-sm" data-action="checker-clear-file">${sbUiIcon('close', 14)} ${tt('Remove', 'Retirer', 'Entfernen')}</button>
            </span>
          </div>
          ${found.length ? `<div class="cx-file-found"><span class="subtle">${escapeHtml(tt('Found:', 'Trouvé :', 'Gefunden:'))}</span>${found.map((key) => `<span class="cx-file-chip" title="${escapeAttribute(`${doc.unit === 'slide' ? tt('Slides', 'Slides', 'Folien') : tt('Sections', 'Sections', 'Abschnitte')} ${analysis.sections[key].join(', ')}`)}">${escapeHtml(tt(...CrisisDocReader.sectionLabel(key)))} <b>${analysis.sections[key].length}</b></span>`).join('')}</div>` : ''}
          <details class="cx-file-details">
            <summary>${doc ? tt('Preview, injects and column mapping', 'Aperçu, injects et correspondance des colonnes', 'Vorschau, Injects und Spaltenzuordnung') : tt('Preview and column mapping', 'Aperçu et correspondance des colonnes', 'Vorschau und Spaltenzuordnung')} ${sbUiIcon('down', 14)}</summary>
            ${renderCheckerSheetSelector()}
            ${renderCheckerPreviewTable()}
            ${renderCheckerColumnMapping()}
          </details>`;
        }
        return `
          <article class="card">
            <div class="section-header" style="margin-bottom:16px;">
              <h3>${escapeHtml(cs.file.name)} <span class="subtle" style="font-weight:normal; font-size:0.85rem;">(${pd.rows.length} ${tt('rows', 'lignes', 'Zeilen')})</span></h3>
              <div class="actions">
                <button class="btn btn-secondary" data-action="checker-clear-file">${sbUiIcon('close', 14)} ${tt('Clear', 'Effacer', 'Löschen')}</button>
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
          return `<p class="subtle">${tt('No data found in this sheet.', 'Aucune donnée trouvée dans cet onglet.', 'Keine Daten in diesem Blatt gefunden.')}</p>`;
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
            ${hasMore ? `<p class="subtle" style="text-align:center; margin-top:8px; font-size:0.82rem;">${tt(`Showing ${maxVisibleRows} of ${pd.rows.length} rows. Scroll to see more.`, `Affichage de ${maxVisibleRows} sur ${pd.rows.length} lignes. Faites défiler pour voir plus.`, `${maxVisibleRows} von ${pd.rows.length} Zeilen angezeigt. Scrollen für mehr.`)}</p>` : ''}
          </div>
        `;
      }

      // ─── Render: Column mapping ───────────────────────────────────────────────────

      function renderCheckerColumnMapping() {
        const cs = appState.checkerState;
        const pd = cs.parsedData;
        const mapping = cs.columnMapping;
        if (!pd || !pd.headers.length) return '';

        const notDetected = tt('— Not detected —', '— Non détecté —', '— Nicht erkannt —');
        const hasMissing = Object.values(mapping).some(v => v === null);
        const isLoading = cs.columnMappingLoading;

        return `
          <div class="checker-mapping">
            <h4>
              ${tt('Column Mapping', 'Correspondance des colonnes', 'Spaltenzuordnung')}
              ${isLoading ? `<span class="checker-mapping-ai-badge"><span class="checker-mapping-spinner"></span>${tt('AI detecting…', 'Détection IA en cours…', 'KI erkennt…')}</span>` : ''}
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
                      ${pd.headers.map((h, i) => `<option value="${i}" ${val === i ? 'selected' : ''}>${tt('Column', 'Colonne', 'Spalte')} ${checkerColLetter(i)} — "${escapeHtml(h)}"</option>`).join('')}
                    </select>
                    ${isMissing && !isLoading ? '<span class="checker-mapping-warn" title="' + escapeAttribute(tt('Not detected', 'Non détecté', 'Nicht erkannt')) + '">' + sbUiIcon('alert', 13) + '</span>' : ''}
                  </div>
                `;
              }).join('')}
            </div>
            ${hasMissing && !isLoading ? `<p class="checker-mapping-note">${sbUiIcon('alert', 13)} ${tt('Missing columns will be flagged in the analysis.', 'Les colonnes manquantes seront signalées dans l\'analyse.', 'Fehlende Spalten werden in der Analyse markiert.')}</p>` : ''}
            ${!isLoading ? `<p class="checker-mapping-hint">${tt('You can adjust the mapping manually using the dropdowns above.', 'Vous pouvez ajuster la correspondance manuellement via les menus ci-dessus.', 'Sie können die Zuordnung manuell über die Dropdown-Menüs oben anpassen.')}</p>` : ''}
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
        if (!CHECKER_FILE_TYPES.test(name)) {
          appState.checkerState._fileError = checkerUnsupportedMessage();
          App.render();
          return;
        }

        try {
          appState.checkerState._fileError = null;
          const result = await checkerParseFile(file);

          appState.checkerState.file = { name: file.name, size: file.size, type: file.type };
          appState.checkerState.parsedData = { headers: result.headers, rows: result.rows, workbook: result.workbook, views: result.views || null, doc: result.doc || null, analysis: result.analysis || null, isPptx: !!result.isPptx };
          appState.checkerState.sheets = result.sheets;
          appState.checkerState.selectedSheet = result.selectedSheet;
          appState.checkerState.columnMapping = checkerAutoDetectColumns(result.headers);
          appState.checkerState.columnMappingLoading = false;
          appState.checkerState.analysisResult = null;
          appState.checkerState.analysisError = null;
          checkerRememberSource();

          if (isLLMAvailable() && checkerNeedsAIMapping(result.selectedSheet)) {
            appState.checkerState.columnMappingLoading = true;
            App.render();
            pushToast(tt(`File loaded: ${file.name}`, `Fichier chargé : ${file.name}`, `Datei geladen: ${file.name}`), 'success');
            try {
              const llmMapping = await checkerAutoDetectColumnsLLM(result.headers, result.rows);
              appState.checkerState.columnMapping = llmMapping;
              checkerRememberSource();
            } catch (_llmErr) {
              // Keep regex fallback silently
            }
            appState.checkerState.columnMappingLoading = false;
            App.render();
          } else {
            App.render();
            pushToast(tt(`File loaded: ${file.name}`, `Fichier chargé : ${file.name}`, `Datei geladen: ${file.name}`), 'success');
          }
        } catch (err) {
          appState.checkerState._fileError = CrisisError.format(err, {
            operation: 'Import checker file',
            fileName: file.name,
            fileSize: file.size
          });
          CrisisError.log(err, { operation: 'Import checker file', fileName: file.name, fileSize: file.size });
          App.render();
        }
      }

      /* A spreadsheet or a chronogram table of a deck has headers of its own: the AI maps them.
         The views built from slides or sections have known headers. */
      function checkerNeedsAIMapping(sheetName) {
        const views = appState.checkerState.parsedData?.views;
        return !views || /^Chronogram/.test(sheetName);
      }

      function checkerSwitchSheet(sheetName) {
        const cs = appState.checkerState;
        if (!cs.parsedData || !(cs.parsedData.workbook || cs.parsedData.views?.[sheetName])) return;
        const sheetData = cs.parsedData.views ? cs.parsedData.views[sheetName] : checkerReadSheet(cs.parsedData.workbook, sheetName);
        cs.selectedSheet = sheetName;
        cs.parsedData.headers = sheetData.headers;
        cs.parsedData.rows = sheetData.rows;
        cs.columnMapping = checkerAutoDetectColumns(sheetData.headers);
        cs.columnMappingLoading = false;
        cs.analysisResult = null;
        cs.analysisError = null;

        if (isLLMAvailable() && checkerNeedsAIMapping(sheetName)) {
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

      /* The file loaded in the Context (deck, proposal, brief or chronogram) is kept with the
         project, as read (text, tables, analysis), so a reload or a saved JSON still has it for
         Update, the AI and Check & Challenge. The spreadsheet object itself is not kept: after a
         reload, the sheet read stays, other sheets need the file again. */
      const CHECKER_SOURCE_MAX = 3000000;
      function checkerRememberSource(project = appState.scenario) {
        const cs = appState.checkerState;
        if (!project || !cs?.parsedData) return;
        const { workbook: _workbook, ...data } = cs.parsedData;
        let source = { name: cs.file?.name || 'file', size: cs.file?.size || 0, type: cs.file?.type || '', loaded_at: new Date().toISOString(), sheets: cs.sheets || [], selectedSheet: cs.selectedSheet || '', columnMapping: cs.columnMapping || {}, data };
        // A very large file keeps its analysis and rows, not every slide.
        if (JSON.stringify(source).length > CHECKER_SOURCE_MAX) source = { ...source, data: { ...data, doc: null, views: null }, trimmed: true };
        project.source_file = source;
        if (typeof saveLocal === 'function') saveLocal(false);
      }

      /* Puts back the file saved with the project, or none: a project never sees another's file. */
      function checkerRestoreSource(project = appState.scenario) {
        const source = project?.source_file;
        const current = appState.checkerState;
        if (current?.file && source && current.file.name === source.name && current.parsedData) return;
        if (current?.parsedData || current?.file) checkerClearFile({ keepProject: true });
        if (!source?.data) return;
        Object.assign(appState.checkerState, {
          file: { name: source.name, size: source.size, type: source.type },
          parsedData: { ...source.data, workbook: null },
          sheets: source.sheets || [], selectedSheet: source.selectedSheet || '', columnMapping: source.columnMapping || {}
        });
      }

      /* Removes the external file only: the readiness checklist and the challenge of the
         current scenario stay. */
      function checkerClearFile({ keepProject = false } = {}) {
        if (!keepProject && appState.scenario?.source_file) { appState.scenario.source_file = null; if (typeof saveLocal === 'function') saveLocal(false); }
        const cs = appState.checkerState;
        const keep = cs.mode === 'file' ? (cs.resultsByMode?.scenario || {}) : { analysisResult: cs.analysisResult, analysisError: cs.analysisError, llmLogs: cs.llmLogs, activeAxisTab: cs.activeAxisTab };
        appState.checkerState = {
          mode: 'scenario',
          file: null,
          parsedData: null,
          sheets: [],
          selectedSheet: '',
          columnMapping: {},
          columnMappingLoading: false,
          analysisResult: keep.analysisResult || null,
          analysisLoading: false,
          analysisError: keep.analysisError || null,
          llmLogs: keep.llmLogs || [],
          activeAxisTab: keep.activeAxisTab || 0,
          resultsByMode: {}
        };
        App.render();
      }

      /* Switches what Check & Challenge audits (the scenario or the external file), keeping
         the last challenge of each so going back and forth loses nothing. */
      function checkerSwitchMode(mode) {
        const cs = appState.checkerState;
        if (!mode || cs.mode === mode) return;
        const fields = ['analysisResult', 'analysisError', 'llmLogs', 'activeAxisTab'];
        cs.resultsByMode = cs.resultsByMode || {};
        cs.resultsByMode[cs.mode || 'scenario'] = Object.fromEntries(fields.map((key) => [key, cs[key]]));
        const next = cs.resultsByMode[mode] || {};
        cs.mode = mode;
        cs.analysisResult = next.analysisResult || null;
        cs.analysisError = next.analysisError || null;
        cs.llmLogs = next.llmLogs || [];
        cs.activeAxisTab = next.activeAxisTab || 0;
      }


      // ─── LLM Log Renderer (checker) ──────────────────────────────────────────────

      function renderCheckerLLMLogs(logs) {
        if (!logs || logs.length === 0) {
          return `<div class="llm-stream-empty">${tt('Waiting for LLM response\u2026', 'En attente de la réponse LLM\u2026', 'Warte auf LLM-Antwort\u2026')}</div>`;
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
            ? tt('Error', 'Erreur', 'Fehler')
            : (isStreaming ? tt('Assistant (streaming\u2026)', 'Assistant (streaming\u2026)', 'Assistent (streaming\u2026)') : tt('Assistant', 'Assistant', 'Assistent'));
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

        const getPhase = (mins, stimulus) => {
          // The storyline phases first, with the same rule as every tab (exercise model).
          const phase = sc.storyboard && typeof ExerciseModel !== 'undefined' ? ExerciseModel.phaseOfStimulus(sc, stimulus) : null;
          if (phase) return phase.title;
          const planned = (sc.scenario?.phases || []).find(p => mins >= p.start_minutes && mins < p.end_minutes);
          if (planned) return planned.name;
          if (maxOffset === 0) return 'Phase 1';
          return `Phase ${Math.min(phaseCount, Math.floor(mins / phaseSize) + 1)}`;
        };

        const cellMap = {};
        (sc.cells || []).forEach(cell => { cellMap[cell.id] = cell.name; });
        if (typeof sbRecipientName === 'function') stimuli.forEach(s => { if (s.cell_id && !cellMap[s.cell_id]) cellMap[s.cell_id] = sbRecipientName(sc, s.cell_id); });
        const hasRecipients = stimuli.some(s => cellMap[s.cell_id]);
        const colKeys = hasRecipients ? ['timestamp', 'phase', 'sender', 'recipient', 'channel', 'content', 'type'] : ['timestamp', 'phase', 'sender', 'channel', 'content', 'type'];
        // Injects are cited by the number they have in Play and the Injects library (#09), not by a line.
        const numbers = typeof ExerciseModel !== 'undefined' ? ExerciseModel.numbers(sc) : new Map();
        const top = numbers.size ? ExerciseModel.numberTop(numbers) : stimuli.length;
        const label = (s, i) => typeof ExerciseModel !== 'undefined' ? ExerciseModel.numberLabel(numbers.get(s.id) || i + 1, top) : `#${i + 1}`;
        const header = 'INJECT | ' + colKeys.map(k => CHECKER_COLUMN_LABELS[k]().toUpperCase()).join(' | ');
        const lines = [header];

        stimuli.forEach((s, i) => {
          const mins = s.timestamp_offset_minutes || 0;
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          const timestamp = `H+${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
          const phase = getPhase(mins, s);
          const actor = actorMap[s.actor_id];
          const sender = actor
            ? `${actor.name} (${roleLabel(actor.role)})`
            : (s.source_label || '—');
          const channel = channelLabel(s.channel);
          const content = s.name
            || s.fields?.subject || s.fields?.headline || s.fields?.thread_title
            || s.fields?.breaking_headline || s.fields?.tweet_text
            || s.fields?.post_text || s.fields?.content_text || '—';
          const type = s.channel || '—';
          const row = hasRecipients ? [timestamp, phase, sender, cellMap[s.cell_id] || '—', channel, String(content).substring(0, 300), type] : [timestamp, phase, sender, channel, String(content).substring(0, 300), type];
          lines.push(`${label(s, i)} | ${row.join(' | ')}`);
        });

        const actorList = actors.map(a =>
          `- ${a.name} (${roleLabel(a.role)}, ${a.organization || ''})`
        ).join('\n');

        function checkerSerializeStoryboard(project) {
          const storyboard = project.storyboard;
          if (!storyboard?.blocks?.length || typeof sbSortedBlocks !== 'function') return '';
          const rows = sbSortedBlocks(storyboard).map((block) => `- H+${Math.floor(block.start_minutes / 60)}:${String(block.start_minutes % 60).padStart(2, '0')} → H+${Math.floor(sbBlockEnd(block) / 60)}:${String(sbBlockEnd(block) % 60).padStart(2, '0')} ${block.title} (${block.stimuli_target} planned injects): ${String(block.brief || block.narrative || '').slice(0, 240)}`);
          const cells = (project.cells || []).map((cell) => `${cell.name} (${cell.players.length} player(s))`).join(', ');
          return `\nMAIN STORYLINE (${storyboard.blocks.length} phases):\n${rows.join('\n')}\n${cells ? `PLAYER CELLS (recipients of the injects): ${cells}\n` : ''}`;
        }

        const serialized = `SCENARIO: ${sc.name || 'Untitled'}
TYPE: ${sc.scenario?.type || '—'}
CLIENT: ${sc.client?.name || '—'} (${sc.client?.sector || '—'})
CONTEXT: ${sc.scenario?.summary || '—'}
OBJECTIVES: ${sc.scenario?.objectives || '—'}
NARRATIVE ARC: ${sc.scenario?.narrative_arc || '—'}
DURATION: H+0 to H+${Math.round(maxOffset / 60)}h (${stimuli.length} stimuli)
${checkerSerializeStoryboard(sc)}
${typeof sbDesignContextLines === 'function' && sbDesignContextLines(sc).length ? `EXERCISE DESIGN (check that the learning objectives of each cell are tested and that technical injects follow the incident timeline):\n${sbDesignContextLines(sc).join('\n')}\n` : ''}
ACTORS (${actors.length}):
${actorList || 'None'}

CHRONOGRAM DATA
Total stimuli: ${stimuli.length}

${lines.join('\n')}`;

        const detectedCols = colKeys;
        const missingCols = hasRecipients ? ['conditional', 'theme'] : ['recipient', 'conditional', 'theme'];
        return { serialized, detectedCols, missingCols, truncated: false };
      }

      function checkerSerializeChronogram(options = {}) {
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
        // Very large sheets are cut to keep one request within a model's context.
        const MAX_ROWS = 800;

        for (let i = 0; i < Math.min(pd.rows.length, MAX_ROWS); i++) {
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

        const table = `CHRONOGRAM DATA${pd.doc ? ` (view "${cs.selectedSheet}" of the document)` : ''}
Total lines: ${pd.rows.length}${pd.rows.length > MAX_ROWS ? ` (the first ${MAX_ROWS} are listed below)` : ''}
Columns detected: ${detectedCols.map(k => CHECKER_COLUMN_LABELS[k]()).join(', ') || 'none'}
Columns missing: ${missingCols.map(k => CHECKER_COLUMN_LABELS[k]()).join(', ') || 'none'}

${lines.join('\n')}`;
        // A deck or a brief also says what the exercise is for: its context, objectives,
        // players and phases come first, so the challenge judges the injects against them.
        const serialized = pd.doc && options.withDocument !== false
          ? `EXERCISE DOCUMENT (everything it says, slide by slide: use its context, objectives, players, phases and incident timeline to judge the chronogram; lines below are cited by their LINE number, the ${pd.analysis.unit} column gives where they are in the document)
${CrisisDocReader.outline(pd.doc, pd.analysis, { limit: options.documentLimit || 14000, skipChronogramTables: /^Chronogram/.test(cs.selectedSheet) })}

${table}`
          : table;

        return { serialized, detectedCols, missingCols, truncated };
      }

      // ─── Analysis prompt ──────────────────────────────────────────────────────────

      function checkerBuildPrompt(serialized, detectedCols, missingCols, concise = false) {
        const uiLang = currentLanguage();
        const respondInLang = { en: 'English', fr: 'French', de: 'German' }[uiLang] || 'English';
        const detectedStr = detectedCols.map(k => CHECKER_COLUMN_LABELS[k]()).join(', ') || 'none';
        const missingStr = missingCols.map(k => CHECKER_COLUMN_LABELS[k]()).join(', ') || 'none';

        const conciseNote = concise
          ? tt('\nBe more concise in your findings.\n',
               '\nSois plus concis dans tes constats.\n',
               '\nSei prägnanter in deinen Feststellungen.\n')
          : '';

        const axe1Title = tt('EXERCISE COMPLETENESS', 'COMPLÉTUDE DE L\'EXERCICE', 'VOLLSTÄNDIGKEIT DER ÜBUNG');
        const axe2Title = tt('NARRATIVE COHERENCE', 'COHÉRENCE NARRATIVE', 'NARRATIVE KOHÄRENZ');
        const axe3Title = tt('STIMULUS COHERENCE', 'COHÉRENCE DES STIMULI', 'STIMULUS-KOHÄRENZ');
        const axe4Title = tt('PACE AND WORKLOAD PER CELL', 'RYTHME ET CHARGE PAR CELLULE', 'TEMPO UND ARBEITSLAST PRO ZELLE');
        const axe5Title = tt('CONTINGENCY MANAGEMENT AND FLEXIBILITY', 'GESTION DES ALÉAS ET FLEXIBILITÉ', 'NOTFALLMANAGEMENT UND FLEXIBILITÄT');

        const intro = tt(
          `You are a senior expert in crisis management and crisis exercise design. You are provided with a crisis exercise chronogram in tabular form. Each line represents a stimulus or scenario event.`,
          `Tu es un expert senior en gestion de crise et en conception d'exercices de crise. On te fournit un chronogramme d'exercice de crise sous forme de tableau. Chaque ligne représente un stimulus ou un événement du scénario.`,
          `Du bist ein erfahrener Experte für Krisenmanagement und die Gestaltung von Krisenübungen. Dir wird ein Krisenübungs-Chronogramm in tabellarischer Form bereitgestellt. Jede Zeile stellt einen Stimulus oder ein Szenarioereignis dar.`
        );

        const colLabels = tt(
          `Available columns: ${detectedStr}\nMissing columns: ${missingStr}`,
          `Colonnes disponibles : ${detectedStr}\nColonnes manquantes : ${missingStr}`,
          `Verfügbare Spalten: ${detectedStr}\nFehlende Spalten: ${missingStr}`
        );

        const instructions = tt(
          `Analyze the chronogram according to the 5 axes below. For each axis, produce:
1. A synthetic verdict: satisfactory, acceptable, or insufficient
2. The list of positive and negative findings, with reference to the relevant lines
3. Concrete recommendations to fix identified issues`,
          `Analyse le chronogramme selon les 5 axes ci-dessous. Pour chaque axe, produis :
1. Un verdict synthétique : satisfactory, acceptable, ou insufficient
2. La liste des constats positifs et négatifs, avec référence aux lignes concernées
3. Des recommandations concrètes pour corriger les défauts identifiés`,
          `Analysiere das Chronogramm anhand der folgenden 5 Achsen. Erstelle für jede Achse:
1. Ein zusammenfassendes Urteil: satisfactory, acceptable oder insufficient
2. Die Liste der positiven und negativen Befunde mit Verweis auf die betreffenden Zeilen
3. Konkrete Empfehlungen zur Behebung der identifizierten Mängel`
        );

        const axe1 = tt(
          `AXIS 1: ${axe1Title}

Thematic coverage — are the major dimensions of a crisis represented?
- Operational / technical
- Internal communication
- External communication (media, social media)
- Legal / regulatory (notifications, compliance)
- HR / social (employee impact, social partners)
- Business continuity (BCP/DRP, failover, degraded mode)
- Relations with authorities (regulator, law enforcement, national CERT)
- External stakeholders (clients, suppliers, partners)
- Financial / insurance

Actor representation — do all expected categories appear as senders or recipients?
- Senior management / COMEX
- Decision-making crisis cell
- Operational crisis cell
- Communication / press relations
- Legal department
- Directly impacted business units
- IT / technical teams / SOC / CERT
- Critical service providers
- Regulators / authorities

Deliverables coverage — does the scenario push players to produce:
- Press release or talking points
- Regulatory notification
- Structured situation report
- BCP/DRP activation decision
- Maintaining a log / chronolog
- Internal communication

Channel diversity — does the scenario use a variety of channels (email, call, alert, media, social media, messaging)?`,
          `AXE 1 : ${axe1Title}

Couverture thématique — les grandes dimensions d'une crise sont-elles représentées ?
- Opérationnel / technique
- Communication interne
- Communication externe (médias, réseaux sociaux)
- Juridique / réglementaire (notifications, conformité)
- RH / social (impact collaborateurs, partenaires sociaux)
- Continuité d'activité (PCA/PRA, bascule, mode dégradé)
- Relations avec les autorités (régulateur, forces de l'ordre, ANSSI/CERT national)
- Parties prenantes externes (clients, fournisseurs, partenaires)
- Financier / assurance

Représentation des acteurs — toutes les catégories attendues apparaissent-elles comme émetteurs ou destinataires ?
- Direction générale / COMEX
- Cellule de crise décisionnelle
- Cellule de crise opérationnelle
- Communication / relations presse
- Direction juridique
- Métiers directement impactés
- DSI / équipes techniques / SOC / CERT
- Prestataires critiques
- Régulateurs / autorités

Couverture des livrables — le scénario pousse-t-il les joueurs à produire :
- Communiqué de presse ou éléments de langage
- Notification réglementaire (CNIL, ANSSI, autorité sectorielle)
- Point de situation structuré
- Décision d'activation PCA/PRA
- Tenue d'une main courante
- Communication interne

Diversité des canaux — le scénario utilise-t-il une variété de canaux (email, appel, alerte, média, réseau social, messagerie) ?`,
          `ACHSE 1: ${axe1Title}

Thematische Abdeckung — sind die wichtigsten Dimensionen einer Krise vertreten?
- Operativ / technisch
- Interne Kommunikation
- Externe Kommunikation (Medien, soziale Medien)
- Rechtlich / regulatorisch (Benachrichtigungen, Compliance)
- HR / Soziales (Mitarbeiterauswirkungen, Sozialpartner)
- Geschäftskontinuität (BCP/DRP, Failover, eingeschränkter Modus)
- Beziehungen zu Behörden (Regulierer, Strafverfolgung, nationales CERT)
- Externe Stakeholder (Kunden, Lieferanten, Partner)
- Finanzen / Versicherung

Darstellung der Akteure — erscheinen alle erwarteten Kategorien als Absender oder Empfänger?
- Geschäftsleitung / COMEX
- Entscheidungs-Krisenstab
- Operativer Krisenstab
- Kommunikation / Pressearbeit
- Rechtsabteilung
- Direkt betroffene Geschäftsbereiche
- IT / technische Teams / SOC / CERT
- Kritische Dienstleister
- Regulierer / Behörden

Abdeckung der Ergebnisse — drängt das Szenario die Spieler dazu, Folgendes zu erstellen:
- Pressemitteilung oder Sprachregelungen
- Regulatorische Benachrichtigung
- Strukturierter Lagebericht
- BCP/DRP-Aktivierungsentscheidung
- Führung eines Chronologs
- Interne Kommunikation

Kanalvielfalt — nutzt das Szenario verschiedene Kanäle (E-Mail, Anruf, Alarm, Medien, soziale Medien, Messaging)?`
        );

        const axe2 = tt(
          `AXIS 2: ${axe2Title}

Phase structure — are the main phases present and logically ordered?
- Detection / early warning signs
- Alert and mobilization
- Hot management / response
- Stabilization / recovery
- Demobilization / closure

Causal chaining — does each event logically follow from the previous one?
Severity progression — is the escalation gradual?
Duration — is the total duration consistent with the type of crisis simulated?
Scenario richness — does the scenario include at least one decision dilemma, a twist, a phase of uncertainty?
Internal factual consistency — are factual elements consistent from one stimulus to another?`,
          `AXE 2 : ${axe2Title}

Structure en phases — les grandes phases sont-elles présentes et ordonnées logiquement ?
- Détection / signaux faibles
- Alerte et mobilisation
- Gestion à chaud / réponse
- Stabilisation / reprise de contrôle
- Démobilisation / clôture

Enchaînement causal — chaque événement découle-t-il logiquement du précédent ?
Progression de la gravité — la montée en puissance est-elle progressive ?
Durée — la durée totale est-elle cohérente avec le type de crise simulée ?
Richesse scénaristique — le scénario comporte-t-il au moins un dilemme décisionnel, un rebondissement, une phase d'incertitude ?
Cohérence factuelle interne — les éléments factuels sont-ils cohérents d'un stimulus à l'autre ?`,
          `ACHSE 2: ${axe2Title}

Phasenstruktur — sind die Hauptphasen vorhanden und logisch geordnet?
- Erkennung / Frühwarnsignale
- Alarm und Mobilisierung
- Akutmanagement / Reaktion
- Stabilisierung / Wiederherstellung
- Demobilisierung / Abschluss

Kausale Verkettung — folgt jedes Ereignis logisch aus dem vorherigen?
Schweregradprogression — ist die Eskalation schrittweise?
Dauer — ist die Gesamtdauer mit dem simulierten Krisentyp konsistent?
Szenarioreichhaltigkeit — enthält das Szenario mindestens ein Entscheidungsdilemma, eine Wendung, eine Phase der Unsicherheit?
Interne faktische Konsistenz — sind die faktischen Elemente von einem Stimulus zum anderen konsistent?`
        );

        const axe3 = tt(
          `AXIS 3: ${axe3Title}

Metadata completeness — does each stimulus have a sender, recipient, channel, timestamp?
Information logic:
- A recipient never receives information they are supposed to ignore at this stage
- A response stimulus does not arrive before its trigger stimulus
- Propagation delays are realistic
Inter-stimuli factual consistency — no contradiction between stimuli
Conditional stimuli — are stimuli depending on player decisions marked?`,
          `AXE 3 : ${axe3Title}

Complétude des métadonnées — chaque stimulus a-t-il un émetteur, un destinataire, un canal, un horodatage ?
Logique informationnelle :
- Un destinataire ne reçoit jamais une information qu'il est censé ignorer à ce stade
- Un stimulus de réponse n'arrive pas avant son stimulus déclencheur
- Les délais de propagation sont réalistes
Cohérence factuelle inter-stimuli — pas de contradiction entre deux stimuli
Stimuli conditionnels — les stimuli dépendant d'une décision joueur sont-ils marqués ?`,
          `ACHSE 3: ${axe3Title}

Metadaten-Vollständigkeit — hat jeder Stimulus einen Absender, Empfänger, Kanal, Zeitstempel?
Informationslogik:
- Ein Empfänger erhält niemals Informationen, die er zu diesem Zeitpunkt ignorieren soll
- Ein Antwortstimulus kommt nicht vor seinem auslösenden Stimulus an
- Ausbreitungsverzögerungen sind realistisch
Inter-Stimulus faktische Konsistenz — kein Widerspruch zwischen Stimuli
Bedingte Stimuli — sind Stimuli, die von Spielerentscheidungen abhängen, markiert?`
        );

        const axe4 = tt(
          `AXIS 4: ${axe4Title}

Engagement continuity — does each cell receive stimuli at sufficient intervals? Identify gaps > 15 minutes.
Workload management — are there excessive peaks (> 3 stimuli in 5 min for a cell)?
Dynamics — does the pace include accelerations and breathers?
Produce a summary table: number of stimuli per cell and per phase.`,
          `AXE 4 : ${axe4Title}

Continuité d'engagement — chaque cellule reçoit-elle des stimuli à intervalles suffisants ? Identifier les temps morts > 15 minutes.
Gestion de la charge — y a-t-il des pics excessifs (> 3 stimuli en 5 min pour une cellule) ?
Dynamique — le rythme comporte-t-il des accélérations et des respirations ?
Produire un tableau synthétique : nombre de stimuli par cellule et par phase.`,
          `ACHSE 4: ${axe4Title}

Engagement-Kontinuität — erhält jede Zelle Stimuli in ausreichenden Intervallen? Identifiziere Lücken > 15 Minuten.
Arbeitslastmanagement — gibt es übermäßige Spitzen (> 3 Stimuli in 5 Min. für eine Zelle)?
Dynamik — umfasst das Tempo Beschleunigungen und Pausen?
Erstelle eine Übersichtstabelle: Anzahl der Stimuli pro Zelle und Phase.`
        );

        const axe5 = tt(
          `AXIS 5: ${axe5Title}

Are alternative injects planned if players take an unexpected direction?
Does a "nudge" mechanism exist if a cell is stuck?
Are reframing stimuli planned to bring the game back on track?
Does the scenario provide an early stop mechanism?`,
          `AXE 5 : ${axe5Title}

Des injects alternatifs sont-ils prévus si les joueurs prennent une direction inattendue ?
Un mécanisme de "coup de pouce" existe-t-il si une cellule est bloquée ?
Des stimuli de recadrage sont-ils prévus pour ramener le jeu sur les rails ?
Le scénario prévoit-il un mécanisme d'arrêt anticipé ?`,
          `ACHSE 5: ${axe5Title}

Sind alternative Einspielungen geplant, falls Spieler eine unerwartete Richtung einschlagen?
Gibt es einen "Anstoß"-Mechanismus, wenn eine Zelle feststeckt?
Sind Neuausrichtungs-Stimuli geplant, um das Spiel wieder auf Kurs zu bringen?
Sieht das Szenario einen vorzeitigen Abbruchmechanismus vor?`
        );

        const outputFormat = tt(
          `OUTPUT FORMAT

Reply ONLY with a valid JSON object:

{
  "summary": "Global summary in 3-4 sentences",
  "maturity": "first_draft | advanced_draft | ready_to_play",
  "axes": [
    {
      "id": 1,
      "title": "Exercise Completeness",
      "verdict": "satisfactory | acceptable | insufficient",
      "positive": ["positive finding 1", "positive finding 2"],
      "negative": ["negative finding 1 (lines X-Y)", "negative finding 2"],
      "recommendations": ["recommendation 1", "recommendation 2"]
    }
  ],
  "priority_actions": ["priority action 1", "priority action 2", "priority action 3"],
  "stimuli_per_cell_per_phase": {
    "cell_name_1": {"phase_1": 0, "phase_2": 0},
    "cell_name_2": {"phase_1": 0, "phase_2": 0}
  }
}`,
          `FORMAT DE SORTIE

Réponds UNIQUEMENT avec un objet JSON valide :

{
  "summary": "Synthèse globale en 3-4 phrases",
  "maturity": "first_draft | advanced_draft | ready_to_play",
  "axes": [
    {
      "id": 1,
      "title": "Complétude de l'exercice",
      "verdict": "satisfactory | acceptable | insufficient",
      "positive": ["constat positif 1", "constat positif 2"],
      "negative": ["constat négatif 1 (lignes X-Y)", "constat négatif 2"],
      "recommendations": ["recommandation 1", "recommandation 2"]
    }
  ],
  "priority_actions": ["action prioritaire 1", "action prioritaire 2", "action prioritaire 3"],
  "stimuli_per_cell_per_phase": {
    "nom_cellule_1": {"phase_1": 0, "phase_2": 0},
    "nom_cellule_2": {"phase_1": 0, "phase_2": 0}
  }
}`,
          `AUSGABEFORMAT

Antworte NUR mit einem gültigen JSON-Objekt:

{
  "summary": "Globale Zusammenfassung in 3-4 Sätzen",
  "maturity": "first_draft | advanced_draft | ready_to_play",
  "axes": [
    {
      "id": 1,
      "title": "Vollständigkeit der Übung",
      "verdict": "satisfactory | acceptable | insufficient",
      "positive": ["positiver Befund 1", "positiver Befund 2"],
      "negative": ["negativer Befund 1 (Zeilen X-Y)", "negativer Befund 2"],
      "recommendations": ["Empfehlung 1", "Empfehlung 2"]
    }
  ],
  "priority_actions": ["Prioritätsmaßnahme 1", "Prioritätsmaßnahme 2", "Prioritätsmaßnahme 3"],
  "stimuli_per_cell_per_phase": {
    "Zellenname_1": {"Phase_1": 0, "Phase_2": 0},
    "Zellenname_2": {"Phase_1": 0, "Phase_2": 0}
  }
}`
        );

        return `${intro}

${colLabels}
${conciseNote}
${instructions}

---

${axe1}

---

${axe2}

---

${axe3}

---

${axe4}

---

${axe5}

---

${outputFormat}

${serialized}

IMPORTANT: Write your entire response in ${respondInLang}. All verdicts, findings, and recommendations must be in ${respondInLang}.`;
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

        const stepLabel = tt('Timeline Stress-test', 'Stress-test de la timeline', 'Timeline-Stresstest');

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
              indicatorText.textContent = `${tt('Receiving LLM response', 'Réception de la réponse LLM', 'LLM-Antwort wird empfangen')} — ${chars.toLocaleString()} ${tt('chars', 'car.', 'Zeichen')}`;
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
              'Chronogramme volumineux détecté. Le contenu a été résumé pour l\'analyse.',
              'Großes Chronogramm erkannt. Der Inhalt wurde für die Analyse zusammengefasst.'
            ), 'info');
          }

          const prompt = checkerBuildPrompt(serialized, detectedCols, missingCols, false);
          const userPromptPreview = prompt.slice(0, 400);
          let result;
          cs.controller = new AbortController();
          const signal = cs.controller.signal;
          try {
            startLog(userPromptPreview);
            result = await AITextGenerator.generateStreaming('checker_analysis', prompt, 'Reply in strict JSON.', onChunk, 8000, { signal });
            finishLog('done');
          } catch (firstErr) {
            finishLog('error');
            // Retry once, shorter, only when the reply was malformed or cut: never on a key,
            // quota, network or cancel error (it would fail again and cost a second request).
            const retryable = !signal.aborted && /JSON|empty|vide|leer/i.test(String(firstErr?.message || ''));
            if (!retryable) throw firstErr;
            CrisisError.log(firstErr, { operation: 'Crisis Checker analysis first LLM attempt' });
            const concisePrompt = checkerBuildPrompt(serialized, detectedCols, missingCols, true);
            startLog(concisePrompt.slice(0, 400));
            result = await AITextGenerator.generateStreaming('checker_analysis', concisePrompt, 'Reply in strict JSON.', onChunk, 4096, { signal });
            finishLog('done');
          }

          cs.analysisResult = checkerNormalizeResult(result);
          cs.analysisLoading = false;
          cs.activeAxisTab = 0;
          App.render();
          pushToast(tt('Analysis complete.', 'Analyse terminée.', 'Analyse abgeschlossen.'), 'success');
        } catch (err) {
          finishLog('error');
          cs.analysisLoading = false;
          if (cs.controller?.signal.aborted) { cs.controller = null; App.render(); return; }
          cs.analysisError = CrisisError.format(err, { operation: 'Crisis Checker analysis' });
          CrisisError.log(err, { operation: 'Crisis Checker analysis' });
          App.render();
        }
      }

      /* The model's reply, shaped so rendering never breaks on a missing or mistyped field. */
      function checkerNormalizeResult(result) {
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('The AI returned no analysis (malformed JSON).');
        const list = (value) => (Array.isArray(value) ? value : value ? [value] : []).map((item) => typeof item === 'string' ? item : JSON.stringify(item)).filter(Boolean);
        const verdicts = ['satisfactory', 'acceptable', 'insufficient'];
        return {
          ...result,
          summary: typeof result.summary === 'string' ? result.summary : '',
          maturity: ['first_draft', 'advanced_draft', 'ready_to_play'].includes(result.maturity) ? result.maturity : 'first_draft',
          priority_actions: list(result.priority_actions),
          axes: (Array.isArray(result.axes) ? result.axes : []).filter((axis) => axis && typeof axis === 'object').map((axis, index) => ({
            ...axis,
            id: axis.id ?? index + 1,
            title: typeof axis.title === 'string' ? axis.title : `Axis ${index + 1}`,
            verdict: verdicts.includes(axis.verdict) ? axis.verdict : 'acceptable',
            positive: list(axis.positive), negative: list(axis.negative), recommendations: list(axis.recommendations)
          })),
          stimuli_per_cell_per_phase: result.stimuli_per_cell_per_phase && typeof result.stimuli_per_cell_per_phase === 'object' ? result.stimuli_per_cell_per_phase : {}
        };
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
                <strong>${tt('Analyzing…', 'Analyse en cours…', 'Analyse läuft…')}</strong>
                <span style="display:flex; gap:6px;"><button class="btn btn-secondary btn-sm" data-action="checker-cancel">${sbUiIcon('stop', 13)} ${tt('Cancel', 'Annuler', 'Abbrechen')}</button>
                <button class="btn btn-secondary btn-sm" data-action="checker-toggle-llm-stream">
                  ${showStream ? tt('Hide LLM stream', 'Masquer le flux LLM', 'LLM-Stream ausblenden') : tt('Show LLM stream', 'Afficher le flux LLM', 'LLM-Stream anzeigen')}
                </button></span>
              </div>
              <div class="${showStream ? 'checker-progress-layout' : ''}">
                <div class="checker-progress-left">
                  <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
                    <span class="checker-spinner"></span>
                    <span>${tt('Stress-testing timeline across 5 quality axes', 'Stress-test de la timeline selon 5 axes qualité', 'Stresstest der Timeline nach 5 Qualitätsachsen')}</span>
                  </div>
                  ${isStreamingNow ? `
                  <div class="chronogram-stream-indicator" style="margin-bottom:12px;" id="checker-stream-indicator">
                    <span class="chronogram-stream-dot"></span>
                    <span id="checker-stream-indicator-text">${tt('Receiving LLM response', 'Réception de la réponse LLM', 'LLM-Antwort wird empfangen')} — ${streamedChars.toLocaleString()} ${tt('chars', 'car.', 'Zeichen')}</span>
                  </div>` : ''}
                  <div class="subtle" style="font-size:0.85rem;">
                    ${sbUiIcon('clock', 14)} ${tt('This may take 30–60 seconds', 'Cela peut prendre 30 à 60 secondes', 'Dies kann 30–60 Sekunden dauern')}
                  </div>
                </div>
                ${showStream ? `
                <div class="checker-progress-right">
                  <div class="llm-stream-header">${sbUiIcon('message', 14)} ${tt('LLM Live Stream', 'Flux LLM en direct', 'LLM-Livestream')}</div>
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
                <strong>${tt('Analysis failed', 'Échec de l\'analyse', 'Analyse fehlgeschlagen')}</strong>: ${escapeHtml(cs.analysisError)}
              </div>
              <div class="actions" style="margin-top:12px;">
                <button class="btn btn-primary" data-action="checker-analyze">${tt('Retry', 'Réessayer', 'Erneut versuchen')}</button>
              </div>
              ${cs._rawResponse ? `<details style="margin-top:12px;"><summary>${tt('Raw response', 'Réponse brute', 'Rohantwort')}</summary><pre class="checker-raw-response">${escapeHtml(cs._rawResponse)}</pre></details>` : ''}
            </article>
          `;
        }

        if (!cs.analysisResult) return '';

        const r = cs.analysisResult;
        return `
          <article class="card checker-results">
            <div class="section-header" style="margin-bottom:16px;">
              <h3>${cs.mode === 'file' ? escapeHtml(cs.file?.name || '') : tt('Current scenario', 'Scénario actuel', 'Aktuelles Szenario')}</h3>
              <div class="actions">
                <button class="btn btn-secondary" data-action="checker-export-report">${tt('Export .md', 'Exporter .md', 'Exportieren .md')}</button>
                <button class="btn btn-secondary" data-action="checker-export-report-docx">${tt('Export .docx', 'Exporter .docx', 'Exportieren .docx')}</button>
                <button class="btn btn-secondary" data-action="checker-analyze">${tt('Challenge again', 'Challenger à nouveau', 'Erneut prüfen')}</button>
              </div>
            </div>

            ${renderCheckerSummary(r)}
            ${renderCheckerPriorityActions(r)}
            ${renderCheckerAxes(r)}
            ${cs.mode === 'file' ? renderCheckerHeatmap(r) : ''}
          </article>
        `;
      }

      // ─── Render: Summary block ────────────────────────────────────────────────────

      function renderCheckerSummary(result) {
        const maturity = result.maturity || 'first_draft';
        const maturityConfig = {
          first_draft:    { label: tt('First Draft', 'Premier brouillon', 'Erster Entwurf'), cls: 'maturity-red' },
          advanced_draft: { label: tt('Advanced Draft', 'Brouillon avancé', 'Fortgeschrittener Entwurf'), cls: 'maturity-orange' },
          ready_to_play:  { label: tt('Ready to Play', 'Prêt à jouer', 'Spielbereit'), cls: 'maturity-green' }
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
        // On the current scenario, the agent applies one priority action or all of them (the
        // challenge that edits, formerly "Challenge my exercise" in the agent console).
        const fixable = appState.checkerState.mode !== 'file' && isLLMAvailable();
        const busy = typeof getCrisisAgent === 'function' && (getCrisisAgent().active || getCrisisAgent().busy);
        const fix = (index, label) => `<button class="btn ${index === 'all' ? 'btn-primary' : 'btn-ghost'} btn-xs" data-action="checker-fix" data-fix-index="${index}" ${busy ? 'disabled' : ''}>${sbUiIcon('wand', 12)} ${escapeHtml(label)}</button>`;
        return `
          <div class="checker-priority-actions">
            <div class="checker-priority-head"><h4>${tt('Priority Actions', 'Actions prioritaires', 'Prioritätsmaßnahmen')}</h4>${fixable ? fix('all', tt('Fix all with the agent', 'Tout corriger avec l’agent', 'Alle mit dem Agenten beheben')) : ''}</div>
            <ol>
              ${actions.map((a, i) => `<li><span>${escapeHtml(a)}</span>${fixable ? fix(i, tt('Fix', 'Corriger', 'Beheben')) : ''}</li>`).join('')}
            </ol>
            ${fixable && typeof renderAgentPanel === 'function' ? renderAgentPanel({ origin: 'summary' }) : ''}
          </div>
        `;
      }

      // ─── Render: Axes tabs + detail ───────────────────────────────────────────────

      function getAxisLabel(axis, i) {
        if (!axis.title) return tt('Axis', 'Axe', 'Achse') + ' ' + (axis.id || (i + 1));
        return axis.title;
      }

      function renderCheckerAxes(result) {
        const axes = result.axes;
        if (!axes || !axes.length) return '';

        const activeIdx = appState.checkerState.activeAxisTab;
        const verdictIcons = checkerVerdictIcons();

        return `
          <div class="checker-axes">
            <div class="checker-axes-tabs">
              ${axes.map((axis, i) => `
                <button class="checker-axis-tab ${i === activeIdx ? 'active' : ''} checker-axis-${axis.verdict || 'acceptable'}"
                        data-action="checker-select-axis" data-axis-index="${i}">
                  ${verdictIcons[axis.verdict] || verdictIcons.acceptable} ${escapeHtml(getAxisLabel(axis, i))}
                </button>
              `).join('')}
            </div>
            ${renderCheckerAxisDetail(axes[activeIdx] || axes[0])}
          </div>
        `;
      }

      function renderCheckerAxisDetail(axis) {
        if (!axis) return '';
        const verdictIcons = checkerVerdictIcons();
        return `
          <div class="checker-axis-detail">
            <h4>${escapeHtml(axis.title || '')} ${verdictIcons[axis.verdict] || ''}</h4>

            ${(axis.positive && axis.positive.length) ? `
              <div class="checker-findings-group">
                ${axis.positive.map(f => `<div class="checker-finding checker-finding-positive"><span class="checker-finding-icon">${sbUiIcon('check', 13)}</span> ${escapeHtml(f)}</div>`).join('')}
              </div>
            ` : ''}

            ${(axis.negative && axis.negative.length) ? `
              <div class="checker-findings-group">
                ${axis.negative.map(f => `<div class="checker-finding checker-finding-negative"><span class="checker-finding-icon">${sbUiIcon('close', 13)}</span> ${escapeHtml(f)}</div>`).join('')}
              </div>
            ` : ''}

            ${(axis.recommendations && axis.recommendations.length) ? `
              <div class="checker-findings-group">
                <h5>${tt('Recommendations', 'Recommandations', 'Empfehlungen')}</h5>
                ${axis.recommendations.map(r => `<div class="checker-finding checker-recommendation"><span class="checker-finding-icon">${sbUiIcon('chevronRight', 13)}</span> ${escapeHtml(r)}</div>`).join('')}
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
            <h4>${tt('Stimuli Distribution', 'Distribution des stimuli', 'Stimuli-Verteilung')}</h4>
            <div class="checker-heatmap-wrap">
              <table class="checker-heatmap">
                <thead>
                  <tr>
                    <th>${tt('Cell', 'Cellule', 'Zelle')}</th>
                    ${phases.map(p => `<th>${escapeHtml(p)}</th>`).join('')}
                    <th><strong>${tt('Total', 'Total', 'Gesamt')}</strong></th>
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
                    <td><strong>${tt('Total', 'Total', 'Gesamt')}</strong></td>
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
            title: tt('Playability & Operational Feasibility', 'Jouabilité et faisabilité opérationnelle', 'Spielbarkeit und operative Machbarkeit'),
            items: [
              tt('The number of stimuli is compatible with the size of the animation team',
                 'Le nombre de stimuli est compatible avec la taille de l\'équipe d\'animation',
                 'Die Anzahl der Stimuli ist mit der Größe des Animationsteams kompatibel'),
              tt('Animation roles are clearly assigned (who sends what, who plays which external role)',
                 'Les rôles d\'animation sont clairement répartis (qui envoie quoi, qui joue quel rôle externe)',
                 'Animationsrollen sind klar zugewiesen (wer sendet was, wer spielt welche externe Rolle)'),
              tt('Supporting materials are ready and consistent (fake articles, fake tweets, fake emails, notification templates)',
                 'Les supports sont prêts et cohérents (faux articles, faux tweets, faux mails, templates de notification)',
                 'Unterstützungsmaterialien sind bereit und konsistent (gefälschte Artikel, Tweets, E-Mails, Benachrichtigungsvorlagen)'),
              tt('Required tools are identified and available (room, phones, collaborative tools, chronolog)',
                 'Les outils nécessaires sont identifiés et disponibles (salle, téléphones, outils collaboratifs, main courante)',
                 'Erforderliche Tools sind identifiziert und verfügbar (Raum, Telefone, Kollaborationstools, Chronolog)'),
              tt('Instructions for facilitators are sufficiently precise',
                 'Les consignes pour les animateurs/facilitateurs sont suffisamment précises',
                 'Anweisungen für Moderatoren sind ausreichend präzise')
            ]
          },
          {
            key: 'observation',
            title: tt('Observation & Evaluation Framework', 'Dispositif d\'observation et d\'évaluation', 'Beobachtungs- und Bewertungsrahmen'),
            items: [
              tt('Observers are positioned in each cell',
                 'Des observateurs sont positionnés dans chaque cellule',
                 'Beobachter sind in jeder Zelle positioniert'),
              tt('An observation grid is provided with measurable criteria (reaction time, decision quality, coordination, communication)',
                 'Une grille d\'observation est fournie avec des critères mesurables (temps de réaction, qualité des décisions, coordination, communication)',
                 'Ein Beobachtungsraster mit messbaren Kriterien ist vorhanden (Reaktionszeit, Entscheidungsqualität, Koordination, Kommunikation)'),
              tt('Mandatory checkpoints (key decisions, expected escalations) are identified',
                 'Les points de passage obligés (décisions clés, escalades attendues) sont identifiés',
                 'Pflichtprüfpunkte (Schlüsselentscheidungen, erwartete Eskalationen) sind identifiziert'),
              tt('The after-action review process is planned (hot debrief, cold debrief, questionnaire)',
                 'Le dispositif RETEX est prévu (hot debrief, cold debrief, questionnaire)',
                 'Der Nachbesprechungsprozess ist geplant (Hot-Debrief, Cold-Debrief, Fragebogen)')
            ]
          },
          {
            key: 'realism',
            title: tt('Realism & Credibility of Materials', 'Réalisme et crédibilité des supports', 'Realismus und Glaubwürdigkeit der Materialien'),
            items: [
              tt('Stimuli are written in a style consistent with their supposed sender',
                 'Les stimuli sont rédigés dans un style cohérent avec leur émetteur supposé',
                 'Stimuli sind in einem dem angeblichen Absender entsprechenden Stil verfasst'),
              tt('Factual elements (names, dates, figures, geography) are consistent with each other',
                 'Les éléments factuels (noms, dates, chiffres, géographie) sont cohérents entre eux',
                 'Faktische Elemente (Namen, Daten, Zahlen, Geografie) sind untereinander konsistent'),
              tt('Fake media/social media content is visually credible',
                 'Les faux contenus médias/réseaux sociaux sont visuellement crédibles',
                 'Gefälschte Medien-/Social-Media-Inhalte sind visuell glaubwürdig'),
              tt('Regulatory or contractual references mentioned are correct',
                 'Les références réglementaires ou contractuelles mentionnées sont correctes',
                 'Genannte regulatorische oder vertragliche Referenzen sind korrekt')
            ]
          }
        ];
      }

      // ─── Checklist persistence ────────────────────────────────────────────────────

      /* The ready-to-play checklist belongs to the project (project.checklist): it is saved
         in the browser autosave and in project files with the rest of the exercise. */
      function checkerChecklist() {
        const project = appState.scenario;
        if (!project.checklist || typeof project.checklist !== 'object') project.checklist = normalizeChecklist(null);
        if (!project.checklist.checked) project.checklist.checked = {};
        if (!project.checklist.customItems) project.checklist.customItems = {};
        return project.checklist;
      }

      // Older versions kept one checklist for every project under this browser key.
      function checkerLegacyChecklistKey() {
        let hash = 0;
        for (const char of '_default') hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
        return `crisis_checker_checklist_${Math.abs(hash)}`;
      }

      /* Moves the old shared checklist into the current project, once, unless it has its own. */
      function checkerLoadChecklist() {
        try {
          const key = checkerLegacyChecklistKey();
          const stored = localStorage.getItem(key);
          if (!stored) return false;
          localStorage.removeItem(key);
          const current = checkerChecklist();
          if (Object.keys(current.checked).length || Object.values(current.customItems).some((list) => list.length)) return false;
          appState.scenario.checklist = normalizeChecklist(JSON.parse(stored));
          if (typeof saveLocal === 'function') saveLocal(false);
          return true;
        } catch (e) { return false; /* ignore parse and storage errors */ }
      }

      function checkerSaveChecklist() {
        appState.scenario.checklist = normalizeChecklist(checkerChecklist());
        if (typeof saveLocal === 'function') saveLocal(false);
      }

      // ─── Render: Checklist ────────────────────────────────────────────────────────

      function renderCheckerChecklist() {
        const categories = checkerGetChecklistCategories();
        const cl = checkerChecklist();
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
              <h3>${tt('Ready to Play Checklist', 'Checklist « Prêt à jouer »', 'Spielbereit-Checkliste')}</h3>
              ${allDone ? `<span class="checker-maturity-badge maturity-green">${sbUiIcon('checkCircle', 13)} ${tt('Ready to Play', 'Prêt à jouer', 'Spielbereit')}</span>` : ''}
            </div>

            ${categories.map(cat => renderCheckerChecklistCategory(cat, checked, customItems)).join('')}

            <div class="checker-checklist-progress">
              <div class="checker-checklist-progress-bar">
                <div class="checker-checklist-progress-fill" style="width:${pct}%"></div>
              </div>
              <span class="checker-checklist-progress-text">${tt('Progress:', 'Progression :', 'Fortschritt:')} ${checkedCount} / ${totalItems} ${tt('items checked', 'éléments cochés', 'Elemente geprüft')}</span>
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
                  ${isCustom ? `<button class="checker-remove-custom" data-action="checker-remove-custom-item" data-cat-key="${category.key}" data-custom-index="${i - category.items.length}" title="${escapeAttribute(tt('Remove', 'Supprimer', 'Entfernen'))}">${sbUiIcon('close', 13)}</button>` : ''}
                </label>
              `;
            }).join('')}
            <button class="checker-add-item" data-action="checker-add-custom-item" data-cat-key="${category.key}">
              + ${tt('Add custom item', 'Ajouter un élément', 'Eigenes Element hinzufügen')}
            </button>
          </div>
        `;
      }

      // ─── Checklist event binding ──────────────────────────────────────────────────

      function bindCheckerChecklistEvents() {
        document.querySelectorAll('[data-action="checker-toggle-check"]').forEach(cb => {
          cb.addEventListener('change', () => {
            const key = cb.dataset.checkKey;
            checkerChecklist().checked[key] = cb.checked;
            checkerSaveChecklist();
            App.render();
          });
        });

        document.querySelectorAll('[data-action="checker-add-custom-item"]').forEach(btn => {
          btn.addEventListener('click', () => {
            const catKey = btn.dataset.catKey;
            const text = prompt(tt('Enter custom checklist item:', 'Saisissez l\'élément personnalisé :', 'Eigenes Listenelement eingeben:'));
            if (!text || !text.trim()) return;
            const customItems = checkerChecklist().customItems;
            if (!customItems[catKey]) customItems[catKey] = [];
            customItems[catKey].push(text.trim());
            checkerSaveChecklist();
            App.render();
          });
        });

        document.querySelectorAll('[data-action="checker-remove-custom-item"]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const catKey = btn.dataset.catKey;
            const idx = parseInt(btn.dataset.customIndex, 10);
            const customs = checkerChecklist().customItems[catKey];
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
        try {
          const cs = appState.checkerState;
          const r = cs.analysisResult;
          const mode = cs.mode || 'file';
          const fileName = mode === 'scenario'
            ? (appState.scenario.name || tt('Current Scenario', 'Scénario actuel', 'Aktuelles Szenario'))
            : (cs.file ? cs.file.name : 'unknown');
          const date = new Date().toISOString().slice(0, 10);
          const categories = checkerGetChecklistCategories();
          const cl = checkerChecklist();
          const checked = cl.checked || {};
          const customItems = cl.customItems || {};

        const verdictLabels = {
          satisfactory: tt('✅ Satisfactory', '✅ Satisfaisant', '✅ Zufriedenstellend'),
          acceptable: tt('⚠️ Acceptable', '⚠️ Acceptable', '⚠️ Akzeptabel'),
          insufficient: tt('❌ Insufficient', '❌ Insuffisant', '❌ Unzureichend')
        };
        const maturityLabels = {
          first_draft: tt('First Draft', 'Premier brouillon', 'Erster Entwurf'),
          advanced_draft: tt('Advanced Draft', 'Brouillon avancé', 'Fortgeschrittener Entwurf'),
          ready_to_play: tt('Ready to Play', 'Prêt à jouer', 'Spielbereit')
        };

        let md = `# ${tt('Crisis Checker Report', 'Rapport Crisis Checker', 'Crisis Checker Bericht')} — ${fileName}\n${tt('Generated', 'Généré le', 'Erstellt am')}: ${date}\n\n`;

        if (r) {
          md += `## ${tt('Summary', 'Synthèse', 'Zusammenfassung')}\n**${tt('Maturity', 'Maturité', 'Reifegrad')}**: ${maturityLabels[r.maturity] || r.maturity}\n\n${r.summary || ''}\n\n`;

          if (r.priority_actions && r.priority_actions.length) {
            md += `## ${tt('Priority Actions', 'Actions prioritaires', 'Prioritätsmaßnahmen')}\n`;
            r.priority_actions.forEach((a, i) => { md += `${i + 1}. ${a}\n`; });
            md += '\n';
          }

          if (r.axes) {
            r.axes.forEach(axis => {
              md += `## ${tt('Axis', 'Axe', 'Achse')} ${axis.id}: ${axis.title} — ${verdictLabels[axis.verdict] || axis.verdict}\n\n`;
              if (axis.positive && axis.positive.length) {
                md += `### ${tt('Positive findings', 'Constats positifs', 'Positive Befunde')}\n`;
                axis.positive.forEach(f => { md += `- ✓ ${f}\n`; });
                md += '\n';
              }
              if (axis.negative && axis.negative.length) {
                md += `### ${tt('Negative findings', 'Constats négatifs', 'Negative Befunde')}\n`;
                axis.negative.forEach(f => { md += `- ✗ ${f}\n`; });
                md += '\n';
              }
              if (axis.recommendations && axis.recommendations.length) {
                md += `### ${tt('Recommendations', 'Recommandations', 'Empfehlungen')}\n`;
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

            md += `## ${tt('Stimuli Distribution', 'Distribution des stimuli', 'Stimuli-Verteilung')}\n\n`;
            md += `| ${tt('Cell', 'Cellule', 'Zelle')} | ${phases.join(' | ')} | Total |\n`;
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
        md += `## ${tt('Ready to Play Checklist', 'Checklist « Prêt à jouer »', 'Spielbereit-Checkliste')}\n\n`;
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
        md += `**${tt('Progress', 'Progression', 'Fortschritt')}**: ${checkedCount} / ${totalItems}\n`;

        // Download
        const safeName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        downloadBlob(blob, `crisis_check_${safeName}_${date}.md`);
          pushToast(tt('Report exported.', 'Rapport exporté.', 'Bericht exportiert.'), 'success');
        } catch (error) {
          CrisisError.toast(error, { operation: 'Export Crisis Checker Markdown report' });
        }
      }

      // ─── Export DOCX report ───────────────────────────────────────────────────

      function checkerExportReportDocx() {
        const cs = appState.checkerState;
        const r = cs.analysisResult;
        const mode = cs.mode || 'file';
        const fileName = mode === 'scenario'
          ? (appState.scenario.name || tt('Current Scenario', 'Scénario actuel', 'Aktuelles Szenario'))
          : (cs.file ? cs.file.name : 'unknown');
        const date = new Date().toISOString().slice(0, 10);
        const categories = checkerGetChecklistCategories();
        const cl = checkerChecklist();
        const checked = cl.checked || {};
        const customItems = cl.customItems || {};

        const verdictLabels = {
          satisfactory: tt('Satisfactory', 'Satisfaisant', 'Zufriedenstellend'),
          acceptable: tt('Acceptable', 'Acceptable', 'Akzeptabel'),
          insufficient: tt('Insufficient', 'Insuffisant', 'Unzureichend')
        };
        const maturityLabels = {
          first_draft: tt('First Draft', 'Premier brouillon', 'Erster Entwurf'),
          advanced_draft: tt('Advanced Draft', 'Brouillon avancé', 'Fortgeschrittener Entwurf'),
          ready_to_play: tt('Ready to Play', 'Prêt à jouer', 'Spielbereit')
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

        body.push(para(`${tt('Crisis Checker Report', 'Rapport Crisis Checker', 'Crisis Checker Bericht')} — ${fileName}`, 'CrisisTitle'));
        body.push(para(`${tt('Generated', 'Généré le', 'Erstellt am')}: ${date}`, 'CrisisSubtitle'));
        body.push(para(''));

        if (r) {
          body.push(para(tt('Summary', 'Synthèse', 'Zusammenfassung'), 'Heading1'));
          body.push(boldPara(`${tt('Maturity', 'Maturité', 'Reifegrad')}: `, maturityLabels[r.maturity] || r.maturity));
          if (r.summary) body.push(para(r.summary));
          body.push(para(''));

          if (r.priority_actions && r.priority_actions.length) {
            body.push(para(tt('Priority Actions', 'Actions prioritaires', 'Prioritätsmaßnahmen'), 'Heading1'));
            r.priority_actions.forEach(a => body.push(listPara(a, 2)));
            body.push(para(''));
          }

          if (r.axes) {
            r.axes.forEach(axis => {
              body.push(para(`${tt('Axis', 'Axe', 'Achse')} ${axis.id}: ${axis.title} — ${verdictLabels[axis.verdict] || axis.verdict}`, 'Heading1'));
              if (axis.positive && axis.positive.length) {
                body.push(para(tt('Positive findings', 'Constats positifs', 'Positive Befunde'), 'Heading2'));
                axis.positive.forEach(f => body.push(listPara(`✓ ${f}`, 1)));
              }
              if (axis.negative && axis.negative.length) {
                body.push(para(tt('Negative findings', 'Constats négatifs', 'Negative Befunde'), 'Heading2'));
                axis.negative.forEach(f => body.push(listPara(`✗ ${f}`, 1)));
              }
              if (axis.recommendations && axis.recommendations.length) {
                body.push(para(tt('Recommendations', 'Recommandations', 'Empfehlungen'), 'Heading2'));
                axis.recommendations.forEach(rec => body.push(listPara(`→ ${rec}`, 1)));
              }
              body.push(para(''));
            });
          }

          const data = r.stimuli_per_cell_per_phase;
          if (data && Object.keys(data).length) {
            body.push(para(tt('Stimuli Distribution', 'Distribution des stimuli', 'Stimuli-Verteilung'), 'Heading1'));
            const cells = Object.keys(data);
            const phaseSet = new Set();
            cells.forEach(c => Object.keys(data[c]).forEach(p => phaseSet.add(p)));
            const phases = [...phaseSet];
            const rows = [];
            rows.push(tableRow([tt('Cell', 'Cellule', 'Zelle'), ...phases, 'Total'], true));
            cells.forEach(cell => {
              const vals = phases.map(p => String(data[cell][p] || 0));
              const total = vals.reduce((s, v) => s + parseInt(v, 10), 0);
              rows.push(tableRow([cell, ...vals, String(total)], false));
            });
            body.push(`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows.join('')}</w:tbl>`);
            body.push(para(''));
          }
        }

        body.push(para(tt('Ready to Play Checklist', 'Checklist « Prêt à jouer »', 'Spielbereit-Checkliste'), 'Heading1'));
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
        body.push(boldPara(`${tt('Progress', 'Progression', 'Fortschritt')}: `, `${checkedCount} / ${totalItems}`));

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
            pushToast(tt('Report exported.', 'Rapport exporté.', 'Bericht exportiert.'), 'success');
          })
          .catch(error => {
            CrisisError.toast(error, { operation: 'Export Crisis Checker DOCX report', detail: `Source=${fileName}` });
          });
      }

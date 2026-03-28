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

      // ─── Column letter helper ─────────────────────────────────────────────────────

      function checkerColLetter(index) {
        return String.fromCharCode(65 + (index % 26));
      }

      // ─── Render: Main Checker View ────────────────────────────────────────────────

      function renderCheckerView() {
        const cs = appState.checkerState;
        return `
          <section class="grid" style="max-width:960px; margin: 0 auto;">
            ${cs.parsedData ? renderCheckerImported() : renderCheckerDropZone()}
          </section>
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

        return `
          <div class="checker-mapping">
            <h4>${tt('Column Mapping', 'Correspondance des colonnes')}</h4>
            <div class="checker-mapping-grid">
              ${Object.keys(CHECKER_COLUMN_PATTERNS).map(colKey => {
                const val = mapping[colKey];
                const label = CHECKER_COLUMN_LABELS[colKey]();
                const isMissing = val === null;
                return `
                  <div class="checker-mapping-row">
                    <label>${label}:</label>
                    <select data-action="checker-update-mapping" data-col-key="${colKey}">
                      <option value="-1" ${isMissing ? 'selected' : ''}>${notDetected}</option>
                      ${pd.headers.map((h, i) => `<option value="${i}" ${val === i ? 'selected' : ''}>${tt('Column', 'Colonne')} ${checkerColLetter(i)} — "${escapeHtml(h)}"</option>`).join('')}
                    </select>
                    ${isMissing ? '<span class="checker-mapping-warn" title="' + escapeAttribute(tt('Not detected', 'Non détecté')) + '">⚠</span>' : ''}
                  </div>
                `;
              }).join('')}
            </div>
            ${hasMissing ? `<p class="checker-mapping-note">${tt('⚠ Missing columns will be flagged in the analysis.', '⚠ Les colonnes manquantes seront signalées dans l\'analyse.')}</p>` : ''}
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
          const mapping = checkerAutoDetectColumns(result.headers);

          appState.checkerState.file = { name: file.name, size: file.size, type: file.type };
          appState.checkerState.parsedData = { headers: result.headers, rows: result.rows, workbook: result.workbook, isPptx: !!result.isPptx };
          appState.checkerState.sheets = result.sheets;
          appState.checkerState.selectedSheet = result.selectedSheet;
          appState.checkerState.columnMapping = mapping;
          appState.checkerState.analysisResult = null;
          appState.checkerState.analysisError = null;
          appState.checkerState.checklist = {};

          App.render();
          pushToast(tt(`File loaded: ${file.name}`, `Fichier chargé : ${file.name}`), 'success');
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
        cs.analysisResult = null;
        cs.analysisError = null;
        App.render();
      }

      function checkerClearFile() {
        appState.checkerState = {
          file: null,
          parsedData: null,
          sheets: [],
          selectedSheet: '',
          columnMapping: {},
          analysisResult: null,
          analysisLoading: false,
          analysisError: null,
          checklist: {},
          activeAxisTab: 0
        };
        App.render();
      }

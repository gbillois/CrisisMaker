      // ─── Chronogram AI Import: Core Logic & LLM Pipeline ───

      const ChronogramImport = {

        // ── Excel preparation ──

        prepareExcelForLLM(workbook) {
          const result = {
            sheet_names: workbook.SheetNames,
            sheets: {}
          };
          for (const name of workbook.SheetNames) {
            const sheet = workbook.Sheets[name];
            const data = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: '',
              blankrows: false
            });
            result.sheets[name] = {
              row_count: data.length,
              preview_rows: data.slice(0, 10),
              all_rows: data
            };
          }
          return result;
        },

        detectMainSheet(sheetNames) {
          const lower = sheetNames.map(n => n.toLowerCase());
          const chronoIdx = lower.findIndex(n => n.includes('chrono'));
          if (chronoIdx >= 0) return sheetNames[chronoIdx];
          const excluded = /role|aide|read|accueil|help|readme/i;
          let best = null, bestRows = 0;
          for (const name of sheetNames) {
            if (excluded.test(name)) continue;
            if (!best) { best = name; continue; }
          }
          return best || sheetNames[0];
        },

        // ── LLM call with retry ──

        async callLLMWithRetry(systemPrompt, userPrompt, maxRetries = 2, maxTokens = 8192) {
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const result = await AITextGenerator.generate(
                'chronogram_import',
                systemPrompt,
                userPrompt,
                true,
                maxTokens
              );
              if (!result || typeof result !== 'object') {
                throw new Error(tt('LLM response was not valid JSON.', 'La réponse du LLM n\'était pas un JSON valide.'));
              }
              return result;
            } catch (err) {
              if (attempt === maxRetries) {
                throw new Error(
                  tt(
                    `AI import failed after ${maxRetries + 1} attempts. Last error: ${err.message}`,
                    `Import IA échoué après ${maxRetries + 1} tentatives. Dernière erreur : ${err.message}`
                  )
                );
              }
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        },

        // ── Step 1: Structure analysis ──

        step1SystemPrompt() {
          return `Tu es un expert en exercices de gestion de crise cyber. On te fournit le contenu d'un fichier Excel de chronogramme d'exercice de crise. Ce fichier peut avoir n'importe quel format.

Ta mission : analyser la structure du fichier et identifier les éléments clés.

Règles :
- Le chronogramme principal est la feuille qui contient la séquence complète des stimuli avec horaires, émetteurs, destinataires et contenus.
- Les feuilles de type "Role_*" ou "Aide_*" sont des vues filtrées du chronogramme principal, PAS la source de vérité.
- Les feuilles de type "Read_me" ou "Accueil" contiennent souvent le contexte général (synopsis, rôles, objectifs).
- La ligne de headers peut ne pas être la première ligne (il peut y avoir des lignes de titre, des lignes vides, ou des logos).
- Les horaires peuvent être en formats variés : "9h15", "09:15", "9:15:00", datetime Excel, texte libre.
- Certaines lignes sont des séparateurs visuels ("Début de l'exercice", "Fin de l'exercice", "Préambule"), pas des stimuli.

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas de commentaires) :
{
  "main_sheet": "string",
  "context_sheets": ["string"],
  "ignored_sheets": ["string"],
  "header_row_index": number,
  "first_data_row_index": number,
  "column_mapping": {
    "number": number_or_null,
    "time": number_or_null,
    "sender": number_or_null,
    "transmission_mode": number_or_null,
    "recipient": number_or_null,
    "content": number_or_null,
    "expected_reactions": number_or_null,
    "facilitator_comments": number_or_null,
    "deliverables": number_or_null
  },
  "time_format": "absolute|relative|mixed",
  "time_reference": "absolute|relative",
  "exercise_start_time": "HH:MM",
  "synopsis": "string",
  "scenario_type": "string",
  "roles_identified": [{"label": "string", "crisisstim_role": "string"}],
  "meta_rows_to_skip": [number],
  "total_stimulus_rows": number,
  "notes": "string"
}`;
        },

        step1UserPrompt(excelData, userContext) {
          let prompt = `Voici le contenu du fichier Excel.\n\nNoms des feuilles : ${JSON.stringify(excelData.sheet_names)}\n\n`;
          for (const name of excelData.sheet_names) {
            const sheet = excelData.sheets[name];
            prompt += `=== Feuille : ${name} (${sheet.row_count} lignes) ===\n`;
            const preview = sheet.preview_rows.slice(0, 10);
            for (let i = 0; i < preview.length; i++) {
              prompt += `Ligne ${i}: ${JSON.stringify(preview[i])}\n`;
            }
            prompt += '\n';
          }
          prompt += `Contexte additionnel fourni par l'utilisateur :\n${userContext || 'Aucun'}\n\nAnalyse la structure de ce fichier et réponds avec le JSON demandé.`;
          return prompt;
        },

        async callLLM_Step1(excelData, userContext) {
          return this.callLLMWithRetry(
            this.step1SystemPrompt(),
            this.step1UserPrompt(excelData, userContext)
          );
        },

        // ── Step 2: Extraction & classification ──

        step2SystemPrompt() {
          return `Tu es un expert en exercices de gestion de crise cyber. Tu analyses les lignes d'un chronogramme d'exercice pour identifier tous les stimuli à produire, y compris les stimuli IMPLICITES.

STIMULI IMPLICITES : un stimulus peut en contenir d'autres de manière implicite. Exemples :
- "Je viens de voir un post sur les réseaux sociaux qui dit que..." → 2 stimuli : l'email/appel qui rapporte l'info ET le post réseau social lui-même
- "Vous trouverez en PJ le mail de l'attaquant" → 2 stimuli : l'email de transmission ET le mail de l'attaquant
- "Capture d'écran du compte à rebours" dans la colonne livrables → 1 stimulus implicite supplémentaire
- "Post publié sur les réseaux sociaux" → 1 stimulus implicite : le post original

COMPLÉTUDE DU CONTENU : pour chaque stimulus, évalue si le contenu est COMPLET ou INCOMPLET.
- COMPLET (content_complete: true) : le texte intégral du stimulus est présent (ex: corps d'email complet, texte de tweet complet). Le contenu sera utilisé tel quel.
- INCOMPLET (content_complete: false) : seule une description/résumé est fourni (ex: "envoyer un article de presse", "le DSI envoie un message d'alerte"). Le LLM devra générer le contenu complet à l'étape suivante.

CANAUX DISPONIBLES dans CrisisStim :
- email_internal : email avec chrome Outlook (communications internes)
- email_external : email générique (communications externes)
- email_authority : email officiel d'autorité (ANSSI, CNIL, régulateur)
- article_press : article de journal en ligne
- breaking_news_tv : bandeau TV info urgente
- post_twitter : post X/Twitter
- post_linkedin : post LinkedIn
- press_release : communiqué de presse officiel
- sms_notification : SMS ou notification push
- internal_memo : note interne / mémo de service

RÔLES D'ACTEURS DISPONIBLES :
- journalist, authority, client_b2b, client_b2c, internal, partner, attacker, analyst

RÈGLES :
- Les lignes de type Animation/DEBEX/FINEX sont des méta-stimuli. Classe-les avec type "meta_animation".
- Les lignes de type Préambule/Synopsis sont des contextes. Classe-les avec type "context".
- Pour le canal : infère-le depuis le CONTENU du stimulus, pas depuis le format du chronogramme. Un appel téléphonique sera rendu comme email_internal car CrisisStim produit des visuels statiques. Exception : si le contenu mentionne explicitement un post réseau social, un article de presse, un SMS, etc., utilise le canal correspondant.
- Pour l'horaire : convertis en minutes depuis le début de l'exercice (exercise_start_time).
- Les fautes d'orthographe dans le contenu original DOIVENT être conservées telles quelles.

Réponds UNIQUEMENT avec un tableau JSON (pas de markdown, pas de commentaires).
Chaque élément du tableau :
{
  "source_row": number,
  "source_number": number_or_null,
  "type": "stimulus|meta_animation|context",
  "skip_reason": "string_or_null",
  "stimuli": [
    {
      "is_implicit": boolean,
      "content_complete": boolean,
      "channel": "string",
      "timestamp_offset_minutes": number,
      "sender_name": "string",
      "sender_role": "string",
      "sender_organization": "string",
      "sender_title": "string",
      "recipient_label": "string_or_null",
      "content_summary": "string",
      "original_content": "string",
      "implicit_source_description": "string_or_null",
      "deliverables": "string_or_null"
    }
  ]
}`;
        },

        step2UserPrompt(rows, structureAnalysis, startIdx, endIdx, prevBatchLastRows) {
          const colMap = structureAnalysis.column_mapping;
          const colDesc = Object.entries(colMap)
            .filter(([, v]) => v != null)
            .map(([k, v]) => `${k} (col ${v})`)
            .join(', ');

          let prompt = `CONTEXTE DU FICHIER :
- Synopsis : ${structureAnalysis.synopsis || 'Non disponible'}
- Type de scénario : ${structureAnalysis.scenario_type || 'Non précisé'}
- Heure de début de l'exercice : ${structureAnalysis.exercise_start_time || '00:00'}
- Rôles identifiés : ${JSON.stringify(structureAnalysis.roles_identified || [])}

STRUCTURE DU CHRONOGRAMME :
- Feuille : ${structureAnalysis.main_sheet}
- Colonnes : ${colDesc}

DONNÉES (lignes ${startIdx} à ${endIdx}) :\n`;

          for (let i = startIdx; i <= endIdx && i < rows.length; i++) {
            prompt += `Ligne ${i}: ${JSON.stringify(rows[i])}\n`;
          }

          if (prevBatchLastRows && prevBatchLastRows.length > 0) {
            prompt += `\nCONTEXTE DE CONTINUITÉ (dernières lignes du batch précédent) :\n`;
            for (const row of prevBatchLastRows) {
              prompt += `${JSON.stringify(row)}\n`;
            }
          }

          prompt += `\nExtrais et classifie tous les stimuli. Réponds avec le JSON demandé.`;
          return prompt;
        },

        async callLLM_Step2_Batched(allRows, structureAnalysis, updateProgress) {
          const firstDataRow = structureAnalysis.first_data_row_index || 0;
          const skipRows = new Set(structureAnalysis.meta_rows_to_skip || []);
          const dataRows = [];
          for (let i = firstDataRow; i < allRows.length; i++) {
            if (!skipRows.has(i)) dataRows.push({ idx: i, data: allRows[i] });
          }

          const BATCH_SIZE = 20;
          const batches = [];
          for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
            batches.push(dataRows.slice(i, i + BATCH_SIZE));
          }

          const allExtracted = [];
          for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            const startIdx = batch[0].idx;
            const endIdx = batch[batch.length - 1].idx;
            const prevLastRows = b > 0 ? batches[b - 1].slice(-2).map(r => r.data) : null;

            if (updateProgress) {
              updateProgress(
                tt(
                  `Extracting stimuli... batch ${b + 1}/${batches.length}`,
                  `Extraction des stimuli... lot ${b + 1}/${batches.length}`
                )
              );
            }

            const result = await this.callLLMWithRetry(
              this.step2SystemPrompt(),
              this.step2UserPrompt(allRows, structureAnalysis, startIdx, endIdx, prevLastRows)
            );

            const items = Array.isArray(result) ? result : (result.rows || result.stimuli || []);
            allExtracted.push(...items);
          }

          return allExtracted;
        },

        // ── Step 3: CrisisStim mapping ──

        step3SystemPrompt() {
          return `Tu es un expert CrisisStim. Tu convertis des stimuli extraits d'un chronogramme en objets CrisisStim complets, prêts à être insérés dans un projet.

MODÈLE DE DONNÉES CRISISSTIM :

Un stimulus CrisisStim a la structure suivante :
{
  "id": "string (placeholder, sera remplacé)",
  "channel": "email_internal | email_external | email_authority | article_press | breaking_news_tv | post_twitter | post_linkedin | press_release | sms_notification | internal_memo",
  "template_id": "voir mapping ci-dessous",
  "actor_id": "string (placeholder)",
  "timestamp_offset_minutes": number,
  "status": "draft",
  "generation_mode": "ai_guided",
  "generation_prompt": "string",
  "fields": { ... }
}

MAPPING CHANNEL → TEMPLATE_ID :
- email_internal → "outlook"
- email_external → "generic"
- email_authority → "anssi" (FR) | "generic"
- article_press → "lemonde" (FR) | "nyt" (EN) | "generic_press"
- breaking_news_tv → "bfm" (FR) | "cnn" (EN)
- post_twitter → "twitter"
- post_linkedin → "linkedin"
- press_release → "generic"
- sms_notification → "iphone"
- internal_memo → "generic"

CHAMPS PAR TEMPLATE :

email_internal (outlook) :
  from_name, from_email, to, cc, subject, date, body, has_attachment, attachment_name, importance

email_external (generic) :
  from_name, from_email, to, cc, subject, date, body, has_attachment, attachment_name, importance

email_authority (anssi) :
  reference, from_name, from_email, to, subject, date, body, severity

post_twitter (twitter) :
  display_name, handle, text, date, retweets, likes, verified, verified_type, avatar_initials, avatar_color, quotes, views, replies

post_linkedin (linkedin) :
  display_name, title, avatar_initials, avatar_color, text, date, reactions_count, comments_count, reposts_count

article_press (all) :
  headline, subheadline, author, date, category, body, image_caption, read_time

breaking_news_tv (bfm/cnn) :
  headline, subline, ticker, time, category

press_release (generic) :
  organization, logo_text, logo_color, date, title, body, contact_name, contact_email, contact_phone

sms_notification :
  sender, text, time, device

internal_memo :
  from_name, to, date, subject, classification, body

COMPLÉTUDE DU CONTENU :
- Si le champ "content_complete" est true : le champ "body"/"text" des fields doit reprendre le contenu ORIGINAL du chronogramme, tel quel, y compris les fautes d'orthographe intentionnelles. NE PAS résumer.
- Si le champ "content_complete" est false : GÉNÈRE un contenu complet et réaliste pour le stimulus, cohérent avec le synopsis, le canal, l'émetteur et le contexte. Invente des détails crédibles. Le contenu doit être assez long et réaliste pour une simulation d'exercice de crise.
- Pour les stimuli implicites (posts réseaux sociaux, mails d'attaquants), INVENTE TOUJOURS un contenu réaliste.

RÈGLES :
- Génère des métriques réalistes pour les posts sociaux (likes, retweets, etc.)
- Le template_id doit être cohérent avec la langue du projet.
- Chaque acteur doit avoir un id unique. Deux stimuli du même émetteur doivent référencer le même actor_id.

Réponds UNIQUEMENT avec un objet JSON valide :
{
  "actors": [{"id": "string", "name": "string", "role": "string", "organization": "string", "title": "string", "language": "string", "avatar_initials": "string"}],
  "stimuli": [{"id": "string", "source_row": number, "is_implicit": boolean, "channel": "string", "template_id": "string", "actor_id": "string", "timestamp_offset_minutes": number, "status": "draft", "generation_mode": "ai_guided", "generation_prompt": "string", "fields": {...}}],
  "warnings": [{"source_row": number, "type": "string", "message": "string"}],
  "skipped_rows": [{"source_row": number, "reason": "string"}]
}`;
        },

        step3UserPrompt(extractedStimuli, structureAnalysis, projectData) {
          const lang = projectData.client?.language || projectData.settings?.language || 'fr';
          return `CONTEXTE DU PROJET :
- Langue : ${lang}
- Synopsis : ${structureAnalysis.synopsis || 'Non disponible'}
- Type de scénario : ${structureAnalysis.scenario_type || 'Non précisé'}
- Heure de début : ${structureAnalysis.exercise_start_time || '00:00'}

STIMULI EXTRAITS À L'ÉTAPE PRÉCÉDENTE :
${JSON.stringify(extractedStimuli, null, 2)}

OPTIONS :
- Créer les acteurs : oui

Convertis ces stimuli en objets CrisisStim complets. Pour les stimuli avec content_complete=false, génère un contenu complet et réaliste. Pour les stimuli avec content_complete=true, conserve le contenu original tel quel. Réponds avec le JSON demandé.`;
        },

        async callLLM_Step3(extractedStimuli, structureAnalysis, projectData) {
          return this.callLLMWithRetry(
            this.step3SystemPrompt(),
            this.step3UserPrompt(extractedStimuli, structureAnalysis, projectData),
            2,
            16384
          );
        },

        // ── Validation ──

        validateOffsets(stimuli) {
          for (const stim of stimuli) {
            if (typeof stim.timestamp_offset_minutes !== 'number' || stim.timestamp_offset_minutes < 0) {
              stim.timestamp_offset_minutes = 0;
              if (!stim._warnings) stim._warnings = [];
              stim._warnings.push(tt('Invalid time offset, reset to H+0', 'Offset horaire invalide, remis à H+0'));
            }
            if (stim.timestamp_offset_minutes > 720) {
              if (!stim._warnings) stim._warnings = [];
              stim._warnings.push(tt('Offset > 12h, check consistency', 'Offset > 12h, vérifier la cohérence'));
            }
          }
        },

        // ── Apply import to project ──

        applyImport(projectData, importResult) {
          const batchId = uid('batch');
          const timestamp = new Date().toISOString();
          const actorIdMap = {};

          // 1. Insert actors (with dedup)
          if (importResult.actors && importResult.actors.length > 0) {
            for (const actor of importResult.actors) {
              const existing = projectData.actors.find(
                a => a.name.trim().toLowerCase() === actor.name.trim().toLowerCase()
              );
              if (existing) {
                actorIdMap[actor.id] = existing.id;
              } else {
                const realId = uid('actor');
                actorIdMap[actor.id] = realId;
                projectData.actors.push({
                  id: realId,
                  name: actor.name || 'Unknown',
                  role: actor.role || 'internal',
                  organization: actor.organization || '',
                  title: actor.title || '',
                  language: actor.language || projectData.client?.language || 'fr',
                  avatar_initials: actor.avatar_initials || (actor.name || 'U').slice(0, 2).toUpperCase(),
                  avatar_url: ''
                });
              }
            }
          }

          // 2. Remove stimuli from previous import batch if any
          const prevBatchIds = projectData.stimuli
            .filter(s => s.import_source?.type === 'chronogram_ia')
            .map(s => s.id);
          if (prevBatchIds.length > 0) {
            projectData.stimuli = projectData.stimuli.filter(s => !prevBatchIds.includes(s.id));
          }

          // 3. Insert stimuli
          let stimuliCreated = 0;
          let stimuliImplicit = 0;
          for (const stim of (importResult.stimuli || [])) {
            const realActorId = actorIdMap[stim.actor_id] || stim.actor_id;
            const realId = uid('stimulus');
            const isImplicit = stim.is_implicit || false;

            projectData.stimuli.push({
              id: realId,
              name: stim.generation_prompt || stim.fields?.subject || stim.fields?.headline || stim.fields?.text || tt('Imported stimulus', 'Stimulus importé'),
              channel: stim.channel || 'email_internal',
              template_id: stim.template_id || 'outlook',
              actor_id: realActorId,
              timestamp_offset_minutes: stim.timestamp_offset_minutes || 0,
              status: 'draft',
              generation_mode: stim.generation_mode || 'ai_guided',
              generation_prompt: stim.generation_prompt || '',
              source_label: '',
              fields: stim.fields || {},
              generated_text: {},
              manual_overrides: {},
              watermark: null,
              history: [],
              created_at: timestamp,
              updated_at: timestamp,
              import_source: {
                type: 'chronogram_ia',
                source_row: stim.source_row,
                is_implicit: isImplicit,
                imported_at: timestamp,
                batch_id: batchId
              }
            });
            stimuliCreated++;
            if (isImplicit) stimuliImplicit++;
          }

          // 4. Update synopsis if extracted and project has none
          if (importResult.synopsis && !projectData.scenario?.summary) {
            if (projectData.scenario) projectData.scenario.summary = importResult.synopsis;
          }

          // 5. Sort stimuli by timeline
          projectData.stimuli.sort((a, b) => a.timestamp_offset_minutes - b.timestamp_offset_minutes);

          return {
            actors_created: Object.keys(actorIdMap).length - (importResult.actors || []).filter(a => {
              return projectData.actors.some(ea => ea.name.trim().toLowerCase() === a.name.trim().toLowerCase() && actorIdMap[a.id] !== uid('_'));
            }).length,
            actors_matched: (importResult.actors || []).length - Object.values(actorIdMap).filter(id => id.startsWith('actor_')).length,
            stimuli_created: stimuliCreated,
            stimuli_implicit: stimuliImplicit,
            warnings: importResult.warnings || [],
            skipped: importResult.skipped_rows || [],
            batch_id: batchId
          };
        },

        // ── Main orchestrator ──

        async importChronogramIA(file, options, updateProgress) {
          const { createActors, detectImplicit, mainSheet, userContext } = options;

          // 1. Read Excel
          updateProgress(1, 3, tt('Reading Excel file...', 'Lecture du fichier Excel...'), '');
          const arrayBuffer = await file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const excelData = this.prepareExcelForLLM(workbook);

          // 2. Step 1: Analyze structure
          updateProgress(1, 3,
            tt('Step 1: Analyzing file structure...', 'Étape 1 : Analyse de la structure du fichier...'),
            ''
          );
          const structureAnalysis = await this.callLLM_Step1(excelData, userContext);

          const sheetName = mainSheet || structureAnalysis.main_sheet || this.detectMainSheet(workbook.SheetNames);
          const mainSheetData = excelData.sheets[sheetName];
          if (!mainSheetData) {
            throw new Error(tt(`Sheet "${sheetName}" not found.`, `Feuille "${sheetName}" introuvable.`));
          }

          updateProgress(1, 3,
            tt('Step 1: Analyzing file structure...', 'Étape 1 : Analyse de la structure du fichier...'),
            tt(
              `→ Main chronogram identified (${structureAnalysis.total_stimulus_rows || '?'} rows)`,
              `→ Chronogramme principal identifié (${structureAnalysis.total_stimulus_rows || '?'} lignes)`
            )
          );

          // 3. Step 2: Extract stimuli
          updateProgress(2, 3,
            tt('Step 2: Extracting and classifying stimuli...', 'Étape 2 : Extraction et classification des stimuli...'),
            ''
          );
          const extractedStimuli = await this.callLLM_Step2_Batched(
            mainSheetData.all_rows,
            structureAnalysis,
            (detail) => updateProgress(2, 3,
              tt('Step 2: Extracting and classifying stimuli...', 'Étape 2 : Extraction et classification des stimuli...'),
              detail
            )
          );

          // Filter implicit if option disabled
          let stimuliToConvert = extractedStimuli;
          if (!detectImplicit) {
            stimuliToConvert = extractedStimuli.map(row => ({
              ...row,
              stimuli: (row.stimuli || []).filter(s => !s.is_implicit)
            }));
          }

          // 4. Step 3: Map to CrisisStim
          updateProgress(3, 3,
            tt('Step 3: Generating CrisisStim objects...', 'Étape 3 : Génération des objets CrisisStim...'),
            ''
          );
          const crisisStimImport = await this.callLLM_Step3(
            stimuliToConvert,
            structureAnalysis,
            appState.scenario
          );

          // Post-validation
          if (crisisStimImport.stimuli) {
            this.validateOffsets(crisisStimImport.stimuli);
          }

          // Attach synopsis from step 1
          crisisStimImport.synopsis = structureAnalysis.synopsis;
          crisisStimImport.structureAnalysis = structureAnalysis;

          return crisisStimImport;
        }
      };

      const DEBRIEF_PHASE_PRESETS = [
        { id: 'detection', label: 'Detection & qualification', range: 'Opening', start: 0, end: 0.34, color: '#0f6d8f' },
        { id: 'escalation', label: 'Escalation & decisions', range: 'Crisis response', start: 0.34, end: 0.72, color: '#d48c00' },
        { id: 'response', label: 'Response & stabilization', range: 'Recovery', start: 0.72, end: 1, color: '#30c38f' }
      ];

      function makeEmptyDebrief(scenario = {}) {
        const clientName = scenario.client?.name || 'Organisation';
        const crisisType = scenario.scenario?.type || 'Crisis';
        return {
          meta: {
            title: `${clientName} - ${crisisType} debrief`,
            subtitle: 'Major milestones and decisions',
            badge: 'CRISIS EXERCISE DEBRIEF',
            lang: scenario.settings?.language || scenario.client?.language || 'en'
          },
          theme: {
            preset: 'wavestone',
            bg: '#f5f4f9',
            fg: '#39334d',
            ink: '#150939',
            accent: '#451dc7',
            panel: '#ffffff',
            line: '#e1deeb',
            fontTitle: 'Fraunces',
            fontBody: 'Inter',
            fontMono: 'JetBrains Mono',
            scale: 1
          },
          layout: {
            showMap: false,
            showEventList: true,
            showSeverity: true,
            showArtifacts: true,
            showPlayback: true,
            mapSide: 'right'
          },
          phases: deepClone(DEBRIEF_PHASE_PRESETS),
          events: [],
          generated_at: null,
          generation_method: 'manual'
        };
      }

      function normalizeDebrief(input, scenario) {
        const base = makeEmptyDebrief(scenario);
        if (!input || typeof input !== 'object') return buildDebriefFromScenario(scenario);
        return {
          ...base,
          ...input,
          meta: { ...base.meta, ...(input.meta || {}) },
          theme: { ...base.theme, ...(input.theme || {}) },
          layout: { ...base.layout, ...(input.layout || {}) },
          phases: Array.isArray(input.phases) && input.phases.length
            ? input.phases.map((phase, index) => ({
                ...deepClone(DEBRIEF_PHASE_PRESETS[index] || DEBRIEF_PHASE_PRESETS[DEBRIEF_PHASE_PRESETS.length - 1]),
                ...phase,
                id: phase.id || `phase_${index + 1}`
              }))
            : base.phases,
          events: Array.isArray(input.events) ? input.events.map(normalizeDebriefEvent) : []
        };
      }

      function normalizeDebriefEvent(event) {
        return {
          id: event.id || uid('debrief'),
          stimulus_id: event.stimulus_id || '',
          phase: event.phase || 'detection',
          offset_minutes: Number(event.offset_minutes || 0),
          dateLabel: event.dateLabel || formatDebriefOffset(event.offset_minutes || 0),
          title: event.title || 'Major milestone',
          headline: event.headline || '',
          body: event.body || '',
          severity: Math.max(1, Math.min(5, Number(event.severity || 3))),
          kind: event.kind || 'milestone',
          location: event.location || '',
          artifacts: Array.isArray(event.artifacts) ? event.artifacts : [],
          t: Number.isFinite(Number(event.t)) ? Number(event.t) : 0
        };
      }

      function buildDebriefFromScenario(scenario) {
        const debrief = makeEmptyDebrief(scenario);
        const stimuli = [...(scenario.stimuli || [])].sort((a, b) => Number(a.timestamp_offset_minutes || 0) - Number(b.timestamp_offset_minutes || 0));
        if (!stimuli.length) return debrief;

        const selected = selectMajorDebriefStimuli(stimuli);
        const maxOffset = Math.max(1, ...stimuli.map((item) => Number(item.timestamp_offset_minutes || 0)));
        debrief.events = selected.map((stimulus) => stimulusToDebriefEvent(stimulus, scenario, maxOffset));
        debrief.generated_at = new Date().toISOString();
        debrief.generation_method = 'deterministic_major_milestones';
        return debrief;
      }

      function selectMajorDebriefStimuli(stimuli) {
        if (stimuli.length <= 8) return stimuli;
        const importantChannels = {
          email_authority: 6,
          press_release: 6,
          breaking_news_tv: 5,
          article_press: 4,
          internal_memo: 4,
          audio_message: 4,
          email_external: 3,
          post_twitter: 2,
          post_reddit: 2,
          sms_notification: 2,
          email_internal: 1
        };
        const maxOffset = Math.max(1, Number(stimuli[stimuli.length - 1].timestamp_offset_minutes || 0));
        const targets = [0, 0.16, 0.32, 0.48, 0.64, 0.82, 1];
        const picked = new Set();
        const pickedSignatures = new Set();
        targets.forEach((target) => {
          let winner = null;
          let winnerScore = -Infinity;
          stimuli.forEach((stimulus, index) => {
            if (picked.has(stimulus.id)) return;
            const signature = debriefStimulusSignature(stimulus);
            if (pickedSignatures.has(signature)) return;
            const position = Number(stimulus.timestamp_offset_minutes || 0) / maxOffset;
            const distanceScore = -Math.abs(position - target) * 18;
            const channelScore = importantChannels[stimulus.channel] || 0;
            const content = debriefStimulusText(stimulus).toLowerCase();
            const keywordScore = /(ransom|rançon|encrypt|chiffr|regulat|autorité|authority|press|media|production|patient|crisis|cellule|restore|recovery|publication|leak)/.test(content) ? 3 : 0;
            const edgeScore = index === 0 || index === stimuli.length - 1 ? 20 : 0;
            const score = distanceScore + channelScore + keywordScore + edgeScore;
            if (score > winnerScore) {
              winner = stimulus;
              winnerScore = score;
            }
          });
          if (winner) {
            picked.add(winner.id);
            pickedSignatures.add(debriefStimulusSignature(winner));
          }
        });
        return stimuli.filter((stimulus) => picked.has(stimulus.id));
      }

      function debriefStimulusSignature(stimulus) {
        const fields = stimulus.fields || {};
        return cleanDebriefText(fields.subject || fields.headline || fields.title || fields.text || debriefStimulusText(stimulus))
          .toLowerCase()
          .slice(0, 120);
      }

      function stimulusToDebriefEvent(stimulus, scenario, maxOffset) {
        const offset = Number(stimulus.timestamp_offset_minutes || 0);
        const position = Math.max(0, Math.min(1, offset / maxOffset));
        const actor = (scenario.actors || []).find((item) => item.id === stimulus.actor_id);
        const fields = stimulus.fields || {};
        const title = fields.subject || fields.headline || fields.title || stimulus.name || debriefChannelName(stimulus.channel);
        const details = debriefStimulusText(stimulus);
        const phase = position < 0.34 ? 'detection' : position < 0.72 ? 'escalation' : 'response';
        const channelSeverity = {
          email_authority: 4,
          breaking_news_tv: 5,
          article_press: 4,
          press_release: 4,
          audio_message: 4,
          email_external: 3
        };
        return normalizeDebriefEvent({
          id: uid('debrief'),
          stimulus_id: stimulus.id,
          phase,
          offset_minutes: offset,
          dateLabel: formatDebriefOffset(offset),
          title: cleanDebriefText(title).slice(0, 140) || 'Major milestone',
          headline: [debriefChannelName(stimulus.channel), actor?.name || stimulus.source_label].filter(Boolean).join(' - '),
          body: details.slice(0, 900),
          severity: channelSeverity[stimulus.channel] || Math.max(2, Math.min(5, Math.ceil(position * 4) + 1)),
          kind: debriefKindForChannel(stimulus.channel),
          artifacts: [debriefChannelName(stimulus.channel), actor?.organization || actor?.name].filter(Boolean),
          t: position
        });
      }

      function debriefStimulusText(stimulus) {
        const fields = stimulus.fields || {};
        const preferred = fields.body || fields.text || fields.subheadline || fields.description || fields.headline || fields.subject || stimulus.generation_prompt || '';
        return cleanDebriefText(preferred);
      }

      function cleanDebriefText(value) {
        return String(value || '')
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<\/p>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/\s+/g, ' ')
          .trim();
      }

      function debriefChannelName(channel) {
        return ({
          email_internal: 'Internal alert',
          email_external: 'External escalation',
          email_authority: 'Authority notification',
          article_press: 'Media coverage',
          breaking_news_tv: 'Breaking news',
          post_twitter: 'Social media signal',
          post_linkedin: 'Public stakeholder reaction',
          post_reddit: 'Community signal',
          press_release: 'Official communication',
          sms_notification: 'Operational alert',
          internal_memo: 'Management decision',
          audio_message: 'Voice message'
        })[channel] || 'Crisis milestone';
      }

      function debriefKindForChannel(channel) {
        if (channel === 'email_authority') return 'regulatory';
        if (['article_press', 'breaking_news_tv', 'post_twitter', 'post_linkedin', 'post_reddit'].includes(channel)) return 'media';
        if (channel === 'press_release') return 'communication';
        if (['email_internal', 'internal_memo', 'sms_notification'].includes(channel)) return 'response';
        if (channel === 'audio_message') return 'threat';
        return 'impact';
      }

      function formatDebriefOffset(offsetMinutes) {
        const minutes = Math.max(0, Number(offsetMinutes || 0));
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        return `H+${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
      }

      function refreshDebriefPositions(debrief) {
        const events = [...(debrief.events || [])].sort((a, b) => Number(a.offset_minutes || 0) - Number(b.offset_minutes || 0));
        const maxOffset = Math.max(1, ...events.map((event) => Number(event.offset_minutes || 0)));
        events.forEach((event) => {
          event.t = Math.max(0, Math.min(1, Number(event.offset_minutes || 0) / maxOffset));
          if (!event.dateLabel) event.dateLabel = formatDebriefOffset(event.offset_minutes);
        });
        debrief.events = events;
        return debrief;
      }

      function debriefToTimelineConfig(debrief) {
        const clean = refreshDebriefPositions(deepClone(debrief));
        return {
          meta: clean.meta,
          theme: clean.theme,
          layout: clean.layout,
          phases: clean.phases,
          kindLabels: {
            milestone: 'Milestone',
            regulatory: 'Regulatory',
            media: 'Media',
            communication: 'Communication',
            response: 'Response',
            threat: 'Threat',
            impact: 'Impact'
          },
          events: clean.events.map((event) => ({
            id: event.id,
            phase: event.phase,
            dateLabel: event.dateLabel || formatDebriefOffset(event.offset_minutes),
            t: event.t,
            title: event.title,
            location: event.location,
            severity: event.severity,
            kind: event.kind,
            headline: event.headline,
            body: event.body,
            artifacts: event.artifacts
          }))
        };
      }

      function buildDebriefHTML(debrief) {
        const config = debriefToTimelineConfig(debrief);
        const theme = config.theme || {};
        const title = config.meta?.title || 'Crisis debrief';
        const json = JSON.stringify(config).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
        const renderer = CRISIS_DEBRIEF_RENDERER_SOURCE.replace(/<\/script/gi, '<\\/script');
        return `<!DOCTYPE html>
<html lang="${escapeAttribute(config.meta?.lang || 'en')}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body, #root { height: 100%; margin: 0; padding: 0; background: ${theme.bg || '#f5f4f9'}; }
    body { font-family: "${String(theme.fontBody || 'Inter').replace(/"/g, '')}", sans-serif; color: ${theme.fg || '#39334d'}; overflow: hidden; -webkit-font-smoothing: antialiased; }
    #root { position: relative; z-index: 1; width: 100%; height: 100%; }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.4;transform:scale(0.85);} }
    button { font-family: inherit; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>window.TIMELINE_CONFIG = ${json};<\/script>
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js"><\/script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"><\/script>
  <script type="text/babel" data-presets="react">${renderer}<\/script>
</body>
</html>`;
      }

      function exportDebriefHTML() {
        const debrief = normalizeDebrief(appState.scenario.debrief, appState.scenario);
        appState.scenario.debrief = debrief;
        downloadBlob(new Blob([buildDebriefHTML(debrief)], { type: 'text/html' }), `${slugify(debrief.meta.title || 'crisis-debrief')}.debrief.html`);
        pushToast(tt('Debrief HTML exported.', 'HTML de debrief exporté.', 'Debrief-HTML exportiert.'), 'success');
      }

      function exportDebriefConfig() {
        const config = debriefToTimelineConfig(appState.scenario.debrief);
        downloadBlob(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }), `${slugify(config.meta?.title || 'crisis-debrief')}.debrief.json`);
        pushToast(tt('Debrief configuration exported.', 'Configuration du debrief exportée.', 'Debrief-Konfiguration exportiert.'), 'success');
      }

      function applyLLMDebrief(result, scenario) {
        const current = normalizeDebrief(scenario.debrief, scenario);
        const proposedEvents = Array.isArray(result) ? result : (result.events || []);
        const stimuliById = new Map((scenario.stimuli || []).map((stimulus) => [stimulus.id, stimulus]));
        const maxOffset = Math.max(1, ...(scenario.stimuli || []).map((stimulus) => Number(stimulus.timestamp_offset_minutes || 0)));
        if (result.meta && typeof result.meta === 'object') current.meta = { ...current.meta, ...result.meta };
        if (Array.isArray(result.phases) && result.phases.length) {
          current.phases = result.phases.map((phase, index) => ({
            ...deepClone(DEBRIEF_PHASE_PRESETS[index] || DEBRIEF_PHASE_PRESETS[DEBRIEF_PHASE_PRESETS.length - 1]),
            ...phase,
            id: phase.id || `phase_${index + 1}`
          }));
        }
        const validPhaseIds = new Set(current.phases.map((phase) => phase.id));
        current.events = proposedEvents.map((event, index) => {
          const source = stimuliById.get(event.stimulus_id);
          const offset = source ? Number(source.timestamp_offset_minutes || 0) : Number(event.offset_minutes || 0);
          return normalizeDebriefEvent({
            ...event,
            id: event.id || uid('debrief'),
            phase: validPhaseIds.has(event.phase) ? event.phase : current.phases[Math.min(index, current.phases.length - 1)]?.id,
            offset_minutes: offset,
            dateLabel: event.dateLabel || formatDebriefOffset(offset),
            t: offset / maxOffset,
            artifacts: Array.isArray(event.artifacts) ? event.artifacts : []
          });
        }).sort((a, b) => a.offset_minutes - b.offset_minutes);
        current.generated_at = new Date().toISOString();
        current.generation_method = 'llm_major_milestones';
        scenario.debrief = refreshDebriefPositions(current);
        return scenario.debrief;
      }

      function renderDebriefView() {
        const debrief = appState.scenario.debrief = normalizeDebrief(appState.scenario.debrief, appState.scenario);
        refreshDebriefPositions(debrief);
        const phaseOptions = debrief.phases.map((phase) => `<option value="${escapeAttribute(phase.id)}">${escapeHtml(phase.label)}</option>`).join('');
        return `
          <div class="debrief-toolbar card">
            <div>
              <strong>${tt('Major-milestone debrief', 'Debrief par jalons majeurs', 'Debrief nach wichtigen Meilensteinen')}</strong>
              <p>${tt('A deterministic first version built from the scenario timeline. Keep only the moments worth discussing after the exercise.', 'Une première version déterministe construite depuis la timeline. Ne conservez que les moments qui méritent d’être discutés après l’exercice.', 'Eine deterministische erste Version aus dem Zeitplan. Behalten Sie nur die Momente, die nach der Übung besprochen werden sollen.')}</p>
            </div>
            <div class="actions">
              <button class="btn btn-secondary" data-action="debrief-rebuild">${tt('Rebuild from timeline', 'Reconstruire depuis la timeline', 'Aus Zeitplan neu erstellen')}</button>
              <button class="btn btn-secondary" data-action="debrief-add-event">${tt('+ Add milestone', '+ Ajouter un jalon', '+ Meilenstein')}</button>
              <button class="btn btn-secondary" data-action="debrief-export-config">${tt('Export config', 'Exporter la config', 'Konfiguration exportieren')}</button>
              <button class="btn btn-primary" data-action="debrief-export-html">${tt('Export interactive HTML', 'Exporter le HTML interactif', 'Interaktives HTML exportieren')}</button>
            </div>
          </div>

          ${renderLLMConfigBlock('debrief',
            tt('Example: Select 6 to 8 decisive moments. Focus on detection, escalation, executive decisions, communication, and recovery. Highlight what participants should discuss.',
              'Exemple : sélectionne 6 à 8 moments décisifs. Concentre-toi sur la détection, l’escalade, les décisions exécutives, la communication et le rétablissement. Mets en évidence les sujets à discuter.',
              'Beispiel: Wähle 6 bis 8 entscheidende Momente. Konzentriere dich auf Erkennung, Eskalation, Führungsentscheidungen, Kommunikation und Wiederherstellung.'),
            {
              title: tt('Generate the debrief with AI', 'Générer le debrief avec l’IA', 'Debrief mit KI generieren'),
              subtitle: tt('The LLM proposes a first editable version from the complete scenario. It must select major milestones, not summarize every inject.', 'Le LLM propose une première version éditable à partir du scénario complet. Il doit sélectionner des jalons majeurs, pas résumer chaque inject.', 'Das LLM schlägt eine erste bearbeitbare Version aus dem vollständigen Szenario vor. Es soll wichtige Meilensteine auswählen, nicht jedes Inject zusammenfassen.'),
              generateLabel: tt('Generate debrief ✨', 'Générer le debrief ✨', 'Debrief generieren ✨'),
              successMessage: (count) => tt(`${count} major milestones proposed by the LLM. Review and edit them.`, `${count} jalons majeurs proposés par le LLM. Vérifiez-les et modifiez-les.`, `${count} wichtige Meilensteine vom LLM vorgeschlagen. Bitte prüfen und bearbeiten.`)
            })}

          <div class="debrief-grid">
            <section class="debrief-editor">
              <article class="card debrief-meta-card">
                <div class="section-header"><div><h3>${tt('Debrief identity', 'Identité du debrief', 'Debrief-Identität')}</h3><p>${tt('These fields appear in the exported timeline.', 'Ces champs apparaissent dans la timeline exportée.', 'Diese Felder erscheinen im exportierten Zeitplan.')}</p></div></div>
                <div class="form-grid">
                  <label>${tt('Title', 'Titre', 'Titel')}<input data-debrief-bind="meta.title" value="${escapeAttribute(debrief.meta.title)}"></label>
                  <label>${tt('Subtitle', 'Sous-titre', 'Untertitel')}<input data-debrief-bind="meta.subtitle" value="${escapeAttribute(debrief.meta.subtitle)}"></label>
                  <label>${tt('Badge', 'Badge', 'Badge')}<input data-debrief-bind="meta.badge" value="${escapeAttribute(debrief.meta.badge)}"></label>
                </div>
              </article>

              <div class="debrief-event-list">
                ${debrief.events.length ? debrief.events.map((event, index) => `
                  <article class="card debrief-event-card" style="border-left-color:${escapeAttribute(debrief.phases.find((phase) => phase.id === event.phase)?.color || '#0f6d8f')}">
                    <div class="debrief-event-heading">
                      <div><span class="pill">${escapeHtml(event.dateLabel || formatDebriefOffset(event.offset_minutes))}</span><strong>${index + 1}. ${escapeHtml(event.title)}</strong></div>
                      <button class="btn btn-xs btn-danger" data-action="debrief-delete-event" data-event-id="${event.id}">${tt('Delete', 'Supprimer', 'Löschen')}</button>
                    </div>
                    <div class="form-grid">
                      <label>${tt('Title', 'Titre', 'Titel')}<input data-debrief-event-bind="${event.id}.title" value="${escapeAttribute(event.title)}"></label>
                      <label>${tt('Phase', 'Phase', 'Phase')}<select data-debrief-event-bind="${event.id}.phase">${phaseOptions.replace(`value="${escapeAttribute(event.phase)}"`, `value="${escapeAttribute(event.phase)}" selected`)}</select></label>
                      <label>${tt('Offset (minutes)', 'Décalage (minutes)', 'Versatz (Minuten)')}<input type="number" min="0" data-debrief-event-bind="${event.id}.offset_minutes" value="${event.offset_minutes}"></label>
                      <label>${tt('Severity', 'Sévérité', 'Schweregrad')}<select data-debrief-event-bind="${event.id}.severity">${[1,2,3,4,5].map((value) => `<option value="${value}" ${value === event.severity ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
                      <label class="span-2">${tt('Discussion angle', 'Angle de discussion', 'Diskussionswinkel')}<input data-debrief-event-bind="${event.id}.headline" value="${escapeAttribute(event.headline)}"></label>
                      <label class="span-2">${tt('What happened / lessons', 'Ce qui s’est passé / enseignements', 'Ereignis / Erkenntnisse')}<textarea rows="4" data-debrief-event-bind="${event.id}.body">${escapeHtml(event.body)}</textarea></label>
                      <label class="span-2">${tt('Artifacts, one per line', 'Artefacts, un par ligne', 'Artefakte, eines pro Zeile')}<textarea rows="2" data-debrief-event-bind="${event.id}.artifacts">${escapeHtml((event.artifacts || []).join('\n'))}</textarea></label>
                    </div>
                    ${event.stimulus_id ? `<div class="debrief-source-note">${tt('Linked to a source stimulus. Manual edits here are preserved until you rebuild.', 'Lié à un stimulus source. Les modifications manuelles sont conservées jusqu’à une reconstruction.', 'Mit einem Quell-Inject verknüpft. Manuelle Änderungen bleiben bis zur Neuerstellung erhalten.')}</div>` : ''}
                  </article>
                `).join('') : `<div class="empty-state">${tt('No milestone yet. Rebuild from the timeline or add one manually.', 'Aucun jalon pour le moment. Reconstruisez depuis la timeline ou ajoutez-en un manuellement.', 'Noch kein Meilenstein. Aus dem Zeitplan erstellen oder manuell hinzufügen.')}</div>`}
              </div>
            </section>

            <aside class="card debrief-preview">
              <div class="section-header"><div><h3>${tt('Debrief timeline preview', 'Aperçu de la timeline de debrief', 'Debrief-Zeitplanvorschau')}</h3><p>${debrief.events.length} ${tt('major milestones selected', 'jalons majeurs sélectionnés', 'wichtige Meilensteine ausgewählt')}</p></div></div>
              <div class="debrief-preview-track">
                ${debrief.phases.map((phase) => `<div class="debrief-preview-phase" style="width:${(phase.end - phase.start) * 100}%;background:${escapeAttribute(phase.color)}"><span>${escapeHtml(phase.label)}</span></div>`).join('')}
                ${debrief.events.map((event) => `<div class="debrief-preview-dot" style="left:${event.t * 100}%;background:${escapeAttribute(debrief.phases.find((phase) => phase.id === event.phase)?.color || '#0f6d8f')}" title="${escapeAttribute(event.title)}"></div>`).join('')}
              </div>
              <div class="debrief-preview-cards">
                ${debrief.events.map((event) => `
                  <div class="debrief-preview-item">
                    <span style="background:${escapeAttribute(debrief.phases.find((phase) => phase.id === event.phase)?.color || '#0f6d8f')}">${escapeHtml(event.dateLabel || formatDebriefOffset(event.offset_minutes))}</span>
                    <div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.headline || event.body.slice(0, 140))}</p></div>
                  </div>
                `).join('')}
              </div>
              <div class="debrief-automation-note">
                <strong>${tt('Automation path', 'Piste d’automatisation', 'Automatisierungspfad')}</strong>
                <p>${tt('Today: deterministic selection plus manual editing. Later: collect facilitator decisions and participant actions during the exercise, score them, then propose additional milestones. An LLM should remain optional and only enrich summaries.', 'Aujourd’hui : sélection déterministe puis édition manuelle. Ensuite : collecter pendant l’exercice les décisions de l’animation et les actions des participants, les scorer, puis proposer des jalons supplémentaires. Le LLM doit rester optionnel et seulement enrichir les résumés.', 'Heute: deterministische Auswahl und manuelle Bearbeitung. Später: Entscheidungen und Teilnehmeraktionen während der Übung erfassen, bewerten und zusätzliche Meilensteine vorschlagen. Ein LLM bleibt optional und verbessert nur Zusammenfassungen.')}</p>
              </div>
            </aside>
          </div>
        `;
      }

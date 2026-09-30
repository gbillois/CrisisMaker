      const DEFAULT_NEWS_VIDEO = {
        objectUrl: 'media/anchor.mp4',
        fileName: 'anchor.mp4',
        isBundledDefault: true
      };

      function makeDefaultVideoFiles(scenario) {
        return Object.fromEntries(
          (scenario?.stimuli || [])
            .filter((stimulus) => stimulus.channel === 'breaking_news_tv')
            .map((stimulus) => [stimulus.id, { ...DEFAULT_NEWS_VIDEO }])
        );
      }

      function detectBrowserLanguage() {
        const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase().slice(0, 2);
        if (nav === 'fr') return 'fr';
        if (nav === 'de') return 'de';
        return 'en';
      }

      function currentLanguage() {
        const lang = appState?.scenario?.settings?.language;
        return ['fr', 'en', 'de'].includes(lang) ? lang : 'en';
      }



      function tt(en, fr, de) {
        const lang = currentLanguage();
        if (lang === 'fr') return fr;
        if (lang === 'de') return de !== undefined ? de : en;
        return en;
      }

      /* Locale for dates shown in the UI, following the app language. */
      function uiLocale() {
        return tt('en-GB', 'fr-FR', 'de-DE');
      }

      function setDocumentLanguage() {
        const lang = currentLanguage();
        document.documentElement.lang = lang;
        document.title = tt(
          'CrisisMaker by Wavestone - Crisis exercise platform',
          'CrisisMaker by Wavestone - Plateforme d\'exercices de crise',
          'CrisisMaker by Wavestone - Krisenübungs-Plattform'
        );
      }

      function roleLabel(value) {
        const labels = {
          journalist: ['Journalist', 'Journaliste', 'Journalist'],
          authority: ['Authority', 'Autorité', 'Behörde'],
          client_b2b: ['B2B Client', 'Client B2B', 'B2B-Kunde'],
          client_b2c: ['B2C Client', 'Client B2C', 'B2C-Kunde'],
          internal: ['Internal', 'Interne', 'Intern'],
          partner: ['Partner', 'Partenaire', 'Partner'],
          attacker: ['Attacker', 'Attaquant', 'Angreifer'],
          analyst: ['Analyst', 'Analyste', 'Analyst']
        };
        const [en, fr, de] = labels[value] || [value, value, value];
        return tt(en, fr, de);
      }

      function channelLabel(value) {
        const labels = {
          email_internal: ['Internal email', 'Email interne', 'Interne E-Mail'],
          email_external: ['External email', 'Email externe', 'Externe E-Mail'],
          email_authority: ['Authority email', 'Email autorité', 'Behörden-E-Mail'],
          article_press: ['Press article', 'Article de presse', 'Presseartikel'],
          breaking_news_tv: ['Breaking News TV', 'Breaking News TV', 'Breaking News TV'],
          post_twitter: ['X/Twitter post', 'Post X/Twitter', 'X/Twitter-Beitrag'],
          post_linkedin: ['LinkedIn post', 'Post LinkedIn', 'LinkedIn-Beitrag'],
          post_reddit: ['Reddit post', 'Post Reddit', 'Reddit-Beitrag'],
          dark_web_forum: ['Dark web forum', 'Forum dark web', 'Dark-Web-Forum'],
          press_release: ['Press release', 'Communiqué de presse', 'Pressemitteilung'],
          sms_notification: ['SMS / Notification', 'SMS / Notification', 'SMS / Benachrichtigung'],
          internal_memo: ['Internal memo', 'Note interne', 'Internes Memo'],
          audio_message: ['Audio message', 'Message audio', 'Audio-Nachricht']
        };
        const [en, fr, de] = labels[value] || [value, value, value];
        return tt(en, fr, de);
      }

      function uid(prefix = 'id') {
        return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
      }

      function formatLocalDateTime(date) {
        const d = new Date(date);
        const pad = (value) => String(value).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }

      /* The demo project (js/demo-scenario.js): loaded on a first visit, when no autosave exists. */
      function defaultScenario() {
        return buildStonaWaveDemo();
      }

      // Storyboard helpers live in scenario-model.js; some tools load data.js alone.
      function storyboardModelLoaded() {
        return typeof normalizeStoryboard === 'function' && typeof sbSealLinks === 'function';
      }

      function browserTimezone(fallback) {
        try {
          const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (typeof TIMEZONES !== 'undefined' && TIMEZONES.includes(zone)) return zone;
        } catch (_) { /* no Intl: keep the fallback */ }
        return fallback;
      }

      function emptyScenario(settingsOverrides = {}) {
        const base = defaultScenario();
        const { objectives: _objectives, narrative_arc: _arc, ...baseScenario } = base.scenario;
        return {
          ...base,
          id: uid('scenario'),
          name: '',
          // A blank project keeps nothing of the demo: no sector or crisis type, the browser's timezone when listed.
          client: { name: '', sector: '', language: settingsOverrides.language || 'en', logo_url: '' },
          scenario: { ...baseScenario, type: '', summary: '', detailed_context: '', learning_objectives: '', attack_path: '', start_date: '', end_date: '', timezone: browserTimezone(base.scenario.timezone), phases: [] },
          actors: [],
          stimuli: [],
          storyboard: storyboardModelLoaded() ? sbEmptyStoryboard() : undefined,
          storyboard_versions: [],
          cells: [],
          exercise: { players_count: '', cells_count: '' },
          debrief: makeEmptyDebrief({ ...base, client: { ...base.client, name: '' } }),
          video_debrief: normalizeVideoDebrief(null, settingsOverrides.inject_language || settingsOverrides.language || 'en'),
          evaluation: typeof normalizeEvaluation === 'function' ? normalizeEvaluation(null) : { sheets: {} },
          slide_debrief: typeof normalizeSlideDebrief === 'function' ? normalizeSlideDebrief(null) : {},
          checklist: normalizeChecklist(null),
          player_pool: [],
          actor_categories: [],
          framing_validation: null,
          // The Context fields when the exercise was last generated or updated from them.
          context_generation: null,
          settings: { ...base.settings, ...settingsOverrides }
        };
      }

      /* Ready-to-play checklist of the project: ticked item keys and custom items per category. */
      function normalizeChecklist(value) {
        const input = value && typeof value === 'object' ? value : {};
        const checked = {};
        const customItems = {};
        for (const [key, on] of Object.entries(input.checked && typeof input.checked === 'object' ? input.checked : {})) {
          if (on === true) checked[String(key).slice(0, 80)] = true;
        }
        for (const [key, list] of Object.entries(input.customItems && typeof input.customItems === 'object' ? input.customItems : {})) {
          if (!Array.isArray(list)) continue;
          customItems[String(key).slice(0, 80)] = list.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim().slice(0, 500)).slice(0, 50);
        }
        return { checked, customItems };
      }

      /* True when replacing the project would lose work: a name, a client, a storyline,
         players in cells or injects. */
      function projectHasContent(project) {
        if (!project || typeof project !== 'object') return false;
        return !!(String(project.name || '').trim()
          || String(project.client?.name || '').trim()
          || project.storyboard?.blocks?.length
          || (project.cells || []).some((cell) => (cell.players || []).length)
          || (project.stimuli || []).length);
      }

      function makeStimulus(channel, actorId, offsetMinutes, templateId = null) {
        const template = channel === 'article_press'
          ? (ARTICLE_TEMPLATE_LIBRARY[templateId] || ARTICLE_TEMPLATE_LIBRARY[TEMPLATE_LIBRARY.article_press.template_id] || ARTICLE_TEMPLATE_LIBRARY.nyt)
          : channel === 'breaking_news_tv'
            ? { ...TEMPLATE_LIBRARY.breaking_news_tv, ...(TV_TEMPLATE_LIBRARY[templateId] || {}) }
          : (TEMPLATE_LIBRARY[channel] || TEMPLATE_LIBRARY.email_internal);
        const now = new Date().toISOString();
        return {
          id: uid('stimulus'),
          name: '',
          timestamp_offset_minutes: offsetMinutes,
          channel,
          template_id: template.template_id,
          actor_id: actorId,
          source_label: '',
          generation_mode: 'ai',
          generation_prompt: '',
          status: 'draft',
          created_at: now,
          updated_at: now,
          fields: deepClone(template.defaults),
          generated_text: {},
          manual_overrides: {},
          watermark: null,
          history: []
        };
      }

      function loadInitialScenario() {
        const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('crisisstim_autosave_v1');
        const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || localStorage.getItem('crisisstim_settings_v1') || 'null');
        const providerSettings = loadProviderSettings();
        let scenario = defaultScenario();
        if (saved) {
          try {
            scenario = mergeScenario(migrateScenario(JSON.parse(saved)));
          } catch (error) {
            // Keep the unreadable copy before the next autosave overwrites it with the demo.
            console.warn('Unable to restore the saved scenario.', error);
            try { localStorage.setItem(`crisismaker_autosave_corrupt_${Date.now()}`, saved); } catch (_) { /* storage full */ }
            window.__crisisRestoreFailed = true;
          }
        }
        if (settings) {
          scenario.settings = { ...scenario.settings, ...settings };
        }
        // Auto-detect UI language from browser on first load (only when no saved preference exists)
        if (!settings?.language && !scenario.settings.language) {
          scenario.settings.language = detectBrowserLanguage();
        }
        // Default inject_language to UI language if not set
        if (!scenario.settings.inject_language) {
          scenario.settings.inject_language = scenario.settings.language || 'en';
        }
        scenario.settings = { ...scenario.settings, ...providerSettings };
        scenario.video_debrief = loadVideoDebriefDraft(
          scenario.video_debrief,
          scenario.settings.inject_language || scenario.client.language || scenario.settings.language,
          !saved
        );
        normalizeProviderSettingsInPlace(scenario.settings);
        // Preserve llm_prompts for restoration after appState init
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.llm_prompts) scenario._llm_prompts = parsed.llm_prompts;
          } catch (_) { /* already handled above */ }
        }
        return scenario;
      }

      function mergeScenario(input) {
        const base = defaultScenario();
        // Actors: safe ids (injects follow a renamed id) and a known role.
        const actorIds = new Map();
        const actors = Array.isArray(input.actors) ? input.actors.filter((actor) => actor && typeof actor === 'object').map((actor) => {
          const id = safeToken(actor.id, uid('actor'));
          if (id !== actor.id) actorIds.set(actor.id, id);
          return { ...actor, id, role: safeToken(actor.role, 'internal'), name: String(actor.name ?? '') };
        }) : [];
        const merged = {
          ...base,
          ...input,
          client: { ...base.client, ...(input.client || {}) },
          scenario: { ...base.scenario, ...(input.scenario || {}) },
          settings: { ...base.settings, ...(input.settings || {}) },
          // A file without actors or injects gets empty lists, never the demo's. An inject
          // saved without sender (its actor was deleted) keeps none.
          actors,
          stimuli: Array.isArray(input.stimuli) ? input.stimuli.filter((item) => item && typeof item === 'object').map((stimulus) => normalizeStimulus({ ...stimulus, actor_id: actorIds.get(stimulus.actor_id) ?? stimulus.actor_id }, stimulus.actor_id === '' ? '' : actors[0]?.id || '')) : [],
          debrief: normalizeDebrief(input.debrief, { ...base, ...input }),
          video_debrief: normalizeVideoDebrief(
            input.video_debrief,
            input.settings?.inject_language || input.client?.language || input.settings?.language || base.settings.inject_language
          ),
          custom_templates: Array.isArray(input.custom_templates) ? input.custom_templates : [],
          evaluation: typeof normalizeEvaluation === 'function' ? normalizeEvaluation(input.evaluation) : (input.evaluation || { sheets: {} }),
          slide_debrief: typeof normalizeSlideDebrief === 'function' ? normalizeSlideDebrief(input.slide_debrief) : (input.slide_debrief || {}),
          storyboard: storyboardModelLoaded() ? normalizeStoryboard(input.storyboard, input.scenario?.phases) : input.storyboard,
          storyboard_versions: storyboardModelLoaded() ? sbNormalizeVersions(input.storyboard_versions) : [],
          cells: storyboardModelLoaded() ? sbNormalizeCells(input.cells) : [],
          player_pool: storyboardModelLoaded() && Array.isArray(input.player_pool) ? input.player_pool.slice(0, 500).map(sbNormalizePlayer) : [],
          exercise: storyboardModelLoaded() ? sbNormalizeExercise(input.exercise) : { players_count: '', cells_count: '' },
          checklist: normalizeChecklist(input.checklist)
        };
        // Recipient cells are only assigned when migrating a project from before cells: in a
        // project with cells, an inject without recipient stays so (the checks flag it).
        if (storyboardModelLoaded()) { sbFlattenWorkstreams(merged, { assignCells: !Array.isArray(input.cells) }); sbFoldCellObjectives(merged); }
        // A project from before the storyline (v1): a storyline covering all its injects.
        if (storyboardModelLoaded() && !input.storyboard && typeof sbStoryboardFromInjects === 'function') sbStoryboardFromInjects(merged);
        if (storyboardModelLoaded() && input.storyboard && typeof sbRelinkByBeats === 'function') sbRelinkByBeats(merged);
        // The storyboard owns the timed phases; keep the legacy field derived from it.
        if (storyboardModelLoaded() && (merged.storyboard.blocks.length || !Array.isArray(input.scenario?.phases))) merged.scenario.phases = sbDerivePhases(merged.storyboard);
        if (!input.scenario || !('objectives' in input.scenario)) delete merged.scenario.objectives;
        normalizeProviderSettingsInPlace(merged.settings);
        // Baselines for change tracking (inject plans, senders, cells) on older projects.
        if (storyboardModelLoaded() && typeof sbSealLinks === 'function') sbSealLinks(merged);
        return merged;
      }

      function normalizeVideoDebrief(value, fallbackLanguage = 'fr') {
        const input = value && typeof value === 'object' ? value : {};
        const setup = input.setup && typeof input.setup === 'object' ? input.setup : {};
        const supportedLanguages = ['fr', 'en', 'es', 'de', 'it', 'pt'];
        const language = supportedLanguages.includes(setup.language)
          ? setup.language
          : (supportedLanguages.includes(fallbackLanguage) ? fallbackLanguage : 'en');
        return {
          source_material: typeof input.source_material === 'string' ? input.source_material : '',
          setup: {
            duration: Number(setup.duration) || 120,
            language,
            theme: setup.theme || 'wavestone',
            voice: setup.voice || '',
            tone: setup.tone || 'documentaire sobre et factuel',
            audience: setup.audience || 'comité exécutif'
          },
          project: input.project && typeof input.project === 'object'
            ? JSON.parse(JSON.stringify(input.project))
            : null,
          ui: {
            active_step: [1, 2, 3].includes(Number(input.ui?.active_step)) ? Number(input.ui.active_step) : 1
          }
        };
      }

      function loadVideoDebriefDraft(fallback = null, fallbackLanguage = 'fr', preferSavedDraft = false) {
        // In the integrated app, the current project is authoritative. The
        // standalone browser draft is only a legacy recovery fallback.
        if (!preferSavedDraft && fallback && typeof fallback === 'object') {
          return normalizeVideoDebrief(fallback, fallbackLanguage);
        }
        try {
          const saved = localStorage.getItem(VIDEO_DEBRIEF_STORAGE_KEY);
          return saved ? normalizeVideoDebrief(JSON.parse(saved), fallbackLanguage) : normalizeVideoDebrief(fallback, fallbackLanguage);
        } catch (error) {
          return normalizeVideoDebrief(fallback, fallbackLanguage);
        }
      }

      function persistVideoDebriefDraft(value) {
        const normalized = normalizeVideoDebrief(value);
        try {
          localStorage.setItem(VIDEO_DEBRIEF_STORAGE_KEY, JSON.stringify(normalized));
        } catch (error) {
          console.warn('Unable to persist the Video Debrief browser draft.', error);
        }
        return normalized;
      }

      /* Ids and keys end up in HTML attributes and CSS classes: a project file shared by
         someone else must not be able to smuggle markup through them. */
      const SAFE_TOKEN = /^[A-Za-z0-9_-]{1,120}$/;
      function safeToken(value, fallback) {
        return typeof value === 'string' && SAFE_TOKEN.test(value) ? value : fallback;
      }

      /* One-line text fields are plain text, escaped when shown: HTML entities left in them by an
         earlier sanitizing ("IT &amp; cyber cell") are decoded, or they show as such. */
      function plainTextFields(library, fields) {
        const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' };
        for (const field of library?.fields || []) {
          const value = fields[field.key];
          if (field.type !== 'text' || typeof value !== 'string' || !/&(amp|lt|gt|quot|#39|#x27|nbsp);/.test(value) || /<[a-z!\/][^>]*>/i.test(value)) continue;
          fields[field.key] = value.replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (entity) => entities[entity]);
        }
        return fields;
      }

      function normalizeStimulus(stimulus, fallbackActorId = appState?.scenario?.actors?.[0]?.id || '') {
        const channel = safeToken(stimulus.channel, 'email_internal');
        const templateId = channel === 'article_press'
          ? safeToken(stimulus.template_id, 'nyt')
          : channel === 'breaking_news_tv'
            ? (TV_TEMPLATE_LIBRARY[stimulus.template_id] ? stimulus.template_id : 'bfm')
            : safeToken(stimulus.template_id, (TEMPLATE_LIBRARY[channel] || TEMPLATE_LIBRARY.email_internal).template_id);
        const library = getTemplateDefinition({ channel, template_id: templateId }) || TEMPLATE_LIBRARY.email_internal;
        const now = new Date().toISOString();
        return {
          id: safeToken(stimulus.id, uid('stimulus')),
          name: stimulus.name ?? '',
          timestamp_offset_minutes: Number(stimulus.timestamp_offset_minutes || 0),
          channel,
          template_id: templateId,
          actor_id: safeToken(stimulus.actor_id, fallbackActorId),
          source_label: stimulus.source_label || '',
          generation_mode: stimulus.generation_mode || 'ai',
          generation_prompt: stimulus.generation_prompt || '',
          status: ['draft', 'ready', 'sent'].includes(stimulus.status) ? stimulus.status : 'draft',
          created_at: stimulus.created_at || now,
          updated_at: stimulus.updated_at || now,
          fields: plainTextFields(library, { ...deepClone(library.defaults), ...(stimulus.fields || {}) }),
          generated_text: stimulus.generated_text || {},
          manual_overrides: stimulus.manual_overrides || {},
          watermark: stimulus.watermark || null,
          history: stimulus.history || [],
          ...(stimulus.scenario_link && typeof sbNormalizeLink === 'function' ? { scenario_link: sbNormalizeLink(stimulus.scenario_link) } : {}),
          ...(typeof stimulus.cell_id === 'string' && /^[A-Za-z0-9_+-]{1,4000}$/.test(stimulus.cell_id) ? { cell_id: stimulus.cell_id } : {}),
          // When the pilot marked it sent during Play: wall clock and exercise minute.
          ...(typeof stimulus.sent_at === 'string' ? { sent_at: stimulus.sent_at } : {}),
          ...(Number.isFinite(stimulus.sent_at_min) ? { sent_at_min: stimulus.sent_at_min } : {}),
          ...(stimulus.added_in_play === true ? { added_in_play: true } : {}),
          // Where an imported inject came from (chronogram import).
          ...(stimulus.import_source && typeof stimulus.import_source === 'object' ? { import_source: { type: safeToken(stimulus.import_source.type, 'import'), source_row: Number.isFinite(stimulus.import_source.source_row) ? stimulus.import_source.source_row : null, is_implicit: stimulus.import_source.is_implicit === true, imported_at: typeof stimulus.import_source.imported_at === 'string' ? stimulus.import_source.imported_at : '', batch_id: safeToken(stimulus.import_source.batch_id, '') } } : {}),
          ...(Number.isInteger(stimulus.sent_count) && stimulus.sent_count > 0 ? { sent_count: stimulus.sent_count } : {})
        };
      }

      function migrateScenario(raw) {
        if (!raw) return raw;
        // country → language on client
        if (raw.client && raw.client.country && !raw.client.language) {
          const map = { FR: 'fr', BE: 'fr', CH: 'fr', CA: 'fr', US: 'en', GB: 'en', DE: 'de', ES: 'es', IT: 'it', PT: 'pt', NL: 'nl' };
          raw.client.language = map[raw.client.country] || 'en';
        }
        // country → language on actors
        if (Array.isArray(raw.actors)) {
          raw.actors = raw.actors.map((actor) => {
            if (actor.country && !actor.language) {
              const map = { FR: 'fr', BE: 'fr', CH: 'fr', CA: 'fr', US: 'en', GB: 'en', DE: 'de', ES: 'es', IT: 'it', PT: 'pt', NL: 'nl' };
              actor.language = map[actor.country] || 'en';
            }
            return actor;
          });
        }
        // Add missing scenario fields
        if (raw.scenario && raw.scenario.detailed_context === undefined) raw.scenario.detailed_context = '';
        // Add missing settings fields
        if (raw.settings) {
          if (!raw.settings.max_versions) raw.settings.max_versions = 3;
          if (!raw.settings.auto_save_interval_seconds) raw.settings.auto_save_interval_seconds = 30;
          if (!raw.settings.template_quality) raw.settings.template_quality = 'hd';
          if (raw.settings.watermark_enabled === undefined) raw.settings.watermark_enabled = true;
          if (!raw.settings.watermark_text) raw.settings.watermark_text = 'EXERCISE EXERCISE EXERCISE';
          if (!raw.settings.watermark_position_v) raw.settings.watermark_position_v = 'top';
          if (!raw.settings.watermark_position_h) raw.settings.watermark_position_h = 'center';
          if (raw.settings.watermark_opacity === undefined) raw.settings.watermark_opacity = 50;
          if (raw.settings.watermark_rotation === undefined) raw.settings.watermark_rotation = 0;
          if (raw.settings.watermark_text_size === undefined) raw.settings.watermark_text_size = 16;
          if (!raw.settings.inject_language) raw.settings.inject_language = raw.settings.language || 'en';
        }
        // Add custom_templates array
        if (!Array.isArray(raw.custom_templates)) raw.custom_templates = [];
        if (!raw.debrief) raw.debrief = buildDebriefFromScenario(raw);
        // Migrate audio_message stimuli from old voice_type/attacker_voice to audio_character
        if (Array.isArray(raw.stimuli)) {
          raw.stimuli.forEach(s => {
            if (s.channel === 'audio_message' && s.fields) {
              if (!s.fields.audio_mode) s.fields.audio_mode = 'create';
              if (!s.fields.audio_character) {
                const vt = s.fields.voice_type || 'cybercriminal';
                const av = s.fields.attacker_voice || 'best_attacker';
                if (vt === 'radio_female') s.fields.audio_character = 'female';
                else if (vt === 'radio_male') s.fields.audio_character = 'male';
                else if (av === 'drama_attacker') s.fields.audio_character = 'attacker_drama';
                else if (av === 'techno_attacker') s.fields.audio_character = 'attacker_techno';
                else s.fields.audio_character = 'attacker_best';
              }
              if (!s.fields.tts_language) s.fields.tts_language = 'fr-FR';
              if (!s.fields.audio_watermark_type) s.fields.audio_watermark_type = 'beeps';
              if (!s.fields.audio_watermark_text) s.fields.audio_watermark_text = 'EXERCISE';
            }
          });
        }
        return raw;
      }

      function saveStimulus(stimulus, newFields, changeSummary) {
        if (!stimulus.history) stimulus.history = [];
        const maxVersions = appState?.scenario?.settings?.max_versions || 3;
        stimulus.history.unshift({
          fields: deepClone(stimulus.fields),
          saved_at: new Date().toISOString(),
          change_summary: changeSummary || tt('Manual edit', 'Modification manuelle', 'Manuelle Bearbeitung')
        });
        if (stimulus.history.length > maxVersions) stimulus.history = stimulus.history.slice(0, maxVersions);
        stimulus.fields = deepClone(newFields);
        stimulus.updated_at = new Date().toISOString();
      }

      function restoreVersion(stimulus, versionIndex) {
        const version = stimulus.history[versionIndex];
        if (!version) return;
        saveStimulus(stimulus, version.fields, tt(`Restore version from ${new Date(version.saved_at).toLocaleDateString(uiLocale())}`, `Restauration de la version du ${new Date(version.saved_at).toLocaleDateString(uiLocale())}`, `Version vom ${new Date(version.saved_at).toLocaleDateString(uiLocale())} wiederherstellen`));
      }

      function getTemplateDefinition(stimulus) {
        if (stimulus?.channel === 'article_press') return ARTICLE_TEMPLATE_LIBRARY[stimulus.template_id] || ARTICLE_TEMPLATE_LIBRARY.nyt;
        if (stimulus?.channel === 'breaking_news_tv') return TEMPLATE_LIBRARY.breaking_news_tv;
        if (TEMPLATE_LIBRARY[stimulus?.channel]) return TEMPLATE_LIBRARY[stimulus.channel];
        // Check custom templates
        const custom = (appState?.scenario?.custom_templates || []).find(
          t => t.template_id === stimulus?.template_id || t.template_id === stimulus?.channel
        );
        if (custom) return custom;
        return TEMPLATE_LIBRARY.email_internal;
      }

      function validateCustomTemplate(data) {
        const errors = [];
        if (!data || typeof data !== 'object') return [tt('Invalid template file.', 'Fichier template invalide.', 'Ungültige Vorlagendatei.')];
        if (data.schema_version !== '1.0') errors.push(tt('Unsupported schema_version (expected "1.0").', 'schema_version non supporté (attendu "1.0").', 'Nicht unterstützte schema_version (erwartet "1.0").'));
        if (!data.template_id || typeof data.template_id !== 'string') errors.push(tt('Missing or invalid template_id.', 'template_id manquant ou invalide.', 'Fehlende oder ungültige template_id.'));
        if (!data.name && !data.label) errors.push(tt('Missing name/label.', 'name/label manquant.', 'Fehlender name/label.'));
        if (!data.render_html || typeof data.render_html !== 'string') errors.push(tt('Missing render_html.', 'render_html manquant.', 'Fehlende render_html.'));
        if (typeof data.render_css !== 'undefined' && typeof data.render_css !== 'string') errors.push(tt('render_css must be a string.', 'render_css doit être une chaîne.', 'render_css muss eine Zeichenkette sein.'));
        if (!Array.isArray(data.fields) || data.fields.length === 0) errors.push(tt('fields must be a non-empty array.', 'fields doit être un tableau non vide.', 'fields muss ein nicht leeres Array sein.'));
        else {
          const hasRequired = data.fields.some(f => f.required === true);
          if (!hasRequired) errors.push(tt('fields must contain at least one required field.', 'fields doit contenir au moins un champ requis.', 'fields muss mindestens ein Pflichtfeld enthalten.'));
          // Check render_html contains at least one placeholder matching a declared field
          const fieldNames = data.fields.map(f => f.name || f.key).filter(Boolean);
          const hasPlaceholder = fieldNames.some(name => data.render_html.includes(`{{${name}}}`));
          if (!hasPlaceholder) errors.push(tt('render_html must contain at least one {{field_name}} placeholder.', 'render_html doit contenir au moins un placeholder {{field_name}}.', 'render_html muss mindestens einen {{field_name}}-Platzhalter enthalten.'));
        }
        // Collision check against native template IDs
        const nativeIds = new Set([
          ...Object.keys(ARTICLE_TEMPLATE_LIBRARY),
          ...Object.keys(TEMPLATE_LIBRARY),
          ...Object.keys(CHANNEL_META)
        ]);
        if (data.template_id && nativeIds.has(data.template_id)) {
          errors.push(tt(`template_id "${data.template_id}" collides with a built-in template.`, `template_id "${data.template_id}" entre en collision avec un template natif.`, `template_id "${data.template_id}" kollidiert mit einer eingebauten Vorlage.`));
        }
        // Channel must be a known channel
        if (data.channel && !CHANNEL_META[data.channel]) {
          errors.push(tt(`Unknown channel "${data.channel}".`, `Canal inconnu "${data.channel}".`, `Unbekannter Kanal "${data.channel}".`));
        }
        // Sanitize CSS: no @import, no url(), no expression(), no behavior
        if (data.render_css && (/url\s*\(/i.test(data.render_css) || /@import/i.test(data.render_css) || /expression\s*\(/i.test(data.render_css) || /behavior\s*:/i.test(data.render_css) || /-moz-binding\s*:/i.test(data.render_css))) {
          errors.push(tt('render_css must not contain url(), @import, expression(), behavior, or -moz-binding.', 'render_css ne doit pas contenir url(), @import, expression(), behavior ou -moz-binding.', 'render_css darf kein url(), @import, expression(), behavior oder -moz-binding enthalten.'));
        }
        // Sanitize HTML: no dangerous elements or attributes
        if (data.render_html) {
          const forbidden = [
            /<script[\s>\/]/i, /<iframe[\s>\/]/i, /<object[\s>\/]/i, /<embed[\s>\/]/i,
            /<link[\s>\/]/i, /<meta[\s>\/]/i, /<base[\s>\/]/i, /<form[\s>\/]/i,
            /\bon\w+\s*=/i, /javascript\s*:/i, /data\s*:\s*text\/html/i
          ];
          if (forbidden.some(rx => rx.test(data.render_html))) {
            errors.push(tt('render_html contains forbidden elements (script, iframe, object, embed, link, meta, base, form, event handlers, or javascript: URLs).', 'render_html contient des éléments interdits (script, iframe, object, embed, link, meta, base, form, gestionnaires d\'événements ou URLs javascript:).', 'render_html enthält verbotene Elemente (script, iframe, object, embed, link, meta, base, form, Ereignishandler oder javascript:-URLs).'));
          }
        }
        return errors;
      }

      function deepClone(data) {
        return JSON.parse(JSON.stringify(data));
      }

      function isLLMAvailable() {
        const s = appState?.scenario?.settings;
        if (!s) return false;
        if (s.ai_provider === 'azure_openai') {
          return !!(s.azure_api_key?.trim() && s.azure_endpoint?.trim() && s.azure_deployment?.trim());
        }
        if (s.ai_provider === 'ollama') {
          const endpoint = s.ollama_endpoint?.trim().replace(/\/+$/, '');
          return !!(s.ai_model?.trim() && (s.ollama_mode === 'cloud' ? s.ai_api_key?.trim() : endpoint));
        }
        // The AI local server needs no key: its address and a model are enough.
        if (s.ai_provider === 'local_server') return !!(s.ai_model?.trim() && s.local_server_url?.trim());
        return !!(s.ai_api_key?.trim());
      }

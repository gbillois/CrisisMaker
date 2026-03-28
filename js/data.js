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

      function isFrenchUI() {
        return currentLanguage() === 'fr';
      }

      function isGermanUI() {
        return currentLanguage() === 'de';
      }

      function tt(en, fr, de) {
        const lang = currentLanguage();
        if (lang === 'fr') return fr;
        if (lang === 'de') return de !== undefined ? de : en;
        return en;
      }

      function setDocumentLanguage() {
        const lang = currentLanguage();
        document.documentElement.lang = lang;
        document.title = tt(
          'CrisisMaker by Wavestone - Crisis exercise studio',
          'CrisisMaker by Wavestone - Studio d\'exercices de crise',
          'CrisisMaker by Wavestone - Krisenübungs-Studio'
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
          press_release: ['Press release', 'Communiqué de presse', 'Pressemitteilung'],
          sms_notification: ['SMS / Notification', 'SMS / Notification', 'SMS / Benachrichtigung'],
          internal_memo: ['Internal memo', 'Note interne', 'Internes Memo']
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

      function defaultScenario() {
        const actors = [
          { id: uid('actor'), name: 'John Carter', role: 'journalist', organization: 'Global Daily', title: 'Cybersecurity reporter', language: 'en', avatar_initials: 'JC', avatar_url: '' },
          { id: uid('actor'), name: 'Claire Martin', role: 'internal', organization: 'StonaWave', title: 'Cyber crisis director', language: 'fr', avatar_initials: 'CM', avatar_url: '' },
          { id: uid('actor'), name: 'CERT-FR', role: 'authority', organization: 'ANSSI', title: 'Government cyber alert and response center', language: 'fr', avatar_initials: 'CF', avatar_url: '' }
        ];
        const scenario = {
          id: uid('scenario'),
          name: 'CrisisMaker - Ransomware exercise - StonaWave',
          client: { name: 'StonaWave', sector: 'Pharmaceutical', language: 'en', logo_url: '' },
          scenario: { type: 'Ransomware', summary: 'A ransomware attack hits the information system of StonaWave, a global pharmaceutical company. Critical manufacturing, supply chain, and clinical systems are disrupted, the press starts reporting the incident, and health authorities are alerted.', detailed_context: '', start_date: '2026-03-15T08:00', timezone: 'America/New_York' },
          actors,
          stimuli: [],
          custom_templates: [],
          settings: { language: 'en', inject_language: 'en', ai_provider: 'anthropic', ai_model: 'claude-sonnet-4-20250514', ai_api_key: '', azure_endpoint: '', azure_api_key: '', azure_deployment: '', max_versions: 3, auto_save_interval_seconds: 30, template_quality: 'hd', watermark_enabled: true, watermark_text: 'EXERCISE EXERCISE EXERCISE', watermark_text_size: 16, watermark_position_v: 'top', watermark_position_h: 'center', watermark_opacity: 50, watermark_rotation: 0 }
        };
        const samples = [
          makeStimulus('email_internal', actors[1].id, 0),
          makeStimulus('article_press', actors[0].id, 120, 'lemonde'),
          makeStimulus('article_press', actors[0].id, 125, 'nyt'),
          makeStimulus('post_reddit', actors[0].id, 130),
          makeStimulus('post_twitter', actors[0].id, 135),
          makeStimulus('breaking_news_tv', actors[0].id, 165),
          makeStimulus('email_authority', actors[2].id, 180),
          makeStimulus('press_release', actors[1].id, 240)
        ];
        scenario.stimuli = samples;
        return scenario;
      }

      function emptyScenario(settingsOverrides = {}) {
        const base = defaultScenario();
        return {
          ...base,
          id: uid('scenario'),
          name: '',
          client: { name: '', sector: base.client.sector, language: settingsOverrides.language || 'en', logo_url: '' },
          scenario: { ...base.scenario, type: base.scenario.type, summary: '', detailed_context: '', start_date: '', timezone: base.scenario.timezone },
          actors: [],
          stimuli: [],
          settings: { ...base.settings, ...settingsOverrides }
        };
      }

      function makeStimulus(channel, actorId, offsetMinutes, templateId = null) {
        const template = channel === 'article_press'
          ? (ARTICLE_TEMPLATE_LIBRARY[templateId] || ARTICLE_TEMPLATE_LIBRARY[TEMPLATE_LIBRARY.article_press.template_id] || ARTICLE_TEMPLATE_LIBRARY.nyt)
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
            console.warn('Unable to restore the saved scenario.', error);
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
        normalizeProviderSettingsInPlace(scenario.settings);
        return scenario;
      }

      function mergeScenario(input) {
        const base = defaultScenario();
        const merged = {
          ...base,
          ...input,
          client: { ...base.client, ...(input.client || {}) },
          scenario: { ...base.scenario, ...(input.scenario || {}) },
          settings: { ...base.settings, ...(input.settings || {}) },
          actors: Array.isArray(input.actors) && input.actors.length ? input.actors : base.actors,
          stimuli: Array.isArray(input.stimuli) ? input.stimuli.map(normalizeStimulus) : base.stimuli,
          custom_templates: Array.isArray(input.custom_templates) ? input.custom_templates : []
        };
        normalizeProviderSettingsInPlace(merged.settings);
        return merged;
      }

      function normalizeStimulus(stimulus) {
        const channel = stimulus.channel || 'email_internal';
        const templateId = channel === 'article_press' ? (stimulus.template_id || 'nyt') : (stimulus.template_id || (TEMPLATE_LIBRARY[channel] || TEMPLATE_LIBRARY.email_internal).template_id);
        const library = getTemplateDefinition({ channel, template_id: templateId }) || TEMPLATE_LIBRARY.email_internal;
        const now = new Date().toISOString();
        return {
          id: stimulus.id || uid('stimulus'),
          name: stimulus.name ?? '',
          timestamp_offset_minutes: Number(stimulus.timestamp_offset_minutes || 0),
          channel,
          template_id: templateId,
          actor_id: stimulus.actor_id || appState?.scenario?.actors?.[0]?.id || '',
          source_label: stimulus.source_label || '',
          generation_mode: stimulus.generation_mode || 'ai',
          generation_prompt: stimulus.generation_prompt || '',
          status: stimulus.status || 'draft',
          created_at: stimulus.created_at || now,
          updated_at: stimulus.updated_at || now,
          fields: { ...deepClone(library.defaults), ...(stimulus.fields || {}) },
          generated_text: stimulus.generated_text || {},
          manual_overrides: stimulus.manual_overrides || {},
          watermark: stimulus.watermark || null,
          history: stimulus.history || []
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
        saveStimulus(stimulus, version.fields, tt(`Restore version from ${new Date(version.saved_at).toLocaleDateString()}`, `Restauration de la version du ${new Date(version.saved_at).toLocaleDateString()}`, `Version vom ${new Date(version.saved_at).toLocaleDateString()} wiederherstellen`));
      }

      function getTemplateDefinition(stimulus) {
        if (stimulus?.channel === 'article_press') return ARTICLE_TEMPLATE_LIBRARY[stimulus.template_id] || ARTICLE_TEMPLATE_LIBRARY.nyt;
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
        return !!(s.ai_api_key?.trim());
      }

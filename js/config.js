      function field(key, label, type, extra = {}) { return { key, label, type, ...extra }; }

      const STORAGE_KEY = 'crisismaker_autosave_v1';
      const SETTINGS_KEY = 'crisismaker_settings_v1';
      const DEFAULT_MODELS = {
        anthropic: ['claude-sonnet-4-20250514'],
        openai: ['gpt-5.2', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini', 'o3-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini'],
        azure_openai: ['gpt-5.2', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini', 'o3-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini']
      };
      const PROVIDER_STORAGE_KEYS = {
        aiProvider: 'aiProvider',
        azureEndpoint: 'azureEndpoint',
        azureApiKey: 'azureApiKey',       // legacy key - cleaned up on load
        azureDeployment: 'azureDeployment',
        apiKey: 'crisismaker_api_key',    // dedicated key for API key, separate from project data
        azureApiKeyStore: 'crisismaker_azure_api_key' // dedicated key for Azure API key
      };
      const ROLES = [
        { value: 'journalist', label: 'Journalist' },
        { value: 'authority', label: 'Authority' },
        { value: 'client_b2b', label: 'B2B Client' },
        { value: 'client_b2c', label: 'B2C Client' },
        { value: 'internal', label: 'Internal' },
        { value: 'partner', label: 'Partner' },
        { value: 'attacker', label: 'Attacker' },
        { value: 'analyst', label: 'Analyst' }
      ];
      const LANGUAGES = [
        { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' },
        { value: 'de', label: 'Deutsch' }, { value: 'es', label: 'Español' },
        { value: 'it', label: 'Italiano' }, { value: 'pt', label: 'Português' },
        { value: 'nl', label: 'Nederlands' }, { value: 'ja', label: '日本語' }, { value: 'zh', label: '中文' }
      ];
      const TIMEZONES = ['Europe/Paris', 'Europe/Berlin', 'UTC', 'Europe/London', 'America/New_York'];
      const CHANNEL_META = {
        email_internal: { label: 'Internal email', color: '#2563eb', category: 'Email' },
        email_external: { label: 'External email', color: '#3b82f6', category: 'Email' },
        email_authority: { label: 'Authority email', color: '#0f766e', category: 'Email' },
        article_press: { label: 'Press article', color: '#6b7280', category: 'Press' },
        breaking_news_tv: { label: 'Breaking News TV', color: '#dc2626', category: 'TV' },
        post_twitter: { label: 'X/Twitter post', color: '#16a34a', category: 'Social' },
        post_linkedin: { label: 'LinkedIn post', color: '#0a66c2', category: 'Social' },
        post_reddit: { label: 'Reddit post', color: '#ff4500', category: 'Social' },
        press_release: { label: 'Press release', color: '#7c3aed', category: 'Corporate' },
        sms_notification: { label: 'SMS / Notification', color: '#f59e0b', category: 'Mobile' },
        internal_memo: { label: 'Internal memo', color: '#4b5563', category: 'Corporate' }
      };

      const ARTICLE_TEMPLATE_LIBRARY = {
        lemonde: {
          label: 'Le Monde',
          template_id: 'lemonde',
          defaults: {
            headline: 'A massive cyberattack cripples StonaWave',
            subheadline: 'IT systems have been degraded since early morning as initial investigations point to a sophisticated intrusion.',
            author: 'By John Carter',
            date: 'March 15, 2026 at 10:42 AM',
            category: 'Health',
            body: '<p>StonaWave confirmed on Saturday that it is facing a major cyber incident that forced several internal applications and production systems offline. Security teams are still investigating to determine the exact scope of the compromise.</p><p>According to several sources close to the matter, the company assembled a crisis cell before dawn bringing together executive leadership, IT, security, communications, and external advisers. Part of the internal coordination has now moved to backup channels.</p><p>"The absolute priority remains continuity of critical activities and protection of patient data," a spokesperson said. No timeline for full recovery has been announced yet.</p><p>The event highlights the persistent vulnerability of large pharmaceutical groups to attack chains that combine initial compromise, lateral movement, and opportunistic encryption. Health authorities could be notified quickly if patient data or manufacturing integrity is confirmed to be affected.</p>',
            image_caption: 'StonaWave headquarters.',
            read_time: '3 min read',
            is_premium: false,
            has_photo: false,
            photo_data: ''
          },
          fields: [field('headline', 'Headline', 'text'), field('subheadline', 'Standfirst', 'textarea'), field('author', 'Author', 'text'), field('date', 'Date', 'text'), field('category', 'Section', 'text'), field('read_time', 'Read time', 'text'), field('is_premium', 'Premium article', 'checkbox'), field('has_photo', 'Show photo', 'checkbox'), field('photo_data', 'Photo', 'photo_upload'), field('image_caption', 'Image caption', 'text'), field('body', 'HTML body', 'textarea')]
        },
        nyt: {
          label: 'The New York Times',
          template_id: 'nyt',
          defaults: {
            headline: 'Major Cyberattack Cripples Global Pharmaceutical Giant StonaWave',
            subheadline: 'Hackers are believed to have used ransomware to lock thousands of systems across multiple countries, raising fears over drug supply chain disruption.',
            author: 'By Nicole Perlroth and David E. Sanger',
            date: 'March 15, 2026',
            update_time: 'Updated 2:47 p.m. ET',
            category: 'Technology',
            body: '<p>PARIS — A major cyberattack on StonaWave disrupted manufacturing execution systems, clinical trial management platforms, and supply chain operations across several countries on Sunday, according to company executives and advisers briefed on the response.</p><p>The company said it had isolated affected systems and shifted some critical processes to contingency procedures while investigators examined whether the attackers had exfiltrated data before deploying ransomware.</p><p>”The first priority is to preserve critical services while understanding the full scope of the compromise,” said Elise Warren, a cybersecurity analyst at Delta Advisory.</p><p>The breach is likely to intensify scrutiny of how large pharmaceutical companies are preparing for cyber threats, as regulators at the FDA and EMA increasingly press drugmakers to demonstrate that their manufacturing and data integrity controls can withstand prolonged digital disruption.</p>',
            image_caption: 'StonaWave\'s European headquarters outside Paris. Credit: Thomas Samson/AFP',
            read_time: '5 min read',
            is_premium: false,
            location: 'PARIS',
            has_photo: false,
            photo_data: ''
          },
          fields: [field('headline', 'Headline', 'text'), field('subheadline', 'Subheadline', 'textarea'), field('author', 'Author', 'text'), field('date', 'Date', 'text'), field('update_time', 'Update time', 'text'), field('category', 'Category', 'text'), field('location', 'Location', 'text'), field('read_time', 'Read time', 'text'), field('is_premium', 'Premium article', 'checkbox'), field('has_photo', 'Show photo', 'checkbox'), field('photo_data', 'Photo', 'photo_upload'), field('image_caption', 'Image caption', 'text'), field('body', 'HTML body', 'textarea')]
        },
        faz: {
          label: 'Frankfurter Allgemeine Zeitung',
          template_id: 'faz',
          defaults: {
            kicker: 'Cyberangriff',
            headline: 'Ransomware-Angriff auf Pharmariesen StonaWave legt Produktionssysteme lahm',
            subheadline: 'Die Attacke wirft Fragen zur Cybersicherheit in der globalen Arzneimittelversorgungskette auf.',
            author: 'Von Hans Müller, Frankfurt',
            date: '15.03.2026',
            time: '10:42 Uhr',
            category: 'Wirtschaft',
            body: '<p>Ein groß angelegter Cyberangriff hat am Sonntag wesentliche Systeme des Pharmaunternehmens StonaWave in mehreren Ländern beeinträchtigt und damit Produktionssteuerungssysteme, klinische Datenverwaltung sowie Teile der Lieferkette vorübergehend lahmgelegt.</p><p>Nach Angaben aus dem Umfeld des Unternehmens arbeiten externe Forensiker und interne Spezialisten daran, die Angriffskette zu rekonstruieren. Im Mittelpunkt steht die Frage, ob die Täter vor der Verschlüsselung zunächst Daten abgeflossen ließen, um zusätzlichen Druck aufzubauen.</p><p>„Entscheidend ist nun, welche kritischen Funktionen unter Notfallbedingungen aufrechterhalten werden können und wie sauber die Trennung der betroffenen Netze tatsächlich war”, sagte eine mit dem Vorgang vertraute BSI-nahe Expertin.</p><p>Der Vorfall dürfte auch deshalb besondere Aufmerksamkeit erregen, weil Pharmaunternehmen zunehmend im Fokus von Cyberangriffen stehen und Regulatoren wie EMA und FDA strenge Anforderungen an die Datenintegrität und Produktionssicherheit stellen. Für Patienten und Hersteller ist relevant, ob die Störung die Verfügbarkeit kritischer Medikamente beeinträchtigt.</p>',
            image_caption: 'Das europäische Hauptquartier von StonaWave. Bild: dpa',
            is_faz_plus: true,
            content_type: 'Bericht',
            has_photo: false,
            photo_data: ''
          },
          fields: [field('kicker', 'Kicker', 'text'), field('headline', 'Headline', 'text'), field('subheadline', 'Subheadline', 'textarea'), field('author', 'Author', 'text'), field('date', 'Date', 'text'), field('time', 'Time', 'text'), field('category', 'Category', 'text'), field('content_type', 'Content type', 'select', { options: ['Bericht', 'Analyse', 'Kommentar'] }), field('is_faz_plus', 'F+ article', 'checkbox'), field('has_photo', 'Show photo', 'checkbox'), field('photo_data', 'Photo', 'photo_upload'), field('image_caption', 'Image caption', 'text'), field('body', 'HTML body', 'textarea')]
        },
        ft: {
          label: 'Financial Times',
          template_id: 'ft',
          defaults: {
            headline: 'StonaWave hit by major ransomware attack as hackers demand ransom',
            subheadline: 'Incident raises fresh questions about cyber resilience in the global pharmaceutical sector.',
            author: 'Hannah Murphy and Robert Smith in London',
            date: 'March 15 2026',
            time: '2:47 pm GMT',
            category: 'Cyber Security',
            body: '<p>StonaWave, a large global pharmaceutical company, was hit by a significant ransomware attack on Sunday that disrupted manufacturing systems, supply chain platforms, and several internal operations, according to people familiar with the response.</p><p>The company has moved parts of its operations on to contingency arrangements while investigators assess whether the attackers stole data before deploying ransomware. The incident has already prompted outreach from health regulators and critical suppliers.</p><p>”The focus will be on supply chain continuity and patient safety rather than the immediate ransom demand,” said one London-based cyber insurance adviser, noting that prolonged outages affecting drug manufacturing could quickly escalate into a public health issue.</p><p>The episode is likely to sharpen attention on NIS2 implementation and on whether pharmaceutical companies can sustain core manufacturing and distribution processes when a compromise affects multiple jurisdictions at the same time.</p>',
            image_caption: 'Operations teams switched several processes to contingency mode on Sunday.',
            is_premium: true,
            content_type: 'News',
            has_photo: false,
            photo_data: ''
          },
          fields: [field('headline', 'Headline', 'text'), field('subheadline', 'Subheadline', 'textarea'), field('author', 'Author', 'text'), field('date', 'Date', 'text'), field('time', 'Time', 'text'), field('category', 'Category', 'text'), field('content_type', 'Content type', 'select', { options: ['News', 'Analysis', 'Opinion', 'Exclusive'] }), field('is_premium', 'Premium article', 'checkbox'), field('has_photo', 'Show photo', 'checkbox'), field('photo_data', 'Photo', 'photo_upload'), field('image_caption', 'Image caption', 'text'), field('body', 'HTML body', 'textarea')]
        },
        nikkei: {
          label: '日本経済新聞 (Nikkei)',
          template_id: 'nikkei',
          defaults: {
            headline: '大手製薬グループStonaWaveにサイバー攻撃、生産システムに障害',
            subheadline: '複数国の業務に影響、医薬品供給への波及懸念',
            author: '田中太郎',
            date: '2026年3月15日 10:42',
            update_time: '12:30更新',
            category: 'テクノロジー',
            body: '<p>グローバル製薬大手のStonaWaveは15日、大規模なランサムウエア攻撃を受け、複数国にわたる製造管理システムや臨床試験データ管理システムに障害が発生したと発表した。同社は外部のセキュリティ専門家と連携し、被害の全容把握を急いでいる。</p><p>関係者によると、攻撃者はランサムウエアを使用し、社内ネットワークの広範囲にわたってシステムを暗号化した模様だ。同社は重要業務を手動に切り替えて対応している。</p><p>「現時点では患者データの流出は確認されていないが、調査を継続している」と同社の広報担当者は述べた。欧州医薬品庁（EMA）も状況の把握に乗り出している。</p><p>今回の事案は、製薬企業を標的としたサイバー攻撃が増加する中、医薬品の製造・流通インフラのセキュリティ対策の在り方に改めて問題を投げかけている。NIS2指令への対応状況についても注目が集まっている。</p>',
            image_caption: 'StonaWaveの欧州本社（パリ近郊）',
            is_premium: false,
            related_tags: 'サイバーセキュリティ,製薬,患者データ',
            has_photo: false,
            photo_data: ''
          },
          fields: [field('headline', 'Headline (見出し)', 'text'), field('subheadline', 'Subheadline (副見出し)', 'textarea'), field('author', 'Author (記者)', 'text'), field('date', 'Date (日付)', 'text'), field('update_time', 'Update time (更新)', 'text'), field('category', 'Category (カテゴリ)', 'text'), field('is_premium', 'Premium (有料)', 'checkbox'), field('has_photo', 'Show photo (写真を表示)', 'checkbox'), field('photo_data', 'Photo (写真)', 'photo_upload'), field('image_caption', 'Image caption (写真説明)', 'text'), field('related_tags', 'Tags (タグ, comma-separated)', 'text'), field('body', 'HTML body (本文)', 'textarea')]
        }
      };

      const TEMPLATE_LIBRARY = {
        email_internal: {
          label: 'Internal Outlook',
          template_id: 'outlook',
          defaults: {
            from_name: 'Claire Martin',
            from_email: 'claire.martin@stonawave.com',
            to: 'Crisis Committee',
            cc: 'CIO, CISO',
            subject: 'URGENT - Security incident in progress',
            date: formatLocalDateTime(new Date()),
            body: '<p>Hello everyone,</p><p>We are dealing with a cybersecurity incident affecting part of the information system. IT, cyber, and communications teams are fully mobilized.</p><ul><li>Isolation of suspicious workstations is in progress</li><li>Initial forensic analysis has started</li><li>Situation update planned at H+30</li></ul><p><strong>Instruction:</strong> do not reboot any workstation and report any unusual behavior to the SOC.</p><p>Best regards,<br>Claire Martin</p>',
            has_attachment: true,
            attachment_name: 'Rapport_incident_v1.pdf',
            importance: 'high'
          },
          fields: [field('from_name', 'Sender', 'text'), field('from_email', 'Sender email', 'text'), field('to', 'To', 'text'), field('cc', 'Cc', 'text'), field('subject', 'Subject', 'text'), field('date', 'Date', 'text'), field('importance', 'Importance', 'select', { options: ['high', 'normal'] }), field('has_attachment', 'Attachment', 'checkbox'), field('attachment_name', 'Attachment name', 'text'), field('body', 'HTML body', 'textarea')]
        },
        article_press: {
          label: 'Press article',
          template_id: 'nyt',
          defaults: deepClone(ARTICLE_TEMPLATE_LIBRARY.nyt.defaults),
          fields: ARTICLE_TEMPLATE_LIBRARY.nyt.fields
        },
        post_twitter: {
          label: 'Post X/Twitter',
          template_id: 'twitter',
          defaults: {
            display_name: 'John Carter',
            handle: '@jeandupont',
            verified: true,
            verified_type: 'blue',
            avatar_initials: 'JD',
            avatar_color: '#1da1f2',
            text: 'StonaWave confirms a major cyber incident. Early indicators suggest a significant operational impact on manufacturing and supply chain systems. The next few hours will be critical to assess the true scale of the compromise. #cybersecurity #pharma #crisis',
            date: '8:32 AM · Mar 15, 2026',
            retweets: 1243,
            quotes: 89,
            likes: 4521,
            views: 125000,
            replies: 312,
            has_image: false
          },
          fields: [field('display_name', 'Display name', 'text'), field('handle', 'Handle', 'text'), field('verified', 'Verified account', 'checkbox'), field('verified_type', 'Badge type', 'select', { options: ['blue', 'gold', 'grey'] }), field('avatar_initials', 'Avatar initials', 'text'), field('avatar_color', 'Avatar color', 'text'), field('text', 'Text', 'textarea'), field('date', 'Date', 'text'), field('retweets', 'Reposts', 'number'), field('quotes', 'Quotes', 'number'), field('likes', 'Likes', 'number'), field('views', 'Views', 'number'), field('replies', 'Replies', 'number')]
        },
        post_linkedin: {
          label: 'Post LinkedIn',
          template_id: 'linkedin',
          defaults: {
            display_name: 'John Carter',
            title: 'Cybersecurity journalist',
            avatar_initials: 'JD',
            avatar_color: '#0A66C2',
            text: 'Cyber crises are no longer fought only on the technical front. They are also won or lost through the speed of coordination across IT, security, legal, communications, and executive leadership.\n\nIn StonaWave\'s case, the first hours will be decisive: map the impacts, stabilize critical manufacturing and distribution operations, and give stakeholders — including health regulators — a clear direction.\n\nPharmaceutical organizations that prepare their response playbooks, messages, and decision-making routines in advance save precious time when a ransomware attack threatens drug supply continuity. #cybersecurity #pharma #resilience #crisismanagement',
            date: '2h',
            reactions_count: 234,
            comments_count: 45,
            reposts_count: 12,
            reaction_types: ['👍', '👏', '💡']
          },
          fields: [field('display_name', 'Display name', 'text'), field('title', 'Title', 'text'), field('avatar_initials', 'Avatar initials', 'text'), field('avatar_color', 'Avatar color', 'text'), field('text', 'Text', 'textarea'), field('date', 'Relative date', 'text'), field('reactions_count', 'Reactions', 'number'), field('comments_count', 'Comments', 'number'), field('reposts_count', 'Reposts', 'number'), field('reaction_types', 'Reactions (JSON array)', 'textarea')]
        },
        post_reddit: {
          label: 'Reddit post',
          template_id: 'reddit',
          defaults: {
            subreddit: 'r/cybersecurity',
            subreddit_icon_color: '#FF4500',
            author: 'u/threat_intel_analyst',
            author_flair: 'Incident Responder',
            flair_color: '#0079D3',
            post_flair: 'Breaking News',
            post_flair_color: '#FF0000',
            title: 'Major pharma group StonaWave confirmed hit by ransomware - manufacturing systems down across multiple countries',
            body: '<p>Seeing multiple reports that StonaWave has invoked incident response and is failing over to contingency processes across its global manufacturing and supply chain sites. If anyone is tracking IOCs tied to the access brokers active in western Europe this weekend, please share what you can confirm.</p><p>Hearing the blast radius includes identity, VDI, manufacturing execution systems (MES), and some clinical data management tooling. Curious whether others are seeing the same TTP pattern: initial access via VPN, quiet lateral movement, then encryption once backups and admin paths were mapped.</p>',
            link_url: '',
            link_domain: '',
            upvotes: 4823,
            upvote_ratio: '96% upvoted',
            comments_count: 847,
            awards: ['gold', 'silver', 'helpful'],
            date: '3 hours ago',
            is_pinned: false,
            top_comment: { author: 'u/soc_manager_42', flair: 'SOC Lead', text: 'Can confirm one of our clients has started isolating third-party links while waiting for a fuller scope update.', upvotes: 1256, date: '2 hours ago' }
          },
          fields: [field('subreddit', 'Subreddit', 'text'), field('subreddit_icon_color', 'Subreddit icon color', 'text'), field('author', 'Author', 'text'), field('author_flair', 'Author flair', 'text'), field('flair_color', 'Author flair color', 'text'), field('post_flair', 'Post flair', 'text'), field('post_flair_color', 'Post flair color', 'text'), field('title', 'Title', 'text'), field('body', 'HTML body', 'textarea'), field('link_url', 'Link URL', 'text'), field('link_domain', 'Link domain', 'text'), field('upvotes', 'Upvotes', 'number'), field('upvote_ratio', 'Upvote ratio', 'text'), field('comments_count', 'Comments', 'number'), field('awards', 'Awards (JSON array)', 'textarea'), field('date', 'Relative date', 'text'), field('is_pinned', 'Pinned post', 'checkbox'), field('top_comment', 'Top comment (JSON object)', 'textarea')]
        },
        breaking_news_tv: {
          label: 'Breaking news banner',
          template_id: 'bfm',
          defaults: {
            headline: 'MASSIVE CYBERATTACK HITS STONAWAVE',
            subline: 'Manufacturing and supply chain systems paralyzed since this morning',
            ticker: 'StonaWave confirms a major ransomware incident - A crisis cell has been activated - Drug manufacturing sites switch to manual procedures',
            time: '10:42',
            category: 'BREAKING NEWS'
          },
          fields: [field('headline', 'Headline', 'text'), field('subline', 'Subheadline', 'text'), field('ticker', 'Ticker', 'textarea'), field('time', 'Time', 'text'), field('category', 'Category', 'text')]
        },
        email_authority: {
          label: 'ANSSI / CERT-FR alert',
          template_id: 'anssi',
          defaults: {
            reference: 'CERTFR-2026-ALE-003',
            from_name: 'CERT-FR',
            from_email: 'cert-fr@ssi.gouv.fr',
            to: 'CISO - StonaWave',
            subject: 'Alert - Critical vulnerability actively exploited',
            date: 'March 15, 2026',
            body: '<p>CERT-FR is aware of active exploitation targeting internet-exposed environments.</p><p><strong>Potentially affected systems:</strong></p><ul><li>Exposed VPN servers</li><li>Remote access concentrators</li><li>Unsegmented administration services</li></ul><p><strong>Immediate recommendations:</strong></p><ul><li>Apply available patches</li><li>Reset associated secrets</li><li>Search for attached indicators of compromise</li></ul>',
            severity: 'critical'
          },
          fields: [field('reference', 'Reference', 'text'), field('from_name', 'Sender name', 'text'), field('from_email', 'Sender email', 'text'), field('to', 'Recipient', 'text'), field('subject', 'Subject', 'text'), field('date', 'Date', 'text'), field('severity', 'Severity', 'select', { options: ['critical', 'high', 'medium'] }), field('body', 'HTML body', 'textarea')]
        },
        press_release: {
          label: 'Press release',
          template_id: 'press_release',
          defaults: {
            organization: 'StonaWave',
            logo_text: 'STONAWAVE',
            logo_color: '#003366',
            has_logo: false,
            logo_image: '',
            date: 'Paris, March 15, 2026',
            title: 'Press release - Security incident',
            body: '<p>StonaWave confirms that it detected a cybersecurity incident affecting part of its information system. As soon as the event was identified, incident response measures were activated and external experts were engaged.</p><p>Teams are working to progressively restore priority services — including manufacturing and supply chain systems — while continuing technical analysis to determine the origin and scope of the incident. At this stage, the company is maintaining essential operations using adapted procedures.</p><p>StonaWave is acting transparently with the competent health and cybersecurity authorities and will inform stakeholders of any significant developments. Patient safety and drug supply continuity remain our absolute priorities.</p>',
            contact_name: 'Communications Office',
            contact_email: 'press@stonawave.com',
            contact_phone: '+33 1 00 00 00 00'
          },
          fields: [field('organization', 'Organization', 'text'), field('logo_text', 'Logo text', 'text'), field('logo_color', 'Logo color', 'text'), field('has_logo', 'Use logo image', 'checkbox'), field('logo_image', 'Logo image', 'photo_upload'), field('date', 'Date', 'text'), field('title', 'Title', 'text'), field('body', 'HTML body', 'textarea'), field('contact_name', 'Contact', 'text'), field('contact_email', 'Contact email', 'text'), field('contact_phone', 'Phone', 'text')]
        },
        email_external: {
          label: 'External email',
          template_id: 'generic',
          defaults: {
            from_name: 'Marc Lefèvre',
            from_email: 'marc.lefevre@partner.com',
            to: 'contact@stonawave.com',
            cc: '',
            subject: 'Follow-up on the reported incident',
            date: formatLocalDateTime(new Date()),
            body: '<p>Dear Sir or Madam,</p><p>We are reaching out regarding the incident reported earlier today. Our teams have been reviewing potential impacts on our shared infrastructure and would like to schedule a call to align on next steps.</p><p>Please confirm your availability at your earliest convenience.</p><p>Best regards,<br>Marc Lefèvre<br>Partner Security Team</p>',
            has_attachment: false,
            attachment_name: '',
            importance: 'normal'
          },
          fields: [field('from_name', 'Sender', 'text'), field('from_email', 'Sender email', 'text'), field('to', 'To', 'text'), field('cc', 'Cc', 'text'), field('subject', 'Subject', 'text'), field('date', 'Date', 'text'), field('importance', 'Importance', 'select', { options: ['high', 'normal'] }), field('has_attachment', 'Attachment', 'checkbox'), field('attachment_name', 'Attachment name', 'text'), field('body', 'HTML body', 'textarea')]
        },
        internal_memo: {
          label: 'Internal memo',
          template_id: 'memo',
          defaults: {
            from_name: 'Direction Générale',
            to: 'All employees',
            subject: 'Internal communication - Security incident',
            date: formatLocalDateTime(new Date()),
            body: '<p>Following the security incident detected this morning, please be advised that precautionary measures have been activated across the organization.</p><p><strong>Key instructions:</strong></p><ul><li>Do not use personal devices on the corporate network</li><li>Report any suspicious activity to the IT helpdesk immediately</li><li>Await further instructions before resuming normal operations on affected systems</li></ul><p>A follow-up communication will be issued within the next two hours.</p>',
            classification: 'Confidential'
          },
          fields: [field('from_name', 'From', 'text'), field('to', 'To', 'text'), field('subject', 'Subject', 'text'), field('date', 'Date', 'text'), field('classification', 'Classification', 'select', { options: ['Confidential', 'Internal', 'Restricted'] }), field('body', 'HTML body', 'textarea')]
        },
        sms_notification: {
          label: 'SMS / Notification',
          template_id: 'sms',
          defaults: {
            sender: 'Security Alert',
            text: 'Your account was involved in a suspected unauthorized access. Please reset your password and contact the security support team.',
            time: '08:32',
            device: 'iphone'
          },
          fields: [field('sender', 'Sender', 'text'), field('text', 'Text', 'textarea'), field('time', 'Time', 'text'), field('device', 'Device', 'select', { options: ['iphone', 'android'] })]
        }
      };

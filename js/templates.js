      const TemplateEngine = {
        render(stimulus, actor, scenario) {
          const f = stimulus.fields || {};
          const quality = scenario?.settings?.template_quality || 'basic';
          // Try HD render if quality is set to HD
          if (quality === 'hd') {
            const hdResult = this.renderHD(stimulus, f);
            if (hdResult !== null) return hdResult;
            // fallback to basic if no HD variant exists
          }
          switch (stimulus.channel) {
            case 'email_internal': return this.emailInternal(f);
            case 'article_press': return this.articlePress(stimulus.template_id, f);
            case 'post_twitter': return this.twitter(f);
            case 'post_linkedin': return this.linkedin(f);
            case 'post_reddit': return this.reddit(f);
            case 'breaking_news_tv': return this.bfm(f);
            case 'email_authority': return this.authority(f);
            case 'press_release': return this.pressRelease(f);
            case 'sms_notification': return this.sms(f);
            default: {
              // Check custom templates before returning "not implemented"
              const customTpl = (scenario?.custom_templates || []).find(
                t => t.template_id === stimulus.template_id || t.template_id === stimulus.channel
              );
              if (customTpl) return this.renderCustom(customTpl, f);
              return `<div class="card">${tt('Template not implemented for', 'Template non implémenté pour')} ${escapeHtml(stimulus.channel)}.</div>`;
            }
          }
        },
        renderHD(stimulus, f) {
          switch (stimulus.channel) {
            case 'email_internal': return this.emailInternalHD(f);
            case 'article_press': return this.articlePressHD(stimulus.template_id, f);
            case 'post_twitter': return this.twitterHD(f);
            case 'post_linkedin': return this.linkedinHD(f);
            case 'post_reddit': return this.redditHD(f);
            case 'breaking_news_tv': return this.bfmHD(f);
            case 'email_authority': return this.authorityHD(f);
            case 'press_release': return this.pressReleaseHD(f);
            case 'sms_notification': return this.smsHD(f);
            default: return null;
          }
        },
        renderCustom(templateDef, fields) {
          let html = templateDef.render_html || '';
          const rawKeys = new Set(['body']);
          for (const fieldDef of (templateDef.fields || [])) {
            const key = fieldDef.key || fieldDef.name;
            if (!key) continue;
            const value = fields[key];
            const placeholder = '{{' + key + '}}';
            if (rawKeys.has(key) || key.endsWith('_html')) {
              html = html.split(placeholder).join(value ?? '');
            } else {
              html = html.split(placeholder).join(escapeHtml(String(value ?? '')));
            }
          }
          const css = templateDef.render_css ? `<style>${templateDef.render_css}</style>` : '';
          return `<div class="crisismaker-template-sandbox" style="all: initial;">${css}${html}</div>`;
        },
        emailInternal(f) {
          return `
            <div class="outlook-email">
              <div class="outlook-topbar">
                <strong>Outlook</strong>
                <div class="outlook-actions">${iconReply()} ${tt('Reply', 'Répondre')} ${iconReplyAll()} ${tt('Reply all', 'Répondre à tous')} ${iconForward()} ${tt('Forward', 'Transférer')}</div>
              </div>
              <div class="outlook-body">
                <div class="outlook-meta">
                  <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">${f.importance === 'high' ? '<span class="importance-dot">!</span>' : ''}<div class="outlook-subject">${escapeHtml(f.subject || '')}</div></div>
                  <div class="outlook-row"><span>${tt('From', 'De')}</span><strong>${escapeHtml(f.from_name || '')} &lt;${escapeHtml(f.from_email || '')}&gt;</strong></div>
                  <div class="outlook-row"><span>${tt('To', 'À')}</span><span>${escapeHtml(f.to || '')}</span></div>
                  <div class="outlook-row"><span>Cc</span><span>${escapeHtml(f.cc || '')}</span></div>
                  <div class="outlook-row"><span>${tt('Date', 'Date')}</span><span>${escapeHtml(f.date || '')}</span></div>
                </div>
                <div class="outlook-content">
                  ${f.body || ''}
                  ${f.has_attachment ? `<div class="outlook-attachment">📎 <span>${escapeHtml(f.attachment_name || 'piece_jointe.pdf')}</span></div>` : ''}
                </div>
              </div>
            </div>
          `;
        },
        articlePress(templateId, f) {
          switch (templateId) {
            case 'lemonde': return this.articleLeMonde(f);
            case 'faz': return this.articleFaz(f);
            case 'ft': return this.articleFt(f);
            case 'nikkei': return this.articleNikkei(f);
            case 'nyt':
            default:
              return this.articleNyt(f);
          }
        },
        articleLeMonde(f) {
          return `
            <article class="press-article lm-article">
              <div class="lm-header">
                <div class="lm-logo">Le Monde</div>
                <div class="lm-nav"><span>${tt('Politics', 'Politique')}</span><span>${tt('World', 'International')}</span><span>${tt('Business', 'Économie')}</span><span>Pixels</span><span>${tt('Culture', 'Culture')}</span><span>${tt('Opinions', 'Opinions')}</span></div>
              </div>
              ${f.is_premium ? `<div class="lm-premium">${tt('Subscribers only — full article', 'Réservé aux abonnés — lecture intégrale')}</div>` : ''}
              <div class="press-body">
                <div class="press-category">${escapeHtml(f.category || '')}</div>
                <h1 class="press-headline">${escapeHtml(f.headline || '')}</h1>
                <div class="press-subheadline">${escapeHtml(f.subheadline || '')}</div>
                <div class="press-byline"><span>${escapeHtml(f.author || '')}</span><span>${escapeHtml(f.date || '')} · ${escapeHtml(f.read_time || '')}</span></div>
                ${f.has_photo ? `<div class="press-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo ? `<div class="press-caption">${escapeHtml(f.image_caption || '')}</div>` : ''}
                <div class="press-content">${f.body || ''}</div>
              </div>
            </article>
          `;
        },
        articleNyt(f) {
          return `
            <article class="press-article nyt-article">
              <div class="nyt-rail">
                <div class="nyt-masthead-row">
                  <div class="nyt-date">${escapeHtml(f.date || '')}</div>
                  <div class="nyt-masthead">The New York Times</div>
                  <div class="nyt-nav">U.S.<span>|</span>WORLD<span>|</span>BUSINESS<span>|</span>TECHNOLOGY<span>|</span>SCIENCE<span>|</span>CLIMATE<span>|</span>OPINION</div>
                </div>
                <div class="nyt-divider"></div>
              </div>
              <div class="nyt-body">
                <div class="nyt-category">${escapeHtml(f.category || '')}</div>
                <h1 class="nyt-headline">${escapeHtml(f.headline || '')}</h1>
                <div class="nyt-subheadline">${escapeHtml(f.subheadline || '')}</div>
                ${f.has_photo ? `<div class="press-photo nyt-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo ? `<div class="nyt-caption">${escapeHtml(f.image_caption || '')}</div>` : ''}
                <div class="nyt-byline">
                  <div class="nyt-author"><span>By </span>${escapeHtml(String(f.author || '').replace(/^By\s+/i, ''))}</div>
                  <div class="nyt-date-line">${escapeHtml(f.date || '')}${f.update_time ? ` · ${escapeHtml(f.update_time)}` : ''}${f.read_time ? ` · ${escapeHtml(f.read_time)}` : ''}</div>
                </div>
                <div class="nyt-actions">${iconGift()} ${iconBookmark()} ${iconComment()} ${iconShare()}</div>
                <div class="nyt-content">${f.body || ''}</div>
              </div>
            </article>
          `;
        },
        articleFaz(f) {
          const typeLabel = f.content_type && f.content_type !== 'Bericht' ? `<span class="faz-content-type ${String(f.content_type).toLowerCase() === 'kommentar' ? 'comment' : ''}">[${escapeHtml(f.content_type)}]</span>` : '';
          return `
            <article class="press-article faz-article">
              <div class="faz-header">
                <div class="faz-header-top">
                  <div class="faz-brand"><div class="faz-logo">F.A.Z.</div><div class="faz-title">Frankfurter Allgemeine</div></div>
                  <div class="faz-date">${escapeHtml(f.date || '')}</div>
                </div>
              </div>
              <div class="faz-nav"><span>Politik</span><span class="active">Wirtschaft</span><span>Finanzen</span><span>Feuilleton</span><span>Sport</span><span>Technik</span><span>Wissen</span></div>
              <div class="faz-body">
                <div class="faz-kicker-row">
                  ${f.kicker ? `<div class="faz-kicker">${escapeHtml(f.kicker)}</div>` : ''}
                  ${typeLabel}
                  ${f.is_faz_plus ? '<span class="faz-fplus">F+</span>' : ''}
                </div>
                <h1 class="faz-headline">${escapeHtml(f.headline || '')}</h1>
                <div class="faz-subheadline">${escapeHtml(f.subheadline || '')}</div>
                ${f.has_photo ? `<div class="press-photo faz-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo ? `<div class="faz-caption">${escapeHtml(f.image_caption || '')}</div>` : ''}
                <div class="faz-byline"><span class="faz-author">${escapeHtml(f.author || '')}</span><span>·</span><span class="faz-datetime">${escapeHtml(f.date || '')}${f.time ? ` ${escapeHtml(f.time)}` : ''}</span></div>
                <div class="faz-content">${f.body || ''}</div>
              </div>
            </article>
          `;
        },
        articleFt(f) {
          const type = String(f.content_type || 'News').toLowerCase();
          const badge = type !== 'news' ? `<span class="ft-badge ${escapeAttribute(type)}">${escapeHtml(f.content_type)}</span>` : '';
          return `
            <article class="press-article ft-article">
              <div class="ft-header">
                <div class="ft-top">
                  <div class="ft-logo">Financial Times</div>
                  <div class="ft-nav"><span>Home</span><span>World</span><span>UK</span><span>Markets</span><span>Climate</span><span>Opinion</span><span>Tech</span></div>
                </div>
                <div class="ft-separator"></div>
              </div>
              <div class="ft-body">
                <div class="ft-kicker-row"><div class="ft-category">${escapeHtml(f.category || '')}</div>${badge}</div>
                <h1 class="ft-headline">${escapeHtml(f.headline || '')}</h1>
                ${f.subheadline ? `<div class="ft-subheadline">${escapeHtml(f.subheadline)}</div>` : ''}
                ${f.has_photo ? `<div class="press-photo ft-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo && f.image_caption ? `<div class="ft-caption">${escapeHtml(f.image_caption)}</div>` : ''}
                <div class="ft-byline">
                  <div>
                    <div class="ft-author">${formatFtAuthor(f.author || '')}</div>
                    ${f.is_premium ? `<div class="ft-premium">${iconLock()}<span>Premium content</span></div>` : ''}
                  </div>
                  <div class="ft-datetime">${escapeHtml(f.date || '')}${f.time ? ` · ${escapeHtml(f.time)}` : ''}</div>
                </div>
                <div class="ft-content">${f.body || ''}</div>
              </div>
            </article>
          `;
        },
        articleNikkei(f) {
          const tags = String(f.related_tags || '').split(',').map(t => t.trim()).filter(Boolean);
          return `
            <article class="press-article nikkei-article">
              <div class="nikkei-header">
                <div class="nikkei-header-inner">
                  <div class="nikkei-logo">日本経済新聞</div>
                  <div class="nikkei-nav"><span>トップ</span><span>経済</span><span>ビジネス</span><span>テクノロジー</span><span>国際</span><span>マーケット</span><span>政治</span></div>
                </div>
              </div>
              <div class="nikkei-body">
                <div class="nikkei-category">${escapeHtml(f.category || '')}</div>
                <h1 class="nikkei-headline">${escapeHtml(f.headline || '')}</h1>
                ${f.subheadline ? `<div class="nikkei-subheadline">${escapeHtml(f.subheadline)}</div>` : ''}
                <div class="nikkei-meta">
                  <span class="nikkei-date">${escapeHtml(f.date || '')}${f.update_time ? ` （${escapeHtml(f.update_time)}）` : ''}</span>
                  ${f.is_premium ? '<span class="nikkei-premium">有料会員限定</span>' : ''}
                </div>
                <div class="nikkei-byline">${escapeHtml(f.author || '')}</div>
                ${f.has_photo ? `<div class="press-photo nikkei-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo && f.image_caption ? `<div class="nikkei-caption">${escapeHtml(f.image_caption)}</div>` : ''}
                <div class="nikkei-content">${f.body || ''}</div>
                ${tags.length ? `<div class="nikkei-tags">${tags.map(t => `<span class="nikkei-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
              </div>
            </article>
          `;
        },
        reddit(f) {
          const awards = parseArrayField(f.awards);
          const topComment = parseObjectField(f.top_comment);
          const postBody = String(f.body || '');
          const hasTextBody = Boolean(postBody.trim());
          const truncated = postBody.replace(/<[^>]+>/g, '').length > 320;
          return `
            <article class="reddit-page">
              <div class="reddit-header">
                <div class="reddit-logo"><span class="reddit-logo-mark"></span><span>reddit</span></div>
                <div class="reddit-search">Search Reddit</div>
              </div>
              <div class="reddit-card">
                <div class="reddit-votes">
                  ${iconRedditArrow('upvote')}
                  <div class="reddit-score">${formatMetric(f.upvotes)}</div>
                  ${iconRedditArrow()}
                </div>
                <div class="reddit-main">
                  <div class="reddit-meta">
                    <span class="reddit-sub-icon" style="background:${escapeAttribute(f.subreddit_icon_color || '#FF4500')};">${escapeHtml(subredditInitials(f.subreddit || 'r/cybersecurity'))}</span>
                    <span class="reddit-sub-name">${escapeHtml(f.subreddit || '')}</span>
                    <span>·</span>
                    <span>${f.is_pinned ? 'Pinned by moderators' : 'Posted by'}</span>
                    <span>${escapeHtml(f.author || '')}</span>
                    ${f.author_flair ? `<span class="reddit-author-flair" style="color:${escapeAttribute(f.flair_color || '#0079D3')};">${escapeHtml(f.author_flair)}</span>` : ''}
                    <span>·</span>
                    <span>${escapeHtml(f.date || '')}</span>
                  </div>
                  ${f.post_flair ? `<div class="reddit-post-flair" style="background:${escapeAttribute(f.post_flair_color || '#ff4500')};">${escapeHtml(f.post_flair)}</div>` : ''}
                  <div class="reddit-title">${escapeHtml(f.title || '')}</div>
                  ${hasTextBody ? `<div class="reddit-body ${truncated ? 'truncated' : ''}">${postBody}</div>${truncated ? `<div class="reddit-readmore">…read more</div>` : ''}` : ''}
                  ${!hasTextBody && f.link_url ? `<div class="reddit-link-preview"><div class="reddit-link-domain">${escapeHtml(f.link_domain || f.link_url)}</div><div>${escapeHtml(f.link_url)}</div></div>` : ''}
                  ${(awards.length || f.upvote_ratio) ? `<div class="reddit-awards">${awards.map(renderAward).join('')}${f.upvote_ratio ? `<span class="reddit-ratio">${escapeHtml(f.upvote_ratio)}</span>` : ''}</div>` : ''}
                  <div class="reddit-actions">
                    <span class="reddit-action">${iconComment()} <span>${formatMetric(f.comments_count)} Comments</span></span>
                    <span class="reddit-action">${iconShare()} <span>Share</span></span>
                    <span class="reddit-action">${iconBookmark()} <span>Save</span></span>
                    <span class="reddit-action">···</span>
                  </div>
                </div>
              </div>
              ${topComment && (topComment.text || topComment.author) ? `
                <div class="reddit-comment" style="border-left-color:${escapeAttribute(f.subreddit_icon_color || '#FF4500')};">
                  <div class="reddit-comment-meta">
                    <span class="reddit-comment-author">${escapeHtml(topComment.author || '')}</span>
                    ${topComment.flair ? `<span class="reddit-comment-flair" style="color:${escapeAttribute(f.flair_color || '#0079D3')};">${escapeHtml(topComment.flair)}</span>` : ''}
                    <span>·</span>
                    <span>${escapeHtml(topComment.date || '')}</span>
                  </div>
                  <div class="reddit-comment-text">${escapeHtml(topComment.text || '')}</div>
                  <div class="reddit-comment-actions"><span>▲ ${formatMetric(topComment.upvotes)}</span><span>Reply</span><span>Share</span><span>···</span></div>
                </div>` : ''}
            </article>
          `;
        },
        twitter(f) {
          return `
            <article class="tweet">
              <div class="tweet-header">
                <div class="avatar" style="background:${escapeAttribute(f.avatar_color || '#1da1f2')};">${escapeHtml(f.avatar_initials || 'AA')}</div>
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
                    <div>
                      <div class="tweet-name">${escapeHtml(f.display_name || '')} ${f.verified ? verifiedBadge(f.verified_type) : ''}</div>
                      <div class="tweet-handle">${escapeHtml(f.handle || '')}</div>
                    </div>
                    <div class="tweet-meta">···</div>
                  </div>
                  <div class="tweet-text">${escapeHtml(f.text || '')}</div>
                  <div class="tweet-meta">${escapeHtml(f.date || '')}</div>
                  <div class="tweet-divider"></div>
                  <div class="tweet-metrics">
                    <span><strong>${formatMetric(f.replies)}</strong> Replies</span>
                    <span><strong>${formatMetric(f.retweets)}</strong> Reposts</span>
                    <span><strong>${formatMetric(f.quotes)}</strong> Quotes</span>
                    <span><strong>${formatMetric(f.likes)}</strong> Likes</span>
                    <span><strong>${formatMetric(f.views)}</strong> Views</span>
                  </div>
                  <div class="tweet-divider"></div>
                  <div class="tweet-actions"><span>${iconReply()}</span><span>${iconRetweet()}</span><span>${iconLike()}</span><span>${iconViews()}</span><span>${iconShare()}</span></div>
                </div>
              </div>
            </article>
          `;
        },
        linkedin(f) {
          const reactions = parseArrayField(f.reaction_types).join(' ');
          const trimmed = String(f.text || '');
          const showMore = trimmed.split(/\n/).length > 3 || trimmed.length > 280;
          return `
            <article class="linkedin-card">
              <div class="li-header">
                <div class="avatar" style="background:${escapeAttribute(f.avatar_color || '#0A66C2')}; width:52px; height:52px;">${escapeHtml(f.avatar_initials || 'AA')}</div>
                <div class="li-meta">
                  <div class="li-name">${escapeHtml(f.display_name || '')}</div>
                  <div class="li-title">${escapeHtml(f.title || '')}</div>
                  <div class="li-date">${escapeHtml(f.date || '')} · 🌐</div>
                </div>
              </div>
              <div class="li-text">${escapeHtml(trimmed)}${showMore ? `<div class="li-see-more">${tt('…see more', '…voir plus')}</div>` : ''}</div>
              <div class="li-stats"><span>${reactions}</span><span>${formatMetric(f.reactions_count)} ${tt('reactions', 'réactions')} · ${formatMetric(f.comments_count)} ${tt('comments', 'commentaires')} · ${formatMetric(f.reposts_count)} ${tt('reposts', 'republications')}</span></div>
              <div class="li-divider"></div>
              <div class="li-actions"><strong>${tt('Like', 'J’aime')}</strong><strong>${tt('Comment', 'Commenter')}</strong><strong>${tt('Repost', 'Republier')}</strong><strong>${tt('Send', 'Envoyer')}</strong></div>
            </article>
          `;
        },
        bfm(f) {
          return `
            <article class="bfm-banner">
              <div class="bfm-live">
                <div class="bfm-logo">BFM<br>TV</div>
                <div class="bfm-category">${escapeHtml(f.category || 'ALERTE INFO')}</div>
              </div>
              <div class="bfm-main">
                <div class="bfm-headline">${escapeHtml(f.headline || '')}</div>
                <div class="bfm-subline">${escapeHtml(f.subline || '')}</div>
              </div>
              <div class="bfm-footer">
                <div class="bfm-time">${escapeHtml(f.time || '')}</div>
                <div class="bfm-ticker-wrap"><div class="bfm-ticker">${escapeHtml(f.ticker || '')}</div></div>
                <div class="bfm-channel">DIRECT</div>
              </div>
            </article>
          `;
        },
        authority(f) {
          const colors = { critical: '#b91c1c', high: '#d97706', medium: '#ca8a04' };
          const color = colors[f.severity] || colors.high;
          return `
            <article class="authority-email">
              <div class="authority-strip" style="background:${color};"></div>
              <div class="authority-body">
                <div class="authority-header">
                  <div class="authority-brand">
                    <div class="rf-logo"></div>
                    <div>
                      <strong>ANSSI · CERT-FR</strong><br>
                      <span class="subtle">${tt('Official cybersecurity alert', 'Alerte officielle cybersécurité')}</span>
                    </div>
                  </div>
                  <div class="mono">${escapeHtml(f.reference || '')}</div>
                </div>
                <div class="authority-content">
                  <div class="authority-banner"><strong>${tt('Severity', 'Sévérité')} : ${escapeHtml(f.severity || '')}</strong> · ${tt('Restricted distribution to recipient', 'Diffusion restreinte au destinataire')}</div>
                  <p><strong>${tt('From', 'De')} :</strong> ${escapeHtml(f.from_name || '')} &lt;${escapeHtml(f.from_email || '')}&gt;<br><strong>${tt('To', 'À')} :</strong> ${escapeHtml(f.to || '')}<br><strong>${tt('Date', 'Date')} :</strong> ${escapeHtml(f.date || '')}</p>
                  <h2 style="margin-top:0;">${escapeHtml(f.subject || '')}</h2>
                  <div>${f.body || ''}</div>
                </div>
              </div>
            </article>
          `;
        },
        pressRelease(f) {
          return `
            <article class="press-release">
              <div class="pr-logo" style="color:${escapeAttribute(f.logo_color || '#003366')};">${escapeHtml(f.logo_text || '')}</div>
              <div class="pr-meta">${escapeHtml(f.date || '')}</div>
              <div class="pr-title">${escapeHtml(f.title || '')}</div>
              <div class="pr-body">${f.body || ''}</div>
              <div class="pr-contact">
                <strong>${tt('Press contact', 'Contact presse')}</strong><br>
                ${escapeHtml(f.contact_name || '')}<br>
                ${escapeHtml(f.contact_email || '')}<br>
                ${escapeHtml(f.contact_phone || '')}
              </div>
            </article>
          `;
        },
        sms(f) {
          return `
            <article class="sms-shell ${f.device === 'android' ? 'sms-android' : ''}">
              <div class="sms-screen">
                <div class="sms-top">${escapeHtml(f.sender || '')}</div>
                <div style="display:flex; justify-content:flex-start;">
                  <div>
                    <div class="sms-bubble">${escapeHtml(f.text || '')}</div>
                    <div class="sms-time">${tt('Today', 'Aujourd’hui')} ${escapeHtml(f.time || '')}</div>
                  </div>
                </div>
              </div>
            </article>
          `;
        },
        // ── HD RENDERERS ──────────────────────────────────────────
        articlePressHD(templateId, f) {
          switch (templateId) {
            case 'lemonde': return this.articleLeMondeHD(f);
            case 'faz': return this.articleFazHD(f);
            case 'ft': return this.articleFtHD(f);
            case 'nikkei': return this.articleNikkeiHD(f);
            case 'nyt':
            default:
              return this.articleNytHD(f);
          }
        },
        articleNytHD(f) {
          const nytLogo = `<div class="nyt-hd-wordmark">The New York Times</div>`;
          return `
            <article class="press-article nyt-article hd">
              <div class="nyt-hd-topbar">
                <div class="nyt-hd-topbar-left">
                  <span class="nyt-hd-menu"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></span>
                  <span class="nyt-hd-search-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg></span>
                </div>
                <div class="nyt-hd-topbar-center">${nytLogo}</div>
                <div class="nyt-hd-topbar-right">
                  <span class="nyt-hd-login">LOG IN</span>
                </div>
              </div>
              <div class="nyt-rail">
                <div class="nyt-masthead-row">
                  <div class="nyt-date">${escapeHtml(f.date || '')}</div>
                  <div class="nyt-nav">U.S.<span>|</span>WORLD<span>|</span>BUSINESS<span>|</span>TECHNOLOGY<span>|</span>SCIENCE<span>|</span>CLIMATE<span>|</span>OPINION</div>
                </div>
                <div class="nyt-divider"></div>
              </div>
              <div class="nyt-body">
                <div class="nyt-category">${escapeHtml(f.category || '')}</div>
                <h1 class="nyt-headline">${escapeHtml(f.headline || '')}</h1>
                <div class="nyt-subheadline">${escapeHtml(f.subheadline || '')}</div>
                ${f.has_photo ? `<div class="press-photo nyt-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo ? `<div class="nyt-caption">${escapeHtml(f.image_caption || '')}</div>` : ''}
                <div class="nyt-byline">
                  <div class="nyt-author"><span>By </span>${escapeHtml(String(f.author || '').replace(/^By\s+/i, ''))}</div>
                  <div class="nyt-date-line">${escapeHtml(f.date || '')}${f.update_time ? ` · ${escapeHtml(f.update_time)}` : ''}${f.read_time ? ` · ${escapeHtml(f.read_time)}` : ''}</div>
                </div>
                <div class="nyt-hd-share">
                  <span>${iconGift()}</span><span>${iconBookmark()}</span><span>${iconComment()}</span><span>${iconShare()}</span>
                  <span class="nyt-hd-comments-count">${formatMetric(f.comments_count || 142)}</span>
                </div>
                <div class="nyt-content">${f.body || ''}</div>
                <div class="nyt-hd-footer">
                  <div class="nyt-hd-related">${tt('Related coverage', 'Articles liés')}</div>
                  <div class="nyt-hd-related-items">
                    <div class="nyt-hd-related-item">${tt('Cybersecurity experts say attacks are escalating', 'Les experts en cybersécurité alertent sur l\'escalade des attaques')}</div>
                    <div class="nyt-hd-related-item">${tt('European regulators push for stricter cyber rules', 'Les régulateurs européens poussent pour des règles cyber plus strictes')}</div>
                  </div>
                </div>
              </div>
            </article>
          `;
        },
        articleFazHD(f) {
          const typeLabel = f.content_type && f.content_type !== 'Bericht' ? `<span class="faz-content-type ${String(f.content_type).toLowerCase() === 'kommentar' ? 'comment' : ''}">[${escapeHtml(f.content_type)}]</span>` : '';
          const fazLogo = `<div class="faz-hd-wordmark">Frankfurter Allgemeine</div>`;
          return `
            <article class="press-article faz-article hd">
              <div class="faz-hd-header">
                <div class="faz-hd-header-left">
                  <span class="faz-hd-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#333" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></span>
                  <span class="faz-hd-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#333" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg></span>
                  <span class="faz-hd-meta-link"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="13" y2="16"/></svg> NEWSPAPER</span>
                  <span class="faz-hd-meta-link"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"><circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="19" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/></svg> MORE FAZ</span>
                </div>
                <div class="faz-hd-header-center">${fazLogo}</div>
                <div class="faz-hd-header-right">
                  <span class="faz-hd-sub-btn">Subscription</span>
                  <span class="faz-hd-user"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#333" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg></span>
                </div>
              </div>
              <div class="faz-hd-breadcrumb">🏠 › ${escapeHtml(f.category || 'Wirtschaft')} › ${escapeHtml(f.headline || '').slice(0, 50)}${(f.headline || '').length > 50 ? '…' : ''}</div>
              <div class="faz-body">
                <div class="faz-kicker-row">
                  ${f.kicker ? `<div class="faz-kicker">${escapeHtml(f.kicker)}</div>` : ''}
                  ${typeLabel}
                  ${f.is_faz_plus ? '<span class="faz-fplus">F+</span>' : ''}
                </div>
                <h1 class="faz-headline">${escapeHtml(f.headline || '')}</h1>
                <div class="faz-subheadline">${escapeHtml(f.subheadline || '')}</div>
                ${f.has_photo ? `<div class="press-photo faz-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo ? `<div class="faz-caption">${escapeHtml(f.image_caption || '')}</div>` : ''}
                <div class="faz-byline"><span class="faz-author">${escapeHtml(f.author || '')}</span><span>·</span><span class="faz-datetime">${escapeHtml(f.date || '')}${f.time ? ` ${escapeHtml(f.time)}` : ''}</span></div>
                <div class="faz-hd-social">${iconShare()} ${iconBookmark()} ${iconComment()}</div>
                <div class="faz-content">${f.body || ''}</div>
              </div>
            </article>
          `;
        },
        articleFtHD(f) {
          const type = String(f.content_type || 'News').toLowerCase();
          const badge = type !== 'news' ? `<span class="ft-badge ${escapeAttribute(type)}">${escapeHtml(f.content_type)}</span>` : '';
          const ftLogo = `<svg viewBox="0 0 1054 86" fill="none" aria-label="Financial Times" style="height:20px;width:auto;"><title>Financial Times</title><path d="M26.177 72.609c0 5.938 1.697 7.295 12.554 7.295v3.732H.9v-3.732c7.464 0 10.01-.679 10.01-7.125V12.215c0-6.447-2.546-7.126-10.01-7.126V1.357h63.448l.34 22.563h-3.054C59.937 6.956 55.696 5.43 39.919 5.43H26.008v33.59h11.196c10.688 0 11.367-1.697 12.215-10.179h3.054v24.599h-3.054c-.848-8.482-1.527-10.01-12.215-10.01H26.008v29.18h.17zm46.314 11.027v-3.732c7.465 0 10.01-.679 10.01-7.125V12.215c0-6.447-2.545-7.126-10.01-7.126V1.357h35.287V5.09c-7.465 0-10.01.679-10.01 7.126v60.564c0 6.446 2.545 7.125 10.01 7.125v3.732H72.49zm115.36 1.357l-56.323-69.725V72.44c0 6.617 4.58 7.634 12.385 7.634v3.733h-29.858v-3.733c7.803 0 12.045-1.017 12.045-7.634V8.991c-3.563-3.732-6.108-3.902-12.045-3.902V1.357h26.465l43.09 55.475V12.554c0-6.616-4.58-7.634-12.384-7.634V1.357h30.027V5.09c-7.803 0-12.045 1.018-12.045 7.635v72.27h-1.357zm40.207-1.357h-29.689v-3.732c7.804 0 11.367-1.018 13.911-7.804L239.085.509h7.464l28.84 72.1c2.545 6.447 3.732 7.125 9.67 7.125v3.732h-34.438v-3.732c10.518 0 11.536-.848 8.99-7.125l-8.481-21.884h-25.787L217.71 71.93c-2.375 6.447 1.357 7.804 10.518 7.804v3.902h-.17zm-1.188-37.153h22.393l-11.705-29.518-10.688 29.518zm135.548 38.51l-56.153-69.725V72.44c0 6.617 4.58 7.634 12.384 7.634v3.733h-29.18v-3.733c7.126 0 11.367-1.017 11.367-7.634V9.161c-4.071-3.732-7.125-4.072-13.91-4.072V1.357h28.16l43.09 55.475V12.554c0-6.616-4.58-7.634-12.383-7.634V1.357h29.858V5.09c-7.804 0-12.045 1.018-12.045 7.635v72.27h-1.188zm83.297-83.805h2.036l1.187 24.598-3.053.17c-2.036-14.08-9.5-21.545-23.242-21.545-15.268 0-26.804 13.063-26.804 33.081 0 25.617 16.116 40.206 33.08 40.206 7.296 0 13.912-2.035 20.358-8.99l2.376 2.374c-5.26 7.465-15.608 13.742-29.52 13.742-20.696 0-41.732-15.608-41.732-41.734C380.4 17.813 399.57 0 422.813 0c11.027 0 16.795 4.75 19.848 4.75 1.357 0 2.375-1.187 3.054-3.562zm12.723 82.448v-3.732c7.465 0 10.01-.679 10.01-7.125V12.215c0-6.447-2.545-7.126-10.01-7.126V1.357h35.287V5.09c-7.464 0-10.01.679-10.01 7.126v60.564c0 6.446 2.546 7.125 10.01 7.125v3.732h-35.287zm68.538 0h-27.653v-3.732c6.108 0 9.331-1.018 11.876-7.804L538.003.509h7.464l28.84 72.1c2.545 6.447 3.733 7.125 9.67 7.125v3.732H549.54v-3.732c10.518 0 11.536-.848 8.991-7.125l-8.482-21.884h-25.786l-7.635 21.205c-2.375 6.447 1.358 7.804 10.519 7.804v3.902h-.17zm-1.188-37.153h22.394l-11.536-29.518-10.858 29.518zm63.957 37.153v-3.732c7.465 0 10.01-.679 10.01-7.125V12.215c0-6.447-2.545-7.126-10.01-7.126V1.357h35.117V5.09c-7.464 0-9.84.679-9.84 7.126v61.073c0 5.428 2.715 6.107 7.126 6.107h4.241c15.947 0 21.036-2.375 25.447-20.527l3.054.339-2.545 24.26h-62.6v.17zM760.75 1.357l.339 23.92h-3.054C756.34 7.634 752.098 5.43 736.32 5.43h-5.089v67.18c0 6.447 2.375 7.295 12.554 7.295v3.732h-40.376v-3.732c10.179 0 12.723-1.018 12.723-7.295V5.429h-5.089c-15.777 0-20.018 2.205-21.715 19.848h-3.053l.339-23.92h74.136zm7.973 82.28v-3.733c7.465 0 10.01-.679 10.01-7.125V12.215c0-6.447-2.545-7.126-10.01-7.126V1.357h35.287V5.09c-7.465 0-10.01.679-10.01 7.126v60.564c0 6.446 2.545 7.125 10.01 7.125v3.732h-35.287zM910.21 1.356V5.09c-7.465 0-10.688.34-10.01 6.956l6.447 61.073c.679 6.277 3.054 6.955 10.518 6.955v3.733h-35.117v-3.733c7.295 0 9.84-.678 9.331-6.955L884.762 8.99l-25.956 76.172h-1.018L832.34 8.822l-6.108 64.126c-.678 6.447 3.733 7.125 11.197 7.125v3.733h-27.483v-3.733c7.465 0 10.01-1.187 10.518-7.125l6.447-61.073c.679-6.446-2.545-6.955-10.01-6.955V1.357h28.84l17.305 56.153 18.661-56.153h28.5zm65.653 52.082h-3.053c-.849-8.482-1.527-10.01-12.215-10.01H948.04v29.859c0 5.428 2.715 6.107 7.125 6.107h6.786c15.947 0 21.036-2.375 25.447-20.527l3.054.339-2.884 24.26h-64.805v-3.733c7.464 0 10.009-.678 10.009-7.125V12.215c0-6.447-2.545-7.126-10.01-7.126V1.357h62.261l.34 20.527h-3.054c-1.866-14.59-5.598-16.286-21.885-16.286H948.21v33.42h12.554c10.687 0 11.366-1.696 12.214-10.178h3.054v24.599h-.17zm65.484 13.232c0-7.464-4.75-11.196-12.893-15.777l-13.063-6.786c-9.84-5.259-15.607-11.027-15.607-21.375C999.783 9.84 1010.81 0 1025.23 0c9.84 0 14.929 4.75 17.813 4.75 1.866 0 2.714-1.187 3.562-3.562h2.375l1.188 23.072-3.054.17c-1.696-11.198-9.67-19.85-20.866-19.85-8.483 0-14.081 5.09-14.081 12.215 0 7.804 5.937 11.027 12.554 14.59l11.196 5.937c10.519 5.768 17.983 11.536 17.983 22.563 0 14.59-12.554 24.939-28.161 24.939-11.028 0-16.456-5.26-19.34-5.26-1.866 0-2.884 1.697-3.732 4.242h-2.376l-1.696-24.43 3.054-.339c2.375 15.268 12.893 21.545 23.411 21.545 8.822-.17 16.286-4.071 16.286-13.91z" fill="#231F20" fill-rule="evenodd"/></svg>`;
          return `
            <article class="press-article ft-article hd">
              <div class="ft-hd-ticker">
                <span>S&amp;P 500 <em class="ft-tick-down">▼ 0.37%</em></span><span>FTSE 100 <em class="ft-tick-up">▲ 0.72%</em></span><span>Euro/Dollar <em class="ft-tick-down">▼ 0.06%</em></span><span>Brent Crude Oil <em class="ft-tick-down">▼ 5.03%</em></span><span class="ft-tick-link">Visit Markets Data</span>
              </div>
              <div class="ft-hd-masthead">
                <div class="ft-hd-masthead-left">
                  <span class="ft-hd-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></span>
                  <span class="ft-hd-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg></span>
                </div>
                <div class="ft-hd-masthead-center">${ftLogo}</div>
                <div class="ft-hd-masthead-right">
                  <span class="ft-hd-subscribe">Subscribe</span>
                  <span class="ft-hd-signin"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg> Sign In</span>
                </div>
              </div>
              <div class="ft-hd-nav-bar">
                <span class="active">HOME</span><span>WORLD</span><span>US</span><span>COMPANIES</span><span>TECH</span><span>MARKETS</span><span>CLIMATE</span><span>OPINION</span><span>LEX</span><span>WORK &amp; CAREERS</span><span>LIFE &amp; ARTS</span>
              </div>
              <div class="ft-header" style="display:none;"></div>
              <div class="ft-body">
                <div class="ft-kicker-row"><div class="ft-category">${escapeHtml(f.category || '')}</div>${badge}</div>
                <h1 class="ft-headline">${escapeHtml(f.headline || '')}</h1>
                ${f.subheadline ? `<div class="ft-subheadline">${escapeHtml(f.subheadline)}</div>` : ''}
                ${f.has_photo ? `<div class="press-photo ft-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo && f.image_caption ? `<div class="ft-caption">${escapeHtml(f.image_caption)}</div>` : ''}
                <div class="ft-byline">
                  <div>
                    <div class="ft-author">${formatFtAuthor(f.author || '')}</div>
                    ${f.is_premium ? `<div class="ft-premium">${iconLock()}<span>Premium content</span></div>` : ''}
                  </div>
                  <div class="ft-datetime">${escapeHtml(f.date || '')}${f.time ? ` · ${escapeHtml(f.time)}` : ''}</div>
                </div>
                <div class="ft-hd-tools">
                  <div class="ft-hd-save">${iconBookmark()} Save</div>
                  <div class="ft-hd-share">${iconShare()} Share</div>
                  <div class="ft-hd-print">🖨️ Print</div>
                </div>
                <div class="ft-content">${f.body || ''}</div>
              </div>
            </article>
          `;
        },
        articleNikkeiHD(f) {
          const tags = String(f.related_tags || '').split(',').map(t => t.trim()).filter(Boolean);
          return `
            <article class="press-article nikkei-article hd">
              <div class="nikkei-hd-top-bar">
                <div class="nikkei-hd-top-left">
                  <span class="nikkei-hd-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#333" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></span>
                  <span class="nikkei-hd-search-box"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#666" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg> Search articles and stock</span>
                </div>
                <div class="nikkei-hd-top-center">
                  <div class="nikkei-logo">日本経済新聞</div>
                </div>
                <div class="nikkei-hd-top-right">
                  <span class="nikkei-hd-app-btn">Application</span>
                  <span class="nikkei-hd-login-btn">Log in</span>
                </div>
              </div>
              <div class="nikkei-hd-mid-bar">
                <span>Morning and evening editions</span><span>LIVE</span><span>My News</span><span>Nikkei Company Information</span><span>HR Watch</span><span>NIKKEI Prime</span>
              </div>
              <div class="nikkei-hd-nav-bar">
                <span>top</span><span>breaking news</span><span>business</span><span>market</span><span>economy</span><span>international</span><span>opinion</span><span>See more</span>
              </div>
              <div class="nikkei-body">
                <div class="nikkei-category">${escapeHtml(f.category || '')}</div>
                <h1 class="nikkei-headline">${escapeHtml(f.headline || '')}</h1>
                ${f.subheadline ? `<div class="nikkei-subheadline">${escapeHtml(f.subheadline)}</div>` : ''}
                <div class="nikkei-meta">
                  <span class="nikkei-date">${escapeHtml(f.date || '')}${f.update_time ? ` （${escapeHtml(f.update_time)}）` : ''}</span>
                  ${f.is_premium ? '<span class="nikkei-premium">有料会員限定</span>' : ''}
                </div>
                <div class="nikkei-byline">${escapeHtml(f.author || '')}</div>
                <div class="nikkei-hd-share">${iconShare()} ${iconBookmark()} ${iconComment()}</div>
                ${f.has_photo ? `<div class="press-photo nikkei-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo && f.image_caption ? `<div class="nikkei-caption">${escapeHtml(f.image_caption)}</div>` : ''}
                <div class="nikkei-content">${f.body || ''}</div>
                ${tags.length ? `<div class="nikkei-tags">${tags.map(t => `<span class="nikkei-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
              </div>
            </article>
          `;
        },
        articleLeMondeHD(f) {
          const lmLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 214 48" fill="none" style="height:30px;width:auto;" aria-label="Le Monde"><path fill="#fff" fill-opacity=".98" d="M12.9878 32.4191c-.1175 1.833-.4815 3.1549-1.2037 4.1596l.7222.8871 4.2102-3.2195c2.0436-1.5805 3.1857-3.5369 3.1241-6.9386-.0616-4.2242-1.9259-10.7222-1.9259-15.7043 0-4.28884 1.562-7.50843 5.1116-7.50843 2.4018 0 4.3277 2.58507 4.6245 4.03623.1231.69327 0 1.01053-.5991 1.45117l-1.6796 1.20443v1.9505l8.3532-5.49325c-1.0805-1.76842-3.9694-5.04088-9.6801-5.04088-6.8472-.05875-12.8601 5.55202-13.1009 12.36133-.1847 5.4345 2.2843 12.4318 2.0435 17.8546ZM42.532 42.0074l-4.4509-3.2196c-.5375-.376-.5991-.752-.5991-1.5746v-5.6754l11.7181-7.5025-8.0509-9.3357-12.5635 7.6906v1.7626l2.5866-1.5099v17.4727c0 1.0046.3583 1.6391.963 2.0798l6.6736 4.5415 9.4394-5.7401-.7838-1.7684-4.9325 2.779Zm-5.05-22.2669.4815-.3172 4.9268 5.9926-5.4083 3.531v-9.2064ZM25.3665 41.5667c-1.3829-1.7684-3.6056-3.8482-8.8963-3.8482-5.5875-.0647-12.44026 4.6061-15.56432 8.6423l.54308.7579c4.26619-2.9669 8.65554-4.2888 12.50184-4.2888 3.1241 0 5.7106 1.5745 6.7912 3.9069l7.2111-4.9175-.7222-1.5158-1.8644 1.2632ZM75.2003 41.3141c-1.6236-1.8272-3.9079-2.967-7.1551-2.967-6.1865.0647-12.0819 4.7295-14.6069 7.6319l.6606.8812c3.4824-2.773 7.687-3.9774 10.6375-3.9128 3.1241.1234 4.8708 1.9505 5.4699 3.719l8.4764-5.2994-.7782-1.6392-2.7042 1.5863Z"/><path fill="#fff" fill-opacity=".98" d="m105.903 41.696-.783-.4407c-.779-.4465-.963-1.1339-.963-2.6497V14.447c0-3.0257.778-4.98213 3.129-6.43329l2.458-1.50992-.901-1.58041-1.142.62864c-1.383.75789-2.346 1.26316-4.328.06463l-5.834-3.46634-7.5694 4.9175-6.1249-4.9175-7.0936 4.47686c-.3023-2.27368-2.4074-6.1219-8.1124-3.78947-1.3213.56989-3.1857 1.32778-4.1487 1.70379-2.0435.7579-3.0624-.24675-1.8027-2.14443L63.6502.9459 62.3345 0c-1.6796 2.27368-2.3458 3.21958-2.3458 3.21958-2.7042 3.71898-1.019 6.68593 2.9449 6.11604.963-.12338 2.525-.38189 3.5496-.56402 2.7041-.50526 3.0624.56402 3.0624 3.2783v18.4128c0 2.5204-.4199 4.6707-2.2842 6.1865l.6046 1.0693 6.013-3.9716c2.4018-1.5746 2.8833-3.8482 2.8833-6.9973V8.70698l3.0681-1.82718 2.5194 2.14443c.9014.7579 1.0862 1.13387 1.0862 2.83767v34.8162h.4814c2.4019-1.3219 4.1375-2.2091 4.1375-2.2091 2.2282-1.1985 2.5865-1.5745 2.5865-4.2242V8.83623l3.1857-2.02105 7.0939 4.35352-.9634.7579c-1.6796 1.3219-2.8889 3.4722-2.8889 7.5025v21.5677c0 1.9564.4815 2.967 1.6292 3.7836l2.5811 1.8331 7.513-4.7295-.722-1.5158-2.167 1.3278ZM132.48 38.729V21.6323c0-.8812-.296-1.5745-1.142-2.0798l-7.754-4.8529-12.563 7.6906v1.8331l2.586-1.5746v16.7148c0 1.51.359 2.0798 1.26 2.6497l7.631 4.7295 12.619-7.7552-.543-1.3865-2.094 1.128Zm-6.309 2.9023-.359.0647-4.932-3.0316c-.84-.5053-1.025-1.0693-1.025-2.2091l.062-16.5855.358-.1293 4.748 2.9024c.957.5698 1.142 1.0751 1.142 2.1444v16.844h.006ZM164.32 41.1261l-2.228 1.3277-.778-.5052c-.84-.5053-1.025-1.1398-1.025-2.6497V21.1917c0-1.4512-.302-2.0798-1.142-2.7144l-4.63-3.6602-7.15 4.2889-3.784-4.2889-7.575 4.8588 1.024 1.2573 2.581-1.6333 1.864 2.2031v25.1046h.482c3.006-1.3924 3.969-1.8331 3.969-1.8331 1.445-.6345 1.865-1.1339 1.865-2.8964V20.9332l2.469-1.51 2.883 2.3971c.778.6933.901 1.2632.901 2.3324l.062 17.1555c0 1.8918.543 2.9611 1.741 3.719l2.525 1.5804 6.551-4.0421-.605-1.4394ZM187.146 38.7878V12.0499c0-3.90695-1.68-6.43326-4.446-8.19581l-2.704-1.76842-8.476 5.17014 1.68.82252 2.765-1.57454 1.797 1.06927c1.926 1.13391 3.186 3.40764 3.186 5.74004v1.0046l-14.54 8.8304v1.7038l2.464-1.3865v16.0215c0 1.3865.358 1.9564 1.203 2.5204l7.212 4.7295 12.563-7.6964-.538-1.4512-2.166 1.1986Zm-6.192 2.8435-.359.0646-4.266-2.9081c-.84-.5641-1.142-1.0106-1.142-2.1386V20.563l5.347-3.4076.42.2527v24.2232ZM206.556 42.0074l-4.451-3.2196c-.604-.4407-.66-.752-.66-1.5746v-5.6754l11.779-7.5025-8.112-9.3357-12.558 7.6906v1.7626l2.587-1.5099v17.4727c0 1.0046.358 1.6391.963 2.0798l6.673 4.5415 9.434-5.7401-.717-1.7684-4.938 2.779Zm-5.111-22.2669.543-.3172 4.865 5.9926-5.408 3.531v-9.2064Z"/><g fill="#fff" opacity=".6"><path d="M57.766 8.57756c.5431 1.01053 1.5005 1.70384 2.6482 2.02104-3.5496.3173-5.106-2.64968-2.8273-5.99264-.4815 1.45116-.4255 2.8377.1791 3.9716ZM26.5702 8.45422v-.06463h.0616c-.1792-.88127-1.6236-2.90233-3.2417-2.90233-.3639 0-.6046.06463-.8398.12926 1.5621.63451 2.7658 2.26781 3.1241 3.40171l.8958-.56401Z"/></g></svg>`;
          return `
            <article class="press-article lm-article hd">
              <div class="lm-hd-tier1">
                <div class="lm-hd-tier1-left">
                  <span class="lm-hd-icon-link"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="3" width="16" height="18" rx="1"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg> Le journal</span>
                  <span class="lm-hd-icon-link"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><circle cx="5" cy="5" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="19" cy="5" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/></svg> Services</span>
                </div>
                <div class="lm-hd-tier1-center">${lmLogo}</div>
                <div class="lm-hd-tier1-right">
                  <span class="lm-hd-lang"><strong>FR</strong> <span style="color:#888;">|</span> EN</span>
                  <span class="lm-hd-account"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg> Votre compte <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4.5 L6 7.5 L9 4.5"/></svg></span>
                </div>
              </div>
              <div class="lm-hd-tier2">
                <div class="lm-hd-tier2-left">
                  <span class="lm-hd-hamburger"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> Menu</span>
                  <span class="lm-hd-sep"></span>
                  <span class="lm-hd-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg></span>
                </div>
                <div class="lm-hd-tier2-nav">
                  <span>International</span><span>Planète</span><span>Politique</span><span>Société</span><span>Économie</span><span>Idées</span><span>Culture</span><span>Le Goût du Monde</span><span>Sciences</span><span>Sports</span>
                </div>
                <div class="lm-hd-tier2-right">Voir plus <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 2 L8 6 L4 10"/></svg></div>
              </div>
              ${f.is_premium ? `<div class="lm-premium-hd"><span class="lm-premium-badge">M</span> Article réservé aux abonnés</div>` : ''}
              <div class="press-body">
                <div class="press-category">${escapeHtml(f.category || '')}</div>
                <h1 class="press-headline">${escapeHtml(f.headline || '')}</h1>
                <div class="press-subheadline">${escapeHtml(f.subheadline || '')}</div>
                <div class="press-byline"><span>Par ${escapeHtml(f.author || '')}</span><span>Publié le ${escapeHtml(f.date || '')}${f.read_time ? ` · <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" style="vertical-align:-2px"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg> Lecture ${escapeHtml(f.read_time)}` : ''}</span></div>
                <div class="lm-hd-actions">
                  <button class="lm-hd-btn">${iconGift()} Offrir l'article</button>
                  <button class="lm-hd-btn">${iconBookmark()} Lire plus tard</button>
                  ${iconShare()}
                </div>
                ${f.has_photo ? `<div class="press-photo"${f.photo_data ? ` style="background-image:url(${f.photo_data});background-size:cover;background-position:center;"` : ''}></div>` : ''}
                ${f.has_photo ? `<div class="press-caption">${escapeHtml(f.image_caption || '')}</div>` : ''}
                <div class="press-content">${f.body || ''}</div>
              </div>
            </article>
          `;
        },
        twitterHD(f) {
          return `
            <article class="tweet hd">
              <div class="tweet-hd-topbar">
                <div class="tweet-hd-back">←</div>
                <span>Post</span>
              </div>
              <div class="tweet-header">
                <div class="avatar" style="background:${escapeAttribute(f.avatar_color || '#1da1f2')};">${escapeHtml(f.avatar_initials || 'AA')}</div>
                <div style="flex:1; min-width:0;">
                  <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
                    <div>
                      <div class="tweet-name">${escapeHtml(f.display_name || '')} ${f.verified ? verifiedBadge(f.verified_type) : ''}</div>
                      <div class="tweet-handle">${escapeHtml(f.handle || '')}</div>
                    </div>
                    <div class="tweet-hd-follow">${tt('Follow', 'Suivre')}</div>
                  </div>
                  <div class="tweet-text">${escapeHtml(f.text || '')}</div>
                  <div class="tweet-meta">${escapeHtml(f.date || '')}</div>
                  <div class="tweet-divider"></div>
                  <div class="tweet-metrics">
                    <span><strong>${formatMetric(f.replies)}</strong> Replies</span>
                    <span><strong>${formatMetric(f.retweets)}</strong> Reposts</span>
                    <span><strong>${formatMetric(f.quotes)}</strong> Quotes</span>
                    <span><strong>${formatMetric(f.likes)}</strong> Likes</span>
                    <span><strong>${formatMetric(f.views)}</strong> Views</span>
                  </div>
                  <div class="tweet-divider"></div>
                  <div class="tweet-actions"><span>${iconReply()}</span><span>${iconRetweet()}</span><span>${iconLike()}</span><span>${iconViews()}</span><span>${iconShare()}</span></div>
                </div>
              </div>
              <div class="tweet-hd-reply-box">
                <div class="avatar" style="background:#657786; width:36px; height:36px; font-size:13px;">Y</div>
                <div class="tweet-hd-reply-input">${tt('Post your reply', 'Publiez votre réponse')}</div>
                <div class="tweet-hd-reply-btn">${tt('Reply', 'Répondre')}</div>
              </div>
            </article>
          `;
        },
        linkedinHD(f) {
          const reactions = parseArrayField(f.reaction_types).join(' ');
          const trimmed = String(f.text || '');
          const showMore = trimmed.split(/\n/).length > 3 || trimmed.length > 280;
          return `
            <article class="linkedin-card hd">
              <div class="li-hd-topbar">
                <div class="li-hd-logo">in</div>
                <div class="li-hd-search">🔍 ${tt('Search', 'Rechercher')}</div>
                <div class="li-hd-nav"><span>🏠</span><span>👥</span><span>💼</span><span>💬</span><span>🔔</span></div>
              </div>
              <div class="li-header">
                <div class="avatar" style="background:${escapeAttribute(f.avatar_color || '#0A66C2')}; width:52px; height:52px;">${escapeHtml(f.avatar_initials || 'AA')}</div>
                <div class="li-meta">
                  <div class="li-name">${escapeHtml(f.display_name || '')}</div>
                  <div class="li-title">${escapeHtml(f.title || '')}</div>
                  <div class="li-date">${escapeHtml(f.date || '')} · 🌐</div>
                </div>
                <div class="li-hd-dots">···</div>
              </div>
              <div class="li-text">${escapeHtml(trimmed)}${showMore ? `<div class="li-see-more">${tt('…see more', '…voir plus')}</div>` : ''}</div>
              <div class="li-stats"><span>${reactions}</span><span>${formatMetric(f.reactions_count)} ${tt('reactions', 'réactions')} · ${formatMetric(f.comments_count)} ${tt('comments', 'commentaires')} · ${formatMetric(f.reposts_count)} ${tt('reposts', 'republications')}</span></div>
              <div class="li-divider"></div>
              <div class="li-actions"><strong>👍 ${tt('Like', "J'aime")}</strong><strong>💬 ${tt('Comment', 'Commenter')}</strong><strong>🔁 ${tt('Repost', 'Republier')}</strong><strong>📤 ${tt('Send', 'Envoyer')}</strong></div>
            </article>
          `;
        },
        redditHD(f) {
          const awards = parseArrayField(f.awards);
          const topComment = parseObjectField(f.top_comment);
          const postBody = String(f.body || '');
          const hasTextBody = Boolean(postBody.trim());
          const truncated = postBody.replace(/<[^>]+>/g, '').length > 320;
          return `
            <article class="reddit-page hd">
              <div class="reddit-header">
                <div class="reddit-logo"><span class="reddit-logo-mark"></span><span>reddit</span></div>
                <div class="reddit-search">Search Reddit</div>
                <div class="reddit-hd-actions"><span class="reddit-hd-btn">Log In</span><span class="reddit-hd-btn primary">Sign Up</span></div>
              </div>
              <div class="reddit-hd-sub-banner">
                <div class="reddit-hd-sub-icon" style="background:${escapeAttribute(f.subreddit_icon_color || '#FF4500')};">${escapeHtml(subredditInitials(f.subreddit || 'r/cybersecurity'))}</div>
                <div>
                  <div class="reddit-hd-sub-name">${escapeHtml(f.subreddit || 'r/cybersecurity')}</div>
                  <div class="reddit-hd-sub-members">${formatMetric(f.subreddit_members || '2.4M')} members</div>
                </div>
                <div class="reddit-hd-join">Join</div>
              </div>
              <div class="reddit-card">
                <div class="reddit-votes">
                  ${iconRedditArrow('upvote')}
                  <div class="reddit-score">${formatMetric(f.upvotes)}</div>
                  ${iconRedditArrow()}
                </div>
                <div class="reddit-main">
                  <div class="reddit-meta">
                    <span class="reddit-sub-icon" style="background:${escapeAttribute(f.subreddit_icon_color || '#FF4500')};">${escapeHtml(subredditInitials(f.subreddit || 'r/cybersecurity'))}</span>
                    <span class="reddit-sub-name">${escapeHtml(f.subreddit || '')}</span>
                    <span>·</span>
                    <span>${f.is_pinned ? 'Pinned by moderators' : 'Posted by'}</span>
                    <span>${escapeHtml(f.author || '')}</span>
                    ${f.author_flair ? `<span class="reddit-author-flair" style="color:${escapeAttribute(f.flair_color || '#0079D3')};">${escapeHtml(f.author_flair)}</span>` : ''}
                    <span>·</span>
                    <span>${escapeHtml(f.date || '')}</span>
                  </div>
                  ${f.post_flair ? `<div class="reddit-post-flair" style="background:${escapeAttribute(f.post_flair_color || '#ff4500')};">${escapeHtml(f.post_flair)}</div>` : ''}
                  <div class="reddit-title">${escapeHtml(f.title || '')}</div>
                  ${hasTextBody ? `<div class="reddit-body ${truncated ? 'truncated' : ''}">${postBody}</div>${truncated ? `<div class="reddit-readmore">…read more</div>` : ''}` : ''}
                  ${!hasTextBody && f.link_url ? `<div class="reddit-link-preview"><div class="reddit-link-domain">${escapeHtml(f.link_domain || f.link_url)}</div><div>${escapeHtml(f.link_url)}</div></div>` : ''}
                  ${(awards.length || f.upvote_ratio) ? `<div class="reddit-awards">${awards.map(renderAward).join('')}${f.upvote_ratio ? `<span class="reddit-ratio">${escapeHtml(f.upvote_ratio)}</span>` : ''}</div>` : ''}
                  <div class="reddit-actions">
                    <span class="reddit-action">${iconComment()} <span>${formatMetric(f.comments_count)} Comments</span></span>
                    <span class="reddit-action">${iconShare()} <span>Share</span></span>
                    <span class="reddit-action">${iconBookmark()} <span>Save</span></span>
                    <span class="reddit-action">···</span>
                  </div>
                </div>
              </div>
              ${topComment && (topComment.text || topComment.author) ? `
                <div class="reddit-comment" style="border-left-color:${escapeAttribute(f.subreddit_icon_color || '#FF4500')};">
                  <div class="reddit-comment-meta">
                    <span class="reddit-comment-author">${escapeHtml(topComment.author || '')}</span>
                    ${topComment.flair ? `<span class="reddit-comment-flair" style="color:${escapeAttribute(f.flair_color || '#0079D3')};">${escapeHtml(topComment.flair)}</span>` : ''}
                    <span>·</span>
                    <span>${escapeHtml(topComment.date || '')}</span>
                  </div>
                  <div class="reddit-comment-text">${escapeHtml(topComment.text || '')}</div>
                  <div class="reddit-comment-actions"><span>▲ ${formatMetric(topComment.upvotes)}</span><span>Reply</span><span>Share</span><span>···</span></div>
                </div>` : ''}
            </article>
          `;
        },
        bfmHD(f) {
          return `
            <article class="bfm-banner hd">
              <div class="bfm-hd-watermark">BFM TV</div>
              <div class="bfm-live">
                <div class="bfm-logo">BFM<br>TV</div>
                <div class="bfm-category">${escapeHtml(f.category || 'ALERTE INFO')}</div>
              </div>
              <div class="bfm-main">
                <div class="bfm-headline">${escapeHtml(f.headline || '')}</div>
                <div class="bfm-subline">${escapeHtml(f.subline || '')}</div>
              </div>
              <div class="bfm-footer">
                <div class="bfm-time">${escapeHtml(f.time || '')}</div>
                <div class="bfm-ticker-wrap"><div class="bfm-ticker">${escapeHtml(f.ticker || '')}</div></div>
                <div class="bfm-channel">DIRECT</div>
              </div>
              <div class="bfm-hd-overlay"></div>
            </article>
          `;
        },
        authorityHD(f) {
          const colors = { critical: '#b91c1c', high: '#d97706', medium: '#ca8a04' };
          const color = colors[f.severity] || colors.high;
          const sevLabel = { critical: tt('CRITICAL', 'CRITIQUE'), high: tt('HIGH', 'ÉLEVÉE'), medium: tt('MEDIUM', 'MOYENNE') };
          return `
            <article class="authority-email hd">
              <div class="authority-strip" style="background:${color};"></div>
              <div class="authority-body">
                <div class="authority-header">
                  <div class="authority-brand">
                    <div class="rf-logo"></div>
                    <div>
                      <strong>ANSSI · CERT-FR</strong><br>
                      <span class="subtle">${tt('Official cybersecurity alert', 'Alerte officielle cybersécurité')}</span>
                    </div>
                  </div>
                  <div class="mono">${escapeHtml(f.reference || '')}</div>
                </div>
                <div class="authority-hd-severity" style="background:${color};">
                  <span class="authority-hd-severity-label">${sevLabel[f.severity] || 'HIGH'}</span>
                  <span>${tt('Severity Level', 'Niveau de sévérité')}</span>
                </div>
                <div class="authority-content">
                  <div class="authority-banner"><strong>${tt('Severity', 'Sévérité')} : ${escapeHtml(f.severity || '')}</strong> · ${tt('Restricted distribution to recipient', 'Diffusion restreinte au destinataire')}</div>
                  <div class="authority-hd-meta">
                    <div><strong>${tt('From', 'De')} :</strong> ${escapeHtml(f.from_name || '')} &lt;${escapeHtml(f.from_email || '')}&gt;</div>
                    <div><strong>${tt('To', 'À')} :</strong> ${escapeHtml(f.to || '')}</div>
                    <div><strong>${tt('Date', 'Date')} :</strong> ${escapeHtml(f.date || '')}</div>
                    <div><strong>${tt('Reference', 'Référence')} :</strong> ${escapeHtml(f.reference || '')}</div>
                  </div>
                  <h2 style="margin-top:0;">${escapeHtml(f.subject || '')}</h2>
                  <div>${f.body || ''}</div>
                  <div class="authority-hd-footer">${tt('This alert is issued by CERT-FR as part of coordinated response operations.', 'Cette alerte est émise par le CERT-FR dans le cadre des opérations de réponse coordonnée.')}</div>
                </div>
              </div>
            </article>
          `;
        },
        pressReleaseHD(f) {
          return `
            <article class="press-release hd">
              <div class="pr-hd-header">
                <div class="pr-logo" style="color:${escapeAttribute(f.logo_color || '#003366')};">${escapeHtml(f.logo_text || '')}</div>
                <div class="pr-hd-badge">${tt('PRESS RELEASE', 'COMMUNIQUÉ DE PRESSE')}</div>
              </div>
              <div class="pr-meta">${escapeHtml(f.date || '')}</div>
              <div class="pr-title">${escapeHtml(f.title || '')}</div>
              <div class="pr-body">${f.body || ''}</div>
              <div class="pr-hd-divider"></div>
              <div class="pr-contact">
                <strong>${tt('Press contact', 'Contact presse')}</strong><br>
                ${escapeHtml(f.contact_name || '')}<br>
                ${escapeHtml(f.contact_email || '')}<br>
                ${escapeHtml(f.contact_phone || '')}
              </div>
              <div class="pr-hd-legal">${tt('This press release may contain forward-looking statements.', 'Ce communiqué peut contenir des déclarations prospectives.')}</div>
            </article>
          `;
        },
        smsHD(f) {
          return `
            <article class="sms-shell hd ${f.device === 'android' ? 'sms-android' : ''}">
              <div class="sms-hd-statusbar">
                <span>9:41</span>
                <span class="sms-hd-icons">📶 📡 🔋</span>
              </div>
              <div class="sms-hd-nav">
                <span class="sms-hd-back">‹</span>
                <div class="sms-hd-contact">
                  <div class="sms-hd-contact-avatar">${escapeHtml((f.sender || 'A').charAt(0))}</div>
                  <span>${escapeHtml(f.sender || '')}</span>
                </div>
                <span class="sms-hd-info">ⓘ</span>
              </div>
              <div class="sms-screen">
                <div class="sms-hd-date">${tt('Today', 'Aujourd\'hui')}</div>
                <div style="display:flex; justify-content:flex-start;">
                  <div>
                    <div class="sms-bubble">${escapeHtml(f.text || '')}</div>
                    <div class="sms-time">${escapeHtml(f.time || '')}</div>
                  </div>
                </div>
              </div>
              <div class="sms-hd-input">
                <div class="sms-hd-input-field">${tt('iMessage', 'iMessage')}</div>
                <span class="sms-hd-send">↑</span>
              </div>
            </article>
          `;
        },
        emailInternalHD(f) {
          return `
            <div class="outlook-email hd">
              <div class="outlook-hd-ribbon">
                <div class="outlook-hd-ribbon-tabs"><span class="active">Home</span><span>Send / Receive</span><span>Folder</span><span>View</span></div>
                <div class="outlook-hd-ribbon-actions">
                  <div class="outlook-hd-ribbon-group">
                    <div class="outlook-hd-ribbon-btn primary">${iconReply()} ${tt('Reply', 'Répondre')}</div>
                    <div class="outlook-hd-ribbon-btn">${iconReplyAll()} ${tt('Reply All', 'Rép. tous')}</div>
                    <div class="outlook-hd-ribbon-btn">${iconForward()} ${tt('Forward', 'Transférer')}</div>
                  </div>
                  <div class="outlook-hd-ribbon-sep"></div>
                  <div class="outlook-hd-ribbon-group">
                    <div class="outlook-hd-ribbon-btn">🗑️ ${tt('Delete', 'Supprimer')}</div>
                    <div class="outlook-hd-ribbon-btn">📁 ${tt('Move', 'Déplacer')}</div>
                  </div>
                </div>
              </div>
              <div class="outlook-hd-layout">
                <div class="outlook-hd-sidebar">
                  <div class="outlook-hd-folder active">📥 ${tt('Inbox', 'Boîte de réception')} <span class="outlook-hd-badge">3</span></div>
                  <div class="outlook-hd-folder">📤 ${tt('Sent Items', 'Éléments envoyés')}</div>
                  <div class="outlook-hd-folder">📝 ${tt('Drafts', 'Brouillons')}</div>
                  <div class="outlook-hd-folder">🗑️ ${tt('Deleted Items', 'Éléments supprimés')}</div>
                  <div class="outlook-hd-folder">⚠️ ${tt('Junk Email', 'Courrier indésirable')}</div>
                </div>
                <div class="outlook-hd-content">
                  <div class="outlook-hd-header">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
                      ${f.importance === 'high' ? '<span class="importance-dot">!</span>' : ''}
                      <div class="outlook-subject">${escapeHtml(f.subject || '')}</div>
                    </div>
                    <div class="outlook-hd-sender-row">
                      <div class="outlook-hd-avatar" style="background:${escapeAttribute(f.avatar_color || '#0078d4')};">${escapeHtml((f.from_name || 'U').charAt(0).toUpperCase())}</div>
                      <div class="outlook-hd-sender-info">
                        <div><strong>${escapeHtml(f.from_name || '')}</strong> <span class="subtle">&lt;${escapeHtml(f.from_email || '')}&gt;</span></div>
                        <div class="outlook-hd-recipients">${tt('To', 'À')}: ${escapeHtml(f.to || '')}${f.cc ? ` · Cc: ${escapeHtml(f.cc)}` : ''}</div>
                      </div>
                      <div class="outlook-hd-date">${escapeHtml(f.date || '')}</div>
                    </div>
                  </div>
                  <div class="outlook-content">
                    ${f.body || ''}
                    ${f.has_attachment ? `<div class="outlook-attachment outlook-hd-attachment">📎 <span>${escapeHtml(f.attachment_name || 'piece_jointe.pdf')}</span><span class="outlook-hd-filesize">128 KB</span></div>` : ''}
                  </div>
                </div>
              </div>
            </div>
          `;
        }
      };


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
                <div class="press-photo"></div>
                <div class="press-caption">${escapeHtml(f.image_caption || '')}</div>
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
                <div class="press-photo nyt-photo"></div>
                <div class="nyt-caption">${escapeHtml(f.image_caption || '')}</div>
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
                <div class="press-photo faz-photo"></div>
                <div class="faz-caption">${escapeHtml(f.image_caption || '')}</div>
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
                <div class="press-photo ft-photo"></div>
                ${f.image_caption ? `<div class="ft-caption">${escapeHtml(f.image_caption)}</div>` : ''}
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
                <div class="press-photo nikkei-photo"></div>
                ${f.image_caption ? `<div class="nikkei-caption">${escapeHtml(f.image_caption)}</div>` : ''}
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
          return `
            <article class="press-article nyt-article hd">
              <div class="nyt-hd-browser">
                <div class="hd-browser-dots"><span></span><span></span><span></span></div>
                <div class="hd-browser-url">nytimes.com/technology/${encodeURIComponent((f.headline || '').toLowerCase().replace(/\s+/g, '-').slice(0, 40))}</div>
              </div>
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
                <div class="press-photo nyt-photo"></div>
                <div class="nyt-caption">${escapeHtml(f.image_caption || '')}</div>
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
          return `
            <article class="press-article faz-article hd">
              <div class="hd-browser-bar faz-browser">
                <div class="hd-browser-dots"><span></span><span></span><span></span></div>
                <div class="hd-browser-url">faz.net/aktuell/wirtschaft/</div>
              </div>
              <div class="faz-header">
                <div class="faz-header-top">
                  <div class="faz-brand"><div class="faz-logo">F.A.Z.</div><div class="faz-title">Frankfurter Allgemeine</div></div>
                  <div class="faz-hd-actions"><span>Anmelden</span><span>Abo</span></div>
                </div>
              </div>
              <div class="faz-nav"><span>Politik</span><span class="active">Wirtschaft</span><span>Finanzen</span><span>Feuilleton</span><span>Sport</span><span>Technik</span><span>Wissen</span></div>
              <div class="faz-hd-breadcrumb">F.A.Z. › Wirtschaft › ${escapeHtml(f.category || 'Unternehmen')}</div>
              <div class="faz-body">
                <div class="faz-kicker-row">
                  ${f.kicker ? `<div class="faz-kicker">${escapeHtml(f.kicker)}</div>` : ''}
                  ${typeLabel}
                  ${f.is_faz_plus ? '<span class="faz-fplus">F+</span>' : ''}
                </div>
                <h1 class="faz-headline">${escapeHtml(f.headline || '')}</h1>
                <div class="faz-subheadline">${escapeHtml(f.subheadline || '')}</div>
                <div class="press-photo faz-photo"></div>
                <div class="faz-caption">${escapeHtml(f.image_caption || '')}</div>
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
          return `
            <article class="press-article ft-article hd">
              <div class="hd-browser-bar ft-browser">
                <div class="hd-browser-dots"><span></span><span></span><span></span></div>
                <div class="hd-browser-url">ft.com/content/${encodeURIComponent((f.headline || '').toLowerCase().replace(/\s+/g, '-').slice(0, 30))}</div>
              </div>
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
                <div class="press-photo ft-photo"></div>
                ${f.image_caption ? `<div class="ft-caption">${escapeHtml(f.image_caption)}</div>` : ''}
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
              <div class="hd-browser-bar nikkei-browser">
                <div class="hd-browser-dots"><span></span><span></span><span></span></div>
                <div class="hd-browser-url">nikkei.com/article/</div>
              </div>
              <div class="nikkei-header">
                <div class="nikkei-header-inner">
                  <div class="nikkei-hd-top">
                    <div class="nikkei-logo">日本経済新聞</div>
                    <div class="nikkei-hd-actions"><span>ログイン</span><span class="nikkei-hd-subscribe">申し込む</span></div>
                  </div>
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
                <div class="nikkei-hd-share">${iconShare()} ${iconBookmark()} ${iconComment()}</div>
                <div class="press-photo nikkei-photo"></div>
                ${f.image_caption ? `<div class="nikkei-caption">${escapeHtml(f.image_caption)}</div>` : ''}
                <div class="nikkei-content">${f.body || ''}</div>
                ${tags.length ? `<div class="nikkei-tags">${tags.map(t => `<span class="nikkei-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
              </div>
            </article>
          `;
        },
        articleLeMondeHD(f) {
          return `
            <article class="press-article lm-article hd">
              <div class="hd-browser-bar lm-browser">
                <div class="hd-browser-dots"><span></span><span></span><span></span></div>
                <div class="hd-browser-url">lemonde.fr/pixels/article/${encodeURIComponent((f.headline || '').toLowerCase().replace(/\s+/g, '-').slice(0, 40))}</div>
              </div>
              <div class="lm-header">
                <div class="lm-hd-top">
                  <div class="lm-hd-date">${escapeHtml(f.date || '')}</div>
                  <div class="lm-logo">Le Monde</div>
                  <div class="lm-hd-subscribe">${tt('Subscribe', 'S\'abonner')}</div>
                </div>
                <div class="lm-nav"><span>${tt('Politics', 'Politique')}</span><span>${tt('World', 'International')}</span><span>${tt('Business', 'Économie')}</span><span>Pixels</span><span>${tt('Culture', 'Culture')}</span><span>${tt('Opinions', 'Opinions')}</span></div>
              </div>
              ${f.is_premium ? `<div class="lm-premium">${tt('Subscribers only — full article', 'Réservé aux abonnés — lecture intégrale')}</div>` : ''}
              <div class="press-body">
                <div class="press-category">${escapeHtml(f.category || '')}</div>
                <h1 class="press-headline">${escapeHtml(f.headline || '')}</h1>
                <div class="press-subheadline">${escapeHtml(f.subheadline || '')}</div>
                <div class="press-byline"><span>${escapeHtml(f.author || '')}</span><span>${escapeHtml(f.date || '')} · ${escapeHtml(f.read_time || '')}</span></div>
                <div class="lm-hd-share-bar">${iconShare()} ${iconBookmark()} ${iconComment()}</div>
                <div class="press-photo"></div>
                <div class="press-caption">${escapeHtml(f.image_caption || '')}</div>
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
              <div class="li-actions"><strong>👍 ${tt('Like', 'J'aime')}</strong><strong>💬 ${tt('Comment', 'Commenter')}</strong><strong>🔁 ${tt('Repost', 'Republier')}</strong><strong>📤 ${tt('Send', 'Envoyer')}</strong></div>
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


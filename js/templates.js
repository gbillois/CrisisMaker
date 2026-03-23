      const TemplateEngine = {
        render(stimulus, actor, scenario) {
          const f = stimulus.fields || {};
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
            default: return `<div class="card">${tt('Template not implemented for', 'Template non implémenté pour')} ${escapeHtml(stimulus.channel)}.</div>`;
          }
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
        }
      };


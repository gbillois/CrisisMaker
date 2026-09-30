/* Exercise documents as content: a crisis exercise deck (.pptx), a proposal or an exercise brief
   (.docx, .txt, .md). The file is read into slides (or sections for a text document), each with
   its title, paragraphs, tables, charts, SmartArt and speaker notes, in reading order; the
   analysis then finds what an exercise designer looks for in it: context, objectives, players,
   phases, incident timeline and the chronogram of injects.
   The PPTX parsing follows DeckSeeder's import engine (slide order from the presentation,
   relationships, groups mapped to slide coordinates, placeholders inherited from the layout,
   merged table cells, chart data) without its rendering: it keeps what the slides say.
   A small XML reader is used instead of DOMParser so the same code runs in the page and in
   the Node tests. */
const CrisisDocReader = (() => {
  // ── XML ─────────────────────────────────────────────────────────────────────
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function decode(text) {
    return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
      if (code[0] === '#') {
        const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    });
  }
  /* Elements are { name, local, attrs, children, text }: text holds the element's own
     character data (OOXML keeps text in leaf elements such as <a:t>). */
  function parseXml(xml) {
    const root = { name: '#document', local: '#document', attrs: {}, children: [], text: '' };
    const stack = [root];
    const token = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
    const attrToken = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = token.exec(String(xml || '')))) {
      const top = stack[stack.length - 1];
      if (match[1] !== undefined) top.text += match[1];
      else if (match[2]) {
        // A closing tag closes the nearest open element of that name (tolerant of stray tags).
        for (let i = stack.length - 1; i > 0; i--) if (stack[i].name === match[2]) { stack.length = i; break; }
      } else if (match[3]) {
        const attrs = {};
        let attr;
        attrToken.lastIndex = 0;
        while ((attr = attrToken.exec(match[4] || ''))) attrs[attr[1]] = decode(attr[2] ?? attr[3] ?? '');
        const el = { name: match[3], local: match[3].replace(/^.*:/, ''), attrs, children: [], text: '', parent: top };
        top.children.push(el);
        if (!match[5]) stack.push(el);
      } else if (match[6] !== undefined && stack.length > 1) top.text += decode(match[6]);
    }
    return root;
  }
  const kids = (el, local) => (el?.children || []).filter((child) => !local || child.local === local);
  function desc(el, local, out = []) {
    for (const child of el?.children || []) { if (child.local === local) out.push(child); desc(child, local, out); }
    return out;
  }
  function first(el, local) {
    for (const child of el?.children || []) {
      if (child.local === local) return child;
      const found = first(child, local);
      if (found) return found;
    }
    return null;
  }
  function attr(el, name) {
    if (!el) return '';
    if (el.attrs[name] !== undefined) return el.attrs[name];
    const key = Object.keys(el.attrs).find((k) => k.replace(/^.*:/, '') === name);
    return key ? el.attrs[key] : '';
  }
  const textOf = (el) => desc(el, 't').map((t) => t.text).join('');
  const clean = (text) => String(text || '').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();

  // ── Package parts ───────────────────────────────────────────────────────────
  function resolvePath(baseDir, target) {
    target = String(target || '');
    if (/^[a-z]+:/i.test(target)) return '';
    const parts = target.startsWith('/') ? [] : baseDir.split('/').filter(Boolean);
    target.replace(/^\/+/, '').split('/').forEach((p) => { if (!p || p === '.') return; if (p === '..') parts.pop(); else parts.push(p); });
    return parts.join('/');
  }
  function openPackage(zip) {
    const cache = new Map();
    const xml = async (path) => {
      if (!path) return null;
      if (!cache.has(path)) {
        const file = zip.file(path);
        cache.set(path, file ? file.async('string').then(parseXml).catch(() => null) : Promise.resolve(null));
      }
      return cache.get(path);
    };
    /* Relationships of a part: { rId: { target, type } } where type is the last segment. */
    const rels = async (partPath) => {
      const dir = partPath.replace(/\/?[^/]+$/, '');
      const doc = await xml(`${dir ? `${dir}/` : ''}_rels/${partPath.split('/').pop()}.rels`);
      const out = {};
      desc(doc, 'Relationship').forEach((rel) => {
        if (attr(rel, 'TargetMode') === 'External') return;
        out[attr(rel, 'Id')] = { target: resolvePath(dir, attr(rel, 'Target')), type: attr(rel, 'Type').split('/').pop() };
      });
      return out;
    };
    const byType = (relMap, type) => Object.values(relMap).find((rel) => rel.type === type)?.target || '';
    return { xml, rels, byType };
  }
  async function coreProperties(pkg) {
    const core = await pkg.xml('docProps/core.xml');
    const app = await pkg.xml('docProps/app.xml');
    const value = (doc, local) => clean(first(doc, local)?.text || '');
    return Object.fromEntries(Object.entries({
      title: value(core, 'title'), subject: value(core, 'subject'), author: value(core, 'creator'),
      description: value(core, 'description'), keywords: value(core, 'keywords'),
      modified: value(core, 'modified'), company: value(app, 'Company')
    }).filter(([, v]) => v));
  }

  // ── Text ────────────────────────────────────────────────────────────────────
  /* The paragraphs of a text body: text with line breaks, fields (except the slide number)
     and the outline level of bullets. */
  function paragraphs(txBody) {
    return kids(txBody, 'p').map((p) => {
      let text = '';
      const walk = (el) => {
        for (const child of el.children) {
          if (child.local === 'r') text += textOf(child);
          else if (child.local === 'br') text += '\n';
          else if (child.local === 'fld') { if (attr(child, 'type') !== 'slidenum') text += textOf(child); }
          else if (child.local === 'AlternateContent' || child.local === 'Choice') walk(child);
        }
      };
      walk(p);
      return { text: clean(text), level: parseInt(attr(first(p, 'pPr'), 'lvl'), 10) || 0 };
    }).filter((para) => para.text);
  }
  /* A table as a grid of cell texts. A cell merged down repeats the value above it (the phase
     of a chronogram spans its rows); a cell merged to the left stays empty. */
  function tableRows(tbl) {
    const rows = [];
    kids(tbl, 'tr').forEach((tr, r) => {
      const row = kids(tr, 'tc').map((tc, c) => {
        if (attr(tc, 'vMerge') === '1' || attr(tc, 'vMerge') === 'true') return rows[r - 1]?.[c] ?? '';
        if (attr(tc, 'hMerge') === '1' || attr(tc, 'hMerge') === 'true') return '';
        return paragraphs(first(tc, 'txBody')).map((p) => p.text).join('\n');
      });
      rows.push(row);
    });
    return rows.filter((row) => row.some((cell) => String(cell).trim()));
  }
  function pointValues(container) {
    if (!container) return [];
    const cache = first(container, 'strCache') || first(container, 'numCache') || first(container, 'strLit') || first(container, 'numLit') || container;
    return desc(cache, 'pt').map((pt) => ({ idx: parseInt(attr(pt, 'idx'), 10) || 0, val: clean(first(pt, 'v')?.text || '') }))
      .sort((a, b) => a.idx - b.idx).map((pt) => pt.val);
  }
  async function chartData(pkg, path) {
    const doc = await pkg.xml(path);
    if (!doc) return null;
    const titleEl = first(doc, 'title');
    const title = clean(titleEl ? (textOf(titleEl) || first(titleEl, 'v')?.text || '') : '');
    const series = desc(doc, 'ser').map((ser, i) => ({
      name: clean(pointValues(first(ser, 'tx'))[0] || textOf(first(ser, 'tx')) || `Series ${i + 1}`),
      categories: pointValues(first(ser, 'cat') || first(ser, 'xVal')),
      values: pointValues(first(ser, 'val') || first(ser, 'yVal'))
    })).filter((s) => s.values.length || s.categories.length);
    return { title, series };
  }
  /* SmartArt: the text of each node of the diagram data, in the order of the model. */
  async function diagramItems(pkg, path) {
    const doc = await pkg.xml(path);
    return desc(doc, 'pt').filter((pt) => !['parTrans', 'sibTrans', 'pres', 'doc'].includes(attr(pt, 'type')))
      .map((pt) => paragraphs(kids(pt, 't')[0]).map((p) => p.text).join(' ')).filter(Boolean);
  }

  // ── Shapes and reading order ────────────────────────────────────────────────
  function rawBox(el) {
    const holder = el.local === 'graphicFrame' ? kids(el, 'xfrm')[0] || first(el, 'xfrm') : first(kids(el, 'spPr')[0], 'xfrm');
    const off = first(holder, 'off'), ext = first(holder, 'ext');
    return { x: +attr(off, 'x') || 0, y: +attr(off, 'y') || 0, cx: +attr(ext, 'cx') || 0, cy: +attr(ext, 'cy') || 0, set: !!off };
  }
  function mapBox(box, ctx) {
    if (!ctx) return box;
    return { x: ctx.x + (box.x - ctx.chX) * ctx.sx, y: ctx.y + (box.y - ctx.chY) * ctx.sy, cx: box.cx * ctx.sx, cy: box.cy * ctx.sy, set: box.set };
  }
  function groupContext(grp, parent) {
    const xfrm = first(kids(grp, 'grpSpPr')[0], 'xfrm');
    if (!xfrm) return parent || null;
    const box = mapBox({ x: +attr(first(xfrm, 'off'), 'x') || 0, y: +attr(first(xfrm, 'off'), 'y') || 0, cx: +attr(first(xfrm, 'ext'), 'cx') || 0, cy: +attr(first(xfrm, 'ext'), 'cy') || 0 }, parent);
    const chExt = first(xfrm, 'chExt'), chOff = first(xfrm, 'chOff');
    return { x: box.x, y: box.y, sx: (box.cx || 1) / (+attr(chExt, 'cx') || box.cx || 1), sy: (box.cy || 1) / (+attr(chExt, 'cy') || box.cy || 1), chX: +attr(chOff, 'x') || 0, chY: +attr(chOff, 'y') || 0 };
  }
  const isHidden = (el) => attr(first(el, 'cNvPr'), 'hidden') === '1';
  /* The shapes of a slide, groups flattened into slide coordinates. Alternate content keeps
     its first choice (the modern shape) and falls back when that holds nothing. */
  function collectShapes(doc) {
    const out = [];
    const walk = (parent, ctx) => {
      for (const node of parent.children) {
        if (node.local === 'grpSp') { if (!isHidden(node)) walk(node, groupContext(node, ctx)); }
        else if (node.local === 'AlternateContent') {
          const choice = kids(node, 'Choice')[0], fallback = kids(node, 'Fallback')[0];
          const before = out.length;
          if (choice) walk(choice, ctx);
          if (out.length === before && fallback) walk(fallback, ctx);
        } else if (['sp', 'graphicFrame', 'pic'].includes(node.local) && !isHidden(node)) {
          out.push({ el: node, box: mapBox(rawBox(node), ctx) });
        }
      }
    };
    const tree = first(doc, 'spTree');
    if (tree) walk(tree, null);
    return out;
  }
  function placeholder(el) {
    const ph = first(first(el, 'nvPr') || el, 'ph');
    return ph ? { type: attr(ph, 'type') || 'body', idx: attr(ph, 'idx') } : null;
  }
  /* Positions of the layout and master placeholders: a slide placeholder without its own
     position sits where its layout puts it. */
  function placeholderBoxes(...docs) {
    const map = {};
    docs.forEach((doc) => collectShapes(doc).forEach(({ el, box }) => {
      const ph = placeholder(el);
      if (!ph || !box.set) return;
      [`idx:${ph.idx}`, `type:${ph.type}`].forEach((key) => { if (key !== 'idx:' && !map[key]) map[key] = box; });
    }));
    return map;
  }
  const FURNITURE = ['sldNum', 'dt', 'ftr', 'hdr', 'sldImg'];
  /* Reading order: titles first, then top to bottom in bands, left to right in a band. */
  function readingOrder(items, height) {
    const band = Math.max(1, height * 0.04);
    const rest = items.filter((item) => item.role !== 'title').sort((a, b) => a.box.y - b.box.y);
    const rows = [];
    rest.forEach((item) => {
      const row = rows[rows.length - 1];
      if (row && item.box.y - row[0].box.y <= band) row.push(item); else rows.push([item]);
    });
    return [...items.filter((item) => item.role === 'title'), ...rows.flatMap((row) => row.sort((a, b) => a.box.x - b.box.x))];
  }

  // ── PowerPoint ──────────────────────────────────────────────────────────────
  async function slideOrder(pkg, zip) {
    const pres = await pkg.xml('ppt/presentation.xml');
    const presRels = await pkg.rels('ppt/presentation.xml');
    const ordered = desc(first(pres, 'sldIdLst'), 'sldId').map((id) => presRels[attr(id, 'id')]?.target).filter((path) => path && zip.file(path));
    if (ordered.length) return ordered;
    const number = (path) => parseInt(path.match(/slide(\d+)\.xml$/i)[1], 10);
    return Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path)).sort((a, b) => number(a) - number(b));
  }
  async function readSlide(pkg, path, number, size) {
    const doc = await pkg.xml(path);
    const rels = await pkg.rels(path);
    const layoutPath = pkg.byType(rels, 'slideLayout');
    const layoutDoc = await pkg.xml(layoutPath);
    const masterPath = layoutPath ? pkg.byType(await pkg.rels(layoutPath), 'slideMaster') : '';
    const inherited = placeholderBoxes(layoutDoc, await pkg.xml(masterPath));
    const items = [];
    for (const { el, box: ownBox } of collectShapes(doc)) {
      const ph = placeholder(el);
      if (ph && FURNITURE.includes(ph.type)) continue;
      const box = ownBox.set ? ownBox : (ph && (inherited[`idx:${ph.idx}`] || inherited[`type:${ph.type}`])) || ownBox;
      const name = attr(first(el, 'cNvPr'), 'name');
      if (el.local === 'sp') {
        const paras = paragraphs(kids(el, 'txBody')[0]);
        if (!paras.length) continue;
        const role = ph && ['title', 'ctrTitle'].includes(ph.type) ? 'title' : ph?.type === 'subTitle' ? 'subtitle' : ph ? 'body' : 'text';
        items.push({ kind: 'text', role, paragraphs: paras, box, name });
      } else if (el.local === 'graphicFrame') {
        const tbl = first(el, 'tbl');
        const chart = first(el, 'chart');
        const diagram = first(el, 'relIds');
        if (tbl) {
          const rows = tableRows(tbl);
          if (rows.length) items.push({ kind: 'table', rows, box, name });
        } else if (chart && rels[attr(chart, 'id')]) {
          const data = await chartData(pkg, rels[attr(chart, 'id')].target);
          if (data && (data.title || data.series.length)) items.push({ kind: 'chart', ...data, box, name });
        } else if (diagram && rels[attr(diagram, 'dm')]) {
          const list = await diagramItems(pkg, rels[attr(diagram, 'dm')].target);
          if (list.length) items.push({ kind: 'diagram', items: list, box, name });
        }
      } else if (el.local === 'pic') {
        const description = clean(attr(first(el, 'cNvPr'), 'descr') || attr(first(el, 'cNvPr'), 'title'));
        if (description) items.push({ kind: 'image', description, box, name });
      }
    }
    const blocks = readingOrder(items, size.cy);
    const titleBlock = blocks.find((block) => block.role === 'title');
    let notes = '';
    const notesPath = pkg.byType(rels, 'notesSlide');
    if (notesPath) {
      const notesDoc = await pkg.xml(notesPath);
      notes = collectShapes(notesDoc).filter(({ el }) => el.local === 'sp' && (placeholder(el)?.type === 'body' || !placeholder(el)))
        .map(({ el }) => paragraphs(kids(el, 'txBody')[0]).map((p) => p.text).join('\n')).filter(Boolean).join('\n');
    }
    return {
      number,
      title: titleBlock ? titleBlock.paragraphs.map((p) => p.text).join(' ').replace(/\s+/g, ' ') : '',
      hidden: attr(first(doc, 'sld'), 'show') === '0',
      blocks: blocks.filter((block) => block !== titleBlock).map(({ box, ...block }) => block),
      notes: clean(notes)
    };
  }
  async function readPptx(zip, name) {
    const pkg = openPackage(zip);
    const pres = await pkg.xml('ppt/presentation.xml');
    const sz = first(pres, 'sldSz');
    const size = { cx: +attr(sz, 'cx') || 12192000, cy: +attr(sz, 'cy') || 6858000 };
    const paths = await slideOrder(pkg, zip);
    if (!paths.length) throw new Error('No slide found in this PowerPoint file.');
    const slides = [];
    for (let i = 0; i < paths.length; i++) slides.push(await readSlide(pkg, paths[i], i + 1, size));
    return { kind: 'pptx', name, unit: 'slide', meta: await coreProperties(pkg), slides };
  }

  // ── Word and plain text: sections split at headings ────────────────────────
  function newSection(number, title) { return { number, title, hidden: false, blocks: [], notes: '' }; }
  async function readDocx(zip, name) {
    const pkg = openPackage(zip);
    const doc = await pkg.xml('word/document.xml');
    if (!doc) throw new Error('No document body found in this Word file.');
    const styles = await pkg.xml('word/styles.xml');
    // Heading levels by style id: built-in outline levels and "Heading n" / "Titre n" names.
    const headingLevel = {};
    desc(styles, 'style').forEach((style) => {
      const id = attr(style, 'styleId');
      const styleName = attr(first(style, 'name'), 'val');
      const outline = first(style, 'outlineLvl');
      const named = /^(heading|titre|überschrift|title|titel)\s*(\d)?$/i.exec(styleName || '');
      if (outline) headingLevel[id] = (parseInt(attr(outline, 'val'), 10) || 0) + 1;
      else if (named) headingLevel[id] = named[2] ? +named[2] : 0;
    });
    const paraText = (p) => {
      let text = '';
      const walk = (el) => el.children.forEach((child) => {
        if (child.local === 't') text += child.text;
        else if (child.local === 'tab') text += ' ';
        else if (child.local === 'br' || child.local === 'cr') text += '\n';
        else if (!['instrText', 'delText', 'rPr', 'pPr'].includes(child.local)) walk(child);
      });
      walk(p);
      return clean(text);
    };
    const sections = [newSection(1, '')];
    const current = () => sections[sections.length - 1];
    const body = first(doc, 'body');
    for (const node of body?.children || []) {
      if (node.local === 'p') {
        const text = paraText(node);
        if (!text) continue;
        const pPr = kids(node, 'pPr')[0];
        const styleId = attr(first(pPr, 'pStyle'), 'val');
        const outline = first(pPr, 'outlineLvl');
        const level = outline ? (parseInt(attr(outline, 'val'), 10) || 0) + 1 : headingLevel[styleId];
        if (level !== undefined && level <= 3 && text.length <= 200) {
          if (current().title || current().blocks.length) sections.push(newSection(sections.length + 1, text));
          else current().title = text;
          continue;
        }
        const list = first(pPr, 'numPr');
        const para = { text, level: list ? parseInt(attr(first(list, 'ilvl'), 'val'), 10) || 0 : 0 };
        const last = current().blocks[current().blocks.length - 1];
        if (last?.kind === 'text') last.paragraphs.push(para); else current().blocks.push({ kind: 'text', role: 'body', paragraphs: [para] });
      } else if (node.local === 'tbl') {
        const rows = [];
        kids(node, 'tr').forEach((tr, r) => {
          const row = [];
          kids(tr, 'tc').forEach((tc) => {
            const tcPr = kids(tc, 'tcPr')[0];
            const span = parseInt(attr(first(tcPr, 'gridSpan'), 'val'), 10) || 1;
            const merge = first(tcPr, 'vMerge');
            const text = merge && attr(merge, 'val') !== 'restart' ? (rows[r - 1]?.[row.length] ?? '') : kids(tc, 'p').map(paraText).filter(Boolean).join('\n');
            row.push(text);
            for (let i = 1; i < span; i++) row.push('');
          });
          rows.push(row);
        });
        const filled = rows.filter((row) => row.some((cell) => cell.trim()));
        if (filled.length) current().blocks.push({ kind: 'table', rows: filled });
      }
    }
    const kept = sections.filter((section) => section.title || section.blocks.length);
    kept.forEach((section, i) => { section.number = i + 1; });
    if (!kept.length) throw new Error('No text found in this Word file.');
    return { kind: 'docx', name, unit: 'section', meta: await coreProperties(pkg), slides: kept };
  }
  function readText(text, name) {
    const sections = [newSection(1, '')];
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    let table = null;
    for (const raw of lines) {
      const line = raw.trim();
      const current = sections[sections.length - 1];
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) {
        table = null;
        if (current.title || current.blocks.length) sections.push(newSection(sections.length + 1, heading[2].trim())); else current.title = heading[2].trim();
        continue;
      }
      if (/^\|.*\|$/.test(line)) {
        if (/^\|[\s:|-]+\|$/.test(line)) continue;
        const cells = line.slice(1, -1).split('|').map((cell) => cell.trim());
        if (!table) { table = { kind: 'table', rows: [] }; current.blocks.push(table); }
        table.rows.push(cells);
        continue;
      }
      table = null;
      if (!line) continue;
      const bullet = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/.exec(raw);
      const para = { text: clean(bullet ? bullet[3] : line), level: bullet ? Math.min(4, Math.floor(bullet[1].replace(/\t/g, '  ').length / 2)) : 0 };
      const last = current.blocks[current.blocks.length - 1];
      if (last?.kind === 'text') last.paragraphs.push(para); else current.blocks.push({ kind: 'text', role: 'body', paragraphs: [para] });
    }
    const kept = sections.filter((section) => section.title || section.blocks.length);
    kept.forEach((section, i) => { section.number = i + 1; });
    if (!kept.length) throw new Error('This file is empty.');
    return { kind: 'text', name, unit: 'section', meta: {}, slides: kept };
  }

  /* Reads a File, Blob, ArrayBuffer or Uint8Array by its name. */
  async function read(input, name = input?.name || 'file', zipLib = typeof JSZip !== 'undefined' ? JSZip : null) {
    const lower = String(name).toLowerCase();
    const data = typeof input?.arrayBuffer === 'function' ? await input.arrayBuffer() : input;
    if (/\.(txt|md|markdown)$/.test(lower)) return readText(typeof data === 'string' ? data : new TextDecoder().decode(data), name);
    if (!zipLib) throw new Error('The ZIP library is not loaded. Reload the page and try again.');
    let zip;
    try { zip = await zipLib.loadAsync(data); } catch (_) { throw new Error('This file cannot be opened: it is not a valid Office file (it may be protected or an older .ppt/.doc).'); }
    if (/\.docx$/.test(lower)) return readDocx(zip, name);
    return readPptx(zip, name);
  }

  // ── Analysis ────────────────────────────────────────────────────────────────
  /* What a slide or section is about, from its title first, then its first words. The order
     matters: the first rule that matches wins. [key, pattern]. */
  const SECTION_RULES = [
    ['debrief', /retex|\brex\b|d[ée]brief|hot ?wash|lessons learn|[ée]valuation|evaluation|auswertung|nachbesprechung/i],
    ['facilitation', /animat|facilitat|r[ée]serv[ée] aux|contr[oô]leurs?\b|umpire|white cell|cellule d.animation|spielleitung|moderat/i],
    ['incident', /chronologie de l.(attaque|incident)|attack|attaque|kill ?chain|mode op[ée]ratoire|threat actor|menace|angriff|vorfall|incident timeline|sc[ée]nario technique/i],
    ['objectives', /objecti|\bgoals?\b|\baims?\b|enjeux|\bziele?\b|lernziel|attendus|learning/i],
    ['players', /particip|joueurs?|players?|cellules?|\bcells?\b|gouvernance|organisation de crise|crisis organi[sz]ation|r[oô]les?\b|teilnehm|spieler|zellen?\b|besetzung|rollen|trombinoscope|dispositif|audience|publics? cibles?/i],
    ['phases', /\bphases?\b|trame|storyline|fil rouge|narrati|d[ée]roul[ée] du sc[ée]nario|synopsis|sc[ée]nario|handlung|s[ée]quen/i],
    ['chronogram', /chrono|inject|stimul|\bmsel\b|main courante|einspiel|timeline/i],
    ['context', /contexte|context|pr[ée]sentation (de|du)|entreprise|company|background|situation initiale|hypoth[eè]s|setting|kontext|ausgangslage|unternehmen|p[ée]rim[eè]tre|scope/i],
    ['rules', /r[eè]gles?\b|rules|consignes|logisti|agenda|ordre du jour|d[ée]roul[ée] de la journ|planning|programme|schedule|hors.jeu|spielregeln|ablaufplan|convocation/i],
    ['proposal', /proposition|proposal|offre|budget|tarif|pricing|m[ée]thodologie|methodology|approche|approach|livrables?|deliverables?|calendrier|angebot/i]
  ];
  const SECTION_LABELS = {
    context: ['Context', 'Contexte', 'Kontext'],
    objectives: ['Objectives', 'Objectifs', 'Ziele'],
    players: ['Players and cells', 'Joueurs et cellules', 'Spieler und Zellen'],
    phases: ['Phases and storyline', 'Phases et trame', 'Phasen und Handlung'],
    incident: ['Incident timeline', 'Chronologie de l’incident', 'Ablauf des Vorfalls'],
    chronogram: ['Chronogram and injects', 'Chronogramme et injects', 'Chronogramm und Injects'],
    facilitation: ['Facilitation', 'Animation', 'Spielleitung'],
    rules: ['Rules and logistics', 'Règles et logistique', 'Regeln und Logistik'],
    debrief: ['Debrief', 'RETEX', 'Nachbesprechung'],
    proposal: ['Proposal', 'Proposition', 'Angebot'],
    other: ['Other', 'Autres', 'Sonstiges']
  };
  const TIME = /(?:^|[^\w+])((?:[HTJDZ]|jour ?j|d-?day)\s*[+-]\s*\d{1,3}(?:\s*[:h]\s*\d{2})?(?:\s*min)?|\d{1,2}\s*[:h]\s*\d{2})(?![\w])/i;
  const LABELS = {
    timestamp: /^(horaire|heure|horodatage|time|timestamp|quand|when|uhrzeit|zeit|date)$/i,
    sender: /^(émetteur|emetteur|expéditeur|expediteur|de|from|sender|source|absender|von|auteur|author)$/i,
    recipient: /^(destinataires?|à|a|to|recipients?|cible|target|cellule|cell|empfänger|an|pour)$/i,
    channel: /^(canal|channel|moyen|vecteur|support|medium|kanal|type)$/i,
    phase: /^(phase|étape|etape|step|stage|schritt)$/i
  };
  const blockText = (block) => block.kind === 'text' ? block.paragraphs.map((p) => p.text).join('\n')
    : block.kind === 'table' ? block.rows.map((row) => row.join(' | ')).join('\n')
      : block.kind === 'chart' ? [block.title, ...block.series.map((s) => s.name)].join('\n')
        : block.kind === 'diagram' ? block.items.join('\n') : block.description || '';
  const slideText = (slide) => slide.blocks.map(blockText).join('\n');

  /* Header row of a table seen as a chronogram: the row (among the first three) whose cells
     name the most chronogram columns; null when fewer than two roles, or no time nor content. */
  function chronogramHeader(rows, patterns) {
    let best = null;
    rows.slice(0, 3).forEach((row, index) => {
      const roles = new Set();
      row.forEach((cell) => {
        const text = String(cell || '').trim();
        if (!text || text.length > 40) return;
        const role = Object.entries(patterns).find(([key, list]) => !roles.has(key) && list.some((re) => re.test(text)))?.[0];
        if (role) roles.add(role);
      });
      if (roles.size >= 3 || (roles.size >= 2 && (roles.has('timestamp') || roles.has('content')))) {
        if (!best || roles.size > best.roles.size) best = { index, roles };
      }
    });
    return best;
  }
  const normHeader = (row) => row.map((cell) => String(cell).toLowerCase().replace(/\s+/g, ' ').trim()).join('|');
  const looksLikeTime = (value) => TIME.test(` ${value} `);

  /* An inject written on its own slide: labelled lines ("From: …", "Channel: …") and a time. */
  function injectFromSlide(slide) {
    const found = {};
    const rest = [];
    slide.blocks.filter((block) => block.kind === 'text').forEach((block) => block.paragraphs.forEach((p) => {
      p.text.split('\n').forEach((line) => {
        const labelled = /^([^:：]{1,24})\s*[:：]\s*(.+)$/.exec(line);
        const key = labelled && Object.keys(LABELS).find((k) => LABELS[k].test(labelled[1].trim()));
        if (key && !found[key]) found[key] = labelled[2].trim();
        else if (!found.timestamp && looksLikeTime(line) && line.length <= 24) found.timestamp = line.trim();
        else rest.push(line);
      });
    }));
    if (!found.timestamp) { const inTitle = TIME.exec(` ${slide.title} `); if (inTitle) found.timestamp = inTitle[1]; }
    const labels = ['sender', 'recipient', 'channel'].filter((key) => found[key]).length;
    return { ...found, content: rest.join('\n'), score: labels + (found.timestamp ? 1 : 0), labels };
  }

  function classify(slide, patterns) {
    const title = slide.title || '';
    const byTitle = SECTION_RULES.find(([, re]) => re.test(title))?.[0];
    if (slide.blocks.some((block) => block.kind === 'table' && chronogramHeader(block.rows, patterns))) return 'chronogram';
    if (byTitle) return byTitle;
    const start = slideText(slide).slice(0, 240);
    return SECTION_RULES.find(([, re]) => re.test(start))?.[0] || 'other';
  }

  /* The deck analysed: the section of each slide, the chronogram tables (continued over
     several slides) and the tabular views Check & Challenge maps its columns on. */
  function analyze(doc, patterns = {}) {
    const unit = doc.unit === 'slide' ? 'Slide' : 'Section';
    const slides = doc.slides.map((slide) => ({ slide, section: classify(slide, patterns), inject: injectFromSlide(slide) }));
    // Chronogram tables: one view per header; a table without header that continues the
    // previous chronogram (same columns, times in its first column) joins it.
    const chronograms = [];
    let last = null;
    slides.forEach(({ slide }) => slide.blocks.forEach((block) => {
      if (block.kind !== 'table') return;
      const header = chronogramHeader(block.rows, patterns);
      if (header) {
        const headerRow = block.rows[header.index];
        const key = normHeader(headerRow);
        let view = chronograms.find((entry) => entry.key === key);
        if (!view) { view = { key, headers: [unit, ...headerRow.map((h) => String(h).trim())], rows: [], slides: [] }; chronograms.push(view); }
        block.rows.slice(header.index + 1).filter((row) => normHeader(row) !== key).forEach((row) => view.rows.push([String(slide.number), ...row]));
        view.slides.push(slide.number);
        last = view;
      } else if (last && block.rows[0]?.length === last.headers.length - 1 && block.rows.filter((row) => looksLikeTime(row[0])).length >= Math.ceil(block.rows.length / 2)) {
        block.rows.forEach((row) => last.rows.push([String(slide.number), ...row]));
        last.slides.push(slide.number);
      }
    }));
    // Injects on their own slides: at least two of sender, recipient, channel, or a time on a
    // slide of the chronogram section.
    const injectSlides = slides.filter(({ slide, section, inject }) => !slide.blocks.some((block) => block.kind === 'table') && (inject.labels >= 2 || (section === 'chronogram' && inject.timestamp)));
    const views = {};
    const range = (numbers) => {
      const list = [...new Set(numbers)].sort((a, b) => a - b);
      return list.length > 1 && list[list.length - 1] - list[0] === list.length - 1 ? `${list[0]}-${list[list.length - 1]}` : list.join(', ');
    };
    chronograms.filter((view) => view.rows.length).forEach((view, i) => {
      views[`Chronogram${chronograms.length > 1 ? ` ${i + 1}` : ''} (${unit.toLowerCase()}s ${range(view.slides)})`] = { headers: view.headers, rows: view.rows };
    });
    if (injectSlides.length) {
      views[`Injects by ${unit.toLowerCase()} (${injectSlides.length})`] = {
        headers: [unit, 'Timestamp', 'Phase', 'Sender', 'Recipient', 'Channel', 'Title', 'Content', 'Notes'],
        rows: injectSlides.map(({ slide, inject }) => [String(slide.number), inject.timestamp || '', inject.phase || '', inject.sender || '', inject.recipient || '', inject.channel || '', slide.title, inject.content, slide.notes])
      };
    }
    views[`All ${unit.toLowerCase()}s`] = {
      headers: [unit, 'Section', 'Title', 'Content', 'Notes'],
      rows: slides.map(({ slide, section }) => [String(slide.number), section, slide.title, slideText(slide).slice(0, 4000), slide.notes])
    };
    const viewNames = Object.keys(views);
    const largestTable = viewNames.filter((n) => /^Chronogram/.test(n)).sort((a, b) => views[b].rows.length - views[a].rows.length)[0];
    const defaultView = largestTable || (injectSlides.length >= 3 ? viewNames.find((n) => /^Injects/.test(n)) : null) || viewNames[viewNames.length - 1];
    const sections = {};
    slides.forEach(({ slide, section }) => { (sections[section] = sections[section] || []).push(slide.number); });
    return {
      unit, sections, views, defaultView,
      slideSections: Object.fromEntries(slides.map(({ slide, section }) => [slide.number, section])),
      chronogramRows: chronograms.reduce((sum, view) => sum + view.rows.length, 0) + injectSlides.length,
      textLength: doc.slides.reduce((sum, slide) => sum + slideText(slide).length + slide.notes.length + slide.title.length, 0)
    };
  }

  // ── Text for the AI ─────────────────────────────────────────────────────────
  function renderSlide(slide, unit, section) {
    const lines = [`--- ${unit} ${slide.number}${slide.title ? ` · ${slide.title}` : ''}${section ? ` [${section}]` : ''}${slide.hidden ? ' (hidden)' : ''}`];
    slide.blocks.forEach((block) => {
      if (block.kind === 'text') block.paragraphs.forEach((p) => lines.push(`${'  '.repeat(p.level)}${block.role === 'subtitle' ? '' : '- '}${p.text.replace(/\n/g, ' / ')}`));
      else if (block.kind === 'table') block.rows.forEach((row) => lines.push(`| ${row.map((cell) => String(cell).replace(/\n/g, ' / ')).join(' | ')} |`));
      else if (block.kind === 'chart') lines.push(`Chart${block.title ? ` "${block.title}"` : ''}: ${block.series.map((s) => `${s.name}: ${s.categories.map((c, i) => `${c}=${s.values[i] ?? ''}`).join(', ') || s.values.join(', ')}`).join('; ')}`);
      else if (block.kind === 'diagram') lines.push(...block.items.map((item) => `> ${item}`));
      else if (block.kind === 'image') lines.push(`[image: ${block.description}]`);
    });
    if (slide.notes) lines.push(`Notes: ${slide.notes.replace(/\n/g, ' / ')}`);
    return lines.join('\n');
  }
  /* The whole document as text, slide by slide. When it is too long, the slides that matter
     least for designing the exercise go first (chronogram tables already sent as rows,
     logistics, proposal), then each slide is shortened. */
  function outline(doc, analysis, { limit = 16000, skipChronogramTables = false } = {}) {
    const unit = analysis.unit;
    const meta = doc.meta || {};
    const head = [`${doc.kind === 'pptx' ? 'POWERPOINT DECK' : doc.kind === 'docx' ? 'WORD DOCUMENT' : 'TEXT DOCUMENT'} "${doc.name}": ${doc.slides.length} ${unit.toLowerCase()}(s)${doc.slides.some((s) => s.hidden) ? `, ${doc.slides.filter((s) => s.hidden).length} hidden` : ''}.`,
      meta.title ? `Title: ${meta.title}` : '', meta.subject ? `Subject: ${meta.subject}` : '', meta.company ? `Company: ${meta.company}` : '',
      `Sections found: ${Object.entries(analysis.sections).map(([key, list]) => `${SECTION_LABELS[key]?.[0] || key} (${unit.toLowerCase()}s ${list.join(', ')})`).join('; ')}.`].filter(Boolean).join('\n');
    const drop = { chronogram: skipChronogramTables ? 0 : 3, rules: 2, proposal: 2, debrief: 2, other: 1 };
    let parts = doc.slides.map((slide) => {
      const section = analysis.slideSections[slide.number];
      const onlyTables = skipChronogramTables && section === 'chronogram' && slide.blocks.every((block) => block.kind === 'table');
      return { slide, section, text: onlyTables ? `--- ${unit} ${slide.number} · ${slide.title || ''} [chronogram: table sent as rows below]` : renderSlide(slide, unit, section), rank: drop[section] ?? 4 };
    });
    const total = () => head.length + parts.reduce((sum, part) => sum + part.text.length + 2, 0);
    for (const rank of [0, 1, 2, 3]) {
      if (total() <= limit) break;
      const cut = parts.filter((part) => part.rank === rank && part.text.length > 160);
      cut.forEach((part) => { part.text = `${part.text.split('\n')[0]} [shortened]\n${part.text.split('\n').slice(1).join(' ').slice(0, 120)}…`; });
    }
    if (total() > limit) {
      const share = Math.max(200, Math.floor((limit - head.length) / parts.length) - 2);
      parts = parts.map((part) => ({ ...part, text: part.text.length > share ? `${part.text.slice(0, share)}…` : part.text }));
    }
    return `${head}\n\n${parts.map((part) => part.text).join('\n\n')}`.slice(0, limit);
  }

  /* Without AI: the fields of the Context tab, taken from the sections found. */
  function contextDraft(doc, analysis) {
    const bySection = (key) => (analysis.sections[key] || []).map((n) => doc.slides.find((s) => s.number === n)).filter(Boolean);
    const lines = (slides) => slides.flatMap((slide) => slide.blocks.flatMap((block) => block.kind === 'text' ? block.paragraphs.map((p) => `${'  '.repeat(p.level)}${p.text}`) : block.kind === 'diagram' ? block.items : block.kind === 'table' ? block.rows.map((row) => row.join(' | ')) : []));
    const paragraphsOf = (key) => lines(bySection(key)).join('\n').trim();
    const phases = bySection('phases');
    const brief = [
      paragraphsOf('context') && `Context:\n${paragraphsOf('context')}`,
      paragraphsOf('players') && `Players and cells:\n${paragraphsOf('players')}`,
      phases.length && `Phases:\n${lines(phases).join('\n')}`,
      paragraphsOf('facilitation') && `Facilitation notes:\n${paragraphsOf('facilitation')}`
    ].filter(Boolean).join('\n\n');
    return {
      name: (doc.meta?.title || (doc.unit === 'slide' ? doc.slides[0]?.title : '') || '').slice(0, 200),
      brief: brief.slice(0, 6000),
      learning_objectives: paragraphsOf('objectives').slice(0, 6000),
      attack_path: paragraphsOf('incident').slice(0, 6000)
    };
  }

  return { parseXml, read, readText, analyze, outline, contextDraft, sectionLabel: (key) => SECTION_LABELS[key] || SECTION_LABELS.other, SECTION_LABELS };
})();

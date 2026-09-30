/* A small .xlsx writer with cell styles. The bundled SheetJS community build reads any
   workbook but writes no styles; the evaluation sheets need colors, borders, filters, frozen
   headers and rating drop-downs, so they are written here as plain SpreadsheetML with JSZip.

   XlsxBook: book.style(spec) returns a style index; book.sheet({...}) adds a worksheet;
   await book.toArrayBuffer() gives the file.
   A style spec: { font: { b, i, sz, color }, fill: 'RRGGBB', border: 'thin' | 'bottom' | 'none',
   borderColor, align: { h, v, wrap, indent } }.
   A sheet: { name, rows: [[value | { v, s }]], cols: [{ width, hidden }], merges: ['A1:H1'],
   freeze: { rows, cols }, filter: 'A10:H40', validations: [{ sqref, list, title, prompt }],
   highlights: [{ sqref, equal, dxf }], heights: { rowIndex: points }, hiddenRows: [rowIndex],
   hidden, tab: 'RRGGBB' }. Rows and columns are 0-based here, 1-based in the file. */

const XLSX_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XLSX_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function xlsxEscape(value) {
  return String(value ?? '')
    // Characters XML 1.0 does not allow.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function xlsxColumn(index) {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

const xlsxRef = (row, col) => `${xlsxColumn(col)}${row + 1}`;
const xlsxArgb = (hex, fallback = '000000') => `FF${(/^[0-9a-f]{6}$/i.test(String(hex || '')) ? hex : fallback).toUpperCase()}`;

class XlsxBook {
  constructor() {
    this.sheets = [];
    this.fonts = ['<font><sz val="10"/><color rgb="FF16121F"/><name val="Arial"/><family val="2"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.dxfs = [];
    this.keys = new Map();
  }

  intern(list, xml) {
    const index = list.indexOf(xml);
    if (index >= 0) return index;
    list.push(xml);
    return list.length - 1;
  }

  style(spec = {}) {
    const key = JSON.stringify(spec);
    if (this.keys.has(key)) return this.keys.get(key);
    const font = spec.font || {};
    const fontId = this.intern(this.fonts, `<font>${font.b ? '<b/>' : ''}${font.i ? '<i/>' : ''}<sz val="${Number(font.sz) || 10}"/><color rgb="${xlsxArgb(font.color, '16121F')}"/><name val="Arial"/><family val="2"/></font>`);
    const fillId = spec.fill ? this.intern(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="${xlsxArgb(spec.fill)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const color = `<color rgb="${xlsxArgb(spec.borderColor, 'E6E4EE')}"/>`;
    const side = (name, on) => (on ? `<${name} style="${spec.borderStyle || 'thin'}">${color}</${name}>` : `<${name}/>`);
    const border = spec.border === 'thin' ? [1, 1, 1, 1] : spec.border === 'bottom' ? [0, 0, 0, 1] : spec.border === 'top' ? [0, 0, 1, 0] : null;
    const borderId = border ? this.intern(this.borders, `<border>${side('left', border[0])}${side('right', border[1])}${side('top', border[2])}${side('bottom', border[3])}<diagonal/></border>`) : 0;
    const align = spec.align || {};
    const alignment = Object.keys(align).length ? `<alignment${align.h ? ` horizontal="${align.h}"` : ''} vertical="${align.v || 'top'}"${align.wrap ? ' wrapText="1"' : ''}${align.indent ? ` indent="${align.indent}"` : ''}/>` : '';
    const xf = `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1"${fillId ? ' applyFill="1"' : ''}${borderId ? ' applyBorder="1"' : ''}${alignment ? ` applyAlignment="1">${alignment}</xf>` : '/>'}`;
    const index = this.intern(this.xfs, xf);
    this.keys.set(key, index);
    return index;
  }

  /* A differential style for conditional formatting: { color, fill, b }. */
  dxf({ color, fill, b = true }) {
    return this.intern(this.dxfs, `<dxf><font>${b ? '<b/>' : ''}<color rgb="${xlsxArgb(color)}"/></font><fill><patternFill patternType="solid"><fgColor rgb="${xlsxArgb(fill)}"/><bgColor rgb="${xlsxArgb(fill)}"/></patternFill></fill></dxf>`);
  }

  sheet(options) {
    const used = new Set(this.sheets.map((sheet) => sheet.name.toLowerCase()));
    let name = String(options.name || `Sheet${this.sheets.length + 1}`).replace(/[\\/?*[\]:]/g, ' ').replace(/^'|'$/g, '').trim().slice(0, 31) || `Sheet${this.sheets.length + 1}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${name.slice(0, 27)} ${n}`;
    const sheet = { ...options, name };
    this.sheets.push(sheet);
    return sheet;
  }

  /* Row heights are not measured by Excel when a file opens: estimated from the wrapped text. */
  rowHeight(sheet, row, index) {
    if (sheet.heights && sheet.heights[index]) return sheet.heights[index];
    const cols = sheet.cols || [];
    const merged = new Map();
    (sheet.merges || []).forEach((range) => {
      const [from, to] = range.split(':');
      const col = (ref) => ref.replace(/\d+/g, '').split('').reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const rowOf = (ref) => Number(ref.replace(/\D+/g, '')) - 1;
      if (rowOf(from) === index && rowOf(to) === index) merged.set(col(from), col(to));
    });
    let lines = 1;
    row.forEach((cell, col) => {
      const value = cell && typeof cell === 'object' ? cell.v : cell;
      if (value === null || value === undefined || value === '' || typeof value === 'number') return;
      let width = cols[col]?.width || 10;
      if (merged.has(col)) for (let c = col + 1; c <= merged.get(col); c++) width += cols[c]?.width || 10;
      const size = (cell && typeof cell === 'object' && cell.sz) || 10;
      const perLine = Math.max(4, Math.floor(width * 1.15 * 10 / size));
      const count = String(value).split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
      lines = Math.max(lines, count);
    });
    return lines > 1 ? Math.min(400, lines * 13.2 + 4) : 0;
  }

  sheetXml(sheet, index) {
    const rows = sheet.rows || [];
    const hiddenRows = new Set(sheet.hiddenRows || []);
    const freeze = sheet.freeze || {};
    const top = xlsxRef(freeze.rows || 0, freeze.cols || 0);
    const pane = freeze.rows || freeze.cols
      ? `<pane${freeze.cols ? ` xSplit="${freeze.cols}"` : ''}${freeze.rows ? ` ySplit="${freeze.rows}"` : ''} topLeftCell="${top}" activePane="${freeze.rows && freeze.cols ? 'bottomRight' : freeze.rows ? 'bottomLeft' : 'topRight'}" state="frozen"/>`
      : '';
    const width = Math.max(1, ...rows.map((row) => row.length), (sheet.cols || []).length);
    const body = rows.map((row, r) => {
      const height = this.rowHeight(sheet, row, r);
      const cells = row.map((cell, c) => {
        const value = cell && typeof cell === 'object' ? cell.v : cell;
        const style = cell && typeof cell === 'object' && Number.isInteger(cell.s) ? ` s="${cell.s}"` : '';
        const ref = xlsxRef(r, c);
        if (value === null || value === undefined || value === '') return style ? `<c r="${ref}"${style}/>` : '';
        if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
        return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xlsxEscape(value)}</t></is></c>`;
      }).join('');
      return `<row r="${r + 1}"${height ? ` ht="${height}" customHeight="1"` : ''}${hiddenRows.has(r) ? ' hidden="1"' : ''}>${cells}</row>`;
    }).join('');
    const cols = (sheet.cols || []).map((col, c) => `<col min="${c + 1}" max="${c + 1}" width="${col.width || 10}" customWidth="1"${col.hidden ? ' hidden="1"' : ''}/>`).join('');
    const merges = (sheet.merges || []).length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((range) => `<mergeCell ref="${range}"/>`).join('')}</mergeCells>` : '';
    let priority = 1;
    const highlights = (sheet.highlights || []).map((rule) => `<conditionalFormatting sqref="${rule.sqref}"><cfRule type="cellIs" dxfId="${rule.dxf}" priority="${priority++}" operator="equal"><formula>"${xlsxEscape(rule.equal)}"</formula></cfRule></conditionalFormatting>`).join('');
    const validations = (sheet.validations || []).length
      ? `<dataValidations count="${sheet.validations.length}">${sheet.validations.map((rule) => `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"${rule.title ? ` promptTitle="${xlsxEscape(String(rule.title).slice(0, 32))}"` : ''}${rule.prompt ? ` prompt="${xlsxEscape(String(rule.prompt).slice(0, 255))}"` : ''} errorTitle="${xlsxEscape(String(rule.title || '').slice(0, 32))}" error="${xlsxEscape(String(rule.error || rule.prompt || '').slice(0, 255))}" sqref="${rule.sqref}"><formula1>"${xlsxEscape(rule.list.join(','))}"</formula1></dataValidation>`).join('')}</dataValidations>`
      : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${XLSX_NS}" xmlns:r="${XLSX_REL}"><sheetPr>${sheet.tab ? `<tabColor rgb="${xlsxArgb(sheet.tab)}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${xlsxRef(Math.max(0, rows.length - 1), width - 1)}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="${sheet.zoom || 100}"${index === 0 ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${body}</sheetData>${sheet.filter ? `<autoFilter ref="${sheet.filter}"/>` : ''}${merges}${highlights}${validations}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }

  stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${XLSX_NS}"><fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts><fills count="${this.fills.length}">${this.fills.join('')}</fills><borders count="${this.borders.length}">${this.borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="${this.dxfs.length}">${this.dxfs.join('')}</dxfs></styleSheet>`;
  }

  files() {
    const sheets = this.sheets;
    const quoted = (name) => `'${name.replace(/'/g, "''")}'`;
    const absolute = (range) => range.split(':').map((ref) => ref.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2')).join(':');
    const defined = sheets.map((sheet, index) => (sheet.filter ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">${xlsxEscape(quoted(sheet.name))}!${absolute(sheet.filter)}</definedName>` : '')).join('');
    // Excel needs one visible sheet selected: the first visible one.
    const firstVisible = Math.max(0, sheets.findIndex((sheet) => !sheet.hidden));
    const files = {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${XLSX_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${XLSX_NS}" xmlns:r="${XLSX_REL}"><bookViews><workbookView activeTab="${firstVisible}" firstSheet="${firstVisible}"/></bookViews><sheets>${sheets.map((sheet, index) => `<sheet name="${xlsxEscape(sheet.name)}" sheetId="${index + 1}"${sheet.hidden ? ' state="hidden"' : ''} r:id="rId${index + 1}"/>`).join('')}</sheets>${defined ? `<definedNames>${defined}</definedNames>` : ''}</workbook>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${XLSX_REL}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${XLSX_REL}/styles" Target="styles.xml"/></Relationships>`,
      'xl/styles.xml': this.stylesXml()
    };
    sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = this.sheetXml(sheet, sheets[firstVisible] === sheet ? 0 : -1); });
    return files;
  }

  async toArrayBuffer() {
    const zip = new JSZip();
    Object.entries(this.files()).forEach(([path, xml]) => zip.file(path, xml));
    return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  }
}

// Coerenza del progetto: testi, lingue, file caricati, disegno.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Flow = require('../src/core/flow.js');
const Render = require('../src/core/render.js');
const Util = require('../src/core/util.js');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const jsFiles = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? jsFiles(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name).split(path.sep).join('/')] : []);

// Le lingue: l'italiano è il riferimento, ogni altra ha le stesse chiavi e gli stessi livelli.
const LOCALES = fs.readdirSync(path.join(root, 'src/i18n')).filter((f) => f.endsWith('.js')).map((f) => path.basename(f, '.js'));
const I18N = Object.fromEntries(LOCALES.map((l) => [l, require(`../src/i18n/${l}.js`)]));
const LEVELS = Object.fromEntries(LOCALES.map((l) => [l, require(`../src/levels/${l}/levels.js`)]));
const placeholders = (v) => [...new Set(String(v).match(/\{\w+\}/g) || [])].sort();

test('index.html carica ogni file di src/', () => {
  const html = read('index.html');
  for (const f of jsFiles('src')) assert.ok(html.includes(`src="${f}"`), f + ' non è caricato da index.html');
});

test('il service worker conserva ogni file della pagina, per usarla offline', () => {
  const sw = read('sw.js'), html = read('index.html');
  const local = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  for (const f of ['index.html', ...local]) assert.ok(sw.includes(`'${f}'`), f + ' manca in FILES di sw.js');
  for (const f of JSON.parse(read('manifest.webmanifest')).icons) assert.ok(fs.existsSync(path.join(root, f.src)), f.src + ' non esiste');
});

test('ogni chiave usata esiste, e nessuna è in più', () => {
  const keys = new Set(Object.keys(I18N.it));
  const used = new Set(['locale.name', 'app.description']);
  const src = jsFiles('src').filter((f) => !f.startsWith('src/i18n') && !f.startsWith('src/levels')).map(read).join('\n');
  const patterns = [/\b(?:t|Err|BlockErr\([^,]+,)\s*\(?\s*'([a-z]+\.[A-Za-z.0-9]+)'/g, /'((?:app|ui|blk|ph|aria|draw|trace|run|expr|block|check|an|empty|hint)\.[A-Za-z.0-9]+)'/g];
  for (const re of patterns) for (const m of src.matchAll(re)) used.add(m[1]);
  for (const m of read('index.html').matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) used.add(m[1]);
  // chiavi composte a runtime
  for (const t of Flow.TYPES) { used.add('blk.' + t); used.add('blk.desc.' + t); }
  for (const r of ['in', 'out', 'work']) used.add('ui.role.' + r);
  for (const m of ['auto', 'light', 'dark']) used.add('ui.theme.' + m);
  for (const [t, fs_] of Object.entries(Flow.FIELDS)) for (const f of fs_) if (f !== 'c' && f !== 'step') used.add(`empty.${t}.${f}`);
  ['ui.kind.quiz', 'ui.kind.build'].forEach((k) => used.add(k));
  const prefixes = ['app.', 'draw.', 'ui.', 'blk.', 'ph.', 'aria.', 'trace.', 'run.', 'expr.', 'block.', 'check.', 'an.', 'empty.', 'hint.'];
  for (const k of used) if (prefixes.some((p) => k.startsWith(p)) && !k.endsWith('.')) assert.ok(keys.has(k), 'manca la chiave ' + k);
  const unused = [...keys].filter((k) => !used.has(k));
  assert.deepStrictEqual(unused, [], 'chiavi mai usate');
});

for (const l of LOCALES) {
  test(`testi in ${l}: stesse chiavi e stessi segnaposto dell'italiano`, () => {
    assert.deepStrictEqual(Object.keys(I18N[l]).sort(), Object.keys(I18N.it).sort());
    for (const [k, v] of Object.entries(I18N.it)) assert.deepStrictEqual(placeholders(I18N[l][k]), placeholders(v), `${l}: segnaposto diversi in ${k}`);
  });

  // Stessi id nello stesso ordine (i progressi li usano), e la stessa struttura di domande e prove.
  test(`livelli in ${l}: stessi capitoli e livelli dell'italiano`, () => {
    const shape = (chs) => chs.map((ch) => [ch.id, ch.palette, ch.levels.map((lv) => [lv.id, lv.kind, lv.palette, !!lv.analysis,
      (lv.questions || []).map((q) => [q.options ? q.options.length : 0, typeof q.answer === 'number' ? q.answer : 'testo', q.run]),
      (lv.tests || []).map((x) => x.input.length)])]);
    assert.deepStrictEqual(shape(LEVELS[l]), shape(LEVELS.it));
  });
}

test('il disegno di ogni diagramma è un SVG valido', () => {
  for (const l of LOCALES) for (const ch of LEVELS[l]) for (const lv of ch.levels) {
    Util.setLocale(l);
    for (const prog of [lv.solution, lv.start, lv.show]) {
      if (!prog) continue;
      const svg = Render.render(Flow.fromArray(prog));
      assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ \d+"/);
      assert.ok(!/NaN|undefined/.test(svg), lv.id + ': valori non validi nel disegno');
      assert.strictEqual((svg.match(/<g /g) || []).length, (svg.match(/<\/g>/g) || []).length);
    }
  }
});

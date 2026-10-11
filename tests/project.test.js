// Coerenza del progetto: testi, file caricati, disegno.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const I18N = require('../src/i18n/it.js');
const Flow = require('../src/core/flow.js');
const Render = require('../src/core/render.js');
const CHAPTERS = require('../src/levels/it/levels.js');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const jsFiles = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? jsFiles(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name).split(path.sep).join('/')] : []);

test('index.html carica ogni file di src/', () => {
  const html = read('index.html');
  for (const f of jsFiles('src')) assert.ok(html.includes(`src="${f}"`), f + ' non è caricato da index.html');
});

test('ogni chiave usata esiste, e nessuna è in più', () => {
  const keys = new Set(Object.keys(I18N.it));
  const used = new Set();
  const src = jsFiles('src').filter((f) => !f.startsWith('src/i18n') && !f.startsWith('src/levels')).map(read).join('\n');
  const patterns = [/\b(?:t|Err|BlockErr\([^,]+,)\s*\(?\s*'([a-z]+\.[A-Za-z.]+)'/g, /'((?:ui|blk|ph|aria|trace|run|expr|block|check|an|empty|hint)\.[A-Za-z.]+)'/g];
  for (const re of patterns) for (const m of src.matchAll(re)) used.add(m[1]);
  for (const m of read('index.html').matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) used.add(m[1]);
  // chiavi composte a runtime
  for (const t of Flow.TYPES) { used.add('blk.' + t); used.add('blk.desc.' + t); }
  for (const r of ['in', 'out', 'work']) used.add('ui.role.' + r);
  for (const m of ['auto', 'light', 'dark']) used.add('ui.theme.' + m);
  for (const [t, fs_] of Object.entries(Flow.FIELDS)) for (const f of fs_) if (f !== 'c' && f !== 'step') used.add(`empty.${t}.${f}`);
  ['ui.kind.quiz', 'ui.kind.build'].forEach((k) => used.add(k));
  const prefixes = ['ui.', 'blk.', 'ph.', 'aria.', 'trace.', 'run.', 'expr.', 'block.', 'check.', 'an.', 'empty.', 'hint.'];
  for (const k of used) if (prefixes.some((p) => k.startsWith(p)) && !k.endsWith('.')) assert.ok(keys.has(k), 'manca la chiave ' + k);
  const unused = [...keys].filter((k) => !used.has(k));
  assert.deepStrictEqual(unused, [], 'chiavi mai usate');
});

test('il disegno di ogni diagramma è un SVG valido', () => {
  for (const ch of CHAPTERS) for (const lv of ch.levels) {
    for (const prog of [lv.solution, lv.start, lv.show]) {
      if (!prog) continue;
      const svg = Render.render(Flow.fromArray(prog));
      assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ \d+"/);
      assert.ok(!/NaN|undefined/.test(svg), lv.id + ': valori non validi nel disegno');
      assert.strictEqual((svg.match(/<g /g) || []).length, (svg.match(/<\/g>/g) || []).length);
    }
  }
});

// Ogni livello deve essere risolvibile e non già risolto dal diagramma di partenza.
const test = require('node:test');
const assert = require('node:assert');
const Flow = require('../src/core/flow.js');
const Checker = require('../src/core/checker.js');
const Interpreter = require('../src/core/interpreter.js');
const Util = require('../src/core/util.js');
const CHAPTERS = require('../src/levels/it/levels.js');

const TYPES = new Set(Flow.TYPES);
const levels = CHAPTERS.flatMap((ch) => ch.levels.map((lv) => ({ ch, lv })));

test('id di capitoli e livelli unici e ben formati', () => {
  const ids = new Set();
  for (const ch of CHAPTERS) {
    assert.match(ch.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has('ch:' + ch.id), 'capitolo doppio ' + ch.id);
    ids.add('ch:' + ch.id);
  }
  for (const { lv } of levels) {
    assert.match(lv.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(lv.id), 'livello doppio ' + lv.id);
    ids.add(lv.id);
    assert.ok(lv.title && lv.task, lv.id + ': servono title e task');
  }
});

for (const { ch, lv } of levels) {
  if (lv.kind === 'quiz') {
    test(`domande ${ch.id}/${lv.id}`, () => {
      assert.ok(lv.questions.length > 0);
      for (const q of lv.questions) {
        assert.ok(q.q && q.why, lv.id + ': ogni domanda ha testo e spiegazione');
        if (typeof q.answer === 'number') {
          assert.ok(q.options && q.answer >= 0 && q.answer < q.options.length, lv.id + ': risposta fuori dalle opzioni');
        } else {
          assert.ok(!q.options, lv.id + ': risposta testuale senza opzioni');
          assert.ok(Checker.checkAnswer(q, [].concat(q.answer)[0]));
        }
        // le risposte che dipendono dal diagramma mostrato devono coincidere con la sua esecuzione
        if (q.run) {
          const res = Interpreter.run(Flow.fromArray(lv.show), { input: q.run });
          assert.strictEqual(res.error, null, lv.id + ': il diagramma mostrato va in errore');
          assert.ok(Checker.checkAnswer(q, res.output.join(' ')), `${lv.id}: «${q.q}» esecuzione ${res.output.join(' ')}`);
        }
      }
      if (lv.show) assert.strictEqual(Interpreter.check(Flow.fromArray(lv.show)), null);
    });
    continue;
  }
  test(`livello ${ch.id}/${lv.id}`, () => {
    const palette = lv.palette || ch.palette;
    assert.ok(palette && palette.every((t) => TYPES.has(t)), lv.id + ': palette mancante o sbagliata');
    let used = [];
    Flow.walk(Flow.fromArray(lv.solution), (b) => used.push(b.t));
    for (const t of used) assert.ok(palette.includes(t), `${lv.id}: la soluzione usa ${t}, che non è nella palette`);
    assert.ok(lv.tests.length > 0);

    const sol = Checker.check(lv, Flow.fromArray(lv.solution), lv.analysisSolution);
    assert.ok(sol.ok, `${lv.id}: la soluzione non supera il livello: ` + JSON.stringify(sol.fail && (sol.fail.msg || Util.t(sol.fail.key, sol.fail.vals))) + ' ' + JSON.stringify(sol.fail && sol.fail.got));

    const start = Checker.check(lv, Flow.fromArray(lv.start || []), lv.analysisSolution);
    assert.ok(!start.ok, lv.id + ': il diagramma di partenza supera già il livello');
    assert.strictEqual(!!lv.analysis, !!lv.analysisSolution, lv.id + ': analysis e analysisSolution vanno insieme');
  });
}

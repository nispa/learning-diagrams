// Verifica un livello. Non produce frasi: restituisce una chiave (o il msg scritto nel livello).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./interpreter.js'), require('./flow.js'), require('./util.js'));
  else root.Checker = factory(root.Interpreter, root.Flow, root.Util);
})(this, function (Interpreter, Flow, Util) {
  'use strict';

  function sameOutput(got, want) {
    if (got.length !== want.length) return false;
    for (let i = 0; i < want.length; i++) if (Util.norm(got[i]) !== Util.norm(want[i])) return false;
    return true;
  }

  // Una regola su un blocco: tipo (o lista di tipi) e, se c'è, un'espressione regolare sul suo testo.
  function matches(list, rule) {
    const types = [].concat(rule.t);
    let found = false;
    Flow.walk(list, function (b) {
      if (types.indexOf(b.t) < 0) return;
      if (!rule.re) { found = true; return; }
      const text = Flow.FIELDS[b.t].map(function (f) { return b[f]; }).join(' ');
      if (new RegExp(rule.re).test(text)) found = true;
    });
    return found;
  }

  const fmtInput = function (inp) { return inp.length ? inp.join(', ') : ['check.noData']; };

  // La tabella delle variabili deve raccontare lo stesso diagramma: niente nomi mancanti o inventati,
  // e il ruolo deve corrispondere all'uso (chi è letto è un dato in ingresso, un risultato va scritto).
  function checkAnalysis(list, rows) {
    rows = (rows || []).filter(function (r) { return (r.name || '').trim(); });
    if (!rows.length) return { key: 'an.empty' };
    const u = Flow.usage(list), seen = {};
    for (const r of rows) {
      const name = r.name.trim();
      if (seen[name]) return { key: 'an.twice', vals: { name: name } };
      seen[name] = true;
      if (!u.all.has(name)) return { key: 'an.unused', vals: { name: name } };
      if (!r.role) return { key: 'an.noRole', vals: { name: name } };
      if ((r.desc || '').trim().length < 3) return { key: 'an.noDesc', vals: { name: name } };
      if (u.read.has(name) && r.role !== 'in') return { key: 'an.shouldIn', vals: { name: name } };
      if (r.role === 'in' && !u.read.has(name)) return { key: 'an.notRead', vals: { name: name } };
      if (r.role === 'out' && !u.printed.has(name)) return { key: 'an.notPrinted', vals: { name: name } };
    }
    for (const name of u.all) if (!seen[name]) return { key: 'an.missing', vals: { name: name } };
    return null;
  }

  function check(level, list, analysis) {
    const fail = function (f) { return { ok: false, fail: f }; };
    if (!list.length) return fail({ key: 'check.empty' });
    if (level.analysis && !(analysis || []).some(function (r) { return (r.name || '').trim(); })) return fail({ key: 'an.empty' });

    const ce = Interpreter.check(list);
    if (ce) return fail(ce);

    for (const r of level.must || []) if (!matches(list, r)) return fail({ msg: r.msg });
    for (const r of level.mustNot || []) if (matches(list, r)) return fail({ msg: r.msg });
    for (const r of level.maxCount || []) if (Flow.count(list, r.t || []) > r.max) return fail({ msg: r.msg });

    for (const test of level.tests) {
      const res = Interpreter.run(list, { input: test.input });
      if (res.error) {
        return fail({ key: 'check.error', blockId: res.error.blockId, vals: { input: fmtInput(test.input), err: [res.error.key, res.error.vals] }, test: test, got: res.output });
      }
      if (!sameOutput(res.output, test.expect)) {
        return fail({ key: 'check.wrong', vals: { input: fmtInput(test.input) }, test: test, got: res.output });
      }
    }

    if (level.analysis) {
      const a = checkAnalysis(list, analysis);
      if (a) return fail(a);
    }
    return { ok: true };
  }

  // Domande a scelta (answer: indice) o a risposta breve (answer: testo o lista di testi).
  function checkAnswer(q, given) {
    if (typeof q.answer === 'number') return given === q.answer;
    if (given === undefined || given === null || !String(given).trim()) return false;
    return [].concat(q.answer).some(function (a) { return Util.norm(a) === Util.norm(given); });
  }

  return { check: check, checkAnswer: checkAnswer, checkAnalysis: checkAnalysis, sameOutput: sameOutput };
});

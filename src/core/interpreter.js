// Esegue un diagramma. Non scrive frasi: gli errori sono { blockId, key, vals } da tradurre.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./expr.js'), require('./flow.js'), require('./util.js'));
  else root.Interpreter = factory(root.Expr, root.Flow, root.Util);
})(this, function (Expr, Flow, Util) {
  'use strict';

  // Restano sempre: così un ciclo infinito non blocca la pagina.
  const LIMITS = { steps: 10000, output: 500, trace: 3000 };

  function BlockErr(b, key, vals, kind) {
    const e = new Error(key);
    e.block = b; e.key = key; e.vals = vals || {}; e.kind = kind || 'runtime';
    return e;
  }

  const hasQuote = function (s) { return /["“”„'‘’«]/.test(s); };

  // Controlla tutti i campi prima di partire: un errore di scrittura emerge anche nei rami non percorsi.
  function compile(list) {
    Flow.walk(list, function (b) {
      b._ = {};
      Flow.FIELDS[b.t].forEach(function (f) {
        const src = String(b[f]).trim();
        if (!src) {
          if (f === 'step') return;
          throw BlockErr(b, f === 'c' ? 'empty.cond' : 'empty.' + b.t + '.' + f, {}, 'compile');
        }
        if (f === 'v') {
          if (/[←=]|<-/.test(src)) throw BlockErr(b, 'block.nameWithArrow', { name: src }, 'compile');
          if (!Expr.isName(src)) throw BlockErr(b, 'block.badName', { name: src }, 'compile');
          if (Expr.isReserved(src)) throw BlockErr(b, 'block.reserved', { name: src }, 'compile');
          return;
        }
        try {
          b._[f] = f === 'e' && b.t === 'scrivi' ? Expr.parseList(src) : Expr.parse(src);
        } catch (e) {
          if (!e.key) throw e;
          // Il primo errore di tutti: un testo scritto senza virgolette.
          if (b.t === 'scrivi' && !hasQuote(src) && /^expr\.(missingOperator|badChar|unexpected)$/.test(e.key)) throw BlockErr(b, 'block.needQuotes', { src: src }, 'compile');
          throw BlockErr(b, e.key, e.vals, 'compile');
        }
      });
    });
  }

  function parseInput(s) {
    s = String(s).trim();
    return /^[-+]?\d+([.,]\d+)?$/.test(s) ? Number(s.replace(',', '.')) : s;
  }

  function run(list, opts) {
    opts = opts || {};
    const input = (opts.input || []).map(String);
    const maxSteps = opts.maxSteps || LIMITS.steps;
    const vars = Object.create(null), out = [], loops = [];
    const trace = opts.trace ? [] : null;
    let ip = 0, steps = 0;

    const snap = function (b, note) {
      if (trace && trace.length < LIMITS.trace) trace.push({ id: b.id, note: note, vars: Object.assign({}, vars), out: out.length });
    };
    const loopCond = function (lp) {
      if (lp.t !== 'per') return lp.c;
      return lp.v + (/^\s*-/.test(lp.step) ? ' ≥ ' : ' ≤ ') + lp.to;
    };
    const tick = function (b) {
      if (++steps <= maxSteps) return;
      const lp = loops[loops.length - 1];
      throw lp ? BlockErr(lp, 'run.infinite', { n: maxSteps, cond: loopCond(lp) }, 'limit') : BlockErr(b, 'run.tooLong', { n: maxSteps }, 'limit');
    };
    const ev = function (b, ast) {
      try { return Expr.evaluate(ast, vars); } catch (e) {
        if (!e.key) throw e;
        if (e.key === 'run.noValue') {
          const name = e.vals.name;
          const s = Util.suggest(name, Object.keys(vars));
          if (b.t === 'scrivi' && !hasQuote(b.e) && !s) throw BlockErr(b, 'run.noValueText', { name: name });
          throw BlockErr(b, 'run.noValue', { name: name, suggest: s ? ['hint.didYouMean', { name: s }] : '' });
        }
        throw BlockErr(b, e.key, e.vals);
      }
    };
    const cond = function (b) {
      const v = ev(b, b._.c);
      if (typeof v !== 'boolean') throw BlockErr(b, 'run.condNotBool', { cond: b.c, val: Expr.format(v) });
      return v;
    };
    const number = function (b, f) {
      const v = ev(b, b._[f]);
      if (typeof v !== 'number') throw BlockErr(b, 'run.forNotNumber', { what: b[f] });
      return v;
    };

    function exec(list) {
      for (let k = 0; k < list.length; k++) {
        const b = list[k];
        tick(b);
        switch (b.t) {
          case 'leggi': {
            if (ip >= input.length) throw BlockErr(b, 'run.noInput', { name: b.v, n: ip });
            const v = parseInput(input[ip++]);
            vars[b.v] = v;
            snap(b, { k: 'read', name: b.v, val: v });
            break;
          }
          case 'scrivi': {
            if (out.length >= LIMITS.output) {
              const lp = loops[loops.length - 1];
              throw lp ? BlockErr(lp, 'run.infiniteOut', { n: LIMITS.output, cond: loopCond(lp) }, 'limit') : BlockErr(b, 'run.tooMuchOutput', { n: LIMITS.output }, 'limit');
            }
            const line = b._.e.map(function (a) { return Expr.format(ev(b, a)); }).join(' ');
            out.push(line);
            snap(b, { k: 'write', text: line });
            break;
          }
          case 'assegna': {
            vars[b.v] = ev(b, b._.e);
            snap(b, { k: 'set', name: b.v, val: vars[b.v] });
            break;
          }
          case 'se': {
            const c = cond(b);
            snap(b, { k: 'cond', cond: b.c, val: c });
            exec(c ? b.yes : b.no);
            break;
          }
          case 'mentre': {
            loops.push(b);
            for (;;) {
              const c = cond(b);
              snap(b, { k: 'cond', cond: b.c, val: c });
              if (!c) break;
              exec(b.body);
              tick(b);
            }
            loops.pop();
            break;
          }
          case 'ripeti': {
            loops.push(b);
            for (;;) {
              exec(b.body);
              tick(b);
              const c = cond(b);
              snap(b, { k: 'cond', cond: b.c, val: c });
              if (!c) break;
            }
            loops.pop();
            break;
          }
          case 'per': {
            const from = number(b, 'from'), to = number(b, 'to');
            const step = b._.step ? number(b, 'step') : 1;
            if (step === 0) throw BlockErr(b, 'run.zeroStep');
            vars[b.v] = from;
            snap(b, { k: 'set', name: b.v, val: from });
            loops.push(b);
            for (;;) {
              const i = vars[b.v];
              if (typeof i !== 'number') throw BlockErr(b, 'run.forNotNumber', { what: b.v });
              const c = step > 0 ? i <= to + 1e-9 : i >= to - 1e-9;
              snap(b, { k: 'cond', cond: loopCond(b), val: c });
              if (!c) break;
              exec(b.body);
              tick(b);
              vars[b.v] = vars[b.v] + step;
              snap(b, { k: 'set', name: b.v, val: vars[b.v] });
            }
            loops.pop();
            break;
          }
        }
      }
    }

    const fail = function (e) {
      if (!e.key) throw e;
      return { ok: false, output: out, trace: trace, steps: steps, readCount: ip, error: { blockId: e.block && e.block.id, key: e.key, vals: e.vals, kind: e.kind } };
    };
    try { compile(list); } catch (e) { return fail(e); }
    try { exec(list); } catch (e) { return fail(e); }
    return { ok: true, output: out, trace: trace, steps: steps, readCount: ip, error: null };
  }

  function check(list) {
    try { compile(list); return null; } catch (e) {
      if (!e.key) throw e;
      return { blockId: e.block.id, key: e.key, vals: e.vals, kind: 'compile' };
    }
  }

  return { run: run, check: check, parseInput: parseInput, LIMITS: LIMITS };
});

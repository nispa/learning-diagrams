// Espressioni del diagramma: numeri, testi tra virgolette, variabili, operatori in stile pseudocodice.
// Non contiene frasi: gli errori sono chiavi da tradurre (src/i18n/).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Expr = factory();
})(this, function () {
  'use strict';

  function Err(key, vals) { const e = new Error(key); e.key = key; e.vals = vals || {}; return e; }

  // Le parole del pseudocodice cambiano con la lingua; dentro restano le stesse (and, or, sqrt...).
  // In italiano si accettano anche and, or, not: li conosce chi arriva dal C.
  const LANGS = {
    it: {
      words: { e: 'and', and: 'and', o: 'or', or: 'or', non: 'not', not: 'not', mod: 'mod', div: 'div', vero: 'true', falso: 'false' },
      funcs: { abs: 'abs', radq: 'sqrt', intero: 'int', arrotonda: 'round' },
      bool: ['vero', 'falso'],
    },
    en: {
      words: { and: 'and', or: 'or', not: 'not', mod: 'mod', div: 'div', true: 'true', false: 'false' },
      funcs: { abs: 'abs', sqrt: 'sqrt', int: 'int', round: 'round' },
      bool: ['true', 'false'],
    },
  };
  let L = LANGS.it;
  function setLocale(l) { L = LANGS[l] || LANGS.it; }

  const FUNCS = {
    abs: { n: [1], f: Math.abs },
    sqrt: { n: [1], f: Math.sqrt },
    int: { n: [1], f: Math.trunc },
    round: { n: [1, 2], f: function (x, d) { const p = Math.pow(10, d || 0); return Math.round(x * p) / p; } },
  };
  // I più lunghi prima; ":" è la divisione come a scuola, "%" il resto come in C.
  const SYM = [
    ['<=', '<='], ['>=', '>='], ['<>', '!='], ['!=', '!='], ['==', '='], ['&&', 'and'], ['||', 'or'],
    ['<-', 'arrow'], ['←', 'arrow'], ['≤', '<='], ['≥', '>='], ['≠', '!='], ['=', '='], ['<', '<'], ['>', '>'],
    ['+', '+'], ['-', '-'], ['−', '-'], ['*', '*'], ['×', '*'], ['·', '*'], ['/', '/'], [':', '/'],
    ['%', 'mod'], ['^', '^'], ['!', 'not'], ['(', '('], [')', ')'], [',', ','],
  ];
  // Le tastiere dei telefoni trasformano " in “ ”: le accettiamo tutte.
  const DQ = '"“”„', SQ = "'‘’";

  function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i], rest = src.slice(i);
      let m;
      if (/\s/.test(c)) { i++; continue; }
      if ((m = /^\d+(\.\d+)?/.exec(rest))) {
        if (/^,\d/.test(rest.slice(m[0].length))) throw Err('expr.decimalComma', { num: m[0] + '.' + rest.slice(m[0].length + 1).match(/^\d+/)[0] });
        out.push({ type: 'num', v: parseFloat(m[0]), text: m[0] });
        i += m[0].length; continue;
      }
      if ((m = /^[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*/.exec(rest))) {
        const k = L.words[m[0].toLowerCase()];
        out.push(k ? { type: 'op', v: k, text: m[0] } : { type: 'id', v: m[0], text: m[0] });
        i += m[0].length; continue;
      }
      if (DQ.includes(c) || SQ.includes(c) || c === '«') {
        const close = c === '«' ? '»' : DQ.includes(c) ? DQ : SQ;
        let j = i + 1;
        while (j < src.length && !close.includes(src[j])) j++;
        if (j >= src.length) throw Err('expr.unclosedString');
        out.push({ type: 'str', v: src.slice(i + 1, j), text: src.slice(i, j + 1) });
        i = j + 1; continue;
      }
      const s = SYM.find(function (p) { return src.startsWith(p[0], i); });
      if (!s) throw Err('expr.badChar', { ch: c });
      if (s[1] === 'arrow') throw Err('expr.arrow');
      out.push({ type: 'op', v: s[1], text: s[0] });
      i += s[0].length;
    }
    return out;
  }

  const BIN = { or: 1, and: 2, '=': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5, mod: 5, div: 5, '^': 7 };
  const CMP = { '=': 1, '!=': 1, '<': 1, '<=': 1, '>': 1, '>=': 1 };

  function Parser(toks) { this.t = toks; this.i = 0; }
  Parser.prototype.peek = function () { return this.t[this.i]; };
  Parser.prototype.next = function () { return this.t[this.i++]; };

  Parser.prototype.expr = function (min) {
    let left = this.unary();
    for (;;) {
      const tk = this.peek();
      if (!tk) break;
      if (tk.type === 'op' && (tk.v === ')' || tk.v === ',')) break;
      if (tk.type !== 'op' || !(tk.v in BIN)) {
        // due valori di seguito, come "2 x" o "a b": manca un operatore
        throw Err('expr.missingOperator', { a: this.t[this.i - 1].text, b: tk.text });
      }
      const p = BIN[tk.v];
      if (p < min) break;
      if (CMP[tk.v] && left.k === 'bin' && CMP[left.op] && !left.paren) throw Err('expr.chainedCmp');
      this.next();
      if (!this.peek()) throw Err('expr.missingValue', { op: tk.text });
      const right = this.expr(tk.v === '^' ? p : p + 1);
      left = { k: 'bin', op: tk.v, text: tk.text, l: left, r: right };
    }
    return left;
  };

  Parser.prototype.unary = function () {
    const tk = this.next();
    if (tk.type === 'num' || tk.type === 'str') return { k: tk.type, v: tk.v };
    if (tk.type === 'id') {
      const nx = this.peek();
      if (nx && nx.v === '(') {
        this.next();
        const args = [];
        if (this.peek() && this.peek().v === ')') { this.next(); return { k: 'call', name: tk.v, args: args }; }
        for (;;) {
          if (!this.peek()) throw Err('expr.missingParen');
          args.push(this.expr(0));
          const s = this.next();
          if (!s) throw Err('expr.missingParen');
          if (s.v === ')') break;
          if (s.v !== ',') throw Err('expr.unexpected', { tok: s.text });
        }
        return { k: 'call', name: tk.v, args: args };
      }
      return { k: 'var', name: tk.v };
    }
    if (tk.v === 'true' || tk.v === 'false') return { k: 'bool', v: tk.v === 'true' };
    if (tk.v === '(') {
      if (!this.peek()) throw Err('expr.missingParen');
      if (this.peek().v === ')') throw Err('expr.emptyParen');
      const e = this.expr(0);
      const c = this.next();
      if (!c || c.v !== ')') throw Err('expr.missingParen');
      e.paren = true;
      return e;
    }
    if ((tk.v === '-' || tk.v === '+' || tk.v === 'not') && !this.peek()) throw Err('expr.missingValue', { op: tk.text });
    if (tk.v === '-') return { k: 'un', op: '-', e: this.expr(6) };
    if (tk.v === '+') return this.expr(6);
    if (tk.v === 'not') return { k: 'un', op: 'not', text: tk.text, e: this.expr(3) };
    if (tk.v === ')') throw Err('expr.extraParen');
    throw Err('expr.missingValueBefore', { op: tk.text });
  };

  function leftover(tk) {
    if (tk.v === ')') return Err('expr.extraParen');
    return Err('expr.unexpected', { tok: tk.text });
  }

  function parse(src) {
    const toks = tokenize(String(src));
    if (!toks.length) throw Err('expr.empty');
    const p = new Parser(toks);
    const e = p.expr(0);
    const tk = p.next();
    if (tk) throw tk.v === ',' ? Err('expr.comma') : leftover(tk);
    return e;
  }

  // Il blocco Scrivi accetta più valori separati da virgola.
  function parseList(src) {
    const toks = tokenize(String(src));
    if (!toks.length) throw Err('expr.empty');
    const p = new Parser(toks), out = [];
    for (;;) {
      out.push(p.expr(0));
      const tk = p.next();
      if (!tk) break;
      if (tk.v !== ',') throw leftover(tk);
      if (!p.peek()) throw Err('expr.trailingComma');
    }
    return out;
  }

  function num(v, op) {
    if (typeof v !== 'number') throw Err(typeof v === 'string' ? 'run.textNotNumber' : 'run.boolNotNumber', { op: op });
  }
  function bool(v, op) {
    if (typeof v !== 'boolean') throw Err('run.notBool', { op: op });
  }

  function evaluate(n, vars) {
    switch (n.k) {
      case 'num': case 'str': case 'bool': return n.v;
      case 'var':
        if (!(n.name in vars)) throw Err('run.noValue', { name: n.name });
        return vars[n.name];
      case 'un': {
        const v = evaluate(n.e, vars);
        if (n.op === '-') { num(v, '-'); return -v; }
        bool(v, n.text);
        return !v;
      }
      case 'call': {
        const f = FUNCS[L.funcs[n.name.toLowerCase()]];
        if (!f) throw Err('run.noFunc', { name: n.name });
        if (f.n.indexOf(n.args.length) < 0) throw Err('run.funcArgs', { name: n.name });
        const a = n.args.map(function (x) { const v = evaluate(x, vars); num(v, n.name); return v; });
        const r = f.f.apply(null, a);
        if (Number.isNaN(r)) throw Err('run.nan', { name: n.name });
        return r;
      }
      case 'bin': {
        const op = n.op;
        if (op === 'and' || op === 'or') {
          const l = evaluate(n.l, vars);
          bool(l, n.text);
          if (op === 'and' && !l) return false;
          if (op === 'or' && l) return true;
          const r = evaluate(n.r, vars);
          bool(r, n.text);
          return r;
        }
        const l = evaluate(n.l, vars), r = evaluate(n.r, vars);
        if (op === '+') {
          if (typeof l === 'string' && typeof r === 'string') return l + r;
          if (typeof l === 'string' || typeof r === 'string') throw Err('run.textPlus');
          num(l, '+'); num(r, '+');
          return l + r;
        }
        if (op === '=' || op === '!=') {
          // tolleranza: 0.1 + 0.2 deve essere uguale a 0.3 anche per chi impara
          const eq = typeof l === 'number' && typeof r === 'number' ? Math.abs(l - r) < 1e-9 : l === r;
          return op === '=' ? eq : !eq;
        }
        if (op in CMP) {
          if (typeof l !== typeof r || typeof l === 'boolean') throw Err('run.compare', { op: n.text });
          return op === '<' ? l < r : op === '<=' ? l <= r : op === '>' ? l > r : l >= r;
        }
        num(l, n.text); num(r, n.text);
        if ((op === '/' || op === 'mod' || op === 'div') && r === 0) throw Err('run.divZero', { op: n.text });
        if (op === '-') return l - r;
        if (op === '*') return l * r;
        if (op === '/') return l / r;
        if (op === '^') return Math.pow(l, r);
        if (op === 'mod') return l % r;
        return Math.trunc(l / r);
      }
    }
    throw new Error('nodo sconosciuto ' + n.k);
  }

  function names(n, out) {
    out = out || new Set();
    if (!n) return out;
    if (n.k === 'var') out.add(n.name);
    [n.l, n.r, n.e].forEach(function (x) { names(x, out); });
    (n.args || []).forEach(function (x) { names(x, out); });
    return out;
  }

  // Come lo vede lo studente: niente 0.30000000000000004, niente -0.
  function format(v) {
    if (typeof v === 'boolean') return L.bool[v ? 0 : 1];
    if (typeof v === 'number') {
      if (!isFinite(v)) return String(v);
      const r = Math.round(v * 1e6) / 1e6;
      return String(Object.is(r, -0) ? 0 : r);
    }
    return v;
  }

  function isName(s) {
    return /^[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*$/.test(s);
  }
  function isReserved(s) {
    const k = s.toLowerCase();
    return k in L.words || k in L.funcs;
  }

  return { parse: parse, parseList: parseList, evaluate: evaluate, names: names, format: format, isName: isName, isReserved: isReserved, setLocale: setLocale };
});

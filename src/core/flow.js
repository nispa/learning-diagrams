// Il diagramma come dato: una lista di blocchi, alcuni dei quali contengono altre liste.
// Nei livelli e nel salvataggio si usa la forma compatta ad array:
//   ['leggi', 'n']                     ['scrivi', '"Somma:", s']       ['assegna', 's', 'a + b']
//   ['se', 'n > 0', [sì...], [no...]]   ['mentre', 'i <= n', [corpo]]   ['ripeti', [corpo], 'x < 0']
//   ['per', 'i', '1', 'n', [corpo], 'passo facoltativo']
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./expr.js'));
  else root.Flow = factory(root.Expr);
})(this, function (Expr) {
  'use strict';

  const TYPES = ['leggi', 'scrivi', 'assegna', 'se', 'mentre', 'ripeti', 'per'];
  // I campi di testo di ogni blocco, nell'ordine in cui compaiono.
  const FIELDS = {
    leggi: ['v'], scrivi: ['e'], assegna: ['v', 'e'], se: ['c'], mentre: ['c'], ripeti: ['c'], per: ['v', 'from', 'to', 'step'],
  };
  const LISTS = ['yes', 'no', 'body'];

  let seq = 0;
  function one(a) {
    const id = 'b' + (++seq), s = function (x) { return x === undefined ? '' : String(x); };
    switch (a[0]) {
      case 'leggi': return { t: 'leggi', id: id, v: s(a[1]) };
      case 'scrivi': return { t: 'scrivi', id: id, e: s(a[1]) };
      case 'assegna': return { t: 'assegna', id: id, v: s(a[1]), e: s(a[2]) };
      case 'se': return { t: 'se', id: id, c: s(a[1]), yes: fromArray(a[2]), no: fromArray(a[3]) };
      case 'mentre': return { t: 'mentre', id: id, c: s(a[1]), body: fromArray(a[2]) };
      case 'ripeti': return { t: 'ripeti', id: id, body: fromArray(a[1]), c: s(a[2]) };
      case 'per': return { t: 'per', id: id, v: s(a[1]), from: s(a[2]), to: s(a[3]), body: fromArray(a[4]), step: s(a[5]) };
    }
    throw new Error('Blocco sconosciuto: ' + a[0]);
  }
  function fromArray(arr) { return (arr || []).map(one); }

  function toArray(list) {
    return list.map(function (b) {
      switch (b.t) {
        case 'leggi': return ['leggi', b.v];
        case 'scrivi': return ['scrivi', b.e];
        case 'assegna': return ['assegna', b.v, b.e];
        case 'se': return ['se', b.c, toArray(b.yes), toArray(b.no)];
        case 'mentre': return ['mentre', b.c, toArray(b.body)];
        case 'ripeti': return ['ripeti', toArray(b.body), b.c];
        case 'per': return b.step.trim() ? ['per', b.v, b.from, b.to, toArray(b.body), b.step] : ['per', b.v, b.from, b.to, toArray(b.body)];
      }
    });
  }

  function walk(list, fn) {
    list.forEach(function (b) {
      fn(b);
      LISTS.forEach(function (k) { if (b[k]) walk(b[k], fn); });
    });
  }

  function count(list, types) {
    types = [].concat(types);
    let n = 0;
    walk(list, function (b) { if (!types.length || types.indexOf(b.t) >= 0) n++; });
    return n;
  }

  // Quali variabili compaiono, quali sono lette con Leggi e quali finiscono in un Scrivi:
  // serve a controllare la tabella delle variabili.
  function usage(list) {
    const all = new Set(), read = new Set(), printed = new Set();
    const add = function (src, set, isList) {
      try {
        const asts = isList ? Expr.parseList(src) : [Expr.parse(src)];
        asts.forEach(function (a) { Expr.names(a).forEach(function (n) { all.add(n); if (set) set.add(n); }); });
      } catch (e) { /* un campo scritto male lo segnala già l'interprete */ }
    };
    walk(list, function (b) {
      if (b.t === 'leggi' && b.v.trim()) { all.add(b.v.trim()); read.add(b.v.trim()); }
      if (b.t === 'scrivi') add(b.e, printed, true);
      if (b.t === 'assegna') { if (b.v.trim()) all.add(b.v.trim()); add(b.e); }
      if (b.c !== undefined) add(b.c);
      if (b.t === 'per') { if (b.v.trim()) all.add(b.v.trim()); add(b.from); add(b.to); if (b.step.trim()) add(b.step); }
    });
    return { all: all, read: read, printed: printed };
  }

  return { TYPES: TYPES, FIELDS: FIELDS, LISTS: LISTS, fromArray: fromArray, toArray: toArray, blank: function (t) { return one([t]); }, walk: walk, count: count, usage: usage };
});

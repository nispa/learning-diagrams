// Funzioni piccole usate ovunque: traduzione dei messaggi, escape dell'HTML, markdown minimo.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../i18n/it.js'));
  else root.Util = factory(root.I18N);
})(this, function (I18N) {
  'use strict';

  let locale = 'it';

  // Un valore può essere a sua volta [chiave, valori]: si traduce in modo ricorsivo.
  function t(key, vals) {
    vals = vals || {};
    let s = (I18N[locale] && I18N[locale][key]);
    if (s === undefined) s = I18N.it[key];
    if (s === undefined) return key;
    if (typeof s === 'object') s = new Intl.PluralRules(locale).select(vals.n) === 'one' ? s.one : s.other;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      let v = vals[k];
      if (Array.isArray(v)) v = v.length ? t(v[0], v[1]) : '';
      return v === undefined || v === null ? '' : String(v);
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Solo `codice`, **grassetto**, a capo e paragrafi: basta per consegne e messaggi.
  function md(s) {
    return esc(s).split(/\n{2,}/).map(function (p) {
      return '<p>' + p
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  // Confronto tollerante delle righe stampate: spazi, maiuscole e "7" contro "7.0".
  function norm(s) {
    s = String(s).trim().replace(/\s+/g, ' ').toLowerCase();
    const n = s.replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(n)) return String(Number(n));
    return s;
  }

  function distance(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) d[i] = [i];
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  // Il nome più simile tra quelli noti, se è abbastanza vicino da essere un errore di battitura.
  function suggest(name, list) {
    let best = null, bd = Infinity;
    list.forEach(function (c) {
      if (c === name) return;
      const dd = c.toLowerCase() === name.toLowerCase() ? 0.5 : distance(c, name);
      if (dd < bd) { bd = dd; best = c; }
    });
    return bd <= (name.length <= 3 ? 1 : 2) ? best : null;
  }

  return { t: t, esc: esc, md: md, norm: norm, suggest: suggest };
});

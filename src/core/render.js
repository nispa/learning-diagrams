// Disegna il diagramma di flusso in SVG con i simboli della norma ISO 5807 usati a scuola:
// ovale (inizio/fine), parallelogramma (leggi/scrivi), rettangolo (elaborazione), rombo (decisione).
// Ogni struttura si dispone su un asse centrale: una disposizione restituisce
// { l, r, h } (ingombro a sinistra e a destra dell'asse, altezza) e draw(cx, y).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./util.js'));
  else root.Render = factory(root.Util);
})(this, function (Util) {
  'use strict';

  const FS = 13, CW = FS * 0.62, LH = 17, GAP = 24, WRAP = 26;
  const t = Util.t;
  let uid = 0, cur = {};

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  const show = function (s) { s = String(s).trim(); return s || '…'; };
  const r1 = function (n) { return Math.round(n * 10) / 10; };

  function wrap(text) {
    const lines = [];
    let line = '';
    String(text).split(' ').forEach(function (w) {
      while (w.length > WRAP) { if (line) { lines.push(line); line = ''; } lines.push(w.slice(0, WRAP)); w = w.slice(WRAP); }
      if (!line) line = w;
      else if ((line + ' ' + w).length <= WRAP) line += ' ' + w;
      else { lines.push(line); line = w; }
    });
    if (line || !lines.length) lines.push(line);
    return lines;
  }

  function path(pts, arrow) {
    return '<path class="fc-ln" d="M' + pts.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join(' L') + '"' +
      (arrow ? ' marker-end="url(#' + cur.mk + ')"' : '') + '/>';
  }
  function label(text, x, y, anchor) {
    return '<text class="fc-lb" x="' + r1(x) + '" y="' + r1(y) + '" text-anchor="' + anchor + '">' + text + '</text>';
  }
  function dot(x, y) { return '<circle class="fc-dot" cx="' + r1(x) + '" cy="' + r1(y) + '" r="3.5"/>'; }

  function node(kind, text, id) {
    const lines = wrap(text);
    const tw = Math.max.apply(null, lines.map(function (l) { return l.length; })) * CW, th = lines.length * LH;
    let w, h;
    if (kind === 'term') { w = Math.max(96, tw + 44); h = 38; }
    else if (kind === 'io') { w = Math.max(116, tw + 56); h = th + 22; }
    else if (kind === 'proc') { w = Math.max(104, tw + 30); h = th + 22; }
    else { h = Math.max(56, th * 2 + 20); w = Math.max(120, 2 * (tw / 2 + 12) / (1 - (th / 2 + 6) / (h / 2))); }
    return {
      l: w / 2, r: w / 2, h: h, w: w,
      draw: function (cx, y) {
        const x = cx - w / 2;
        let shape;
        if (kind === 'term') shape = '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + h + '" rx="' + h / 2 + '"/>';
        else if (kind === 'proc') shape = '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + h + '" rx="2"/>';
        else if (kind === 'io') {
          const k = 14;
          shape = '<polygon points="' + [[x + k, y], [x + w, y], [x + w - k, y + h], [x, y + h]].map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') + '"/>';
        } else {
          shape = '<polygon points="' + [[cx, y], [cx + w / 2, y + h / 2], [cx, y + h], [cx - w / 2, y + h / 2]].map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') + '"/>';
        }
        const cy = y + h / 2, y0 = cy - (lines.length - 1) * LH / 2;
        const tx = '<text class="fc-tx" x="' + r1(cx) + '" y="' + r1(y0) + '" text-anchor="middle" dominant-baseline="central">' +
          lines.map(function (l, i) { return '<tspan x="' + r1(cx) + '"' + (i ? ' dy="' + LH + '"' : '') + '>' + esc(l) + '</tspan>'; }).join('') + '</text>';
        let cls = 'fc-n fc-' + kind;
        if (id && id === cur.active) cls += ' is-on';
        if (id && id === cur.error) cls += ' is-err';
        return '<g class="' + cls + '"' + (id ? ' data-id="' + id + '"' : '') + '>' + shape + tx + '</g>';
      },
    };
  }

  function seq(items) {
    items = items.filter(Boolean);
    if (!items.length) return { l: 0, r: 0, h: 0, empty: true, draw: function () { return ''; } };
    return {
      l: Math.max.apply(null, items.map(function (i) { return i.l; })),
      r: Math.max.apply(null, items.map(function (i) { return i.r; })),
      h: items.reduce(function (s, i) { return s + i.h; }, 0) + GAP * (items.length - 1),
      join: items[0].join,
      draw: function (cx, y) {
        let s = '';
        items.forEach(function (it, k) {
          s += it.draw(cx, y);
          y += it.h;
          // un ciclo comincia con un punto di raccordo: la freccia ci arriva già dal ritorno del ciclo
          if (k < items.length - 1) { s += path([[cx, y], [cx, y + GAP]], !items[k + 1].join); y += GAP; }
        });
        return s;
      },
    };
  }

  function ifLayout(b) {
    const d = node('dec', show(b.c), b.id), T = seq(b.yes.map(block)), E = seq(b.no.map(block));
    const tx = Math.max(d.w / 2 + 16, T.l + 20), ex = Math.max(d.w / 2 + 16, E.r + 20);
    const top = d.h + 20, h = top + Math.max(T.h, E.h) + 22;
    return {
      l: Math.max(d.w / 2, ex + E.l, ex + 4), r: Math.max(d.w / 2, tx + T.r, tx + 4), h: h,
      draw: function (cx, y) {
        const my = y + d.h / 2, by = y + top, end = y + h;
        let s = d.draw(cx, y);
        [[T, cx + tx, cx + d.w / 2], [E, cx - ex, cx - d.w / 2]].forEach(function (br) {
          const B = br[0], x = br[1];
          if (B.empty) { s += path([[br[2], my], [x, my], [x, end], [cx, end]]); return; }
          s += path([[br[2], my], [x, my], [x, by]], !B.join);
          s += B.draw(x, by);
          s += path([[x, by + B.h], [x, end], [cx, end]]);
        });
        s += label(esc(t('draw.yes')), cx + d.w / 2 + 6, my - 7, 'start') + label(esc(t('draw.no')), cx - d.w / 2 - 6, my - 7, 'end');
        return s + dot(cx, end);
      },
    };
  }

  // Ciclo con la condizione in testa (Mentre, Per): V entra nel corpo, F esce a destra.
  function whileLayout(d, B) {
    const L = Math.max(d.w / 2, B.l) + 22, R = Math.max(d.w / 2, B.r) + 22;
    const dy = 26, by = dy + d.h + 24, back = by + B.h + (B.empty ? 0 : 16), h = back + 20;
    return {
      l: L + 2, r: R + 2, h: h, join: true,
      draw: function (cx, y) {
        const jy = y + 9, my = y + dy + d.h / 2;
        let s = path([[cx, y], [cx, y + dy]], true) + d.draw(cx, y + dy);
        if (B.empty) s += path([[cx, y + dy + d.h], [cx, y + back], [cx - L, y + back], [cx - L, jy], [cx, jy]], true);
        else {
          s += path([[cx, y + dy + d.h], [cx, y + by]], !B.join) + B.draw(cx, y + by);
          s += path([[cx, y + by + B.h], [cx, y + back], [cx - L, y + back], [cx - L, jy], [cx, jy]], true);
        }
        s += label(esc(t('draw.yes')), cx + 7, y + dy + d.h + 15, 'start');
        s += path([[cx + d.w / 2, my], [cx + R, my], [cx + R, y + h], [cx, y + h]]);
        s += label(esc(t('draw.no')), cx + d.w / 2 + 6, my - 7, 'start');
        return s + dot(cx, y + h);
      },
    };
  }

  // Ciclo con la condizione in fondo (Ripeti … mentre): il corpo si esegue almeno una volta.
  function repeatLayout(B, d) {
    const L = Math.max(d.w / 2, B.l) + 22;
    const dy = 26, dTop = B.empty ? dy : dy + B.h + 24, h = dTop + d.h + 20;
    return {
      l: L + 2, r: Math.max(d.w / 2, B.r) + 2, h: h, join: true,
      draw: function (cx, y) {
        const jy = y + 9;
        let s;
        if (B.empty) s = path([[cx, y], [cx, y + dTop]], true);
        else s = path([[cx, y], [cx, y + dy]], !B.join) + B.draw(cx, y + dy) + path([[cx, y + dy + B.h], [cx, y + dTop]], true);
        s += d.draw(cx, y + dTop);
        const my = y + dTop + d.h / 2;
        s += path([[cx - d.w / 2, my], [cx - L, my], [cx - L, jy], [cx, jy]], true);
        s += label(esc(t('draw.yes')), cx - d.w / 2 - 6, my - 7, 'end');
        s += path([[cx, y + dTop + d.h], [cx, y + h]]);
        s += label(esc(t('draw.no')), cx + 7, y + dTop + d.h + 15, 'start');
        return s;
      },
    };
  }

  function block(b) {
    switch (b.t) {
      case 'leggi': return node('io', t('blk.leggi') + ' ' + show(b.v), b.id);
      case 'scrivi': return node('io', t('blk.scrivi') + ' ' + show(b.e), b.id);
      case 'assegna': return node('proc', show(b.v) + ' ← ' + show(b.e), b.id);
      case 'se': return ifLayout(b);
      case 'mentre': return whileLayout(node('dec', show(b.c), b.id), seq(b.body.map(block)));
      case 'ripeti': return repeatLayout(seq(b.body.map(block)), node('dec', show(b.c), b.id));
      case 'per': {
        // Il Per si disegna com'è davvero: inizializza, controlla, esegue, incrementa.
        const step = b.step.trim() || '1', neg = /^-/.test(step), v = show(b.v);
        const inc = neg ? v + ' ← ' + v + ' - ' + step.replace(/^-\s*/, '') : v + ' ← ' + v + ' + ' + step;
        return seq([
          node('proc', v + ' ← ' + show(b.from), b.id),
          whileLayout(node('dec', v + (neg ? ' ≥ ' : ' ≤ ') + show(b.to), b.id), seq(b.body.map(block).concat(node('proc', inc, b.id)))),
        ]);
      }
    }
  }

  function render(list, opts) {
    opts = opts || {};
    cur = { active: opts.active, error: opts.error, mk: 'fc-ah-' + (++uid) };
    const L = seq([node('term', t('draw.start'))].concat(list.map(block), [node('term', t('draw.end'))]));
    const pad = 18, W = Math.ceil(L.l + L.r + pad * 2), H = Math.ceil(L.h + pad * 2);
    return '<svg class="fc" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"' +
      ' role="img" aria-label="' + esc(opts.label || t('draw.label')) + '">' +
      '<defs><marker id="' + cur.mk + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">' +
      '<path class="fc-ah" d="M0,0 L10,5 L0,10 z"/></marker></defs>' +
      L.draw(pad + L.l, pad) + '</svg>';
  }

  return { render: render };
});

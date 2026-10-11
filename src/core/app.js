// L'interfaccia: elenco dei livelli, domande, editor a blocchi, disegno, esecuzione, verifica.
// Ogni testo che arriva da livelli, traduzioni o diagramma passa da esc() o md() prima di innerHTML.
(function () {
  'use strict';

  const U = window.Util, t = U.t, esc = U.esc, md = U.md;
  const Flow = window.Flow, Expr = window.Expr, Render = window.Render;
  const Interpreter = window.Interpreter, Checker = window.Checker;
  const KEY = 'diagrammi-passo-passo-v1'; // non cambiarla: dentro ci sono i progressi degli studenti
  const $ = function (id) { return document.getElementById(id); };
  const inl = function (s) { return md(s).replace(/^<p>|<\/p>$/g, ''); };
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- salvataggio ----------
  let store = { done: {}, prog: {}, an: {}, inp: {}, quiz: {}, cur: null, theme: 'auto', size: 1 };
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') store = Object.assign(store, s);
  } catch (e) { /* storage non disponibile: si lavora senza salvare */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* idem */ } }

  // ---------- lingua ----------
  // Ogni lingua ha i suoi livelli, con gli stessi id: i livelli superati valgono in tutte.
  // Il lavoro in corso invece è per lingua (variabili, testi e parole chiave cambiano);
  // l'italiano usa le chiavi di prima, così non si perde niente di quello già salvato.
  let locale = 'it', CHAPTERS = [], ALL = [];
  const wk = function (id) { return locale === 'it' ? id : locale + ':' + id; };
  function pickLocale() {
    let param = null;
    try { param = new URLSearchParams(location.search).get('locale'); } catch (e) { /* niente parametri */ }
    // chi aveva già dei progressi li ha fatti in italiano, prima che ci fosse la scelta
    const old = Object.keys(store.done).length ? 'it' : null;
    const wanted = [param, store.locale, old].concat(navigator.languages || [navigator.language]);
    return wanted.map(function (l) { return l && String(l).toLowerCase().split('-')[0]; })
      .find(function (l) { return l && window.I18N[l] && window.LEVELS[l]; }) || 'en';
  }
  function setLocale(l) {
    locale = l;
    U.setLocale(l);
    Expr.setLocale(l);
    CHAPTERS = window.LEVELS[l];
    ALL = [];
    CHAPTERS.forEach(function (ch, ci) { ch.levels.forEach(function (lv) { ALL.push({ lv: lv, ch: ch, ci: ci }); }); });
    document.documentElement.lang = l;
    document.title = t('app.brand1') + ' ' + t('app.brand2');
    document.querySelector('meta[name="description"]').setAttribute('content', t('app.description'));
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    $('locale').value = l;
  }

  const S = { i: 0, prog: [], an: [], insertAt: null, history: [], pending: null, trace: null, ti: 0, err: null, active: null };
  const cur = function () { return ALL[S.i]; };
  const palette = function () { return cur().lv.palette || cur().ch.palette || Flow.TYPES; };

  // ---------- livelli ----------
  function go(i, focus) {
    S.i = Math.max(0, Math.min(ALL.length - 1, i));
    const c = cur(), lv = c.lv;
    store.cur = lv.id; save();
    try { history.replaceState(null, '', '#' + lv.id); } catch (e) { /* in alcuni contesti non si può */ }
    Object.assign(S, { insertAt: null, history: [], pending: null, trace: null, err: null, active: null });
    $('lvEyebrow').textContent = t('ui.chapter', { n: c.ci + 1, title: c.ch.title });
    $('lvTitle').textContent = lv.title;
    $('lvLearn').hidden = !lv.learn;
    $('lvLearn').innerHTML = lv.learn ? '<h2>' + esc(t('ui.learn')) + '</h2>' + md(lv.learn) : '';
    $('lvTask').innerHTML = md(lv.task);
    $('lvHint').hidden = !lv.hint;
    $('lvHint').open = false;
    $('lvHintBody').innerHTML = lv.hint ? md(lv.hint) : '';
    $('done').hidden = true;
    $('quiz').hidden = lv.kind !== 'quiz';
    $('build').hidden = lv.kind === 'quiz';
    if (lv.kind === 'quiz') renderQuiz(); else loadBuild();
    $('btnPrev').disabled = S.i === 0;
    $('btnNext').disabled = S.i === ALL.length - 1;
    renderNav();
    renderProgress();
    closeNav();
    window.scrollTo(0, 0);
    if (focus) $('lvTitle').focus();
  }

  function renderNav() {
    let h = '';
    CHAPTERS.forEach(function (ch, ci) {
      const n = ch.levels.filter(function (lv) { return store.done[lv.id]; }).length;
      h += '<section class="nav-ch"><h2><span class="num">' + (ci + 1) + '</span><span>' + esc(ch.title) + '</span><span class="cnt">' + n + '/' + ch.levels.length + '</span></h2><ol>';
      ch.levels.forEach(function (lv) {
        const k = ALL.findIndex(function (x) { return x.lv === lv; }), isCur = k === S.i, done = !!store.done[lv.id];
        h += '<li><a href="#' + esc(lv.id) + '" data-k="' + k + '" class="' + (isCur ? 'cur ' : '') + (done ? 'done' : '') + '"' + (isCur ? ' aria-current="page"' : '') + '>' +
          '<span class="st" aria-hidden="true">' + (done ? '✓' : '') + '</span>' +
          '<span class="nm">' + esc(lv.title) + (done ? '<span class="sr"> (' + esc(t('ui.done')) + ')</span>' : '') + '</span>' +
          (lv.kind === 'quiz' ? '<span class="kind">' + esc(t('ui.kind.quiz')) + '</span>' : '') + '</a></li>';
      });
      h += '</ol></section>';
    });
    $('nav').innerHTML = h;
  }

  function renderProgress() {
    const done = ALL.filter(function (x) { return store.done[x.lv.id]; }).length;
    $('progress').innerHTML = '<span>' + esc(t('ui.progress', { done: done, total: ALL.length })) + '</span>' +
      '<span class="bar" aria-hidden="true"><span style="width:' + Math.round(done / ALL.length * 100) + '%"></span></span>';
  }

  function openNav() { document.body.classList.add('nav-open'); $('navBack').hidden = false; $('btnLevels').setAttribute('aria-expanded', 'true'); const a = $('nav').querySelector('a.cur'); if (a) a.focus(); }
  function closeNav() { if (!document.body.classList.contains('nav-open')) return; document.body.classList.remove('nav-open'); $('navBack').hidden = true; $('btnLevels').setAttribute('aria-expanded', 'false'); }

  function passed(msg) {
    const lv = cur().lv;
    store.done[lv.id] = true;
    save();
    renderNav();
    renderProgress();
    const last = S.i === ALL.length - 1;
    $('done').innerHTML = '<div class="stamp" aria-hidden="true">✓</div><div><h2>' + esc(t('ui.passed')) + '</h2>' +
      (msg ? '<p>' + esc(msg) + '</p>' : '') +
      (last ? '<p>' + esc(t('ui.allDone')) + '</p>' : '<button class="btn primary" type="button" id="btnGoNext">' + esc(t('ui.nextLevel')) + ' →</button>') + '</div>';
    $('done').hidden = false;
    $('done').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    const b = $('btnGoNext');
    if (b) { b.addEventListener('click', function () { go(S.i + 1, true); }); b.focus({ preventScroll: true }); }
  }

  // ---------- domande ----------
  function renderQuiz() {
    const lv = cur().lv, ans = store.quiz[wk(lv.id)] || {};
    let h = '';
    if (lv.show) h += '<figure class="figure paper"><div class="diagram">' + Render.render(Flow.fromArray(lv.show)) + '</div></figure>';
    h += '<form id="quizForm" class="quiz" novalidate>';
    lv.questions.forEach(function (q, k) {
      h += '<fieldset class="q" id="q' + k + '"><legend><span class="qn">' + (k + 1) + '</span>' + inl(q.q) + '</legend>';
      if (q.options) {
        q.options.forEach(function (o, j) {
          h += '<label class="opt"><input type="radio" name="q' + k + '" value="' + j + '"' + (ans[k] === j ? ' checked' : '') + '><span>' + inl(o) + '</span></label>';
        });
      } else {
        h += '<label class="txt"><span class="sr">' + esc(t('ui.yourAnswer')) + '</span><input type="text" name="q' + k + '" value="' + esc(ans[k] || '') + '" placeholder="' + esc(t('ui.yourAnswer')) + '" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text"></label>';
      }
      h += '<div class="fb" id="fb' + k + '"></div></fieldset>';
    });
    h += '<button class="btn primary" type="submit">' + esc(t('ui.checkAnswers')) + '</button></form>';
    $('quiz').innerHTML = h;
    const form = $('quizForm');
    form.addEventListener('submit', function (e) { e.preventDefault(); checkQuiz(); });
    form.addEventListener('input', function () { store.quiz[wk(lv.id)] = readQuiz(); save(); });
  }

  function readQuiz() {
    const lv = cur().lv, form = $('quizForm'), ans = {};
    lv.questions.forEach(function (q, k) {
      if (q.options) {
        const c = form.querySelector('input[name="q' + k + '"]:checked');
        if (c) ans[k] = Number(c.value);
      } else ans[k] = form.elements['q' + k].value;
    });
    return ans;
  }

  function checkQuiz() {
    const lv = cur().lv, ans = readQuiz();
    store.quiz[wk(lv.id)] = ans;
    let all = true, first = null;
    lv.questions.forEach(function (q, k) {
      const given = ans[k], missing = given === undefined || String(given).trim() === '';
      const ok = !missing && Checker.checkAnswer(q, given);
      all = all && ok;
      if (!ok && first === null) first = k;
      $('q' + k).classList.toggle('ok', ok);
      $('q' + k).classList.toggle('no', !ok && !missing);
      $('fb' + k).innerHTML = missing ? '<p>' + esc(t('ui.answerMissing')) + '</p>'
        : ok ? '<p><strong>' + esc(t('ui.answerOk')) + '</strong> ' + inl(q.why) + '</p>'
        : '<p>' + esc(t('ui.answerNo')) + '</p>';
    });
    save();
    if (all) passed(t('ui.passedQuiz'));
    else {
      const f = $('q' + first).querySelector('input');
      if (f) f.focus();
    }
  }

  // ---------- diagramma da costruire ----------
  function loadBuild() {
    const lv = cur().lv;
    S.prog = Flow.fromArray(store.prog[wk(lv.id)] || lv.start || []);
    S.an = (store.an[wk(lv.id)] || []).map(function (r) { return Object.assign({}, r); });
    $('inputs').value = store.inp[wk(lv.id)] !== undefined ? store.inp[wk(lv.id)] : lv.tests[0].input.join('\n');
    $('analysis').hidden = !lv.analysis;
    if (lv.analysis) renderAnalysis();
    renderEditor();
    renderDiagram();
    $('console').innerHTML = '';
    armReset(false);
    $('btnUndo').disabled = true;
  }

  function persist() {
    store.prog[wk(cur().lv.id)] = Flow.toArray(S.prog);
    save();
  }

  function listAt(path) {
    let l = S.prog;
    if (!path) return l;
    const seg = path.split('.');
    for (let k = 0; k < seg.length; k += 2) l = l[Number(seg[k])][seg[k + 1]];
    return l;
  }

  function snapshot() { return JSON.stringify(Flow.toArray(S.prog)); }
  function pushHistory(snap) {
    S.history.push(snap || snapshot());
    if (S.history.length > 60) S.history.shift();
    $('btnUndo').disabled = false;
  }
  function undo() {
    if (!S.history.length) return;
    S.prog = Flow.fromArray(JSON.parse(S.history.pop()));
    $('btnUndo').disabled = !S.history.length;
    changed(true);
  }

  function changed(structural) {
    S.trace = null; S.err = null; S.active = null;
    persist();
    if (structural) { renderEditor(); renderDiagram(); } else scheduleDiagram();
    const c = $('console');
    if (c.firstChild) c.classList.add('stale');
  }

  const GLYPH = {
    io: '<polygon points="5,2 19,2 15,14 1,14"/>',
    proc: '<rect x="2" y="2.5" width="16" height="11" rx="1"/>',
    dec: '<polygon points="10,1 19,8 10,15 1,8"/>',
  };
  const SHAPE = { leggi: 'io', scrivi: 'io', assegna: 'proc', se: 'dec', mentre: 'dec', ripeti: 'dec', per: 'dec' };
  function glyph(type) {
    return '<svg class="glyph g-' + SHAPE[type] + '" viewBox="0 0 20 16" width="20" height="16" aria-hidden="true">' + GLYPH[SHAPE[type]] + '</svg>';
  }

  function field(b, f, path, i, ph, aria, min) {
    const v = b[f];
    return '<input class="fld f-' + f + '" type="text" data-path="' + path + '" data-i="' + i + '" data-f="' + f + '" data-min="' + min + '"' +
      ' value="' + esc(v) + '" placeholder="' + esc(ph) + '" aria-label="' + esc(aria) + '" size="' + Math.max(min, v.length + 1) + '"' +
      ' spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" enterkeyhint="done">';
  }

  function tools(path, i, len) {
    const b = function (act, label, sym, off) {
      return '<button type="button" class="tool" data-act="' + act + '" data-path="' + path + '" data-i="' + i + '" aria-label="' + esc(t(label)) + '"' + (off ? ' disabled' : '') + '>' + sym + '</button>';
    };
    return '<span class="tools">' + b('up', 'ui.moveUp', '↑', i === 0) + b('down', 'ui.moveDown', '↓', i === len - 1) + b('del', 'ui.delete', '×') + '</span>';
  }

  function blockHTML(b, path, i, len) {
    const sub = function (k) { return (path === '' ? '' : path + '.') + i + '.' + k; };
    const kw = function (k) { return '<span class="kw">' + esc(t(k)) + '</span>'; };
    const F = function (f, ph, aria, min) { return field(b, f, path, i, t(ph), t(aria), min); };
    const head = function (inner) { return '<div class="row">' + glyph(b.t) + '<span class="row-main">' + inner + '</span>' + tools(path, i, len) + '</div>'; };
    const foot = function (inner) { return '<div class="row foot"><span class="row-main">' + inner + '</span></div>'; };
    const branch = function (label, list, p, cls) {
      return '<div class="br ' + (cls || '') + '">' + (label ? '<div class="br-lb">' + esc(t(label)) + '</div>' : '') + '<div class="sub">' + listHTML(list, p) + '</div></div>';
    };
    let h = '<div class="blk t-' + b.t + (S.err === b.id ? ' is-err' : '') + (S.active === b.id ? ' is-on' : '') + '" data-id="' + b.id + '">';
    switch (b.t) {
      case 'leggi': h += head(kw('blk.leggi') + F('v', 'ph.var', 'aria.v', 8)); break;
      case 'scrivi': h += head(kw('blk.scrivi') + F('e', 'ph.write', 'aria.write', 16)); break;
      case 'assegna': h += head(F('v', 'ph.var', 'aria.v', 6) + '<span class="arrow" aria-hidden="true">←</span>' + F('e', 'ph.expr', 'aria.e', 10)); break;
      case 'se':
        h += head(kw('blk.se') + F('c', 'ph.cond', 'aria.c', 10) + kw('blk.then')) +
          branch('blk.yes', b.yes, sub('yes'), 'yes') + branch('blk.no', b.no, sub('no'), 'no') + foot(kw('blk.endIf'));
        break;
      case 'mentre':
        h += head(kw('blk.mentre') + F('c', 'ph.cond', 'aria.c', 10) + kw('blk.do')) + branch(null, b.body, sub('body')) + foot(kw('blk.endWhile'));
        break;
      case 'ripeti':
        h += head(kw('blk.ripeti')) + branch(null, b.body, sub('body')) + foot(kw('blk.while') + F('c', 'ph.cond', 'aria.c', 10));
        break;
      case 'per':
        h += head(kw('blk.per') + F('v', 'ph.var', 'aria.v', 3) + kw('blk.from') + F('from', 'ph.expr', 'aria.from', 3) +
          kw('blk.to') + F('to', 'ph.expr', 'aria.to', 3) + kw('blk.step') + field(b, 'step', path, i, '1', t('aria.step'), 3)) +
          branch(null, b.body, sub('body')) + foot(kw('blk.endFor'));
        break;
    }
    return h + '</div>';
  }

  function insHTML(path, i) {
    if (S.insertAt && S.insertAt.path === path && S.insertAt.i === i) {
      return '<div class="menu" role="group" aria-label="' + esc(t('ui.chooseBlock')) + '">' + palette().map(function (tp) {
        return '<button type="button" class="menu-it" data-act="add" data-t="' + tp + '" data-path="' + path + '" data-i="' + i + '">' + glyph(tp) +
          '<span><strong>' + esc(t('blk.' + tp)) + '</strong><small>' + esc(t('blk.desc.' + tp)) + '</small></span></button>';
      }).join('') + '<button type="button" class="menu-x" data-act="cancel">' + esc(t('ui.cancel')) + '</button></div>';
    }
    return '<button type="button" class="ins" data-act="ins" data-path="' + path + '" data-i="' + i + '" aria-label="' + esc(t('ui.addHere')) + '"><span aria-hidden="true">+</span></button>';
  }

  function listHTML(list, path) {
    let h = insHTML(path, 0);
    list.forEach(function (b, i) { h += blockHTML(b, path, i, list.length) + insHTML(path, i + 1); });
    return h;
  }

  function renderEditor() {
    $('blocks').innerHTML = listHTML(S.prog, '');
  }

  function markEditor() {
    $('blocks').querySelectorAll('.blk').forEach(function (el) {
      el.classList.toggle('is-err', el.dataset.id === S.err);
      el.classList.toggle('is-on', el.dataset.id === S.active);
    });
  }

  function focusBlock(id) {
    const el = $('blocks').querySelector('.blk[data-id="' + id + '"]');
    if (!el) return;
    const f = el.querySelector('.fld') || el.querySelector('button');
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    if (f) f.focus({ preventScroll: true });
    el.classList.remove('flash');
    void el.offsetWidth; // riavvia l'animazione
    el.classList.add('flash');
  }

  function focusAt(sel) {
    const el = $('blocks').querySelector(sel);
    if (el) el.focus();
  }

  let dTimer = null;
  function scheduleDiagram() { clearTimeout(dTimer); dTimer = setTimeout(renderDiagram, 120); }
  function renderDiagram() {
    clearTimeout(dTimer);
    $('diagram').innerHTML = Render.render(S.prog, { active: S.active, error: S.err });
    const on = $('diagram').querySelector('.is-on, .is-err');
    if (on && S.trace) {
      // nella traccia il blocco corrente deve restare visibile
      const box = $('diagram'), r = on.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - b.height / 3;
    }
  }

  function setTab(tab) {
    $('work').dataset.tab = tab;
    $('tabBlocks').setAttribute('aria-selected', String(tab === 'blocks'));
    $('tabDiagram').setAttribute('aria-selected', String(tab === 'diagram'));
  }

  // ---------- tabella delle variabili ----------
  function renderAnalysis() {
    if (!S.an.length) S.an.push({ name: '', role: '', desc: '' });
    const roles = ['in', 'out', 'work'];
    let h = '<h2 id="anTitle">' + esc(t('ui.analysis')) + '</h2><p class="muted">' + esc(t('ui.analysisHelp')) + '</p>' +
      '<div class="an" role="table" aria-labelledby="anTitle"><div class="an-row an-head" role="row">' +
      '<span role="columnheader">' + esc(t('ui.anName')) + '</span><span role="columnheader">' + esc(t('ui.anRole')) + '</span><span role="columnheader">' + esc(t('ui.anDesc')) + '</span><span></span></div>';
    S.an.forEach(function (r, k) {
      h += '<div class="an-row" role="row">' +
        '<span role="cell"><input class="fld" data-an-f="name" data-k="' + k + '" value="' + esc(r.name || '') + '" placeholder="' + esc(t('ui.anName')) + '" aria-label="' + esc(t('ui.anName')) + '" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"></span>' +
        '<span role="cell"><select data-an-f="role" data-k="' + k + '" aria-label="' + esc(t('ui.anRole')) + '"><option value="">' + esc(t('ui.roleNone')) + '</option>' +
        roles.map(function (ro) { return '<option value="' + ro + '"' + (r.role === ro ? ' selected' : '') + '>' + esc(t('ui.role.' + ro)) + '</option>'; }).join('') + '</select></span>' +
        '<span role="cell"><input data-an-f="desc" data-k="' + k + '" value="' + esc(r.desc || '') + '" placeholder="' + esc(t('ui.anDesc')) + '" aria-label="' + esc(t('ui.anDesc')) + '" autocomplete="off"></span>' +
        '<span role="cell"><button type="button" class="tool" data-an="del" data-k="' + k + '" aria-label="' + esc(t('ui.anRemove', { name: r.name || '' })) + '">×</button></span></div>';
    });
    h += '</div><button type="button" class="btn ghost small" data-an="add">+ ' + esc(t('ui.anAdd')) + '</button>';
    $('analysis').innerHTML = h;
  }

  function saveAnalysis() { store.an[wk(cur().lv.id)] = S.an; save(); }

  // ---------- esecuzione ----------
  function inputs() {
    return $('inputs').value.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
  }

  function showConsole(h) {
    const c = $('console');
    c.classList.remove('stale');
    c.innerHTML = h;
  }

  function outputHTML(lines) {
    return '<div class="out"><div class="out-h">' + esc(t('ui.output')) + '</div>' +
      (lines.length ? '<pre>' + lines.map(esc).join('\n') + '</pre>' : '<p class="muted">' + esc(t('ui.noOutput')) + '</p>') + '</div>';
  }

  function showBtn(id) {
    return id ? '<button type="button" class="btn small" data-show="' + id + '">' + esc(t('ui.showBlock')) + '</button>' : '';
  }

  function errorHTML(body, id) {
    return '<div class="msg err" role="alert"><div class="msg-h">' + esc(t('ui.error')) + '</div>' + body + showBtn(id) + '</div>';
  }

  function run() {
    S.trace = null;
    const res = Interpreter.run(S.prog, { input: inputs() });
    S.err = res.error ? res.error.blockId : null;
    S.active = null;
    renderDiagram();
    markEditor();
    showConsole(res.error ? errorHTML(md(t(res.error.key, res.error.vals)), res.error.blockId) + outputHTML(res.output)
      : outputHTML(res.output) + '<p class="note ok">' + esc(t('ui.runOk')) + '</p>');
  }

  function noteText(n) {
    if (!n) return '';
    if (n.k === 'read') return t('trace.read', { name: n.name, val: Expr.format(n.val) });
    if (n.k === 'write') return t('trace.write', { text: n.text });
    if (n.k === 'set') return t('trace.set', { name: n.name, val: Expr.format(n.val) });
    return t(n.val ? 'trace.true' : 'trace.false', { cond: n.cond });
  }

  function step() {
    S.trace = Interpreter.run(S.prog, { input: inputs(), trace: true });
    S.ti = 0;
    renderTrace();
  }

  function renderTrace() {
    const T = S.trace, n = T.trace.length, i = S.ti, last = i >= n, st = last ? null : T.trace[i];
    S.active = st ? st.id : null;
    S.err = last && T.error ? T.error.blockId : null;
    renderDiagram();
    markEditor();
    const cols = [];
    T.trace.forEach(function (s) { Object.keys(s.vars).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    let rows = '';
    T.trace.slice(0, Math.min(i + 1, n)).forEach(function (s, k) {
      const prev = k ? T.trace[k - 1].vars : {};
      rows += '<tr' + (k === i ? ' class="cur"' : '') + '><td class="n">' + (k + 1) + '</td><td class="w">' + inl(noteText(s.note)) + '</td>' +
        cols.map(function (c) {
          const v = s.vars[c], has = c in s.vars;
          return '<td class="v' + (has && (!(c in prev) || prev[c] !== v) ? ' chg' : '') + '">' + (has ? esc(Expr.format(v)) : '') + '</td>';
        }).join('') + '</tr>';
    });
    const outN = st ? st.out : T.output.length;
    let h = '<div class="trace"><div class="trace-bar">' +
      '<button type="button" class="btn small" data-tr="back"' + (i === 0 ? ' disabled' : '') + '>← ' + esc(t('ui.back')) + '</button>' +
      '<span class="trace-pos" aria-live="polite">' + esc(t('ui.stepOf', { i: i + 1, n: n + 1 })) + '</span>' +
      '<button type="button" class="btn small primary" data-tr="fwd"' + (last ? ' disabled' : '') + '>' + esc(t('ui.forward')) + ' →</button>' +
      '<button type="button" class="btn small ghost" data-tr="close">' + esc(t('ui.close')) + '</button></div>';
    h += '<div class="trace-now">' + (st ? md(noteText(st.note)) : T.error ? '' : '<p>' + esc(t('ui.traceEnd')) + '</p>') + '</div>';
    if (last && T.error) h += errorHTML(md(t(T.error.key, T.error.vals)), T.error.blockId);
    if (n) {
      h += '<div class="tt-wrap" tabindex="0" aria-label="' + esc(t('ui.traceTable')) + '"><table class="tt"><caption>' + esc(t('ui.traceTable')) + '</caption><thead><tr><th>' + esc(t('ui.traceStep')) + '</th><th>' + esc(t('ui.traceWhat')) + '</th>' +
        cols.map(function (c) { return '<th class="v"><code>' + esc(c) + '</code></th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    if (n >= Interpreter.LIMITS.trace) h += '<p class="muted">' + esc(t('ui.traceTruncated', { n: n })) + '</p>';
    h += outputHTML(T.output.slice(0, outN)) + '</div>';
    showConsole(h);
    const w = $('console').querySelector('.tt-wrap');
    if (w) w.scrollTop = w.scrollHeight;
  }

  function compareHTML(got, want) {
    const n = Math.max(got.length, want.length);
    let rows = '';
    for (let k = 0; k < n; k++) {
      const g = got[k], w = want[k];
      const bad = g === undefined || w === undefined || U.norm(g) !== U.norm(w);
      rows += '<tr' + (bad ? ' class="diff"' : '') + '><td>' + (g === undefined ? '<span class="muted">' + esc(t('ui.nothing')) + '</span>' : esc(g)) + '</td>' +
        '<td>' + (w === undefined ? '<span class="muted">' + esc(t('ui.nothing')) + '</span>' : esc(w)) + '</td></tr>';
    }
    if (!n) rows = '<tr><td colspan="2" class="muted">' + esc(t('ui.nothing')) + '</td></tr>';
    return '<div class="cmp-wrap"><table class="cmp"><thead><tr><th>' + esc(t('ui.yours')) + '</th><th>' + esc(t('ui.expected')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function check() {
    S.trace = null;
    const lv = cur().lv, r = Checker.check(lv, S.prog, S.an);
    S.err = r.ok ? null : r.fail.blockId || null;
    S.active = null;
    renderDiagram();
    markEditor();
    if (r.ok) {
      showConsole('<p class="note ok">' + esc(t('ui.passed')) + '</p>');
      passed();
      return;
    }
    const f = r.fail;
    let body = f.msg ? md(f.msg) : md(t(f.key, f.vals));
    if (f.key === 'check.wrong') body += compareHTML(f.got, f.test.expect);
    if (f.test && f.test.input.length) body += '<button type="button" class="btn small ghost" data-try="' + esc(JSON.stringify(f.test.input)) + '">' + esc(t('ui.tryThese')) + '</button>';
    showConsole(errorHTML(body, f.blockId));
    if (f.key && f.key.indexOf('an.') === 0) {
      const a = $('analysis').querySelector('input');
      $('analysis').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      if (a && f.key === 'an.empty') a.focus({ preventScroll: true });
    }
  }

  let resetTimer = null;
  function armReset(on) {
    clearTimeout(resetTimer);
    const b = $('btnReset');
    b.dataset.armed = on ? '1' : '';
    b.textContent = t(on ? 'ui.resetConfirm' : 'ui.reset');
    if (on) resetTimer = setTimeout(function () { armReset(false); }, 4000);
  }

  // ---------- eventi ----------
  $('blocks').addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act, path = btn.dataset.path, i = Number(btn.dataset.i);
    if (act === 'ins') {
      S.insertAt = { path: path, i: i };
      renderEditor();
      focusAt('.menu-it');
      return;
    }
    if (act === 'cancel') {
      const at = S.insertAt;
      S.insertAt = null;
      renderEditor();
      focusAt('.ins[data-path="' + at.path + '"][data-i="' + at.i + '"]');
      return;
    }
    const list = listAt(path);
    if (act === 'add') {
      pushHistory();
      const b = Flow.blank(btn.dataset.t);
      list.splice(i, 0, b);
      S.insertAt = null;
      changed(true);
      focusBlock(b.id);
    } else if (act === 'del') {
      pushHistory();
      list.splice(i, 1);
      changed(true);
      focusAt('.ins[data-path="' + path + '"][data-i="' + i + '"]');
    } else if (act === 'up' || act === 'down') {
      const j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      pushHistory();
      const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      changed(true);
      const el = $('blocks').querySelector('.blk[data-id="' + tmp.id + '"] .tool[data-act="' + act + '"]');
      if (el && !el.disabled) el.focus(); else focusBlock(tmp.id);
    }
  });

  $('blocks').addEventListener('focusin', function (e) {
    if (e.target.classList.contains('fld')) S.pending = snapshot();
  });
  $('blocks').addEventListener('input', function (e) {
    const f = e.target;
    if (!f.classList.contains('fld')) return;
    if (S.pending) { pushHistory(S.pending); S.pending = null; }
    listAt(f.dataset.path)[Number(f.dataset.i)][f.dataset.f] = f.value;
    f.size = Math.max(Number(f.dataset.min), f.value.length + 1);
    changed(false);
  });
  $('blocks').addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && S.insertAt) {
      e.preventDefault();
      $('blocks').querySelector('.menu-x').click();
    } else if (e.key === 'Enter' && e.target.classList.contains('fld') && !(e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const all = Array.from($('blocks').querySelectorAll('.fld'));
      const nx = all[all.indexOf(e.target) + 1];
      if (nx) nx.focus(); else e.target.blur();
    }
  });

  $('diagram').addEventListener('click', function (e) {
    const g = e.target.closest('[data-id]');
    if (!g) return;
    setTab('blocks');
    focusBlock(g.dataset.id);
  });

  $('analysis').addEventListener('input', function (e) {
    const el = e.target, k = el.dataset.k;
    if (k === undefined) return;
    S.an[Number(k)][el.dataset.anF] = el.value;
    saveAnalysis();
  });
  $('analysis').addEventListener('click', function (e) {
    const b = e.target.closest('[data-an]');
    if (!b) return;
    if (b.dataset.an === 'add') {
      S.an.push({ name: '', role: '', desc: '' });
      saveAnalysis();
      renderAnalysis();
      const rows = $('analysis').querySelectorAll('input[data-an-f="name"]');
      rows[rows.length - 1].focus();
    } else {
      S.an.splice(Number(b.dataset.k), 1);
      saveAnalysis();
      renderAnalysis();
      const first = $('analysis').querySelector('input');
      if (first) first.focus();
    }
  });

  $('console').addEventListener('click', function (e) {
    const s = e.target.closest('[data-show]');
    if (s) { setTab('blocks'); focusBlock(s.dataset.show); return; }
    const tr = e.target.closest('[data-tr]');
    if (tr) {
      if (tr.dataset.tr === 'close') { S.trace = null; S.active = null; S.err = null; renderDiagram(); markEditor(); showConsole(''); $('btnStep').focus(); return; }
      S.ti = Math.max(0, Math.min(S.trace.trace.length, S.ti + (tr.dataset.tr === 'fwd' ? 1 : -1)));
      renderTrace();
      const again = $('console').querySelector('[data-tr="' + tr.dataset.tr + '"]');
      if (again && !again.disabled) again.focus();
      else { const other = $('console').querySelector('[data-tr]:not([disabled])'); if (other) other.focus(); }
      return;
    }
    const tryb = e.target.closest('[data-try]');
    if (tryb) {
      $('inputs').value = JSON.parse(tryb.dataset.try).join('\n');
      store.inp[wk(cur().lv.id)] = $('inputs').value;
      save();
      run();
    }
  });

  $('inputs').addEventListener('input', function () { store.inp[wk(cur().lv.id)] = $('inputs').value; save(); });
  $('btnRun').addEventListener('click', run);
  $('btnStep').addEventListener('click', step);
  $('btnCheck').addEventListener('click', check);
  $('btnUndo').addEventListener('click', undo);
  $('btnReset').addEventListener('click', function () {
    if (!$('btnReset').dataset.armed) { armReset(true); return; }
    armReset(false);
    pushHistory();
    S.prog = Flow.fromArray(cur().lv.start || []);
    delete store.prog[wk(cur().lv.id)];
    changed(true);
    showConsole('');
  });
  $('tabBlocks').addEventListener('click', function () { setTab('blocks'); });
  $('tabDiagram').addEventListener('click', function () { setTab('diagram'); renderDiagram(); });
  $('btnPrev').addEventListener('click', function () { go(S.i - 1, true); });
  $('btnNext').addEventListener('click', function () { go(S.i + 1, true); });
  $('btnLevels').addEventListener('click', function () { if (document.body.classList.contains('nav-open')) closeNav(); else openNav(); });
  $('navBack').addEventListener('click', closeNav);
  $('nav').addEventListener('click', function (e) {
    const a = e.target.closest('a[data-k]');
    if (!a) return;
    e.preventDefault();
    go(Number(a.dataset.k), true);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { closeNav(); $('btnLevels').focus(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && cur().lv.kind !== 'quiz') { e.preventDefault(); run(); }
  });

  // ---------- tema e dimensione del testo ----------
  const THEMES = ['auto', 'light', 'dark'];
  function applySettings() {
    const r = document.documentElement;
    if (store.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', store.theme);
    r.style.setProperty('--scale', String(store.size));
    $('btnTheme').setAttribute('aria-label', t('ui.theme', { mode: t('ui.theme.' + store.theme) }));
    $('btnTheme').title = t('ui.theme', { mode: t('ui.theme.' + store.theme) });
  }
  $('btnTheme').addEventListener('click', function () {
    store.theme = THEMES[(THEMES.indexOf(store.theme) + 1) % THEMES.length];
    save(); applySettings();
  });
  $('btnSmaller').addEventListener('click', function () { store.size = Math.max(0.85, Math.round((store.size - 0.1) * 100) / 100); save(); applySettings(); });
  $('btnBigger').addEventListener('click', function () { store.size = Math.min(1.5, Math.round((store.size + 0.1) * 100) / 100); save(); applySettings(); });

  // ---------- lingua ----------
  Object.keys(window.LEVELS).forEach(function (l) {
    const o = new Option(window.I18N[l]['locale.name'], l);
    o.lang = l;
    $('locale').add(o);
  });
  $('locale').addEventListener('change', function () {
    const id = cur().lv.id;
    store.locale = $('locale').value;
    save();
    // un ?locale= nell'indirizzo vincerebbe sulla scelta al prossimo caricamento
    try { history.replaceState(null, '', location.pathname + '#' + id); } catch (e) { /* in alcuni contesti non si può */ }
    setLocale(store.locale);
    applySettings();
    go(ALL.findIndex(function (x) { return x.lv.id === id; }));
  });

  // ---------- avvio ----------
  setLocale(pickLocale());
  if (THEMES.indexOf(store.theme) < 0) store.theme = 'auto';
  if (typeof store.size !== 'number') store.size = 1;
  applySettings();
  const fromHash = ALL.findIndex(function (x) { return '#' + x.lv.id === location.hash; });
  const fromStore = ALL.findIndex(function (x) { return x.lv.id === store.cur; });
  go(fromHash >= 0 ? fromHash : fromStore >= 0 ? fromStore : 0);

  // App installabile e usabile offline; da file:// i service worker non esistono e la pagina va lo stesso.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () { /* resta la pagina normale */ });
})();

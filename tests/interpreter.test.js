// Comportamenti dell'interprete e dei messaggi per chi impara.
const test = require('node:test');
const assert = require('node:assert');
const Flow = require('../src/core/flow.js');
const Interpreter = require('../src/core/interpreter.js');
const Expr = require('../src/core/expr.js');

const run = (arr, input) => Interpreter.run(Flow.fromArray(arr), { input: input || [] });
const ev = (src, vars) => Expr.evaluate(Expr.parse(src), Object.assign(Object.create(null), vars || {}));
const errKey = (src) => { try { Expr.parse(src); return null; } catch (e) { return e.key; } };

test('operatori in stile pseudocodice', () => {
  assert.strictEqual(ev('7 div 2'), 3);
  assert.strictEqual(ev('17 mod 5'), 2);
  assert.strictEqual(ev('2 + 3 * 4'), 14);
  assert.strictEqual(ev('-2 ^ 2'), -4);
  assert.strictEqual(ev('9 : 3'), 3);
  assert.strictEqual(ev('x > 0 e x < 10', { x: 5 }), true);
  assert.strictEqual(ev('non (x = 5) o vero', { x: 5 }), true);
  assert.strictEqual(ev('a <> b', { a: 1, b: 2 }), true);
  assert.strictEqual(ev('0.1 + 0.2 = 0.3'), true);
  assert.strictEqual(ev('“ciao” + "!"'), 'ciao!');
  assert.strictEqual(ev('arrotonda(2.345, 2)'), 2.35);
});

test('errori di scrittura con chiavi precise', () => {
  assert.strictEqual(errKey('0 < x < 10'), 'expr.chainedCmp');
  assert.strictEqual(errKey('x > 0 e < 10'), 'expr.missingValueBefore');
  assert.strictEqual(errKey('2 x'), 'expr.missingOperator');
  assert.strictEqual(errKey('(a + b'), 'expr.missingParen');
  assert.strictEqual(errKey('a + b)'), 'expr.extraParen');
  assert.strictEqual(errKey('3,5'), 'expr.decimalComma');
  assert.strictEqual(errKey('x ← 3'), 'expr.arrow');
  assert.strictEqual(errKey('"ciao'), 'expr.unclosedString');
  assert.strictEqual(errKey('a +'), 'expr.missingValue');
});

test('formattazione dei numeri', () => {
  assert.strictEqual(Expr.format(0.1 + 0.2), '0.3');
  assert.strictEqual(Expr.format(-0), '0');
  assert.strictEqual(Expr.format(10 / 4), '2.5');
  assert.strictEqual(Expr.format(true), 'vero');
});

test('leggi, scrivi e dati in ingresso', () => {
  const r = run([['leggi', 'a'], ['leggi', 'b'], ['scrivi', '"Somma:", a + b']], ['3', '4,5']);
  assert.deepStrictEqual(r.output, ['Somma: 7.5']);
  assert.strictEqual(run([['leggi', 'a'], ['leggi', 'b']], [1]).error.key, 'run.noInput');
});

test('testo senza virgolette', () => {
  assert.strictEqual(run([['scrivi', 'Ciao mondo!']]).error.key, 'block.needQuotes');
  assert.strictEqual(run([['scrivi', 'Ciao']]).error.key, 'run.noValueText');
});

test('variabile senza valore suggerisce il nome vicino', () => {
  const r = run([['leggi', 'somma'], ['scrivi', 'soma']], [1]);
  assert.strictEqual(r.error.key, 'run.noValue');
  assert.deepStrictEqual(r.error.vals.suggest, ['hint.didYouMean', { name: 'somma' }]);
});

test('campi vuoti e nomi non validi', () => {
  assert.strictEqual(run([['leggi', '']]).error.key, 'empty.leggi.v');
  assert.strictEqual(run([['se', '', [], []]]).error.key, 'empty.cond');
  assert.strictEqual(run([['assegna', 'mia somma', '1']]).error.key, 'block.badName');
  assert.strictEqual(run([['assegna', 'mod', '1']]).error.key, 'block.reserved');
  assert.strictEqual(run([['assegna', 's ← 1', '1']]).error.key, 'block.nameWithArrow');
  // l'errore emerge anche in un ramo mai eseguito
  assert.strictEqual(run([['se', 'vero', [], [['scrivi', '(1']]]]).error.kind, 'compile');
});

test('i cicli infiniti vengono fermati e indicano il ciclo', () => {
  const p = Flow.fromArray([['assegna', 'i', '1'], ['mentre', 'i <= 5', [['assegna', 'x', 'i']]]]);
  const r = Interpreter.run(p);
  assert.strictEqual(r.error.key, 'run.infinite');
  assert.strictEqual(r.error.blockId, p[1].id);
  assert.strictEqual(run([['mentre', 'vero', [['scrivi', '1']]]]).error.key, 'run.infiniteOut');
});

test('per, ripeti e condizioni', () => {
  assert.deepStrictEqual(run([['per', 'i', '3', '1', [['scrivi', 'i']], '-1']]).output, ['3', '2', '1']);
  assert.deepStrictEqual(run([['per', 'i', '1', '0', [['scrivi', 'i']]]]).output, []);
  assert.strictEqual(run([['per', 'i', '1', '3', [], '0']]).error.key, 'run.zeroStep');
  assert.deepStrictEqual(run([['ripeti', [['leggi', 'x']], 'x < 0']], [-1, -2, 4]).output, []);
  assert.strictEqual(run([['assegna', 'x', '3'], ['se', 'x', [], []]]).error.key, 'run.condNotBool');
  assert.strictEqual(run([['scrivi', '1 / 0']]).error.key, 'run.divZero');
  assert.strictEqual(run([['scrivi', '"a" + 1']]).error.key, 'run.textPlus');
});

test('la traccia registra un passo per blocco', () => {
  const r = Interpreter.run(Flow.fromArray([['leggi', 'n'], ['se', 'n > 0', [['scrivi', '"sì"']], []]]), { input: [2], trace: true });
  assert.deepStrictEqual(r.trace.map((s) => s.note.k), ['read', 'cond', 'write']);
  assert.strictEqual(r.trace[0].vars.n, 2);
});

test('andata e ritorno della forma compatta', () => {
  const arr = [['leggi', 'n'], ['per', 'i', '1', 'n', [['se', 'i > 1', [['scrivi', 'i']], []]], '2'], ['ripeti', [['assegna', 'n', 'n - 1']], 'n > 0']];
  assert.deepStrictEqual(Flow.toArray(Flow.fromArray(arr)), arr);
});

test('in inglese le parole chiave sono inglesi', () => {
  Expr.setLocale('en');
  try {
    assert.strictEqual(ev('x > 0 and not (x = 5) or false', { x: 3 }), true);
    assert.strictEqual(ev('sqrt(16) + int(2.7) + round(1.25, 1)'), 7.3);
    assert.strictEqual(Expr.format(true), 'true');
    assert.strictEqual(Expr.isReserved('round'), true);
    // le parole italiane tornano nomi qualsiasi
    assert.strictEqual(Expr.isReserved('e'), false);
    assert.strictEqual(run([['assegna', 'and', '1']]).error.key, 'block.reserved');
  } finally { Expr.setLocale('it'); }
});

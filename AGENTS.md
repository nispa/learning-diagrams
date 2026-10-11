# Diagrammi Passo Passo

Corso interattivo per imparare ad analizzare i problemi e a disegnare diagrammi di flusso, tutto nel
browser: lo studente costruisce il diagramma con blocchi strutturati, la pagina lo disegna in SVG,
lo esegue e ogni livello viene verificato da test. Progetto gemello di `nispa/learning-c`.

- Avvio: apri `index.html` (funziona anche da file, senza server). `#id-livello` apre un livello,
  `?locale=en` sceglie la lingua.
- Servita in http/https è una PWA: `sw.js` conserva i file per l'uso offline. Pubblicazione su
  Cloudflare con `npx wrangler deploy` (`wrangler.jsonc`, `.assetsignore`).
- Test: `npm test` (usa `node --test`, nessuna dipendenza da installare).

## Struttura

Vedi il README. I file in `src/` sono moduli UMD: si caricano con `<script>` nel browser e con
`require` in Node. Mantieni questo formato: niente bundler, niente build, niente ES modules
(non funzionano da file://).

## Come scrivere codice qui

Prima leggi il codice e segui il flusso vero. Poi fermati al primo gradino che risolve il problema:

1. Serve davvero? Se no, non farlo.
2. C'è già nel progetto? Riusalo (`t`, `esc`, `md`, `Util.norm`, `Util.suggest`, `Flow.walk`, `Flow.usage`).
3. Lo fa JavaScript o il browser? Usalo.
4. Basta una riga? Una riga.
5. Solo allora: il minimo che funziona, scritto come il codice intorno.

Niente dipendenze npm, framework o astrazioni "per il futuro".

### Da non sacrificare mai per fare prima

- **Messaggi per gli studenti**: semplici, che indicano il blocco giusto e dicono cosa fare.
- **Accessibilità**: font leggibili, focus visibile, contrasto in tema chiaro e scuro, nessuna
  animazione se `prefers-reduced-motion`, tutto usabile da tastiera, `aria-label` sensate.
  L'editor a blocchi è la vista accessibile del diagramma: ogni cosa del disegno deve esserci anche lì.
- **Progressi degli studenti**: la chiave `diagrammi-passo-passo-v1` e gli `id` di capitoli e
  livelli non cambiano mai; ogni accesso a `localStorage` sta in un try/catch. I livelli superati
  valgono in tutte le lingue; il lavoro in corso è per lingua (`wk()` in `app.js`: l'italiano
  usa le chiavi senza prefisso, come prima).
- **Sicurezza**: il testo che arriva dai livelli, dai testi o dal diagramma passa da `esc()` o
  `md()` prima di finire in `innerHTML`.
- **Limiti dell'interprete**: passi massimi, righe di uscita e lunghezza della traccia restano,
  così un ciclo infinito non blocca la pagina.

## Testi

- L'interprete, il verificatore e il disegno non scrivono frasi: lanciano o restituiscono
  `{ key, vals }`. Un valore può essere `[chiave, valori]`; `t()` traduce in modo ricorsivo.
- Ogni testo per lo studente sta in `src/i18n/it.js`, la lingua di riferimento, e con le stesse
  chiavi e gli stessi segnaposto in ogni altra lingua (`src/i18n/en.js`). In `index.html` si usano
  `data-i18n` e `data-i18n-aria`. `npm test` controlla che ogni chiave usata esista, che nessuna
  sia in più e che le lingue abbiano la stessa forma.
- Una chiave nuova si aggiunge in tutte le lingue insieme.
- I testi dei livelli stanno nei livelli: `src/levels/<lingua>/levels.js`, tradotti per intero
  (anche variabili, testi stampati e uscite attese), con gli stessi capitoli e id nello stesso ordine.
  Un livello nuovo si aggiunge in tutte le lingue.
- Le parole chiave del pseudocodice (`e`/`and`, `vero`/`true`, `radq`/`sqrt`...) sono in `LANGS`
  di `src/core/expr.js`; `app.js` cambia lingua con `Util.setLocale` ed `Expr.setLocale`.
- Nuova lingua: copia `src/i18n/en.js` e `src/levels/en/`, traduci, aggiungi le parole chiave in
  `LANGS`, i `<script>` in `index.html` e i file in `FILES` di `sw.js`; aggiungi la lingua al ciclo
  in `tests/levels.test.js` e al `require` di `src/core/util.js`.

## Qualità

- `npm test` deve essere verde prima di considerare finito un cambiamento.
- Un file nuovo caricato da `index.html` va anche in `FILES` di `sw.js` (lo controlla `npm test`).
- Correggi un bug dell'interprete scrivendo prima un test in `tests/` che lo riproduce.
- Un livello nuovo segue `src/levels/README.md`.
- Commenti in italiano, brevi, che spiegano il perché.
- Per vedere un cambiamento nell'interfaccia apri la pagina e prova davvero un livello, anche
  a larghezza di telefono, in tema scuro e in tutte e due le lingue.

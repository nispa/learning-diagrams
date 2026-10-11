# Diagrammi Passo Passo

[English](README.md) · **Italiano**

Impara a **capire un problema** e a **disegnarne la soluzione** con i diagrammi di flusso, un passo alla volta, direttamente nel browser.

Ogni livello chiede una piccola cosa: rispondere a una domanda sul problema, oppure costruire un diagramma con i blocchi. Il diagramma si disegna da solo mentre lo costruisci, si esegue con i dati che scegli e una verifica automatica dice se è giusto, spiegando gli errori in parole semplici. Il corso è in italiano e in inglese.

Progetto gemello di [C Passo Passo](https://github.com/nispa/learning-c): stessa idea, stessa architettura, un passo prima del codice.

## Il percorso

**43 livelli in 7 capitoli**, dalle basi all'autonomia:

| Capitolo | Cosa si impara |
| --- | --- |
| 1. Capire il problema | algoritmo, dati in ingresso, elaborazione, risultati, costanti, casi limite, risolvere a mano |
| 2. Leggere i diagrammi | le forme ISO 5807, la freccia `←`, seguire una decisione, la tabella di traccia |
| 3. La sequenza | Leggi, Scrivi, Assegna; trovare un errore; scambio di variabili; prima tabella delle variabili |
| 4. Le decisioni | Se, confronti, `mod`, decisioni annidate, `e` / `o` / `non`, casi particolari |
| 5. I cicli | Mentre, Per, Ripeti; cicli infiniti; accumulatore |
| 6. Schemi ricorrenti | contatore, media, massimo, sentinella, bandierina, algoritmo di Euclide |
| 7. In autonomia | problemi descritti solo a parole, con l'analisi completa a carico dello studente |

## Caratteristiche

- **Niente da installare**: è una pagina statica, tutto gira nel browser.
- **Editor a blocchi strutturati**: il diagramma è sempre ben formato, quindi lo studente si concentra sulla logica e non sulle frecce. Funziona anche da telefono.
- **Disegno automatico** con i simboli della norma ISO 5807 (ovale, parallelogramma, rettangolo, rombo); il ciclo Per si disegna com'è davvero (inizializza, controlla, esegue, incrementa). Toccando una forma si va al blocco.
- **Esecuzione passo passo** con la **tabella di traccia** compilata in automatico e il blocco corrente evidenziato.
- **Errori spiegati**: *«Non si possono concatenare due confronti come in `0 < x < 10`»*, *«La variabile `soma` non ha ancora un valore… Forse volevi scrivere `somma`?»*, *«Il ciclo con la condizione `i <= 5` non finisce mai»*.
- **Verifiche che non si ingannano**: ogni livello prova il diagramma con più dati, compresi i casi di confine, e può richiedere strutture precise (un ciclo, un solo Leggi, niente Per…).
- **Analisi del problema verificata**: nei livelli di autonomia lo studente compila la tabella delle variabili (nome, ruolo, contenuto) e la verifica controlla che corrisponda al diagramma.
- **Leggibile e accessibile**: font Atkinson Hyperlegible, testo ingrandibile, tema chiaro e scuro, uso completo da tastiera (`Ctrl+Invio` esegue).
- **Italiano e inglese**: interfaccia, messaggi, parole chiave dei blocchi e livelli tradotti per intero. La lingua si sceglie nella testata (o con `?locale=en`) e resta salvata.
- **Si installa come app** (PWA) e, una volta aperto, funziona anche senza connessione.
- **Progressi salvati** nel browser.

## Il linguaggio dei blocchi

| Blocco | Forma | Esempio |
| --- | --- | --- |
| Leggi | parallelogramma | `Leggi n` |
| Scrivi | parallelogramma | `Scrivi "Somma:", s` (più valori separati da virgola) |
| Assegna | rettangolo | `s ← s + i` |
| Se … allora … altrimenti | rombo | `n mod 2 = 0` |
| Mentre … ripeti | rombo | `i <= n` (controlla prima) |
| Ripeti … mentre | rombo | `voto < 1 o voto > 10` (controlla dopo) |
| Per … da … a … passo | rombo | `Per i da 1 a n` |

Operatori: `+ - * / ^`, `div` (quoziente intero), `mod` (resto), `= <> < <= > >=` (anche `≠ ≤ ≥`), `e`, `o`, `non`, `vero`, `falso`. Funzioni: `abs`, `radq`, `intero`, `arrotonda`. Testi tra virgolette, decimali con il punto.

In inglese i blocchi sono Input, Output, Assign, If, While, Repeat, For e le parole chiave `and`, `or`, `not`, `true`, `false`, `sqrt`, `int`, `round`.

## Avvio

Clona o scarica il repository e apri `index.html` nel browser. Fine.

I font arrivano da Google Fonts; senza connessione la pagina funziona lo stesso con i font di sistema.

Per aprire un livello preciso: `index.html#cifre`. Per scegliere la lingua: `index.html?locale=en`.

## Pubblicazione

È un sito statico: basta servire la cartella. Su Cloudflare (Workers con static assets) c'è già `wrangler.jsonc`:

```
npx wrangler login
npx wrangler deploy
```

`.assetsignore` tiene fuori test e documenti. In alternativa si collega il repository a Cloudflare dalla dashboard, con comando di deploy `npx wrangler deploy` e nessun comando di build.

Servita in http/https la pagina registra `sw.js`: si può installare come app e funziona offline.

## Struttura

```
index.html                 la pagina: markup e <script> nell'ordine giusto, nessuna build
css/app.css                stile
src/i18n/it.js             tutti i testi per lo studente (messaggi, interfaccia): la lingua di riferimento
src/i18n/en.js             gli stessi testi in inglese
src/core/util.js           traduzione t(), esc(), md(), confronto delle righe, suggerimenti
src/core/expr.js           espressioni: lettura, calcolo, formattazione
src/core/flow.js           il diagramma come dato (forma compatta ad array ↔ oggetti)
src/core/interpreter.js    esegue un diagramma, con limiti e traccia
src/core/checker.js        verifica un livello e la tabella delle variabili
src/core/render.js         disegna il diagramma in SVG
src/core/app.js            interfaccia
src/levels/it/levels.js    capitoli e livelli
src/levels/en/levels.js    gli stessi livelli in inglese (stessi id)
sw.js                      service worker: uso offline
manifest.webmanifest       la scheda dell'app installabile (icone in icons/)
tests/                     test (node:test)
```

## Sviluppo

Serve [Node.js](https://nodejs.org) 20 o più recente, solo per i test. Nessuna dipendenza, nessuna build.

```
npm test
```

I test controllano che ogni livello sia superato dalla sua soluzione e non dal diagramma di partenza, che le risposte delle domande coincidano con l'esecuzione del diagramma mostrato, che ogni testo usato esista (e nessuno sia in più), che ogni lingua abbia le stesse chiavi e gli stessi livelli dell'italiano, che `index.html` e `sw.js` comprendano ogni file e che ogni diagramma si disegni.

Le regole del progetto, per persone e agenti, sono in [AGENTS.md](AGENTS.md); il formato dei livelli in [src/levels/README.md](src/levels/README.md).

## Licenza

[MIT](LICENSE)

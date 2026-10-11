# Livelli

I capitoli sono in `src/levels/it/levels.js`, nell'ordine in cui lo studente li incontra.
Gli `id` di capitoli e livelli **non cambiano mai**: i progressi salvati li usano.

## Capitolo

```js
{ id: 'cicli', title: 'I cicli', palette: ['leggi', 'scrivi', 'assegna', 'se', 'mentre', 'ripeti', 'per'], levels: [...] }
```

`palette` sono i blocchi che lo studente può aggiungere; un livello può avere la sua.

## I diagrammi nella forma compatta

```js
['leggi', 'n']
['scrivi', '"Somma:", s']            // più valori separati da virgola
['assegna', 's', 's + i']
['se', 'n > 0', [ ...ramo V ], [ ...ramo F ]]
['mentre', 'i <= n', [ ...corpo ]]
['ripeti', [ ...corpo ], 'x < 0']    // ripete finché la condizione è vera
['per', 'i', '1', 'n', [ ...corpo ], '-1']   // il passo è facoltativo
```

## Livello a domande

```js
{ id: 'forme', kind: 'quiz', title, learn, task,
  show: [ ...diagramma da mostrare ],              // facoltativo
  questions: [
    { q, options: ['...', '...'], answer: 0, why },   // a scelta: answer è l'indice
    { q, answer: '14', run: [7], why },               // risposta breve; con run, npm test
  ] }                                                 // controlla che sia l'uscita di show
```

`why` si mostra quando la risposta è giusta: spiega il perché, non solo il cosa.

## Livello da costruire

```js
{ id: 'somma-n', title, learn, task, hint,
  palette,                       // facoltativa, altrimenti quella del capitolo
  start: [ ... ],                // diagramma di partenza: NON deve superare il livello
  solution: [ ... ],             // deve superarlo (lo controlla npm test)
  tests: [{ input: [5], expect: ['15'] }, ...],     // le righe attese, confrontate senza
                                                    // badare a spazi e maiuscole
  must:     [{ t: 'per', msg }],                    // t: tipo o lista di tipi; re: regola sul testo
  mustNot:  [{ t: 'per', msg }],
  maxCount: [{ t: 'leggi', max: 1, msg }],
  analysis: true,                // chiede la tabella delle variabili
  analysisSolution: [{ name: 'n', role: 'in', desc: '...' }],   // ruoli: in, out, work
}
```

Regole per scrivere un buon livello:

- un livello, un'idea nuova; il testo dice **esattamente** cosa scrivere;
- i `tests` comprendono i casi di confine e i casi particolari (zero, negativi, valori uguali):
  è così che un diagramma sbagliato non passa per caso;
- un livello «Trova l'errore» parte da un diagramma plausibile che sbaglia solo in un caso;
- nel capitolo «In autonomia» niente `start` e suggerimenti che indicano il metodo, non la soluzione.

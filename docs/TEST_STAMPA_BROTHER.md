# Test stampa con Brother label printer

La foto mostra una stampante Brother a etichette/label roll. Senza carta termica
continua da ricevuta, il test va fatto come etichetta: pagina stretta, altezza
definita e stampa al 100%.

## Impostazione consigliata iniziale

Nel gestionale:

1. vai in **Impostazioni -> Configuratore ricevuta**;
2. lascia **Formato carta** su `58mm`;
3. imposta:
   - **Larghezza personalizzata etichetta**: `62`;
   - **Altezza personalizzata etichetta**: `100`;
4. salva.

Se il testo viene tagliato sotto, prova altezza `120`.

Se esce troppo stretto o decentrato, prova larghezza `58`.

## Test passo-passo

1. Crea una intenzione di prova.
2. Vai in **Archivio**.
3. Apri **Anteprima e stampa**.
4. Premi **Stampa ricevuta**.
5. Nella finestra di stampa Windows:
   - seleziona la Brother;
   - formato carta: scegli il formato etichetta installato nel driver;
   - scala: `100%`;
   - disattiva "Adatta alla pagina";
   - orientamento: verticale;
   - margini: nessuno/minimi se disponibile.

## Cosa guardare sul primo test

- Se stampa troppo piccolo: scala non è al 100% o formato carta errato.
- Se taglia a destra: larghezza troppo grande o driver su formato diverso.
- Se taglia sotto: aumenta altezza personalizzata.
- Se esce ruotato: cambia orientamento nel driver Brother.
- Se stampa su due etichette: altezza pagina più grande dell'etichetta fisica.

## Nota

Le label printer Brother spesso ragionano per formato del rotolo installato. Il
driver deve conoscere quel formato; il gestionale prepara la pagina, ma è il
driver Brother che decide dove tagliare o avanzare l'etichetta.

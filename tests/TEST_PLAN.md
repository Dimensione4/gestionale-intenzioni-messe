# Piano di test MVP

Questo documento usa come specifica
`PIANO_SVILUPPO_GESTIONALE_INTENZIONI_MESSE.md`.

## Test automatici

### Unitari

- validazione data obbligatoria e formato ISO;
- validazione orario `HH:mm`;
- conversione e formattazione euro, inclusi zero e decimali;
- offerta non negativa;
- limite intenzioni per singola combinazione data/orario;
- generazione progressivo ricevuta, senza riuso degli annullati;
- costruzione nome backup e validazione file di ripristino;
- filtri archivio e quoting CSV.

### Componenti React

- apertura modulo dal pulsante principale e dal giorno selezionato;
- data selezionata riportata nel modulo;
- salvataggio con tutti i campi e aggiornamento immediato del giorno;
- righe intenzione visibili nel box del giorno corretto;
- stesso giorno con orari diversi, ordinati per orario;
- errore di validazione e limite visibili senza chiudere il modulo;
- dettaglio/modifica/annullamento con conferma;
- anteprima e ristampa ricevuta;
- ricerca archivio per nome, data e numero ricevuta;
- stati vuoto, caricamento ed errore accessibili.

### Integrazione SQLite/Tauri

Da eseguire su un database temporaneo reale:

- applicazione migrazioni su database vuoto e idempotenza;
- inserimento e rilettura completa di un'intenzione;
- query calendario inclusiva degli estremi `from/to`;
- esclusione degli elementi annullati dai conteggi attivi;
- transazione atomica intenzione + ricevuta + audit log;
- due inserimenti concorrenti sull'ultimo posto disponibile: uno solo riesce;
- vincoli numero ricevuta unico, importo non negativo e impostazioni valide;
- backup byte-per-byte apribile e ripristino preceduto da backup di sicurezza;
- query archivio con combinazioni di filtri ed export CSV.

### E2E desktop Windows

Automatizzare dove possibile su una build Tauri di test con database isolato:

1. primo avvio e creazione password;
2. login errato e corretto;
3. configurazione parrocchia e orari;
4. selezione giorno, creazione intenzione e verifica della riga nel calendario;
5. riavvio app e verifica persistenza;
6. raggiungimento limite e blocco del quarto inserimento;
7. modifica intenzione e ricontrollo limite al cambio messa;
8. generazione, anteprima, stampa PDF e ristampa ricevuta;
9. annullamento con motivo, senza cancellazione fisica;
10. ricerca archivio ed export;
11. backup, modifica dati, ripristino e verifica contenuto;
12. installazione `.exe`/`.msi`, avvio e disinstallazione su Windows pulito.

## Collaudo manuale obbligatorio

- stampa su Microsoft Print to PDF;
- stampa sulla termica reale (marca/modello, USB/LAN e carta da annotare);
- leggibilità con zoom Windows 125% e dimensione testo aumentata;
- navigazione completa da tastiera e focus visibile;
- prova con utente non tecnico;
- funzionamento senza rete;
- copia installer su chiavetta e installazione senza tool di sviluppo.

## Criterio di rilascio

Nessun errore bloccante nel percorso:

`Login → Calendario → Intenzione → Ricevuta → Stampa → Archivio`.

Tutti i test automatici devono passare; stampa termica e prova utente possono
essere marcate “non eseguite” solo finché hardware o utente non sono disponibili.

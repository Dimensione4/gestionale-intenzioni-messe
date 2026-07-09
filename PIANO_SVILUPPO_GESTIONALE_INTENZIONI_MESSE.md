# Piano sviluppo — Gestionale Intenzioni Messe

**Nome progetto:** Gestionale Intenzioni Messe  
**Tipo progetto:** Applicativo desktop Windows installabile  
**Target utente:** Parrocchia / ufficio parrocchiale / utenti 40+  
**Obiettivo consegna MVP:** entro fine luglio 2026  
**Stack consigliato:** Tauri + React + TypeScript + SQLite  
**Ambiente sviluppo:** Visual Studio Code su Windows

---

## 1. Obiettivo del progetto

Realizzare un programma Windows semplice, sicuro e gradevole per gestire le intenzioni delle messe, gli orari, le offerte e la stampa delle ricevute tramite stampante termica.

Il programma deve essere pensato per persone non tecniche, quindi deve avere:

- interfaccia molto semplice;
- testi grandi e leggibili;
- pulsanti grandi;
- pochi passaggi per completare le operazioni principali;
- possibilità di correggere errori senza paura;
- funzionamento locale, senza obbligo di internet;
- backup dei dati;
- stampa ricevute su stampante termica.

Il progetto deve essere pensato anche come base riutilizzabile per altre parrocchie in futuro.

---

## 2. Decisione tecnica principale

### Scelta consigliata

Sviluppare una **app desktop Windows locale**.

### Stack

```txt
Tauri
React
TypeScript
SQLite
CSS moderno / Tailwind opzionale
```

### Perché questa scelta

- Funziona sul PC della parrocchia.
- Non richiede server online.
- Riduce i rischi legati alla gestione dati su cloud.
- È più adatta a una stampante fisica collegata al computer.
- Può essere installata anche in altre parrocchie.
- È più leggera di Electron.
- Permette di usare React per costruire una UI moderna.

---

## 3. Requisiti prioritari

### Funzionali

1. Login locale.
2. Calendario dinamico.
3. Gestione orari messe.
4. Inserimento intenzioni.
5. Limite massimo intenzioni per ogni messa.
6. Gestione offerte/importi.
7. Generazione ricevuta numerata.
8. Stampa ricevuta su stampante termica.
9. Archivio intenzioni/ricevute.
10. Ricerca per data, nome, cognome, numero ricevuta.
11. Impostazioni modificabili.
12. Backup e ripristino dati.
13. Export CSV/Excel.
14. Santo del giorno opzionale.

### Non funzionali

1. Interfaccia semplice.
2. Caratteri grandi.
3. Alto contrasto.
4. Pochi colori ma curati.
5. Navigazione chiara.
6. Nessun dato online di default.
7. Database locale protetto.
8. Riduzione massima dei bug tramite validazioni e test.
9. Installer Windows semplice.
10. Possibilità di ripristino in caso di errore.

---

## 4. Utenti target e UX

Il programma deve essere usabile anche da persone poco abituate ai software gestionali.

### Regole UX obbligatorie

- Font base minimo: **18px**.
- Titoli principali: **26-32px**.
- Pulsanti principali: altezza minima **48-56px**.
- Campi input grandi e ben distanziati.
- Etichette sempre visibili sopra i campi.
- Evitare icone senza testo.
- Messaggi di errore chiari.
- Conferme prima di eliminare dati.
- Nessun menu nascosto indispensabile.
- Azioni principali sempre visibili.

### Esempi pulsanti principali

```txt
+ Aggiungi intenzione
Stampa ricevuta
Ristampa ricevuta
Cerca
Salva
Annulla
Crea backup
```

### Tono dell'interfaccia

Deve sembrare un software pulito, moderno e rassicurante, non un gestionale vecchio.

---

## 5. Schermate previste

### 5.1 Login

Campi:

- password;
- pulsante “Entra”.

Funzioni:

- accesso locale;
- cambio password dalle impostazioni;
- nessuna registrazione online.

MVP: può bastare un solo utente amministratore locale.

---

### 5.2 Dashboard calendario

Schermata principale.

Elementi:

- data corrente;
- santo del giorno, se disponibile;
- calendario mensile;
- lista messe del giorno selezionato;
- contatore intenzioni per ogni messa;
- pulsante grande “Aggiungi intenzione”.

Esempio:

```txt
Giovedì 4 luglio 2026
Santo del giorno: San ...

Messe del giorno
08:30 — 1 / 3 intenzioni
18:00 — 3 / 3 intenzioni
```

---

### 5.3 Dettaglio giorno

Mostra tutte le messe del giorno selezionato.

Per ogni messa:

- orario;
- numero intenzioni inserite;
- massimo consentito;
- lista intenzioni;
- pulsante “Aggiungi intenzione a questa messa”.

---

### 5.4 Inserimento intenzione

Campi consigliati:

```txt
Data messa
Orario messa
Nome offerente
Cognome offerente
Telefono opzionale
Intenzione / Testo da stampare
Nome defunto / persona ricordata opzionale
Offerta
Metodo pagamento
Note interne
Stampa subito ricevuta sì/no
```

Campi obbligatori MVP:

```txt
Data messa
Orario messa
Nome offerente oppure testo ricevuta
Offerta
```

Validazioni:

- non permettere più intenzioni del limite configurato;
- non salvare data vuota;
- non salvare importo non valido;
- chiedere conferma se l’offerta è 0;
- chiedere conferma se il testo intenzione è vuoto.

---

### 5.5 Ricevuta

La ricevuta deve essere generata automaticamente dopo il salvataggio.

Campi ricevuta:

```txt
Nome parrocchia
Indirizzo parrocchia
Contatti parrocchia
Numero ricevuta
Data ricevuta
Ricevuta da
Causale / intenzione
Data e ora della messa
Importo offerta
Testo finale configurabile
```

Funzioni:

- stampa;
- ristampa;
- anteprima;
- annullamento ricevuta con motivo;
- numerazione progressiva.

---

### 5.6 Archivio

Ricerca e consultazione dati.

Filtri:

```txt
Da data
A data
Nome
Cognome
Numero ricevuta
Orario messa
Stato ricevuta
```

Azioni:

- apri dettaglio;
- ristampa ricevuta;
- esporta risultati;
- correggi intenzione, se consentito.

---

### 5.7 Impostazioni parrocchia

Campi:

```txt
Nome parrocchia
Indirizzo
Telefono
Email
Codice fiscale
P.IVA opzionale
Logo opzionale
Testo finale ricevuta
```

---

### 5.8 Impostazioni messe

Funzioni:

- configurare giorni e orari standard;
- configurare limite massimo intenzioni per messa;
- configurare eccezioni;
- aggiungere messe speciali;
- annullare messe in giorni specifici.

Esempio orari standard:

```txt
Lunedì: 08:30, 18:00
Martedì: 08:30, 18:00
Mercoledì: 08:30, 18:00
Giovedì: 08:30, 18:00
Venerdì: 08:30, 18:00
Sabato: 18:00
Domenica: 08:30, 10:30, 18:00
```

---

### 5.9 Impostazioni ricevute e stampa

Campi:

```txt
Formato carta: 58mm / 80mm
Margine superiore
Margine laterale
Dimensione carattere ricevuta
Mostra logo sì/no
Offerta predefinita
Numerazione iniziale
```

Azioni:

```txt
Stampa ricevuta di prova
Seleziona stampante predefinita
Apri impostazioni stampanti Windows
```

---

### 5.10 Backup e ripristino

Funzioni obbligatorie:

```txt
Crea backup ora
Ripristina backup
Apri cartella backup
Esporta dati CSV
```

Backup automatico:

- all’apertura dell’app, massimo una volta al giorno;
- prima di ogni aggiornamento importante;
- prima di ripristinare un backup.

Cartella consigliata:

```txt
Documenti/Gestionale Intenzioni Messe/Backup
```

Formato nome backup:

```txt
gestionale-intenzioni-backup-YYYY-MM-DD-HH-mm.sqlite
```

---

## 6. Database SQLite

### Tabelle principali

```sql
CREATE TABLE parish_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  parish_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  tax_code TEXT,
  vat_number TEXT,
  receipt_footer_text TEXT,
  default_offering_cents INTEGER DEFAULT 1500,
  max_intentions_per_mass INTEGER DEFAULT 3,
  receipt_paper_size TEXT DEFAULT '58mm',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

```sql
CREATE TABLE mass_schedule_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL,
  time TEXT NOT NULL,
  max_intentions INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

```sql
CREATE TABLE mass_schedule_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  original_time TEXT,
  new_time TEXT,
  type TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

```sql
CREATE TABLE mass_intentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mass_date TEXT NOT NULL,
  mass_time TEXT NOT NULL,
  offerer_first_name TEXT,
  offerer_last_name TEXT,
  offerer_phone TEXT,
  intention_text TEXT NOT NULL,
  remembered_person TEXT,
  offering_cents INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT,
  internal_notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

```sql
CREATE TABLE receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_number INTEGER NOT NULL UNIQUE,
  intention_id INTEGER NOT NULL,
  receipt_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid',
  cancelled_reason TEXT,
  printed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (intention_id) REFERENCES mass_intentions(id)
);
```

```sql
CREATE TABLE saints_calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(month, day)
);
```

```sql
CREATE TABLE app_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT NOT NULL
);
```

---

## 7. Sicurezza dati

### Principi

- Nessun dato online di default.
- Database locale.
- Backup automatici.
- Password locale.
- Nessun dato sensibile scritto nei log tecnici.
- Conferma prima di eliminazioni o annullamenti.
- Storico minimo delle modifiche importanti.

### Password

- Non salvare mai password in chiaro.
- Salvare solo hash sicuro.
- In MVP usare una libreria affidabile lato Rust o backend Tauri.

### Dati delicati

Le intenzioni delle messe possono contenere dati personali e informazioni religiose. Trattarle come dati sensibili.

Regole pratiche:

- accesso solo con password;
- backup custoditi dalla parrocchia;
- non inviare dati a servizi esterni senza consenso;
- non usare analytics invasivi;
- non salvare dati su cloud automatico;
- prevedere esportazione e cancellazione dati.

---

## 8. Stampa termica

La stampa è il punto più delicato del progetto.

### Prima verifica obbligatoria

Chiedere al cliente:

```txt
Marca stampante
Modello stampante
Collegamento: USB / LAN / seriale / Bluetooth
Formato carta: 58mm / 80mm
La stampante appare in Windows?
Stampa correttamente una pagina di test?
Il vecchio programma FileMaker stampa ancora correttamente?
```

### Strategia MVP

Usare una schermata di anteprima ricevuta e la stampa Windows.

Flusso:

```txt
Salva intenzione
Genera ricevuta
Mostra anteprima
Clic su Stampa
Invia alla stampante configurata in Windows
```

### Layout 58mm base

```txt
PARROCCHIA DI ...
------------------------
RICEVUTA N. 354
Data: 04/07/2026

Ricevuta da:
Mario Rossi

Intenzione:
Per defunto Luigi Bianchi

Messa:
05/07/2026 ore 18:00

Offerta: € 15,00
------------------------
Grazie
```

### Da non promettere nel MVP

- stampa silenziosa senza dialogo;
- taglio automatico carta;
- compatibilità garantita con qualsiasi stampante;
- stampa diretta ESC/POS senza test modello.

Queste funzioni possono diventare evoluzioni successive.

---

## 9. Santo del giorno

Feature opzionale.

### Strategia consigliata

- MVP: campo santo del giorno manuale o dataset locale base.
- Versione successiva: import automatico da API gratuita, con salvataggio locale.

### Regola

Il programma deve funzionare anche senza santo del giorno e anche senza internet.

---

## 10. Architettura progetto VS Code

Struttura consigliata:

```txt
gestionale-intenzioni-messe/
  README.md
  PIANO_SVILUPPO_GESTIONALE_INTENZIONI_MESSE.md
  package.json
  src/
    app/
    components/
      Button/
      Card/
      Modal/
      FormField/
      Calendar/
      ReceiptPreview/
    features/
      auth/
      calendar/
      intentions/
      receipts/
      settings/
      backup/
      saints/
    lib/
      date.ts
      money.ts
      validation.ts
      constants.ts
    styles/
      globals.css
      accessibility.css
  src-tauri/
    src/
      main.rs
      db.rs
      commands.rs
      backup.rs
      printer.rs
    migrations/
      001_initial.sql
      002_add_audit_logs.sql
  tests/
    unit/
    e2e/
```

---

## 11. Design system

### Colori consigliati

Usare colori caldi, chiari e rassicuranti.

```txt
Sfondo principale: avorio / grigio molto chiaro
Colore primario: blu scuro elegante
Colore secondario: oro tenue / beige
Successo: verde sobrio
Errore: rosso chiaro leggibile
Testo: quasi nero
```

### Componenti UI obbligatori

- `Button`
- `Card`
- `Modal`
- `FormField`
- `CalendarDay`
- `MassTimeSlot`
- `ReceiptPreview`
- `ConfirmDialog`
- `ToastMessage`
- `EmptyState`

### Regole accessibilità

- Mai testo grigio troppo chiaro.
- Mai pulsanti piccoli.
- Mai solo icone senza testo.
- Focus visibile da tastiera.
- Messaggi errore sotto ogni campo.
- Contrasto alto.
- Layout leggibile anche con zoom 125%.

---

## 12. Validazioni anti-bug

### Inserimento intenzione

- Data obbligatoria.
- Orario obbligatorio.
- Testo intenzione obbligatorio.
- Importo numerico.
- Limite massimo intenzioni controllato prima del salvataggio.
- Se limite raggiunto, bloccare inserimento.
- Se si modifica orario, ricontrollare limite.

### Ricevute

- Numero ricevuta unico.
- Non riusare numeri annullati.
- Ristampa consentita.
- Annullamento solo con conferma e motivo.
- Non cancellare fisicamente ricevute già generate.

### Backup

- Prima di ripristinare, creare backup automatico.
- Verificare esistenza file backup.
- Mostrare messaggio chiaro a fine ripristino.

### Impostazioni

- Limite intenzioni minimo 1.
- Orari nel formato `HH:mm`.
- Carta solo `58mm` o `80mm`.
- Offerta predefinita non negativa.

---

## 13. Test obbligatori

### Test manuali

1. Login corretto.
2. Login errato.
3. Creazione intenzione.
4. Blocco limite 3 intenzioni.
5. Modifica intenzione.
6. Generazione ricevuta.
7. Ristampa ricevuta.
8. Annullamento ricevuta.
9. Ricerca per nome.
10. Ricerca per data.
11. Export CSV.
12. Backup manuale.
13. Ripristino backup.
14. Stampa su PDF.
15. Stampa su stampante termica reale.
16. Test con font grandi.
17. Test con zoom Windows 125%.
18. Test con utente non esperto.

### Test automatici minimi

- validazione importi;
- validazione date;
- limite massimo intenzioni;
- generazione numero ricevuta;
- formattazione euro;
- funzioni backup;
- query archivio.

---

## 14. Roadmap fino a fine luglio

### Settimana 1 — Fondamenta

Obiettivi:

- setup progetto Tauri + React;
- struttura cartelle;
- database SQLite;
- prime migrazioni;
- design system base;
- schermata login;
- layout principale.

Output:

```txt
App avviabile in locale
Database creato
Schermata login funzionante
Prima UI coerente
```

---

### Settimana 2 — Calendario e intenzioni

Obiettivi:

- calendario mensile;
- dettaglio giorno;
- gestione orari messe;
- inserimento intenzione;
- limite massimo intenzioni;
- archivio base.

Output:

```txt
Si può creare e cercare un’intenzione
Il calendario mostra le messe
Il limite massimo viene rispettato
```

---

### Settimana 3 — Ricevute, stampa e backup

Obiettivi:

- numerazione ricevute;
- anteprima ricevuta;
- template 58mm/80mm;
- stampa su PDF;
- stampa su termica se disponibile;
- backup e ripristino.

Output:

```txt
Ricevuta generata e stampabile
Backup funzionante
Archivio consultabile
```

---

### Settimana 4 — Rifinitura e consegna

Obiettivi:

- miglioramento grafico;
- bug fixing;
- test utente reale;
- installer Windows;
- guida rapida;
- configurazione PC cliente.

Output:

```txt
Installer Windows pronto
Versione MVP consegnabile
Guida rapida pronta
```

---

## 15. Definition of Done MVP

Il progetto può essere considerato consegnabile quando:

- l’app si installa su Windows;
- il login funziona;
- il calendario mostra giorni e messe;
- si possono inserire intenzioni;
- il limite massimo funziona;
- si può generare una ricevuta;
- si può ristampare una ricevuta;
- l’archivio funziona;
- il backup funziona;
- la UI è leggibile da utenti 40+;
- la stampa è stata testata almeno su PDF;
- la stampa termica è stata testata se la stampante è disponibile;
- non ci sono errori bloccanti nei flussi principali;
- esiste una guida rapida per l’utilizzo.

---

## 16. Funzioni da rimandare dopo MVP

Non inserire nel primo rilascio, salvo tempo extra:

- sincronizzazione cloud;
- app mobile;
- multi-postazione contemporanea;
- ruoli avanzati;
- statistiche avanzate;
- stampa silenziosa;
- import automatico dal vecchio FileMaker;
- API santi completa;
- calendario liturgico diocesano avanzato;
- gestione multi-parrocchia.

---

## 17. Preventivo tecnico indicativo

### Versione MVP seria

Range consigliato:

```txt
900 € - 1.400 €
```

Include:

- app Windows locale;
- calendario;
- intenzioni;
- ricevute;
- stampa base;
- archivio;
- impostazioni;
- backup;
- installer.

### Versione rifinita

Range consigliato:

```txt
1.500 € - 2.500 €
```

Include:

- grafica più curata;
- maggiore personalizzazione;
- export avanzato;
- test stampante termica;
- guida completa;
- configurazione sul PC;
- santo del giorno.

---

## 18. Informazioni da recuperare subito dal cliente

Checklist da chiedere:

```txt
1. Marca e modello stampantina
2. Foto impostazioni stampante Windows
3. Formato carta: 58mm o 80mm
4. Esempio ricevuta corretta
5. Orari standard delle messe
6. Giorni con orari speciali
7. Limite intenzioni per ogni messa
8. Campi obbligatori da stampare
9. Serve usare il programma su un solo PC?
10. Serve usarlo senza internet?
11. Serve recuperare dati dal vecchio FileMaker?
12. Chi dovrà usare il programma?
```

---

## 19. Note operative per lo sviluppo

### Priorità assoluta

Non cercare la perfezione subito. Prima completare il flusso principale:

```txt
Login → Calendario → Aggiungi intenzione → Genera ricevuta → Stampa → Archivio
```

### Regola anti-caos

Ogni feature deve avere:

- schermata chiara;
- validazioni;
- messaggio di conferma;
- gestione errore;
- test manuale.

### Regola commerciale

Non promettere compatibilità completa con la stampantina finché non viene testata fisicamente.

---

## 20. Comandi iniziali ipotetici

Da confermare in base alla versione Tauri usata.

```bash
npm create tauri-app@latest gestionale-intenzioni-messe
cd gestionale-intenzioni-messe
npm install
npm run tauri dev
```

Dipendenze probabili:

```bash
npm install react-router-dom zod date-fns lucide-react
```

Da valutare:

```bash
npm install @tanstack/react-query
npm install react-hook-form
```

---

## 21. Prompt guida per sviluppo assistito

Usare questo prompt con AI coding assistant dentro VS Code:

```txt
Stiamo sviluppando un'app desktop Windows locale chiamata Gestionale Intenzioni Messe.
Stack: Tauri + React + TypeScript + SQLite.
Target utenti: persone 40+, non tecniche, quindi UI semplice, font grandi, pulsanti grandi, alto contrasto e flussi guidati.
Priorità: sicurezza dati locale, backup, stabilità, validazioni anti-errore e stampa ricevute su stampante termica 58mm/80mm.
Non usare cloud di default.
Implementare una feature per volta seguendo il file PIANO_SVILUPPO_GESTIONALE_INTENZIONI_MESSE.md.
Prima di scrivere codice, proporre struttura file e controlli anti-bug.
Dopo ogni feature, indicare test manuali da fare.
```

---

## 22. Prossimo step pratico

Il prossimo step è creare il progetto base in VS Code e implementare solo:

```txt
1. Layout app
2. Database SQLite
3. Login locale
4. Impostazioni parrocchia
5. Calendario vuoto
```

Solo dopo questi punti si passa a intenzioni, ricevute e stampa.

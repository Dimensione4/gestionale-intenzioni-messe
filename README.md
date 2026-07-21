# Gestionale Intenzioni Messe

Applicazione desktop Windows locale per gestire calendario delle messe, intenzioni, ricevute, archivio e backup.

> Software proprietario di Dimensione 4 di Dario Marco Bellini. Il codice può essere consultato a scopo dimostrativo, ma l'uso, la copia, la modifica o la redistribuzione richiedono autorizzazione scritta. Vedi [LICENSE](LICENSE).

## Funzionalità principali

- calendario mensile e vista elenco delle intenzioni;
- dettaglio giornata con fasce orarie, modifica ed eliminazione ripristinabile;
- ricevute numerate con anteprima e stampa termica `58mm`/`80mm`;
- archivio storico, cestino e log modifiche;
- impostazioni parrocchia, sacerdote, colori, logo e orari standard;
- backup locali automatici, backup cifrati e predisposizione per backup online;
- updater Tauri firmato con release GitHub.

## Sicurezza e dati personali

Il gestionale salva i dati operativi sul computer dell'utente. Il repository non deve contenere database reali, backup, chiavi private, token o dati personali di parrocchie/offerenti. Prima di rendere pubblico il repository controlla sempre [SECURITY.md](SECURITY.md) e `.gitignore`.

I backup online devono essere cifrati prima dell'upload. Il collegamento Google Drive è disattivato di default e richiederà autorizzazione OAuth dell'utente.

Guide operative:

- [Configurazione Google Drive Backup](docs/GOOGLE_DRIVE_BACKUP.md)
- [Test stampa Brother label printer](docs/TEST_STAMPA_BROTHER.md)

## Installazione per l'utente

Scarica l'ultima versione da GitHub Releases:

```text
https://github.com/Dimensione4/gestionale-intenzioni-messe/releases/latest
```

Per il prete, il file consigliato è l'installer `.exe`:

```text
Gestionale.Intenzioni.Messe_0.1.4_x64-setup.exe
```

In alternativa:

1. Copia su chiavetta uno dei file generati nella cartella `src-tauri/target/release/bundle/`:
   - `nsis/Gestionale Intenzioni Messe_0.1.4_x64-setup.exe`, consigliato per l'installazione guidata;
   - `msi/Gestionale Intenzioni Messe_0.1.4_x64_en-US.msi`, utile in ambienti Windows gestiti.
2. Sul PC della parrocchia apri il file `.exe` o `.msi` e completa l'installazione.
3. Al primo avvio crea la password amministratore.
4. Entra in **Impostazioni** e compila i dati della parrocchia, gli orari standard delle messe e il formato ricevuta `58mm` o `80mm`.

I dati, la password e lo storico restano sul computer locale. Dopo il primo accesso riuscito il gestionale ricorda l'accesso sul PC tramite il Credential Manager di Windows, quindi chiudendo e riaprendo entra automaticamente. Il pulsante **Esci** dimentica l'accesso automatico e richiederà di nuovo la password al prossimo avvio.

Per sicurezza usa **Impostazioni -> Backup e ripristino -> Crea backup ora**, soprattutto prima di spostare il programma su un altro PC.

## Backup

Il gestionale crea backup locali automatici nella cartella Documenti, organizzati per giornata e orario:

```text
Documenti/
  Gestionale Intenzioni Messe/
    Backup/
      2026-07-09/
        00-00/
        06-00/
        12-00/
        18-00/
```

La frequenza predefinita è ogni 6 ore e può essere modificata in **Impostazioni -> Backup e ripristino**.

Per copiare un backup su cloud o chiavetta usa **Crea backup cifrato**: genera un file `.gimbackup` protetto da password. La password non viene salvata dal gestionale.

Se Google Drive è collegato e il backup online è attivo, il pulsante diventa
**Crea backup cifrato e carica su Drive**. Il file viene caricato in:

```text
Gestionale Intenzioni Messe/Backup/YYYY-MM-DD/HH-MM
```

Al termine il gestionale mostra un messaggio di conferma con il percorso Drive
e, quando disponibile, il pulsante **Apri su Google Drive** per verificare subito
il file dal browser.

## Come condividerlo al prete

1. Dal tuo PC esegui la build:

```powershell
npm run tauri build
```

2. Apri la cartella:

```powershell
src-tauri\target\release\bundle\nsis
```

3. Copia su chiavetta il file `Gestionale Intenzioni Messe_0.1.4_x64-setup.exe`.
4. Sul PC del prete fai doppio clic sul file copiato.
5. Se Windows mostra un avviso di protezione, scegli **Ulteriori informazioni** e poi **Esegui comunque**, se il file arriva da te.
6. Dopo l'installazione apri il gestionale, crea la password e configura parrocchia, orari e ricevute.

## Uso quotidiano

1. Apri **Calendario** e seleziona il giorno desiderato, oppure usa **Aggiungi intenzione**.
2. Inserisci data, ora, testo, persona ricordata e offerta, quindi premi **Salva intenzione**.
3. Nel giorno scelto appariranno ora e testo dell'intenzione. La ricevuta viene numerata automaticamente.
4. Apri **Archivio** per cercare, esportare, ristampare, annullare una ricevuta o ripristinare intenzioni eliminate.
5. In **Impostazioni -> Configuratore ricevuta** scegli quali informazioni stampare sul bollettino.

## Stampa ricevute

Per la stampante termica usa **Archivio -> Anteprima e stampa**. Il gestionale imposta automaticamente il formato carta della ricevuta in base alla configurazione `58mm` o `80mm`; nel pannello di stampa di Windows seleziona comunque la stampante termica corretta.

Se la stampante offre opzioni come "Adatta alla pagina" o "A4", disattivale e usa il formato termico configurato. Le email lunghe vengono spezzate automaticamente per non uscire dai riquadri della ricevuta.

Per stampanti Brother a etichette puoi impostare una larghezza/altezza personalizzata in **Impostazioni -> Configuratore ricevuta**. Per un primo test prova `62mm x 100mm`, stampa al 100% e disattiva ogni adattamento pagina.

## Aggiornamenti automatici

Stato attuale: il plugin updater è configurato con la chiave pubblica Tauri, la UI controlla gli aggiornamenti all'avvio e da **Impostazioni -> Backup e ripristino**, e la pipeline GitHub Actions è presente in `.github/workflows/release.yml`.

Nota importante: non viene usato `dimensione4.it` come hosting degli aggiornamenti. La configurazione punta ai GitHub Releases:

```json
"endpoints": [
  "https://github.com/Dimensione4/gestionale-intenzioni-messe/releases/latest/download/latest.json"
]
```

Se il repository resta privato, un PC esterno potrebbe non riuscire a scaricare automaticamente `latest.json` e gli installer senza autenticazione GitHub. In quel caso le alternative pulite sono: installazione manuale via chiavetta, repository pubblico separato solo per gli artifact firmati, oppure un canale privato dedicato agli aggiornamenti. Non usare il sito ufficiale come deposito tecnico se non lo vuoi espressamente.

La funzionalità è fattibile con il plugin updater di Tauri, ma richiede una piccola infrastruttura di rilascio sicura. La documentazione ufficiale è qui:

- https://v2.tauri.app/plugin/updater/
- https://v2.tauri.app/distribute/pipelines/github/

### Obiettivo per l'utente

Quando il gestionale si apre e trova una versione più recente:

1. mostra un avviso con numero versione e note di aggiornamento;
2. chiede conferma prima di installare;
3. scarica l'aggiornamento;
4. verifica la firma digitale dell'aggiornamento;
5. installa la nuova versione e riapre il gestionale.

Se il PC della parrocchia non ha internet, resta sempre valida l'installazione manuale tramite chiavetta.

### Passo 1: installare il plugin updater

Dal progetto:

```powershell
npm run tauri add updater
```

Questo aggiunge:

- dipendenza Rust `tauri-plugin-updater`;
- pacchetto frontend `@tauri-apps/plugin-updater`;
- configurazione base Tauri.

### Passo 2: generare le chiavi di firma

Gli aggiornamenti devono essere firmati. Tauri non permette aggiornamenti non firmati.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.tauri"
npx tauri signer generate --write-keys "$env:USERPROFILE\.tauri\gestionale-intenzioni-messe.key"
```

Conserva con attenzione:

- chiave privata: serve per pubblicare aggiornamenti, non va condivisa;
- password della chiave privata, se impostata;
- chiave pubblica: va inserita in `src-tauri/tauri.conf.json`.

Se perdi la chiave privata, i PC già installati non potranno più ricevere aggiornamenti automatici firmati con quella catena.

### Passo 3: configurare `tauri.conf.json`

Nel file `src-tauri/tauri.conf.json` servirà una sezione simile:

```json
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "CHIAVE_PUBBLICA_GENERATA_DA_TAURI",
      "endpoints": [
        "https://github.com/Dimensione4/gestionale-intenzioni-messe/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

`installMode: "passive"` mostra una piccola finestra di avanzamento durante l'installazione. È la scelta più chiara per un utente non tecnico.

### Passo 4: aggiungere i secret su GitHub

Nel repository GitHub privato:

1. apri **Settings**;
2. vai in **Secrets and variables -> Actions**;
3. aggiungi:
   - `TAURI_SIGNING_PRIVATE_KEY`;
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, se hai impostato una password.

La chiave privata può essere inserita come contenuto della chiave oppure come valore gestito dalla pipeline, in base a come viene generata e conservata.

### Passo 5: creare la pipeline GitHub Actions

Crea `.github/workflows/release.yml` con un workflow Windows. Esempio di base:

```yaml
name: release

on:
  workflow_dispatch:
  push:
    tags:
      - "app-v*"

jobs:
  release-windows:
    runs-on: windows-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm

      - uses: dtolnay/rust-toolchain@stable

      - uses: swatinem/rust-cache@v2
        with:
          workspaces: "./src-tauri -> target"

      - run: npm ci
      - run: npm test
      - run: npm run build

      - uses: tauri-apps/tauri-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: "Gestionale Intenzioni Messe ${{ github.ref_name }}"
          releaseBody: "Aggiornamento del gestionale. Vedi le note versione nel changelog."
          releaseDraft: false
          prerelease: false
```

### Passo 6: pubblicare una nuova versione

1. Aggiorna la versione in:
   - `src-tauri/tauri.conf.json`;
   - `src-tauri/Cargo.toml`;
   - `package.json`, se vuoi tenerlo allineato.
2. Scrivi le note di versione nel commit o nella release.
3. Crea e pusha un tag:

```powershell
git add .
git commit -m "release: versione 0.2.0"
git tag app-v0.2.0
git push
git push origin app-v0.2.0
```

4. GitHub Actions crea la release e carica gli installer.
5. Il file `latest.json` deve puntare all'artefatto Windows e includere la firma `.sig`.

### Prima inizializzazione del canale updater

Il pulsante **Controlla aggiornamenti** funziona solo dopo la prima release firmata,
perché l'endpoint deve trovare `latest.json` tra gli asset GitHub.

Per inizializzare il canale sulla versione attuale:

```powershell
git tag app-v0.1.0
git push origin app-v0.1.0
```

Quando GitHub Actions termina, la release conterrà `latest.json` e il controllo
aggiornamenti non mostrerà più l'errore sul JSON mancante.

### Passo 7: integrare il controllo aggiornamenti nell'app

Nel frontend si userà il plugin updater per controllare gli aggiornamenti all'avvio o da **Impostazioni**.

Flusso UI consigliato:

1. all'avvio controlla in modo silenzioso;
2. se trova una nuova versione mostra una modale: versione attuale, nuova versione, note;
3. pulsanti:
   - **Installa aggiornamento**;
   - **Ricordamelo più tardi**;
4. dopo conferma scarica, installa e riavvia.

### Stato attuale

Il gestionale resta installabile manualmente tramite `.exe` o `.msi`. L'updater automatico è configurato, ma per funzionare in produzione richiede che GitHub Actions abbia i secret di firma e che `latest.json` sia raggiungibile dal PC su cui è installato il gestionale.

## Sviluppo

Servono Node.js, Rust stable e i prerequisiti Tauri per Windows: Microsoft C++ Build Tools e WebView2.

```powershell
npm install
npm run tauri dev
npm run tauri build
```

La build crea sia `.msi` sia `-setup.exe` in `src-tauri/target/release/bundle/`.

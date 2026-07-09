# Gestionale Intenzioni Messe

Applicazione desktop Windows locale per gestire calendario delle messe, intenzioni, ricevute, archivio e backup.

## Installazione per l'utente

1. Copia su chiavetta uno dei file generati nella cartella `src-tauri/target/release/bundle/`:
   - `nsis/Gestionale Intenzioni Messe_0.1.0_x64-setup.exe`, consigliato per l'installazione guidata;
   - `msi/Gestionale Intenzioni Messe_0.1.0_x64_en-US.msi`, utile in ambienti Windows gestiti.
2. Sul PC della parrocchia apri il file `.exe` o `.msi` e completa l'installazione.
3. Al primo avvio crea la password amministratore.
4. Entra in **Impostazioni** e compila i dati della parrocchia, gli orari standard delle messe e il formato ricevuta `58mm` o `80mm`.

I dati, la password e lo storico restano sul computer locale. Per sicurezza usa **Impostazioni -> Backup e ripristino -> Crea backup ora**, soprattutto prima di spostare il programma su un altro PC.

## Come condividerlo al prete

1. Dal tuo PC esegui la build:

```powershell
npm run tauri build
```

2. Apri la cartella:

```powershell
src-tauri\target\release\bundle\nsis
```

3. Copia su chiavetta il file `Gestionale Intenzioni Messe_0.1.0_x64-setup.exe`.
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

## Aggiornamenti automatici

La funzionalità è fattibile con il plugin updater di Tauri, ma richiede una piccola infrastruttura di rilascio sicura.

Flusso previsto:

1. Si aumenta la versione in `src-tauri/tauri.conf.json`.
2. Si pubblica una nuova release GitHub con installer e file di aggiornamento firmati.
3. Il gestionale controlla online se esiste una versione più recente.
4. Se disponibile, mostra un avviso con versione e note di aggiornamento.
5. L'utente conferma, il gestionale scarica l'aggiornamento, verifica la firma e installa la nuova versione.

Per completarla servono:

- plugin Tauri updater installato lato Rust e frontend;
- chiave privata di firma custodita nei secret GitHub;
- chiave pubblica configurata nel programma;
- pipeline GitHub Actions che crea release, installer e firme;
- endpoint `latest.json` o GitHub Release interrogabile dal gestionale.

Nota: se il PC della parrocchia non ha internet, resterà sempre valida l'installazione manuale tramite chiavetta.

## Sviluppo

Servono Node.js, Rust stable e i prerequisiti Tauri per Windows: Microsoft C++ Build Tools e WebView2.

```powershell
npm install
npm run tauri dev
npm run tauri build
```

La build crea sia `.msi` sia `-setup.exe` in `src-tauri/target/release/bundle/`.

# Gestionale Intenzioni Messe

Applicazione desktop Windows locale con Tauri, React, TypeScript e SQLite.

## Avvio e installer

Servono Node.js, Rust stable e i prerequisiti Tauri per Windows (Microsoft C++ Build Tools e WebView2).

```powershell
npm install
npm run tauri dev
npm run tauri build
```

La build crea sia `.msi` sia `-setup.exe` in `src-tauri/target/release/bundle/`: possono essere copiati su chiavetta. Al primo avvio si crea la password amministratore; dati e credenziali restano locali.

## Guida rapida

1. Apri **Calendario** e seleziona il giorno desiderato, oppure usa **Aggiungi intenzione**.
2. Inserisci data, ora, testo e offerta, quindi premi **Salva intenzione**.
3. Nel giorno scelto appariranno ora e testo dell’intenzione. La ricevuta viene numerata automaticamente.
4. Apri **Archivio** per cercare, esportare in CSV, ristampare o annullare una ricevuta.
5. In **Impostazioni** configura parrocchia, orari, limite per messa, carta e password.
6. Usa **Crea backup ora** prima di operazioni importanti. L’app crea inoltre al massimo un backup automatico al giorno.

Per la stampante termica usa **Anteprima / stampa** nell’Archivio e seleziona la stampante Windows. Il layout segue il formato 58 mm o 80 mm configurato.

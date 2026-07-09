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

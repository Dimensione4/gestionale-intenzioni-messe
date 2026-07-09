# Security policy

## Repository pubblico

Questo repository può essere reso pubblico solo se non contiene dati reali o segreti.

Non devono mai essere committati:

- database SQLite reali (`*.sqlite`, `*.db`);
- backup locali o online (`*.gimbackup`, cartelle `backup/` o `backups/`);
- chiavi private Tauri updater (`*.key`);
- file `.env` con token o password;
- credenziali Google OAuth, refresh token o client secret;
- dati personali di parrocchie, sacerdoti, offerenti o intenzioni reali.

## Dati del gestionale

I dati operativi restano nel computer dell'utente. I backup online, quando
abilitati, devono essere cifrati prima dell'upload.

## Segnalazioni

Per segnalare un problema di sicurezza:

- email: dariomarcobellini@dimensione4.it
- sito: https://www.dimensione4.it

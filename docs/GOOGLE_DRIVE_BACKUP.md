# Configurazione Google Drive per backup online

Il backup online deve restare disattivato di default. Quando viene attivato,
il gestionale deve caricare su Google Drive solo backup cifrati (`.gimbackup`).

## Cosa creare in Google Cloud

1. Vai su Google Cloud Console.
2. Crea o seleziona un progetto, ad esempio `Gestionale Intenzioni Messe`.
3. Apri **APIs & Services -> Library**.
4. Abilita **Google Drive API**.
5. Apri **APIs & Services -> OAuth consent screen**.
6. Configura la schermata consenso:
   - User type: **External** se useranno account Gmail personali.
   - App name: `Gestionale Intenzioni Messe`.
   - User support email: la tua email.
   - Developer contact: `dariomarcobellini@dimensione4.it`.
7. In fase test aggiungi tra i test user gli account Gmail che useranno il backup.
8. Apri **APIs & Services -> Credentials**.
9. Crea **OAuth client ID**.
10. Application type: **Desktop app**.
11. Copia il **Client ID**.

Per app desktop non devi chiedere al prete la password Gmail: si apre il browser,
lui autorizza Google e il gestionale riceve un token OAuth.

## Dove mettere il Client ID

Copia `.env.example` in `.env`:

```powershell
Copy-Item .env.example .env
```

Poi inserisci:

```env
VITE_GOOGLE_DRIVE_CLIENT_ID=IL_TUO_CLIENT_ID.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_SCOPE=https://www.googleapis.com/auth/drive.file
```

`.env` non deve essere committato.

## Scope consigliato

Scope iniziale:

```text
https://www.googleapis.com/auth/drive.file
```

È più prudente di un accesso completo a tutto Drive: permette all'app di gestire
i file creati o aperti dall'app.

Alternative più isolate:

```text
https://www.googleapis.com/auth/drive.appdata
```

`appDataFolder` è una cartella nascosta e accessibile solo dall'app, ma è meno
comoda per l'utente perché i file non sono visibili normalmente in Drive.

## Cosa non mettere mai nel repository

- refresh token;
- access token;
- client secret;
- database `.sqlite`;
- backup `.gimbackup` reali;
- chiavi private Tauri.

## Stato implementativo

Il gestionale oggi ha:

- preferenze UI per attivare il backup online;
- backup locale automatico;
- generazione backup cifrato `.gimbackup`;
- campo email Google Drive.

Il prossimo step tecnico è implementare il flusso OAuth:

1. aprire browser esterno con URL Google OAuth;
2. ricevere il callback tramite loopback locale;
3. salvare refresh token nel keyring di Windows;
4. caricare il file `.gimbackup` su Drive;
5. mostrare data/ora dell'ultimo backup online riuscito.

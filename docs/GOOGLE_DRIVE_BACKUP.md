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
12. Se Google mostra anche un **Client secret**, copialo: alcuni client Desktop
    lo richiedono durante lo scambio del token.

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
VITE_GOOGLE_DRIVE_CLIENT_SECRET=IL_TUO_CLIENT_SECRET_SE_RICHIESTO
VITE_GOOGLE_DRIVE_SCOPE=https://www.googleapis.com/auth/drive.file
```

`.env` non deve essere committato.

Se durante il collegamento compare `client_secret is missing`, aggiungi
`VITE_GOOGLE_DRIVE_CLIENT_SECRET`, riavvia `npm run tauri dev` e riprova.

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
- client secret reale nel repository pubblico;
- database `.sqlite`;
- backup `.gimbackup` reali;
- chiavi private Tauri.

## Stato implementativo

Il gestionale oggi ha:

- preferenze UI per attivare il backup online;
- backup locale automatico;
- generazione backup cifrato `.gimbackup`;
- campo email Google Drive;
- collegamento OAuth Google Drive via browser;
- salvataggio token nel keyring di Windows;
- upload manuale del backup cifrato su Google Drive.

Quando Google Drive è collegato e il backup online è attivo, il pulsante
**Crea backup cifrato e carica su Drive** genera il `.gimbackup` e lo carica in:

```text
Gestionale Intenzioni Messe/
  Backup/
    YYYY-MM-DD/
      HH-MM/
```

Il prossimo step tecnico è automatizzare anche l'upload periodico senza chiedere
ogni volta la password di cifratura, scegliendo se salvarla in modo sicuro nel
keyring o se mantenere solo il caricamento manuale cifrato.

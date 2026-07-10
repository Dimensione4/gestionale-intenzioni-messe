use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand_core::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::io::{Read, Write};
use tauri::Manager;
const SERVICE: &str = "it.parrocchia.gestionale-intenzioni";
const USER: &str = "admin-password-hash";
const GOOGLE_DRIVE_TOKEN_USER: &str = "google-drive-oauth-token";
const GOOGLE_DRIVE_ACCOUNT_USER: &str = "google-drive-account-email";
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, USER).map_err(|e| e.to_string())
}
fn named_entry(user: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, user).map_err(|e| e.to_string())
}
#[tauri::command]
fn has_password() -> bool {
    entry()
        .and_then(|e| e.get_password().map_err(|x| x.to_string()))
        .is_ok()
}
#[tauri::command]
fn set_initial_password(password: String) -> Result<bool, String> {
    if password.len() < 8 {
        return Err("La password deve avere almeno 8 caratteri".into());
    }
    if has_password() {
        return Err("Password già configurata".into());
    }
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();
    entry()?.set_password(&hash).map_err(|e| e.to_string())?;
    Ok(true)
}
#[tauri::command]
fn verify_password(password: String) -> bool {
    let Ok(hash) = entry().and_then(|e| e.get_password().map_err(|x| x.to_string())) else {
        return false;
    };
    let Ok(parsed) = PasswordHash::new(&hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok()
}
#[tauri::command]
fn change_password(current_password: String, new_password: String) -> Result<bool, String> {
    if !verify_password(current_password) {
        return Err("La password attuale non è corretta.".into());
    }
    if new_password.len() < 8 {
        return Err("La nuova password deve avere almeno 8 caratteri.".into());
    }
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(new_password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();
    entry()?.set_password(&hash).map_err(|e| e.to_string())?;
    Ok(true)
}
#[tauri::command]
fn delete_account(current_password: String) -> Result<bool, String> {
    if !verify_password(current_password) {
        return Err("La password non è corretta.".into());
    }
    entry()?.delete_credential().map_err(|e| e.to_string())?;
    Ok(true)
}
#[tauri::command]
fn new_backup_path(app: tauri::AppHandle) -> Result<String, String> {
    let now = chrono::Local::now();
    let folder = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("Gestionale Intenzioni Messe")
        .join("Backup")
        .join(now.format("%Y-%m-%d").to_string())
        .join(now.format("%H-%M").to_string());
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let name = format!(
        "gestionale-intenzioni-backup-{}.sqlite",
        now.format("%Y-%m-%d-%H-%M-%S")
    );
    Ok(folder.join(name).display().to_string())
}

#[tauri::command]
fn encrypt_backup_file(source_path: String, passphrase: String) -> Result<String, String> {
    if passphrase.len() < 12 {
        return Err("La password di cifratura deve avere almeno 12 caratteri.".into());
    }
    let source = std::path::PathBuf::from(&source_path);
    let plain = std::fs::read(&source).map_err(|e| e.to_string())?;
    let mut salt = [0u8; 16];
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce_bytes);
    let mut key = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<Sha256>(passphrase.as_bytes(), &salt, 210_000, &mut key);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plain.as_ref())
        .map_err(|e| e.to_string())?;
    let target = source.with_extension("gimbackup");
    let mut output = Vec::with_capacity(10 + salt.len() + nonce_bytes.len() + ciphertext.len());
    output.extend_from_slice(b"GIMBKP1");
    output.extend_from_slice(&salt);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    std::fs::write(&target, output).map_err(|e| e.to_string())?;
    Ok(target.display().to_string())
}

#[derive(Serialize)]
struct GoogleDriveConnection {
    connected: bool,
    account_email: String,
    message: String,
}

#[derive(Deserialize, Serialize, Clone)]
struct GoogleTokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: Option<i64>,
    token_type: Option<String>,
    scope: Option<String>,
}

#[derive(Serialize)]
struct GoogleDriveUploadResult {
    id: String,
    name: String,
    web_view_link: Option<String>,
    folder_path: String,
}

#[derive(Deserialize)]
struct GoogleDriveListResponse {
    files: Vec<GoogleDriveFile>,
}

#[derive(Deserialize, Serialize)]
struct GoogleDriveFile {
    id: String,
    name: String,
    #[serde(rename = "webViewLink")]
    web_view_link: Option<String>,
}

fn random_urlsafe(bytes_len: usize) -> String {
    let mut bytes = vec![0u8; bytes_len];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn random_hex(bytes_len: usize) -> String {
    let mut bytes = vec![0u8; bytes_len];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn sha256_base64url(input: &str) -> String {
    use sha2::Digest;
    let digest = Sha256::digest(input.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

fn query_value(query: &str, key: &str) -> Option<String> {
    query.split('&').find_map(|pair| {
        let (k, v) = pair.split_once('=')?;
        if k == key {
            urlencoding::decode(v).ok().map(|x| x.into_owned())
        } else {
            None
        }
    })
}

fn google_token_from_keyring() -> Result<GoogleTokenResponse, String> {
    let raw = named_entry(GOOGLE_DRIVE_TOKEN_USER)?
        .get_password()
        .map_err(|_| "Google Drive non è collegato: collega prima l'account.".to_string())?;
    serde_json::from_str::<GoogleTokenResponse>(&raw)
        .map_err(|e| format!("Token Google Drive salvato non leggibile: {e}"))
}

fn save_google_token(token: &GoogleTokenResponse) -> Result<(), String> {
    let body = serde_json::to_string(token).map_err(|e| e.to_string())?;
    named_entry(GOOGLE_DRIVE_TOKEN_USER)?
        .set_password(&body)
        .map_err(|e| e.to_string())
}

fn refresh_google_token(
    current: &GoogleTokenResponse,
    client_id: &str,
    client_secret: &str,
) -> Result<GoogleTokenResponse, String> {
    let refresh_token = current
        .refresh_token
        .as_deref()
        .ok_or("Google Drive va ricollegato: manca il refresh token.")?;
    let client = reqwest::blocking::Client::new();
    let mut form = vec![
        ("client_id", client_id),
        ("refresh_token", refresh_token),
        ("grant_type", "refresh_token"),
    ];
    if !client_secret.trim().is_empty() {
        form.push(("client_secret", client_secret.trim()));
    }
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&form)
        .send()
        .map_err(|e| format!("Refresh token Google non riuscito: {e}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("Risposta Google non leggibile: {e}"))?;
    if !status.is_success() {
        return Err(format!(
            "Google non ha aggiornato il token ({status}): {body}"
        ));
    }
    let mut refreshed: GoogleTokenResponse =
        serde_json::from_str(&body).map_err(|e| format!("Token Google non leggibile: {e}"))?;
    refreshed.refresh_token = current.refresh_token.clone();
    save_google_token(&refreshed)?;
    Ok(refreshed)
}

fn drive_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
}

fn drive_get_or_create_folder(
    client: &reqwest::blocking::Client,
    access_token: &str,
    name: &str,
    parent: Option<&str>,
) -> Result<String, String> {
    let mut q = format!(
        "mimeType='application/vnd.google-apps.folder' and trashed=false and name='{}'",
        drive_escape(name)
    );
    if let Some(parent_id) = parent {
        q.push_str(&format!(" and '{}' in parents", drive_escape(parent_id)));
    }
    let list = client
        .get("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(access_token)
        .query(&[
            ("q", q.as_str()),
            ("spaces", "drive"),
            ("fields", "files(id,name)"),
            ("pageSize", "1"),
        ])
        .send()
        .map_err(|e| format!("Ricerca cartella Drive non riuscita: {e}"))?;
    let status = list.status();
    let body = list
        .text()
        .map_err(|e| format!("Risposta Drive non leggibile: {e}"))?;
    if !status.is_success() {
        return Err(format!("Ricerca cartella Drive fallita ({status}): {body}"));
    }
    let parsed: GoogleDriveListResponse =
        serde_json::from_str(&body).map_err(|e| format!("Elenco Drive non leggibile: {e}"))?;
    if let Some(folder) = parsed.files.first() {
        return Ok(folder.id.clone());
    }
    let mut metadata = serde_json::json!({
        "name": name,
        "mimeType": "application/vnd.google-apps.folder"
    });
    if let Some(parent_id) = parent {
        metadata["parents"] = serde_json::json!([parent_id]);
    }
    let created = client
        .post("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(access_token)
        .query(&[("fields", "id,name")])
        .json(&metadata)
        .send()
        .map_err(|e| format!("Creazione cartella Drive non riuscita: {e}"))?;
    let status = created.status();
    let body = created
        .text()
        .map_err(|e| format!("Risposta Drive non leggibile: {e}"))?;
    if !status.is_success() {
        return Err(format!(
            "Creazione cartella Drive fallita ({status}): {body}"
        ));
    }
    let folder: GoogleDriveFile =
        serde_json::from_str(&body).map_err(|e| format!("Cartella Drive non leggibile: {e}"))?;
    Ok(folder.id)
}

fn drive_upload_file_with_token(
    access_token: &str,
    file_path: &str,
) -> Result<GoogleDriveUploadResult, String> {
    let path = std::path::PathBuf::from(file_path);
    if !path.exists() {
        return Err("File backup da caricare non trovato.".into());
    }
    if path.extension().and_then(|x| x.to_str()) != Some("gimbackup") {
        return Err("Per il backup online carico solo file cifrati .gimbackup.".into());
    }
    let file_name = path
        .file_name()
        .and_then(|x| x.to_str())
        .ok_or("Nome file backup non valido.")?
        .to_string();
    let parent_time = path
        .parent()
        .and_then(|x| x.file_name())
        .and_then(|x| x.to_str())
        .unwrap_or("manuale")
        .to_string();
    let fallback_date = chrono::Local::now().format("%Y-%m-%d").to_string();
    let parent_date = path
        .parent()
        .and_then(|x| x.parent())
        .and_then(|x| x.file_name())
        .and_then(|x| x.to_str())
        .unwrap_or(&fallback_date)
        .to_string();
    let client = reqwest::blocking::Client::new();
    let root =
        drive_get_or_create_folder(&client, access_token, "Gestionale Intenzioni Messe", None)?;
    let backup = drive_get_or_create_folder(&client, access_token, "Backup", Some(&root))?;
    let day = drive_get_or_create_folder(&client, access_token, &parent_date, Some(&backup))?;
    let hour = drive_get_or_create_folder(&client, access_token, &parent_time, Some(&day))?;
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let metadata = serde_json::json!({
        "name": file_name,
        "parents": [hour],
        "mimeType": "application/octet-stream"
    });
    let boundary = format!("gim-{}", random_hex(16));
    let mut body = Vec::new();
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n",
            metadata
        )
        .as_bytes(),
    );
    body.extend_from_slice(
        format!("--{boundary}\r\nContent-Type: application/octet-stream\r\n\r\n").as_bytes(),
    );
    body.extend_from_slice(&bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    let uploaded = client
        .post("https://www.googleapis.com/upload/drive/v3/files")
        .bearer_auth(access_token)
        .query(&[
            ("uploadType", "multipart"),
            ("fields", "id,name,webViewLink"),
        ])
        .header(
            reqwest::header::CONTENT_TYPE,
            format!("multipart/related; boundary={boundary}"),
        )
        .body(body)
        .send()
        .map_err(|e| format!("Upload Google Drive non riuscito: {e}"))?;
    let status = uploaded.status();
    let body = uploaded
        .text()
        .map_err(|e| format!("Risposta upload Drive non leggibile: {e}"))?;
    if !status.is_success() {
        return Err(format!("Upload Google Drive fallito ({status}): {body}"));
    }
    let file: GoogleDriveFile =
        serde_json::from_str(&body).map_err(|e| format!("File Drive non leggibile: {e}"))?;
    Ok(GoogleDriveUploadResult {
        id: file.id,
        name: file.name,
        web_view_link: file.web_view_link,
        folder_path: format!(
            "Gestionale Intenzioni Messe/Backup/{}/{}",
            parent_date, parent_time
        ),
    })
}

fn wait_for_google_callback(
    listener: std::net::TcpListener,
    expected_state: &str,
) -> Result<String, String> {
    let started = std::time::Instant::now();
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    loop {
        if started.elapsed() > std::time::Duration::from_secs(180) {
            return Err(
                "Autorizzazione Google scaduta: riprova dal pulsante Collega Google Drive.".into(),
            );
        }
        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut buffer = [0u8; 8192];
                let size = stream.read(&mut buffer).map_err(|e| e.to_string())?;
                let request = String::from_utf8_lossy(&buffer[..size]);
                let first_line = request.lines().next().unwrap_or_default();
                let path = first_line.split_whitespace().nth(1).unwrap_or_default();
                let query = path.split_once('?').map(|(_, q)| q).unwrap_or_default();
                let html_ok = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Google Drive collegato</title></head><body style=\"font-family:Arial,sans-serif;padding:32px\"><h1>Google Drive collegato</h1><p>Puoi tornare al gestionale.</p></body></html>";
                let html_error = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Autorizzazione non riuscita</title></head><body style=\"font-family:Arial,sans-serif;padding:32px\"><h1>Autorizzazione non riuscita</h1><p>Torna al gestionale e riprova.</p></body></html>";
                let error = query_value(query, "error");
                let state = query_value(query, "state").unwrap_or_default();
                let code = query_value(query, "code");
                let body = if error.is_some() || state != expected_state || code.is_none() {
                    html_error
                } else {
                    html_ok
                };
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.as_bytes().len(),
                    body
                );
                let _ = stream.write_all(response.as_bytes());
                if let Some(err) = error {
                    return Err(format!("Google ha rifiutato l'autorizzazione: {err}"));
                }
                if state != expected_state {
                    return Err(
                        "Risposta OAuth non valida: stato di sicurezza non corrispondente.".into(),
                    );
                }
                return code.ok_or("Google non ha restituito il codice OAuth.".into());
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(std::time::Duration::from_millis(120));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}

#[tauri::command]
fn has_google_drive_token() -> GoogleDriveConnection {
    let token = named_entry(GOOGLE_DRIVE_TOKEN_USER)
        .and_then(|e| e.get_password().map_err(|x| x.to_string()))
        .ok();
    let account_email = named_entry(GOOGLE_DRIVE_ACCOUNT_USER)
        .and_then(|e| e.get_password().map_err(|x| x.to_string()))
        .unwrap_or_default();
    GoogleDriveConnection {
        connected: token.is_some(),
        account_email,
        message: if token.is_some() {
            "Google Drive collegato.".into()
        } else {
            "Google Drive non ancora collegato.".into()
        },
    }
}

#[tauri::command]
fn connect_google_drive(
    client_id: String,
    client_secret: String,
    scope: String,
    account_email: String,
) -> Result<GoogleDriveConnection, String> {
    let client_id = client_id.trim().to_string();
    if client_id.is_empty() {
        return Err("Client ID Google mancante nel file .env.".into());
    }
    let scope = if scope.trim().is_empty() {
        "https://www.googleapis.com/auth/drive.file".to_string()
    } else {
        scope.trim().to_string()
    };
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth/google/callback");
    let state = random_hex(16);
    let code_verifier = random_urlsafe(48);
    let code_challenge = sha256_base64url(&code_verifier);
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&code_challenge={}&code_challenge_method=S256&state={}",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&scope),
        urlencoding::encode(&code_challenge),
        urlencoding::encode(&state)
    );
    open::that(auth_url).map_err(|e| format!("Non riesco ad aprire il browser: {e}"))?;
    let code = wait_for_google_callback(listener, &state)?;
    let client = reqwest::blocking::Client::new();
    let mut form = vec![
        ("client_id", client_id.as_str()),
        ("code", code.as_str()),
        ("code_verifier", code_verifier.as_str()),
        ("grant_type", "authorization_code"),
        ("redirect_uri", redirect_uri.as_str()),
    ];
    let client_secret = client_secret.trim().to_string();
    if !client_secret.is_empty() {
        form.push(("client_secret", client_secret.as_str()));
    }
    let response = client
        .post("https://oauth2.googleapis.com/token")
        .form(&form)
        .send()
        .map_err(|e| format!("Scambio token Google non riuscito: {e}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("Risposta Google non leggibile: {e}"))?;
    if !status.is_success() {
        if body.contains("client_secret is missing") {
            return Err("Google richiede anche il Client Secret per questo OAuth client. Aggiungi VITE_GOOGLE_DRIVE_CLIENT_SECRET nel file .env usando il valore del client Desktop Google Cloud, riavvia l'app e riprova.".into());
        }
        return Err(format!(
            "Google non ha rilasciato il token ({status}): {body}"
        ));
    }
    named_entry(GOOGLE_DRIVE_TOKEN_USER)?
        .set_password(&body)
        .map_err(|e| e.to_string())?;
    named_entry(GOOGLE_DRIVE_ACCOUNT_USER)?
        .set_password(account_email.trim())
        .map_err(|e| e.to_string())?;
    Ok(GoogleDriveConnection {
        connected: true,
        account_email: account_email.trim().to_string(),
        message: "Google Drive collegato. Token salvato nel portachiavi di Windows.".into(),
    })
}

#[tauri::command]
fn upload_google_drive_backup(
    file_path: String,
    client_id: String,
    client_secret: String,
) -> Result<GoogleDriveUploadResult, String> {
    let token = google_token_from_keyring()?;
    match drive_upload_file_with_token(&token.access_token, &file_path) {
        Ok(result) => Ok(result),
        Err(err) if err.contains("401") || err.contains("Unauthorized") => {
            let refreshed = refresh_google_token(&token, client_id.trim(), client_secret.trim())?;
            drive_upload_file_with_token(&refreshed.access_token, &file_path)
        }
        Err(err) => Err(err),
    }
}

fn collect_sqlite_files(folder: &std::path::Path, files: &mut Vec<std::path::PathBuf>) {
    let Ok(entries) = std::fs::read_dir(folder) else {
        return;
    };
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            collect_sqlite_files(&path, files);
        } else if path.extension().and_then(|x| x.to_str()) == Some("sqlite") {
            files.push(path);
        }
    }
}
#[tauri::command]
fn export_archive_csv(app: tauri::AppHandle, content: String) -> Result<String, String> {
    let folder = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("Gestionale Intenzioni Messe")
        .join("Esportazioni");
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let name = format!(
        "intenzioni-{}.csv",
        chrono::Local::now().format("%Y-%m-%d-%H-%M-%S")
    );
    let target = folder.join(name);
    let mut bytes = vec![0xEF, 0xBB, 0xBF];
    bytes.extend_from_slice(content.as_bytes());
    std::fs::write(&target, bytes).map_err(|e| e.to_string())?;
    Ok(target.display().to_string())
}
#[tauri::command]
fn restore_latest_backup(app: tauri::AppHandle) -> Result<(), String> {
    let pending = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("restore.pending.sqlite");
    let folder = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("Gestionale Intenzioni Messe")
        .join("Backup");
    if !folder.exists() {
        return Err("Nessun backup disponibile.".to_string());
    }
    let mut files = Vec::new();
    collect_sqlite_files(&folder, &mut files);
    files.sort();
    let latest = files.last().ok_or("Nessun backup disponibile.")?.clone();
    std::fs::copy(latest, pending).map_err(|e| e.to_string())?;
    app.restart()
}
fn apply_pending_restore() {
    let Ok(appdata) = std::env::var("APPDATA") else {
        return;
    };
    let folder = std::path::PathBuf::from(appdata).join("it.parrocchia.gestionale-intenzioni");
    let pending = folder.join("restore.pending.sqlite");
    if pending.exists() {
        let database = folder.join("gestionale.sqlite");
        let safety = folder.join("gestionale.before-restore.sqlite");
        if database.exists() {
            let _ = std::fs::copy(&database, safety);
        }
        if std::fs::rename(&pending, &database).is_err() {
            let _ = std::fs::copy(&pending, &database);
            let _ = std::fs::remove_file(pending);
        }
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    apply_pending_restore();
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:gestionale.sqlite",
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "initial schema",
                            sql: include_str!("../migrations/001_initial.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "intention integrity",
                            sql: include_str!("../migrations/002_intention_integrity.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 3,
                            description: "history and personalization",
                            sql: include_str!("../migrations/003_history_and_personalization.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 4,
                            description: "atomic history",
                            sql: include_str!("../migrations/004_atomic_history.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 5,
                            description: "audit before after",
                            sql: include_str!("../migrations/005_audit_before_after.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 6,
                            description: "receipt configuration",
                            sql: include_str!("../migrations/006_receipt_configuration.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 7,
                            description: "backup settings",
                            sql: include_str!("../migrations/007_backup_settings.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 8,
                            description: "receipt custom label",
                            sql: include_str!("../migrations/008_receipt_custom_label.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            has_password,
            set_initial_password,
            verify_password,
            change_password,
            delete_account,
            new_backup_path,
            encrypt_backup_file,
            export_archive_csv,
            restore_latest_backup,
            has_google_drive_token,
            connect_google_drive,
            upload_google_drive_backup
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio dell'applicazione");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore]
    fn google_drive_live_upload_encrypted_backup() {
        let client_id = std::env::var("VITE_GOOGLE_DRIVE_CLIENT_ID")
            .expect("VITE_GOOGLE_DRIVE_CLIENT_ID mancante");
        let client_secret = std::env::var("VITE_GOOGLE_DRIVE_CLIENT_SECRET").unwrap_or_default();
        let now = chrono::Local::now();
        let folder = std::env::temp_dir()
            .join("Gestionale Intenzioni Messe")
            .join("Backup")
            .join(now.format("%Y-%m-%d").to_string())
            .join(now.format("%H-%M").to_string());
        std::fs::create_dir_all(&folder).expect("cartella test non creata");
        let file = folder.join(format!(
            "test-verifica-upload-drive-{}.gimbackup",
            now.format("%Y-%m-%d-%H-%M-%S")
        ));
        std::fs::write(&file, b"GIMBKP1-live-test").expect("file test non creato");
        let uploaded =
            upload_google_drive_backup(file.display().to_string(), client_id, client_secret)
                .expect("upload Google Drive non riuscito");
        assert!(!uploaded.id.is_empty());
        assert!(uploaded.name.ends_with(".gimbackup"));
        assert!(uploaded
            .folder_path
            .contains("Gestionale Intenzioni Messe/Backup"));
        println!(
            "Upload Drive verificato: {} in {}",
            uploaded.name, uploaded.folder_path
        );
    }
}

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::RngCore;
use sha2::Sha256;
use tauri::Manager;
const SERVICE: &str = "it.parrocchia.gestionale-intenzioni";
const USER: &str = "admin-password-hash";
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, USER).map_err(|e| e.to_string())
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
            restore_latest_backup
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio dell'applicazione");
}

use argon2::{password_hash::{rand_core::OsRng,PasswordHash,PasswordHasher,PasswordVerifier,SaltString},Argon2};
use tauri::Manager;
const SERVICE:&str="it.parrocchia.gestionale-intenzioni";
const USER:&str="admin-password-hash";
fn entry()->Result<keyring::Entry,String>{keyring::Entry::new(SERVICE,USER).map_err(|e|e.to_string())}
#[tauri::command]
fn has_password()->bool{entry().and_then(|e|e.get_password().map_err(|x|x.to_string())).is_ok()}
#[tauri::command]
fn set_initial_password(password:String)->Result<bool,String>{
 if password.len()<8{return Err("La password deve avere almeno 8 caratteri".into())} if has_password(){return Err("Password già configurata".into())}
 let salt=SaltString::generate(&mut OsRng);let hash=Argon2::default().hash_password(password.as_bytes(),&salt).map_err(|e|e.to_string())?.to_string();
 entry()?.set_password(&hash).map_err(|e|e.to_string())?;Ok(true)
}
#[tauri::command]
fn verify_password(password:String)->bool{
 let Ok(hash)=entry().and_then(|e|e.get_password().map_err(|x|x.to_string())) else{return false};
 let Ok(parsed)=PasswordHash::new(&hash) else{return false};Argon2::default().verify_password(password.as_bytes(),&parsed).is_ok()
}
#[tauri::command]
fn change_password(current_password:String,new_password:String)->Result<bool,String>{
 if !verify_password(current_password){return Err("La password attuale non è corretta.".into())}
 if new_password.len()<8{return Err("La nuova password deve avere almeno 8 caratteri.".into())}
 let salt=SaltString::generate(&mut OsRng);
 let hash=Argon2::default().hash_password(new_password.as_bytes(),&salt).map_err(|e|e.to_string())?.to_string();
 entry()?.set_password(&hash).map_err(|e|e.to_string())?;Ok(true)
}
#[tauri::command]
fn new_backup_path(app:tauri::AppHandle)->Result<String,String>{
 let folder=app.path().document_dir().map_err(|e|e.to_string())?.join("Gestionale Intenzioni Messe").join("Backup");
 std::fs::create_dir_all(&folder).map_err(|e|e.to_string())?;
 let name=format!("gestionale-intenzioni-backup-{}.sqlite",chrono::Local::now().format("%Y-%m-%d-%H-%M-%S"));
 Ok(folder.join(name).display().to_string())
}
#[tauri::command]
fn restore_latest_backup(app:tauri::AppHandle)->Result<(),String>{
 let pending=app.path().app_data_dir().map_err(|e|e.to_string())?.join("restore.pending.sqlite");
 let folder=app.path().document_dir().map_err(|e|e.to_string())?.join("Gestionale Intenzioni Messe").join("Backup");
 let mut files=std::fs::read_dir(&folder).map_err(|_|"Nessun backup disponibile.".to_string())?.filter_map(Result::ok)
  .map(|e|e.path()).filter(|p|p.extension().and_then(|x|x.to_str())==Some("sqlite")).collect::<Vec<_>>();
 files.sort();let latest=files.last().ok_or("Nessun backup disponibile.")?.clone();
 std::fs::copy(latest,pending).map_err(|e|e.to_string())?;
 app.restart()
}
fn apply_pending_restore(){
 let Ok(appdata)=std::env::var("APPDATA") else{return};
 let folder=std::path::PathBuf::from(appdata).join("it.parrocchia.gestionale-intenzioni");
 let pending=folder.join("restore.pending.sqlite");
 if pending.exists(){
  let database=folder.join("gestionale.sqlite");
  let safety=folder.join("gestionale.before-restore.sqlite");
  if database.exists(){let _=std::fs::copy(&database,safety);}
  if std::fs::rename(&pending,&database).is_err(){let _=std::fs::copy(&pending,&database);let _=std::fs::remove_file(pending);}
 }
}
#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
 apply_pending_restore();
 tauri::Builder::default().plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:gestionale.sqlite",vec![
  tauri_plugin_sql::Migration{version:1,description:"initial schema",sql:include_str!("../migrations/001_initial.sql"),kind:tauri_plugin_sql::MigrationKind::Up},
  tauri_plugin_sql::Migration{version:2,description:"intention integrity",sql:include_str!("../migrations/002_intention_integrity.sql"),kind:tauri_plugin_sql::MigrationKind::Up}
 ]).build()).invoke_handler(tauri::generate_handler![has_password,set_initial_password,verify_password,change_password,new_backup_path,restore_latest_backup])
 .run(tauri::generate_context!()).expect("errore durante l'avvio dell'applicazione");
}

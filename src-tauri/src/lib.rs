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
fn backup_now(app:&tauri::AppHandle)->Result<String,String>{
 let source=app.path().app_data_dir().map_err(|e|e.to_string())?.join("gestionale.sqlite");
 if !source.exists(){return Err("Il database non esiste ancora.".into())}
 let folder=app.path().document_dir().map_err(|e|e.to_string())?.join("Gestionale Intenzioni Messe").join("Backup");
 std::fs::create_dir_all(&folder).map_err(|e|e.to_string())?;
 let name=format!("gestionale-intenzioni-backup-{}.sqlite",chrono::Local::now().format("%Y-%m-%d-%H-%M-%S"));
 let target=folder.join(name);std::fs::copy(source,&target).map_err(|e|e.to_string())?;
 Ok(target.display().to_string())
}
#[tauri::command]
fn create_backup(app:tauri::AppHandle)->Result<String,String>{backup_now(&app)}
#[tauri::command]
fn restore_latest_backup(app:tauri::AppHandle)->Result<(),String>{
 let source=app.path().app_data_dir().map_err(|e|e.to_string())?.join("gestionale.sqlite");
 let folder=app.path().document_dir().map_err(|e|e.to_string())?.join("Gestionale Intenzioni Messe").join("Backup");
 let mut files=std::fs::read_dir(&folder).map_err(|_|"Nessun backup disponibile.".to_string())?.filter_map(Result::ok)
  .map(|e|e.path()).filter(|p|p.extension().and_then(|x|x.to_str())==Some("sqlite")).collect::<Vec<_>>();
 files.sort();let latest=files.last().ok_or("Nessun backup disponibile.")?.clone();
 backup_now(&app)?;
 std::fs::copy(latest,source).map_err(|e|e.to_string())?;
 app.restart()
}
#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
 tauri::Builder::default().plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:gestionale.sqlite",vec![
  tauri_plugin_sql::Migration{version:1,description:"initial schema",sql:include_str!("../migrations/001_initial.sql"),kind:tauri_plugin_sql::MigrationKind::Up}
 ]).build()).invoke_handler(tauri::generate_handler![has_password,set_initial_password,verify_password,create_backup,restore_latest_backup])
 .run(tauri::generate_context!()).expect("errore durante l'avvio dell'applicazione");
}

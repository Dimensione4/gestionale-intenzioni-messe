use argon2::{password_hash::{rand_core::OsRng,PasswordHash,PasswordHasher,PasswordVerifier,SaltString},Argon2};
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
#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
 tauri::Builder::default().plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:gestionale.sqlite",vec![
  tauri_plugin_sql::Migration{version:1,description:"initial schema",sql:include_str!("../migrations/001_initial.sql"),kind:tauri_plugin_sql::MigrationKind::Up}
 ]).build()).invoke_handler(tauri::generate_handler![has_password,set_initial_password,verify_password])
 .run(tauri::generate_context!()).expect("errore durante l'avvio dell'applicazione");
}

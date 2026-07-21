import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("stile backup online",()=>{
  it("mantiene checkbox compatte e stato attivo/disattivato leggibile",()=>{
    const css=readFileSync("src/styles.css","utf8");
    const app=readFileSync("src/App.tsx","utf8");

    expect(css).toContain(".online-backup-card label.compact-check");
    expect(css).toContain("display: flex");
    expect(css).toContain("flex-direction: row");
    expect(css).toContain(".compact-check input[type=\"checkbox\"]");
    expect(css).toContain("width: 22px");
    expect(css).toContain(".status-pill");
    expect(app).toContain("Disattivato");
    expect(app).toContain("Attivo");
    expect(app).toContain("Configurazione Google rilevata");
    expect(app).toContain("connect_google_drive");
    expect(app).toContain("upload_google_drive_backup");
    expect(app).toContain("open_external_url");
    expect(app).toContain("Google Drive collegato");
    expect(app).toContain("Crea backup cifrato e carica su Drive");
    expect(app).toContain("Backup online completato");
    expect(app).toContain("Apri su Google Drive");
    expect(css).toContain(".drive-upload-result");
    expect(app).not.toContain("Prossimo step tecnico");
  });

  it("ricorda l'accesso senza salvare la password in chiaro",()=>{
    const app=readFileSync("src/App.tsx","utf8");
    const rust=readFileSync("src-tauri/src/lib.rs","utf8");
    const handlerBlock=rust.slice(rust.indexOf("tauri::generate_handler!["));

    expect(app).toContain("has_remembered_login");
    expect(app).toContain("clear_remembered_login");
    expect(rust).toContain("REMEMBERED_LOGIN_USER");
    expect(rust).toContain("new_remembered_login_token");
    expect(handlerBlock).toContain("has_remembered_login");
    expect(handlerBlock).toContain("clear_remembered_login");
  });
});

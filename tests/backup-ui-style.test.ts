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
    expect(app).toContain("Google Drive collegato");
    expect(app).not.toContain("Prossimo step tecnico");
  });
});

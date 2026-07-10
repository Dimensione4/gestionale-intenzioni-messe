import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("stile backup online",()=>{
  it("mantiene checkbox compatte e stato attivo/disattivato leggibile",()=>{
    const css=readFileSync("src/styles.css","utf8");
    const app=readFileSync("src/App.tsx","utf8");

    expect(css).toContain(".compact-check input[type=\"checkbox\"]");
    expect(css).toContain("width: 22px");
    expect(css).toContain(".status-pill");
    expect(app).toContain("Disattivato");
    expect(app).toContain("Attivo");
    expect(app).toContain("Configurazione Google rilevata");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("configurazione stampa promemoria", () => {
  it("salva e migra la grandezza delle scritte del promemoria termico", () => {
    const db = readFileSync("src/lib/db.ts", "utf8");
    const migration = readFileSync("src-tauri/migrations/010_memo_print_settings.sql", "utf8");
    const rust = readFileSync("src-tauri/src/lib.rs", "utf8");

    expect(db).toContain("memo_thermal_font_scale?:number");
    expect(db).toContain("memo_show_notes?:number");
    expect(db).toContain("memo_thermal_font_scale:115");
    expect(db).toContain("memo_show_notes:0");
    expect(db).toContain("memo_thermal_font_scale,memo_show_notes,backup_frequency_hours");
    expect(db).toContain("UPDATE parish_settings SET memo_thermal_font_scale=$1,memo_show_notes=$2");
    expect(migration).toContain("ADD COLUMN memo_thermal_font_scale INTEGER NOT NULL DEFAULT 115");
    expect(readFileSync("src-tauri/migrations/011_memo_notes_print_default.sql", "utf8")).toContain("ADD COLUMN memo_show_notes INTEGER NOT NULL DEFAULT 0");
    expect(rust).toContain("010_memo_print_settings.sql");
    expect(rust).toContain("011_memo_notes_print_default.sql");
    expect(rust).toContain("version: 10");
    expect(rust).toContain("version: 11");
  });

  it("centra il formato 80 mm e usa una scala font modificabile", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    const css = readFileSync("src/styles.css", "utf8");
    const modalCss = readFileSync("src/modal.css", "utf8");

    expect(app).toContain('margin: ${printFormat==="a4"?"12mm":"4mm"}');
    expect(app).toContain('"--memo-font-scale":(settings?.memo_thermal_font_scale??115)/100');
    expect(app).toContain("Grandezza scritte:");
    expect(app).toContain("Mostra note nella stampa del promemoria");
    expect(app).toContain("id=\"memo-show-notes\"");
    expect(css).toContain(".memo-settings-preview");
    expect(css).toContain(".memo-preview-dialog:has(#memo-show-notes:not(:checked))");
    expect(css).toContain(".memo-default-options:has(input:not(:checked))");
    expect(css).toContain("var(--memo-font-scale, 1.15)");
    expect(modalCss).toContain("margin: 0 auto");
  });
});

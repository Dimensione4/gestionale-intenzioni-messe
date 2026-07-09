import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicKey = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDg3RTFCNTM4RUEwMzJGMEQKUldRTkx3UHFPTFhoaC9uV0Q0dUdJYk1TemNpOWI4QjJaSXJ6NVdjQXdnUlY1Qk10Q1pzajBmQ0UK";

describe("configurazione updater Tauri", () => {
  it("usa la chiave pubblica generata e crea artifact updater", () => {
    const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));

    expect(config.bundle.createUpdaterArtifacts).toBe(true);
    expect(config.plugins.updater.pubkey).toBe(publicKey);
    expect(config.plugins.updater.endpoints).toContain("https://github.com/Dimensione4/gestionale-intenzioni-messe/releases/latest/download/latest.json");
    expect(config.plugins.updater.windows.installMode).toBe("passive");
  });

  it("abilita i permessi desktop necessari", () => {
    const capability = JSON.parse(readFileSync("src-tauri/capabilities/desktop.json", "utf8"));

    expect(capability.permissions).toContain("updater:default");
    expect(capability.permissions).toContain("process:allow-restart");
  });

  it("pubblica release firmate da GitHub Actions", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");

    expect(workflow).toContain("tauri-apps/tauri-action@v1");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
    expect(workflow).toContain("app-v*");
  });
});

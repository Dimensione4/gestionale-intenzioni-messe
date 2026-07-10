import { describe, expect, it } from "vitest";
import { updateCheckErrorMessage } from "../src/App";

describe("messaggi aggiornamenti",()=>{
  it("spiega quando manca latest.json nelle release GitHub",()=>{
    expect(updateCheckErrorMessage("Could not fetch a valid release JSON from the remote")).toBe("Canale aggiornamenti non ancora inizializzato: su GitHub Releases manca il file latest.json. Pubblica una release firmata e riprova.");
  });

  it("mantiene dettagli per errori non riconosciuti",()=>{
    expect(updateCheckErrorMessage("firma non valida")).toContain("firma non valida");
  });
});

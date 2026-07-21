import { describe, expect, it } from "vitest";
import { updateCheckErrorMessage } from "../src/App";

describe("messaggi aggiornamenti",()=>{
  it("nasconde dettagli tecnici quando il controllo aggiornamenti non risponde",()=>{
    const message=updateCheckErrorMessage("Could not fetch a valid release JSON from the remote");

    expect(message).toBe("Non riesco a controllare gli aggiornamenti in questo momento. Riprova più tardi.");
    expect(message).not.toMatch(/json|latest|release/i);
  });

  it("mostra un messaggio generico per errori non riconosciuti",()=>{
    expect(updateCheckErrorMessage("firma non valida")).toBe("Non riesco a controllare gli aggiornamenti in questo momento. Riprova più tardi.");
  });
});

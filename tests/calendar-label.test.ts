import { describe, expect, it } from "vitest";
import { intentionCalendarLabel } from "../src/App";

describe("etichetta intenzione nel calendario",()=>{
  it("preferisce la persona ricordata al testo completo dell'intenzione",()=>{
    expect(intentionCalendarLabel({remembered_person:"Maria Rossi",intention_text:"Ricordiamo con affetto Maria Rossi"})).toBe("Maria Rossi");
  });

  it("usa il testo come fallback se manca la persona ricordata",()=>{
    expect(intentionCalendarLabel({remembered_person:"",intention_text:"Per le anime del purgatorio"})).toBe("Per le anime del purgatorio");
  });
});

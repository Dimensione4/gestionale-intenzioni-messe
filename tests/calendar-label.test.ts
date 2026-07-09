import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { intentionCalendarLabel } from "../src/App";

describe("etichetta intenzione nel calendario",()=>{
  it("preferisce la persona ricordata al testo completo dell'intenzione",()=>{
    expect(intentionCalendarLabel({remembered_person:"Maria Rossi",intention_text:"Ricordiamo con affetto Maria Rossi"})).toBe("Maria Rossi");
  });

  it("usa il testo come fallback se manca la persona ricordata",()=>{
    expect(intentionCalendarLabel({remembered_person:"",intention_text:"Per le anime del purgatorio"})).toBe("Per le anime del purgatorio");
  });

  it("ha classi CSS per distinguere righe compilate e vuote nelle viste calendario",()=>{
    const css=`${readFileSync("src/styles.css","utf8")}\n${readFileSync("src/modal.css","utf8")}`;

    expect(css).toContain(".day-lines small.filled");
    expect(css).toContain(".monthly-list > button.has-intention");
    expect(css).toContain("overflow-y: auto");
  });
});

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { format } from "date-fns";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "../src/App";
import type { MassIntention, NewIntention, ParishSettings } from "../src/lib/db";

const settings: ParishSettings = {
  parish_name:"Test",address:"",phone:"",email:"",default_offering_cents:1500,
  max_intentions_per_mass:3,receipt_paper_size:"58mm",priest_first_name:"",
  priest_last_name:"",primary_color:"#173D61",accent_color:"#B69943",logo_data_url:"",
};
const today=format(new Date(),"yyyy-MM-dd");
const record:MassIntention={id:1,mass_date:today,mass_time:"18:00",offerer_first_name:"",offerer_last_name:"",
  offerer_phone:"",intention_text:"Ricordiamo con affetto la famiglia Rossi",remembered_person:"Famiglia Rossi",offering_cents:1500,
  payment_method:"Contanti",internal_notes:"",status:"active",receipt_number:1};

afterEach(()=>{cleanup();vi.restoreAllMocks()});

function repository(){
  return {
    list:vi.fn(async()=>[record]),
    settings:async()=>settings,
    schedules:async()=>[{weekday:new Date().getDay(),time:"18:00",max_intentions:null}],
    create:async(value:NewIntention)=>({...value,id:2,status:"active",receipt_number:2}),
  };
}

describe("viste e stampa mensile",()=>{
  it("mostra le intenzioni nella vista elenco mensile",async()=>{
    render(<Calendar repository={repository()}/>);
    fireEvent.click(screen.getByRole("button",{name:/elenco mensile/i}));
    const name=await screen.findByText("Famiglia Rossi");
    expect(name.tagName).toBe("STRONG");
    expect(name.closest("button")).toHaveClass("has-intention");
    expect(screen.queryByText("Ricordiamo con affetto la famiglia Rossi")).not.toBeInTheDocument();
    expect(screen.getByText("Registrata")).toBeInTheDocument();
  });

  it("stampa il mese con l'opzione offerte",async()=>{
    const repo=repository(),print=vi.spyOn(window,"print").mockImplementation(()=>undefined);
    render(<Calendar repository={repo}/>);
    fireEvent.click(screen.getByRole("button",{name:/stampa elenco/i}));
    const dialog=screen.getByRole("dialog",{name:/stampa elenco intenzioni/i});
    fireEvent.click(within(dialog).getByLabelText(/includi importi/i));
    fireEvent.click(within(dialog).getByRole("button",{name:/stampa elenco/i}));
    await waitFor(()=>expect(repo.list).toHaveBeenCalled());
    await waitFor(()=>expect(print).toHaveBeenCalled());
    expect(within(dialog).getByText("€ 15.00")).toBeInTheDocument();
  });
  it("aggiorna il report prima di aprire la stampa del periodo selezionato",async()=>{
    const print=vi.spyOn(window,"print").mockImplementation(()=>undefined);
    const repo={
      ...repository(),
      list:vi.fn(async(from:string,to:string)=>[
        {...record,id:11,mass_date:from,mass_time:"08:00",remembered_person:"Prima persona",intention_text:"Prima persona"},
        {...record,id:12,mass_date:to,mass_time:"20:30",remembered_person:"Ultima persona",intention_text:"Ultima persona"},
      ]),
    };
    render(<Calendar repository={repo}/>);
    fireEvent.click(screen.getByRole("button",{name:/stampa elenco/i}));
    const dialog=screen.getByRole("dialog",{name:/stampa elenco intenzioni/i});
    fireEvent.click(within(dialog).getByLabelText(/intervallo personalizzato/i));
    fireEvent.change(within(dialog).getByLabelText(/^dal giorno$/i),{target:{value:"2026-07-18"}});
    fireEvent.change(within(dialog).getByLabelText(/^al giorno$/i),{target:{value:"2026-07-31"}});
    fireEvent.click(within(dialog).getByRole("button",{name:/stampa elenco/i}));

    await waitFor(()=>expect(print).toHaveBeenCalled());
    expect(repo.list).toHaveBeenLastCalledWith("2026-07-18","2026-07-31");
    expect(within(dialog).getAllByText("Prima persona")).toHaveLength(2);
    expect(within(dialog).getAllByText("Ultima persona")).toHaveLength(2);
    expect(within(dialog).getByText("Periodo: dal 2026-07-18 al 2026-07-31")).toBeInTheDocument();
  });

  it("prevede stampa settimanale e formato stampantina",async()=>{
    const repo=repository(),print=vi.spyOn(window,"print").mockImplementation(()=>undefined);
    render(<Calendar repository={repo}/>);
    fireEvent.click(screen.getByRole("button",{name:/stampa elenco/i}));
    const dialog=screen.getByRole("dialog",{name:/stampa elenco intenzioni/i});

    expect(within(dialog).getByRole("radio",{name:/^settimana$/i})).toBeChecked();
    fireEvent.click(within(dialog).getByLabelText(/stampantina 80 mm/i));
    fireEvent.click(within(dialog).getByRole("button",{name:/stampa elenco/i}));

    await waitFor(()=>expect(print).toHaveBeenCalled());
    expect(dialog.querySelector(".print-report.thermal")).toBeTruthy();
    expect(dialog.querySelector("[data-report-page-size]")?.textContent).toContain("80mm 200mm");
  });

  it("isola il report di stampa e non ripete l'intestazione della tabella su ogni pagina",()=>{
    const modalCss=readFileSync("src/modal.css","utf8");
    const styles=readFileSync("src/styles.css","utf8");

    expect(modalCss).toContain("body:has(.print-dialog) .modal-backdrop { position: static;");
    expect(modalCss).toContain("body:has(.print-dialog) .print-report { position: static;");
    expect(modalCss).not.toContain(".print-report { display: block; position: absolute;");
    expect(styles).toContain(".print-report thead { display: table-row-group; }");
  });
});

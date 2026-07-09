import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { format } from "date-fns";
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
    expect(await screen.findByText("Famiglia Rossi")).toBeInTheDocument();
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
});

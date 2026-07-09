import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Archive } from "../src/App";
import type { MassIntention } from "../src/lib/db";

afterEach(cleanup);

describe("archivio con ricevuta mancante",()=>{
  it("propone di eliminare l'intenzione invece di annullare una ricevuta inesistente",async()=>{
    const orphan:MassIntention={id:7,mass_date:"2026-07-09",mass_time:"18:00",offerer_first_name:"",
      offerer_last_name:"",offerer_phone:"",intention_text:"Record precedente",remembered_person:"",
      offering_cents:1500,payment_method:"Contanti",internal_notes:"",status:"active",receipt_number:null};
    const repository={list:async()=>[orphan],logs:async()=>[],cancel:vi.fn(),remove:vi.fn(),restore:vi.fn()};
    render(<Archive settings={null} repository={repository}/>);

    expect(await screen.findByText("Senza ricevuta")).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:/annulla ricevuta/i})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/elimina intenzione/i}));
    expect(screen.getByRole("alertdialog",{name:/eliminare questa intenzione/i})).toBeInTheDocument();
  });

  it("chiede il motivo e annulla una ricevuta esistente",async()=>{
    const item:MassIntention={id:8,mass_date:"2026-07-09",mass_time:"18:00",offerer_first_name:"",
      offerer_last_name:"",offerer_phone:"",intention_text:"Con ricevuta",remembered_person:"",
      offering_cents:1500,payment_method:"Contanti",internal_notes:"",status:"active",receipt_number:42,receipt_status:"valid"};
    const cancel=vi.fn(async()=>undefined);
    const repository={list:async()=>[item],logs:async()=>[],cancel,remove:vi.fn(),restore:vi.fn()};
    render(<Archive settings={null} repository={repository}/>);

    fireEvent.click(await screen.findByRole("button",{name:/annulla ricevuta/i}));
    const dialog=screen.getByRole("alertdialog",{name:/annullare questa ricevuta/i});
    fireEvent.change(within(dialog).getByLabelText(/motivo dell’annullamento/i),{target:{value:"Ricevuta errata"}});
    fireEvent.click(within(dialog).getByRole("button",{name:/annulla ricevuta/i}));

    await vi.waitFor(()=>expect(cancel).toHaveBeenCalledWith(8,"Ricevuta errata"));
    expect(dialog).toHaveTextContent("ricevuta n. 42");
  });
});

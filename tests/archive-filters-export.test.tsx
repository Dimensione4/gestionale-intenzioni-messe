import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Archive } from "../src/App";
import type { MassIntention } from "../src/lib/db";

afterEach(cleanup);

const intention=(id:number,receipt:number|null,date:string,status:"active"|"deleted"="active"):MassIntention=>({
  id,mass_date:date,mass_time:"18:00",offerer_first_name:"Mario",offerer_last_name:"Rossi",
  offerer_phone:"",intention_text:`Intenzione ${id}`,remembered_person:`Persona ${id}`,
  offering_cents:1500,payment_method:"Contanti",internal_notes:"",status,receipt_number:receipt,
  receipt_status:"valid",
});

describe("filtri ed esportazione archivio",()=>{
  it("ordina le ricevute in modo crescente e separa il cestino",async()=>{
    const records=[intention(4,4,"2026-07-08"),intention(1,1,"2026-07-09"),intention(2,2,"2026-07-07"),intention(9,null,"2026-07-06","deleted")];
    const repository={list:async()=>records,logs:async()=>[],cancel:vi.fn(),remove:vi.fn(),restore:vi.fn()};
    render(<Archive settings={null} repository={repository}/>);

    const receipts=await screen.findAllByText(/Ricevuta n\./);
    expect(receipts.map(node=>node.textContent)).toEqual(["Ricevuta n. 1","Ricevuta n. 2","Ricevuta n. 4"]);
    expect(screen.getByText("In memoria di Persona 1")).toBeInTheDocument();
    expect(screen.queryByText("Intenzione 9")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button",{name:/cestino/i}));
    expect(await screen.findByText("Intenzione 9")).toBeInTheDocument();
    expect(screen.queryByText("Intenzione 1")).not.toBeInTheDocument();
  });

  it("crea un file compatibile con Excel e comunica dove è stato salvato",async()=>{
    const exporter=vi.fn(async()=>String.raw`C:\Documenti\intenzioni.csv`);
    const repository={list:async()=>[intention(1,1,"2026-07-09")],logs:async()=>[],cancel:vi.fn(),remove:vi.fn(),restore:vi.fn(),exporter};
    render(<Archive settings={null} repository={repository}/>);

    fireEvent.click(await screen.findByRole("button",{name:/esporta per excel/i}));
    await vi.waitFor(()=>expect(exporter).toHaveBeenCalledOnce());
    expect(exporter.mock.calls[0][0]).toContain('"Persona ricordata"');
    expect(exporter.mock.calls[0][0]).toContain('"Persona 1"');
    expect(await screen.findByRole("status")).toHaveTextContent(String.raw`C:\Documenti\intenzioni.csv`);
  });
});

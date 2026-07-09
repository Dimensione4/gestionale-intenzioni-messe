import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Archive, receiptPageHeightMm } from "../src/App";
import type { MassIntention, ParishSettings } from "../src/lib/db";

afterEach(cleanup);

describe("anteprima ricevuta",()=>{
  it("calcola una pagina termica alta quanto il contenuto",()=>{
    expect(receiptPageHeightMm(480)).toBe(131);
    expect(receiptPageHeightMm(0)).toBe(80);
  });

  it("rispetta la configurazione ed evita comandi di chiusura duplicati",async()=>{
    const item:MassIntention={id:1,mass_date:"2026-07-09",mass_time:"18:00",offerer_first_name:"Mario",offerer_last_name:"Rossi",offerer_phone:"",intention_text:"Per Anna",remembered_person:"Anna",offering_cents:1500,payment_method:"Contanti",internal_notes:"",status:"active",receipt_number:12,receipt_status:"valid"};
    const settings:ParishSettings={parish_name:"San Giovanni",address:"Via Roma 1",phone:"0123",email:"parrocchia@example.it",default_offering_cents:1500,max_intentions_per_mass:3,receipt_paper_size:"58mm",priest_first_name:"Paolo",priest_last_name:"Bianchi",primary_color:"#173D61",accent_color:"#B69943",logo_data_url:"",receipt_show_address:1,receipt_show_contacts:0,receipt_show_priest:1,receipt_show_offerer:1,receipt_show_intention:1,receipt_show_mass:1,receipt_show_offering:0,receipt_custom_message:"La parrocchia ringrazia"};
    const repository={list:async()=>[item],logs:async()=>[],cancel:vi.fn(),remove:vi.fn(),restore:vi.fn()};
    const configureReceipt=vi.fn();
    render(<Archive settings={settings} repository={repository} configureReceipt={configureReceipt}/>);

    fireEvent.click(await screen.findByRole("button",{name:/anteprima e stampa/i}));
    const dialog=screen.getByRole("dialog",{name:/anteprima ricevuta/i});
    expect(dialog).toHaveTextContent("San Giovanni");
    expect(dialog).toHaveTextContent("Parroco: Don Paolo Bianchi");
    expect(dialog).toHaveTextContent("La parrocchia ringrazia");
    expect(dialog).not.toHaveTextContent("parrocchia@example.it");
    expect(dialog).not.toHaveTextContent("Offerta");
    expect(screen.getAllByRole("button",{name:/chiudi/i})).toHaveLength(1);

    fireEvent.click(screen.getByRole("button",{name:/configura ricevuta/i}));
    expect(configureReceipt).toHaveBeenCalledOnce();
  });

  it("stampa telefono ed email su righe spezzabili per non uscire dalla ricevuta",async()=>{
    const item:MassIntention={id:1,mass_date:"2026-07-09",mass_time:"18:00",offerer_first_name:"Maria Vittoria",offerer_last_name:"Bolognini",offerer_phone:"",intention_text:"Ricordiamo La nostra amata Teresa...",remembered_person:"Teresa",offering_cents:1500,payment_method:"Contanti",internal_notes:"",status:"active",receipt_number:1,receipt_status:"valid"};
    const settings:ParishSettings={parish_name:"La tua Parrocchia",address:"via Roma 2",phone:"3333333333",email:"darionmarco.bellini@dimensione.it",default_offering_cents:1500,max_intentions_per_mass:3,receipt_paper_size:"58mm",priest_first_name:"Don Dario",priest_last_name:"Bellini",primary_color:"#173D61",accent_color:"#B69943",logo_data_url:"",receipt_show_address:1,receipt_show_contacts:1,receipt_show_priest:1,receipt_show_offerer:1,receipt_show_intention:1,receipt_show_mass:1,receipt_show_offering:1,receipt_custom_message:"Grazie"};
    const repository={list:async()=>[item],logs:async()=>[],cancel:vi.fn(),remove:vi.fn(),restore:vi.fn()};
    render(<Archive settings={settings} repository={repository}/>);

    fireEvent.click(await screen.findByRole("button",{name:/anteprima e stampa/i}));

    const phone=screen.getByText("3333333333");
    const email=screen.getByText("darionmarco.bellini@dimensione.it");
    expect(phone).toHaveClass("receipt-contact");
    expect(email).toHaveClass("receipt-contact");
    expect(phone.parentElement).toBe(email.parentElement);
    expect(phone.nextSibling).toBe(email);
  });

  it("in stampa rimuove dal layout il gestionale sotto la ricevuta",()=>{
    const css=readFileSync("src/modal.css","utf8");

    expect(css).toContain("body:has(.receipt-dialog) .shell > aside");
    expect(css).toContain("body:has(.receipt-dialog) main > section > :not(.modal-backdrop)");
    expect(css).toContain("display: none !important");
    expect(css).toContain("body:has(.receipt-dialog) .receipt { position: static");
  });
});

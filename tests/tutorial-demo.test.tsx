import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TutorialPage } from "../src/App";

afterEach(cleanup);

describe("tutorial guidato",()=>{
  it("mostra una demo automatica per ogni capitolo",()=>{
    render(<TutorialPage openSection={vi.fn()}/>);

    fireEvent.click(screen.getAllByRole("button",{name:/vedi demo/i})[0]);

    const dialog=screen.getByRole("dialog",{name:/calendario/i});
    expect(within(dialog).getByText(/Vista mese/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Le giornate mostrano orari disponibili/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Luglio 2026/i)).toBeInTheDocument();
  });

  it("apre la sezione reale collegata al tutorial",()=>{
    const openSection=vi.fn();
    render(<TutorialPage openSection={openSection}/>);

    fireEvent.click(screen.getByRole("button",{name:/apri backup/i}));

    expect(openSection).toHaveBeenCalledWith({page:"settings",settingsStart:"backup"});
  });
});

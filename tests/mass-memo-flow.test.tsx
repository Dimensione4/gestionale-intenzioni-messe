import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar, Memos, memoPrintTitle } from "../src/App";
import type { MassMemo, NewIntention } from "../src/lib/db";

const settings = {
  parish_name: "Parrocchia di test",
  address: "",
  phone: "",
  email: "",
  default_offering_cents: 1500,
  max_intentions_per_mass: 3,
  receipt_paper_size: "58mm" as const,
  priest_first_name: "",
  priest_last_name: "",
  primary_color: "#173D61",
  accent_color: "#B69943",
  logo_data_url: "",
};

afterEach(cleanup);

describe("promemoria celebrazione messe", () => {
  it("salva ogni riga come intenzione reale nella data del calendario", async () => {
    const createMemo = vi.fn(async (values: NewIntention[]): Promise<MassMemo> => ({
      id: 12,
      offerer_first_name: values[0].offerer_first_name,
      offerer_last_name: values[0].offerer_last_name,
      offerer_phone: values[0].offerer_phone,
      offering_cents: values[0].offering_cents,
      payment_method: values[0].payment_method,
      status: "active",
      created_at: "",
      updated_at: "",
      items: values.map((value, index) => ({
        id: index + 1,
        ...value,
        status: "active",
        receipt_number: index + 1,
        receipt_status: "valid",
      })),
    }));
    const repository = {
      list: vi.fn(async () => []),
      settings: vi.fn(async () => settings),
      create: vi.fn(),
      createMemo,
    };

    render(<Calendar repository={repository} />);

    fireEvent.click(await screen.findByRole("button", { name: /nuovo promemoria/i }));
    fireEvent.change(screen.getByLabelText(/^nome offerente$/i), { target: { value: "Don" } });
    fireEvent.change(screen.getByLabelText(/^cognome offerente$/i), { target: { value: "Giacomo" } });

    fireEvent.change(screen.getByLabelText(/giorno riga 1/i), { target: { value: "2027-04-15" } });
    fireEvent.change(screen.getByLabelText(/a ricordo di riga 1/i), { target: { value: "Famiglia Rossi" } });
    fireEvent.change(screen.getByLabelText(/giorno riga 2/i), { target: { value: "2027-10-12" } });
    fireEvent.change(screen.getByLabelText(/a ricordo di riga 2/i), { target: { value: "Maria Bianchi" } });
    fireEvent.change(screen.getByLabelText(/giorno riga 3/i), { target: { value: "2027-11-16" } });
    fireEvent.change(screen.getByLabelText(/a ricordo di riga 3/i), { target: { value: "Luigi Verdi" } });

    fireEvent.click(screen.getByRole("button", { name: /controlla promemoria/i }));

    expect(createMemo).not.toHaveBeenCalled();
    const draftDialog = await screen.findByRole("dialog", { name: /promemoria pronto/i });
    expect(draftDialog).toHaveTextContent("Famiglia Rossi");
    expect(within(draftDialog).getByRole("button", { name: /indietro e modifica/i })).toBeInTheDocument();
    fireEvent.click(within(draftDialog).getByRole("button", { name: /conferma e salva/i }));
    await waitFor(() => expect(createMemo).toHaveBeenCalledTimes(1));
    expect(createMemo).toHaveBeenCalledWith([
      expect.objectContaining({ mass_date: "2027-04-15", remembered_person: "Famiglia Rossi", offerer_first_name: "Don", offerer_last_name: "Giacomo" }),
      expect.objectContaining({ mass_date: "2027-10-12", remembered_person: "Maria Bianchi" }),
      expect.objectContaining({ mass_date: "2027-11-16", remembered_person: "Luigi Verdi" }),
    ], 3);
    expect(await screen.findByRole("dialog", { name: /promemoria pronto/i })).toHaveTextContent("Famiglia Rossi");
    expect(screen.getAllByRole("button", { name: /^chiudi$/i })).toHaveLength(1);
  });

  it("blocca il promemoria quando manca la persona ricordata", async () => {
    const createMemo = vi.fn();
    render(<Calendar repository={{ list: vi.fn(async () => []), settings: vi.fn(async () => settings), create: vi.fn(), createMemo }} />);

    fireEvent.click(await screen.findByRole("button", { name: /nuovo promemoria/i }));
    fireEvent.change(screen.getByLabelText(/^nome offerente$/i), { target: { value: "Don" } });
    fireEvent.change(screen.getByLabelText(/giorno riga 1/i), { target: { value: "2027-04-15" } });
    fireEvent.click(screen.getByRole("button", { name: /controlla promemoria/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("servono data, ora e persona ricordata");
    expect(createMemo).not.toHaveBeenCalled();
  });

  it("prepara un titolo PDF dinamico per il promemoria", () => {
    expect(memoPrintTitle([
      { mass_date: "2027-11-16" },
      { mass_date: "2027-04-15" },
    ], "Don Giacomo")).toBe("Promemoria messe - Don Giacomo - 2027-04-15");
  });

  it("permette di non registrare la quota e scegliere il formato stampantina del promemoria", async () => {
    const createMemo = vi.fn(async (values: NewIntention[]): Promise<MassMemo> => ({
      id: 14,
      offerer_first_name: values[0].offerer_first_name,
      offerer_last_name: values[0].offerer_last_name,
      offerer_phone: values[0].offerer_phone,
      offering_cents: values[0].offering_cents,
      payment_method: values[0].payment_method,
      status: "active",
      created_at: "",
      updated_at: "",
      items: values.map((value, index) => ({ id: index + 1, ...value, status: "active", receipt_number: index + 1, receipt_status: "valid" })),
    }));
    render(<Calendar repository={{ list: vi.fn(async () => []), settings: vi.fn(async () => settings), create: vi.fn(), createMemo }} />);

    fireEvent.click(await screen.findByRole("button", { name: /nuovo promemoria/i }));
    fireEvent.change(screen.getByLabelText(/^nome offerente$/i), { target: { value: "Don" } });
    fireEvent.change(screen.getByLabelText(/^cognome offerente$/i), { target: { value: "Giacomo" } });
    fireEvent.click(screen.getByLabelText(/registra quota/i));
    fireEvent.change(screen.getByLabelText(/giorno riga 1/i), { target: { value: "2027-04-15" } });
    fireEvent.change(screen.getByLabelText(/a ricordo di riga 1/i), { target: { value: "Famiglia Rossi" } });
    fireEvent.click(screen.getByRole("button", { name: /controlla promemoria/i }));
    fireEvent.click(await screen.findByRole("button", { name: /conferma e salva/i }));

    await waitFor(() => expect(createMemo).toHaveBeenCalled());
    expect(createMemo.mock.calls[0][0][0]).toEqual(expect.objectContaining({ offering_cents: 0 }));

    const dialog = await screen.findByRole("dialog", { name: /promemoria pronto/i });
    expect(within(dialog).queryByRole("columnheader", { name: /quota/i })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText(/stampantina 80 mm/i));
    expect(dialog.querySelector(".memo-print.thermal")).toBeTruthy();
    expect(dialog.querySelector("[data-memo-page-size]")?.textContent).toContain("80mm 200mm");
    expect(within(dialog).getByRole("columnheader", { name: /^data$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("columnheader", { name: /^ricordo$/i })).toBeInTheDocument();
  });

  it("compatta il promemoria termico per non ritagliare la tabella sugli 80 mm", () => {
    const css = readFileSync("src/styles.css", "utf8");
    const modalCss = readFileSync("src/modal.css", "utf8");

    expect(css).toContain(".memo-print.thermal { width: 72mm;");
    expect(css).toContain(".memo-print.thermal table { font-size: 8.2px;");
    expect(css).toContain(".memo-print.thermal th { font-size: 6.8px;");
    expect(css).toContain(".memo-print.thermal .memo-offering-col { width: 10mm; }");
    expect(modalCss).toContain(".memo-print.thermal { width: 72mm; }");
  });

  it("mostra storico promemoria con ristampa, modifica ed eliminazione in blocco", async () => {
    const memo: MassMemo = {
      id: 8,
      offerer_first_name: "Don",
      offerer_last_name: "Giacomo",
      offerer_phone: "333",
      offering_cents: 1500,
      payment_method: "Contanti",
      status: "active",
      created_at: "",
      updated_at: "",
      items: [
        { id: 1, mass_date: "2027-04-15", mass_time: "18:00", remembered_person: "Famiglia Rossi", intention_text: "A ricordo di Famiglia Rossi", offerer_first_name: "Don", offerer_last_name: "Giacomo", offerer_phone: "333", offering_cents: 1500, payment_method: "Contanti", internal_notes: "", status: "active", receipt_number: 1, receipt_status: "valid" },
        { id: 2, mass_date: "2027-10-12", mass_time: "10:00", remembered_person: "Maria Bianchi", intention_text: "A ricordo di Maria Bianchi", offerer_first_name: "Don", offerer_last_name: "Giacomo", offerer_phone: "333", offering_cents: 1500, payment_method: "Contanti", internal_notes: "nota", status: "active", receipt_number: 2, receipt_status: "valid" },
      ],
    };
    const remove = vi.fn(async () => undefined);
    const repository = { list: vi.fn(async () => [memo]), remove };

    render(<Memos repository={repository} intentionRepository={{ list: vi.fn(), settings: vi.fn(async () => settings), create: vi.fn() }} />);

    expect(await screen.findByRole("heading", { name: /storico promemoria/i })).toBeInTheDocument();
    expect(screen.getByText("Don Giacomo")).toBeInTheDocument();
    expect(screen.getByText("Famiglia Rossi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /stampa/i }));
    expect(await screen.findByRole("dialog", { name: /promemoria pronto/i })).toHaveTextContent("Maria Bianchi");
    fireEvent.click(screen.getByRole("button", { name: /^chiudi$/i }));

    fireEvent.click(screen.getByRole("button", { name: /modifica/i }));
    expect(await screen.findByRole("dialog", { name: /modifica promemoria/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /chiudi/i }));

    fireEvent.click(screen.getByRole("button", { name: /elimina tutto/i }));
    fireEvent.change(await screen.findByLabelText(/motivo/i), { target: { value: "test" } });
    fireEvent.click(screen.getByRole("button", { name: /elimina promemoria/i }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(8, "test"));
  });

  it("mantiene la modale larga, azioni distanziate e cestino compatto", () => {
    const css = readFileSync("src/styles.css", "utf8");

    expect(css).toContain(".memo-dialog { width: min(1420px, 96vw); }");
    expect(css).toContain(".memo-row > * { min-width: 0; }");
    expect(css).toContain(".memo-actions { margin-top: 28px;");
    expect(css).toContain("border-top: 3px solid");
    expect(css).toContain(".memo-remove-button");
    expect(css).toContain("border-radius: 999px");
    expect(css).toContain(".month .month-prev");
    expect(css).toContain(".month .month-next");
    expect(css).toContain(".calendar-saint");

    const modalCss = readFileSync("src/modal.css", "utf8");
    expect(modalCss).toContain(".dialog { width: min(980px, 96vw);");
    expect(modalCss).toContain("overflow-x: hidden");
    expect(modalCss).toContain(".dialog.memo-dialog { width: min(1420px, 96vw); }");
  });
});

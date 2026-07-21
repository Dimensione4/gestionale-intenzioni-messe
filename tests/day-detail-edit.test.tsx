import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "../src/App";
import type { MassIntention, NewIntention, ParishSettings } from "../src/lib/db";

const settings: ParishSettings = {
  parish_name: "Parrocchia test", address: "", phone: "", email: "",
  default_offering_cents: 1500, max_intentions_per_mass: 3, receipt_paper_size: "58mm",
  priest_first_name: "", priest_last_name: "", primary_color: "#173D61", accent_color: "#B69943", logo_data_url: "",
};
afterEach(cleanup);

describe("dettaglio giornata", () => {
  it("mostra le fasce orarie e permette di modificare un'intenzione", async () => {
    const date = format(new Date(), "yyyy-MM-dd");
    let record: MassIntention = {
      id: 1, mass_date: date, mass_time: "18:00", offerer_first_name: "Mario",
      offerer_last_name: "Rossi", offerer_phone: "", intention_text: "Prima intenzione",
      remembered_person: "Prima persona", offering_cents: 1500, payment_method: "Contanti",
      internal_notes: "", status: "active", receipt_number: 1, receipt_status: "valid",
    };
    const update = vi.fn(async (_id: number, value: NewIntention) => { record = { ...record, ...value }; });
    const repository = {
      list: async () => [record],
      settings: async () => settings,
      schedules: async () => [{ weekday: new Date().getDay(), time: "18:00", max_intentions: null }],
      create: async (value: NewIntention) => ({ ...value, id: 2, status: "active", receipt_number: 2 }),
      update,
    };

    render(<Calendar repository={repository} />);
    const day = String(new Date().getDate());
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${day}\\b`) }));

    expect(await screen.findByText("1 / 3 intenzioni")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /modifica/i }));
    const dialog = screen.getByRole("dialog", { name: /modifica intenzione/i });
    fireEvent.change(within(dialog).getByLabelText(/testo intenzione/i), { target: { value: "Intenzione corretta" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /salva modifiche/i }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(1, expect.objectContaining({ intention_text: "Intenzione corretta" })));
    expect(await screen.findByText("Intenzione corretta")).toBeInTheDocument();
  });

  it("chiede una conferma motivata prima di eliminare", async () => {
    const date = format(new Date(), "yyyy-MM-dd");
    const record: MassIntention = {
      id: 1, mass_date: date, mass_time: "18:00", offerer_first_name: "",
      offerer_last_name: "", offerer_phone: "", intention_text: "Da eliminare",
      remembered_person: "Persona da eliminare", offering_cents: 1500, payment_method: "Contanti",
      internal_notes: "", status: "active", receipt_number: 1,
    };
    const repository = {
      list: async () => [record], settings: async () => settings,
      schedules: async () => [{ weekday: new Date().getDay(), time: "18:00", max_intentions: null }],
      create: async (value: NewIntention) => ({ ...value, id: 2, status: "active", receipt_number: 2 }),
    };
    render(<Calendar repository={repository} />);
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${new Date().getDate()}\\b`) }));
    fireEvent.click(await screen.findByRole("button", { name: /elimina/i }));

    const confirmation = screen.getByRole("alertdialog", { name: /eliminare questa intenzione/i });
    expect(within(confirmation).getByLabelText(/motivo/i)).toBeRequired();
    expect(within(confirmation).getByText(/potrà essere ripristinata/i)).toBeInTheDocument();
  });
});

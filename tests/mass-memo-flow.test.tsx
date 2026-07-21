import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar, memoPrintTitle } from "../src/App";
import type { NewIntention } from "../src/lib/db";

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
    const create = vi.fn(async (value: NewIntention) => ({
      id: create.mock.calls.length,
      ...value,
      status: "active",
      receipt_number: create.mock.calls.length,
      receipt_status: "valid",
    }));
    const repository = {
      list: vi.fn(async () => []),
      settings: vi.fn(async () => settings),
      create,
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

    fireEvent.click(screen.getByRole("button", { name: /salva promemoria/i }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(3));
    expect(create).toHaveBeenNthCalledWith(1, expect.objectContaining({ mass_date: "2027-04-15", remembered_person: "Famiglia Rossi", offerer_first_name: "Don", offerer_last_name: "Giacomo" }), 3);
    expect(create).toHaveBeenNthCalledWith(2, expect.objectContaining({ mass_date: "2027-10-12", remembered_person: "Maria Bianchi" }), 3);
    expect(create).toHaveBeenNthCalledWith(3, expect.objectContaining({ mass_date: "2027-11-16", remembered_person: "Luigi Verdi" }), 3);
    expect(await screen.findByRole("dialog", { name: /promemoria pronto/i })).toHaveTextContent("Famiglia Rossi");
  });

  it("prepara un titolo PDF dinamico per il promemoria", () => {
    expect(memoPrintTitle([
      { mass_date: "2027-11-16", offerer_first_name: "Don", offerer_last_name: "Giacomo" },
      { mass_date: "2027-04-15", offerer_first_name: "Don", offerer_last_name: "Giacomo" },
    ], "Don Giacomo")).toBe("Promemoria messe - Don Giacomo - 2027-04-15");
  });
});

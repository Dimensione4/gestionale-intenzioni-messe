import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Calendar } from "../../src/App";
import type { MassIntention, NewIntention, ParishSettings } from "../../src/lib/db";

const settings: ParishSettings = {
  parish_name: "Parrocchia test",
  address: "",
  phone: "",
  email: "",
  default_offering_cents: 1500,
  max_intentions_per_mass: 3,
  receipt_paper_size: "58mm",
  priest_first_name: "", priest_last_name: "", primary_color: "#173D61", accent_color: "#B69943", logo_data_url: "",
};

describe("diagnostica: intenzione salvata visibile nel calendario", () => {
  it("mostra nel box del giorno la riga appena salvata", async () => {
    const saved: MassIntention[] = [];
    const repository = {
      list: async (from: string, to: string) =>
        saved.filter(({ mass_date }) => mass_date >= from && mass_date <= to),
      settings: async () => settings,
      create: async (intention: NewIntention) => {
        const record: MassIntention = {
          ...intention,
          id: saved.length + 1,
          receipt_number: saved.length + 1,
          status: "active",
        };
        saved.push(record);
        return record;
      },
    };

    render(<Calendar repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: /aggiungi intenzione/i }));

    const dialog = screen.getByRole("dialog", { name: /nuova intenzione/i });
    const selectedDate = (within(dialog).getByLabelText(/data messa/i) as HTMLInputElement).value;
    fireEvent.change(within(dialog).getByLabelText(/testo intenzione/i), {
      target: { value: "In memoria di Mario Rossi" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /salva intenzione/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /nuova intenzione/i })).not.toBeInTheDocument(),
    );
    const day = Number(selectedDate.slice(-2));
    const dayBox = screen.getByRole("button", { name: new RegExp(`^${day}\\b`) });

    expect(within(dayBox).getByText("In memoria di Mario Rossi")).toBeInTheDocument();
  });
});

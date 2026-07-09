import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { format } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "../src/App";
import type { NewIntention } from "../src/lib/db";

const settings = {
  parish_name: "Parrocchia di test",
  address: "",
  phone: "",
  email: "",
  default_offering_cents: 1500,
  max_intentions_per_mass: 3,
  receipt_paper_size: "58mm" as const,
};

afterEach(cleanup);

describe("flusso intenzione dal calendario", () => {
  it("salva i dati compilati e aggiorna il calendario", async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const list = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          id: 1,
          mass_date: today,
          mass_time: "18:00",
          intention_text: "Per Maria Rossi",
        },
      ]);
    const create = vi.fn(async (value: NewIntention, _maximum: number) => ({
      id: 1,
      ...value,
    }));
    const repository = {
      list,
      settings: vi.fn(async () => settings),
      create,
    };

    render(<Calendar repository={repository} />);
    fireEvent.click(
      screen.getByRole("button", { name: /aggiungi intenzione/i }),
    );
    fireEvent.change(screen.getByLabelText(/testo intenzione/i), {
      target: { value: "Per Maria Rossi" },
    });
    fireEvent.change(screen.getByLabelText(/^nome offerente$/i), {
      target: { value: "Giuseppe" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /salva intenzione/i }),
    );

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mass_date: today,
        mass_time: "18:00",
        offerer_first_name: "Giuseppe",
        intention_text: "Per Maria Rossi",
        offering_cents: 1500,
      }),
      3,
    );
    await waitFor(() =>
      expect(screen.getByText("Per Maria Rossi")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("dialog", { name: /nuova intenzione/i }),
    ).not.toBeInTheDocument();
  });

  it("mostra l'errore del limite e mantiene aperto il modulo", async () => {
    const repository = {
      list: vi.fn(async () => []),
      settings: vi.fn(async () => settings),
      create: vi.fn(async () => {
        throw new Error("Limite di 3 intenzioni raggiunto per questa messa.");
      }),
    };

    render(<Calendar repository={repository} />);
    fireEvent.click(
      screen.getByRole("button", { name: /aggiungi intenzione/i }),
    );
    fireEvent.change(screen.getByLabelText(/testo intenzione/i), {
      target: { value: "Per Luigi Bianchi" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /salva intenzione/i }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Limite di 3 intenzioni raggiunto");
    expect(
      screen.getByRole("dialog", { name: /nuova intenzione/i }),
    ).toBeInTheDocument();
  });
});

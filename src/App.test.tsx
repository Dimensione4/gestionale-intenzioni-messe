import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Calendar } from "./App";

describe("calendario", () => {
  it("apre il modulo per aggiungere un'intenzione", () => {
    const repository = {
      list: async () => [],
      settings: async () => ({ parish_name:"Test",address:"",phone:"",email:"",default_offering_cents:1500,max_intentions_per_mass:3,receipt_paper_size:"58mm" as const }),
      create: async (value: import("./lib/db").NewIntention) => ({...value,id:1,status:"active",receipt_number:1}),
    };
    render(<Calendar repository={repository} />);
    fireEvent.click(screen.getByRole("button", { name: /aggiungi intenzione/i }));
    expect(screen.getByRole("dialog", { name: /nuova intenzione/i })).toBeInTheDocument();
  });
});

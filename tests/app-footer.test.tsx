import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppFooter } from "../src/App";

describe("footer applicazione",()=>{
  it("mostra diritti, versione e contatti dello sviluppatore",async()=>{
    render(<AppFooter versionLoader={async()=>"1.2.3"}/>);

    expect(screen.getByText(/Dimensione 4 di Dario Marco Bellini/i)).toBeInTheDocument();
    await waitFor(()=>expect(screen.getByText(/v1\.2\.3/i)).toBeInTheDocument());
    expect(screen.getByRole("link",{name:/dario\.bellini@dimensione4\.it/i})).toHaveAttribute("href","mailto:dario.bellini@dimensione4.it");
    expect(screen.getByRole("link",{name:/whatsapp/i})).toHaveAttribute("href","https://wa.me/393334404903");
    expect(screen.getByRole("link",{name:/www\.dimensione4\.it/i})).toHaveAttribute("href","https://www.dimensione4.it");
  });
});

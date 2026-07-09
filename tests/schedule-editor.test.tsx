import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({
  load:vi.fn(async()=>[{weekday:6,time:"18:18",max_intentions:null}]),
  save:vi.fn(async()=>undefined),
}));
vi.mock("../src/lib/db",async importOriginal=>({
  ...await importOriginal<typeof import("../src/lib/db")>(),
  loadSchedules:mocks.load,
  saveSchedules:mocks.save,
}));

import { ScheduleSettings } from "../src/App";

afterEach(()=>{cleanup();mocks.load.mockClear();mocks.save.mockClear()});

describe("configurazione orari",()=>{
  it("permette di rimuovere un orario errato e aggiungerne uno con il selettore",async()=>{
    render(<ScheduleSettings/>);
    expect(await screen.findByText("18:18")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/rimuovi 18:18 di sabato/i}));
    fireEvent.change(screen.getAllByLabelText(/nuovo orario/i)[6],{target:{value:"18:00"}});
    fireEvent.click(screen.getAllByRole("button",{name:/aggiungi$/i})[6]);
    fireEvent.click(screen.getByRole("button",{name:/salva orari messe/i}));

    await waitFor(()=>expect(mocks.save).toHaveBeenCalled());
    const saved=mocks.save.mock.calls[0][0];
    expect(saved).toContainEqual(expect.objectContaining({weekday:6,time:"18:00"}));
    expect(saved).not.toContainEqual(expect.objectContaining({weekday:6,time:"18:18"}));
  });
});

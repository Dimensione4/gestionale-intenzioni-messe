import Database from "@tauri-apps/plugin-sql";

export type ParishSettings = {
  parish_name: string; address: string; phone: string; email: string;
  default_offering_cents: number; max_intentions_per_mass: number;
  receipt_paper_size: "58mm" | "80mm";
};
const defaults: ParishSettings = { parish_name: "La tua Parrocchia", address: "", phone: "", email: "", default_offering_cents: 1500, max_intentions_per_mass: 3, receipt_paper_size: "58mm" };
let connection: Promise<Database> | undefined;
const db = () => connection ??= Database.load("sqlite:gestionale.sqlite");

export async function loadSettings(): Promise<ParishSettings> {
  const rows = await (await db()).select<ParishSettings[]>("SELECT parish_name,address,phone,email,default_offering_cents,max_intentions_per_mass,receipt_paper_size FROM parish_settings WHERE id=1");
  return rows[0] ?? defaults;
}
export async function saveSettings(v: ParishSettings) {
  await (await db()).execute(
    `INSERT INTO parish_settings(id,parish_name,address,phone,email,default_offering_cents,max_intentions_per_mass,receipt_paper_size,created_at,updated_at)
     VALUES(1,$1,$2,$3,$4,$5,$6,$7,datetime('now'),datetime('now'))
     ON CONFLICT(id) DO UPDATE SET parish_name=$1,address=$2,phone=$3,email=$4,default_offering_cents=$5,max_intentions_per_mass=$6,receipt_paper_size=$7,updated_at=datetime('now')`,
    [v.parish_name,v.address,v.phone,v.email,v.default_offering_cents,v.max_intentions_per_mass,v.receipt_paper_size]);
}

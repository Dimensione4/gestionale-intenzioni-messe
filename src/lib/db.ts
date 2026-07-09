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

export type NewIntention = {
  mass_date:string; mass_time:string; offerer_first_name:string; offerer_last_name:string;
  offerer_phone:string; intention_text:string; remembered_person:string;
  offering_cents:number; payment_method:string; internal_notes:string;
};
export async function loadIntentionCounts(from:string,to:string):Promise<Record<string,number>> {
  const rows=await (await db()).select<{mass_date:string;count:number}[]>("SELECT mass_date,COUNT(*) AS count FROM mass_intentions WHERE status='active' AND mass_date BETWEEN $1 AND $2 GROUP BY mass_date",[from,to]);
  return Object.fromEntries(rows.map(row=>[row.mass_date,row.count]));
}
export async function createIntention(v:NewIntention,maximum:number) {
  const database=await db();
  const rows=await database.select<{count:number}[]>("SELECT COUNT(*) AS count FROM mass_intentions WHERE status='active' AND mass_date=$1 AND mass_time=$2",[v.mass_date,v.mass_time]);
  if((rows[0]?.count??0)>=maximum)throw new Error(`Limite di ${maximum} intenzioni raggiunto per questa messa.`);
  await database.execute(`INSERT INTO mass_intentions(mass_date,mass_time,offerer_first_name,offerer_last_name,offerer_phone,intention_text,remembered_person,offering_cents,payment_method,internal_notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,datetime('now'),datetime('now'))`,[v.mass_date,v.mass_time,v.offerer_first_name,v.offerer_last_name,v.offerer_phone,v.intention_text,v.remembered_person,v.offering_cents,v.payment_method,v.internal_notes]);
}

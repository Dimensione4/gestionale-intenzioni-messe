import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

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
export type MassIntention = NewIntention & {
  id:number; receipt_number:number|null; receipt_status?:string|null; status:string;
};
export async function loadIntentions(from:string,to:string):Promise<MassIntention[]> {
  return (await db()).select<MassIntention[]>(`SELECT i.id,i.mass_date,i.mass_time,i.offerer_first_name,i.offerer_last_name,i.offerer_phone,i.intention_text,i.remembered_person,i.offering_cents,i.payment_method,i.internal_notes,i.status,r.receipt_number,r.status AS receipt_status
    FROM mass_intentions i LEFT JOIN receipts r ON r.intention_id=i.id
    WHERE i.status='active' AND i.mass_date BETWEEN $1 AND $2 ORDER BY i.mass_date,i.mass_time,i.id`,[from,to]);
}
export async function loadIntentionCounts(from:string,to:string):Promise<Record<string,number>> {
  const rows=await (await db()).select<{mass_date:string;count:number}[]>("SELECT mass_date,COUNT(*) AS count FROM mass_intentions WHERE status='active' AND mass_date BETWEEN $1 AND $2 GROUP BY mass_date",[from,to]);
  return Object.fromEntries(rows.map(row=>[row.mass_date,row.count]));
}
export async function createIntention(v:NewIntention,maximum:number):Promise<MassIntention> {
  const database=await db();
  const rows=await database.select<{count:number}[]>("SELECT COUNT(*) AS count FROM mass_intentions WHERE status='active' AND mass_date=$1 AND mass_time=$2",[v.mass_date,v.mass_time]);
  if((rows[0]?.count??0)>=maximum)throw new Error(`Limite di ${maximum} intenzioni raggiunto per questa messa.`);
  const result=await database.execute(`INSERT INTO mass_intentions(mass_date,mass_time,offerer_first_name,offerer_last_name,offerer_phone,intention_text,remembered_person,offering_cents,payment_method,internal_notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,datetime('now'),datetime('now'))`,[v.mass_date,v.mass_time,v.offerer_first_name,v.offerer_last_name,v.offerer_phone,v.intention_text,v.remembered_person,v.offering_cents,v.payment_method,v.internal_notes]);
  const id=Number(result.lastInsertId);
  const receipt=await database.select<{receipt_number:number}[]>("SELECT receipt_number FROM receipts WHERE intention_id=$1",[id]);
  const receiptNumber=receipt[0]?.receipt_number;
  if(!receiptNumber)throw new Error("La ricevuta non è stata generata.");
  return {...v,id,status:"active",receipt_number:receiptNumber,receipt_status:"valid"};
}

export async function loadArchive():Promise<MassIntention[]> {
  return (await db()).select<MassIntention[]>(`SELECT i.id,i.mass_date,i.mass_time,i.offerer_first_name,i.offerer_last_name,i.offerer_phone,i.intention_text,i.remembered_person,i.offering_cents,i.payment_method,i.internal_notes,i.status,r.receipt_number,r.status AS receipt_status
    FROM mass_intentions i LEFT JOIN receipts r ON r.intention_id=i.id ORDER BY i.mass_date DESC,i.mass_time DESC,i.id DESC`);
}

export async function cancelReceipt(intentionId:number,reason:string) {
  if(!reason.trim())throw new Error("Indica il motivo dell’annullamento.");
  const database=await db();
  await database.execute("UPDATE receipts SET status='cancelled',cancelled_reason=$1,updated_at=datetime('now') WHERE intention_id=$2",[reason,intentionId]);
  await database.execute("INSERT INTO audit_logs(action,entity_type,entity_id,details,created_at) VALUES('cancel','receipt',$1,$2,datetime('now'))",[intentionId,reason]);
}

export async function createBackup():Promise<string> {
  const path=await invoke<string>("new_backup_path");
  await (await db()).execute(`VACUUM INTO '${path.replaceAll("'","''")}'`);
  return path;
}

export type MassScheduleRule={id?:number;weekday:number;time:string;max_intentions:number|null};
const defaultSchedules:MassScheduleRule[]=[
  ...[1,2,3,4,5].flatMap(weekday=>[{weekday,time:"08:30",max_intentions:null},{weekday,time:"18:00",max_intentions:null}]),
  {weekday:6,time:"18:00",max_intentions:null},
  {weekday:0,time:"08:30",max_intentions:null},{weekday:0,time:"10:30",max_intentions:null},{weekday:0,time:"18:00",max_intentions:null},
];
export async function loadSchedules():Promise<MassScheduleRule[]> {
  const database=await db();
  let rows=await database.select<MassScheduleRule[]>("SELECT id,weekday,time,max_intentions FROM mass_schedule_rules WHERE is_active=1 ORDER BY weekday,time");
  if(rows.length===0){await saveSchedules(defaultSchedules);rows=await database.select<MassScheduleRule[]>("SELECT id,weekday,time,max_intentions FROM mass_schedule_rules WHERE is_active=1 ORDER BY weekday,time")}
  return rows;
}
export async function saveSchedules(rules:MassScheduleRule[]) {
  const database=await db();await database.execute("DELETE FROM mass_schedule_rules");
  for(const rule of rules)await database.execute("INSERT INTO mass_schedule_rules(weekday,time,max_intentions,is_active,created_at,updated_at) VALUES($1,$2,$3,1,datetime('now'),datetime('now'))",[rule.weekday,rule.time,rule.max_intentions]);
}

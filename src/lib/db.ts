import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

export type ParishSettings = {
  parish_name: string; address: string; phone: string; email: string;
  default_offering_cents: number; max_intentions_per_mass: number;
  receipt_paper_size: "58mm" | "80mm";
  priest_first_name:string; priest_last_name:string; primary_color:string; accent_color:string; logo_data_url:string;
  receipt_show_address?:number; receipt_show_contacts?:number; receipt_show_priest?:number; receipt_show_offerer?:number;
  receipt_show_intention?:number; receipt_show_mass?:number; receipt_show_offering?:number; receipt_custom_message?:string;
  receipt_custom_width_mm?:number; receipt_custom_height_mm?:number;
  backup_frequency_hours?:6|12|24; online_backup_enabled?:number; online_backup_provider?:string; online_backup_account_email?:string; online_backup_encryption_enabled?:number;
};
const defaults: ParishSettings = { parish_name: "La tua Parrocchia", address: "", phone: "", email: "", default_offering_cents: 1500, max_intentions_per_mass: 3, receipt_paper_size: "58mm", priest_first_name:"",priest_last_name:"",primary_color:"#173D61",accent_color:"#B69943",logo_data_url:"",receipt_show_address:1,receipt_show_contacts:1,receipt_show_priest:1,receipt_show_offerer:1,receipt_show_intention:1,receipt_show_mass:1,receipt_show_offering:1,receipt_custom_message:"Grazie",receipt_custom_width_mm:0,receipt_custom_height_mm:0,backup_frequency_hours:6,online_backup_enabled:0,online_backup_provider:"google_drive",online_backup_account_email:"",online_backup_encryption_enabled:1 };
let connection: Promise<Database> | undefined;
const db = () => connection ??= Database.load("sqlite:gestionale.sqlite");

export async function loadSettings(): Promise<ParishSettings> {
  const rows = await (await db()).select<ParishSettings[]>("SELECT parish_name,address,phone,email,default_offering_cents,max_intentions_per_mass,receipt_paper_size,priest_first_name,priest_last_name,primary_color,accent_color,logo_data_url,receipt_show_address,receipt_show_contacts,receipt_show_priest,receipt_show_offerer,receipt_show_intention,receipt_show_mass,receipt_show_offering,receipt_custom_message,receipt_custom_width_mm,receipt_custom_height_mm,backup_frequency_hours,online_backup_enabled,online_backup_provider,online_backup_account_email,online_backup_encryption_enabled FROM parish_settings WHERE id=1");
  return {...defaults,...rows[0]};
}
export async function saveSettings(v: ParishSettings) {
  await (await db()).execute(
    `INSERT INTO parish_settings(id,parish_name,address,phone,email,default_offering_cents,max_intentions_per_mass,receipt_paper_size,created_at,updated_at)
     VALUES(1,$1,$2,$3,$4,$5,$6,$7,datetime('now'),datetime('now'))
     ON CONFLICT(id) DO UPDATE SET parish_name=$1,address=$2,phone=$3,email=$4,default_offering_cents=$5,max_intentions_per_mass=$6,receipt_paper_size=$7,updated_at=datetime('now')`,
    [v.parish_name,v.address,v.phone,v.email,v.default_offering_cents,v.max_intentions_per_mass,v.receipt_paper_size]);
  await (await db()).execute("UPDATE parish_settings SET priest_first_name=$1,priest_last_name=$2,primary_color=$3,accent_color=$4,logo_data_url=$5 WHERE id=1",[v.priest_first_name,v.priest_last_name,v.primary_color,v.accent_color,v.logo_data_url]);
  await (await db()).execute("UPDATE parish_settings SET receipt_show_address=$1,receipt_show_contacts=$2,receipt_show_priest=$3,receipt_show_offerer=$4,receipt_show_intention=$5,receipt_show_mass=$6,receipt_show_offering=$7,receipt_custom_message=$8 WHERE id=1",[v.receipt_show_address??1,v.receipt_show_contacts??1,v.receipt_show_priest??1,v.receipt_show_offerer??1,v.receipt_show_intention??1,v.receipt_show_mass??1,v.receipt_show_offering??1,v.receipt_custom_message??"Grazie"]);
  await (await db()).execute("UPDATE parish_settings SET receipt_custom_width_mm=$1,receipt_custom_height_mm=$2 WHERE id=1",[v.receipt_custom_width_mm??0,v.receipt_custom_height_mm??0]);
  await (await db()).execute("UPDATE parish_settings SET backup_frequency_hours=$1,online_backup_enabled=$2,online_backup_provider=$3,online_backup_account_email=$4,online_backup_encryption_enabled=$5 WHERE id=1",[v.backup_frequency_hours??6,v.online_backup_enabled??0,v.online_backup_provider??"google_drive",v.online_backup_account_email??"",v.online_backup_encryption_enabled??1]);
}

export type NewIntention = {
  mass_date:string; mass_time:string; offerer_first_name:string; offerer_last_name:string;
  offerer_phone:string; intention_text:string; remembered_person:string;
  offering_cents:number; payment_method:string; internal_notes:string;
};
export type MassIntention = NewIntention & {
  id:number; receipt_number:number|null; receipt_status?:string|null; status:string;
};
export type MassMemo = {
  id:number; offerer_first_name:string; offerer_last_name:string; offerer_phone:string;
  offering_cents:number; payment_method:string; status:string; created_at:string; updated_at:string;
  items:MassIntention[];
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

export async function createMassMemo(values:NewIntention[],maximum:number):Promise<MassMemo> {
  if(values.length===0)throw new Error("Aggiungi almeno una messa al promemoria.");
  const database=await db();
  await database.execute("BEGIN");
  try{
    const first=values[0];
    const memoResult=await database.execute(`INSERT INTO mass_memos(offerer_first_name,offerer_last_name,offerer_phone,offering_cents,payment_method,created_at,updated_at) VALUES($1,$2,$3,$4,$5,datetime('now'),datetime('now'))`,[first.offerer_first_name,first.offerer_last_name,first.offerer_phone,first.offering_cents,first.payment_method]);
    const memoId=Number(memoResult.lastInsertId);
    const items:MassIntention[]=[];
    for(const [index,value] of values.entries()){
      const countRows=await database.select<{count:number}[]>("SELECT COUNT(*) AS count FROM mass_intentions WHERE status='active' AND mass_date=$1 AND mass_time=$2",[value.mass_date,value.mass_time]);
      if((countRows[0]?.count??0)>=maximum)throw new Error(`Limite di ${maximum} intenzioni raggiunto per ${value.mass_date} alle ${value.mass_time}.`);
      const result=await database.execute(`INSERT INTO mass_intentions(mass_date,mass_time,offerer_first_name,offerer_last_name,offerer_phone,intention_text,remembered_person,offering_cents,payment_method,internal_notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,datetime('now'),datetime('now'))`,[value.mass_date,value.mass_time,value.offerer_first_name,value.offerer_last_name,value.offerer_phone,value.intention_text,value.remembered_person,value.offering_cents,value.payment_method,value.internal_notes]);
      const id=Number(result.lastInsertId);
      await database.execute("INSERT INTO mass_memo_items(memo_id,intention_id,position,created_at) VALUES($1,$2,$3,datetime('now'))",[memoId,id,index]);
      const receipt=await database.select<{receipt_number:number}[]>("SELECT receipt_number FROM receipts WHERE intention_id=$1",[id]);
      items.push({...value,id,status:"active",receipt_number:receipt[0]?.receipt_number??null,receipt_status:"valid"});
    }
    await database.execute("COMMIT");
    return {id:memoId,offerer_first_name:first.offerer_first_name,offerer_last_name:first.offerer_last_name,offerer_phone:first.offerer_phone,offering_cents:first.offering_cents,payment_method:first.payment_method,status:"active",created_at:"",updated_at:"",items};
  }catch(e){
    await database.execute("ROLLBACK").catch(()=>undefined);
    throw e;
  }
}

export async function loadMassMemos():Promise<MassMemo[]> {
  const database=await db();
  const memos=await database.select<Omit<MassMemo,"items">[]>("SELECT id,offerer_first_name,offerer_last_name,offerer_phone,offering_cents,payment_method,status,created_at,updated_at FROM mass_memos WHERE status='active' ORDER BY id DESC");
  const items=await database.select<(MassIntention&{memo_id:number;position:number})[]>(`SELECT mi.memo_id,mi.position,i.id,i.mass_date,i.mass_time,i.offerer_first_name,i.offerer_last_name,i.offerer_phone,i.intention_text,i.remembered_person,i.offering_cents,i.payment_method,i.internal_notes,i.status,r.receipt_number,r.status AS receipt_status
    FROM mass_memo_items mi JOIN mass_intentions i ON i.id=mi.intention_id LEFT JOIN receipts r ON r.intention_id=i.id
    WHERE i.status='active' ORDER BY mi.memo_id,mi.position,mi.id`);
  return memos.map(memo=>({...memo,items:items.filter(item=>item.memo_id===memo.id)}));
}

export async function updateMassMemo(memo:MassMemo,values:NewIntention[],maximum:number):Promise<MassMemo> {
  if(values.length===0)throw new Error("Il promemoria deve avere almeno una riga.");
  const database=await db();
  await database.execute("BEGIN");
  try{
    const first=values[0];
    await database.execute("UPDATE mass_memos SET offerer_first_name=$1,offerer_last_name=$2,offerer_phone=$3,offering_cents=$4,payment_method=$5,updated_at=datetime('now') WHERE id=$6",[first.offerer_first_name,first.offerer_last_name,first.offerer_phone,first.offering_cents,first.payment_method,memo.id]);
    const records:MassIntention[]=[];
    for(const [index,value] of values.entries()){
      const existing=memo.items[index];
      if(existing){
        await database.execute(`UPDATE mass_intentions SET mass_date=$1,mass_time=$2,offerer_first_name=$3,offerer_last_name=$4,offerer_phone=$5,intention_text=$6,remembered_person=$7,offering_cents=$8,payment_method=$9,internal_notes=$10,updated_at=datetime('now') WHERE id=$11`,[value.mass_date,value.mass_time,value.offerer_first_name,value.offerer_last_name,value.offerer_phone,value.intention_text,value.remembered_person,value.offering_cents,value.payment_method,value.internal_notes,existing.id]);
        await database.execute("UPDATE mass_memo_items SET position=$1 WHERE memo_id=$2 AND intention_id=$3",[index,memo.id,existing.id]);
        records.push({...existing,...value});
      }else{
        const countRows=await database.select<{count:number}[]>("SELECT COUNT(*) AS count FROM mass_intentions WHERE status='active' AND mass_date=$1 AND mass_time=$2",[value.mass_date,value.mass_time]);
        if((countRows[0]?.count??0)>=maximum)throw new Error(`Limite di ${maximum} intenzioni raggiunto per ${value.mass_date} alle ${value.mass_time}.`);
        const result=await database.execute(`INSERT INTO mass_intentions(mass_date,mass_time,offerer_first_name,offerer_last_name,offerer_phone,intention_text,remembered_person,offering_cents,payment_method,internal_notes,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,datetime('now'),datetime('now'))`,[value.mass_date,value.mass_time,value.offerer_first_name,value.offerer_last_name,value.offerer_phone,value.intention_text,value.remembered_person,value.offering_cents,value.payment_method,value.internal_notes]);
        const id=Number(result.lastInsertId);
        await database.execute("INSERT INTO mass_memo_items(memo_id,intention_id,position,created_at) VALUES($1,$2,$3,datetime('now'))",[memo.id,id,index]);
        const receipt=await database.select<{receipt_number:number}[]>("SELECT receipt_number FROM receipts WHERE intention_id=$1",[id]);
        records.push({...value,id,status:"active",receipt_number:receipt[0]?.receipt_number??null,receipt_status:"valid"});
      }
    }
    for(const removed of memo.items.slice(values.length))await database.execute("UPDATE mass_intentions SET status='deleted',delete_reason='Rimosso dal promemoria',updated_at=datetime('now') WHERE id=$1",[removed.id]);
    await database.execute("COMMIT");
    return {...memo,...first,items:records};
  }catch(e){
    await database.execute("ROLLBACK").catch(()=>undefined);
    throw e;
  }
}

export async function deleteMassMemo(id:number,reason="Promemoria eliminato") {
  const database=await db();
  await database.execute("BEGIN");
  try{
    await database.execute("UPDATE mass_memos SET status='deleted',updated_at=datetime('now') WHERE id=$1",[id]);
    await database.execute("UPDATE mass_intentions SET status='deleted',delete_reason=$1,updated_at=datetime('now') WHERE id IN (SELECT intention_id FROM mass_memo_items WHERE memo_id=$2)",[reason,id]);
    await database.execute("COMMIT");
  }catch(e){
    await database.execute("ROLLBACK").catch(()=>undefined);
    throw e;
  }
}

export async function loadArchive():Promise<MassIntention[]> {
  return (await db()).select<MassIntention[]>(`SELECT i.id,i.mass_date,i.mass_time,i.offerer_first_name,i.offerer_last_name,i.offerer_phone,i.intention_text,i.remembered_person,i.offering_cents,i.payment_method,i.internal_notes,i.status,r.receipt_number,r.status AS receipt_status
    FROM mass_intentions i LEFT JOIN receipts r ON r.intention_id=i.id ORDER BY i.mass_date DESC,i.mass_time DESC,i.id DESC`);
}

export async function cancelReceipt(intentionId:number,reason:string) {
  if(!reason.trim())throw new Error("Indica il motivo dell’annullamento.");
  const database=await db();
  const result=await database.execute("UPDATE receipts SET status='cancelled',cancelled_reason=$1,updated_at=datetime('now') WHERE intention_id=$2",[reason,intentionId]);
  if(result.rowsAffected===0)throw new Error("Questa intenzione non ha una ricevuta associata. Elimina l’intenzione oppure genera una nuova ricevuta.");
  await database.execute("INSERT INTO audit_logs(action,entity_type,entity_id,details,created_at) VALUES('cancel','receipt',$1,$2,datetime('now'))",[intentionId,reason]);
}

export async function updateIntention(id:number,value:NewIntention) {
  const database=await db();
  await database.execute(`UPDATE mass_intentions SET mass_date=$1,mass_time=$2,offerer_first_name=$3,offerer_last_name=$4,offerer_phone=$5,intention_text=$6,remembered_person=$7,offering_cents=$8,payment_method=$9,internal_notes=$10,updated_at=datetime('now') WHERE id=$11`,
    [value.mass_date,value.mass_time,value.offerer_first_name,value.offerer_last_name,value.offerer_phone,value.intention_text,value.remembered_person,value.offering_cents,value.payment_method,value.internal_notes,id]);
}
export async function deleteIntention(id:number,reason:string) {
  await (await db()).execute("UPDATE mass_intentions SET status='deleted',delete_reason=$1,updated_at=datetime('now') WHERE id=$2",[reason,id]);
}
export async function restoreIntention(id:number) {
  await (await db()).execute("UPDATE mass_intentions SET status='active',delete_reason=NULL,updated_at=datetime('now') WHERE id=$1",[id]);
}
export type AuditLog={id:number;action:string;entity_type:string;entity_id:number|null;details:string|null;created_at:string};
export async function loadAuditLogs():Promise<AuditLog[]> {
  return (await db()).select<AuditLog[]>("SELECT id,action,entity_type,entity_id,details,created_at FROM audit_logs ORDER BY id DESC LIMIT 500");
}

export async function createBackup(options?:{encryptPassphrase?:string}):Promise<string> {
  const path=await invoke<string>("new_backup_path");
  await (await db()).execute(`VACUUM INTO '${path.replaceAll("'","''")}'`);
  if(options?.encryptPassphrase)return invoke<string>("encrypt_backup_file",{sourcePath:path,passphrase:options.encryptPassphrase});
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

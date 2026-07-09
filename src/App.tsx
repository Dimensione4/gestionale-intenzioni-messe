import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Archive as ArchiveIcon, CalendarDays, Church, Download, LogOut, Printer, Save, Settings as Cog } from "lucide-react";
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { cancelReceipt, createIntention, loadArchive, loadIntentions, loadSettings, saveSettings } from "./lib/db";
import type { MassIntention, NewIntention, ParishSettings } from "./lib/db";

export function App() {
  const [authenticated,setAuthenticated]=useState(false), [setup,setSetup]=useState(false), [loading,setLoading]=useState(true);
  const [page,setPage]=useState<"calendar"|"archive"|"settings">("calendar"); const [settings,setSettings]=useState<ParishSettings|null>(null);
  useEffect(()=>{invoke<boolean>("has_password").then(v=>setSetup(!v)).finally(()=>setLoading(false))},[]);
  if(loading)return <main className="center">Avvio del gestionale…</main>;
  if(!authenticated)return <Login setup={setup} done={()=>{setSetup(false);setAuthenticated(true)}}/>;
  return <div className="shell"><aside><div className="brand"><Church size={34}/><span>{settings?.parish_name??"Gestionale Messe"}</span></div>
    <nav><button className={page==="calendar"?"active":""} onClick={()=>setPage("calendar")}><CalendarDays/> Calendario</button>
    <button className={page==="archive"?"active":""} onClick={()=>setPage("archive")}><ArchiveIcon/> Archivio</button>
    <button className={page==="settings"?"active":""} onClick={()=>setPage("settings")}><Cog/> Impostazioni</button></nav>
    <button className="logout" onClick={()=>setAuthenticated(false)}><LogOut/> Esci</button></aside>
    <main>{page==="calendar"?<Calendar/>:page==="archive"?<Archive settings={settings}/>:<Settings value={settings} changed={setSettings}/>}</main></div>;
}

function Login({setup,done}:{setup:boolean;done:()=>void}) {
  const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[error,setError]=useState("");
  async function submit(e:React.FormEvent){e.preventDefault();setError("");
    if(password.length<8)return setError("La password deve contenere almeno 8 caratteri.");
    if(setup&&password!==confirm)return setError("Le due password non coincidono.");
    try{const ok=setup?await invoke<boolean>("set_initial_password",{password}):await invoke<boolean>("verify_password",{password});ok?done():setError("Password non corretta. Riprova.")}
    catch{setError("Non è stato possibile accedere. Riprova.");}}
  return <main className="login"><section className="login-card"><div className="login-icon"><Church size={42}/></div><h1>Gestionale Intenzioni Messe</h1>
    <p>{setup?"Primo avvio: crea la password dell’amministratore.":"Inserisci la password per continuare."}</p><form onSubmit={submit}>
    <label>Password<input autoFocus type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {setup&&<label>Ripeti password<input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}
    {error&&<p className="error" role="alert">{error}</p>}<button className="primary">{setup?"Crea password ed entra":"Entra"}</button></form></section></main>;
}

type IntentionRepository={list:typeof loadIntentions;settings:typeof loadSettings;create:typeof createIntention};
const defaultRepository:IntentionRepository={list:loadIntentions,settings:loadSettings,create:createIntention};

export function Calendar({repository=defaultRepository}:{repository?:IntentionRepository}){
  const [month,setMonth]=useState(new Date()),[selected,setSelected]=useState<string|null>(null),[intentions,setIntentions]=useState<MassIntention[]>([]),[notice,setNotice]=useState("");
  const days=useMemo(()=>eachDayOfInterval({start:startOfMonth(month),end:endOfMonth(month)}),[month]);
  const blanks=(getDay(startOfMonth(month))+6)%7;
  const refresh=()=>repository.list(format(startOfMonth(month),"yyyy-MM-dd"),format(endOfMonth(month),"yyyy-MM-dd")).then(setIntentions);
  useEffect(()=>{refresh()},[month]);
  return <section><header><div><p className="eyebrow">Schermata principale</p><h1>Calendario messe</h1></div><button className="primary" onClick={()=>setSelected(format(new Date(),"yyyy-MM-dd"))}>+ Aggiungi intenzione</button></header>
    <div className="card"><div className="month"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1))}>← Mese precedente</button>
    <h2>{format(month,"MMMM yyyy",{locale:it})}</h2><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1))}>Mese successivo →</button></div>
    <div className="week">{["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(x=><strong key={x}>{x}</strong>)}</div><div className="grid">
    {Array.from({length:blanks},(_,i)=><span key={i}/>)}{days.map(day=>{const key=format(day,"yyyy-MM-dd"),items=intentions.filter(i=>i.mass_date===key);return <button key={key} onClick={()=>setSelected(key)} className={key===format(new Date(),"yyyy-MM-dd")?"today":""}>
    <b>{format(day,"d")}</b><span className="day-lines">{items.length===0?<small>Nessuna intenzione</small>:items.slice(0,3).map(i=><small key={i.id}><strong>{i.mass_time}</strong> {i.intention_text}</small>)}{items.length>3&&<small>+ altre {items.length-3}</small>}</span></button>})}</div></div>
    {notice&&<p className="toast" role="status">{notice}</p>}
    {selected&&<IntentionDialog initialDate={selected} repository={repository} close={()=>setSelected(null)} saved={record=>{setSelected(null);setIntentions(items=>[...items,record].sort((a,b)=>(a.mass_date+a.mass_time).localeCompare(b.mass_date+b.mass_time)));setNotice(`Intenzione salvata. Ricevuta n. ${record.receipt_number}.`);}}/>}
  </section>;
}

function IntentionDialog({initialDate,repository,close,saved}:{initialDate:string;repository:IntentionRepository;close:()=>void;saved:(record:MassIntention)=>void}){
  const [form,setForm]=useState<NewIntention>({mass_date:initialDate,mass_time:"18:00",offerer_first_name:"",offerer_last_name:"",offerer_phone:"",intention_text:"",remembered_person:"",offering_cents:1500,payment_method:"Contanti",internal_notes:""});
  const [maximum,setMaximum]=useState(3),[error,setError]=useState(""),[saving,setSaving]=useState(false);
  useEffect(()=>{repository.settings().then(s=>{setMaximum(s.max_intentions_per_mass);setForm(v=>({...v,offering_cents:s.default_offering_cents}))})},[repository]);
  const field=(key:keyof NewIntention,value:string|number)=>setForm({...form,[key]:value});
  async function submit(e:React.FormEvent){e.preventDefault();setError("");if(!form.intention_text.trim()&&!form.offerer_first_name.trim())return setError("Scrivi il testo dell’intenzione oppure il nome dell’offerente.");if(form.offering_cents===0&&!confirm("L’offerta è pari a zero. Vuoi continuare?"))return;setSaving(true);try{saved(await repository.create(form,maximum))}catch(e){setError(typeof e==="string"?e:e instanceof Error?e.message:"Salvataggio non riuscito.")}finally{setSaving(false)}}
  return <div className="modal-backdrop"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="intention-title">
    <div className="dialog-head"><div><p className="eyebrow">Inserimento</p><h2 id="intention-title">Nuova intenzione</h2></div><button type="button" onClick={close}>Chiudi ×</button></div>
    <form onSubmit={submit}><div className="form-grid">
      <label>Data messa<input required type="date" value={form.mass_date} onChange={e=>field("mass_date",e.target.value)}/></label><label>Orario messa<input required type="time" value={form.mass_time} onChange={e=>field("mass_time",e.target.value)}/></label>
      <label>Nome offerente<input value={form.offerer_first_name} onChange={e=>field("offerer_first_name",e.target.value)}/></label><label>Cognome offerente<input value={form.offerer_last_name} onChange={e=>field("offerer_last_name",e.target.value)}/></label>
      <label>Telefono (facoltativo)<input value={form.offerer_phone} onChange={e=>field("offerer_phone",e.target.value)}/></label><label>Persona ricordata<input value={form.remembered_person} onChange={e=>field("remembered_person",e.target.value)}/></label>
      <label className="wide">Testo intenzione<textarea required rows={3} value={form.intention_text} onChange={e=>field("intention_text",e.target.value)}/></label>
      <label>Offerta (€)<input required type="number" min="0" step=".01" value={form.offering_cents/100} onChange={e=>field("offering_cents",Math.round(+e.target.value*100))}/></label>
      <label>Pagamento<select value={form.payment_method} onChange={e=>field("payment_method",e.target.value)}><option>Contanti</option><option>Bonifico</option><option>Altro</option></select></label>
      <label className="wide">Note interne<textarea rows={2} value={form.internal_notes} onChange={e=>field("internal_notes",e.target.value)}/></label>
    </div>{error&&<p className="error" role="alert">{error}</p>}<div className="actions"><button type="button" onClick={close}>Annulla</button><button className="primary" disabled={saving}>{saving?"Salvataggio…":"Salva intenzione"}</button></div></form>
  </div></div>;
}

function Archive({settings}:{settings:ParishSettings|null}){
  const [items,setItems]=useState<MassIntention[]>([]),[query,setQuery]=useState(""),[receipt,setReceipt]=useState<MassIntention|null>(null),[error,setError]=useState("");
  const refresh=()=>loadArchive().then(setItems).catch(e=>setError(String(e)));
  useEffect(()=>{refresh()},[]);
  const normalized=query.toLowerCase().trim();
  const visible=items.filter(i=>!normalized||[i.offerer_first_name,i.offerer_last_name,i.intention_text,i.remembered_person,String(i.receipt_number??"")].some(v=>v?.toLowerCase().includes(normalized)));
  function exportCsv(){
    const rows=[["Ricevuta","Data","Ora","Offerente","Intenzione","Offerta","Stato"],...visible.map(i=>[i.receipt_number??"",i.mass_date,i.mass_time,`${i.offerer_first_name} ${i.offerer_last_name}`.trim(),i.intention_text,(i.offering_cents/100).toFixed(2),i.receipt_status??"valid"])];
    const csv=rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(";")).join("\r\n");
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));link.download=`intenzioni-${format(new Date(),"yyyy-MM-dd")}.csv`;link.click();URL.revokeObjectURL(link.href);
  }
  async function cancel(item:MassIntention){const reason=prompt("Motivo dell’annullamento della ricevuta:");if(!reason)return;try{await cancelReceipt(item.id,reason);await refresh()}catch(e){setError(String(e))}}
  return <section><header><div><p className="eyebrow">Consultazione</p><h1>Archivio intenzioni</h1></div><button className="primary" onClick={exportCsv}><Download/> Esporta CSV</button></header>
    <div className="card"><label>Cerca per nome, testo o numero ricevuta<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Inizia a scrivere…"/></label>
    {error&&<p className="error">{error}</p>}<div className="archive-list">{visible.length===0?<p>Nessun risultato.</p>:visible.map(item=><article key={item.id}>
      <div><strong>{item.mass_date} · ore {item.mass_time}</strong><p>{item.intention_text}</p><small>{`${item.offerer_first_name} ${item.offerer_last_name}`.trim()||"Offerente non indicato"} · € {(item.offering_cents/100).toFixed(2)}</small></div>
      <div className="receipt-actions"><span className={item.receipt_status==="cancelled"?"cancelled":""}>Ricevuta n. {item.receipt_number} {item.receipt_status==="cancelled"?"— annullata":""}</span><button onClick={()=>setReceipt(item)}><Printer/> Anteprima / stampa</button>{item.receipt_status!=="cancelled"&&<button onClick={()=>cancel(item)}>Annulla ricevuta</button>}</div>
    </article>)}</div></div>
    {receipt&&<ReceiptPreview item={receipt} settings={settings} close={()=>setReceipt(null)}/>}
  </section>;
}

function ReceiptPreview({item,settings,close}:{item:MassIntention;settings:ParishSettings|null;close:()=>void}){
  return <div className="modal-backdrop"><div className="dialog receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
    <div className="dialog-head no-print"><h2 id="receipt-title">Anteprima ricevuta</h2><button onClick={close}>Chiudi ×</button></div>
    <div className={`receipt ${settings?.receipt_paper_size??"58mm"}`}><h2>{settings?.parish_name??"Parrocchia"}</h2><p>{settings?.address}</p><hr/><strong>RICEVUTA N. {item.receipt_number}</strong>
      <p>Ricevuta da: {`${item.offerer_first_name} ${item.offerer_last_name}`.trim()||"—"}</p><p>Intenzione:<br/><strong>{item.intention_text}</strong></p>
      <p>Messa: {item.mass_date} ore {item.mass_time}</p><p>Offerta: <strong>€ {(item.offering_cents/100).toFixed(2)}</strong></p><hr/><p>Grazie</p></div>
    <div className="actions no-print"><button onClick={close}>Chiudi</button><button className="primary" onClick={()=>window.print()}><Printer/> Stampa ricevuta</button></div>
  </div></div>;
}

function Settings({value,changed}:{value:ParishSettings|null;changed:(v:ParishSettings)=>void}){
  const [form,setForm]=useState(value),[message,setMessage]=useState(""),[backupMessage,setBackupMessage]=useState("");
  useEffect(()=>{if(!form)loadSettings().then(v=>{setForm(v);changed(v)})},[form,changed]);
  if(!form)return <p>Caricamento impostazioni…</p>;
  const field=(key:keyof ParishSettings,val:string|number)=>setForm({...form,[key]:val});
  async function submit(e:React.FormEvent){e.preventDefault();await saveSettings(form!);changed(form!);setMessage("Impostazioni salvate correttamente.");}
  return <section><header><div><p className="eyebrow">Configurazione</p><h1>Impostazioni parrocchia</h1></div></header><form className="card" onSubmit={submit}>
    <div className="form-grid"><label>Nome parrocchia<input required value={form.parish_name} onChange={e=>field("parish_name",e.target.value)}/></label>
    <label>Indirizzo<input value={form.address} onChange={e=>field("address",e.target.value)}/></label>
    <label>Telefono<input value={form.phone} onChange={e=>field("phone",e.target.value)}/></label><label>Email<input type="email" value={form.email} onChange={e=>field("email",e.target.value)}/></label>
    <label>Offerta predefinita (€)<input type="number" min="0" step=".01" value={form.default_offering_cents/100} onChange={e=>field("default_offering_cents",Math.round(+e.target.value*100))}/></label>
    <label>Massimo intenzioni per messa<input type="number" min="1" value={form.max_intentions_per_mass} onChange={e=>field("max_intentions_per_mass",+e.target.value)}/></label>
    <label>Formato ricevuta<select value={form.receipt_paper_size} onChange={e=>field("receipt_paper_size",e.target.value)}><option>58mm</option><option>80mm</option></select></label></div>
    {message&&<p className="success">{message}</p>}<button className="primary"><Save/> Salva impostazioni</button>
    <hr className="section-rule"/><h2>Backup e ripristino</h2><p>I backup vengono salvati nella cartella Documenti del computer.</p>
    {backupMessage&&<p className={backupMessage.startsWith("Errore")?"error":"success"}>{backupMessage}</p>}
    <div className="actions"><button type="button" onClick={async()=>{try{setBackupMessage(`Backup creato in: ${await invoke<string>("create_backup")}`)}catch(e){setBackupMessage(`Errore: ${String(e)}`)}}}>Crea backup ora</button>
    <button type="button" onClick={async()=>{if(!confirm("Ripristinare l’ultimo backup? Prima verrà creata una copia di sicurezza e l’app si riavvierà."))return;try{await invoke("restore_latest_backup")}catch(e){setBackupMessage(`Errore: ${String(e)}`)}}}>Ripristina ultimo backup</button></div>
    </form></section>;
}

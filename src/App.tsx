import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Archive as ArchiveIcon, ArrowLeft, CalendarDays, Church, Download, Grid3X3, History, List, LogOut, Palette, Pencil, Printer, RotateCcw, Save, Settings as Cog, Shield, Trash2 } from "lucide-react";
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { cancelReceipt, createBackup, createIntention, deleteIntention, loadArchive, loadAuditLogs, loadIntentions, loadSchedules, loadSettings, restoreIntention, saveSchedules, saveSettings, updateIntention } from "./lib/db";
import type { AuditLog, MassIntention, MassScheduleRule, NewIntention, ParishSettings } from "./lib/db";

export function App() {
  const [authenticated,setAuthenticated]=useState(false), [setup,setSetup]=useState(false), [loading,setLoading]=useState(true);
  const [page,setPage]=useState<"calendar"|"archive"|"settings">("calendar"); const [settings,setSettings]=useState<ParishSettings|null>(null);
  useEffect(()=>{invoke<boolean>("has_password").then(v=>setSetup(!v)).finally(()=>setLoading(false))},[]);
  useEffect(()=>{if(authenticated)loadSettings().then(setSettings)},[authenticated]);
  useEffect(()=>{if(!settings)return;document.documentElement.style.setProperty("--primary",settings.primary_color);document.documentElement.style.setProperty("--primary-deep",settings.primary_color);document.documentElement.style.setProperty("--accent",settings.accent_color)},[settings]);
  useEffect(()=>{if(!authenticated)return;const today=format(new Date(),"yyyy-MM-dd");if(localStorage.getItem("last-auto-backup")===today)return;createBackup().then(()=>localStorage.setItem("last-auto-backup",today)).catch(()=>undefined)},[authenticated]);
  if(loading)return <main className="center">Avvio del gestionale…</main>;
  if(!authenticated)return <Login setup={setup} done={()=>{setSetup(false);setAuthenticated(true)}}/>;
  return <div className="shell"><aside><div className="brand">{settings?.logo_data_url?<img src={settings.logo_data_url} alt="Logo parrocchia"/>:<Church size={34}/>}<span>{settings?.parish_name??"Gestionale Messe"}</span></div>
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

type IntentionRepository={list:typeof loadIntentions;settings:typeof loadSettings;create:typeof createIntention;update?:typeof updateIntention;schedules?:typeof loadSchedules};
const defaultRepository:IntentionRepository={list:loadIntentions,settings:loadSettings,create:createIntention,update:updateIntention,schedules:loadSchedules};

export function Calendar({repository=defaultRepository}:{repository?:IntentionRepository}){
  const [month,setMonth]=useState(new Date()),[view,setView]=useState<"calendar"|"list">("calendar"),[printOpen,setPrintOpen]=useState(false),[selectedDay,setSelectedDay]=useState<string|null>(null),[addRequest,setAddRequest]=useState<{date:string;time?:string}|null>(null),[editing,setEditing]=useState<MassIntention|null>(null),[intentions,setIntentions]=useState<MassIntention[]>([]),[schedules,setSchedules]=useState<MassScheduleRule[]>([]),[notice,setNotice]=useState(""),[loadError,setLoadError]=useState("");
  const days=useMemo(()=>eachDayOfInterval({start:startOfMonth(month),end:endOfMonth(month)}),[month]);
  const blanks=(getDay(startOfMonth(month))+6)%7;
  const refresh=()=>repository.list(format(startOfMonth(month),"yyyy-MM-dd"),format(endOfMonth(month),"yyyy-MM-dd")).then(items=>{setIntentions(items);setLoadError("")}).catch(e=>setLoadError(`Impossibile leggere il calendario: ${String(e)}`));
  useEffect(()=>{refresh()},[month]);
  useEffect(()=>{repository.schedules?.().then(setSchedules)},[repository]);
  if(selectedDay)return <DayDetail date={selectedDay} items={intentions.filter(i=>i.mass_date===selectedDay)} schedules={schedules} settingsRepository={repository.settings} back={()=>setSelectedDay(null)} add={time=>setAddRequest({date:selectedDay,time})} edit={setEditing} changed={refresh}
    dialogs={<>{addRequest&&<IntentionDialog initialDate={addRequest.date} initialTime={addRequest.time} repository={repository} close={()=>setAddRequest(null)} saved={record=>{setAddRequest(null);setNotice(`Intenzione salvata. Ricevuta n. ${record.receipt_number}.`);refresh()}}/>}{editing&&<IntentionDialog initialDate={editing.mass_date} initialRecord={editing} repository={repository} close={()=>setEditing(null)} saved={()=>{setEditing(null);setNotice("Intenzione modificata.");refresh()}}/>}</>}/>;
  return <section><header><div><p className="eyebrow">Schermata principale</p><h1>Agenda delle messe</h1></div><div className="header-actions"><button className="secondary-button" onClick={()=>setPrintOpen(true)}><Printer/> Stampa elenco</button><button className="primary" onClick={()=>setAddRequest({date:format(new Date(),"yyyy-MM-dd")})}>+ Aggiungi intenzione</button></div></header>
    <div className="calendar-toolbar"><div className="view-switch" aria-label="Tipo di vista"><button className={view==="calendar"?"active":""} onClick={()=>setView("calendar")}><Grid3X3/> Calendario</button><button className={view==="list"?"active":""} onClick={()=>setView("list")}><List/> Elenco mensile</button></div></div>
    {loadError&&<p className="error" role="alert">{loadError}</p>}<div className="card"><div className="month"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1))}>← Mese precedente</button>
    <h2>{format(month,"MMMM yyyy",{locale:it})}</h2><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1))}>Mese successivo →</button></div>
    {view==="calendar"?<><div className="week">{["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(x=><strong key={x}>{x}</strong>)}</div><div className="grid">
    {Array.from({length:blanks},(_,i)=><span key={i}/>)}{days.map(day=>{const key=format(day,"yyyy-MM-dd"),items=intentions.filter(i=>i.mass_date===key),times=schedules.filter(s=>s.weekday===day.getDay()).map(s=>s.time);return <button key={key} onClick={()=>setSelectedDay(key)} className={key===format(new Date(),"yyyy-MM-dd")?"today":""}>
    <b>{format(day,"d")}</b><span className="day-lines">{items.slice(0,3).map(i=><small key={i.id}><strong>{i.mass_time}</strong> {i.intention_text}</small>)}{items.length===0&&times.slice(0,3).map(time=><small key={time}><strong>{time}</strong> 0 intenzioni</small>)}{items.length===0&&times.length===0&&<small>Nessuna messa</small>}{items.length>3&&<small>+ altre {items.length-3}</small>}</span></button>})}</div></>:<MonthlyList days={days} intentions={intentions} schedules={schedules} openDay={setSelectedDay}/>}</div>
    {notice&&<p className="toast" role="status">{notice}</p>}
    {addRequest&&<IntentionDialog initialDate={addRequest.date} repository={repository} close={()=>setAddRequest(null)} saved={record=>{setAddRequest(null);setIntentions(items=>[...items,record].sort((a,b)=>(a.mass_date+a.mass_time).localeCompare(b.mass_date+b.mass_time)));setNotice(`Intenzione salvata. Ricevuta n. ${record.receipt_number}.`);}}/>}
    {printOpen&&<PrintIntentionsDialog month={month} repository={repository} close={()=>setPrintOpen(false)}/>}
  </section>;
}

function MonthlyList({days,intentions,schedules,openDay}:{days:Date[];intentions:MassIntention[];schedules:MassScheduleRule[];openDay:(date:string)=>void}){
  const rows=days.flatMap(day=>{const date=format(day,"yyyy-MM-dd"),items=intentions.filter(i=>i.mass_date===date);if(items.length)return items.map(item=>({date,day,time:item.mass_time,text:item.intention_text,count:items.length}));return schedules.filter(s=>s.weekday===day.getDay()).map(s=>({date,day,time:s.time,text:"Nessuna intenzione",count:0}))});
  return <div className="monthly-list"><div className="monthly-list-head"><span>Giorno</span><span>Ora</span><span>Intenzione</span><span>Stato</span></div>{rows.length===0?<p className="empty-state">Nessuna messa o intenzione nel mese selezionato.</p>:rows.map((row,index)=><button key={`${row.date}-${row.time}-${index}`} onClick={()=>openDay(row.date)}><span><strong>{format(row.day,"d")}</strong> {format(row.day,"EEEE",{locale:it})}</span><span>{row.time}</span><span>{row.text}</span><span>{row.count>0?"Registrata":"Disponibile"}</span></button>)}</div>;
}

function PrintIntentionsDialog({month,repository,close}:{month:Date;repository:IntentionRepository;close:()=>void}){
  const monthStart=format(startOfMonth(month),"yyyy-MM-dd"),monthEnd=format(endOfMonth(month),"yyyy-MM-dd");
  const [period,setPeriod]=useState<"day"|"month"|"range">("month"),[from,setFrom]=useState(monthStart),[to,setTo]=useState(monthEnd),[offerings,setOfferings]=useState(false),[items,setItems]=useState<MassIntention[]>([]),[printing,setPrinting]=useState(false),[error,setError]=useState("");
  const bounds=()=>period==="day"?[from,from]:period==="month"?[monthStart,monthEnd]:[from,to];
  async function print(){setError("");const [start,end]=bounds();if(start>end)return setError("La data iniziale deve precedere quella finale.");setPrinting(true);try{setItems(await repository.list(start,end));setTimeout(()=>window.print(),50)}catch(e){setError(String(e))}finally{setPrinting(false)}}
  return <div className="modal-backdrop"><div className="dialog print-dialog" role="dialog" aria-modal="true" aria-labelledby="print-title"><div className="dialog-head no-print"><div><p className="eyebrow">Stampa</p><h2 id="print-title">Stampa elenco intenzioni</h2></div><button onClick={close}>Chiudi ×</button></div>
    <div className="print-options no-print"><fieldset><legend>Periodo da stampare</legend><label><input type="radio" checked={period==="day"} onChange={()=>setPeriod("day")}/> Un giorno</label><label><input type="radio" checked={period==="month"} onChange={()=>setPeriod("month")}/> Tutto il mese</label><label><input type="radio" checked={period==="range"} onChange={()=>setPeriod("range")}/> Intervallo personalizzato</label></fieldset>
    {period!=="month"&&<div className="print-dates"><label>Dal giorno<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>{period==="range"&&<label>Al giorno<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>}</div>}
    <label className="check-field"><input type="checkbox" checked={offerings} onChange={e=>setOfferings(e.target.checked)}/> Includi importi delle offerte</label>{error&&<p className="error">{error}</p>}</div>
    <PrintIntentionsReport items={items} from={bounds()[0]} to={bounds()[1]} offerings={offerings}/>
    <div className="actions no-print"><button onClick={close}>Annulla</button><button className="primary" disabled={printing} onClick={print}><Printer/> {printing?"Preparazione…":"Stampa elenco"}</button></div></div></div>;
}

function PrintIntentionsReport({items,from,to,offerings}:{items:MassIntention[];from:string;to:string;offerings:boolean}){
  return <div className="print-report"><h1>Elenco intenzioni delle messe</h1><p>Periodo: {from===to?from:`dal ${from} al ${to}`}</p><table><thead><tr><th>Giorno</th><th>Ora</th><th>Intenzione</th>{offerings&&<th>Offerta</th>}</tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.mass_date}</td><td>{item.mass_time}</td><td>{item.intention_text}</td>{offerings&&<td>€ {(item.offering_cents/100).toFixed(2)}</td>}</tr>)}</tbody></table>{items.length===0&&<p>Nessuna intenzione nel periodo selezionato.</p>}</div>;
}

function DayDetail({date,items,schedules,settingsRepository,back,add,edit,changed,dialogs}:{date:string;items:MassIntention[];schedules:MassScheduleRule[];settingsRepository:typeof loadSettings;back:()=>void;add:(time:string)=>void;edit:(item:MassIntention)=>void;changed:()=>void;dialogs:ReactNode}){
  const [maximum,setMaximum]=useState(3),[deleting,setDeleting]=useState<MassIntention|null>(null);
  useEffect(()=>{settingsRepository().then(s=>setMaximum(s.max_intentions_per_mass))},[settingsRepository]);
  const day=new Date(`${date}T12:00:00`),configured=schedules.filter(s=>s.weekday===day.getDay()).map(s=>s.time);
  const times=Array.from(new Set([...configured,...items.map(i=>i.mass_time)])).sort();
  return <section className="day-detail"><header><div><button className="back-button" onClick={back}><ArrowLeft/> Torna al calendario</button><h1>{format(day,"EEEE d MMMM yyyy",{locale:it})}</h1><p className="page-subtitle">{items.length} {items.length===1?"intenzione registrata":"intenzioni registrate"}</p></div><button className="primary" onClick={()=>add(configured[0]??"18:00")}>+ Aggiungi intenzione</button></header>
    <div className="schedule-list">{times.length===0?<div className="empty-state"><h2>Nessuna messa configurata</h2><p>Puoi aggiungere comunque un’intenzione oppure configurare gli orari standard nelle Impostazioni.</p></div>:times.map(time=>{const slotItems=items.filter(i=>i.mass_time===time);return <section className="time-slot" key={time}>
      <div className="time-slot-head"><div><strong>{time}</strong><span>{slotItems.length} / {maximum} intenzioni</span></div><button className="secondary-button" disabled={slotItems.length>=maximum} onClick={()=>add(time)}>+ Aggiungi intenzione</button></div>
      {slotItems.length===0?<p className="slot-empty">Nessuna intenzione per questa messa.</p>:<div className="intention-rows">{slotItems.map(item=><article key={item.id}>
        <div><strong>{item.intention_text||item.remembered_person||"Intenzione senza testo"}</strong><span>{`${item.offerer_first_name} ${item.offerer_last_name}`.trim()||"Offerente non indicato"} · € {(item.offering_cents/100).toFixed(2)} · ricevuta n. {item.receipt_number}</span></div>
        <div className="row-actions"><button onClick={()=>edit(item)}><Pencil/> Modifica</button><button className="danger-ghost" onClick={()=>setDeleting(item)}><Trash2/> Elimina</button></div>
      </article>)}</div>}
    </section>})}</div>
    {deleting&&<DeleteIntentionDialog item={deleting} close={()=>setDeleting(null)} confirmed={async reason=>{await deleteIntention(deleting.id,reason);setDeleting(null);changed()}}/>}{dialogs}
  </section>;
}

function DeleteIntentionDialog({item,close,confirmed}:{item:MassIntention;close:()=>void;confirmed:(reason:string)=>Promise<void>}){
  const [reason,setReason]=useState(""),[error,setError]=useState("");
  return <div className="modal-backdrop"><div className="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Eliminare questa intenzione?</h2><p>Resterà nello storico e potrà essere ripristinata dall’Archivio.</p><blockquote>{item.intention_text}</blockquote>
    <label>Motivo dell’eliminazione<input required autoFocus value={reason} onChange={e=>setReason(e.target.value)} placeholder="Per esempio: inserimento errato"/></label>{error&&<p className="error">{error}</p>}
    <div className="actions"><button onClick={close}>Annulla</button><button className="danger-button" onClick={async()=>{if(!reason.trim())return setError("Indica il motivo dell’eliminazione.");await confirmed(reason)}}>Elimina intenzione</button></div></div></div>;
}

function IntentionDialog({initialDate,initialTime,initialRecord,repository,close,saved}:{initialDate:string;initialTime?:string;initialRecord?:MassIntention;repository:IntentionRepository;close:()=>void;saved:(record:MassIntention)=>void}){
  const [form,setForm]=useState<NewIntention>(initialRecord?{mass_date:initialRecord.mass_date,mass_time:initialRecord.mass_time,offerer_first_name:initialRecord.offerer_first_name,offerer_last_name:initialRecord.offerer_last_name,offerer_phone:initialRecord.offerer_phone,intention_text:initialRecord.intention_text,remembered_person:initialRecord.remembered_person,offering_cents:initialRecord.offering_cents,payment_method:initialRecord.payment_method,internal_notes:initialRecord.internal_notes}:{mass_date:initialDate,mass_time:initialTime??"18:00",offerer_first_name:"",offerer_last_name:"",offerer_phone:"",intention_text:"",remembered_person:"",offering_cents:1500,payment_method:"Contanti",internal_notes:""});
  const [maximum,setMaximum]=useState(3),[error,setError]=useState(""),[saving,setSaving]=useState(false);
  useEffect(()=>{repository.settings().then(s=>{setMaximum(s.max_intentions_per_mass);setForm(v=>({...v,offering_cents:s.default_offering_cents}))})},[repository]);
  const field=(key:keyof NewIntention,value:string|number)=>setForm({...form,[key]:value});
  async function submit(e:React.FormEvent){e.preventDefault();setError("");if(!form.intention_text.trim()&&!form.offerer_first_name.trim())return setError("Scrivi il testo dell’intenzione oppure il nome dell’offerente.");if(!form.intention_text.trim()&&!confirm("Il testo dell’intenzione è vuoto. Vuoi continuare?"))return;if(form.offering_cents===0&&!confirm("L’offerta è pari a zero. Vuoi continuare?"))return;setSaving(true);try{if(initialRecord){await (repository.update??updateIntention)(initialRecord.id,form);saved({...initialRecord,...form})}else saved(await repository.create(form,maximum))}catch(e){setError(typeof e==="string"?e:e instanceof Error?e.message:"Salvataggio non riuscito.")}finally{setSaving(false)}}
  return <div className="modal-backdrop"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="intention-title">
    <div className="dialog-head"><div><p className="eyebrow">{initialRecord?"Modifica":"Inserimento"}</p><h2 id="intention-title">{initialRecord?"Modifica intenzione":"Nuova intenzione"}</h2></div><button type="button" onClick={close}>Chiudi ×</button></div>
    <form onSubmit={submit}><div className="form-grid">
      <label>Data messa<input required type="date" value={form.mass_date} onChange={e=>field("mass_date",e.target.value)}/></label><label>Orario messa<input required type="time" value={form.mass_time} onChange={e=>field("mass_time",e.target.value)}/></label>
      <label>Nome offerente<input value={form.offerer_first_name} onChange={e=>field("offerer_first_name",e.target.value)}/></label><label>Cognome offerente<input value={form.offerer_last_name} onChange={e=>field("offerer_last_name",e.target.value)}/></label>
      <label>Telefono (facoltativo)<input value={form.offerer_phone} onChange={e=>field("offerer_phone",e.target.value)}/></label><label>Persona ricordata<input value={form.remembered_person} onChange={e=>field("remembered_person",e.target.value)}/></label>
      <label className="wide">Testo intenzione<textarea rows={3} value={form.intention_text} onChange={e=>field("intention_text",e.target.value)}/></label>
      <label>Offerta (€)<input required type="number" min="0" step=".01" value={form.offering_cents/100} onChange={e=>field("offering_cents",Math.round(+e.target.value*100))}/></label>
      <label>Pagamento<select value={form.payment_method} onChange={e=>field("payment_method",e.target.value)}><option>Contanti</option><option>Bonifico</option><option>Altro</option></select></label>
      <label className="wide">Note interne<textarea rows={2} value={form.internal_notes} onChange={e=>field("internal_notes",e.target.value)}/></label>
    </div>{error&&<p className="error" role="alert">{error}</p>}<div className="actions"><button type="button" onClick={close}>Annulla</button><button className="primary" disabled={saving}>{saving?"Salvataggio…":initialRecord?"Salva modifiche":"Salva intenzione"}</button></div></form>
  </div></div>;
}

function Archive({settings}:{settings:ParishSettings|null}){
  const [items,setItems]=useState<MassIntention[]>([]),[logs,setLogs]=useState<AuditLog[]>([]),[view,setView]=useState<"records"|"history">("records"),[query,setQuery]=useState(""),[receipt,setReceipt]=useState<MassIntention|null>(null),[restoring,setRestoring]=useState<MassIntention|null>(null),[cancelling,setCancelling]=useState<MassIntention|null>(null),[error,setError]=useState("");
  const refresh=()=>loadArchive().then(setItems).catch(e=>setError(String(e)));
  useEffect(()=>{refresh();loadAuditLogs().then(setLogs)},[]);
  const normalized=query.toLowerCase().trim();
  const visible=items.filter(i=>!normalized||[i.offerer_first_name,i.offerer_last_name,i.intention_text,i.remembered_person,String(i.receipt_number??"")].some(v=>v?.toLowerCase().includes(normalized)));
  function exportCsv(){
    const rows=[["Ricevuta","Data","Ora","Offerente","Intenzione","Offerta","Stato"],...visible.map(i=>[i.receipt_number??"",i.mass_date,i.mass_time,`${i.offerer_first_name} ${i.offerer_last_name}`.trim(),i.intention_text,(i.offering_cents/100).toFixed(2),i.receipt_status??"valid"])];
    const csv=rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(";")).join("\r\n");
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));link.download=`intenzioni-${format(new Date(),"yyyy-MM-dd")}.csv`;link.click();URL.revokeObjectURL(link.href);
  }
  return <section><header><div><p className="eyebrow">Consultazione</p><h1>Archivio e storico</h1></div>{view==="records"&&<button className="primary" onClick={exportCsv}><Download/> Esporta CSV</button>}</header>
    <div className="section-tabs"><button className={view==="records"?"active":""} onClick={()=>setView("records")}><ArchiveIcon/> Intenzioni</button><button className={view==="history"?"active":""} onClick={()=>setView("history")}><History/> Storico modifiche</button></div>
    {view==="records"?<div className="card"><label>Cerca per nome, testo o numero ricevuta<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Inizia a scrivere…"/></label>
    {error&&<p className="error">{error}</p>}<div className="archive-list">{visible.length===0?<p>Nessun risultato.</p>:visible.map(item=><article key={item.id} className={item.status==="deleted"?"record-deleted":""}>
      <div><strong>{item.mass_date} · ore {item.mass_time}</strong><p>{item.intention_text}</p><small>{`${item.offerer_first_name} ${item.offerer_last_name}`.trim()||"Offerente non indicato"} · € {(item.offering_cents/100).toFixed(2)}</small></div>
      <div className="receipt-actions"><span className={item.status==="deleted"||item.receipt_status==="cancelled"?"cancelled":""}>{item.status==="deleted"?"Eliminata":"Ricevuta n. "+item.receipt_number+(item.receipt_status==="cancelled"?" · annullata":"")}</span>{item.status==="deleted"?<button onClick={()=>setRestoring(item)}><RotateCcw/> Ripristina intenzione</button>:<><button onClick={()=>setReceipt(item)}><Printer/> Anteprima / stampa</button>{item.receipt_status!=="cancelled"&&<button onClick={()=>setCancelling(item)}>Annulla ricevuta</button>}</>}</div>
    </article>)}</div></div>
    :<div className="history-list">{logs.length===0?<p className="empty-state">Nessuna modifica registrata.</p>:logs.map(log=><article key={log.id}><span className={`history-action ${log.action}`}>{historyActionLabel(log.action)}</span><div><strong>{log.details||log.entity_type}</strong><small>{new Date(log.created_at.replace(" ","T")+"Z").toLocaleString("it-IT")}</small></div></article>)}</div>}
    {receipt&&<ReceiptPreview item={receipt} settings={settings} close={()=>setReceipt(null)}/>}
    {restoring&&<ConfirmDialog title="Ripristinare questa intenzione?" body="Tornerà attiva nella giornata e nella fascia oraria originali, se c’è ancora disponibilità." confirmLabel="Ripristina intenzione" close={()=>setRestoring(null)} confirmed={async()=>{await restoreIntention(restoring.id);setRestoring(null);await refresh();setLogs(await loadAuditLogs())}}/>}
    {cancelling&&<ReasonDialog title="Annullare questa ricevuta?" body={`La ricevuta n. ${cancelling.receipt_number} resterà nello storico come annullata.`} label="Motivo dell’annullamento" confirmLabel="Annulla ricevuta" close={()=>setCancelling(null)} confirmed={async reason=>{await cancelReceipt(cancelling.id,reason);setCancelling(null);await refresh();setLogs(await loadAuditLogs())}}/>}
  </section>;
}

function historyActionLabel(action:string){return ({create:"Creazione",update:"Modifica",delete:"Eliminazione",restore:"Ripristino",cancel:"Annullamento"} as Record<string,string>)[action]??action}

function ConfirmDialog({title,body,confirmLabel,close,confirmed,danger=false}:{title:string;body:string;confirmLabel:string;close:()=>void;confirmed:()=>Promise<void>;danger?:boolean}){
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  return <div className="modal-backdrop"><div className="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{title}</h2><p>{body}</p>{error&&<p className="error">{error}</p>}<div className="actions"><button onClick={close}>Annulla</button><button disabled={busy} className={danger?"danger-button":"primary"} onClick={async()=>{setBusy(true);try{await confirmed()}catch(e){setError(String(e));setBusy(false)}}}>{busy?"Operazione in corso…":confirmLabel}</button></div></div></div>;
}

function ReasonDialog({title,body,label,confirmLabel,close,confirmed}:{title:string;body:string;label:string;confirmLabel:string;close:()=>void;confirmed:(reason:string)=>Promise<void>}){
  const [reason,setReason]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  return <div className="modal-backdrop"><div className="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reason-title"><h2 id="reason-title">{title}</h2><p>{body}</p><label>{label}<input required autoFocus value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p className="error">{error}</p>}<div className="actions"><button onClick={close}>Annulla</button><button disabled={busy} className="danger-button" onClick={async()=>{if(!reason.trim())return setError("Il motivo è obbligatorio.");setBusy(true);try{await confirmed(reason)}catch(e){setError(String(e));setBusy(false)}}}>{busy?"Operazione in corso…":confirmLabel}</button></div></div></div>;
}

function ReceiptPreview({item,settings,close}:{item:MassIntention;settings:ParishSettings|null;close:()=>void}){
  return <div className="modal-backdrop"><div className="dialog receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
    <div className="dialog-head no-print"><h2 id="receipt-title">Anteprima ricevuta</h2><button onClick={close}>Chiudi ×</button></div>
    <div className={`receipt ${settings?.receipt_paper_size??"58mm"}`}><h2>{settings?.parish_name??"Parrocchia"}</h2><p>{settings?.address}</p>{(settings?.priest_first_name||settings?.priest_last_name)&&<p>Parroco: Don {`${settings.priest_first_name} ${settings.priest_last_name}`.trim()}</p>}<hr/><strong>RICEVUTA N. {item.receipt_number}</strong>
      <p>Ricevuta da: {`${item.offerer_first_name} ${item.offerer_last_name}`.trim()||"—"}</p><p>Intenzione:<br/><strong>{item.intention_text}</strong></p>
      <p>Messa: {item.mass_date} ore {item.mass_time}</p><p>Offerta: <strong>€ {(item.offering_cents/100).toFixed(2)}</strong></p><hr/><p>Grazie</p></div>
    <div className="actions no-print"><button onClick={close}>Chiudi</button><button className="primary" onClick={()=>window.print()}><Printer/> Stampa ricevuta</button></div>
  </div></div>;
}

function Settings({value,changed}:{value:ParishSettings|null;changed:(v:ParishSettings)=>void}){
  const [form,setForm]=useState(value),[section,setSection]=useState<"parish"|"schedules"|"appearance"|"user"|"backup">("parish"),[message,setMessage]=useState("");
  useEffect(()=>{if(!form)loadSettings().then(v=>{setForm(v);changed(v)})},[form,changed]);
  if(!form)return <p>Caricamento impostazioni…</p>;
  const field=(key:keyof ParishSettings,val:string|number)=>setForm({...form,[key]:val});
  async function submit(e:React.FormEvent){e.preventDefault();await saveSettings(form!);changed(form!);setMessage("Impostazioni salvate correttamente.");}
  const sections=[["parish","Parrocchia",Church],["schedules","Orari delle messe",CalendarDays],["appearance","Aspetto e logo",Palette],["user","Utente e sicurezza",Shield],["backup","Backup e ripristino",RotateCcw]] as const;
  return <section><header><div><p className="eyebrow">Configurazione</p><h1>Impostazioni</h1><p className="page-subtitle">Scegli una sezione e modifica solo ciò che ti serve.</p></div></header>
    <div className="settings-layout"><nav className="settings-nav" aria-label="Sezioni impostazioni">{sections.map(([key,label,Icon])=><button key={key} className={section===key?"active":""} onClick={()=>{setSection(key);setMessage("")}}><Icon/> {label}</button>)}</nav>
    <div className="settings-panel">
      {section==="parish"&&<form onSubmit={submit}><h2>Configurazione parrocchia</h2><p>Dati mostrati nel gestionale e sulle ricevute.</p><div className="form-grid">
        <label>Nome parrocchia<input required value={form.parish_name} onChange={e=>field("parish_name",e.target.value)}/></label><label>Indirizzo<input value={form.address} onChange={e=>field("address",e.target.value)}/></label>
        <label>Nome del sacerdote<input value={form.priest_first_name} onChange={e=>field("priest_first_name",e.target.value)}/></label><label>Cognome del sacerdote<input value={form.priest_last_name} onChange={e=>field("priest_last_name",e.target.value)}/></label>
        <label>Telefono<input value={form.phone} onChange={e=>field("phone",e.target.value)}/></label><label>Email<input type="email" value={form.email} onChange={e=>field("email",e.target.value)}/></label>
        <label>Offerta predefinita (€)<input type="number" min="0" step=".01" value={form.default_offering_cents/100} onChange={e=>field("default_offering_cents",Math.round(+e.target.value*100))}/></label>
        <label>Massimo intenzioni per messa<input type="number" min="1" value={form.max_intentions_per_mass} onChange={e=>field("max_intentions_per_mass",+e.target.value)}/></label>
        <label>Formato ricevuta<select value={form.receipt_paper_size} onChange={e=>field("receipt_paper_size",e.target.value)}><option>58mm</option><option>80mm</option></select></label></div>
        {message&&<p className="success">{message}</p>}<button className="primary"><Save/> Salva configurazione</button></form>}
      {section==="schedules"&&<ScheduleSettings/>}
      {section==="appearance"&&<AppearanceSettings form={form} field={field} saved={async()=>{await saveSettings(form);changed(form);setMessage("Aspetto aggiornato.")}} message={message}/>}
      {section==="user"&&<PasswordSettings/>}
      {section==="backup"&&<BackupSettings/>}
    </div></div>
  </section>;
}

function AppearanceSettings({form,field,saved,message}:{form:ParishSettings;field:(key:keyof ParishSettings,val:string|number)=>void;saved:()=>Promise<void>;message:string}){
  function upload(file?:File){if(!file)return;const reader=new FileReader();reader.onload=()=>field("logo_data_url",String(reader.result));reader.readAsDataURL(file)}
  return <div><h2>Aspetto e logo</h2><p>Personalizza i colori principali e il simbolo mostrato nella barra laterale.</p><div className="appearance-preview" style={{background:form.primary_color}}>{form.logo_data_url?<img src={form.logo_data_url} alt="Anteprima logo"/>:<Church/>}<strong>{form.parish_name}</strong></div>
    <div className="form-grid"><label>Colore principale<input type="color" value={form.primary_color} onChange={e=>field("primary_color",e.target.value)}/></label><label>Colore evidenziazione<input type="color" value={form.accent_color} onChange={e=>field("accent_color",e.target.value)}/></label><label className="wide">Logo della parrocchia<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>upload(e.target.files?.[0])}/></label></div>
    {form.logo_data_url&&<button className="secondary-button" onClick={()=>field("logo_data_url","")}>Rimuovi logo</button>} {message&&<p className="success">{message}</p>}<button className="primary" onClick={saved}><Save/> Salva aspetto</button></div>;
}

function BackupSettings(){
  const [message,setMessage]=useState(""),[restore,setRestore]=useState(false);
  return <div><h2>Backup e ripristino</h2><p>I backup vengono salvati nella cartella Documenti. L’app ne crea automaticamente uno al giorno.</p>
    {message&&<p className={message.startsWith("Errore")?"error":"success"}>{message}</p>}<div className="settings-actions"><button className="primary" onClick={async()=>{try{setMessage(`Backup creato in: ${await createBackup()}`)}catch(e){setMessage(`Errore: ${String(e)}`)}}}>Crea backup ora</button><button className="secondary-button" onClick={()=>setRestore(true)}>Ripristina ultimo backup</button></div>
    {restore&&<ConfirmDialog title="Ripristinare l’ultimo backup?" body="Prima del ripristino verrà conservata una copia del database attuale. L’app si riavvierà automaticamente." confirmLabel="Ripristina backup" close={()=>setRestore(false)} confirmed={async()=>{await invoke("restore_latest_backup")}}/>}</div>;
}

function PasswordSettings(){
  const [current,setCurrent]=useState(""),[next,setNext]=useState(""),[message,setMessage]=useState(""),[deleteOpen,setDeleteOpen]=useState(false);
  async function change(){setMessage("");try{await invoke("change_password",{currentPassword:current,newPassword:next});setCurrent("");setNext("");setMessage("Password aggiornata correttamente.")}catch(e){setMessage(String(e))}}
  return <div><h2>Utente e sicurezza</h2><p>Aggiorna la password usata per entrare nel gestionale.</p><div className="form-grid"><label>Password attuale<input type="password" value={current} onChange={e=>setCurrent(e.target.value)}/></label><label>Nuova password (almeno 8 caratteri)<input type="password" value={next} onChange={e=>setNext(e.target.value)}/></label></div>
    {message&&<p className={message.startsWith("Password aggiornata")?"success":"error"}>{message}</p>}<button className="primary" type="button" onClick={change}><Save/> Aggiorna password</button>
    <div className="danger-zone"><h3>Zona pericolosa</h3><p>Eliminando l’account verrà rimossa la password di accesso. I dati parrocchiali e lo storico resteranno nel computer.</p><button className="danger-button" onClick={()=>setDeleteOpen(true)}><Trash2/> Elimina account locale</button></div>
    {deleteOpen&&<AccountDeleteDialog close={()=>setDeleteOpen(false)}/>}</div>;
}

function AccountDeleteDialog({close}:{close:()=>void}){
  const [password,setPassword]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  return <div className="modal-backdrop"><div className="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="account-delete-title"><h2 id="account-delete-title">Eliminare l’account locale?</h2><p>Questa operazione rimuove le credenziali di accesso. Al prossimo avvio sarà necessario creare una nuova password.</p><label>Conferma con la password attuale<input autoFocus type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p className="error">{error}</p>}
    <div className="actions"><button onClick={close}>Annulla</button><button disabled={busy} className="danger-button" onClick={async()=>{setBusy(true);try{await invoke("delete_account",{currentPassword:password});location.reload()}catch(e){setError(String(e));setBusy(false)}}}>Elimina account locale</button></div></div></div>;
}

function ScheduleSettings(){
  const names=["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
  const [rules,setRules]=useState<MassScheduleRule[]>([]),[message,setMessage]=useState("");
  useEffect(()=>{loadSchedules().then(setRules)},[]);
  function timesFor(day:number){return rules.filter(r=>r.weekday===day).map(r=>r.time).join(", ")}
  function change(day:number,text:string){const other=rules.filter(r=>r.weekday!==day);const parsed=text.split(",").map(t=>t.trim()).filter(t=>/^\d{2}:\d{2}$/.test(t)).map(time=>({weekday:day,time,max_intentions:null}));setRules([...other,...parsed])}
  return <div className="schedule-settings"><h2>Orari standard delle messe</h2><p>Inserisci gli orari separati da virgola, nel formato 08:30, 18:00.</p>
    <div className="form-grid">{names.map((name,day)=><label key={`${name}-${timesFor(day)}`}>{name}<input defaultValue={timesFor(day)} onBlur={e=>change(day,e.target.value)} placeholder="Nessuna messa"/></label>)}</div>
    {message&&<p className="success">{message}</p>}<button className="primary" type="button" onClick={async()=>{await saveSchedules(rules);setMessage("Orari delle messe salvati.")}}><Save/> Salva orari messe</button>
  </div>;
}

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CalendarDays, Church, LogOut, Save, Settings as Cog } from "lucide-react";
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { createIntention, loadIntentionCounts, loadSettings, saveSettings } from "./lib/db";
import type { NewIntention, ParishSettings } from "./lib/db";

export function App() {
  const [authenticated,setAuthenticated]=useState(false), [setup,setSetup]=useState(false), [loading,setLoading]=useState(true);
  const [page,setPage]=useState<"calendar"|"settings">("calendar"); const [settings,setSettings]=useState<ParishSettings|null>(null);
  useEffect(()=>{invoke<boolean>("has_password").then(v=>setSetup(!v)).finally(()=>setLoading(false))},[]);
  if(loading)return <main className="center">Avvio del gestionale…</main>;
  if(!authenticated)return <Login setup={setup} done={()=>{setSetup(false);setAuthenticated(true)}}/>;
  return <div className="shell"><aside><div className="brand"><Church size={34}/><span>{settings?.parish_name??"Gestionale Messe"}</span></div>
    <nav><button className={page==="calendar"?"active":""} onClick={()=>setPage("calendar")}><CalendarDays/> Calendario</button>
    <button className={page==="settings"?"active":""} onClick={()=>setPage("settings")}><Cog/> Impostazioni</button></nav>
    <button className="logout" onClick={()=>setAuthenticated(false)}><LogOut/> Esci</button></aside>
    <main>{page==="calendar"?<Calendar/>:<Settings value={settings} changed={setSettings}/>}</main></div>;
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

type IntentionRepository={counts:typeof loadIntentionCounts;settings:typeof loadSettings;create:typeof createIntention};
const defaultRepository:IntentionRepository={counts:loadIntentionCounts,settings:loadSettings,create:createIntention};

export function Calendar({repository=defaultRepository}:{repository?:IntentionRepository}){
  const [month,setMonth]=useState(new Date()),[selected,setSelected]=useState<string|null>(null),[counts,setCounts]=useState<Record<string,number>>({});
  const days=useMemo(()=>eachDayOfInterval({start:startOfMonth(month),end:endOfMonth(month)}),[month]);
  const blanks=(getDay(startOfMonth(month))+6)%7;
  const refresh=()=>repository.counts(format(startOfMonth(month),"yyyy-MM-dd"),format(endOfMonth(month),"yyyy-MM-dd")).then(setCounts);
  useEffect(()=>{refresh()},[month]);
  return <section><header><div><p className="eyebrow">Schermata principale</p><h1>Calendario messe</h1></div><button className="primary" onClick={()=>setSelected(format(new Date(),"yyyy-MM-dd"))}>+ Aggiungi intenzione</button></header>
    <div className="card"><div className="month"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1))}>← Mese precedente</button>
    <h2>{format(month,"MMMM yyyy",{locale:it})}</h2><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1))}>Mese successivo →</button></div>
    <div className="week">{["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(x=><strong key={x}>{x}</strong>)}</div><div className="grid">
    {Array.from({length:blanks},(_,i)=><span key={i}/>)}{days.map(day=>{const key=format(day,"yyyy-MM-dd"),count=counts[key]??0;return <button key={key} onClick={()=>setSelected(key)} className={key===format(new Date(),"yyyy-MM-dd")?"today":""}>
    <b>{format(day,"d")}</b><small>{count===0?"Nessuna intenzione":`${count} ${count===1?"intenzione":"intenzioni"}`}</small></button>})}</div></div>
    {selected&&<IntentionDialog initialDate={selected} repository={repository} close={()=>setSelected(null)} saved={()=>{setSelected(null);refresh()}}/>}
  </section>;
}

function IntentionDialog({initialDate,repository,close,saved}:{initialDate:string;repository:IntentionRepository;close:()=>void;saved:()=>void}){
  const [form,setForm]=useState<NewIntention>({mass_date:initialDate,mass_time:"18:00",offerer_first_name:"",offerer_last_name:"",offerer_phone:"",intention_text:"",remembered_person:"",offering_cents:1500,payment_method:"Contanti",internal_notes:""});
  const [maximum,setMaximum]=useState(3),[error,setError]=useState(""),[saving,setSaving]=useState(false);
  useEffect(()=>{repository.settings().then(s=>{setMaximum(s.max_intentions_per_mass);setForm(v=>({...v,offering_cents:s.default_offering_cents}))})},[repository]);
  const field=(key:keyof NewIntention,value:string|number)=>setForm({...form,[key]:value});
  async function submit(e:React.FormEvent){e.preventDefault();setError("");if(!form.intention_text.trim())return setError("Scrivi il testo dell’intenzione.");setSaving(true);try{await repository.create(form,maximum);saved()}catch(e){setError(e instanceof Error?e.message:"Salvataggio non riuscito.")}finally{setSaving(false)}}
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

function Settings({value,changed}:{value:ParishSettings|null;changed:(v:ParishSettings)=>void}){
  const [form,setForm]=useState(value),[message,setMessage]=useState("");
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
    {message&&<p className="success">{message}</p>}<button className="primary"><Save/> Salva impostazioni</button></form></section>;
}

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CalendarDays, Church, LogOut, Save, Settings as Cog } from "lucide-react";
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { loadSettings, saveSettings } from "./lib/db";
import type { ParishSettings } from "./lib/db";

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

function Calendar(){
  const [month,setMonth]=useState(new Date());
  const days=useMemo(()=>eachDayOfInterval({start:startOfMonth(month),end:endOfMonth(month)}),[month]);
  const blanks=(getDay(startOfMonth(month))+6)%7;
  return <section><header><div><p className="eyebrow">Schermata principale</p><h1>Calendario messe</h1></div><button className="primary">+ Aggiungi intenzione</button></header>
    <div className="card"><div className="month"><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1))}>← Mese precedente</button>
    <h2>{format(month,"MMMM yyyy",{locale:it})}</h2><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1))}>Mese successivo →</button></div>
    <div className="week">{["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(x=><strong key={x}>{x}</strong>)}</div><div className="grid">
    {Array.from({length:blanks},(_,i)=><span key={i}/>)}{days.map(day=><button key={day.toISOString()} className={format(day,"yyyy-MM-dd")===format(new Date(),"yyyy-MM-dd")?"today":""}>
    <b>{format(day,"d")}</b><small>Nessuna intenzione</small></button>)}</div></div></section>;
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

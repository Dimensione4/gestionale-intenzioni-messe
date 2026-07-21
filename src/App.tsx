import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Archive as ArchiveIcon, ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Church, Cloud, Download, FileText, Grid3X3, History, List, LogOut, Palette, Pencil, Plus, Printer, RefreshCw, RotateCcw, Save, Settings as Cog, Shield, Trash2, X } from "lucide-react";
import { eachDayOfInterval, endOfMonth, endOfWeek, format, getDay, startOfMonth, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { cancelReceipt, createBackup, createIntention, createMassMemo, deleteIntention, deleteMassMemo, loadArchive, loadAuditLogs, loadIntentions, loadMassMemos, loadSchedules, loadSettings, restoreIntention, saveSchedules, saveSettings, updateIntention, updateMassMemo } from "./lib/db";
import type { AuditLog, MassIntention, MassMemo, MassScheduleRule, NewIntention, ParishSettings } from "./lib/db";
import { getCelebrationOfDay } from "./lib/saints";

type SettingsSection="parish"|"schedules"|"receipt"|"appearance"|"user"|"backup";
type PrintFormat="a4"|"thermal";
type GoogleDriveConnection={connected:boolean;account_email:string;message:string};
type GoogleDriveUploadResult={id:string;name:string;web_view_link?:string|null;folder_path:string};

export function App() {
  const [authenticated,setAuthenticated]=useState(false), [setup,setSetup]=useState(false), [loading,setLoading]=useState(true);
  const [page,setPage]=useState<"calendar"|"memos"|"archive"|"settings"|"tutorial">("calendar"); const [settings,setSettings]=useState<ParishSettings|null>(null);
  const [settingsStart,setSettingsStart]=useState<SettingsSection>("parish");
  const [availableUpdate,setAvailableUpdate]=useState<Update|null>(null),[tutorialOpen,setTutorialOpen]=useState(false);
  useEffect(()=>{Promise.all([invoke<boolean>("has_password"),invoke<boolean>("has_remembered_login")]).then(([hasPassword,remembered])=>{setSetup(!hasPassword);if(hasPassword&&remembered)setAuthenticated(true)}).finally(()=>setLoading(false))},[]);
  useEffect(()=>{if(authenticated)loadSettings().then(setSettings)},[authenticated]);
  useEffect(()=>{if(!settings)return;document.documentElement.style.setProperty("--primary",settings.primary_color);document.documentElement.style.setProperty("--primary-deep",settings.primary_color);document.documentElement.style.setProperty("--accent",settings.accent_color)},[settings]);
  useEffect(()=>{if(!authenticated||!settings)return;const run=()=>{const frequency=(settings.backup_frequency_hours??6)*60*60*1000,last=Number(localStorage.getItem("last-auto-backup-at")??0);if(Date.now()-last<frequency)return;createBackup().then(()=>localStorage.setItem("last-auto-backup-at",String(Date.now()))).catch(()=>undefined)};run();const timer=window.setInterval(run,15*60*1000);return()=>window.clearInterval(timer)},[authenticated,settings]);
  useEffect(()=>{if(!authenticated)return;let active=true;checkForAvailableUpdate().then(update=>{if(active&&update)setAvailableUpdate(update)}).catch(()=>undefined);return()=>{active=false}},[authenticated]);
  useEffect(()=>{if(authenticated&&localStorage.getItem("tutorial-completed")!=="1")setTutorialOpen(true)},[authenticated]);
  if(loading)return <main className="center">Avvio del gestionale…</main>;
  if(!authenticated)return <Login setup={setup} done={()=>{setSetup(false);setAuthenticated(true)}}/>;
  const openTutorialSection=(target:TutorialTarget)=>{if(target.page==="settings")setSettingsStart(target.settingsStart??"parish");setPage(target.page)};
  return <div className="shell"><aside><div className="brand">{settings?.logo_data_url?<img src={settings.logo_data_url} alt="Logo parrocchia"/>:<Church size={34}/>}<span>{settings?.parish_name??"Gestionale Messe"}</span></div>
    <nav><button className={page==="calendar"?"active":""} onClick={()=>setPage("calendar")}><CalendarDays/> Calendario</button>
    <button className={page==="memos"?"active":""} onClick={()=>setPage("memos")}><FileText/> Promemoria</button>
    <button className={page==="archive"?"active":""} onClick={()=>setPage("archive")}><ArchiveIcon/> Archivio</button>
    <button className={page==="tutorial"?"active":""} onClick={()=>setPage("tutorial")}><BookOpen/> Tutorial</button>
    <button className={page==="settings"?"active":""} onClick={()=>{setSettingsStart("parish");setPage("settings")}}><Cog/> Impostazioni</button></nav>
    <button className="logout" onClick={async()=>{await invoke("clear_remembered_login").catch(()=>undefined);setAuthenticated(false)}}><LogOut/> Esci</button></aside>
    <main>{page==="calendar"?<Calendar/>:page==="memos"?<Memos/>:page==="archive"?<Archive settings={settings} configureReceipt={()=>{setSettingsStart("receipt");setPage("settings")}}/>:page==="tutorial"?<TutorialPage openSection={openTutorialSection}/>:<Settings value={settings} changed={setSettings} initialSection={settingsStart}/>}<AppFooter/></main>
    {tutorialOpen&&<TutorialOverlay close={()=>{localStorage.setItem("tutorial-completed","1");setTutorialOpen(false)}} openTutorial={()=>{setPage("tutorial");localStorage.setItem("tutorial-completed","1");setTutorialOpen(false)}}/>}
    {availableUpdate&&<UpdateDialog update={availableUpdate} close={()=>setAvailableUpdate(null)}/>}</div>;
}

async function checkForAvailableUpdate(){
  return check({timeout:10000});
}

export function updateCheckErrorMessage(error:unknown){
  const raw=String(error);
  if(raw.includes("valid release JSON")||raw.includes("latest.json"))return "Canale aggiornamenti non ancora inizializzato: su GitHub Releases manca il file latest.json. Pubblica una release firmata e riprova.";
  if(raw.toLowerCase().includes("fetch"))return "Non riesco a contattare il canale aggiornamenti. Verifica la connessione internet e riprova.";
  return `Controllo aggiornamenti non riuscito: ${raw}`;
}

function updateBody(update:Update){
  return update.body?.trim()||"Nuova versione pronta per l'installazione.";
}

function UpdateDialog({update,close}:{update:Update;close:()=>void}){
  const [installing,setInstalling]=useState(false),[message,setMessage]=useState(""),[downloaded,setDownloaded]=useState(0),[total,setTotal]=useState(0),[error,setError]=useState("");
  const progress=total>0?Math.min(100,Math.round(downloaded*100/total)):undefined;
  async function install(){
    setInstalling(true);setError("");setMessage("Preparazione aggiornamento...");
    let received=0;
    try{
      await update.downloadAndInstall(event=>{
        if(event.event==="Started"){received=0;setTotal(event.data.contentLength??0);setDownloaded(0);setMessage("Download dell'aggiornamento in corso...");return;}
        if(event.event==="Progress"){received+=event.data.chunkLength;setDownloaded(received);setMessage("Download dell'aggiornamento in corso...");return;}
        setMessage("Aggiornamento scaricato. Riavvio del gestionale...");
      });
      await relaunch();
    }catch(e){setError(String(e));setInstalling(false);}
  }
  return <div className="modal-backdrop"><div className="dialog update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title"><div className="update-hero"><RefreshCw/><div><p className="eyebrow">Aggiornamento disponibile</p><h2 id="update-title">Versione {update.version}</h2></div></div>
    <p>Stai usando la versione {update.currentVersion}. Puoi installare ora l'aggiornamento; il gestionale si riaprirà automaticamente.</p>
    <div className="update-notes"><strong>Novità</strong><p>{updateBody(update)}</p></div>
    {message&&<div className="update-progress" role="status"><span>{message}</span>{progress!==undefined&&<progress max="100" value={progress}/>}</div>}
    {error&&<p className="error">{error}</p>}
    <div className="actions"><button disabled={installing} onClick={close}>Più tardi</button><button className="primary" disabled={installing} onClick={install}><Download/> {installing?"Installazione...":"Installa aggiornamento"}</button></div></div></div>;
}

type TutorialTarget={page:"calendar"|"archive"|"settings"|"tutorial";settingsStart?:SettingsSection};
type TutorialDemoKind="calendar"|"day"|"archive"|"receipt"|"backup"|"settings";
type TutorialStep={title:string;body:string;sectionLabel:string;target:TutorialTarget;demo:{title:string;caption:string;kind:TutorialDemoKind}[]};
const tutorialSteps:TutorialStep[]=[
  {title:"Calendario",body:"Vedi il mese, riconosci subito le intenzioni compilate e apri il dettaglio della giornata.",sectionLabel:"Apri calendario",target:{page:"calendar"},demo:[
    {title:"Vista mese",caption:"Le giornate mostrano orari disponibili e nomi delle persone ricordate.",kind:"calendar"},
    {title:"Dettaglio giornata",caption:"Cliccando sul giorno vedi le fasce orarie e il pulsante per aggiungere intenzioni.",kind:"day"},
    {title:"Modifica rapida",caption:"Ogni riga già compilata può essere modificata o eliminata con storico.",kind:"day"},
  ]},
  {title:"Ricevute",body:"Controlla l'anteprima, scegli cosa stampare e usa formati termici o etichette Brother.",sectionLabel:"Apri archivio",target:{page:"archive"},demo:[
    {title:"Anteprima ricevuta",caption:"La ricevuta mostra parrocchia, numero, offerente, intenzione, messa e offerta.",kind:"receipt"},
    {title:"Formato stampante",caption:"Puoi usare 58mm, 80mm o dimensioni personalizzate per etichette.",kind:"receipt"},
    {title:"Stampa/PDF",caption:"Il titolo PDF è dinamico e non usa il nome generico del gestionale.",kind:"receipt"},
  ]},
  {title:"Archivio e storico",body:"Cerca, filtra, ristampa, annulla ricevute e ripristina intenzioni eliminate.",sectionLabel:"Apri archivio",target:{page:"archive"},demo:[
    {title:"Filtri e ordinamento",caption:"Ordina per ricevuta, data o persona ricordata.",kind:"archive"},
    {title:"Cestino",caption:"Le intenzioni eliminate non spariscono: restano ripristinabili.",kind:"archive"},
    {title:"Storico modifiche",caption:"Creazioni, modifiche e annullamenti restano tracciati.",kind:"archive"},
  ]},
  {title:"Backup",body:"Crea backup locali automatici, backup cifrati e predisponi Google Drive.",sectionLabel:"Apri backup",target:{page:"settings",settingsStart:"backup"},demo:[
    {title:"Backup ogni 6 ore",caption:"I file vengono ordinati per giorno e orario nella cartella Documenti.",kind:"backup"},
    {title:"Backup cifrato",caption:"Il file .gimbackup è pensato per essere copiato online in sicurezza.",kind:"backup"},
    {title:"Google Drive",caption:"Il collegamento resta disattivato finché non viene autorizzato via OAuth.",kind:"backup"},
  ]},
  {title:"Impostazioni",body:"Configura parrocchia, sacerdote, orari, colori, logo, ricevute e sicurezza.",sectionLabel:"Apri impostazioni",target:{page:"settings",settingsStart:"parish"},demo:[
    {title:"Dati parrocchia",caption:"Nome, indirizzo, contatti e sacerdote finiscono nella ricevuta.",kind:"settings"},
    {title:"Orari messe",caption:"Aggiungi e rimuovi orari standard con selettori chiari.",kind:"settings"},
    {title:"Configuratore ricevuta",caption:"Scegli quali dati stampare e il formato della carta.",kind:"receipt"},
  ]},
];

function TutorialOverlay({close,openTutorial}:{close:()=>void;openTutorial:()=>void}){
  const [step,setStep]=useState(0),current=tutorialSteps[step];
  return <div className="modal-backdrop"><div className="dialog tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><div className="tutorial-step-count">Passo {step+1} di {tutorialSteps.length}</div><h2 id="tutorial-title">{current.title}</h2><p>{current.body}</p>
    <div className="tutorial-dots" aria-hidden="true">{tutorialSteps.map((_,index)=><span key={index} className={index===step?"active":""}/>)}</div>
    <div className="actions"><button onClick={close}>Salta tutorial</button><button className="secondary-button" onClick={openTutorial}><BookOpen/> Apri libreria tutorial</button>{step<tutorialSteps.length-1?<button className="primary" onClick={()=>setStep(step+1)}>Avanti</button>:<button className="primary" onClick={close}>Inizia a usare il gestionale</button>}</div></div></div>;
}

export function TutorialPage({openSection}:{openSection:(target:TutorialTarget)=>void}){
  const [demo,setDemo]=useState<TutorialStep|null>(null);
  return <section><header><div><p className="eyebrow">Guida rapida</p><h1>Tutorial</h1><p className="page-subtitle">Una piccola libreria sempre disponibile per ripassare le funzioni principali.</p></div></header>
    <div className="tutorial-library">{tutorialSteps.map((step,index)=><article key={step.title}><span>{index+1}</span><div><h2>{step.title}</h2><p>{step.body}</p><div className="tutorial-actions"><button className="primary" onClick={()=>setDemo(step)}><BookOpen/> Vedi demo</button><button className="secondary-button" onClick={()=>openSection(step.target)}>{step.sectionLabel}</button></div></div></article>)}</div>
    <div className="card tutorial-note"><h2>Consiglio operativo</h2><p>Prima di usare il gestionale in parrocchia configura orari standard, dati della parrocchia e fai un backup manuale di prova.</p></div>
    {demo&&<TutorialDemoModal step={demo} close={()=>setDemo(null)} openSection={()=>{openSection(demo.target);setDemo(null)}}/>}
  </section>;
}

function TutorialDemoModal({step,close,openSection}:{step:TutorialStep;close:()=>void;openSection:()=>void}){
  const [frame,setFrame]=useState(0),[playing,setPlaying]=useState(true);
  useEffect(()=>{if(!playing)return;const timer=window.setInterval(()=>setFrame(current=>(current+1)%step.demo.length),2300);return()=>window.clearInterval(timer)},[playing,step]);
  const current=step.demo[frame];
  return <div className="modal-backdrop"><div className="dialog tutorial-demo-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-demo-title"><div className="dialog-head"><div><p className="eyebrow">Demo guidata</p><h2 id="tutorial-demo-title">{step.title}: {current.title}</h2></div><button onClick={close}><X/> Chiudi</button></div>
    <DemoFrame kind={current.kind}/>
    <p className="tutorial-demo-caption">{current.caption}</p>
    <div className="tutorial-dots" aria-label="Passaggi demo">{step.demo.map((item,index)=><button key={item.title} aria-label={`Mostra ${item.title}`} className={index===frame?"active":""} onClick={()=>{setFrame(index);setPlaying(false)}}/>)}</div>
    <div className="actions"><button onClick={()=>setPlaying(!playing)}>{playing?"Pausa demo":"Riprendi demo"}</button><button className="secondary-button" onClick={()=>setFrame((frame+step.demo.length-1)%step.demo.length)}>Indietro</button><button className="secondary-button" onClick={()=>setFrame((frame+1)%step.demo.length)}>Avanti</button><button className="primary" onClick={openSection}>{step.sectionLabel}</button></div></div></div>;
}

function DemoFrame({kind}:{kind:TutorialDemoKind}){
  if(kind==="calendar")return <div className="demo-screen calendar-demo"><div className="demo-toolbar"><span>Mese precedente</span><strong>Luglio 2026</strong><span>Mese successivo</span></div><div className="demo-calendar-grid">{Array.from({length:14},(_,i)=><div key={i} className={i===8?"active":""}><b>{i+1}</b>{i===8?<><small><strong>18:00</strong> Maria Rossi</small><small><strong>18:00</strong> Luigi Bianchi</small></>:<small>18:00 0 intenzioni</small>}</div>)}</div></div>;
  if(kind==="day")return <div className="demo-screen"><div className="demo-card-head"><strong>Giovedì 9 luglio</strong><button>+ Aggiungi intenzione</button></div><div className="demo-row"><b>08:30</b><span>Nessuna intenzione</span><button>+ Aggiungi</button></div><div className="demo-row filled"><b>18:00</b><span>Maria Rossi · € 15.00</span><button>Modifica</button></div></div>;
  if(kind==="archive")return <div className="demo-screen"><div className="demo-filter">Cerca per nome, testo o ricevuta</div><div className="demo-record"><strong>Ricevuta n. 4</strong><span>In memoria di Walter</span><button>Anteprima e stampa</button></div><div className="demo-record deleted"><strong>Eliminata</strong><span>Rosalia Bolognini</span><button>Ripristina</button></div></div>;
  if(kind==="receipt")return <div className="demo-screen receipt-demo"><div className="demo-receipt"><section><strong>La tua Parrocchia</strong><span>via Roma 2</span><span>dariomarcobellini@dimensione4.it</span></section><section><b>Ricevuta</b><strong>N. 1</strong></section><p>Ricevuta da <b>Maria Bolognini</b></p><p>Intenzione <b>Teresa</b></p><p className="demo-total">Offerta € 15.00</p></div></div>;
  if(kind==="backup")return <div className="demo-screen"><div className="demo-backup-path">Backup / 2026-07-09 / 18-00 / gestionale.sqlite</div><div className="demo-row filled"><b>.gimbackup</b><span>File cifrato pronto per cloud o chiavetta</span></div><div className="demo-row"><b>Google Drive</b><span>Autorizzazione OAuth dal browser</span><button>Collega</button></div></div>;
  return <div className="demo-screen"><div className="demo-settings-grid"><span>Parrocchia</span><span>Orari messe</span><span>Ricevuta</span><span>Aspetto</span></div><div className="demo-row filled"><b>Formato ricevuta</b><span>58mm · 80mm · etichetta 62×100</span></div></div>;
}

export function AppFooter({versionLoader=getVersion}:{versionLoader?:()=>Promise<string>}){
  const [version,setVersion]=useState("0.1.0"),year=new Date().getFullYear();
  useEffect(()=>{let active=true;versionLoader().then(value=>{if(active)setVersion(value)}).catch(()=>undefined);return()=>{active=false}},[versionLoader]);
  return <footer className="app-footer no-print">
    <div><strong>© {year} Dimensione 4 di Dario Marco Bellini</strong><span>Software sviluppato da Dario Marco Bellini · v{version}</span></div>
    <nav aria-label="Contatti sviluppatore">
      <a href="mailto:dariomarcobellini@dimensione4.it">dariomarcobellini@dimensione4.it</a>
      <a href="https://wa.me/393334404903" target="_blank" rel="noreferrer">WhatsApp +39 333 4404903</a>
      <a href="https://www.dimensione4.it" target="_blank" rel="noreferrer">www.dimensione4.it</a>
    </nav>
  </footer>;
}

export function intentionCalendarLabel(item:Pick<MassIntention,"remembered_person"|"intention_text">){
  return item.remembered_person?.trim()||item.intention_text?.trim()||"Intenzione senza testo";
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

type IntentionRepository={list:typeof loadIntentions;settings:typeof loadSettings;create:typeof createIntention;createMemo?:typeof createMassMemo;update?:typeof updateIntention;schedules?:typeof loadSchedules};
const defaultRepository:IntentionRepository={list:loadIntentions,settings:loadSettings,create:createIntention,createMemo:createMassMemo,update:updateIntention,schedules:loadSchedules};

export function Calendar({repository=defaultRepository}:{repository?:IntentionRepository}){
  const [month,setMonth]=useState(new Date()),[view,setView]=useState<"calendar"|"list">("calendar"),[printOpen,setPrintOpen]=useState(false),[memoOpen,setMemoOpen]=useState(false),[selectedDay,setSelectedDay]=useState<string|null>(null),[addRequest,setAddRequest]=useState<{date:string;time?:string}|null>(null),[editing,setEditing]=useState<MassIntention|null>(null),[intentions,setIntentions]=useState<MassIntention[]>([]),[schedules,setSchedules]=useState<MassScheduleRule[]>([]),[notice,setNotice]=useState(""),[loadError,setLoadError]=useState("");
  const days=useMemo(()=>eachDayOfInterval({start:startOfMonth(month),end:endOfMonth(month)}),[month]);
  const blanks=(getDay(startOfMonth(month))+6)%7;
  const refresh=()=>repository.list(format(startOfMonth(month),"yyyy-MM-dd"),format(endOfMonth(month),"yyyy-MM-dd")).then(items=>{setIntentions(items);setLoadError("")}).catch(e=>setLoadError(`Impossibile leggere il calendario: ${String(e)}`));
  useEffect(()=>{refresh()},[month]);
  useEffect(()=>{repository.schedules?.().then(setSchedules)},[repository]);
  if(selectedDay)return <DayDetail date={selectedDay} items={intentions.filter(i=>i.mass_date===selectedDay)} schedules={schedules} settingsRepository={repository.settings} back={()=>setSelectedDay(null)} add={time=>setAddRequest({date:selectedDay,time})} edit={setEditing} changed={refresh}
    dialogs={<>{addRequest&&<IntentionDialog initialDate={addRequest.date} initialTime={addRequest.time} repository={repository} close={()=>setAddRequest(null)} saved={record=>{setAddRequest(null);setNotice(`Intenzione salvata. Ricevuta n. ${record.receipt_number}.`);refresh()}}/>}{editing&&<IntentionDialog initialDate={editing.mass_date} initialRecord={editing} repository={repository} close={()=>setEditing(null)} saved={()=>{setEditing(null);setNotice("Intenzione modificata.");refresh()}}/>}</>}/>;
  return <section><header><div><p className="eyebrow">Schermata principale</p><h1>Agenda delle messe</h1></div><div className="header-actions"><button className="secondary-button" onClick={()=>setPrintOpen(true)}><Printer/> Stampa elenco</button><button className="secondary-button" onClick={()=>setMemoOpen(true)}><BookOpen/> Nuovo promemoria</button><button className="primary" onClick={()=>setAddRequest({date:format(new Date(),"yyyy-MM-dd")})}>+ Aggiungi intenzione</button></div></header>
    <div className="calendar-toolbar"><div className="view-switch" aria-label="Tipo di vista"><button className={view==="calendar"?"active":""} onClick={()=>setView("calendar")}><Grid3X3/> Calendario</button><button className={view==="list"?"active":""} onClick={()=>setView("list")}><List/> Elenco mensile</button></div></div>
    {loadError&&<p className="error" role="alert">{loadError}</p>}<div className="card"><div className="month"><button className="month-prev" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1))}>← Mese precedente</button>
    <h2>{format(month,"MMMM yyyy",{locale:it})}</h2><button className="month-next" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1))}>Mese successivo →</button></div>
    {view==="calendar"?<><div className="week">{["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map(x=><strong key={x}>{x}</strong>)}</div><div className="grid">
    {Array.from({length:blanks},(_,i)=><span key={i}/>)}{days.map(day=>{const key=format(day,"yyyy-MM-dd"),items=intentions.filter(i=>i.mass_date===key),times=schedules.filter(s=>s.weekday===day.getDay()).map(s=>s.time),celebration=getCelebrationOfDay(key);return <button key={key} onClick={()=>setSelectedDay(key)} className={key===format(new Date(),"yyyy-MM-dd")?"today":""}>
    <b>{format(day,"d")}</b>{celebration&&<em className="calendar-saint">{celebration}</em>}<span className="day-lines">{items.map(i=><small key={i.id} className="filled"><strong>{i.mass_time}</strong> <span>{intentionCalendarLabel(i)}</span></small>)}{items.length===0&&times.map(time=><small key={time} className="empty"><strong>{time}</strong> <span>0 intenzioni</span></small>)}{items.length===0&&times.length===0&&<small className="empty">Nessuna messa</small>}</span></button>})}</div></>:<MonthlyList days={days} intentions={intentions} schedules={schedules} openDay={setSelectedDay}/>}</div>
    {notice&&<p className="toast" role="status">{notice}</p>}
    {addRequest&&<IntentionDialog initialDate={addRequest.date} repository={repository} close={()=>setAddRequest(null)} saved={record=>{setAddRequest(null);setIntentions(items=>[...items,record].sort((a,b)=>(a.mass_date+a.mass_time).localeCompare(b.mass_date+b.mass_time)));setNotice(`Intenzione salvata. Ricevuta n. ${record.receipt_number}.`);}}/>}
    {memoOpen&&<MassMemoDialog repository={repository} close={()=>setMemoOpen(false)} saved={memo=>{setMemoOpen(false);setNotice(`Promemoria salvato: ${memo.items.length} intenzioni inserite nel calendario.`);refresh()}}/>}
    {printOpen&&<PrintIntentionsDialog month={month} repository={repository} close={()=>setPrintOpen(false)}/>}
  </section>;
}

type MemoRow={mass_date:string;mass_time:string;remembered_person:string;intention_text:string;internal_notes:string};
const emptyMemoRow=():MemoRow=>({mass_date:"",mass_time:"18:00",remembered_person:"",intention_text:"",internal_notes:""});

function MassMemoDialog({repository,close,saved,initialMemo}:{repository:IntentionRepository;close:()=>void;saved:(memo:MassMemo)=>void;initialMemo?:MassMemo}){
  const [offererFirst,setOffererFirst]=useState(initialMemo?.offerer_first_name??""),[offererLast,setOffererLast]=useState(initialMemo?.offerer_last_name??""),[offererPhone,setOffererPhone]=useState(initialMemo?.offerer_phone??""),[offering,setOffering]=useState(initialMemo?.offering_cents??1500),[payment,setPayment]=useState(initialMemo?.payment_method??"Contanti");
  const [hasOffering,setHasOffering]=useState(!initialMemo||initialMemo.offering_cents>0),[rows,setRows]=useState<MemoRow[]>(initialMemo?initialMemo.items.map(item=>({mass_date:item.mass_date,mass_time:item.mass_time,remembered_person:item.remembered_person,intention_text:item.intention_text,internal_notes:item.internal_notes})):[{...emptyMemoRow()},{...emptyMemoRow()},{...emptyMemoRow()}]),[maximum,setMaximum]=useState(3),[saving,setSaving]=useState(false),[error,setError]=useState(""),[created,setCreated]=useState<MassMemo|null>(null);
  useEffect(()=>{repository.settings().then(settings=>{setMaximum(settings.max_intentions_per_mass);if(!initialMemo)setOffering(settings.default_offering_cents)})},[repository,initialMemo]);
  const updateRow=(index:number,key:keyof MemoRow,value:string)=>setRows(current=>current.map((row,i)=>i===index?{...row,[key]:value}:row));
  const removeRow=(index:number)=>setRows(current=>current.filter((_,i)=>i!==index));
  async function submit(e:React.FormEvent){
    e.preventDefault();setError("");
    const filled=rows.filter(row=>row.mass_date&&row.mass_time&&(row.remembered_person.trim()||row.intention_text.trim()));
    if(!offererFirst.trim()&&!offererLast.trim())return setError("Indica almeno nome o cognome dell'offerente.");
    if(filled.length===0)return setError("Aggiungi almeno una messa con data, ora e persona ricordata o intenzione.");
    setSaving(true);
    try{
      const values=filled.map(row=>({
          mass_date:row.mass_date,
          mass_time:row.mass_time,
          offerer_first_name:offererFirst,
          offerer_last_name:offererLast,
          offerer_phone:offererPhone,
          remembered_person:row.remembered_person,
          intention_text:row.intention_text||`A ricordo di ${row.remembered_person}`,
          offering_cents:hasOffering?offering:0,
          payment_method:payment,
          internal_notes:row.internal_notes,
        }));
      setCreated(initialMemo?await updateMassMemo(initialMemo,values,maximum):await (repository.createMemo??createMassMemo)(values,maximum));
    }catch(e){setError(typeof e==="string"?e:e instanceof Error?e.message:"Salvataggio del promemoria non riuscito.")}
    finally{setSaving(false)}
  }
  if(created)return <MassMemoPreview memo={created} close={()=>saved(created)}/>;
  return <div className="modal-backdrop"><div className="dialog memo-dialog" role="dialog" aria-modal="true" aria-labelledby="memo-title">
    <div className="dialog-head"><div><p className="eyebrow">Inserimento multiplo</p><h2 id="memo-title">{initialMemo?"Modifica promemoria":"Nuovo promemoria celebrazione S. Messa"}</h2></div><button type="button" onClick={close}>Chiudi ×</button></div>
    <form onSubmit={submit}><p className="page-subtitle">Ogni riga verrà salvata come intenzione reale nella data corretta del calendario.</p><div className="form-grid">
      <label>Nome offerente<input value={offererFirst} onChange={e=>setOffererFirst(e.target.value)}/></label><label>Cognome offerente<input value={offererLast} onChange={e=>setOffererLast(e.target.value)}/></label>
      <label>Telefono (facoltativo)<input value={offererPhone} onChange={e=>setOffererPhone(e.target.value)}/></label><label>Pagamento<select value={payment} onChange={e=>setPayment(e.target.value)}><option>Contanti</option><option>Bonifico</option><option>Altro</option></select></label>
      <label className="check-field wide"><input type="checkbox" checked={hasOffering} onChange={e=>setHasOffering(e.target.checked)}/> Registra quota/offerta per queste messe</label>
      {hasOffering&&<label>Quota/offerta per messa (€)<input required type="number" min="0" step=".01" value={offering/100} onChange={e=>setOffering(Math.round(+e.target.value*100))}/></label>}
    </div><div className="memo-rows"><div className="memo-rows-head"><span>Giorno</span><span>Ora</span><span>A ricordo di</span><span>Note</span><span/></div>{rows.map((row,index)=><div className="memo-row" key={index}>
      <input aria-label={`Giorno riga ${index+1}`} type="date" value={row.mass_date} onChange={e=>updateRow(index,"mass_date",e.target.value)}/>
      <input aria-label={`Ora riga ${index+1}`} type="time" value={row.mass_time} onChange={e=>updateRow(index,"mass_time",e.target.value)}/>
      <input aria-label={`A ricordo di riga ${index+1}`} value={row.remembered_person} onChange={e=>updateRow(index,"remembered_person",e.target.value)} placeholder="Nome persona / famiglia"/>
      <input aria-label={`Note riga ${index+1}`} value={row.internal_notes} onChange={e=>updateRow(index,"internal_notes",e.target.value)} placeholder="Note facoltative"/>
      <button type="button" className="memo-remove-button" aria-label={`Rimuovi riga ${index+1}`} title="Rimuovi riga" disabled={rows.length===1} onClick={()=>removeRow(index)}><Trash2/></button>
      <textarea aria-label={`Testo intenzione riga ${index+1}`} value={row.intention_text} onChange={e=>updateRow(index,"intention_text",e.target.value)} placeholder="Testo intenzione facoltativo, es. Per i defunti della famiglia" />
    </div>)}</div>
    <button type="button" className="secondary-button" onClick={()=>setRows(current=>[...current,emptyMemoRow()])}><Plus/> Aggiungi riga</button>
    {error&&<p className="error" role="alert">{error}</p>}<div className="actions memo-actions"><button type="button" onClick={close}>Annulla</button><button className="primary" disabled={saving}><Save/> {saving?"Salvataggio…":"Salva promemoria e inserisci nel calendario"}</button></div></form>
  </div></div>;
}

export function memoPrintTitle(records:Pick<MassIntention,"mass_date">[],offerer:string){
  const firstDate=records.map(row=>row.mass_date).sort()[0]??format(new Date(),"yyyy-MM-dd");
  return `Promemoria messe - ${offerer||"offerente"} - ${firstDate}`.replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ").trim();
}

function MassMemoPreview({memo,close}:{memo:MassMemo;close:()=>void}){
  const records=memo.items,offerer=`${memo.offerer_first_name} ${memo.offerer_last_name}`.trim(),phone=memo.offerer_phone;
  const [printFormat,setPrintFormat]=useState<PrintFormat>("a4"),[showOffering,setShowOffering]=useState(memo.offering_cents>0);
  function printMemo(){
    const previousTitle=document.title;
    document.title=memoPrintTitle(records,offerer);
    const restoreTitle=()=>{document.title=previousTitle;window.removeEventListener("afterprint",restoreTitle)};
    window.addEventListener("afterprint",restoreTitle);
    requestAnimationFrame(()=>{window.print();setTimeout(restoreTitle,1000)});
  }
  return <div className="modal-backdrop"><div className="dialog memo-dialog memo-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="memo-preview-title">
    <style data-memo-page-size>{`@media print { @page { size: ${printFormat==="a4"?"A4 landscape":"80mm 200mm"}; margin: ${printFormat==="a4"?"12mm":"3mm"}; } }`}</style>
    <div className="dialog-head no-print"><div><p className="eyebrow">Documento</p><h2 id="memo-preview-title">Promemoria pronto</h2></div></div>
    <div className="print-options memo-print-options no-print"><fieldset><legend>Formato stampa</legend><label><input type="radio" checked={printFormat==="a4"} onChange={()=>setPrintFormat("a4")}/> Foglio A4</label><label><input type="radio" checked={printFormat==="thermal"} onChange={()=>setPrintFormat("thermal")}/> Stampantina 80 mm</label></fieldset><label className="check-field"><input type="checkbox" checked={showOffering} onChange={e=>setShowOffering(e.target.checked)}/> Mostra quota/offerta</label></div>
    <div className={`memo-print ${printFormat}`}><header><Church/><div><span>Pro-memoria Celebrazione S. Messa</span><strong>{offerer}</strong>{phone&&<small>{phone}</small>}</div></header><table><thead><tr><th>Giorno</th><th>Ora</th><th>A ricordo di…</th><th>Note</th>{showOffering&&<th>Quota</th>}</tr></thead><tbody>{records.map(record=><tr key={record.id}><td>{new Date(`${record.mass_date}T12:00:00`).toLocaleDateString("it-IT")}</td><td>{record.mass_time}</td><td>{record.remembered_person||record.intention_text}</td><td>{record.internal_notes}</td>{showOffering&&<td>€ {(record.offering_cents/100).toFixed(2)}</td>}</tr>)}</tbody></table></div>
    <div className="actions memo-actions no-print"><button className="secondary-button" onClick={close}>Chiudi</button><button className="primary" onClick={printMemo}><Printer/> Stampa promemoria</button></div></div></div>;
}

type MemoRepository={list:typeof loadMassMemos;remove:typeof deleteMassMemo};
const defaultMemoRepository:MemoRepository={list:loadMassMemos,remove:deleteMassMemo};

export function Memos({repository=defaultMemoRepository,intentionRepository=defaultRepository}:{repository?:MemoRepository;intentionRepository?:IntentionRepository}){
  const [memos,setMemos]=useState<MassMemo[]>([]),[preview,setPreview]=useState<MassMemo|null>(null),[editing,setEditing]=useState<MassMemo|null>(null),[deleting,setDeleting]=useState<MassMemo|null>(null),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const refresh=()=>repository.list().then(items=>{setMemos(items);setError("")}).catch(e=>setError(`Impossibile leggere i promemoria: ${String(e)}`));
  useEffect(()=>{refresh()},[]);
  const dateRange=(memo:MassMemo)=>{
    const dates=memo.items.map(item=>item.mass_date).sort();
    if(dates.length===0)return "Nessuna data collegata";
    const first=new Date(`${dates[0]}T12:00:00`).toLocaleDateString("it-IT");
    const last=new Date(`${dates[dates.length-1]}T12:00:00`).toLocaleDateString("it-IT");
    return first===last?first:`dal ${first} al ${last}`;
  };
  return <section><header><div><p className="eyebrow">Documenti</p><h1>Storico promemoria</h1><p className="page-subtitle">Promemoria già creati, pronti da ristampare, modificare o rimuovere in blocco.</p></div></header>
    {notice&&<p className="toast" role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
    <div className="memo-history card">{memos.length===0?<div className="empty-state"><h2>Nessun promemoria salvato</h2><p>Dal calendario puoi creare un “Nuovo promemoria”: verrà salvato qui e le sue righe entreranno anche nei giorni corretti del calendario.</p></div>:memos.map(memo=>{const offerer=`${memo.offerer_first_name} ${memo.offerer_last_name}`.trim()||"Offerente non indicato";return <article key={memo.id} className="memo-card">
      <div className="memo-card-summary"><span className="memo-card-kicker">Promemoria n. {memo.id}</span><h2>{offerer}</h2><p>{memo.items.length} {memo.items.length===1?"messa collegata":"messe collegate"} · {dateRange(memo)}</p>{memo.offerer_phone&&<small>Telefono: {memo.offerer_phone}</small>}</div>
      <div className="memo-card-items">{memo.items.map(item=><div key={item.id}><strong>{new Date(`${item.mass_date}T12:00:00`).toLocaleDateString("it-IT")} · {item.mass_time}</strong><span>{item.remembered_person||item.intention_text||"Intenzione senza testo"}</span>{item.internal_notes&&<em>{item.internal_notes}</em>}</div>)}</div>
      <div className="memo-card-actions"><button className="preview-action" onClick={()=>setPreview(memo)}><Printer/> Stampa</button><button className="secondary-button" onClick={()=>setEditing(memo)}><Pencil/> Modifica</button><button className="delete-action" onClick={()=>setDeleting(memo)}><Trash2/> Elimina tutto</button></div>
    </article>})}</div>
    {preview&&<MassMemoPreview memo={preview} close={()=>setPreview(null)}/>}
    {editing&&<MassMemoDialog initialMemo={editing} repository={intentionRepository} close={()=>setEditing(null)} saved={async memo=>{setEditing(null);setNotice(`Promemoria aggiornato: ${memo.items.length} intenzioni collegate al calendario.`);await refresh()}}/>}
    {deleting&&<ReasonDialog title="Eliminare questo promemoria?" body="Il promemoria verrà tolto dallo storico operativo e tutte le intenzioni collegate verranno eliminate dal calendario in un colpo solo." label="Motivo dell’eliminazione" confirmLabel="Elimina promemoria" close={()=>setDeleting(null)} confirmed={async reason=>{await repository.remove(deleting.id,reason);setDeleting(null);setNotice("Promemoria eliminato insieme alle intenzioni collegate.");await refresh()}}/>}
  </section>;
}

function MonthlyList({days,intentions,schedules,openDay}:{days:Date[];intentions:MassIntention[];schedules:MassScheduleRule[];openDay:(date:string)=>void}){
  const rows=days.flatMap(day=>{const date=format(day,"yyyy-MM-dd"),items=intentions.filter(i=>i.mass_date===date);if(items.length)return items.map(item=>({date,day,time:item.mass_time,text:intentionCalendarLabel(item),count:items.length,filled:true}));return schedules.filter(s=>s.weekday===day.getDay()).map(s=>({date,day,time:s.time,text:"Nessuna intenzione",count:0,filled:false}))});
  return <div className="monthly-list"><div className="monthly-list-head"><span>Giorno</span><span>Ora</span><span>Intenzione</span><span>Stato</span></div>{rows.length===0?<p className="empty-state">Nessuna messa o intenzione nel mese selezionato.</p>:rows.map((row,index)=><button key={`${row.date}-${row.time}-${index}`} className={row.filled?"has-intention":"is-empty"} onClick={()=>openDay(row.date)}><span><strong>{format(row.day,"d")}</strong> {format(row.day,"EEEE",{locale:it})}</span><span>{row.time}</span><span>{row.filled?<strong>{row.text}</strong>:row.text}</span><span>{row.count>0?"Registrata":"Disponibile"}</span></button>)}</div>;
}

function PrintIntentionsDialog({month,repository,close}:{month:Date;repository:IntentionRepository;close:()=>void}){
  const monthStart=format(startOfMonth(month),"yyyy-MM-dd"),monthEnd=format(endOfMonth(month),"yyyy-MM-dd");
  const [period,setPeriod]=useState<"day"|"week"|"month"|"range">("week"),[from,setFrom]=useState(monthStart),[to,setTo]=useState(monthEnd),[weekDay,setWeekDay]=useState(format(month,"yyyy-MM-dd")),[offerings,setOfferings]=useState(false),[printFormat,setPrintFormat]=useState<PrintFormat>("a4"),[items,setItems]=useState<MassIntention[]>([]),[printing,setPrinting]=useState(false),[error,setError]=useState("");
  const bounds=()=>period==="day"?[from,from]:period==="week"?[format(startOfWeek(new Date(`${weekDay}T12:00:00`),{weekStartsOn:1}),"yyyy-MM-dd"),format(endOfWeek(new Date(`${weekDay}T12:00:00`),{weekStartsOn:1}),"yyyy-MM-dd")]:period==="month"?[monthStart,monthEnd]:[from,to];
  async function print(){setError("");const [start,end]=bounds();if(start>end)return setError("La data iniziale deve precedere quella finale.");setPrinting(true);try{setItems(await repository.list(start,end));setTimeout(()=>window.print(),50)}catch(e){setError(String(e))}finally{setPrinting(false)}}
  return <div className="modal-backdrop"><div className="dialog print-dialog" role="dialog" aria-modal="true" aria-labelledby="print-title">
    <style data-report-page-size>{`@media print { @page { size: ${printFormat==="a4"?"A4 portrait":"80mm 200mm"}; margin: ${printFormat==="a4"?"12mm":"3mm"}; } }`}</style>
    <div className="dialog-head no-print"><div><p className="eyebrow">Stampa</p><h2 id="print-title">Stampa elenco intenzioni</h2></div><button onClick={close}>Chiudi ×</button></div>
    <div className="print-options no-print"><fieldset><legend>Periodo da stampare</legend><label><input type="radio" checked={period==="day"} onChange={()=>setPeriod("day")}/> Un giorno</label><label><input type="radio" checked={period==="week"} onChange={()=>setPeriod("week")}/> Settimana</label><label><input type="radio" checked={period==="month"} onChange={()=>setPeriod("month")}/> Tutto il mese</label><label><input type="radio" checked={period==="range"} onChange={()=>setPeriod("range")}/> Intervallo personalizzato</label></fieldset>
    {period==="week"&&<div className="print-dates"><label>Settimana del giorno<input type="date" value={weekDay} onChange={e=>setWeekDay(e.target.value)}/></label></div>}
    {period!=="month"&&period!=="week"&&<div className="print-dates"><label>Dal giorno<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>{period==="range"&&<label>Al giorno<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>}</div>}
    <fieldset><legend>Formato stampa</legend><label><input type="radio" checked={printFormat==="a4"} onChange={()=>setPrintFormat("a4")}/> Foglio A4</label><label><input type="radio" checked={printFormat==="thermal"} onChange={()=>setPrintFormat("thermal")}/> Stampantina 80 mm</label></fieldset>
    <label className="check-field"><input type="checkbox" checked={offerings} onChange={e=>setOfferings(e.target.checked)}/> Includi importi delle offerte</label>{error&&<p className="error">{error}</p>}</div>
    <PrintIntentionsReport items={items} from={bounds()[0]} to={bounds()[1]} offerings={offerings} printFormat={printFormat}/>
    <div className="actions no-print"><button className="primary" disabled={printing} onClick={print}><Printer/> {printing?"Preparazione…":"Stampa elenco"}</button></div></div></div>;
}

function PrintIntentionsReport({items,from,to,offerings,printFormat}:{items:MassIntention[];from:string;to:string;offerings:boolean;printFormat:PrintFormat}){
  return <div className={`print-report ${printFormat}`}><h1>Elenco intenzioni delle messe</h1><p>Periodo: {from===to?from:`dal ${from} al ${to}`}</p>{printFormat==="thermal"?<div className="thermal-list">{items.map(item=><article key={item.id}><strong>{new Date(`${item.mass_date}T12:00:00`).toLocaleDateString("it-IT")} · {item.mass_time}</strong><span>{item.remembered_person||item.intention_text}</span>{item.internal_notes&&<small>{item.internal_notes}</small>}{offerings&&<b>€ {(item.offering_cents/100).toFixed(2)}</b>}</article>)}</div>:<table><thead><tr><th>Giorno</th><th>Ora</th><th>Persona ricordata</th><th>Intenzione</th>{offerings&&<th>Offerta</th>}</tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.mass_date}</td><td>{item.mass_time}</td><td>{item.remembered_person}</td><td>{item.intention_text}</td>{offerings&&<td>€ {(item.offering_cents/100).toFixed(2)}</td>}</tr>)}</tbody></table>}{items.length===0&&<p>Nessuna intenzione nel periodo selezionato.</p>}</div>;
}

function DayDetail({date,items,schedules,settingsRepository,back,add,edit,changed,dialogs}:{date:string;items:MassIntention[];schedules:MassScheduleRule[];settingsRepository:typeof loadSettings;back:()=>void;add:(time:string)=>void;edit:(item:MassIntention)=>void;changed:()=>void;dialogs:ReactNode}){
  const [maximum,setMaximum]=useState(3),[deleting,setDeleting]=useState<MassIntention|null>(null);
  useEffect(()=>{settingsRepository().then(s=>setMaximum(s.max_intentions_per_mass))},[settingsRepository]);
  const day=new Date(`${date}T12:00:00`),configured=schedules.filter(s=>s.weekday===day.getDay()).map(s=>s.time);
  const times=Array.from(new Set([...configured,...items.map(i=>i.mass_time)])).sort();
  const celebration=getCelebrationOfDay(date);
  return <section className="day-detail"><header><div><button className="back-button" onClick={back}><ArrowLeft/> Torna al calendario</button><h1>{format(day,"EEEE d MMMM yyyy",{locale:it})}</h1><p className="page-subtitle">{items.length} {items.length===1?"intenzione registrata":"intenzioni registrate"}</p></div><button className="primary" onClick={()=>add(configured[0]??"18:00")}>+ Aggiungi intenzione</button></header>
    {celebration&&<div className="saint-banner"><Church/><div><span>Memoria liturgica del giorno</span><strong>{celebration}</strong></div></div>}
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
    </div>{error&&<p className="error" role="alert">{error}</p>}<div className="actions"><button className="primary" disabled={saving}>{saving?"Salvataggio…":initialRecord?"Salva modifiche":"Salva intenzione"}</button></div></form>
  </div></div>;
}

type ArchiveRepository={list:typeof loadArchive;logs:typeof loadAuditLogs;cancel:typeof cancelReceipt;remove:typeof deleteIntention;restore:typeof restoreIntention;exporter?:(content:string)=>Promise<string>};
const defaultArchiveRepository:ArchiveRepository={list:loadArchive,logs:loadAuditLogs,cancel:cancelReceipt,remove:deleteIntention,restore:restoreIntention,exporter:(content)=>invoke<string>("export_archive_csv",{content})};

export function Archive({settings,repository=defaultArchiveRepository,configureReceipt}:{settings:ParishSettings|null;repository?:ArchiveRepository;configureReceipt?:()=>void}){
  const [items,setItems]=useState<MassIntention[]>([]),[logs,setLogs]=useState<AuditLog[]>([]),[view,setView]=useState<"records"|"trash"|"history">("records"),[query,setQuery]=useState(""),[sort,setSort]=useState<"receipt"|"date-desc"|"date-asc"|"remembered">("receipt"),[from,setFrom]=useState(""),[to,setTo]=useState(""),[exportMessage,setExportMessage]=useState(""),[receipt,setReceipt]=useState<MassIntention|null>(null),[restoring,setRestoring]=useState<MassIntention|null>(null),[cancelling,setCancelling]=useState<MassIntention|null>(null),[deleting,setDeleting]=useState<MassIntention|null>(null),[error,setError]=useState("");
  const refresh=()=>repository.list().then(setItems).catch(e=>setError(String(e)));
  useEffect(()=>{refresh();repository.logs().then(setLogs)},[]);
  const normalized=query.toLowerCase().trim();
  const visible=items.filter(i=>(view==="trash"?i.status==="deleted":i.status!=="deleted"))
    .filter(i=>(!from||i.mass_date>=from)&&(!to||i.mass_date<=to))
    .filter(i=>!normalized||[i.offerer_first_name,i.offerer_last_name,i.intention_text,i.remembered_person,String(i.receipt_number??"")].some(v=>v?.toLowerCase().includes(normalized)))
    .sort((a,b)=>sort==="receipt"?(a.receipt_number??Number.MAX_SAFE_INTEGER)-(b.receipt_number??Number.MAX_SAFE_INTEGER):sort==="date-desc"?(b.mass_date+b.mass_time).localeCompare(a.mass_date+a.mass_time):sort==="date-asc"?(a.mass_date+a.mass_time).localeCompare(b.mass_date+b.mass_time):(a.remembered_person||"zzz").localeCompare(b.remembered_person||"zzz","it"));
  async function exportCsv(){
    const rows=[["Ricevuta","Data","Ora","Offerente","Persona ricordata","Intenzione","Offerta","Stato"],...visible.map(i=>[i.receipt_number??"",i.mass_date,i.mass_time,`${i.offerer_first_name} ${i.offerer_last_name}`.trim(),i.remembered_person,i.intention_text,(i.offering_cents/100).toFixed(2),i.status==="deleted"?"eliminata":i.receipt_status??"valid"])];
    const csv=rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(";")).join("\r\n");
    try{const path=await (repository.exporter??defaultArchiveRepository.exporter!)(csv);setExportMessage(`File creato per Excel: ${path}`)}catch(e){setExportMessage(`Errore durante l’esportazione: ${String(e)}`)}
  }
  return <section><header><div><p className="eyebrow">Consultazione</p><h1>Archivio e storico</h1></div>{view!=="history"&&<button className="primary" onClick={exportCsv}><Download/> Esporta per Excel</button>}</header>
    <div className="section-tabs"><button className={view==="records"?"active":""} onClick={()=>setView("records")}><ArchiveIcon/> Intenzioni</button><button className={view==="trash"?"active":""} onClick={()=>setView("trash")}><Trash2/> Cestino</button><button className={view==="history"?"active":""} onClick={()=>setView("history")}><History/> Storico modifiche</button></div>
    {view!=="history"?<div className="card"><div className="archive-filters"><label className="archive-search">Cerca<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, persona ricordata, testo o ricevuta"/></label><label>Ordina per<select value={sort} onChange={e=>setSort(e.target.value as typeof sort)}><option value="receipt">Numero ricevuta crescente</option><option value="date-desc">Data più recente</option><option value="date-asc">Data meno recente</option><option value="remembered">Persona ricordata A-Z</option></select></label><label>Dal giorno<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Al giorno<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
    {exportMessage&&<p className={exportMessage.startsWith("Errore")?"error":"success"} role="status">{exportMessage}</p>}
    {error&&<p className="error">{error}</p>}<div className="archive-list">{visible.length===0?<p>Nessun risultato.</p>:visible.map(item=><article key={item.id} className={item.status==="deleted"?"record-deleted":""}>
      <div><strong>{item.mass_date} · ore {item.mass_time}</strong>{item.remembered_person&&<span className="remembered-person">In memoria di {item.remembered_person}</span>}<p>{item.intention_text}</p><small>{`${item.offerer_first_name} ${item.offerer_last_name}`.trim()||"Offerente non indicato"} · € {(item.offering_cents/100).toFixed(2)}</small></div>
      <div className="receipt-actions"><span className={item.status==="deleted"||item.receipt_status==="cancelled"?"cancelled":""}>{item.status==="deleted"?"Eliminata":item.receipt_number==null?"Senza ricevuta":"Ricevuta n. "+item.receipt_number+(item.receipt_status==="cancelled"?" · annullata":"")}</span>{item.status==="deleted"?<button className="restore-action" onClick={()=>setRestoring(item)}><RotateCcw/> Ripristina intenzione</button>:item.receipt_number==null?<button className="delete-action" onClick={()=>setDeleting(item)}><Trash2/> Elimina intenzione</button>:<><button className="preview-action" onClick={()=>setReceipt(item)}><Printer/> Anteprima e stampa</button>{item.receipt_status!=="cancelled"&&<button className="cancel-action" onClick={()=>setCancelling(item)}>Annulla ricevuta</button>}</>}</div>
    </article>)}</div></div>
    :<div className="history-list">{logs.length===0?<p className="empty-state">Nessuna modifica registrata.</p>:logs.map(log=><article key={log.id}><span className={`history-action ${log.action}`}>{historyActionLabel(log.action)}</span><div><AuditDetails log={log}/><small>{new Date(log.created_at.replace(" ","T")+"Z").toLocaleString("it-IT")}</small></div></article>)}</div>}
    {receipt&&<ReceiptPreview item={receipt} settings={settings} close={()=>setReceipt(null)} configure={configureReceipt}/>}
    {restoring&&<ConfirmDialog title="Ripristinare questa intenzione?" body="Tornerà attiva nella giornata e nella fascia oraria originali, se c’è ancora disponibilità." confirmLabel="Ripristina intenzione" close={()=>setRestoring(null)} confirmed={async()=>{await repository.restore(restoring.id);setRestoring(null);await refresh();setLogs(await repository.logs())}}/>}
    {cancelling&&<ReasonDialog title="Annullare questa ricevuta?" body={`La ricevuta n. ${cancelling.receipt_number} resterà nello storico come annullata.`} label="Motivo dell’annullamento" confirmLabel="Annulla ricevuta" close={()=>setCancelling(null)} confirmed={async reason=>{await repository.cancel(cancelling.id,reason);setCancelling(null);await refresh();setLogs(await repository.logs())}}/>}
    {deleting&&<ReasonDialog title="Eliminare questa intenzione?" body="L’intenzione resterà nello storico e potrà essere ripristinata. Non esiste una ricevuta associata da annullare." label="Motivo dell’eliminazione" confirmLabel="Elimina intenzione" close={()=>setDeleting(null)} confirmed={async reason=>{await repository.remove(deleting.id,reason);setDeleting(null);await refresh();setLogs(await repository.logs())}}/>}
  </section>;
}

function historyActionLabel(action:string){return ({create:"Creazione",update:"Modifica",delete:"Eliminazione",restore:"Ripristino",cancel:"Annullamento"} as Record<string,string>)[action]??action}

function AuditDetails({log}:{log:AuditLog}){
  if(log.action==="update"&&log.details){
    try{
      const details=JSON.parse(log.details) as {before?:Record<string,string|number>;after?:Record<string,string|number>};
      if(details.before&&details.after){
        const labels:Record<string,string>={data:"Data messa",ora:"Orario",offerente:"Offerente",intenzione:"Intenzione",persona:"Persona ricordata",offerta:"Offerta"};
        const formatValue=(key:string,value:string|number)=>key==="offerta"?`€ ${(Number(value)/100).toFixed(2)}`:String(value||"—");
        const changes=Object.keys(details.after).filter(key=>String(details.before?.[key]??"")!==String(details.after?.[key]??""));
        return <><strong>Intenzione modificata</strong><div className="audit-changes">{changes.map(key=><div key={key}><span>{labels[key]??key}</span><del>{formatValue(key,details.before![key])}</del><b aria-hidden="true">→</b><ins>{formatValue(key,details.after![key])}</ins></div>)}</div></>;
      }
    }catch{/* I vecchi eventi restano leggibili nel formato precedente. */}
  }
  return <strong>{log.details||log.entity_type}</strong>;
}

function ConfirmDialog({title,body,confirmLabel,close,confirmed,danger=false}:{title:string;body:string;confirmLabel:string;close:()=>void;confirmed:()=>Promise<void>;danger?:boolean}){
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  return <div className="modal-backdrop"><div className="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{title}</h2><p>{body}</p>{error&&<p className="error">{error}</p>}<div className="actions"><button onClick={close}>Annulla</button><button disabled={busy} className={danger?"danger-button":"primary"} onClick={async()=>{setBusy(true);try{await confirmed()}catch(e){setError(String(e));setBusy(false)}}}>{busy?"Operazione in corso…":confirmLabel}</button></div></div></div>;
}

function ReasonDialog({title,body,label,confirmLabel,close,confirmed}:{title:string;body:string;label:string;confirmLabel:string;close:()=>void;confirmed:(reason:string)=>Promise<void>}){
  const [reason,setReason]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  return <div className="modal-backdrop"><div className="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reason-title"><h2 id="reason-title">{title}</h2><p>{body}</p><label>{label}<input required autoFocus value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p className="error">{error}</p>}<div className="actions"><button onClick={close}>Annulla</button><button disabled={busy} className="danger-button" onClick={async()=>{if(!reason.trim())return setError("Il motivo è obbligatorio.");setBusy(true);try{await confirmed(reason)}catch(e){setError(String(e));setBusy(false)}}}>{busy?"Operazione in corso…":confirmLabel}</button></div></div></div>;
}

export function receiptPageHeightMm(pixelHeight:number){
  return Math.max(80,Math.ceil(pixelHeight*25.4/96)+4);
}

export function receiptPaperDimensions(settings:ParishSettings|null,pixelHeight:number){
  const customWidth=settings?.receipt_custom_width_mm&&settings.receipt_custom_width_mm>0?settings.receipt_custom_width_mm:null;
  const customHeight=settings?.receipt_custom_height_mm&&settings.receipt_custom_height_mm>0?settings.receipt_custom_height_mm:null;
  return {
    width: customWidth??(settings?.receipt_paper_size==="80mm"?80:58),
    height: customHeight??receiptPageHeightMm(pixelHeight),
    custom: Boolean(customWidth||customHeight),
  };
}

export function receiptPrintTitle(item:MassIntention,settings:ParishSettings|null){
  const receiptNumber=item.receipt_number??"senza-numero";
  const offerer=`${item.offerer_first_name} ${item.offerer_last_name}`.trim()||item.remembered_person||"offerente";
  const parish=settings?.parish_name||"parrocchia";
  return `Ricevuta n ${receiptNumber} - ${offerer} - ${item.mass_date} - ${parish}`.replace(/[\\/:*?"<>|]+/g," ").replace(/\s+/g," ").trim();
}

function ReceiptPreview({item,settings,close,configure}:{item:MassIntention;settings:ParishSettings|null;close:()=>void;configure?:()=>void}){
  const receiptRef=useRef<HTMLDivElement>(null);
  const [paper,setPaper]=useState(()=>receiptPaperDimensions(settings,0));
  useEffect(()=>setPaper(receiptPaperDimensions(settings,receiptRef.current?.scrollHeight??0)),[settings]);
  function printReceipt(){
    const previousTitle=document.title;
    document.title=receiptPrintTitle(item,settings);
    const restoreTitle=()=>{document.title=previousTitle;window.removeEventListener("afterprint",restoreTitle)};
    window.addEventListener("afterprint",restoreTitle);
    setPaper(receiptPaperDimensions(settings,receiptRef.current?.scrollHeight??0));
    requestAnimationFrame(()=>{window.print();setTimeout(restoreTitle,1000)});
  }
  return <div className="modal-backdrop"><div className="dialog receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
    <style data-receipt-page-size>{`@media print { @page { size: ${paper.width}mm ${paper.height}mm; margin: 0; } }`}</style>
    <div className="dialog-head no-print"><div><p className="eyebrow">Documento termico</p><h2 id="receipt-title">Anteprima ricevuta</h2></div><button className="close-button" onClick={close}><X/> Chiudi anteprima</button></div>
    <div ref={receiptRef} className={`receipt ${settings?.receipt_paper_size??"58mm"} ${paper.custom?"custom-label":""}`} style={{width:`${paper.width}mm`}}><section className="receipt-parish"><h2>{settings?.parish_name??"Parrocchia"}</h2>
      {settings?.receipt_show_address!==0&&settings?.address&&<p>{settings.address}</p>}
      {settings?.receipt_show_contacts!==0&&settings?.phone&&<p className="receipt-contact">{settings.phone}</p>}
      {settings?.receipt_show_contacts!==0&&settings?.email&&<p className="receipt-contact">{settings.email}</p>}
      {settings?.receipt_show_priest!==0&&(settings?.priest_first_name||settings?.priest_last_name)&&<p>Parroco: Don {`${settings.priest_first_name} ${settings.priest_last_name}`.trim()}</p>}</section>
      <section className="receipt-number"><span>Ricevuta</span><strong>N. {item.receipt_number}</strong><small>del {new Date(`${item.mass_date}T12:00:00`).toLocaleDateString("it-IT")}</small></section>
      {settings?.receipt_show_offerer!==0&&<section className="receipt-block"><span>Ricevuta da</span><strong>{`${item.offerer_first_name} ${item.offerer_last_name}`.trim()||"Non indicato"}</strong></section>}
      {settings?.receipt_show_intention!==0&&<section className="receipt-block"><span>Intenzione</span><strong>{item.intention_text||item.remembered_person||"Non indicata"}</strong></section>}
      {settings?.receipt_show_mass!==0&&<section className="receipt-row"><span>Santa Messa</span><strong>{item.mass_date}, ore {item.mass_time}</strong></section>}
      {settings?.receipt_show_offering!==0&&<section className="receipt-row"><span>Offerta</span><strong>€ {(item.offering_cents/100).toFixed(2)}</strong></section>}
      {settings?.receipt_custom_message&&<p className="receipt-message">{settings.receipt_custom_message}</p>}</div>
    <div className="receipt-dialog-actions no-print">{configure&&<button className="secondary-button" onClick={()=>{close();configure()}}><Cog/> Configura ricevuta</button>}<button className="primary" onClick={printReceipt}><Printer/> Stampa ricevuta</button></div>
  </div></div>;
}

function Settings({value,changed,initialSection="parish"}:{value:ParishSettings|null;changed:(v:ParishSettings)=>void;initialSection?:SettingsSection}){
  const [form,setForm]=useState(value),[section,setSection]=useState<SettingsSection>(initialSection),[message,setMessage]=useState("");
  useEffect(()=>setSection(initialSection),[initialSection]);
  useEffect(()=>{if(!form)loadSettings().then(v=>{setForm(v);changed(v)})},[form,changed]);
  if(!form)return <p>Caricamento impostazioni…</p>;
  const field=(key:keyof ParishSettings,val:string|number)=>setForm({...form,[key]:val});
  async function submit(e:React.FormEvent){e.preventDefault();await saveSettings(form!);changed(form!);setMessage("Impostazioni salvate correttamente.");}
  const sections=[["parish","Parrocchia",Church],["schedules","Orari delle messe",CalendarDays],["receipt","Configuratore ricevuta",Printer],["appearance","Aspetto e logo",Palette],["user","Utente e sicurezza",Shield],["backup","Backup e ripristino",RotateCcw]] as const;
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
      {section==="receipt"&&<ReceiptSettings form={form} field={field} saved={async()=>{await saveSettings(form);changed(form);setMessage("Configurazione ricevuta salvata.")}} message={message}/>}
      {section==="appearance"&&<AppearanceSettings form={form} field={field} saved={async()=>{await saveSettings(form);changed(form);setMessage("Aspetto aggiornato.")}} message={message}/>}
      {section==="user"&&<PasswordSettings/>}
      {section==="backup"&&<BackupSettings/>}
    </div></div>
  </section>;
}

function ReceiptSettings({form,field,saved,message}:{form:ParishSettings;field:(key:keyof ParishSettings,val:string|number)=>void;saved:()=>Promise<void>;message:string}){
  const choices=[["receipt_show_address","Indirizzo della parrocchia"],["receipt_show_contacts","Telefono ed email"],["receipt_show_priest","Nome del sacerdote"],["receipt_show_offerer","Nome dell’offerente"],["receipt_show_intention","Testo dell’intenzione"],["receipt_show_mass","Data e ora della messa"],["receipt_show_offering","Importo dell’offerta"]] as const;
  return <div><h2>Configuratore ricevuta</h2><p>Scegli quali informazioni stampare. Nome della parrocchia, numero e data della ricevuta restano sempre presenti.</p>
    <fieldset className="receipt-options"><legend>Informazioni da mostrare</legend>{choices.map(([key,label])=><label key={key}><input type="checkbox" checked={form[key]!==0} onChange={e=>field(key,e.target.checked?1:0)}/><span>{label}</span></label>)}</fieldset>
    <div className="form-grid"><label>Formato carta<select value={form.receipt_paper_size} onChange={e=>field("receipt_paper_size",e.target.value)}><option>58mm</option><option>80mm</option></select></label><label>Messaggio finale<input value={form.receipt_custom_message} onChange={e=>field("receipt_custom_message",e.target.value)} placeholder="Per esempio: Grazie"/></label>
      <label>Larghezza personalizzata etichetta (mm)<input type="number" min="0" max="120" value={form.receipt_custom_width_mm??0} onChange={e=>field("receipt_custom_width_mm",+e.target.value)} placeholder="0 = usa 58/80"/></label>
      <label>Altezza personalizzata etichetta (mm)<input type="number" min="0" max="300" value={form.receipt_custom_height_mm??0} onChange={e=>field("receipt_custom_height_mm",+e.target.value)} placeholder="0 = altezza automatica"/></label></div>
    <p className="hint">Per una Brother a etichette adesive prova prima 62 mm di larghezza e 100-120 mm di altezza, poi stampa al 100% senza adattare alla pagina.</p>
    {message&&<p className="success">{message}</p>}<div className="settings-actions"><button className="primary" onClick={saved}><Save/> Salva configurazione ricevuta</button></div>
  </div>;
}

function AppearanceSettings({form,field,saved,message}:{form:ParishSettings;field:(key:keyof ParishSettings,val:string|number)=>void;saved:()=>Promise<void>;message:string}){
  function upload(file?:File){if(!file)return;const reader=new FileReader();reader.onload=()=>field("logo_data_url",String(reader.result));reader.readAsDataURL(file)}
  return <div><h2>Aspetto e logo</h2><p>Personalizza i colori principali e il simbolo mostrato nella barra laterale.</p><div className="appearance-preview" style={{background:form.primary_color}}>{form.logo_data_url?<img src={form.logo_data_url} alt="Anteprima logo"/>:<Church/>}<strong>{form.parish_name}</strong></div>
    <div className="form-grid"><label>Colore principale<input type="color" value={form.primary_color} onChange={e=>field("primary_color",e.target.value)}/></label><label>Colore evidenziazione<input type="color" value={form.accent_color} onChange={e=>field("accent_color",e.target.value)}/></label><label className="wide">Logo della parrocchia<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>upload(e.target.files?.[0])}/></label></div>
    {message&&<p className="success">{message}</p>}<div className="settings-actions">{form.logo_data_url&&<button className="secondary-button" onClick={()=>field("logo_data_url","")}>Rimuovi logo</button>}<button className="primary" onClick={saved}><Save/> Salva aspetto</button></div></div>;
}

function BackupSettings(){
  const [message,setMessage]=useState(""),[restore,setRestore]=useState(false),[backupSettings,setBackupSettings]=useState<ParishSettings|null>(null),[encryptPassphrase,setEncryptPassphrase]=useState("");
  const [driveConnection,setDriveConnection]=useState<GoogleDriveConnection|null>(null),[driveConnecting,setDriveConnecting]=useState(false),[lastDriveUpload,setLastDriveUpload]=useState<GoogleDriveUploadResult|null>(null);
  const googleDriveClientId=import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID?.trim()??"";
  const googleDriveClientSecret=import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET?.trim()??"";
  const googleDriveScope=import.meta.env.VITE_GOOGLE_DRIVE_SCOPE?.trim()||"https://www.googleapis.com/auth/drive.file";
  const googleDriveConfigured=Boolean(googleDriveClientId);
  useEffect(()=>{loadSettings().then(setBackupSettings)},[]);
  useEffect(()=>{invoke<GoogleDriveConnection>("has_google_drive_token").then(setDriveConnection).catch(()=>setDriveConnection(null))},[]);
  async function saveBackupPreferences(){
    if(!backupSettings)return;
    await saveSettings(backupSettings);
    setMessage("Preferenze backup salvate.");
  }
  async function connectGoogleDrive(){
    if(!backupSettings)return;
    setMessage("");
    setLastDriveUpload(null);
    setDriveConnecting(true);
    try{
      await saveSettings(backupSettings);
      const connection=await invoke<GoogleDriveConnection>("connect_google_drive",{clientId:googleDriveClientId,clientSecret:googleDriveClientSecret,scope:googleDriveScope,accountEmail:backupSettings.online_backup_account_email??""});
      setDriveConnection(connection);
      setMessage(connection.message);
    }catch(e){setMessage(`Errore Google Drive: ${String(e)}`)}
    finally{setDriveConnecting(false)}
  }
  async function createEncryptedBackupAndMaybeUpload(){
    if(!backupSettings)return;
    setLastDriveUpload(null);
    try{
      const encryptedPath=await createBackup({encryptPassphrase});
      if((backupSettings.online_backup_enabled??0)===1&&driveConnected){
        const uploaded=await invoke<GoogleDriveUploadResult>("upload_google_drive_backup",{filePath:encryptedPath,clientId:googleDriveClientId,clientSecret:googleDriveClientSecret});
        setLastDriveUpload(uploaded);
        setMessage(`Backup caricato su Google Drive nella cartella ${uploaded.folder_path}.`);
        return;
      }
      setMessage(`Backup cifrato creato in: ${encryptedPath}`);
    }catch(e){setMessage(`Errore: ${String(e)}`)}
  }
  async function openDriveUpload(){
    if(!lastDriveUpload?.web_view_link)return;
    try{await invoke("open_external_url",{url:lastDriveUpload.web_view_link})}
    catch(e){setMessage(`Errore apertura Google Drive: ${String(e)}`)}
  }
  const driveConnected=driveConnection?.connected??false;
  return <div><h2>Backup e ripristino</h2><p>I backup locali vengono salvati automaticamente nella cartella Documenti, divisi per giornata e orario.</p>
    {backupSettings&&<div className="backup-grid"><section className="backup-card"><h3>Backup locale automatico</h3><p>Consigliato: ogni 6 ore. Il gestionale crea cartelle come <code>Backup/2026-07-09/18-00</code>.</p><label>Frequenza<select value={backupSettings.backup_frequency_hours??6} onChange={e=>setBackupSettings({...backupSettings,backup_frequency_hours:Number(e.target.value) as 6|12|24})}><option value={6}>Ogni 6 ore</option><option value={12}>Ogni 12 ore</option><option value={24}>Ogni 24 ore</option></select></label></section>
      <section className="backup-card online-backup-card"><div className="backup-card-title"><h3>Backup online</h3><span className={(backupSettings.online_backup_enabled??0)===1?"status-pill active":"status-pill"}>{(backupSettings.online_backup_enabled??0)===1?"Attivo":"Disattivato"}</span></div><p>Google Drive richiederà autorizzazione OAuth dal browser. I file online devono essere cifrati prima dell'upload.</p>
        <label className="check-field compact-check"><input type="checkbox" checked={(backupSettings.online_backup_enabled??0)===1} onChange={e=>setBackupSettings({...backupSettings,online_backup_enabled:e.target.checked?1:0})}/><span>Voglio preparare il backup online</span></label>
        <label>Email Google Drive<input type="email" value={backupSettings.online_backup_account_email??""} onChange={e=>setBackupSettings({...backupSettings,online_backup_account_email:e.target.value})} placeholder="nome@gmail.com"/></label>
        <label className="check-field compact-check"><input type="checkbox" checked={(backupSettings.online_backup_encryption_enabled??1)!==0} onChange={e=>setBackupSettings({...backupSettings,online_backup_encryption_enabled:e.target.checked?1:0})}/><span>Cifra sempre i file prima dell'upload</span></label>
        <div className={(googleDriveConfigured||driveConnected)?"drive-config ok":"drive-config"}><Cloud/><div><strong>{driveConnected?"Google Drive collegato":googleDriveConfigured?"Configurazione Google rilevata":"Configurazione Google mancante"}</strong><span>{driveConnected?`Token salvato in Windows${driveConnection?.account_email?` per ${driveConnection.account_email}`:""}.`:googleDriveConfigured?"Client ID presente in .env. Premi Collega Google Drive per autorizzare l'account.":"Inserisci VITE_GOOGLE_DRIVE_CLIENT_ID nel file .env."}</span></div></div>
        <button className="secondary-button" disabled={driveConnecting||!googleDriveConfigured||((backupSettings.online_backup_enabled??0)!==1)} onClick={connectGoogleDrive}><Cloud/> {driveConnecting?"Attendo autorizzazione...":driveConnected?"Ricollega Google Drive":"Collega Google Drive"}</button>
        <small>{driveConnected?"Il collegamento è pronto: il prossimo step sarà caricare automaticamente i backup cifrati su Drive.":"Per collegarlo: spunta il backup online, salva le preferenze se vuoi, poi premi Collega Google Drive e autorizza dal browser."}</small></section></div>}
    {backupSettings&&<div className="settings-actions"><button className="primary" onClick={saveBackupPreferences}><Save/> Salva preferenze backup</button></div>}
    <div className="backup-encryption"><h3>Backup cifrato manuale</h3><p>Usalo per creare un file `.gimbackup` sicuro da copiare su cloud o chiavetta. La password non viene salvata.</p><label>Password di cifratura<input type="password" value={encryptPassphrase} onChange={e=>setEncryptPassphrase(e.target.value)} placeholder="Almeno 12 caratteri"/></label></div>
    {message&&<p className={message.startsWith("Errore")?"error":"success"}>{message}</p>}{lastDriveUpload&&<div className="drive-upload-result"><strong>Backup online completato</strong><span>{lastDriveUpload.folder_path}/{lastDriveUpload.name}</span>{lastDriveUpload.web_view_link&&<button className="secondary-button" onClick={openDriveUpload}><Cloud/> Apri su Google Drive</button>}</div>}<div className="settings-actions"><button className="primary" onClick={async()=>{try{setLastDriveUpload(null);setMessage(`Backup creato in: ${await createBackup()}`)}catch(e){setMessage(`Errore: ${String(e)}`)}}}>Crea backup ora</button><button className="secondary-button" onClick={createEncryptedBackupAndMaybeUpload}><Shield/> {driveConnected&&(backupSettings?.online_backup_enabled??0)===1?"Crea backup cifrato e carica su Drive":"Crea backup cifrato"}</button><button className="secondary-button" onClick={()=>setRestore(true)}>Ripristina ultimo backup</button></div>
    <UpdateSettings/>
    {restore&&<ConfirmDialog title="Ripristinare l’ultimo backup?" body="Prima del ripristino verrà conservata una copia del database attuale. L’app si riavvierà automaticamente." confirmLabel="Ripristina backup" close={()=>setRestore(false)} confirmed={async()=>{await invoke("restore_latest_backup")}}/>}</div>;
}

function UpdateSettings(){
  const [update,setUpdate]=useState<Update|null>(null),[dialogOpen,setDialogOpen]=useState(false),[checking,setChecking]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  async function manualCheck(){
    setChecking(true);setError("");setMessage("");setUpdate(null);setDialogOpen(false);
    try{const found=await checkForAvailableUpdate();if(found){setUpdate(found);setMessage(`Disponibile la versione ${found.version}.`)}else setMessage("Il gestionale è già aggiornato.");}
    catch(e){setError(updateCheckErrorMessage(e))}
    finally{setChecking(false)}
  }
  return <section className="update-settings"><div><h3>Aggiornamenti del gestionale</h3><p>Controlla se è disponibile una nuova versione firmata pubblicata tra le release GitHub.</p></div>
    <div className="settings-actions"><button className="secondary-button" disabled={checking} onClick={manualCheck}><RefreshCw/> {checking?"Controllo...":"Controlla aggiornamenti"}</button></div>
    {message&&<p className={update?"success":"update-ok"}>{update?<Download/>:<CheckCircle2/>}{message}</p>}
    {error&&<p className="error">{error}</p>}
    {update&&<div className="update-card"><strong>Versione {update.version}</strong><p>{updateBody(update)}</p><button className="primary" onClick={()=>setDialogOpen(true)}><Download/> Installa aggiornamento</button></div>}
    {update&&dialogOpen&&<UpdateDialog update={update} close={()=>setDialogOpen(false)}/>}
  </section>;
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

export function ScheduleSettings(){
  const names=["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
  const [rules,setRules]=useState<MassScheduleRule[]>([]),[drafts,setDrafts]=useState<Record<number,string>>({}),[message,setMessage]=useState(""),[error,setError]=useState("");
  useEffect(()=>{loadSchedules().then(setRules)},[]);
  function add(day:number){const time=drafts[day];setError("");if(!time)return setError(`Seleziona un orario per ${names[day]}.`);if(rules.some(r=>r.weekday===day&&r.time===time))return setError(`${names[day]} ha già una messa alle ${time}.`);setRules(current=>[...current,{weekday:day,time,max_intentions:null}]);setDrafts(current=>({...current,[day]:""}));setMessage("")}
  function remove(day:number,time:string){setRules(current=>current.filter(rule=>!(rule.weekday===day&&rule.time===time)));setMessage("")}
  return <div className="schedule-settings"><h2>Orari standard delle messe</h2><p>Aggiungi o rimuovi gli orari per ogni giorno. Le modifiche diventano effettive dopo il salvataggio.</p>
    <div className="schedule-editor">{names.map((name,day)=>{const dayRules=rules.filter(r=>r.weekday===day).sort((a,b)=>a.time.localeCompare(b.time));return <section key={name} className="schedule-day"><div><strong>{name}</strong><span>{dayRules.length===0?"Nessuna messa":`${dayRules.length} ${dayRules.length===1?"orario":"orari"}`}</span></div>
      <div className="schedule-times">{dayRules.map(rule=><span key={rule.time}>{rule.time}<button aria-label={`Rimuovi ${rule.time} di ${name}`} onClick={()=>remove(day,rule.time)}><X/></button></span>)}</div>
      <div className="schedule-add"><label><span>Nuovo orario</span><input type="time" value={drafts[day]??""} onChange={e=>setDrafts(current=>({...current,[day]:e.target.value}))}/></label><button className="secondary-button" onClick={()=>add(day)}><Plus/> Aggiungi</button></div>
    </section>})}</div>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success">{message}</p>}<button className="primary" type="button" onClick={async()=>{await saveSchedules(rules);setMessage("Orari delle messe salvati.")}}><Save/> Salva orari messe</button>
  </div>;
}

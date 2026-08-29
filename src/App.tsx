import { useEffect, useMemo, useRef, useState } from 'react';
import { History, Home, Pill, Settings, UserRound } from 'lucide-react';
import type { DB, Med, Role, Tab } from './model';
import { CHANNEL, KEY, dueFor, load } from './model';
import { AddModal, AlarmOverlay, ConfirmationOverlay, DetailSheet, EditModal, NavButton, StartTimeModal } from './components';
import { AuthGate, OnboardingGate } from './auth';
import { HistoryView, HomeView, MedsView, SettingsView } from './views';

function App() {
  const [db, setDb] = useState<DB>(load);
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('cm-v12-authenticated') === '1' || !!localStorage.getItem('cm-role'));
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem('cm-v12-role') || !!localStorage.getItem('cm-role'));
  const [role, setRole] = useState<Role>(() => (localStorage.getItem('cm-v12-role') as Role) || (localStorage.getItem('cm-role') as Role) || 'patient');
  const [tab, setTab] = useState<Tab>('home');
  const [now, setNow] = useState(Date.now());
  const [alarm, setAlarm] = useState<{ med: Med; due: Date } | null>(null);
  const [done, setDone] = useState<{ med: Med; event: DB['events'][number]; next: Date } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<Med | null>(null);
  const [edit, setEdit] = useState<Med | null>(null);
  const [startMed, setStartMed] = useState<Med | null>(null);
  const [snoozes, setSnoozes] = useState<Record<string, number>>({});
  const audio = useRef<AudioContext | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(db)); }, [db]);
  useEffect(() => { try { const bc = new BroadcastChannel(CHANNEL); bc.onmessage = e => e.data?.meds && setDb(e.data); return () => bc.close(); } catch { return; } }, []);

  const schedule = useMemo(() => db.meds.map(m => ({ m, due: dueFor(m, db.events) })).filter((x): x is { m: Med; due: Date } => !!x.due).sort((a, b) => +a.due - +b.due), [db]);
  const pending = schedule.filter(x => x.due.getTime() <= now && (snoozes[x.m.id] || 0) <= now)[0];
  const upcoming = schedule.filter(x => x.due.getTime() > now);
  const next = upcoming[0];

  useEffect(() => {
    if (!pending || alarm || done) return;
    setAlarm({ med: pending.m, due: pending.due });
    if (db.settings?.sound !== false) startSound();
    if (db.settings?.notifications && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('🔔 Hora do medicamento', { body: `Dose pendente: ${pending.m.name}` }); } catch {}
    }
  }, [pending?.m.id, pending?.due?.getTime(), alarm, done]);

  function startSound() {
    try { const C = window.AudioContext || (window as any).webkitAudioContext; if (!C) return; stopSound(); const c = new C(); audio.current = c; const beep = () => { if (c.state === 'suspended') c.resume().catch(() => {}); const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = 880; g.gain.value = .16; o.connect(g); g.connect(c.destination); o.start(); window.setTimeout(() => { try { o.stop(); } catch {} }, 500); }; beep(); timer.current = window.setInterval(beep, 1100); } catch {}
  }
  function stopSound() { if (timer.current) clearInterval(timer.current); timer.current = null; audio.current?.close(); audio.current = null; }
  function save(x: DB) { setDb({ ...x }); try { const bc = new BroadcastChannel(CHANNEL); bc.postMessage(x); bc.close(); } catch {} }

  function confirmMed(m: Med) {
    stopSound(); const item = schedule.find(x => x.m.id === m.id); if (!item) return;
    const e: DB['events'][number] = { id: crypto.randomUUID(), medId: m.id, scheduled: item.due.toISOString(), confirmed: new Date(now).toISOString(), by: role === 'patient' ? 'Paciente' : 'Acompanhante' };
    save({ ...db, events: [...db.events, e] }); setAlarm(null); setSnoozes(s => ({ ...s, [m.id]: 0 })); setDone({ med: m, event: e, next: new Date(now + m.interval * 60000) });
  }
  function snooze(m: Med, min: number) { stopSound(); setSnoozes(s => ({ ...s, [m.id]: Date.now() + min * 60000 })); setAlarm(null); }
  function setFirstTime(iso: string) { if (!startMed) return; save({ ...db, meds: db.meds.map(z => z.id === startMed.id ? { ...z, start: iso, active: true } : z) }); setStartMed(null); }
  function pause(m: Med) { save({ ...db, meds: db.meds.map(z => z.id === m.id ? { ...z, active: !z.active } : z) }); setDetail(null); }
  function addMed(data: { name: string; interval: number; form: string; dose: string; note: string; photo: string | null }) { save({ ...db, meds: [...db.meds, { id: crypto.randomUUID(), name: data.name, interval: data.interval, start: null, active: true, form: data.form, dose: data.dose, note: data.note, photo: data.photo }] }); setShowAdd(false); }
  function updateMed(m: Med) { save({ ...db, meds: db.meds.map(x => x.id === m.id ? m : x) }); setEdit(null); setDetail(null); }
  function removeMed(m: Med) { if (!confirm(`Excluir ${m.name}?`)) return; save({ ...db, meds: db.meds.filter(x => x.id !== m.id), events: db.events.filter(e => e.medId !== m.id) }); setDetail(null); setEdit(null); }
  function askNotifications() { if (!('Notification' in window)) return alert('Este navegador não oferece notificações.'); Notification.requestPermission().then(p => save({ ...db, settings: { ...db.settings, notifications: p === 'granted' } })).catch(() => {}); }
  function testAlarm() { startSound(); window.setTimeout(stopSound, 5000); }

  if (!authenticated) return <AuthGate onComplete={(r, name) => { setDb(x => ({ ...x, patientName: name || x.patientName })); setRole(r); setAuthenticated(true); }}/>;
  if (!onboarded) return <OnboardingGate db={db} onComplete={(r) => { localStorage.setItem('cm-v12-role', r); setRole(r); setOnboarded(true); }}/>;

  const activePending = alarm || (!done && pending ? { med: pending.m, due: pending.due } : null);
  return <div className="min-h-screen bg-[#f5f7fb] text-[#182033]">
    <header className="border-b border-slate-100 bg-white"><div className="mx-auto flex max-w-xl items-center justify-between px-5 py-5"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 shadow-[0_8px_25px_rgba(37,99,235,.10)]"><Pill size={27}/></div><div><div className="text-[10px] font-bold tracking-[.28em] text-slate-400">CONTROLE DE</div><h1 className="text-[27px] font-medium leading-none tracking-tight">Medicamentos</h1><div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500"><UserRound size={14}/> {role === 'patient' ? 'Paciente' : 'Acompanhando'}: {db.patientName}</div></div></div><button onClick={() => { stopSound(); localStorage.removeItem('cm-role'); localStorage.removeItem('cm-v12-authenticated'); localStorage.removeItem('cm-v12-role'); setAuthenticated(false); setOnboarded(false); setRole('patient'); }} className="rounded-2xl bg-blue-50 px-5 py-3 font-bold text-blue-600">Sair</button></div></header>
    <main className="mx-auto max-w-xl px-5 pb-28 pt-5">
      {tab === 'home' && <HomeView db={db} activePending={activePending} next={next} upcoming={upcoming} now={now} onDetail={setDetail}/>} 
      {tab === 'meds' && <MedsView db={db} onAdd={() => setShowAdd(true)} onDetail={setDetail} onPause={pause} onStart={setStartMed}/>} 
      {tab === 'history' && <HistoryView db={db}/>} 
      {tab === 'settings' && <SettingsView db={db} onNotifications={askNotifications} onAlarm={testAlarm}/>} 
    </main>
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-100 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div className="mx-auto grid max-w-xl grid-cols-4 gap-1"><NavButton active={tab === 'home'} icon={<Home size={22}/>} label="Início" onClick={() => setTab('home')}/><NavButton active={tab === 'meds'} icon={<Pill size={22}/>} label="Medicamentos" onClick={() => setTab('meds')}/><NavButton active={tab === 'history'} icon={<History size={22}/>} label="Histórico" onClick={() => setTab('history')}/><NavButton active={tab === 'settings'} icon={<Settings size={22}/>} label="Configurações" onClick={() => setTab('settings')}/></div></nav>
    {activePending && <AlarmOverlay med={activePending.med} due={activePending.due} now={now} label={role === 'patient' ? 'USADO' : 'ADMINISTRADO'} onConfirm={() => confirmMed(activePending.med)} onSnooze={m => snooze(activePending.med, m)}/>} 
    {done && <ConfirmationOverlay done={done} onClose={() => setDone(null)} onNext={() => { setDone(null); setTab('home'); }}/>} 
    {detail && <DetailSheet med={detail} events={db.events} now={now} onClose={() => setDetail(null)} onConfirm={() => { const due = dueFor(detail, db.events); if (due && due.getTime() <= now) confirmMed(detail); }} onPause={() => pause(detail)} onEdit={() => setEdit(detail)} onDelete={() => removeMed(detail)}/>} 
    {edit && <EditModal med={edit} onClose={() => setEdit(null)} onSave={updateMed}/>} 
    {startMed && <StartTimeModal med={startMed} now={now} onClose={() => setStartMed(null)} onSave={setFirstTime}/>} 
    {showAdd && <AddModal onClose={() => setShowAdd(false)} onSave={addMed}/>} 
  </div>;
}
export default App;

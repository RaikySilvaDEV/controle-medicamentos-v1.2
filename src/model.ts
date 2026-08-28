type Role = 'patient' | 'companion';
type Tab = 'home' | 'meds' | 'history' | 'settings';
type Med = {
  id: string; name: string; interval: number; start: string | null; active: boolean;
  form?: string; dose?: string; note?: string; photo?: string | null;
};
type Event = { id: string; medId: string; scheduled: string; confirmed: string; by: 'Paciente' | 'Acompanhante' };
type DB = { patientName: string; shareCode: string; meds: Med[]; events: Event[]; settings?: { sound: boolean; notifications: boolean } };

const KEY = 'controle-med-v1.2-db';
const CHANNEL = 'cm-v12-realtime';
const seed: DB = {
  patientName: 'Paciente Demo', shareCode: 'DEMO-1234',
  meds: [
    { id: 'moxi', name: 'Cloridrato de moxifloxacino', interval: 180, start: null, active: true, form: 'Colírio', dose: '1 gota' },
    { id: 'pred', name: 'Acetato de prednisolona', interval: 120, start: null, active: true, form: 'Colírio', dose: '1 gota' },
    { id: 'dorz', name: 'Cloridrato de dorzolamida', interval: 720, start: null, active: true, form: 'Colírio', dose: '1 gota' },
    { id: 'brim', name: 'Tartarato de brimonidina', interval: 720, start: null, active: true, form: 'Colírio', dose: '1 gota', note: 'Aplicar 7 minutos após a dorzolamida.' }
  ], events: [], settings: { sound: true, notifications: false }
};

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    if (!parsed?.meds || !Array.isArray(parsed.meds)) return seed;
    return { ...seed, ...parsed, settings: { ...seed.settings, ...(parsed.settings || {}) }, meds: parsed.meds.map((m: Med) => ({ ...m, active: m.active !== false, note: m.note || '', photo: m.photo || null })) };
  } catch { return seed; }
}

const fmt = (t: string | Date) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dateFmt = (t: string | Date) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const duration = (ms: number) => { const m = Math.max(0, Math.floor(Math.abs(ms) / 60000)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h ${String(r).padStart(2, '0')}min` : `${r}min`; };
const dueFor = (m: Med, events: Event[]) => {
  if (!m.active || !m.start) return null;
  const last = [...events].filter(e => e.medId === m.id).sort((a, b) => +new Date(b.confirmed) - +new Date(a.confirmed))[0];
  return new Date(+(last?.confirmed || m.start) + m.interval * 60000);
};

export type { Role, Tab, Med, Event, DB };
export { KEY, CHANNEL, seed, load, fmt, dateFmt, duration, dueFor };

export type Role = 'patient' | 'companion';
export type Tab = 'home' | 'meds' | 'history' | 'settings' | 'report';
export type Med = {
  id: string; name: string; interval: number; start: string | null; active: boolean;
  form?: string; dose?: string; note?: string; photo?: string | null;
};
export type Event = { id: string; medId: string; scheduled: string; confirmed: string; by: 'Paciente' | 'Acompanhante' };
export type DB = { patientName: string; shareCode: string; meds: Med[]; events: Event[]; settings?: { sound: boolean; notifications: boolean } };

export const KEY = 'controle-med-v1.2-db';
export const CHANNEL = 'cm-v12-realtime';

const seed: DB = {
  patientName: '', shareCode: '', meds: [], events: [], settings: { sound: true, notifications: false }
};

export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const d = new Date(raw);
  if (Number.isFinite(d.getTime())) return d;
  const timeOnly = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (timeOnly) {
    const today = new Date();
    today.setHours(Number(timeOnly[1]), Number(timeOnly[2]), Number(timeOnly[3] || 0), 0);
    return today;
  }
  return null;
}

function normalizeStoredDate(value: unknown): string | null {
  const d = parseDate(value);
  return d ? d.toISOString() : null;
}

export function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(seed);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.meds)) return structuredClone(seed);
    const meds: Med[] = parsed.meds.map((m: Med) => ({
      ...m,
      start: normalizeStoredDate(m.start),
      active: m.active !== false,
      interval: Number.isFinite(Number(m.interval)) && Number(m.interval) > 0 ? Number(m.interval) : 1,
      name: String(m.name || 'Medicamento'),
      note: m.note || '',
      photo: m.photo || null
    }));
    const events: Event[] = Array.isArray(parsed.events)
      ? parsed.events.map((e: Event) => ({
          ...e,
          scheduled: normalizeStoredDate(e.scheduled) || String(e.scheduled || ''),
          confirmed: normalizeStoredDate(e.confirmed) || String(e.confirmed || '')
        }))
      : [];
    return {
      ...seed, ...parsed,
      patientName: String(parsed.patientName || ''),
      shareCode: String(parsed.shareCode || ''),
      events,
      settings: { ...seed.settings, ...(parsed.settings || {}) },
      meds
    };
  } catch { return structuredClone(seed); }
}

export const fmt = (t: string | Date | number) => {
  const d = parseDate(t);
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
};

export const dateFmt = (t: string | Date | number) => {
  const d = parseDate(t);
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
};

export const duration = (ms: number) => {
  if (!Number.isFinite(ms)) return '—';
  const m = Math.max(0, Math.floor(Math.abs(ms) / 60000));
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h}h ${String(r).padStart(2, '0')}min` : `${r}min`;
};

/**
 * Calcula a próxima dose sempre a partir do último horário REAL de confirmação.
 * O horário previsto da dose atual é registrado em Event.scheduled; se a pessoa
 * confirmar atrasado, a próxima dose passa a contar do horário real confirmado.
 */
export const dueFor = (m: Med, events: Event[]) => {
  if (!m.active) return null;
  const last = [...events]
    .filter(e => e.medId === m.id)
    .map(e => ({ ...e, confirmedDate: parseDate(e.confirmed) }))
    .filter(e => e.confirmedDate)
    .sort((a, b) => b.confirmedDate!.getTime() - a.confirmedDate!.getTime())[0];
  const base = last?.confirmedDate || parseDate(m.start);
  if (!base || !Number.isFinite(m.interval) || m.interval <= 0) return null;
  return new Date(base.getTime() + m.interval * 60000);
};

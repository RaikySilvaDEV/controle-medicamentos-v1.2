import { Bell, CalendarClock, Check, ChevronRight, Clock3, Copy, History, Pause, Pill, Play, Plus, ShieldAlert, UsersRound } from 'lucide-react';
import type { DB, Med } from './model';
import { dateFmt, duration, fmt } from './model';
import { adherence } from './profile';

export function HomeView({ db, activePending, next, upcoming, now, onDetail }: { db: DB; activePending: { med: Med; due: Date } | null; next: { m: Med; due: Date } | undefined; upcoming: { m: Med; due: Date }[]; now: number; onDetail: (m: Med) => void }) {
  const summary=adherence(db,'monthly');
  if (activePending) return <>
    <section className="relative mb-7 overflow-hidden rounded-[28px] bg-gradient-to-br from-red-600 to-red-500 p-7 text-white shadow-[0_18px_45px_rgba(220,38,38,.22)]">
      <div className="absolute -bottom-20 -right-12 h-52 w-52 rounded-full border-[30px] border-white/10"/>
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold tracking-wide"><ShieldAlert size={16}/> DOSE PENDENTE</span><span className="rounded-full bg-red-700/60 px-3 py-1.5 text-xs font-bold">ATRASADO</span></div>
        <h2 className="text-[25px] font-bold leading-tight">{activePending.med.name}</h2>
        <div className="mt-4 text-sm font-semibold opacity-90">Deveria ter sido às</div>
        <div className="mt-1 flex items-center gap-2 text-[52px] font-black leading-none"><Clock3 size={35}/>{fmt(activePending.due)}</div>
        <div className="mt-4 text-lg font-extrabold">🔴 Atrasado há {duration(now - activePending.due.getTime())}</div>
        <p className="mt-1 text-sm font-medium opacity-90">Ainda não foi confirmado.</p>
        <div className="mt-5 rounded-2xl bg-white/15 p-4 text-sm font-bold">A dose continua pendente até ser confirmada.</div>
      </div>
    </section>
    <ScheduleList upcoming={upcoming} now={now} onDetail={onDetail} title="Outros medicamentos" />
    <AdherenceCard summary={summary}/><CompanionCard code={db.shareCode}/>
  </>;

  return <>
    <section className="relative mb-7 overflow-hidden rounded-[28px] bg-gradient-to-br from-blue-600 to-blue-700 p-7 text-white shadow-[0_18px_45px_rgba(37,99,235,.20)]">
      <div className="absolute -bottom-20 -right-12 h-52 w-52 rounded-full border-[30px] border-white/5"/>
      <div className="relative">
        <div className="text-sm font-bold uppercase tracking-[.18em] text-white/75">Próxima medicação</div>
        <div className="mt-2 text-[24px] font-extrabold leading-tight">{next ? next.m.name : 'Nenhuma medicação'}</div>
        <div className="mt-4 flex items-center gap-3 text-[52px] font-black leading-none tracking-tight"><Clock3 size={43}/>{next ? fmt(next.due) : '—'}</div>
        {next ? <><div className="mt-5 text-[21px] font-extrabold">Em {duration(next.due.getTime() - now)}</div><p className="mt-1 text-base text-white/80">Você será alertado quando chegar a hora.</p></> : <><div className="mt-5 text-xl font-bold">Nenhum horário definido</div><p className="mt-2 text-white/75">Defina o primeiro horário de cada medicamento.</p></>}
      </div>
    </section>
    <ScheduleList upcoming={upcoming} now={now} onDetail={onDetail} title="Próximos horários" empty={db.meds.some(m => !m.start)} />
    <AdherenceCard summary={summary}/><CompanionCard code={db.shareCode}/>
  </>;
}

function AdherenceCard({summary}:{summary:ReturnType<typeof adherence>}) {
  return <section className="mt-6 rounded-[26px] border border-slate-100 bg-white p-5 shadow-[0_5px_20px_rgba(20,35,60,.045)]">
    <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-extrabold tracking-[.2em] text-slate-400">PRECISÃO DO TRATAMENTO</div><div className="mt-1 text-lg font-bold">Uso no horário certo</div></div><strong className="text-2xl font-black text-blue-600">{summary.precision}%</strong></div>
    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.precision}><div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{width:`${summary.precision}%`}}/></div>
    <div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{summary.onTime} no horário</span><span>{summary.late} atrasadas</span><span>{summary.missed} pendentes</span></div>
    <div className="mt-3 text-[11px] text-slate-400">Calculado comparando cada horário previsto com a confirmação real. Até 5 min de diferença conta como pontual.</div>
  </section>
}

function ScheduleList({ upcoming, now, onDetail, title, empty }: { upcoming: { m: Med; due: Date }[]; now: number; onDetail: (m: Med) => void; title: string; empty?: boolean }) {
  return <section>
    <div className="mb-4 flex items-center gap-2 text-[22px] font-bold"><CalendarClock size={23} className="text-slate-500"/> {title}</div>
    <div className="space-y-3">
      {upcoming.slice(0, 8).map(x => <button key={x.m.id} onClick={() => onDetail(x.m)} className="group flex w-full items-center gap-4 rounded-[24px] border border-slate-100 border-l-4 border-l-blue-600 bg-white p-4 text-left shadow-[0_5px_20px_rgba(20,35,60,.045)] transition active:scale-[.99]" aria-label={`Ver detalhes de ${x.m.name}`}>
        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-blue-50 text-blue-600">{x.m.photo ? <img src={x.m.photo} alt="" className="h-full w-full object-cover"/> : <Clock3 size={23}/>}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-[16px] font-bold">{x.m.name}</div><div className="mt-1 text-sm text-slate-500">{fmt(x.due)} <span className="text-slate-300">•</span> Em {duration(x.due.getTime() - now)}</div></div>
        <ChevronRight size={22} className="shrink-0 text-slate-300 transition-transform group-active:translate-x-0.5"/>
      </button>)}
      {!upcoming.length && empty && <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center"><Clock3 size={30} className="mx-auto text-slate-400"/><b className="mt-3 block">Nenhum horário programado</b><span className="mt-1 block text-sm text-slate-500">Defina o primeiro horário dos seus medicamentos.</span></div>}
      {!upcoming.length && !empty && <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-7 text-center text-slate-500">Confirme a dose pendente para liberar o próximo horário.</div>}
    </div>
  </section>;
}

function CompanionCard({ code }: { code: string }) {
  return <section className="mt-6 rounded-[26px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-600"><UsersRound size={24}/></div><div className="min-w-0"><div className="font-bold">Acompanhamento familiar</div><div className="text-sm text-slate-500">Compartilhe este código com seus familiares.</div></div></div><div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm"><strong className="text-xl tracking-[.14em] text-blue-600">{code}</strong><button onClick={() => navigator.clipboard?.writeText(code)} className="rounded-xl bg-blue-50 p-3 text-blue-600" aria-label="Copiar código"><Copy size={19}/></button></div></section>;
}

export function MedsView({ db, onAdd, onDetail, onPause, onStart }: { db: DB; onAdd: () => void; onDetail: (m: Med) => void; onPause: (m: Med) => void; onStart: (m: Med) => void }) {
  return <>
    <div className="mb-5 flex items-center justify-between"><div><div className="text-[10px] font-bold tracking-[.22em] text-slate-400">SEUS MEDICAMENTOS</div><h2 className="text-2xl font-bold">Medicamentos</h2><p className="mt-1 text-sm text-slate-500">Cadastre, acompanhe e ajuste seus tratamentos.</p></div><button onClick={onAdd} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-100" aria-label="Adicionar medicamento"><Plus size={24}/></button></div>
    {!db.meds.length && <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Pill size={30}/></div><b className="mt-4 block text-lg">Nenhum medicamento cadastrado</b><p className="mt-1 text-sm text-slate-500">Adicione seu primeiro medicamento para começar a calcular os próximos horários.</p><button onClick={onAdd} className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white">＋ Adicionar medicamento</button></div>}
    <div className="space-y-3">
      {db.meds.map(m => <article key={m.id} className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_5px_20px_rgba(20,35,60,.045)]">
        <button onClick={() => onDetail(m)} className="flex w-full items-start gap-4 text-left" aria-label={`Abrir detalhes de ${m.name}`}>
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-blue-50 text-blue-600">{m.photo ? <img src={m.photo} alt="" className="h-full w-full object-cover"/> : m.form === 'Colírio' ? '💧' : '💊'}</div>
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="truncate text-[17px]">{m.name}</b><ChevronRight size={18} className="shrink-0 text-slate-300"/></div><span className="mt-1 block text-sm text-slate-500">{m.dose || '1 dose'} • {m.interval >= 1440 ? `A cada ${m.interval / 1440} dias` : m.interval >= 60 ? `A cada ${m.interval / 60} horas` : `A cada ${m.interval} min`}</span><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${m.active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{m.active ? '● Em uso' : '● Pausado'}</span></div>
        </button>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => onDetail(m)} className="rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-700">Ver detalhes</button>
          {!m.start ? <button onClick={() => onStart(m)} className="rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white">Definir 1º horário</button> : <button onClick={() => onStart(m)} className="rounded-2xl bg-blue-50 py-3 text-sm font-bold text-blue-700">Alterar 1º horário</button>}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => onDetail(m)} className="rounded-2xl border border-blue-100 bg-blue-50 py-2.5 text-xs font-bold text-blue-700">Atualizar medicamento</button>
          <button onClick={() => onPause(m)} className={`rounded-2xl py-2.5 text-xs font-bold ${m.active ? 'border border-amber-100 bg-amber-50 text-amber-700' : 'border border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{m.active ? 'Pausar' : 'Retomar'}</button>
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-400">Para editar ou excluir, abra os detalhes do medicamento.</p>
      </article>)}
    </div>
  </>;
}

export function HistoryView({ db }: { db: DB }) { return <><div className="mb-5"><div className="text-[10px] font-bold tracking-[.22em] text-slate-400">REGISTROS</div><h2 className="text-2xl font-bold">Histórico</h2><p className="text-sm text-slate-500">Veja o nome do medicamento, horário previsto e confirmação.</p></div><div className="space-y-3">{[...db.events].reverse().map(e => <div key={e.id} className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Check size={21}/></div><div className="min-w-0 flex-1"><b className="block">{db.meds.find(m => m.id === e.medId)?.name || 'Medicamento'}</b><span className="mt-1 block text-sm text-slate-500">{e.by} • Previsto {fmt(e.scheduled)} • Confirmado {fmt(e.confirmed)}</span><small className="text-slate-400">{dateFmt(e.confirmed)}</small></div></div></div>)}{!db.events.length && <div className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Nenhuma administração registrada ainda.</div>}</div></>; }

export function SettingsView({ db, onNotifications, onAlarm }: { db: DB; onNotifications: () => void; onAlarm: () => void }) { return <><div className="mb-5"><div className="text-[10px] font-bold tracking-[.22em] text-slate-400">APP</div><h2 className="text-2xl font-bold">Configurações</h2></div><div className="space-y-3"><button onClick={onNotifications} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 font-bold shadow-sm"><Bell size={20} className="text-blue-600"/> Ativar notificações</button><button onClick={onAlarm} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 font-bold shadow-sm"><span className="text-blue-600">🔔</span> Testar alarme</button><button onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })); a.download = 'controle-medicamentos-v1.2-backup.json'; a.click(); }} className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 font-bold shadow-sm"><History size={20} className="text-blue-600"/> Exportar backup</button><p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900">A v1.2 mantém os dados no navegador e sincroniza abas abertas. Alarmes sonoros dependem da permissão de áudio do navegador.</p><p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Este aplicativo organiza horários e registros. Não substitui orientação médica.</p></div></>; }

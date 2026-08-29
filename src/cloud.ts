import { supabase } from './supabase'
import type { DB, Event, Med, Role } from './model'

export async function ensureProfile(role: Role, name: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sessão não encontrada.')
  const { error } = await supabase.from('profiles').upsert({ id: user.id, name, role }, { onConflict: 'id' })
  if (error) throw error
  return user
}

export async function getMembership(role: Role, name: string, code?: string) {
  const user = await ensureProfile(role, name)
  if (role === 'patient') {
    const { data: existing } = await supabase.from('patient_members').select('patient_id').eq('user_id', user.id).eq('relation', 'patient').maybeSingle()
    if (existing?.patient_id) return existing.patient_id
    const shareCode = `${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PACIENTE'}-${Math.floor(1000 + Math.random() * 9000)}`
    const { data: patient, error } = await supabase.from('patients').insert({ name, share_code: shareCode, created_by: user.id }).select('id').single()
    if (error) throw error
    const { error: memberError } = await supabase.from('patient_members').insert({ patient_id: patient.id, user_id: user.id, relation: 'patient' })
    if (memberError) throw memberError
    return patient.id
  }
  if (!code) throw new Error('Informe o código de acompanhamento.')
  const { data: patient, error } = await supabase.from('patients').select('id').eq('share_code', code.trim().toUpperCase()).maybeSingle()
  if (error) throw error
  if (!patient) throw new Error('Código de acompanhamento não encontrado.')
  const { error: memberError } = await supabase.from('patient_members').upsert({ patient_id: patient.id, user_id: user.id, relation: 'companion' }, { onConflict: 'patient_id,user_id' })
  if (memberError) throw memberError
  return patient.id
}

export async function loadCloud(patientId: string): Promise<DB> {
  const [{ data: patient }, { data: medications }, { data: events }] = await Promise.all([
    supabase.from('patients').select('name,share_code').eq('id', patientId).single(),
    supabase.from('medications').select('*').eq('patient_id', patientId).order('created_at'),
    supabase.from('dose_events').select('*').eq('patient_id', patientId).order('scheduled_at')
  ])
  const meds: Med[] = (medications || []).map((m: any) => ({ id: m.id, name: m.name, interval: m.interval_minutes, start: m.start_at, active: m.active, form: m.form, dose: m.dose, note: m.note, photo: m.photo_url }))
  const ev: Event[] = (events || []).map((e: any) => ({ id: e.id, medId: e.medication_id, scheduled: e.scheduled_at, confirmed: e.confirmed_at || '', by: e.confirmed_role === 'companion' ? 'Acompanhante' : 'Paciente' }))
  return { patientName: patient?.name || 'Paciente', shareCode: patient?.share_code || '', meds, events: ev, settings: { sound: true, notifications: false } }
}

export async function upsertMedication(patientId: string, m: Med) {
  const { data, error } = await supabase.from('medications').upsert({ id: m.id, patient_id: patientId, name: m.name, interval_minutes: m.interval, start_at: m.start, active: m.active, form: m.form || 'Colírio', dose: m.dose || '', note: m.note || '', photo_url: m.photo || null }).select().single()
  if (error) throw error
  return data
}

export async function deleteMedication(patientId: string, id: string) {
  const { error } = await supabase.from('medications').delete().eq('patient_id', patientId).eq('id', id)
  if (error) throw error
}

export async function insertDose(patientId: string, medId: string, scheduled: string, role: Role) {
  const { data: existing } = await supabase.from('dose_events').select('id').eq('medication_id', medId).eq('scheduled_at', scheduled).not('confirmed_at', 'is', null).limit(1)
  if (existing?.length) throw new Error('Esta dose já foi confirmada em outro dispositivo.')
  const { data, error } = await supabase.from('dose_events').insert({ patient_id: patientId, medication_id: medId, scheduled_at: scheduled, confirmed_at: new Date().toISOString(), confirmed_by: (await supabase.auth.getUser()).data.user?.id, confirmed_role: role, status: 'confirmed' }).select().single()
  if (error) throw error
  return data
}

export function subscribeCloud(patientId: string, onChange: () => void) {
  const channel = supabase.channel(`patient-${patientId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'medications', filter: `patient_id=eq.${patientId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_events', filter: `patient_id=eq.${patientId}` }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

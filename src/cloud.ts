import { supabase } from './supabase'
import type { DB, Event, Med, Role } from './model'

export type AccountProfile = {
  name: string
  role: Role
  patientId: string
  email: string
  avatarUrl: string | null
}

export async function getExistingProfile(): Promise<AccountProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const fallbackName = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário')
  const avatarUrl = String(user.user_metadata?.avatar_url || user.user_metadata?.picture || '') || null
  const email = user.email || ''
  const { data: profile, error: profileError } = await supabase.from('profiles').select('name,role').eq('id', user.id).maybeSingle()
  if (profileError) throw profileError
  if (!profile || (profile.role !== 'patient' && profile.role !== 'companion')) return null
  const { data: membership, error: membershipError } = await supabase.from('patient_members').select('patient_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership?.patient_id) return null
  return { role: profile.role as Role, name: profile.name || fallbackName, patientId: membership.patient_id as string, email, avatarUrl }
}

export async function updateOwnProfile(name: string, role: Role, patientId: string) {
  const cleanName = name.trim()
  if (cleanName.length < 2) throw new Error('Informe um nome válido.')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sessão expirada. Entre novamente.')

  const { error: profileError } = await supabase.from('profiles').update({ name: cleanName }).eq('id', user.id)
  if (profileError) throw profileError

  // O paciente é o dono do cadastro clínico; acompanhantes alteram apenas o próprio perfil.
  if (role === 'patient') {
    const { error: patientError } = await supabase.from('patients').update({ name: cleanName }).eq('id', patientId).eq('created_by', user.id)
    if (patientError) throw patientError
  }

  localStorage.setItem('cm-v12-name', cleanName)
  return cleanName
}

export async function getMembership(role: Role, name: string, code?: string) {
  const cleanName = name.trim() || 'Usuário'
  if (role === 'patient') {
    const { data: patientId, error } = await supabase.rpc('create_patient_for_current_user', { p_name: cleanName })
    if (error) throw error
    return patientId as string
  }
  if (!code?.trim()) throw new Error('Informe o código de acompanhamento.')
  const { data: patientId, error } = await supabase.rpc('join_patient_by_share_code', { p_code: code.trim().toUpperCase() })
  if (error) throw error
  if (!patientId) throw new Error('Código de acompanhamento inválido.')
  return patientId as string
}

export async function loadCloud(patientId: string): Promise<DB> {
  const [{ data: patient, error: pe }, { data: medications, error: me }, { data: events, error: ee }] = await Promise.all([
    supabase.from('patients').select('name,share_code').eq('id', patientId).single(),
    supabase.from('medications').select('*').eq('patient_id', patientId).order('created_at'),
    supabase.from('dose_events').select('*').eq('patient_id', patientId).order('scheduled_at')
  ])
  if (pe) throw pe
  if (me) throw me
  if (ee) throw ee
  const meds: Med[] = (medications || []).map((m: any) => ({ id: m.id, name: m.name, interval: m.interval_minutes, start: m.start_at, active: m.active, form: m.form, dose: m.dose, note: m.note, photo: m.photo_url }))
  const ev: Event[] = (events || []).map((e: any) => ({ id: e.id, medId: e.medication_id, scheduled: e.scheduled_at, confirmed: e.confirmed_at || '', by: e.confirmed_role === 'companion' ? 'Acompanhante' : 'Paciente' }))
  return { patientName: patient?.name || 'Paciente', shareCode: patient?.share_code || '', meds, events: ev, settings: { sound: true, notifications: false } }
}

export async function upsertMedication(patientId: string, m: Med) {
  const { error } = await supabase.from('medications').upsert({ id: m.id, patient_id: patientId, name: m.name, interval_minutes: m.interval, start_at: m.start, active: m.active, form: m.form || 'Colírio', dose: m.dose || '', note: m.note || '', photo_url: m.photo || null })
  if (error) throw error
}

export async function deleteMedication(patientId: string, id: string) {
  const { error } = await supabase.from('medications').delete().eq('patient_id', patientId).eq('id', id)
  if (error) throw error
}

export async function insertDose(patientId: string, medId: string, scheduled: string, role: Role) {
  const { data: user } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('dose_events').insert({ patient_id: patientId, medication_id: medId, scheduled_at: scheduled, confirmed_at: new Date().toISOString(), confirmed_by: user.user?.id, confirmed_role: role, status: 'confirmed' }).select().single()
  if (error) {
    if ((error as any).code === '23505') throw new Error('Esta dose já foi confirmada em outro dispositivo.')
    throw error
  }
  return data
}

export function subscribeCloud(patientId: string, onChange: () => void) {
  const channel = supabase.channel(`patient-${patientId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'medications', filter: `patient_id=eq.${patientId}` }, onChange).on('postgres_changes', { event: '*', schema: 'public', table: 'dose_events', filter: `patient_id=eq.${patientId}` }, onChange).subscribe()
  return () => { supabase.removeChannel(channel) }
}

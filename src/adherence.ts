import type { Event } from './model'

export type DoseStatus = 'on-time' | 'late' | 'pending'

/** Tolerância visual de 5 minutos para considerar uma dose pontual. */
export const ON_TIME_TOLERANCE_MINUTES = 5

export function delayMinutes(event: Pick<Event, 'scheduled' | 'confirmed'>): number | null {
  const scheduled = new Date(event.scheduled).getTime()
  const confirmed = new Date(event.confirmed).getTime()
  if (!Number.isFinite(scheduled) || !Number.isFinite(confirmed) || !event.confirmed) return null
  return Math.max(0, Math.round((confirmed - scheduled) / 60000))
}

export function doseStatus(event: Pick<Event, 'scheduled' | 'confirmed'>, now = Date.now()): DoseStatus {
  if (!event.confirmed) return new Date(event.scheduled).getTime() <= now ? 'pending' : 'pending'
  return (delayMinutes(event) ?? 0) <= ON_TIME_TOLERANCE_MINUTES ? 'on-time' : 'late'
}

export function calculateAdherence(events: Event[], now = Date.now()) {
  const confirmed = events.filter(e => !!e.confirmed && Number.isFinite(new Date(e.confirmed).getTime()))
  if (!confirmed.length) return { percentage: 0, total: 0, onTime: 0, late: 0, averageDelay: 0 }
  let onTime = 0
  let totalDelay = 0
  for (const event of confirmed) {
    const delay = delayMinutes(event) ?? 0
    totalDelay += delay
    if (doseStatus(event, now) === 'on-time') onTime++
  }
  return { percentage: Math.round((onTime / confirmed.length) * 100), total: confirmed.length, onTime, late: confirmed.length - onTime, averageDelay: Math.round(totalDelay / confirmed.length) }
}

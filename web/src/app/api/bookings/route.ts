import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { Booking } from '@/payload-types'
import { validateBookingInput } from '@/server/booking/validateBooking'
import { sendBookingNotification } from '@/server/notifications/sendBookingNotification'

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const body = (await request.json()) as Record<string, unknown>

  const toNumber = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value)
    }
    return undefined
  }

  const bookingInput = {
    customerName: body.customerName as string | undefined,
    phone: body.phone as string | undefined,
    email: body.email as string | undefined,
    type: body.type as string | undefined,
    project: body.project as string | undefined,
    event: body.event as string | undefined,
    service: body.service as string | undefined,
    guests: toNumber(body.guests),
    startDate: body.startDate as string | undefined,
    endDate: body.endDate as string | undefined,
    notes: body.notes as string | undefined,
    source: (body.source as string | undefined) || 'website',
  }

  const validation = validateBookingInput(bookingInput)
  if (!validation.valid) {
    return Response.json({ errors: validation.errors }, { status: 400 })
  }

  const bookingTypes = ['event', 'service', 'stay', 'tour', 'other'] as const
  const bookingSources = ['phone', 'website', 'other', 'vk', 'telegram'] as const

  const normalizedType = bookingTypes.includes(bookingInput.type as (typeof bookingTypes)[number])
    ? (bookingInput.type as (typeof bookingTypes)[number])
    : undefined

  if (!normalizedType) {
    return Response.json(
      { errors: ['Поле type должно быть одним из: event, service, stay, tour, other'] },
      { status: 400 },
    )
  }

  const normalizedSource = bookingSources.includes(bookingInput.source as (typeof bookingSources)[number])
    ? (bookingInput.source as (typeof bookingSources)[number])
    : 'website'

  const bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> = {
    customerName: bookingInput.customerName!,
    phone: bookingInput.phone!,
    email: bookingInput.email ?? null,
    type: normalizedType,
    project: toNumber(bookingInput.project),
    event: toNumber(bookingInput.event),
    service: toNumber(bookingInput.service),
    guests: bookingInput.guests ?? null,
    startDate: bookingInput.startDate ?? null,
    endDate: bookingInput.endDate ?? null,
    source: normalizedSource,
    notes: bookingInput.notes ?? null,
    status: 'new',
  }

  const booking = await payload.create({
    collection: 'bookings',
    data: bookingData,
    draft: false,
    overrideAccess: false,
  })

  await sendBookingNotification(bookingInput)

  return Response.json({ id: booking.id })
}

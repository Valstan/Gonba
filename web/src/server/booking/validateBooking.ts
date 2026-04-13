export type BookingInput = {
  customerName?: string
  phone?: string
  email?: string
  type?: string
  project?: string
  event?: string
  service?: string
  guests?: number
  startDate?: string
  endDate?: string
  notes?: string
  source?: string
}

export type BookingValidationResult = {
  valid: boolean
  errors: string[]
}

export const validateBookingInput = (input: BookingInput): BookingValidationResult => {
  const errors: string[] = []

  if (!input.customerName) errors.push('customerName is required')
  if (!input.phone) errors.push('phone is required')
  if (!input.type) errors.push('type is required')

  if (input.startDate && Number.isNaN(Date.parse(input.startDate))) {
    errors.push('startDate must be a valid date')
  }

  if (input.endDate && Number.isNaN(Date.parse(input.endDate))) {
    errors.push('endDate must be a valid date')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

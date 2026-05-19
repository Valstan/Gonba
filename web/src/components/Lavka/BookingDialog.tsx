'use client'

import React, { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type Mode = 'service' | 'product'

type Props = {
  mode: Mode
  itemId: number
  itemTitle: string
  projectId?: number | null
  triggerLabel?: string
}

export const BookingDialog: React.FC<Props> = ({ mode, itemId, itemTitle, projectId, triggerLabel = 'Оставить заявку' }) => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) {
      setError('Имя и телефон обязательны')
      return
    }
    setStatus('sending')
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        customerName: name.trim(),
        phone: phone.trim(),
        type: mode === 'service' ? 'service' : 'other',
        project: projectId ?? undefined,
        notes: notes.trim() ? notes.trim() : undefined,
        source: 'website',
      }
      if (mode === 'service') payload.service = itemId
      if (mode === 'product') payload.productId = itemId

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { errors?: string[] }
        throw new Error(body.errors?.join('; ') || `HTTP ${res.status}`)
      }
      setStatus('sent')
      setName('')
      setPhone('')
      setNotes('')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Не удалось отправить заявку')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setStatus('idle')
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          className="w-full"
          style={{ backgroundColor: 'var(--project-accent)', color: 'white' }}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Заявка на «{itemTitle}»</DialogTitle>
          <DialogDescription>
            Оставьте телефон — мы свяжемся в ближайшее время и согласуем детали.
          </DialogDescription>
        </DialogHeader>
        {status === 'sent' ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            Спасибо! Заявка принята, мы скоро напишем или позвоним.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="booking-name">Как к вам обращаться</Label>
              <Input
                id="booking-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={64}
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="booking-phone">Телефон</Label>
              <Input
                id="booking-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7..."
              />
            </div>
            <div>
              <Label htmlFor="booking-notes">Комментарий (необязательно)</Label>
              <Textarea
                id="booking-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" disabled={status === 'sending'} className="mt-2">
              {status === 'sending' ? 'Отправляю...' : 'Отправить'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

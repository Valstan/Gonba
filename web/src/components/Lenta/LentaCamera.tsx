'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { baseMime, CLIENT_MAX_VIDEO_SEC, pickRecorderMime } from './ugcClient'

type CamMode = 'photo' | 'video'
type CamStatus = 'init' | 'live' | 'recording' | 'denied' | 'error'

const HAS_MEDIA = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
const HAS_RECORDER = typeof MediaRecorder !== 'undefined'

// Встроенная камера: снимает фото (кадр из потока через canvas) или короткое видео
// (MediaRecorder) ПРЯМО на странице и отдаёт готовый File в общий поток загрузки
// (LentaUpload → presigned PUT в S3). getUserMedia требует HTTPS (прод) или localhost.
export function LentaCamera({
  onCaptured,
  onCancel,
}: {
  onCaptured: (file: File) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  const [mode, setMode] = useState<CamMode>('photo')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [status, setStatus] = useState<CamStatus>('init')
  const [seconds, setSeconds] = useState(0)

  const stopStream = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }, [])

  // Поток поднимаем при монтировании и при смене камеры/режима (видео — с аудио).
  useEffect(() => {
    if (!HAS_MEDIA) {
      setStatus('error')
      return
    }
    let cancelled = false
    ;(async () => {
      stopStream()
      setStatus('init')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: mode === 'video',
        })
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setStatus('live')
      } catch (err) {
        const name = (err as { name?: string })?.name
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      }
    })()
    return () => {
      cancelled = true
      stopStream()
    }
  }, [facing, mode, stopStream])

  function snapPhoto() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
        stopStream()
        onCaptured(file)
      },
      'image/jpeg',
      0.9,
    )
  }

  function startRec() {
    const stream = streamRef.current
    if (!stream || !HAS_RECORDER) return
    chunksRef.current = []
    const mime = pickRecorderMime()
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    } catch {
      setStatus('error')
      return
    }
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      const type = baseMime(rec.mimeType || mime || 'video/webm')
      const ext = type.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunksRef.current, { type })
      const file = new File([blob], `camera-${Date.now()}.${ext}`, { type })
      stopStream()
      onCaptured(file)
    }
    recorderRef.current = rec
    rec.start()
    setStatus('recording')
    setSeconds(0)
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        const n = s + 1
        if (n >= CLIENT_MAX_VIDEO_SEC) stopRec()
        return n
      })
    }, 1000)
  }

  function stopRec() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop() // onstop → onCaptured
  }

  function cancel() {
    stopStream()
    onCancel()
  }

  if (status === 'denied' || status === 'error' || !HAS_MEDIA) {
    return (
      <div className="lenta-cam lenta-cam--msg">
        <p>
          {status === 'denied'
            ? 'Доступ к камере не разрешён. Разрешите камеру в настройках браузера или выберите файл.'
            : 'Камера недоступна на этом устройстве. Выберите файл из галереи.'}
        </p>
        <button type="button" className="btn-primary" onClick={cancel}>
          Выбрать файл
        </button>
      </div>
    )
  }

  const recording = status === 'recording'

  return (
    <div className="lenta-cam">
      <div className="lenta-cam-stage">
        <video ref={videoRef} autoPlay muted playsInline />
        {recording && (
          <span className="lenta-cam-timer" aria-live="polite">
            ● {seconds}с / {CLIENT_MAX_VIDEO_SEC}с
          </span>
        )}
        {!recording && (
          <button
            type="button"
            className="lenta-cam-flip"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            aria-label="Переключить камеру"
          >
            ⟳
          </button>
        )}
      </div>

      {!recording && (
        <div className="lenta-cam-modes" role="group" aria-label="Камера">
          <button
            type="button"
            className={`lenta-chip${mode === 'photo' ? ' is-active' : ''}`}
            aria-pressed={mode === 'photo'}
            onClick={() => setMode('photo')}
          >
            Фото
          </button>
          {HAS_RECORDER && (
            <button
              type="button"
              className={`lenta-chip${mode === 'video' ? ' is-active' : ''}`}
              aria-pressed={mode === 'video'}
              onClick={() => setMode('video')}
            >
              Видео
            </button>
          )}
        </div>
      )}

      <div className="lenta-cam-controls">
        {mode === 'photo' ? (
          <button
            type="button"
            className="lenta-cam-shutter"
            onClick={snapPhoto}
            disabled={status !== 'live'}
            aria-label="Сделать снимок"
          >
            ◉
          </button>
        ) : recording ? (
          <button type="button" className="lenta-cam-shutter is-rec" onClick={stopRec} aria-label="Остановить запись">
            ■
          </button>
        ) : (
          <button
            type="button"
            className="lenta-cam-shutter is-video"
            onClick={startRec}
            disabled={status !== 'live'}
            aria-label="Начать запись"
          >
            ●
          </button>
        )}
        {!recording && (
          <button type="button" className="lenta-cam-cancel" onClick={cancel}>
            Отмена
          </button>
        )}
      </div>
    </div>
  )
}

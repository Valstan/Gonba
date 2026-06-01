'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { ProjectRecord } from './projects/shared'
import { CardSize, Plate, projectHref, projectLabel } from './projects/PlateCard'
import { EditProjectDialog } from './EditProjectDialog'
import { fetchMe, isAdminUser } from '@/utilities/me'

type Props = {
  initialProjects: ProjectRecord[]
  centerSlug?: string
}

function ViewCard({ project, size }: { project: ProjectRecord; size: CardSize }) {
  const isHero = size === 'hero'
  return (
    <Link
      href={projectHref(project)}
      prefetch={false}
      aria-label={projectLabel(project)}
      className={[
        'group relative isolate flex overflow-hidden rounded-3xl shadow-lg ring-1 ring-white/10',
        'transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-2xl active:translate-y-0 active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
        isHero ? 'min-h-[220px] sm:min-h-[260px] md:col-span-2 lg:col-span-3' : 'min-h-[180px]',
      ].join(' ')}
    >
      <Plate project={project} size={size} />
    </Link>
  )
}

function SortableEditCard({
  project,
  size,
  onEdit,
}: {
  project: ProjectRecord
  size: CardSize
  onEdit: (p: ProjectRecord) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(project.id) })
  const isHero = size === 'hero'
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group relative isolate overflow-hidden rounded-3xl shadow-lg ring-2 ring-yellow-400/60',
        isHero ? 'min-h-[220px] sm:min-h-[260px] md:col-span-2 lg:col-span-3' : 'min-h-[180px]',
      ].join(' ')}
    >
      <Plate project={project} size={size} />

      {/* Кнопка-карандаш */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onEdit(project)
        }}
        className="absolute right-2 top-2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg ring-1 ring-black/10 hover:bg-yellow-200"
        aria-label="Редактировать плашку"
        title="Редактировать"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-20 inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-full bg-white text-black shadow-lg ring-1 ring-black/10 active:cursor-grabbing hover:bg-yellow-200"
        aria-label="Перетащить"
        title="Перетащите чтобы поменять порядок"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="6" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="18" r="1" />
          <circle cx="15" cy="6" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="18" r="1" />
        </svg>
      </button>
    </div>
  )
}

export const EditableProjectsGrid: React.FC<Props> = ({ initialProjects, centerSlug = 'gonba' }) => {
  const [projects, setProjects] = useState<ProjectRecord[]>(initialProjects)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  // Проверка роли пользователя один раз при загрузке
  useEffect(() => {
    let cancelled = false
    fetchMe().then((u) => {
      if (!cancelled) setIsAdmin(isAdminUser(u))
    })
    return () => {
      cancelled = false
    }
  }, [])

  const center = projects.find((p) => p.slug === centerSlug) ?? null
  const others = useMemo(() => projects.filter((p) => p.slug !== center?.slug), [projects, center])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const persistOrder = useCallback(async (ordered: ProjectRecord[]) => {
    setSavingOrder(true)
    setOrderError(null)
    try {
      // Шаг sortOrder = 10, начиная с 10. Так у каждого проекта будет уникальное значение.
      const updates = ordered.map((p, idx) => ({ id: p.id, sortOrder: (idx + 1) * 10 }))
      await Promise.all(
        updates.map((u) =>
          fetch(`/api/projects/${u.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortOrder: u.sortOrder }),
          }).then(async (res) => {
            if (!res.ok) {
              const txt = await res.text().catch(() => '')
              throw new Error(`PATCH ${u.id} ${res.status}: ${txt.slice(0, 120)}`)
            }
          }),
        ),
      )
    } catch (e) {
      setOrderError(String((e as Error).message || e))
    } finally {
      setSavingOrder(false)
    }
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = others.findIndex((p) => String(p.id) === active.id)
    const newIndex = others.findIndex((p) => String(p.id) === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const newOthers = arrayMove(others, oldIndex, newIndex)
    // Собираем общий список: центральный остаётся первым в массиве, чтобы порядок в БД был стабильным.
    const newProjects = center ? [center, ...newOthers] : newOthers
    setProjects(newProjects)
    void persistOrder(newProjects)
  }

  const editingProject = editingId != null ? projects.find((p) => p.id === editingId) ?? null : null

  const handleSaved = (updates: Partial<ProjectRecord>) => {
    if (editingId == null) return
    setProjects((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...updates } : p)))
  }

  // ===== Рендер =====

  if (!editMode) {
    // Обычный просмотр
    return (
      <div>
        {isAdmin ? (
          <div className="mb-4 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Редактировать плашки
            </button>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {center ? <ViewCard key={center.id} project={center} size="hero" /> : null}
          {others.map((p) => (
            <ViewCard key={p.id} project={p} size="normal" />
          ))}
        </div>
      </div>
    )
  }

  // Режим правки
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-400/50 bg-yellow-50 p-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-yellow-900">!</span>
          <span className="font-medium">Режим правки плашек.</span>
          <span className="text-muted-foreground">Перетаскивайте за «⋮⋮», нажимайте «✎» чтобы изменить.</span>
        </div>
        <div className="flex items-center gap-2">
          {savingOrder ? <span className="text-xs text-muted-foreground">Сохраняем порядок…</span> : null}
          {orderError ? <span className="text-xs text-destructive">{orderError}</span> : null}
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent"
          >
            Выйти из правки
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {center ? (
          // Центральный проект редактируется (✎), но не перетаскивается (зафиксирован сверху)
          <div className="md:col-span-2 lg:col-span-3">
            <FixedHeroEditCard project={center} onEdit={(p) => setEditingId(p.id)} />
          </div>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={others.map((p) => String(p.id))} strategy={rectSortingStrategy}>
            {others.map((p) => (
              <SortableEditCard key={p.id} project={p} size="normal" onEdit={(pr) => setEditingId(pr.id)} />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <EditProjectDialog
        open={editingId != null}
        project={editingProject}
        onClose={() => setEditingId(null)}
        onSaved={handleSaved}
      />
    </div>
  )
}

function FixedHeroEditCard({ project, onEdit }: { project: ProjectRecord; onEdit: (p: ProjectRecord) => void }) {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl shadow-lg ring-2 ring-yellow-400/60 min-h-[220px] sm:min-h-[260px]">
      <Plate project={project} size="hero" />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onEdit(project)
        }}
        className="absolute right-2 top-2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg ring-1 ring-black/10 hover:bg-yellow-200"
        aria-label="Редактировать плашку"
        title="Редактировать"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </div>
  )
}

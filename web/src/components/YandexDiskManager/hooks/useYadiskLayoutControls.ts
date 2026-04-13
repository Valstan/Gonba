'use client'

import React, { useEffect, useRef, useState } from 'react'

export type ViewMode = 'table' | 'list' | 'preview'
export type PreviewSize = 'sm' | 'md' | 'lg'
export type SortField = 'name' | 'created' | 'size' | 'type'
export type SortDirection = 'asc' | 'desc'

const clampSidebar = (value: number) => Math.min(520, Math.max(240, value))

export const useYadiskLayoutControls = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [previewSize, setPreviewSize] = useState<PreviewSize>('md')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [sidebarWidth, setSidebarWidth] = useState(300)

  const sidebarWidthRef = useRef(sidebarWidth)

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  useEffect(() => {
    const saved = window.localStorage.getItem('yadisk:view')
    if (saved === 'table' || saved === 'list' || saved === 'preview') {
      setViewMode(saved)
    }

    const savedPreviewSize = window.localStorage.getItem('yadisk:preview-size')
    if (savedPreviewSize === 'sm' || savedPreviewSize === 'md' || savedPreviewSize === 'lg') {
      setPreviewSize(savedPreviewSize)
    }

    const savedSidebarWidth = Number(window.localStorage.getItem('yadisk:sidebar-width') || 300)
    if (Number.isFinite(savedSidebarWidth)) {
      setSidebarWidth(clampSidebar(savedSidebarWidth))
    }

    const savedSortField = window.localStorage.getItem('yadisk:sort-field')
    if (savedSortField === 'name' || savedSortField === 'created' || savedSortField === 'size' || savedSortField === 'type') {
      setSortField(savedSortField)
    }

    const savedSortDirection = window.localStorage.getItem('yadisk:sort-direction')
    if (savedSortDirection === 'asc' || savedSortDirection === 'desc') {
      setSortDirection(savedSortDirection)
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem('yadisk:view', viewMode)
  }, [viewMode])

  useEffect(() => {
    window.localStorage.setItem('yadisk:preview-size', previewSize)
  }, [previewSize])

  useEffect(() => {
    window.localStorage.setItem('yadisk:sort-field', sortField)
  }, [sortField])

  useEffect(() => {
    window.localStorage.setItem('yadisk:sort-direction', sortDirection)
  }, [sortDirection])

  const startSidebarResize = (event: React.MouseEvent<HTMLDivElement>) => {
    if (window.innerWidth < 980) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = sidebarWidthRef.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      setSidebarWidth(clampSidebar(startWidth + delta))
    }

    const onMouseUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.localStorage.setItem('yadisk:sidebar-width', String(sidebarWidthRef.current))
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return {
    viewMode,
    setViewMode,
    previewSize,
    setPreviewSize,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    sidebarWidth,
    setSidebarWidth,
    startSidebarResize,
  }
}

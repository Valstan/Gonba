'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type AdminMode = 'view' | 'manage'

type AdminModeContextValue = {
  isAdmin: boolean
  mode: AdminMode
  setMode: (mode: AdminMode) => void
  setIsAdmin: (value: boolean) => void
}

const STORAGE_KEY = 'admin-mode'

const AdminModeContext = createContext<AdminModeContextValue | null>(null)

export const AdminModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdminState] = useState(false)
  const [mode, setModeState] = useState<AdminMode>('view')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'view' || stored === 'manage') {
      setModeState(stored)
    }
  }, [])

  const setMode = useCallback((nextMode: AdminMode) => {
    setModeState(nextMode)
    window.localStorage.setItem(STORAGE_KEY, nextMode)
  }, [])

  const setIsAdmin = useCallback((value: boolean) => {
    setIsAdminState(value)

    if (!value) {
      setModeState('view')
      window.localStorage.setItem(STORAGE_KEY, 'view')
    }
  }, [])

  const value = useMemo(
    () => ({
      isAdmin,
      mode,
      setMode,
      setIsAdmin,
    }),
    [isAdmin, mode, setIsAdmin, setMode],
  )

  return <AdminModeContext.Provider value={value}>{children}</AdminModeContext.Provider>
}

export const useAdminMode = () => {
  const context = useContext(AdminModeContext)

  if (!context) {
    throw new Error('useAdminMode must be used within an AdminModeProvider')
  }

  return context
}

'use client'

import React, { createContext, useContext } from 'react'

import type { ProjectRecord, ProjectSectionKey } from '@/app/(frontend)/projects/shared'

type ProjectContextValue = {
  project: ProjectRecord | null
  enabledSections: ProjectSectionKey[]
}

const defaultValue: ProjectContextValue = {
  project: null,
  enabledSections: [],
}

const ProjectContext = createContext<ProjectContextValue>(defaultValue)

export const ProjectProvider: React.FC<{ project: ProjectRecord; children: React.ReactNode }> = ({ project, children }) => {
  const enabledSections = Array.isArray(project.enabledSections) ? project.enabledSections.filter(Boolean) : []

  return <ProjectContext value={{ project, enabledSections }}>{children}</ProjectContext>
}

export const useProjectContext = (): ProjectContextValue => {
  return useContext(ProjectContext)
}

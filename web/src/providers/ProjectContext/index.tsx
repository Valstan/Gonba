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

type ProjectProviderProps = {
  project: ProjectRecord
  enabledSections?: ProjectSectionKey[]
  children: React.ReactNode
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ project, enabledSections, children }) => {
  // Если явно передан нормализованный список — используем его.
  // Иначе фильтруем raw-значение (с потерей legacy ключей, но это деградация).
  const finalSections: ProjectSectionKey[] = enabledSections ??
    (Array.isArray(project.enabledSections)
      ? (project.enabledSections.filter((item): item is ProjectSectionKey =>
          typeof item === 'string' && ['feed', 'lavka', 'gallery', 'contacts', 'chat'].includes(item),
        ) as ProjectSectionKey[])
      : [])

  return <ProjectContext value={{ project, enabledSections: finalSections }}>{children}</ProjectContext>
}

export const useProjectContext = (): ProjectContextValue => {
  return useContext(ProjectContext)
}

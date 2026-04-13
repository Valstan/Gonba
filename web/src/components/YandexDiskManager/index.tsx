'use client'

import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo, useRef, useState } from 'react'

import { ActionToolbar } from './components/ActionToolbar'
import { Breadcrumbs } from './components/Breadcrumbs'
import { CloudTitlebar } from './components/CloudTitlebar'
import { SidebarPanel } from './components/SidebarPanel'
import { ViewToolbar } from './components/ViewToolbar'
import { useYadiskLayoutControls } from './hooks/useYadiskLayoutControls'
import './index.scss'

type DiskItem = {
  name: string
  path: string
  type: 'dir' | 'file'
  preview?: string
  size?: number
  mime_type?: string
  created?: string
  modified?: string
}

type DiskResponse = {
  _embedded?: {
    items?: DiskItem[]
  }
}

type TransferTaskType = 'upload' | 'download' | 'move' | 'copy' | 'delete'
type TransferTaskStatus = 'running' | 'done' | 'error'

type TransferTask = {
  id: string
  type: TransferTaskType
  status: TransferTaskStatus
  totalFiles: number
  processedFiles: number
  totalBytes?: number
  processedBytes?: number
  currentFile?: string
  errors?: string[]
}

type UploadBehavior = 'overwrite' | 'skip'

type UsageEntry = {
  collection: string
  id: string | number
  title?: string
  slug?: string
  adminUrl: string
  frontendUrl?: string
}

type TreeNode = {
  path: string
  name: string
  children: string[]
  expanded: boolean
  loaded: boolean
  loading: boolean
}

const YADISK_ROUTES = {
  listActions: '/yadisk-api',
  upload: '/yadisk-api/upload',
  download: '/yadisk-api/download',
  preview: '/yadisk-api/preview',
  usage: '/yadisk-api/usage',
} as const

const getPreviewUrl = (path: string) => `${YADISK_ROUTES.preview}?path=${encodeURIComponent(path)}`

const getNameFromPath = (path: string) => {
  if (!path) return ''
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] || ''
}

const getParentPath = (value: string) => {
  if (!value || value === '/') return '/'
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return '/'
  return normalized.slice(0, idx)
}

const splitPath = (path: string) => {
  const parts = path.split('/').filter(Boolean)
  const crumbs = ['']
  let current = ''
  for (const part of parts) {
    current = `${current}/${part}`
    crumbs.push(current)
  }
  return crumbs
}

const getExtension = (name: string) => {
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return ''
  return name.slice(idx + 1).toLowerCase()
}

const joinDiskPath = (folderPath: string, filename: string) => {
  const cleanFolder = folderPath.endsWith('/') && folderPath !== '/' ? folderPath.slice(0, -1) : folderPath
  if (!cleanFolder || cleanFolder === '/') return `/${filename}`
  return `${cleanFolder}/${filename}`
}

const formatSize = (size?: number) => {
  if (size === undefined || size === null) return '—'
  if (size < 1024) return `${size} Б`
  const kb = size / 1024
  if (kb < 1024) return `${kb.toFixed(1)} КБ`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} МБ`
  return `${(mb / 1024).toFixed(1)} ГБ`
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

const getCategory = (item: DiskItem) => {
  if (item.type === 'dir') return 'folder'
  const ext = getExtension(item.name)
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return 'audio'
  if (['pdf'].includes(ext)) return 'pdf'
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'doc'
  if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return 'sheet'
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'slide'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
  if (['txt', 'md', 'log'].includes(ext)) return 'text'
  if (['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'scss', 'json', 'xml', 'yml'].includes(ext))
    return 'code'
  return 'other'
}

const intersectsRect = (
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top

export const YandexDiskManager: React.FC = () => {
  const searchParams = useSearchParams()
  const pickerMode = searchParams.get('picker') === '1'
  const pickerImagesOnly = searchParams.get('type') === 'image'
  const [path, setPath] = useState('/')
  const [items, setItems] = useState<DiskItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragPath, setDragPath] = useState<string | null>(null)
  const {
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
  } = useYadiskLayoutControls()
  const [tasks, setTasks] = useState<TransferTask[]>([])
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [usageByPath, setUsageByPath] = useState<Record<string, UsageEntry[]>>({})
  const [usageLoading, setUsageLoading] = useState(false)
  const [imageViewer, setImageViewer] = useState<{ paths: string[]; index: number } | null>(null)
  const [viewerMenuOpen, setViewerMenuOpen] = useState(false)
  const [uploadReport, setUploadReport] = useState<{
    taskId: string
    targetPath: string
    successful: string[]
    skipped: Array<{ name: string; reason: string }>
    failed: Array<{ name: string; error: string }>
  } | null>(null)
  const [uploadBehavior, setUploadBehavior] = useState<UploadBehavior>('skip')
  const [treeNodes, setTreeNodes] = useState<Record<string, TreeNode>>({
    '/': {
      path: '/',
      name: 'Корень',
      children: [],
      expanded: true,
      loaded: false,
      loading: false,
    },
    '/.trash': {
      path: '/.trash',
      name: 'Корзина',
      children: [],
      expanded: true,
      loaded: false,
      loading: false,
    },
  })
  const [dropMenu, setDropMenu] = useState<{
    x: number
    y: number
    targetPath: string
    items: string[]
  } | null>(null)
  const [trashWarning, setTrashWarning] = useState<{
    items: string[]
    usages: UsageEntry[]
    loading: boolean
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    item?: DiskItem
  } | null>(null)
  const [selectionBox, setSelectionBox] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const taskSequence = useRef(0)
  const tasksCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const treeNodesRef = useRef(treeNodes)
  const usageCacheRef = useRef<Record<string, UsageEntry[]>>({})
  const uploadAnyInputRef = useRef<HTMLInputElement | null>(null)
  const uploadImageInputRef = useRef<HTMLInputElement | null>(null)
  const previewGridRef = useRef<HTMLDivElement | null>(null)
  const selectionSessionRef = useRef<{
    startX: number
    startY: number
    moved: boolean
    additive: boolean
    baseSelection: Set<string>
  } | null>(null)

  const parseJSON = useCallback(async <T,>(res: Response): Promise<T | null> => {
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text) as T
    } catch {
      return null
    }
  }, [])

  const fetchFolderItems = useCallback(
    async (nextPath: string) => {
      let res: Response
      try {
        res = await fetch(`${YADISK_ROUTES.listActions}?path=${encodeURIComponent(nextPath)}`, {
          cache: 'no-store',
        })
      } catch {
        throw new Error('Ошибка сети: не удалось подключиться к серверу')
      }
      const json = (await parseJSON<{ data?: DiskResponse; error?: string }>(res)) || null
      if (!json) {
        throw new Error(`Ошибка сервера (${res.status})`)
      }
      if (!res.ok || json.error) {
        throw new Error(json.error || `Ошибка сервера (${res.status})`)
      }
      return json.data?._embedded?.items || []
    },
    [parseJSON],
  )

  const createTaskId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    taskSequence.current += 1
    return `task-${Date.now()}-${taskSequence.current}`
  }

  const startTask = (task: Omit<TransferTask, 'id' | 'status' | 'processedFiles'> & { processedFiles?: number }) => {
    const id = createTaskId()
    setTasks((prev) => [
      ...prev,
      {
        id,
        status: 'running',
        processedFiles: task.processedFiles ?? 0,
        ...task,
      },
    ])
    return id
  }

  const updateTask = (id: string, updater: (task: TransferTask) => TransferTask) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? updater(task) : task)))
  }

  const bumpTaskBytes = (id: string, delta: number) => {
    updateTask(id, (task) => {
      const nextBytes = Math.max(0, (task.processedBytes || 0) + delta)
      return {
        ...task,
        processedBytes: nextBytes,
      }
    })
  }

  const addTaskError = (id: string, message: string) => {
    updateTask(id, (task) => ({
      ...task,
      status: 'error',
      errors: [...(task.errors || []), message],
    }))
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const waitForOnline = async () => {
    if (navigator.onLine) return
    await new Promise<void>((resolve) => {
      const handleOnline = () => {
        window.removeEventListener('online', handleOnline)
        resolve()
      }
      window.addEventListener('online', handleOnline)
    })
  }

  const requestDownloadUrl = useCallback(async (filePath: string) => {
    const downloadRes = await fetch(YADISK_ROUTES.download, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    })
    const downloadJson =
      (await parseJSON<{ data?: { href?: string }; error?: string }>(downloadRes)) || null
    if (!downloadJson) {
      throw new Error(`Ошибка сервера (${downloadRes.status})`)
    }
    if (!downloadRes.ok || downloadJson.error) {
      throw new Error(downloadJson.error || `Ошибка сервера (${downloadRes.status})`)
    }
    const href = downloadJson.data?.href
    if (!href) {
      throw new Error('Не удалось получить ссылку скачивания')
    }
    return href
  }, [parseJSON])

  const requestUploadUrl = useCallback(
    async (folderPath: string, filename: string, overwrite: boolean) => {
    const uploadRes = await fetch(YADISK_ROUTES.upload, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath, filename, overwrite: overwrite ? '1' : '0' }),
      })
      const uploadJson =
        (await parseJSON<{ data?: { href?: string }; error?: string; code?: string }>(uploadRes)) || null
      if (!uploadJson) {
        throw Object.assign(new Error(`Ошибка сервера (${uploadRes.status})`), { status: uploadRes.status })
      }
      if (!uploadRes.ok || uploadJson.error) {
        throw Object.assign(new Error(uploadJson.error || `Ошибка сервера (${uploadRes.status})`), {
          status: uploadRes.status,
          code: uploadJson.code,
        })
      }
      const href = uploadJson.data?.href
      if (!href) {
        throw Object.assign(new Error('Не удалось получить ссылку загрузки'), { status: uploadRes.status })
      }
      return href
    },
    [parseJSON],
  )

  const requestUsageCheck = useCallback(async (paths: string[]) => {
    const res = await fetch(YADISK_ROUTES.usage, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    })
    const json = (await parseJSON<{ usages?: UsageEntry[]; error?: string }>(res)) || null
    if (!json) {
      throw new Error(`Ошибка сервера (${res.status})`)
    }
    if (!res.ok || json.error) {
      throw new Error(json.error || `Ошибка сервера (${res.status})`)
    }
    return json.usages || []
  }, [parseJSON])

  const requestUsageBatch = useCallback(
    async (itemPaths: string[]) => {
      const missing = itemPaths.filter((itemPath) => !usageCacheRef.current[itemPath])
      if (missing.length === 0) return
      const entries: Array<[string, UsageEntry[]]> = await Promise.all(
        missing.map(async (itemPath) => {
          try {
            const usages = await requestUsageCheck([itemPath])
            return [itemPath, usages]
          } catch {
            return [itemPath, []]
          }
        }),
      )
      setUsageByPath((prev) => {
        const next = { ...prev }
        for (const [itemPath, usages] of entries) {
          if (!next[itemPath]) {
            next[itemPath] = usages
          }
        }
        return next
      })
    },
    [requestUsageCheck],
  )

  const ensureTreeNode = useCallback((nodePath: string, name?: string) => {
    setTreeNodes((prev) => {
      if (prev[nodePath]) return prev
      return {
        ...prev,
        [nodePath]: {
          path: nodePath,
          name: name || (nodePath === '/' ? 'Корень' : getNameFromPath(nodePath)),
          children: [],
          expanded: true,
          loaded: false,
          loading: false,
        },
      }
    })
  }, [])

  const loadFolderChildren = useCallback(
    async (nodePath: string) => {
      setTreeNodes((prev) => ({
        ...prev,
        [nodePath]: {
          ...(prev[nodePath] || {
            path: nodePath,
            name: nodePath === '/' ? 'Корень' : getNameFromPath(nodePath),
            children: [],
            expanded: true,
            loaded: false,
          }),
          loading: true,
        },
      }))
      try {
        const items = await fetchFolderItems(nodePath)
        setRuntimeError(null)
        const folders = items.filter((item) => item.type === 'dir')
        const nextFolderPaths = folders.map((folder) => folder.path)
        if (nodePath === '/' && !nextFolderPaths.includes('/.trash')) {
          nextFolderPaths.push('/.trash')
          folders.push({
            name: 'Корзина',
            path: '/.trash',
            type: 'dir',
          })
        }
        setTreeNodes((prev) => {
          const next: Record<string, TreeNode> = { ...prev }
          for (const folder of folders) {
            if (!next[folder.path]) {
              next[folder.path] = {
                path: folder.path,
                name: folder.name,
                children: [],
                expanded: true,
                loaded: false,
                loading: false,
              }
            }
          }
          next[nodePath] = {
            ...(next[nodePath] || {
              path: nodePath,
              name: nodePath === '/' ? 'Корень' : getNameFromPath(nodePath),
            }),
            children: nextFolderPaths,
            loaded: true,
            loading: false,
          } as TreeNode
          return next
        })
        for (const childPath of nextFolderPaths) {
          const childNode = treeNodesRef.current[childPath]
          if (!childNode || (!childNode.loaded && !childNode.loading && childNode.expanded !== false)) {
            void loadFolderChildren(childPath)
          }
        }
      } catch (error) {
        setTreeNodes((prev) => ({
          ...prev,
          [nodePath]: {
            ...(prev[nodePath] || {
              path: nodePath,
              name: nodePath === '/' ? 'Корень' : getNameFromPath(nodePath),
              children: [],
              expanded: true,
              loaded: false,
            }),
            loading: false,
          },
        }))
        setRuntimeError((error as Error).message)
      }
    },
    [fetchFolderItems],
  )

  const expandTreeToPath = useCallback(
    async (targetPath: string) => {
      const crumbs = splitPath(targetPath)
      for (const crumb of crumbs) {
        ensureTreeNode(crumb)
        setTreeNodes((prev) => {
          if (prev[crumb]?.expanded) return prev
          return {
            ...prev,
            [crumb]: {
              ...(prev[crumb] || {
                path: crumb,
                name: crumb === '/' ? 'Корень' : getNameFromPath(crumb),
                children: [],
                loaded: false,
                loading: false,
              }),
              expanded: true,
            },
          }
        })
        const current = treeNodesRef.current[crumb]
        if (!current?.loaded && !current?.loading) {
          await loadFolderChildren(crumb)
        }
      }
    },
    [ensureTreeNode, loadFolderChildren],
  )

  const breadcrumbs = useMemo(() => splitPath(path), [path])
  const itemsByPath = useMemo(() => new Map(items.map((item) => [item.path, item])), [items])
  const sortedItems = useMemo(() => {
    const compareNames = (a: string, b: string) => a.localeCompare(b, 'ru')
    const compareNullableNumbers = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0
      if (a === null) return 1
      if (b === null) return -1
      return a - b
    }

    return [...items].sort((a, b) => {
      let result = 0

      switch (sortField) {
        case 'created': {
          const timeA = a.created ? new Date(a.created).getTime() : null
          const timeB = b.created ? new Date(b.created).getTime() : null
          const safeA = Number.isFinite(timeA as number) ? (timeA as number) : null
          const safeB = Number.isFinite(timeB as number) ? (timeB as number) : null
          result = compareNullableNumbers(safeA, safeB)
          break
        }
        case 'size': {
          const sizeA = a.type === 'file' && typeof a.size === 'number' ? a.size : null
          const sizeB = b.type === 'file' && typeof b.size === 'number' ? b.size : null
          result = compareNullableNumbers(sizeA, sizeB)
          break
        }
        case 'type': {
          const typeA = a.type === 'dir' ? 'folder' : getCategory(a)
          const typeB = b.type === 'dir' ? 'folder' : getCategory(b)
          result = compareNames(typeA, typeB)
          break
        }
        case 'name':
        default:
          result = compareNames(a.name, b.name)
      }

      if (result === 0) {
        // Always keep deterministic ordering for identical keys.
        result = compareNames(a.name, b.name)
      }

      return sortDirection === 'asc' ? result : -result
    })
  }, [items, sortDirection, sortField])
  const filePaths = useMemo(
    () => sortedItems.filter((item) => item.type === 'file').map((item) => item.path),
    [sortedItems],
  )
  const imageItems = useMemo(
    () => sortedItems.filter((item) => item.type === 'file' && getCategory(item) === 'image'),
    [sortedItems],
  )
  const viewerCurrentPath = imageViewer ? imageViewer.paths[imageViewer.index] : null
  const viewerCurrentItem = viewerCurrentPath ? itemsByPath.get(viewerCurrentPath) : undefined
  const viewerCurrentSrc = viewerCurrentPath ? getPreviewUrl(viewerCurrentPath) : ''
  const shiftViewer = useCallback((direction: -1 | 1) => {
    setImageViewer((prev) => {
      if (!prev || prev.paths.length === 0) return prev
      const nextIndex = (prev.index + direction + prev.paths.length) % prev.paths.length
      return { ...prev, index: nextIndex }
    })
    setViewerMenuOpen(false)
  }, [])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
  }, [])

  const selectAllFiles = useCallback(() => {
    setSelected(new Set(filePaths))
  }, [filePaths])

  React.useEffect(() => {
    void loadFolderChildren('/')
  }, [loadFolderChildren])

  React.useEffect(() => {
    treeNodesRef.current = treeNodes
  }, [treeNodes])

  React.useEffect(() => {
    usageCacheRef.current = usageByPath
  }, [usageByPath])

  React.useEffect(() => {
    return () => {
      document.body.style.userSelect = ''
    }
  }, [])

  React.useEffect(() => {
    if (tasks.length === 0) {
      if (tasksCloseTimerRef.current) {
        clearTimeout(tasksCloseTimerRef.current)
        tasksCloseTimerRef.current = null
      }
      return
    }

    const hasRunning = tasks.some((task) => task.status === 'running')
    if (hasRunning) {
      if (tasksCloseTimerRef.current) {
        clearTimeout(tasksCloseTimerRef.current)
        tasksCloseTimerRef.current = null
      }
      return
    }

    if (uploadReport && tasks.some((task) => task.id === uploadReport.taskId)) {
      return
    }

    tasksCloseTimerRef.current = setTimeout(() => {
      setTasks([])
      tasksCloseTimerRef.current = null
    }, 1800)

    return () => {
      if (tasksCloseTimerRef.current) {
        clearTimeout(tasksCloseTimerRef.current)
        tasksCloseTimerRef.current = null
      }
    }
  }, [tasks, uploadReport])

  const fetchList = useCallback(
    async (nextPath: string) => {
      setLoading(true)
      try {
        const nextItems = await fetchFolderItems(nextPath)
        setRuntimeError(null)
        const nextWithPreview = nextItems.map((item) => {
          if (!item.preview) return item
          return {
            ...item,
            preview: getPreviewUrl(item.path),
          }
        })
        setItems(nextWithPreview)
      } catch (error) {
        setRuntimeError((error as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [fetchFolderItems],
  )

  const postAction = useCallback(async (payload: Record<string, string | boolean | number>) => {
    const res = await fetch(YADISK_ROUTES.listActions, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await parseJSON<{ error?: string }>(res)) || null
    if (!json) {
      throw new Error(`Ошибка сервера (${res.status})`)
    }
    if (!res.ok || json.error) {
      throw new Error(json.error || `Ошибка сервера (${res.status})`)
    }
  }, [parseJSON])

  const uploadWithProgress = async (file: File, href: string, taskId: string) => {
    let uploadedInAttempt = 0
    const finishAttempt = async () => {
      if (uploadedInAttempt > 0) {
        bumpTaskBytes(taskId, -uploadedInAttempt)
      }
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', href, true)
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return
          const delta = event.loaded - uploadedInAttempt
          if (delta > 0) {
            bumpTaskBytes(taskId, delta)
            uploadedInAttempt = event.loaded
          }
        }
        xhr.onerror = () => reject(new Error('Ошибка сети при загрузке файла'))
        xhr.onabort = () => reject(new Error('Загрузка файла прервана'))
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            if (uploadedInAttempt < file.size) {
              const tail = file.size - uploadedInAttempt
              if (tail > 0) {
                bumpTaskBytes(taskId, tail)
                uploadedInAttempt = file.size
              }
            }
            resolve()
            return
          }
          reject(new Error(`Ошибка загрузки (${xhr.status})`))
        }
        xhr.send(file)
      })
    } catch (error) {
      await finishAttempt()
      throw error
    }
  }

  const uploadFileWithRetry = async (
    file: File,
    targetPath: string,
    taskId: string,
    behavior: UploadBehavior,
  ) => {
    const retryDelays = [1200, 2500, 5000]
    let attempt = 0
    while (attempt < 3) {
      try {
        await waitForOnline()
        const href = await requestUploadUrl(targetPath, file.name, behavior === 'overwrite')
        await uploadWithProgress(file, href, taskId)
        const uploadedPath = joinDiskPath(targetPath, file.name)
        // Verify file presence on Yandex after PUT to avoid false "success" reports.
        let verified = false
        for (let verifyAttempt = 0; verifyAttempt < 5; verifyAttempt += 1) {
          try {
            await requestDownloadUrl(uploadedPath)
            verified = true
            break
          } catch {
            await sleep(600 * (verifyAttempt + 1))
          }
        }
        if (!verified) {
          throw new Error(`Файл не найден после загрузки: ${uploadedPath}`)
        }
        return
      } catch (error) {
        const maybeCode = (error as { code?: string })?.code
        const maybeStatus = (error as { status?: number })?.status
        const conflictCode =
          maybeCode === 'DiskPathPointsToExistentFileError' || maybeCode === 'DiskPathPointsToExistentDirectoryError'
        if (behavior === 'skip' && (conflictCode || maybeStatus === 409)) {
          throw Object.assign(new Error('Файл уже существует, пропущен'), { code: 'SKIPPED_EXISTING' })
        }
        attempt += 1
        if (attempt >= 3) {
          throw error
        }
        await waitForOnline()
        await sleep(retryDelays[attempt - 1] || 5000)
      }
    }
  }

  const isImageFile = (file: File) =>
    file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|avif)$/i.test(file.name)

  const uploadFiles = async (files: File[], mode: 'all' | 'images') => {
    if (files.length === 0) return

    const prepared = mode === 'images' ? files.filter(isImageFile) : files
    if (prepared.length === 0) {
      setRuntimeError('Не выбрано ни одного графического файла')
      return
    }

    const targetPath = path
    const totalBytes = prepared.reduce((sum, file) => sum + file.size, 0)
    const taskId = startTask({
      type: 'upload',
      totalFiles: prepared.length,
      totalBytes,
      processedBytes: 0,
    })

    const successful: string[] = []
    const skipped: Array<{ name: string; reason: string }> = []
    const failed: Array<{ name: string; error: string }> = []

    for (const file of prepared) {
      updateTask(taskId, (task) => ({
        ...task,
        currentFile: file.name,
      }))
      try {
        await uploadFileWithRetry(file, targetPath, taskId, uploadBehavior)
        successful.push(file.name)
      } catch (error) {
        const skipCode = (error as { code?: string })?.code
        if (skipCode === 'SKIPPED_EXISTING') {
          skipped.push({ name: file.name, reason: 'Файл с таким именем уже существует в папке' })
          continue
        }
        const message = (error as Error).message
        failed.push({ name: file.name, error: message })
        addTaskError(taskId, `${file.name}: ${message}`)
      } finally {
        updateTask(taskId, (task) => ({
          ...task,
          processedFiles: task.processedFiles + 1,
        }))
      }
    }

    updateTask(taskId, (task) => ({
      ...task,
      status: failed.length > 0 ? 'error' : 'done',
      currentFile: undefined,
    }))

    setUploadReport({
      taskId,
      targetPath,
      successful,
      skipped,
      failed,
    })

    await fetchList(targetPath)
    void loadFolderChildren(targetPath)
  }

  const downloadFileWithRetry = async (item: DiskItem, taskId: string) => {
    let attempt = 0
    let offset = 0
    const chunks: Uint8Array[] = []
    const totalSize = item.size

    while (true) {
      try {
        await waitForOnline()
        const href = await requestDownloadUrl(item.path)
        const headers: HeadersInit = {}
        if (offset > 0) {
          headers.Range = `bytes=${offset}-`
        }
        const res = await fetch(href, { headers })

        if (offset > 0 && res.status === 200) {
          if (offset > 0) {
            bumpTaskBytes(taskId, -offset)
          }
          chunks.length = 0
          offset = 0
        }

        if (!res.ok && res.status !== 206) {
          throw new Error(`Ошибка скачивания (${res.status})`)
        }

        if (!res.body) {
          throw new Error('Поток скачивания недоступен')
        }

        const reader = res.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            offset += value.length
            bumpTaskBytes(taskId, value.length)
          }
        }

        if (totalSize && offset < totalSize) {
          throw new Error('Соединение завершилось раньше времени')
        }

        const blob = new Blob(chunks)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = item.name
        link.click()
        URL.revokeObjectURL(url)
        return
      } catch (error) {
        attempt += 1
        if (attempt >= 4) {
          throw error
        }
        await waitForOnline()
        await sleep(1000 * 2 ** (attempt - 1))
      }
    }
  }

  const runPathTask = async (
    type: TransferTaskType,
    paths: string[],
    worker: (path: string) => Promise<void>,
  ) => {
    if (paths.length === 0) return
    const taskId = startTask({
      type,
      totalFiles: paths.length,
    })

    for (const itemPath of paths) {
      updateTask(taskId, (task) => ({
        ...task,
        currentFile: getNameFromPath(itemPath),
      }))
      try {
        let attempt = 0
        while (true) {
          try {
            await waitForOnline()
            await worker(itemPath)
            break
          } catch (error) {
            attempt += 1
            if (attempt >= 3) {
              throw error
            }
            await waitForOnline()
            await sleep(800 * 2 ** (attempt - 1))
          }
        }
      } catch (error) {
        addTaskError(taskId, (error as Error).message)
      } finally {
        updateTask(taskId, (task) => ({
          ...task,
          processedFiles: task.processedFiles + 1,
        }))
      }
    }

    updateTask(taskId, (task) => ({
      ...task,
      status: task.errors?.length ? 'error' : 'done',
      currentFile: undefined,
    }))
  }

  const openFolder = useCallback(
    async (nextPath: string) => {
      setPath(nextPath)
      setSelected(new Set())
      void expandTreeToPath(nextPath)
    },
    [expandTreeToPath],
  )

  const toggleTreeNode = useCallback(
    async (nodePath: string) => {
      const node = treeNodes[nodePath]
      const nextExpanded = !node?.expanded
      setTreeNodes((prev) => ({
        ...prev,
        [nodePath]: {
          ...(prev[nodePath] || {
            path: nodePath,
            name: nodePath === '/' ? 'Корень' : getNameFromPath(nodePath),
            children: [],
            loaded: false,
            loading: false,
          }),
          expanded: nextExpanded,
        },
      }))
      if (nextExpanded && !node?.loaded && !node?.loading) {
        await loadFolderChildren(nodePath)
      }
    },
    [loadFolderChildren, treeNodes],
  )

  React.useEffect(() => {
    fetchList(path)
    void expandTreeToPath(path)
  }, [fetchList, path, expandTreeToPath])

  React.useEffect(() => {
    const filePaths = items
      .filter((item) => item.type === 'file')
      .map((item) => item.path)
      .slice(0, 60)
      .filter((itemPath) => !usageCacheRef.current[itemPath])

    if (filePaths.length === 0) return

    let cancelled = false
    const run = async () => {
      setUsageLoading(true)
      const batchSize = 10
      for (let idx = 0; idx < filePaths.length; idx += batchSize) {
        if (cancelled) return
        const chunk = filePaths.slice(idx, idx + batchSize)
        await requestUsageBatch(chunk)
      }
      if (!cancelled) {
        setUsageLoading(false)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [items, requestUsageBatch])

  React.useEffect(() => {
    if (!imageViewer) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImageViewer(null)
        setViewerMenuOpen(false)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        shiftViewer(-1)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        shiftViewer(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [imageViewer, shiftViewer])

  const toggleSelection = (itemPath: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(itemPath)) {
        next.delete(itemPath)
      } else {
        next.add(itemPath)
      }
      return next
    })
  }

  const updatePreviewLasso = useCallback(
    (startX: number, startY: number, currentX: number, currentY: number, baseSelection: Set<string>) => {
      const grid = previewGridRef.current
      if (!grid) return

      const gridRect = grid.getBoundingClientRect()
      const lassoRect = {
        left: Math.min(startX, currentX),
        right: Math.max(startX, currentX),
        top: Math.min(startY, currentY),
        bottom: Math.max(startY, currentY),
      }

      setSelectionBox({
        left: lassoRect.left - gridRect.left,
        top: lassoRect.top - gridRect.top,
        width: lassoRect.right - lassoRect.left,
        height: lassoRect.bottom - lassoRect.top,
      })

      const nextSelected = new Set(baseSelection)
      const selectableCards = grid.querySelectorAll<HTMLElement>('[data-item-path]')
      for (const card of selectableCards) {
        const itemPath = card.dataset.itemPath
        if (!itemPath) continue
        const cardRect = card.getBoundingClientRect()
        const cardBounds = {
          left: cardRect.left,
          right: cardRect.right,
          top: cardRect.top,
          bottom: cardRect.bottom,
        }
        if (intersectsRect(lassoRect, cardBounds)) {
          nextSelected.add(itemPath)
        }
      }
      setSelected(nextSelected)
    },
    [],
  )

  const handlePreviewGridMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    const target = event.target as HTMLElement
    if (target.closest('button, input, a, label')) return
    event.preventDefault()

    const additive = event.ctrlKey || event.metaKey
    const baseSelection = additive ? new Set(selected) : new Set<string>()
    selectionSessionRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      additive,
      baseSelection,
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const session = selectionSessionRef.current
      if (!session) return
      const deltaX = Math.abs(moveEvent.clientX - session.startX)
      const deltaY = Math.abs(moveEvent.clientY - session.startY)
      if (!session.moved && deltaX < 4 && deltaY < 4) return
      if (!session.moved) {
        session.moved = true
        document.body.style.userSelect = 'none'
      }
      updatePreviewLasso(session.startX, session.startY, moveEvent.clientX, moveEvent.clientY, session.baseSelection)
    }

    const finish = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', finish)
      document.body.style.userSelect = ''
      selectionSessionRef.current = null
      setSelectionBox(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', finish)
  }

  const startDrag = (event: React.DragEvent, item: DiskItem) => {
    event.dataTransfer.setData('text/plain', item.path)
    setContextMenu(null)
    setDropMenu(null)
    setDragPath(item.path)
    setSelected((prev) => (prev.has(item.path) ? prev : new Set([item.path])))
  }

  const createFolder = async () => {
    const name = prompt('Название папки')
    if (!name) return
    try {
      await postAction({ action: 'create-folder', path, name })
      await fetchList(path)
      void loadFolderChildren(path)
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const openUploadPicker = (mode: 'all' | 'images') => {
    if (mode === 'images') {
      uploadImageInputRef.current?.click()
      return
    }
    uploadAnyInputRef.current?.click()
  }

  const onUploadAnyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return
    setRuntimeError(null)
    void uploadFiles(files, 'all')
  }

  const onUploadImagesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return
    setRuntimeError(null)
    void uploadFiles(files, 'images')
  }

  const downloadItems = async (items: DiskItem[]) => {
    const files = items.filter((item) => item.type === 'file')
    const skipped = items.filter((item) => item.type !== 'file')

    if (files.length === 0) {
      alert('Для скачивания выберите файлы')
      return
    }

    const totalBytes =
      files.every((item) => typeof item.size === 'number') && files.length > 0
        ? files.reduce((sum, item) => sum + (item.size || 0), 0)
        : undefined

    const taskId = startTask({
      type: 'download',
      totalFiles: files.length,
      totalBytes,
      processedBytes: totalBytes ? 0 : undefined,
    })

    if (skipped.length > 0) {
      addTaskError(taskId, 'Папки пропущены при скачивании')
    }

    for (const item of files) {
      updateTask(taskId, (task) => ({
        ...task,
        currentFile: item.name,
      }))
      try {
        await downloadFileWithRetry(item, taskId)
      } catch (error) {
        addTaskError(taskId, (error as Error).message)
      } finally {
        updateTask(taskId, (task) => ({
          ...task,
          processedFiles: task.processedFiles + 1,
        }))
      }
    }

    updateTask(taskId, (task) => ({
      ...task,
      status: task.errors?.length ? 'error' : 'done',
      currentFile: undefined,
    }))
  }

  const resolveItemType = useCallback(
    (itemPath: string): DiskItem['type'] | undefined => {
      const fromCurrentFolder = itemsByPath.get(itemPath)?.type
      if (fromCurrentFolder) return fromCurrentFolder
      if (treeNodesRef.current[itemPath]) return 'dir'
      return undefined
    },
    [itemsByPath],
  )

  const executeMoveCopy = async (mode: 'move' | 'copy', sourcePaths: string[], targetPath: string) => {
    if (sourcePaths.length === 0) return
    await runPathTask(mode, sourcePaths, async (itemPath) => {
      const name = getNameFromPath(itemPath)
      const to = targetPath === '/' ? `/${name}` : `${targetPath}/${name}`
      if (to === itemPath) return
      const itemType = resolveItemType(itemPath)
      if (mode === 'move' && itemType === 'dir' && targetPath.startsWith(`${itemPath}/`)) {
        throw new Error('Нельзя переместить папку внутрь самой себя')
      }
      await postAction({
        action: mode,
        from: itemPath,
        to,
        syncMedia: mode === 'move',
        isDir: itemType === 'dir',
      })
    })

    const refreshPaths = new Set<string>()
    refreshPaths.add(targetPath)
    for (const itemPath of sourcePaths) {
      refreshPaths.add(getParentPath(itemPath))
    }
    for (const refreshPath of refreshPaths) {
      void loadFolderChildren(refreshPath)
    }
  }

  const handleDropMenuAction = async (mode: 'move' | 'copy') => {
    if (!dropMenu) return
    const { items: dropItems, targetPath } = dropMenu
    setDropMenu(null)
    setDragPath(null)
    try {
      await executeMoveCopy(mode, dropItems, targetPath)
      setSelected(new Set())
      await fetchList(path)
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const handleTrashDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    const itemsToTrash = selected.size > 0 ? Array.from(selected) : dragPath ? [dragPath] : []
    if (itemsToTrash.length === 0) return
    setDropMenu(null)
    setDragPath(null)
    setTrashWarning({ items: itemsToTrash, usages: [], loading: true })
    try {
      const usages = await requestUsageCheck(itemsToTrash)
      if (usages.length > 0) {
        setTrashWarning({ items: itemsToTrash, usages, loading: false })
        return
      }
      setTrashWarning(null)
      await executeMoveCopy('move', itemsToTrash, '/.trash')
      setSelected(new Set())
      await fetchList(path)
      void loadFolderChildren('/')
    } catch (error) {
      setTrashWarning(null)
      alert((error as Error).message)
    }
  }

  const handleDrop = (event: React.DragEvent, targetPath: string) => {
    event.preventDefault()
    if (!dragPath || dragPath === targetPath) return
    const itemsToMove = selected.size > 0 ? Array.from(selected) : [dragPath]
    const hasSameTarget = itemsToMove.every((itemPath) => {
      const name = getNameFromPath(itemPath)
      const to = targetPath === '/' ? `/${name}` : `${targetPath}/${name}`
      return to === itemPath
    })
    if (hasSameTarget) return
    if (targetPath === '/.trash') {
      void handleTrashDrop(event)
      return
    }
    setDropMenu({
      x: event.clientX,
      y: event.clientY,
      targetPath,
      items: itemsToMove,
    })
    setDragPath(null)
  }

  const openImageViewerByPath = (itemPath: string) => {
    const paths = imageItems.map((item) => item.path)
    const index = paths.indexOf(itemPath)
    if (index < 0) return
    setImageViewer({ paths, index })
    setViewerMenuOpen(false)
  }

  const pickFileAndClose = useCallback(
    (item: DiskItem) => {
      if (!pickerMode) return false
      if (item.type !== 'file') return false
      if (pickerImagesOnly && getCategory(item) !== 'image') return false
      if (!window.opener || window.opener.closed) return false

      window.opener.postMessage(
        {
          type: 'yadisk-picker-select',
          path: item.path,
          name: item.name,
          preview: getPreviewUrl(item.path),
        },
        window.location.origin,
      )
      window.close()
      return true
    },
    [pickerImagesOnly, pickerMode],
  )

  const openFileInBrowser = async (item: DiskItem) => {
    if (item.type === 'dir') {
      await openFolder(item.path)
      return
    }
    if (pickFileAndClose(item)) return
    if (getCategory(item) === 'image') {
      openImageViewerByPath(item.path)
      return
    }
    const href = await requestDownloadUrl(item.path)
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  const copyFileLink = async (item: DiskItem) => {
    if (item.type !== 'file') return
    const href = await requestDownloadUrl(item.path)
    await navigator.clipboard.writeText(href)
    alert('Ссылка скопирована')
  }

  const runContextActionForItem = async (
    item: DiskItem,
    action: 'open' | 'delete' | 'rename' | 'move' | 'copy' | 'download' | 'copy-link',
  ) => {
    setViewerMenuOpen(false)

    if (action === 'open') {
      await openFileInBrowser(item)
      return
    }

    if (action === 'delete') {
      if (!confirm(`Удалить "${item.name}"?`)) return
      const parentPath = getParentPath(item.path)
      const nextPath = path === item.path || path.startsWith(`${item.path}/`) ? parentPath : path
      await runPathTask('delete', [item.path], (itemPath) => postAction({ action: 'delete', path: itemPath }))
      if (nextPath !== path) {
        setPath(nextPath)
      }
      await fetchList(nextPath)
      void loadFolderChildren(parentPath)
      if (parentPath !== '/') {
        void loadFolderChildren('/')
      }
      return
    }

    if (action === 'rename') {
      const nextName = prompt('Новое имя', item.name)
      if (!nextName) return
      const parentPath = getParentPath(item.path)
      await postAction({ action: 'rename', path: item.path, newName: nextName })
      await fetchList(path)
      void loadFolderChildren(parentPath)
      if (parentPath !== path) {
        void loadFolderChildren(path)
      }
      if (parentPath !== '/') {
        void loadFolderChildren('/')
      }
      return
    }

    if (action === 'move' || action === 'copy') {
      const target = prompt('Путь назначения (пример: /new-folder)')
      if (!target) return
      await executeMoveCopy(action, [item.path], target)
      await fetchList(path)
      return
    }

    if (action === 'download') {
      await downloadItems([item])
      return
    }

    if (action === 'copy-link') {
      await copyFileLink(item)
    }
  }

  const handleContextAction = async (
    action: 'open' | 'delete' | 'rename' | 'move' | 'copy' | 'download' | 'copy-link',
  ) => {
    if (!contextMenu?.item) return
    const item = contextMenu.item
    setContextMenu(null)
    try {
      await runContextActionForItem(item, action)
    } catch (error) {
      alert((error as Error).message)
    }
  }

  const getItemBadgeClass = (item: DiskItem) => `yadisk__badge yadisk__badge--${getCategory(item)}`
  const getItemNameClass = (item: DiskItem) =>
    `yadisk__item-name ${item.type === 'dir' ? 'yadisk__item-name--folder' : ''}`
  const collectionLabels: Record<string, string> = {
    pages: 'Страницы',
    posts: 'Посты',
    projects: 'Проекты',
    events: 'События',
    services: 'Сервисы',
    products: 'Товары',
  }
  const taskTypeLabel: Record<TransferTaskType, string> = {
    upload: 'Загрузка',
    download: 'Скачивание',
    move: 'Перемещение',
    copy: 'Копирование',
    delete: 'Удаление',
  }
  const getTaskProgress = (task: TransferTask) => {
    if (task.totalBytes && typeof task.processedBytes === 'number') {
      if (task.totalBytes === 0) return 0
      return Math.min(100, Math.round((task.processedBytes / task.totalBytes) * 100))
    }
    if (task.totalFiles === 0) return 0
    return Math.min(100, Math.round((task.processedFiles / task.totalFiles) * 100))
  }
  const getTaskStatusLabel = (status: TransferTaskStatus) => {
    if (status === 'running') return 'В процессе'
    if (status === 'done') return 'Готово'
    return 'Ошибка'
  }
  const renderTreeNode = (nodePath: string, depth = 0): React.ReactNode => {
    const node = treeNodes[nodePath]
    if (!node) return null
    const isActive = path === nodePath
    const hasChildren = node.children.length > 0
    return (
      <div key={nodePath} className="yadisk__tree-node">
        <div
          className={`yadisk__tree-row ${isActive ? 'is-active' : ''}`}
          style={{ paddingLeft: `${depth * 16}px` }}
          onClick={() => void openFolder(nodePath)}
          onContextMenu={(event) => {
            event.preventDefault()
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              item: {
                name: node.name,
                path: nodePath,
                type: 'dir',
              },
            })
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDrop(event, nodePath)}
        >
          <button
            className="yadisk__tree-toggle"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              void toggleTreeNode(nodePath)
            }}
            aria-label={node.expanded ? 'Свернуть' : 'Развернуть'}
          >
            {node.expanded ? '▾' : '▸'}
          </button>
          <button
            className="yadisk__tree-label"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              void openFolder(nodePath)
            }}
          >
            {node.name}
          </button>
          {node.loading && <span className="yadisk__tree-loading">...</span>}
        </div>
        {node.expanded && hasChildren && (
          <div className="yadisk__tree-children">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="yadisk yadisk__container mt-6 space-y-6"
      onClick={() => {
        setContextMenu(null)
        setDropMenu(null)
      }}
    >
      <input
        ref={uploadAnyInputRef}
        type="file"
        multiple
        onChange={onUploadAnyChange}
        style={{ display: 'none' }}
      />
      <input
        ref={uploadImageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onUploadImagesChange}
        style={{ display: 'none' }}
      />
      <CloudTitlebar pickerMode={pickerMode} />
      <SidebarPanel
        sidebarWidth={sidebarWidth}
        tree={renderTreeNode('/')}
        onCreateFolder={createFolder}
        onOpenTrash={() => openFolder('/.trash')}
        onTrashDrop={handleTrashDrop}
        onStartResize={startSidebarResize}
        onResetResize={() => setSidebarWidth(300)}
      >
          <ActionToolbar
            uploadBehavior={uploadBehavior}
            onUploadBehaviorChange={setUploadBehavior}
            onUploadFiles={() => openUploadPicker('all')}
            onUploadImages={() => openUploadPicker('images')}
            onSelectAllFiles={selectAllFiles}
            onClearSelection={clearSelection}
            hasFiles={filePaths.length > 0}
            hasSelection={selected.size > 0}
          />

          <ViewToolbar
            viewMode={viewMode}
            previewSize={previewSize}
            sortField={sortField}
            sortDirection={sortDirection}
            onViewModeChange={setViewMode}
            onPreviewSizeChange={setPreviewSize}
            onSortFieldChange={setSortField}
            onSortDirectionChange={setSortDirection}
          />
          <Breadcrumbs breadcrumbs={breadcrumbs} onOpenFolder={openFolder} />

          {runtimeError && (
            <div className="yadisk__runtime-error">
              {runtimeError}
            </div>
          )}

          {loading && <div className="yadisk__loading text-sm text-muted-foreground">Загрузка...</div>}

          {!loading && items.length === 0 && (
            <div className="yadisk__empty rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Здесь пока пусто. Создайте папку или загрузите файлы.
            </div>
          )}

          {viewMode === 'table' && (
            <div className="yadisk__table-wrapper">
              <table className="yadisk__table">
                <thead>
                  <tr>
                    <th>Имя</th>
                    <th>Расширение</th>
                    <th>Размер</th>
                    <th>Дата создания</th>
                    <th>Использование</th>
                    <th className="yadisk__table-check">Выбор</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
                    const isSelected = selected.has(item.path)
                    const isFolder = item.type === 'dir'
                    const ext = isFolder ? 'Папка' : getExtension(item.name) || '—'
                    const usages = usageByPath[item.path] || []
                    return (
                      <tr
                        key={item.path}
                        className={isSelected ? 'is-selected' : ''}
                        draggable
                        onDragStart={(event) => startDrag(event, item)}
                        onDoubleClick={() => void openFileInBrowser(item)}
                        onDragOver={(event) => {
                          if (isFolder) event.preventDefault()
                        }}
                        onDrop={(event) => {
                          if (!isFolder) return
                          void handleDrop(event, item.path)
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          setContextMenu({
                            x: event.clientX,
                            y: event.clientY,
                            item,
                          })
                        }}
                      >
                        <td>
                          <div className="yadisk__table-name">
                            <span className={getItemBadgeClass(item)}>{ext}</span>
                            <button
                              className={getItemNameClass(item)}
                              onClick={() => {
                                if (isFolder) {
                                  void openFolder(item.path)
                                  return
                                }
                                if (pickFileAndClose(item)) return
                                toggleSelection(item.path)
                              }}
                              onDoubleClick={() => isFolder && openFolder(item.path)}
                            >
                              {item.name}
                            </button>
                          </div>
                        </td>
                        <td>{isFolder ? '—' : getExtension(item.name) || '—'}</td>
                        <td>{isFolder ? '—' : formatSize(item.size)}</td>
                        <td>{formatDate(item.created)}</td>
                        <td className="yadisk__usage-cell">
                          {isFolder ? (
                            '—'
                          ) : usageLoading && !usageByPath[item.path] ? (
                            '...'
                          ) : usages.length === 0 ? (
                            'Не используется'
                          ) : (
                            <div className="yadisk__usage-links">
                              {usages.slice(0, 2).map((usage) => (
                                <a
                                  key={`${item.path}-${usage.collection}-${usage.id}`}
                                  href={usage.frontendUrl || usage.adminUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {usage.title ||
                                    usage.slug ||
                                    `${collectionLabels[usage.collection] || usage.collection} #${usage.id}`}
                                </a>
                              ))}
                              {usages.length > 2 && <span>+{usages.length - 2}</span>}
                            </div>
                          )}
                        </td>
                        <td className="yadisk__table-check">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(item.path)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'list' && (
            <div className="yadisk__list">
              {sortedItems.map((item) => {
                const isSelected = selected.has(item.path)
                const isFolder = item.type === 'dir'
                const ext = isFolder ? 'Папка' : getExtension(item.name) || '—'
                return (
                  <div
                    key={item.path}
                    className={`yadisk__list-row ${isSelected ? 'is-selected' : ''}`}
                    draggable
                    onDragStart={(event) => startDrag(event, item)}
                    onDoubleClick={() => void openFileInBrowser(item)}
                    onDragOver={(event) => {
                      if (isFolder) event.preventDefault()
                    }}
                    onDrop={(event) => {
                      if (!isFolder) return
                      void handleDrop(event, item.path)
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        item,
                      })
                    }}
                  >
                    <div className="yadisk__list-main">
                      <span className={getItemBadgeClass(item)}>{ext}</span>
                      <button
                        className={getItemNameClass(item)}
                        onClick={() => {
                          if (isFolder) {
                            void openFolder(item.path)
                            return
                          }
                          if (pickFileAndClose(item)) return
                          toggleSelection(item.path)
                        }}
                      >
                        {item.name}
                      </button>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(item.path)}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {viewMode === 'preview' && (
            <div
              ref={previewGridRef}
              className={`yadisk__grid yadisk__grid--${previewSize}`}
              onMouseDown={handlePreviewGridMouseDown}
            >
              {sortedItems.map((item) => {
                const isSelected = selected.has(item.path)
                const isFolder = item.type === 'dir'
                const extension = getExtension(item.name)

                return (
                  <div
                    key={item.path}
                    data-item-path={item.path}
                    className={`yadisk__card rounded-2xl border bg-card p-4 shadow-sm transition ${
                      isSelected ? 'yadisk__card--selected' : ''
                    }`}
                    draggable
                    onDragStart={(event) => startDrag(event, item)}
                    onDoubleClick={() => void openFileInBrowser(item)}
                    onDragOver={(event) => {
                      if (isFolder) event.preventDefault()
                    }}
                    onDrop={(event) => {
                      if (!isFolder) return
                      void handleDrop(event, item.path)
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        item,
                      })
                    }}
                  >
                    <div className="yadisk__card-check">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(item.path)}
                      />
                    </div>

                    <button
                      className={`yadisk__preview-media-button ${isFolder ? 'is-folder' : ''}`}
                      type="button"
                      onClick={() => {
                        if (isFolder) {
                          void openFolder(item.path)
                          return
                        }
                        if (pickFileAndClose(item)) return
                        toggleSelection(item.path)
                      }}
                    >
                      {isFolder ? (
                        <div className="yadisk__folder-preview">
                          <div className="yadisk__folder-icon" aria-hidden="true">
                            📁
                          </div>
                          <div className="yadisk__folder-name">{item.name}</div>
                        </div>
                      ) : item.preview ? (
                        <Image
                          src={item.preview}
                          alt={item.name}
                          width={320}
                          height={128}
                          sizes="(max-width: 768px) 100vw, 320px"
                          className="yadisk__preview-image"
                          unoptimized
                        />
                      ) : (
                        <div className={`yadisk__placeholder yadisk__placeholder--${getCategory(item)}`}>
                          Файл
                        </div>
                      )}
                    </button>

                    {!isFolder && <div className="yadisk__preview-caption">{item.name}</div>}
                    <div className="yadisk__preview-meta">
                      {isFolder ? 'Каталог' : extension ? extension.toUpperCase() : 'ФАЙЛ'}
                    </div>
                  </div>
                )
              })}
              {selectionBox && (
                <div
                  className="yadisk__selection-box"
                  style={{
                    left: selectionBox.left,
                    top: selectionBox.top,
                    width: selectionBox.width,
                    height: selectionBox.height,
                  }}
                />
              )}
            </div>
          )}
      </SidebarPanel>

      {tasks.length > 0 && (
        <div className="yadisk__tasks-float" onClick={(event) => event.stopPropagation()}>
          {tasks.slice(-3).map((task) => {
            const percent = getTaskProgress(task)
            return (
              <div key={task.id} className="yadisk__task rounded-xl border bg-card p-3">
                <div className="yadisk__task-header flex items-center justify-between gap-2 text-sm">
                  <div className="font-semibold">{taskTypeLabel[task.type]}</div>
                  <span className={`yadisk__task-status yadisk__task-status--${task.status}`}>
                    {getTaskStatusLabel(task.status)}
                  </span>
                </div>
                <div className="yadisk__task-meta mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    Файлы: {task.processedFiles}/{task.totalFiles}
                  </span>
                  {task.currentFile && <span>Текущий: {task.currentFile}</span>}
                </div>
                {task.errors && task.errors.length > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    Ошибки: {task.errors.slice(0, 2).join(' | ')}
                    {task.errors.length > 2 ? ` (+${task.errors.length - 2})` : ''}
                  </div>
                )}
                <div className="yadisk__progress mt-2">
                  <div className="yadisk__progress-bar" style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {dropMenu && (
        <div
          className="yadisk__popup-menu"
          style={{ left: dropMenu.x, top: dropMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="block w-full px-3 py-2 text-left hover:bg-muted"
            onClick={() => handleDropMenuAction('copy')}
          >
            Копировать
          </button>
          <button
            className="block w-full px-3 py-2 text-left hover:bg-muted"
            onClick={() => handleDropMenuAction('move')}
          >
            Переместить
          </button>
        </div>
      )}

      {contextMenu && (
        <div
          className="yadisk__popup-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="block w-full px-3 py-2 text-left hover:bg-muted"
            onClick={() => handleContextAction('open')}
          >
            Открыть
          </button>
          <button
            className="block w-full px-3 py-2 text-left hover:bg-muted"
            onClick={() => handleContextAction('rename')}
          >
            Переименовать
          </button>
          {contextMenu.item?.type === 'file' && (
            <button
              className="block w-full px-3 py-2 text-left hover:bg-muted"
              onClick={() => handleContextAction('download')}
            >
              Скачать
            </button>
          )}
          {contextMenu.item?.type === 'file' && (
            <button
              className="block w-full px-3 py-2 text-left hover:bg-muted"
              onClick={() => handleContextAction('copy-link')}
            >
              Скопировать ссылку
            </button>
          )}
          <button
            className="block w-full px-3 py-2 text-left hover:bg-muted"
            onClick={() => handleContextAction('move')}
          >
            Переместить
          </button>
          <button
            className="block w-full px-3 py-2 text-left hover:bg-muted"
            onClick={() => handleContextAction('copy')}
          >
            Копировать
          </button>
          <button
            className="block w-full px-3 py-2 text-left hover:bg-muted text-red-600"
            onClick={() => handleContextAction('delete')}
          >
            Удалить
          </button>
        </div>
      )}

      {imageViewer && viewerCurrentItem && (
        <div
          className="yadisk__viewer-backdrop"
          onClick={() => {
            setImageViewer(null)
            setViewerMenuOpen(false)
          }}
        >
          <div className="yadisk__viewer" onClick={(event) => event.stopPropagation()}>
            <div className="yadisk__viewer-header">
              <div className="yadisk__viewer-title">{viewerCurrentItem.name}</div>
              <div className="yadisk__viewer-actions">
                <button
                  className="yadisk__viewer-button"
                  type="button"
                  onClick={() => setViewerMenuOpen((prev) => !prev)}
                >
                  ...
                </button>
                <button
                  className="yadisk__viewer-button"
                  type="button"
                  onClick={() => {
                    setImageViewer(null)
                    setViewerMenuOpen(false)
                  }}
                >
                  Закрыть
                </button>
              </div>
            </div>
            {viewerMenuOpen && (
              <div className="yadisk__viewer-menu">
                <button
                  type="button"
                  onClick={() =>
                    void runContextActionForItem(viewerCurrentItem, 'rename').catch((error) =>
                      alert((error as Error).message),
                    )
                  }
                >
                  Переименовать
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void runContextActionForItem(viewerCurrentItem, 'copy').catch((error) =>
                      alert((error as Error).message),
                    )
                  }
                >
                  Копировать
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void runContextActionForItem(viewerCurrentItem, 'move').catch((error) =>
                      alert((error as Error).message),
                    )
                  }
                >
                  Переместить
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void runContextActionForItem(viewerCurrentItem, 'copy-link').catch((error) =>
                      alert((error as Error).message),
                    )
                  }
                >
                  Скопировать ссылку
                </button>
                <button
                  className="is-danger"
                  type="button"
                  onClick={() =>
                    void runContextActionForItem(viewerCurrentItem, 'delete').catch((error) =>
                      alert((error as Error).message),
                    )
                  }
                >
                  Удалить
                </button>
              </div>
            )}
            <div className="yadisk__viewer-stage">
              <button className="yadisk__viewer-nav" type="button" onClick={() => shiftViewer(-1)}>
                ←
              </button>
              <Image
                src={viewerCurrentSrc}
                alt={viewerCurrentItem.name}
                width={1600}
                height={1200}
                sizes="100vw"
                className="yadisk__viewer-image"
                unoptimized
                onContextMenu={(event) => {
                  event.preventDefault()
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    item: viewerCurrentItem,
                  })
                }}
              />
              <button className="yadisk__viewer-nav" type="button" onClick={() => shiftViewer(1)}>
                →
              </button>
            </div>
            <div className="yadisk__viewer-footer">
              {imageViewer.index + 1} / {imageViewer.paths.length}
            </div>
          </div>
        </div>
      )}

      {trashWarning && (
        <div className="yadisk__modal-backdrop">
          <div className="yadisk__modal">
            <div className="yadisk__modal-title">Файл используется на сайте</div>
            {trashWarning.loading ? (
              <div className="yadisk__modal-text">Проверяем использование...</div>
            ) : (
              <>
                <div className="yadisk__modal-text">
                  Этот файл используется в следующих местах. Проверьте ссылки перед удалением.
                </div>
                <div className="yadisk__modal-list">
                  {trashWarning.usages.map((usage) => (
                    <div key={`${usage.collection}-${usage.id}`} className="yadisk__modal-item">
                      <div className="yadisk__modal-item-title">
                        {usage.title || usage.slug || `ID ${usage.id}`}
                      </div>
                      <div className="yadisk__modal-item-meta">
                        {collectionLabels[usage.collection] || usage.collection}
                      </div>
                      <div className="yadisk__modal-links">
                        {usage.frontendUrl && (
                          <a href={usage.frontendUrl} target="_blank" rel="noreferrer">
                            Открыть страницу
                          </a>
                        )}
                        <a href={usage.adminUrl} target="_blank" rel="noreferrer">
                          Открыть в админке
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="yadisk__modal-actions">
                  <button
                    className="yadisk__button yadisk__button--danger"
                    type="button"
                    onClick={async () => {
                      const items = trashWarning.items
                      setTrashWarning(null)
                      try {
                        await executeMoveCopy('move', items, '/.trash')
                        setSelected(new Set())
                        await fetchList(path)
                        void loadFolderChildren('/')
                      } catch (error) {
                        alert((error as Error).message)
                      }
                    }}
                  >
                    Всё равно удалить
                  </button>
                  <button
                    className="yadisk__button yadisk__button--outline"
                    type="button"
                    onClick={() => setTrashWarning(null)}
                  >
                    Отмена
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {uploadReport && (
        <div className="yadisk__modal-backdrop">
          <div className="yadisk__modal">
            <div className="yadisk__modal-title">
              {uploadReport.failed.length === 0 ? 'Загрузка завершена' : 'Загрузка завершена с ошибками'}
            </div>
            <div className="yadisk__modal-text">
              Папка назначения: <strong>{uploadReport.targetPath || '/'}</strong>
            </div>
            <div className="yadisk__modal-text">
              Успешно загружено: {uploadReport.successful.length}
              {uploadReport.skipped.length > 0 ? `, пропущено: ${uploadReport.skipped.length}` : ''}
              {uploadReport.failed.length > 0 ? `, не загружено: ${uploadReport.failed.length}` : ''}
            </div>

            {uploadReport.successful.length > 0 && (
              <div className="yadisk__modal-list">
                {uploadReport.successful.map((name) => (
                  <div key={`ok-${name}`} className="yadisk__modal-item">
                    <div className="yadisk__modal-item-title">{name}</div>
                    <div className="yadisk__modal-item-meta">Загружен успешно</div>
                  </div>
                ))}
              </div>
            )}

            {uploadReport.failed.length > 0 && (
              <div className="yadisk__modal-list">
                {uploadReport.failed.map((item) => (
                  <div key={`err-${item.name}`} className="yadisk__modal-item">
                    <div className="yadisk__modal-item-title">{item.name}</div>
                    <div className="yadisk__modal-item-meta">{item.error}</div>
                  </div>
                ))}
              </div>
            )}

            {uploadReport.skipped.length > 0 && (
              <div className="yadisk__modal-list">
                {uploadReport.skipped.map((item) => (
                  <div key={`skip-${item.name}`} className="yadisk__modal-item">
                    <div className="yadisk__modal-item-title">{item.name}</div>
                    <div className="yadisk__modal-item-meta">{item.reason}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="yadisk__modal-actions">
              <button
                className="yadisk__button yadisk__button--outline"
                type="button"
                onClick={() => {
                  setTasks((prev) => prev.filter((task) => task.id !== uploadReport.taskId))
                  setUploadReport(null)
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

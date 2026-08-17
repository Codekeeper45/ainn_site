import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { COLLECTIONS, emptyContent } from './model.js'

const ContentContext = createContext(null)

export function ContentProvider({ initialContent, children }) {
  const [content, setContent] = useState(() => initialContent || emptyContent())
  const [dirty, setDirty] = useState(false)

  const getCollection = useCallback(
    (id) => {
      const override = content.collections?.[id]
      return Array.isArray(override) ? override : COLLECTIONS[id].defaults
    },
    [content],
  )

  const mutateCollection = useCallback((id, updater) => {
    setContent((current) => {
      const override = current.collections?.[id]
      const base = Array.isArray(override) ? override : COLLECTIONS[id].defaults
      return {
        ...current,
        collections: { ...(current.collections || {}), [id]: updater(base) },
      }
    })
    setDirty(true)
  }, [])

  const updateItem = useCallback(
    (id, itemId, patch) => {
      mutateCollection(id, (items) =>
        items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      )
    },
    [mutateCollection],
  )

  const addItem = useCallback(
    (id, item) => {
      mutateCollection(id, (items) => [...items, item])
    },
    [mutateCollection],
  )

  const removeItem = useCallback(
    (id, itemId) => {
      mutateCollection(id, (items) => items.filter((item) => item.id !== itemId))
    },
    [mutateCollection],
  )

  const moveItem = useCallback(
    (id, itemId, delta) => {
      mutateCollection(id, (items) => {
        const index = items.findIndex((item) => item.id === itemId)
        const target = index + delta
        if (index < 0 || target < 0 || target >= items.length) return items
        const next = [...items]
        const [moved] = next.splice(index, 1)
        next.splice(target, 0, moved)
        return next
      })
    },
    [mutateCollection],
  )

  const replaceContent = useCallback((next) => {
    setContent(next || emptyContent())
    setDirty(false)
  }, [])

  const value = useMemo(
    () => ({
      content,
      dirty,
      getCollection,
      updateItem,
      addItem,
      removeItem,
      moveItem,
      replaceContent,
    }),
    [content, dirty, getCollection, updateItem, addItem, removeItem, moveItem, replaceContent],
  )

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export function useContent() {
  const context = useContext(ContentContext)
  if (!context) throw new Error('useContent должен использоваться внутри ContentProvider')
  return context
}

export function useCollection(id) {
  const { getCollection } = useContent()
  return getCollection(id)
}

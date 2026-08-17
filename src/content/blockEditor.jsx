import { createContext, useCallback, useContext, useMemo, useState } from 'react'

// Null on the public site: CollectionItem/AddBlockButton treat a missing
// provider as "block editing unavailable" and render plain markup.
const BlockEditorContext = createContext(null)

export function BlockEditorProvider({ children }) {
  const [mode, setMode] = useState('text')
  const [editing, setEditing] = useState(null)

  const selectMode = useCallback((next) => {
    setMode(next)
    setEditing(null)
  }, [])

  const openEditor = useCallback((collectionId, itemId) => {
    setEditing({ collectionId, itemId })
  }, [])

  const closeEditor = useCallback(() => setEditing(null), [])

  const value = useMemo(
    () => ({ mode, selectMode, editing, openEditor, closeEditor }),
    [mode, editing, selectMode, openEditor, closeEditor],
  )

  return <BlockEditorContext.Provider value={value}>{children}</BlockEditorContext.Provider>
}

export function useBlockEditor() {
  return useContext(BlockEditorContext)
}

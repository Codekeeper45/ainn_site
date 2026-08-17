import { useEffect, useRef, useState } from 'react'
import { COLLECTIONS } from '../content/model.js'
import { useContent } from '../content/ContentContext.jsx'
import { useBlockEditor } from '../content/blockEditor.jsx'
import { uploadImageFile } from './api.js'

/** Side panel that edits one collection item according to its schema. */
export default function BlockPanel() {
  const editor = useBlockEditor()
  const { getCollection, updateItem } = useContent()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const editing = editor?.editing
  const collection = editing ? COLLECTIONS[editing.collectionId] : null
  const item = editing
    ? getCollection(editing.collectionId).find((entry) => entry.id === editing.itemId)
    : null

  useEffect(() => {
    if (!editing) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') editor.closeEditor()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editing, editor])

  if (!editing || !collection || !item) return null

  const patch = (name, value) => updateItem(editing.collectionId, editing.itemId, { [name]: value })

  const upload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      patch('image', await uploadImageFile(file))
    } catch (error) {
      window.alert(error.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <aside className="admin-block-panel" data-admin-ui aria-label={`Редактирование: ${collection.singular}`}>
      <div className="admin-block-panel-head">
        <div>
          <p className="admin-kicker">{collection.label}</p>
          <h2>{collection.singular}</h2>
        </div>
        <button type="button" onClick={editor.closeEditor} aria-label="Закрыть панель">
          ✕
        </button>
      </div>

      <div className="admin-block-panel-body">
        {collection.fields.map((field) => {
          const value = item[field.name]

          if (field.type === 'text') {
            return (
              <label key={field.name}>
                {field.label}
                <input
                  type="text"
                  value={value || ''}
                  maxLength={field.maxLength}
                  onChange={(event) => patch(field.name, event.target.value)}
                />
              </label>
            )
          }

          if (field.type === 'textarea') {
            return (
              <label key={field.name}>
                {field.label}
                <textarea
                  rows={4}
                  value={value || ''}
                  maxLength={field.maxLength}
                  onChange={(event) => patch(field.name, event.target.value)}
                />
              </label>
            )
          }

          if (field.type === 'boolean') {
            return (
              <label key={field.name} className="admin-block-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => patch(field.name, event.target.checked)}
                />
                {field.label}
              </label>
            )
          }

          if (field.type === 'select') {
            return (
              <label key={field.name}>
                {field.label}
                <select value={value || ''} onChange={(event) => patch(field.name, event.target.value)}>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )
          }

          if (field.type === 'image') {
            return (
              <div key={field.name} className="admin-block-image-field">
                <span className="admin-block-image-label">{field.label}</span>
                {value ? (
                  <img src={value} alt="" className="admin-block-image-preview" />
                ) : (
                  <p className="admin-block-image-empty">Фото ещё не загружено.</p>
                )}
                <div className="admin-block-image-actions">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Загружаем…' : value ? 'Заменить фото' : 'Загрузить фото'}
                  </button>
                  {value ? (
                    <button type="button" className="danger" onClick={() => patch(field.name, '')}>
                      Убрать
                    </button>
                  ) : null}
                </div>
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => upload(event.target.files?.[0])}
                />
              </div>
            )
          }

          if (field.type === 'list') {
            const list = Array.isArray(value) ? value : []
            const setList = (next) => patch(field.name, next)
            return (
              <div key={field.name} className="admin-block-list-field">
                <span className="admin-block-image-label">{field.label}</span>
                {list.map((entry, index) => (
                  <div key={`${index}-${entry}`} className="admin-block-list-row">
                    <input
                      type="text"
                      value={entry}
                      maxLength={field.itemMaxLength}
                      onChange={(event) =>
                        setList(list.map((current, i) => (i === index ? event.target.value : current)))
                      }
                    />
                    <button
                      type="button"
                      className="danger"
                      aria-label="Удалить пункт"
                      onClick={() => setList(list.filter((_, i) => i !== index))}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={list.length >= field.maxItems}
                  onClick={() => setList([...list, ''])}
                >
                  + Добавить пункт
                </button>
              </div>
            )
          }

          return null
        })}
      </div>

      <p className="admin-block-panel-hint">
        Изменения видны сразу. Нажмите «Сохранить всё», чтобы они остались после перезагрузки.
      </p>
    </aside>
  )
}

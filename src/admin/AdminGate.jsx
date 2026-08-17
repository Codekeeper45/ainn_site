import { useEffect, useRef, useState } from 'react'
import Brand from '../components/Brand.jsx'
import { BlockEditorProvider, useBlockEditor } from '../content/blockEditor.jsx'
import { useContent } from '../content/ContentContext.jsx'
import {
  applyContent,
  applyImage,
  collectImageTargets,
  collectTextTargets,
  imageKey,
  imageKind,
  restoreImage,
  textKey,
} from './contentRuntime.jsx'
import { api, uploadImageFile } from './api.js'
import BlockPanel from './BlockPanel.jsx'

export default function AdminGate({ children }) {
  const [state, setState] = useState({ checking: true, authenticated: false, demoCredentials: null, saveEnabled: false })

  useEffect(() => {
    let disposed = false
    api('/api/admin/session')
      .then((result) => !disposed && setState({
        checking: false,
        authenticated: result.authenticated,
        demoCredentials: result.demoCredentials || null,
        saveEnabled: result.saveEnabled === true,
      }))
      .catch(() => !disposed && setState({ checking: false, authenticated: false, demoCredentials: null, saveEnabled: false }))
    return () => {
      disposed = true
    }
  }, [])

  if (state.checking) return <AdminLoading />
  if (!state.authenticated) {
    return <AdminLogin
      demoCredentials={state.demoCredentials}
      onSuccess={() => setState((current) => ({ ...current, checking: false, authenticated: true }))}
    />
  }

  return (
    <BlockEditorProvider>
      {children}
      <InlineEditor
        saveEnabled={state.saveEnabled}
        onLogout={async () => {
          await api('/api/admin/logout', { method: 'POST' }).catch(() => {})
          setState((current) => ({ ...current, checking: false, authenticated: false }))
        }}
      />
      <BlockPanel />
    </BlockEditorProvider>
  )
}

function AdminLoading() {
  return (
    <main className="admin-auth" data-admin-ui>
      <div className="admin-login-card admin-loading-card">
        <Brand />
        <p>Проверяем доступ…</p>
      </div>
    </main>
  )
}

function AdminLogin({ demoCredentials, onSuccess }) {
  const [values, setValues] = useState({ username: '', password: '' })
  const [status, setStatus] = useState({ loading: false, error: '' })

  const submit = async (event) => {
    event.preventDefault()
    setStatus({ loading: true, error: '' })
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      onSuccess()
    } catch (error) {
      setStatus({ loading: false, error: error.message })
    }
  }

  return (
    <main className="admin-auth" data-admin-ui>
      <form className="admin-login-card" onSubmit={submit}>
        <Brand />
        <div>
          <p className="admin-kicker">Управление сайтом</p>
          <h1>Вход в админ-панель</h1>
          <p>После входа откроется этот же сайт с редактированием текста, изображений и блоков.</p>
        </div>
        <label>
          Логин
          <input
            name="username"
            autoComplete="username"
            value={values.username}
            onChange={(event) => setValues((current) => ({ ...current, username: event.target.value }))}
            required
          />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
            required
          />
        </label>
        <button className="button button-primary" type="submit" disabled={status.loading}>
          {status.loading ? 'Входим…' : 'Войти и редактировать'}
        </button>
        {status.error ? <p className="admin-login-error" role="alert">{status.error}</p> : null}
        {demoCredentials ? (
          <div className="admin-demo-credentials">
            <span>Тестовый доступ</span>
            <code>{demoCredentials.username}</code>
            <code>{demoCredentials.password}</code>
          </div>
        ) : null}
        <a href="/">← Вернуться на сайт</a>
      </form>
    </main>
  )
}

function InlineEditor({ onLogout, saveEnabled }) {
  const editor = useBlockEditor()
  const { content, dirty, replaceContent, setText, removeText, setImage, removeImage } = useContent()
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState(() =>
    content.updatedAt
      ? `Сохранено: ${new Date(content.updatedAt).toLocaleString('ru-RU')}`
      : 'Можно редактировать',
  )
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)
  const contentRef = useRef(content)
  const modeRef = useRef(editor.mode)
  const selectedRef = useRef(selected)
  const refreshRef = useRef(() => {})

  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    modeRef.current = editor.mode
    setSelected(null)
    refreshRef.current()
  }, [editor.mode])

  useEffect(() => {
    selectedRef.current = selected
    document.querySelectorAll('.admin-selected').forEach((element) => element.classList.remove('admin-selected'))
    selected?.element?.classList.add('admin-selected')
    return () => selected?.element?.classList.remove('admin-selected')
  }, [selected])

  useEffect(() => {
    document.documentElement.classList.add('admin-mode')
    let scheduled = 0

    const register = () => {
      scheduled = 0
      const mode = modeRef.current
      collectTextTargets().forEach((element) => {
        if (!element.dataset.adminOriginalText) element.dataset.adminOriginalText = element.textContent || ''
        element.dataset.adminTextKey = textKey(element)
        element.classList.toggle('admin-text-target', mode === 'text')
        if (mode === 'text') element.setAttribute('contenteditable', 'plaintext-only')
        else element.removeAttribute('contenteditable')
      })
      collectImageTargets().forEach((element) => {
        element.dataset.adminImageKey = imageKey(element)
        element.classList.toggle('admin-image-target', mode === 'image')
      })
      applyContent(contentRef.current, { admin: true })
    }
    refreshRef.current = register

    const scheduleRegister = () => {
      if (!scheduled) scheduled = requestAnimationFrame(register)
    }

    collectTextTargets().forEach((element) => {
      if (!element.dataset.adminOriginalText) element.dataset.adminOriginalText = element.textContent || ''
    })
    collectImageTargets().forEach((element) => restoreImage(element))
    register()

    const onInput = (event) => {
      const element = event.target.closest?.('[data-admin-text-key]')
      if (!element || modeRef.current !== 'text') return
      setText(element.dataset.adminTextKey, element.innerText)
      setStatus('Есть несохранённые изменения')
    }

    const onClick = (event) => {
      if (event.target.closest?.('[data-admin-ui]')) return
      if (modeRef.current === 'text') {
        const element = event.target.closest?.('[data-admin-text-key]')
        if (!element) return
        event.preventDefault()
        event.stopPropagation()
        element.focus()
        setSelected({ type: 'text', key: element.dataset.adminTextKey, element })
        return
      }
      if (modeRef.current === 'image') {
        const element = event.target.closest?.('[data-admin-image-key]')
        if (!element) return
        event.preventDefault()
        event.stopPropagation()
        setSelected({ type: 'image', key: element.dataset.adminImageKey, element })
      }
    }

    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        document.querySelector('[data-admin-save]')?.click()
      }
      if (event.key === 'Escape') {
        document.activeElement?.blur?.()
        setSelected(null)
      }
    }

    document.addEventListener('input', onInput, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown)
    const observer = new MutationObserver(scheduleRegister)
    observer.observe(document.getElementById('root'), { childList: true, subtree: true })

    return () => {
      document.documentElement.classList.remove('admin-mode')
      document.removeEventListener('input', onInput, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown)
      observer.disconnect()
      if (scheduled) cancelAnimationFrame(scheduled)
      collectTextTargets().forEach((element) => {
        element.classList.remove('admin-text-target')
        element.removeAttribute('contenteditable')
        delete element.dataset.adminTextKey
      })
      collectImageTargets().forEach((element) => {
        element.classList.remove('admin-image-target', 'admin-image-removed')
        delete element.dataset.adminImageKey
      })
    }
  }, [])

  const updateImage = (entry) => {
    const target = selectedRef.current
    if (!target || target.type !== 'image' || !target.element?.isConnected) return
    const next = { ...contentRef.current.images[target.key], kind: imageKind(target.element), ...entry }
    setImage(target.key, next)
    applyImage(target.element, next, { admin: true })
    setStatus('Есть несохранённые изменения')
  }

  const uploadImage = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatus('Выберите изображение JPG, PNG, WebP или GIF.')
      return
    }
    setStatus('Загружаем изображение…')
    try {
      const url = await uploadImageFile(file)
      updateImage({ url, removed: false })
      setStatus('Изображение заменено. Нажмите «Сохранить всё».')
    } catch (error) {
      setStatus(error.message)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const restoreSelected = () => {
    const target = selectedRef.current
    if (!target?.element?.isConnected) return
    if (target.type === 'text') {
      target.element.textContent = target.element.dataset.adminOriginalText || ''
      removeText(target.key)
    } else {
      restoreImage(target.element)
      removeImage(target.key)
    }
    setStatus('Исходное значение восстановлено. Нажмите «Сохранить всё».')
    refreshRef.current()
  }

  const clearSelectedText = () => {
    const target = selectedRef.current
    if (target?.type !== 'text' || !target.element?.isConnected) return
    target.element.textContent = ''
    setText(target.key, '')
    setStatus('Текст очищен. Нажмите «Сохранить всё».')
  }

  const save = async () => {
    if (!saveEnabled) {
      setStatus('Сохранение временно отключено. Изменения видны только до обновления страницы.')
      return
    }
    setSaving(true)
    setStatus('Сохраняем изменения…')
    try {
      const saved = await api('/api/admin/content', {
        method: 'PUT',
        body: JSON.stringify(contentRef.current),
      })
      replaceContent(saved)
      setStatus(`Сохранено: ${new Date(saved.updatedAt).toLocaleString('ru-RU')}`)
    } catch (error) {
      setStatus(error.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedLabel = selected?.type === 'text' ? 'Выбран текст' : selected?.type === 'image' ? 'Выбрано изображение' : 'Выберите элемент на странице'

  return (
    <aside className="admin-toolbar" data-admin-ui aria-label="Инструменты редактирования">
      <div className="admin-toolbar-title">
        <strong>Редактор сайта</strong>
        <span>{selectedLabel}</span>
      </div>
      <div className="admin-mode-switch" aria-label="Режим редактирования">
        <button type="button" className={editor.mode === 'text' ? 'active' : ''} onClick={() => editor.selectMode('text')}>
          Текст
        </button>
        <button type="button" className={editor.mode === 'image' ? 'active' : ''} onClick={() => editor.selectMode('image')}>
          Изображения
        </button>
        <button type="button" className={editor.mode === 'blocks' ? 'active' : ''} onClick={() => editor.selectMode('blocks')}>
          Блоки
        </button>
      </div>
      {selected?.type === 'text' ? (
        <div className="admin-selection-actions">
          <button type="button" onClick={clearSelectedText}>Очистить</button>
          <button type="button" onClick={restoreSelected}>Вернуть</button>
        </div>
      ) : null}
      {selected?.type === 'image' ? (
        <div className="admin-selection-actions">
          <button type="button" onClick={() => fileInputRef.current?.click()}>Заменить</button>
          <button type="button" className="danger" onClick={() => updateImage({ removed: true })}>Удалить</button>
          <button type="button" onClick={restoreSelected}>Вернуть</button>
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => uploadImage(event.target.files?.[0])}
      />
      <p className={dirty ? 'admin-status dirty' : 'admin-status'}>
        {saveEnabled ? status : `Сохранение отключено · ${status}`}
      </p>
      <div className="admin-primary-actions">
        <button data-admin-save className="admin-save" type="button" onClick={save} disabled={saving || !saveEnabled}>
          {!saveEnabled ? 'Сохранение отключено' : saving ? 'Сохранение…' : dirty ? 'Сохранить всё •' : 'Сохранить всё'}
        </button>
        <a href="/" target="_blank" rel="noreferrer">Открыть сайт</a>
        <button type="button" onClick={onLogout}>Выйти</button>
      </div>
    </aside>
  )
}

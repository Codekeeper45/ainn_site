import { COLLECTIONS, blankItem } from './model.js'
import { useBlockEditor } from './blockEditor.jsx'
import { useContent } from './ContentContext.jsx'

/**
 * Renders one collection entry. `data-collection-item` is always present so the
 * legacy positional text/image editor skips collection content (those texts
 * are edited through the block panel instead, keeping override keys stable).
 * The edit/move/delete overlay appears only in block mode.
 */
export function CollectionItem({
  as: Tag = 'div',
  collectionId,
  itemId,
  index,
  count,
  className,
  isWide,
  tariffStyle,
  children,
  ...rest
}) {
  const editor = useBlockEditor()
  const { removeItem, moveItem, updateItem } = useContent()
  const blockMode = Boolean(editor) && editor.mode === 'blocks'
  const collection = COLLECTIONS[collectionId]

  const classes = [className, blockMode ? 'admin-block' : ''].filter(Boolean).join(' ')

  const remove = () => {
    const name = collection.singular.toLowerCase()
    if (window.confirm(`Удалить ${name}? Это действие нельзя отменить.`)) {
      removeItem(collectionId, itemId)
    }
  }

  return (
    <Tag
      className={classes}
      data-collection-item=""
      data-collection-id={collectionId}
      data-item-id={itemId}
      {...rest}
    >
      {children}
      {blockMode ? (
        <div className="admin-block-controls" data-admin-ui>
          <button
            type="button"
            title="Переместить выше"
            aria-label="Переместить выше"
            disabled={index === 0}
            onClick={() => moveItem(collectionId, itemId, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            title="Переместить ниже"
            aria-label="Переместить ниже"
            disabled={index === count - 1}
            onClick={() => moveItem(collectionId, itemId, 1)}
          >
            ↓
          </button>
          {collectionId === 'cases' ? (
            <button
              type="button"
              title={isWide ? 'Сделать обычной' : 'Сделать широкой'}
              aria-label={isWide ? 'Сделать обычной' : 'Сделать широкой'}
              onClick={() => updateItem(collectionId, itemId, { wide: !isWide })}
            >
              ↔
            </button>
          ) : null}
          {collectionId === 'tariffs' ? (
            <button
              type="button"
              title="Переключить стиль (обычный / акцентный / премиум)"
              aria-label="Переключить стиль"
              onClick={() => {
                const cur = tariffStyle || ''
                const next = cur === '' ? 'featured' : cur === 'featured' ? 'premium' : ''
                const badge = next === 'featured' ? 'Оптимальный баланс' : ''
                updateItem(collectionId, itemId, { style: next, badge })
              }}
            >
              ★
            </button>
          ) : null}
          <button
            type="button"
            className="danger"
            title="Удалить"
            aria-label="Удалить"
            onClick={remove}
          >
            ✕
          </button>
        </div>
      ) : null}
    </Tag>
  )
}

/** "+ Add" slot rendered after a collection; exists only in block mode. */
export function AddBlockButton({ collectionId, count, as: Tag = 'div', className }) {
  const { addItem } = useContent()
  const editor = useBlockEditor()

  if (!editor || editor.mode !== 'blocks') return null

  const collection = COLLECTIONS[collectionId]
  const atLimit = count >= collection.maxItems

  const add = () => {
    const item = blankItem(collectionId)
    if (item) addItem(collectionId, item)
  }

  return (
    <Tag className={`admin-block-add${className ? ` ${className}` : ''}`} data-admin-ui>
      <button type="button" onClick={add} disabled={atLimit}>
        {atLimit ? `Достигнут лимит: ${collection.maxItems}` : `+ ${collection.addLabel}`}
      </button>
    </Tag>
  )
}

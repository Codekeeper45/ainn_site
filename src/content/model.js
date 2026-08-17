// Single source of truth for editable collections: schema, defaults and
// validation. Shared by the client (React) and server.mjs, so keep this file
// free of React and browser-only APIs.

export const emptyContent = () => ({
  version: 1,
  updatedAt: null,
  texts: {},
  images: {},
  collections: {},
})

export const createId = () =>
  `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const DEFAULT_CASES = [
  {
    id: 'case-bedroom',
    slug: 'case-bedroom',
    title: 'Тихая геометрия',
    room: 'Спальня',
    wide: true,
    image: '',
    width: 1800,
    height: 900,
  },
  {
    id: 'case-kitchen',
    slug: 'case-kitchen',
    title: 'Светлый камень',
    room: 'Кухня',
    wide: false,
    image: '',
    width: 1800,
    height: 1080,
  },
  {
    id: 'case-bathroom',
    slug: 'case-bathroom',
    title: 'Чистый ритм',
    room: 'Ванная',
    wide: false,
    image: '',
    width: 1800,
    height: 1201,
  },
  {
    id: 'case-dark',
    slug: 'case-dark',
    title: 'Графичный контраст',
    room: 'Кухня-гостиная',
    wide: true,
    image: '',
    width: 1800,
    height: 1264,
  },
]

const DEFAULT_SERVICES = [
  {
    id: 'service-design',
    title: 'Планирование и дизайн',
    text: 'Планировка, инженерные решения и сценарии света согласуются до начала работ.',
  },
  {
    id: 'service-rough',
    title: 'Черновые и инженерные работы',
    text: 'Демонтаж, стены, стяжка, электрика и сантехника по проекту.',
  },
  {
    id: 'service-finish',
    title: 'Чистовая отделка',
    text: 'Штукатурка, покраска, плитка, полы, двери и потолки.',
  },
  {
    id: 'service-supply',
    title: 'Комплектация объекта',
    text: 'Подбор и поставка материалов, сантехники и света под утверждённый уровень.',
  },
]

const DEFAULT_ASSURANCES = [
  {
    id: 'assurance-logic',
    title: 'Сначала логика',
    text: 'Планировка, инженерия и сценарии света согласуются до чистовой отделки.',
  },
  {
    id: 'assurance-estimate',
    title: 'Смета до старта',
    text: 'Состав работ и уровень материалов обсуждаются до выхода на объект.',
  },
  {
    id: 'assurance-control',
    title: 'Контроль по этапам',
    text: 'Каждый следующий слой начинается после проверки предыдущего.',
  },
]

const DEFAULT_PROCESS = [
  { id: 'process-01', title: 'Знакомство и замеры', text: 'Осматриваем квартиру, фиксируем размеры, инженерные узлы и исходное состояние.' },
  { id: 'process-02', title: 'Задача и планировка', text: 'Согласуем сценарии помещений, размещение мебели, света и коммуникаций.' },
  { id: 'process-03', title: 'Состав работ и смета', text: 'Определяем объёмы, уровень материалов и последовательность работ до старта.' },
  { id: 'process-04', title: 'Подготовка и демонтаж', text: 'Освобождаем объект и демонтируем только то, что предусмотрено согласованным планом.' },
  { id: 'process-05', title: 'Черновые основания', text: 'Выравниваем стены и пол, готовим основание под последующие слои отделки.' },
  { id: 'process-06', title: 'Электрика и сантехника', text: 'Прокладываем кабели и трубы, устанавливаем выводы и проверяем инженерные системы.' },
  { id: 'process-07', title: 'Чистовая отделка', text: 'Красим стены, укладываем плитку и напольные покрытия, монтируем потолки и двери.' },
  { id: 'process-08', title: 'Финальная комплектация', text: 'Устанавливаем свет, сантехнику и предусмотренные проектом элементы интерьера.' },
  { id: 'process-09', title: 'Проверка и передача', text: 'Проверяем результат по этапам, устраняем замечания и передаём квартиру после уборки.' },
]

const DEFAULT_TARIFFS = [
  {
    id: 'tariff-comfort',
    name: 'Комфорт',
    style: '',
    badge: '',
    text: 'Аккуратный ремонт с проверенными решениями и практичными материалами.',
    items: ['Работы включены', 'Материалы включены', 'Состав фиксируется в смете'],
  },
  {
    id: 'tariff-comfort-plus',
    name: 'Комфорт плюс',
    style: 'featured',
    badge: 'Оптимальный баланс',
    text: 'Больше отделочных решений и инженерии, чем в базовом уровне.',
    items: [
      'Работы включены',
      'Материалы включены',
      'Расширенная инженерия и свет',
      'Состав фиксируется в смете',
    ],
  },
  {
    id: 'tariff-premium',
    name: 'Премиум',
    style: 'premium',
    badge: '',
    text: 'Сложные решения по геометрии, свету и материалам под индивидуальный проект.',
    items: [
      'Работы включены',
      'Материалы включены',
      'Индивидуальные решения и авторский надзор',
      'Состав фиксируется в смете',
    ],
  },
]

const DEFAULT_FAQ = [
  {
    id: 'faq-tariff',
    question: 'Как выбирается тариф ремонта?',
    answer:
      'Тариф определяет уровень комплектации, а не заменяет смету. Финальный состав зависит от площади, состояния квартиры, инженерных задач и выбранных материалов.',
  },
  {
    id: 'faq-separate-works',
    question: 'Можно ли заказать отдельные виды работ?',
    answer:
      'Бриф предусматривает косметический, комплексный ремонт и вариант «под ключ». Возможность отдельного этапа определяется после осмотра объекта и уточнения задачи.',
  },
  {
    id: 'faq-price',
    question: 'Почему стоимость не указана сразу?',
    answer:
      'Цена за квадратный метр остаётся ориентиром, пока не известны исходное состояние, объём демонтажа, инженерия и уровень материалов. Поэтому на сайте не используются неподтверждённые суммы.',
  },
  {
    id: 'faq-engineering',
    question: 'Когда согласуются электрика и сантехника?',
    answer:
      'Расположение света, розеток, выключателей и сантехнических выводов согласуется до штробления и закрытия черновых слоёв.',
  },
  {
    id: 'faq-plan',
    question: 'Можно ли начать работы без полного плана?',
    answer:
      'Подготовительные действия возможны после осмотра, но основные работы безопаснее начинать после согласования планировки, инженерии и последовательности этапов.',
  },
]

const DEFAULT_WALK_STEPS = [
  {
    id: 'walk-logic',
    title: 'Начинаем с несущей логики',
    text: 'Сначала проверяем, как квартира работает: проходы, зоны, инженерия. Отделка идёт последней.',
  },
  {
    id: 'walk-light',
    title: 'Свет проектируется заранее',
    text: 'Сценарии освещения закладываются до штробления. Потом перенести их уже нельзя.',
  },
  {
    id: 'walk-geometry',
    title: 'Материалы держат геометрию',
    text: 'Ровные плоскости, точные стыки и согласованные линии формируют аккуратный результат.',
  },
]

const titleAndTextFields = [
  { name: 'title', label: 'Заголовок', type: 'text', maxLength: 120, required: true },
  { name: 'text', label: 'Текст', type: 'textarea', maxLength: 500 },
]

export const COLLECTIONS = {
  cases: {
    label: 'Кейсы',
    singular: 'Кейс',
    addLabel: 'Добавить кейс',
    maxItems: 24,
    fields: [
      { name: 'title', label: 'Название', type: 'text', maxLength: 120, required: true },
      { name: 'room', label: 'Помещение', type: 'text', maxLength: 80 },
      { name: 'image', label: 'Фото кейса', type: 'image' },
      { name: 'wide', label: 'Широкая карточка (на всю ширину ряда)', type: 'boolean' },
    ],
    blank: () => ({ title: 'Новый кейс', room: '', image: '', wide: false }),
    defaults: DEFAULT_CASES,
  },
  services: {
    label: 'Услуги',
    singular: 'Услуга',
    addLabel: 'Добавить услугу',
    maxItems: 12,
    fields: titleAndTextFields,
    blank: () => ({ title: '', text: '' }),
    defaults: DEFAULT_SERVICES,
  },
  assurances: {
    label: 'Гарантии подхода',
    singular: 'Гарантия',
    addLabel: 'Добавить гарантию',
    maxItems: 9,
    fields: titleAndTextFields,
    blank: () => ({ title: '', text: '' }),
    defaults: DEFAULT_ASSURANCES,
  },
  walkSteps: {
    label: 'Шаги «Как мы ведём ремонт»',
    singular: 'Шаг',
    addLabel: 'Добавить шаг',
    maxItems: 8,
    fields: titleAndTextFields,
    blank: () => ({ title: '', text: '' }),
    defaults: DEFAULT_WALK_STEPS,
  },
  process: {
    label: 'Этапы процесса',
    singular: 'Этап',
    addLabel: 'Добавить этап',
    maxItems: 16,
    fields: titleAndTextFields,
    blank: () => ({ title: '', text: '' }),
    defaults: DEFAULT_PROCESS,
  },
  tariffs: {
    label: 'Тарифы',
    singular: 'Тариф',
    addLabel: 'Добавить тариф',
    maxItems: 6,
    fields: [
      { name: 'name', label: 'Название тарифа', type: 'text', maxLength: 80, required: true },
      { name: 'text', label: 'Описание', type: 'textarea', maxLength: 400 },
      {
        name: 'style',
        label: 'Оформление карточки',
        type: 'select',
        options: [
          { value: '', label: 'Обычное' },
          { value: 'featured', label: 'Выделенное (оптимальный баланс)' },
          { value: 'premium', label: 'Премиум' },
        ],
      },
      { name: 'badge', label: 'Бейдж (короткая подпись у названия)', type: 'text', maxLength: 80 },
      {
        name: 'items',
        label: 'Список «что включено»',
        type: 'list',
        maxItems: 12,
        itemMaxLength: 160,
      },
    ],
    blank: () => ({ name: '', text: '', style: '', badge: '', items: [] }),
    defaults: DEFAULT_TARIFFS,
  },
  faq: {
    label: 'Вопросы и ответы',
    singular: 'Вопрос',
    addLabel: 'Добавить вопрос',
    maxItems: 24,
    fields: [
      { name: 'question', label: 'Вопрос', type: 'text', maxLength: 200, required: true },
      { name: 'answer', label: 'Ответ', type: 'textarea', maxLength: 1000 },
    ],
    blank: () => ({ question: '', answer: '' }),
    defaults: DEFAULT_FAQ,
  },
}

export const COLLECTION_IDS = Object.keys(COLLECTIONS)

export function tariffClassName(style) {
  if (style === 'featured') return 'tariff-featured'
  if (style === 'premium') return 'tariff-premium'
  return ''
}

function isAllowedImageUrl(url) {
  return typeof url === 'string' && (url.startsWith('/uploads/') || url.startsWith('/assets/'))
}

export function normalizeItem(collectionId, raw) {
  const collection = COLLECTIONS[collectionId]
  if (!collection || !raw || typeof raw !== 'object') return null

  const item = {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 80) : '',
  }

  for (const field of collection.fields) {
    const value = raw[field.name]
    switch (field.type) {
      case 'text':
      case 'textarea':
        item[field.name] = typeof value === 'string' ? value.slice(0, field.maxLength || 500) : ''
        break
      case 'boolean':
        item[field.name] = Boolean(value)
        break
      case 'image':
        item[field.name] = isAllowedImageUrl(value) ? value : ''
        break
      case 'select':
        item[field.name] = field.options.some((option) => option.value === value) ? value : ''
        break
      case 'list': {
        const list = Array.isArray(value) ? value : []
        item[field.name] = list
          .filter((entry) => typeof entry === 'string' && entry.trim())
          .slice(0, field.maxItems || 12)
          .map((entry) => entry.slice(0, field.itemMaxLength || 200))
        break
      }
      default:
        break
    }
  }

  // Legacy fields of the built-in cases: keep the bundled webp srcset rendering.
  if (typeof raw.slug === 'string' && /^[\w-]{1,80}$/.test(raw.slug)) item.slug = raw.slug
  for (const dimension of ['width', 'height']) {
    if (Number.isFinite(raw[dimension])) {
      item[dimension] = Math.min(10000, Math.max(1, Math.round(raw[dimension])))
    }
  }

  return item
}

export function normalizeCollection(collectionId, raw) {
  const collection = COLLECTIONS[collectionId]
  if (!collection || !Array.isArray(raw)) return null

  const seen = new Set()
  return raw
    .slice(0, collection.maxItems)
    .map((entry) => normalizeItem(collectionId, entry))
    .filter(Boolean)
    .map((entry) => {
      let id = entry.id
      if (!id || seen.has(id)) id = createId()
      seen.add(id)
      return { ...entry, id }
    })
}

export function normalizeCollections(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const result = {}
  for (const id of COLLECTION_IDS) {
    const normalized = normalizeCollection(id, source[id])
    if (normalized) result[id] = normalized
  }
  return result
}

export function blankItem(collectionId) {
  const collection = COLLECTIONS[collectionId]
  if (!collection) return null
  return { id: createId(), ...collection.blank() }
}

import { useEffect, useRef, useState } from 'react'
import { useSiteMotion } from './useSiteMotion.js'
import { ArrowRight, Check, Menu, X, Mail, Phone, MessageCircle, MapPin } from './components/Icons.jsx'
import Brand from './components/Brand.jsx'
import Brief from './components/Brief.jsx'
import { useCollection } from './content/ContentContext.jsx'
import { AddBlockButton, CollectionItem } from './content/CollectionItem.jsx'
import { tariffClassName } from './content/model.js'

const NAV = [
  { href: '#about', label: 'О нас' },
  { href: '#price', label: 'Прайс' },
  { href: '#cases', label: 'Кейсы' },
  { href: '#contacts', label: 'Контакты' },
]

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const normalizeText = (value) => value.trim().replace(/\s+/g, ' ')

export default function App({ adminMode = false }) {
  useSiteMotion(adminMode)
  const cases = useCollection('cases')
  const services = useCollection('services')
  const assurances = useCollection('assurances')
  const walkSteps = useCollection('walkSteps')
  const processSteps = useCollection('process')
  const tariffs = useCollection('tariffs')
  const faq = useCollection('faq')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const mobileNavRef = useRef(null)

  const closeMenu = ({ restoreFocus = false } = {}) => {
    setMenuOpen(false)
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  useEffect(() => {
    if (!menuOpen) return undefined

    const bodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => mobileNavRef.current?.querySelector(FOCUSABLE)?.focus())

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu({ restoreFocus: true })
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(mobileNavRef.current?.querySelectorAll(FOCUSABLE) || [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const desktop = window.matchMedia('(min-width: 901px)')
    const onDesktop = (event) => {
      if (event.matches) closeMenu()
    }

    document.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', onDesktop)

    return () => {
      document.body.style.overflow = bodyOverflow
      document.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', onDesktop)
    }
  }, [menuOpen])

  return (
    <>
      <a className="skip-link" href="#main-content">
        К основному содержанию
      </a>

      <header className="site-header">
        <a
          className="brand-link"
          href="#top"
          aria-label="REMONT 360° — на главную"
          onClick={() => closeMenu()}
        >
          <Brand />
        </a>

        <nav className="main-nav" aria-label="Основная навигация">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
          <a className="nav-cta" href="#calculator">
            <span>Рассчитать</span>
            <ArrowRight size={16} />
          </a>
        </nav>

        <button
          ref={menuButtonRef}
          className="menu-button"
          type="button"
          aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => (menuOpen ? closeMenu({ restoreFocus: true }) : setMenuOpen(true))}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {menuOpen ? (
        <nav
          ref={mobileNavRef}
          className="mobile-nav"
          id="mobile-navigation"
          aria-label="Мобильная навигация"
          data-lenis-prevent
        >
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => closeMenu()}>
              {item.label}
            </a>
          ))}
          <a href="#calculator" onClick={() => closeMenu()}>
            Рассчитать стоимость
          </a>
        </nav>
      ) : null}

      <main id="main-content" tabIndex={-1}>
        {/* Hero: pinned scene, scroll drives the camera moving into the room. */}
        <section className="hero-shell" id="top" aria-labelledby="hero-title">
          <div className="hero-stage" data-hero-stage aria-hidden="true">
            <div className="hero-fallback" />
          </div>
          <div className="hero-veil" aria-hidden="true" />

          <div className="page-shell hero-content">
            <div data-hero-copy>
              <p className="eyebrow">Алматы · дизайн и ремонт</p>
              <h1 id="hero-title" data-split>
                Ремонт без лишнего шума.
              </h1>
              <p className="hero-sub">
                Смета до старта, один контур ответственности и понятный состав работ на каждом
                этапе.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#calculator">
                  <span>Рассчитать стоимость</span>
                  <ArrowRight size={19} />
                </a>
                <a className="button" href="#cases">
                  <span>Смотреть кейсы</span>
                  <ArrowRight size={19} />
                </a>
              </div>
              <div className="hero-tags">
                <span>Работа и материалы</span>
                <span>Контроль по этапам</span>
                <span>Сдача с проверкой</span>
              </div>
            </div>
          </div>

          <div className="scroll-cue" aria-hidden="true">
            <span>Листайте</span>
          </div>
        </section>

        {/* Cases */}
        <section className="section cases-section" id="cases">
          <div className="page-shell">
            <div className="section-heading" data-reveal>
              <p className="eyebrow">Кейсы</p>
              <h2 data-split>Пространства, которые хочется рассматривать</h2>
              <p>
                Раздел пополняется. Площадь, сроки и состав работ по каждому объекту добавим после
                согласования с заказчиками.
              </p>
            </div>

            <div className="case-stack">
              {cases.map((item, index) => (
                <CollectionItem
                  as="article"
                  key={item.id}
                  collectionId="cases"
                  itemId={item.id}
                  index={index}
                  count={cases.length}
                  isWide={Boolean(item.wide)}
                  className={`case-card${item.wide ? ' case-card-wide' : ''}`}
                  data-reveal="card"
                >
                  <div className="case-image" data-image-reveal>
                    <CaseImage item={item} />
                  </div>
                  <div className="case-meta">
                    <h3>{item.title}</h3>
                    <span>{item.room}</span>
                  </div>
                </CollectionItem>
              ))}
              <AddBlockButton collectionId="cases" count={cases.length} />
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="section services-section" id="services">
          <div className="page-shell services-layout">
            <div className="services-sticky" data-reveal>
              <p className="eyebrow">Услуги</p>
              <h2 data-split>Один проект. Один контур ответственности.</h2>
            </div>
            <div>
              {services.map((service, index) => (
                <CollectionItem
                  as="article"
                  key={service.id}
                  collectionId="services"
                  itemId={service.id}
                  index={index}
                  count={services.length}
                  className="service-row"
                  data-reveal="row"
                >
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <div>
                    <h3>{service.title}</h3>
                    <p>{service.text}</p>
                  </div>
                </CollectionItem>
              ))}
              <AddBlockButton collectionId="services" count={services.length} />
            </div>
          </div>
        </section>

        {/* About + the three renovation assurances that replaced the removed statement */}
        <section className="section about-section" id="about">
          <div className="page-shell">
            <div className="about-layout">
              <div className="about-copy" data-reveal>
                <p className="eyebrow">О компании</p>
                <h2 data-split>REMONT 360° собирает интерьер как точную конструкцию</h2>
                <p>
                  Мы ведём ремонт по порядку: сначала планировка и инженерия, затем черновые слои и
                  только потом отделка. Такой порядок убирает переделки.
                </p>
                <p>
                  Состав работ и уровень материалов фиксируются в смете до выхода на объект. Если по
                  ходу ремонта меняется задача, новый объём сначала согласуется отдельно.
                </p>
                <a className="about-link" href="#process">
                  <span>Как строится работа</span>
                  <ArrowRight size={18} />
                </a>
              </div>

              <div className="about-image" data-image-reveal data-reveal="card">
                <picture>
                  <source
                    type="image/webp"
                    srcSet="/assets/hero-interior-800.webp 800w, /assets/hero-interior-1400.webp 1400w, /assets/hero-interior.webp 2048w"
                    sizes="(max-width: 1120px) 100vw, 50vw"
                  />
                  <img
                    src="/assets/hero-interior.jpg"
                    alt="Интерьер квартиры после ремонта: кухня-гостиная в графитовой гамме"
                    width={2048}
                    height={1448}
                    loading="lazy"
                    decoding="async"
                  />
                </picture>
              </div>
            </div>

            <div className="assurance-grid" data-stagger>
              {assurances.map((item, index) => (
                <CollectionItem
                  as="article"
                  key={item.id}
                  collectionId="assurances"
                  itemId={item.id}
                  index={index}
                  count={assurances.length}
                >
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </CollectionItem>
              ))}
              <AddBlockButton collectionId="assurances" count={assurances.length} />
            </div>
          </div>
        </section>

        {/* Scrubbed walkthrough: scroll continues moving through the space */}
        <section className="walk-scene" data-walk aria-label="Как мы ведём ремонт">
          <div className="walk-media" data-walk-media aria-hidden="true" />
          <div className="walk-grade" aria-hidden="true" />
          <div className="page-shell walk-copy">
            {walkSteps.map((step, index) => (
              <CollectionItem
                key={step.id}
                collectionId="walkSteps"
                itemId={step.id}
                index={index}
                count={walkSteps.length}
                className="walk-step"
                data-walk-step
              >
                <h2>{step.title}</h2>
                <p>{step.text}</p>
              </CollectionItem>
            ))}
            <AddBlockButton collectionId="walkSteps" count={walkSteps.length} />
          </div>
          <div className="walk-progress" data-walk-progress aria-hidden="true">
            <i />
          </div>
        </section>

        {/* Process */}
        <section className="section process-section" id="process">
          <div className="page-shell">
            <div className="section-heading" data-reveal>
              <p className="eyebrow">Процесс</p>
              <h2 data-split>Девять этапов от замера до передачи квартиры</h2>
            </div>
            <ol className="process-list">
              {processSteps.map((step, index) => (
                <CollectionItem
                  as="li"
                  key={step.id}
                  collectionId="process"
                  itemId={step.id}
                  index={index}
                  count={processSteps.length}
                  data-reveal="row"
                >
                  <b>{String(index + 1).padStart(2, '0')}</b>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </CollectionItem>
              ))}
              <AddBlockButton as="li" collectionId="process" count={processSteps.length} />
            </ol>
          </div>
        </section>

        {/* Price */}
        <section className="section price-section" id="price">
          <div className="page-shell">
            <div className="section-heading" data-reveal>
              <p className="eyebrow">Прайс</p>
              <h2 data-split>Три уровня комплектации</h2>
              <p>
                Во всех тарифах учитываются работа и материалы. Точный состав и стоимость
                фиксируются после замера и брифа.
              </p>
            </div>

            <div className="tariff-grid">
              {tariffs.map((tariff, index) => (
                <CollectionItem
                  as="article"
                  key={tariff.id}
                  collectionId="tariffs"
                  itemId={tariff.id}
                  index={index}
                  count={tariffs.length}
                  tariffStyle={tariff.style}
                  className={`tariff ${tariffClassName(tariff.style)}`.trim()}
                  data-reveal="card"
                >
                  <div className="tariff-head">
                    <h3>{tariff.name}</h3>
                    {tariff.badge ? <span>{tariff.badge}</span> : null}
                  </div>
                  <p>{tariff.text}</p>
                  <div className="tariff-price">
                    <strong>Стоимость уточняется</strong>
                    <small>после замера и состава работ</small>
                  </div>
                  <ul>
                    {tariff.items.map((item, itemIndex) => (
                      <li key={`${itemIndex}-${item}`}>
                        <Check size={17} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <a className="button tariff-button" href="#calculator">
                    <span>Уточнить состав</span>
                    <ArrowRight size={18} />
                  </a>
                </CollectionItem>
              ))}
              <AddBlockButton collectionId="tariffs" count={tariffs.length} />
            </div>
          </div>
        </section>

        {/* Brief — mechanics preserved exactly */}
        <Brief />

        <section className="section faq-section" id="faq">
          <div className="page-shell faq-layout">
            <div className="section-heading" data-reveal>
              <p className="eyebrow">Вопросы</p>
              <h2 data-split>Что важно уточнить до начала ремонта</h2>
            </div>
            <div className="faq-list">
              {faq.map((item, index) => (
                <CollectionItem
                  as="details"
                  key={item.id}
                  collectionId="faq"
                  itemId={item.id}
                  index={index}
                  count={faq.length}
                  data-reveal="row"
                >
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </CollectionItem>
              ))}
              <AddBlockButton collectionId="faq" count={faq.length} />
            </div>
          </div>
        </section>

        {/* Reviews */}
        <section className="section reviews-section" id="reviews">
          <div className="page-shell reviews-layout">
            <div className="reviews-copy" data-reveal>
              <p className="eyebrow">Отзывы</p>
              <h2 data-split>Оставить отзыв о ремонте</h2>
              <p>
                Подтверждённые отзывы появятся здесь после согласования публикации. Пока можно
                подготовить текст — форма ничего не отправляет без подключённого канала.
              </p>
            </div>
            <ReviewForm />
          </div>
        </section>

        {/* Final CTA */}
        <section className="final-cta">
          <div className="final-media" data-image-reveal aria-hidden="true">
            <picture>
              <source
                type="image/webp"
                srcSet="/assets/case-dark-800.webp 800w, /assets/case-dark-1400.webp 1400w, /assets/case-dark.webp 1800w"
                sizes="100vw"
              />
              <img
                src="/assets/case-dark.jpg"
                alt=""
                width={1800}
                height={1264}
                loading="lazy"
                decoding="async"
              />
            </picture>
          </div>
          <div className="page-shell final-content" data-reveal>
            <h2 data-split>Начнём с вашей квартиры.</h2>
            <a className="button button-primary" href="#contacts">
              <span>Обсудить проект</span>
              <ArrowRight size={19} />
            </a>
          </div>
        </section>

        {/* Contacts */}
        <section className="section contacts-section" id="contacts">
          <div className="page-shell contacts-layout">
            <div className="contacts-copy" data-reveal>
              <p className="eyebrow">Контакты</p>
              <h2 data-split>Алматы. Начнём с короткого разговора.</h2>
              <p>
                Оставьте имя и телефон — вернёмся с вопросами по объёму работ и договоримся о
                замере, либо свяжитесь с нами напрямую:
              </p>
              <div className="contacts-direct">
                <a className="contact-link" href="https://wa.me/77066606362" target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={18} />
                  <span>Написать в WhatsApp</span>
                </a>
                <a className="contact-link" href="tel:+77066606362">
                  <Phone size={18} />
                  <span>+7 (706) 660-63-62</span>
                </a>
                <a className="contact-link" href="mailto:info@remont360.kz">
                  <Mail size={18} />
                  <span>info@remont360.kz</span>
                </a>
                <div className="contact-link contact-address">
                  <MapPin size={18} />
                  <span>г. Алматы, Казахстан</span>
                </div>
              </div>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-shell footer-inner">
          <a href="#top" aria-label="REMONT 360° — наверх">
            <Brand />
          </a>
          <div className="footer-contacts">
            <a href="tel:+77066606362">+7 (706) 660-63-62</a>
            <span className="footer-divider">·</span>
            <a href="mailto:info@remont360.kz">info@remont360.kz</a>
            <span className="footer-divider">·</span>
            <a href="https://wa.me/77066606362" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          </div>
          <p>© {new Date().getFullYear()} REMONT 360° · Ремонт квартир в Алматы</p>
        </div>
      </footer>
    </>
  )
}

function CaseImage({ item }) {
  const alt = `${item.title}${item.room ? `, ${item.room.toLowerCase()}` : ''}`

  // Uploaded cases render a single image; the built-in ones keep the bundled
  // responsive webp srcset keyed by slug.
  if (item.image || !item.slug) {
    return (
      <img
        src={item.image || '/assets/hero-interior.jpg'}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
    )
  }

  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`/assets/${item.slug}-800.webp 800w, /assets/${item.slug}-1400.webp 1400w, /assets/${item.slug}.webp ${item.width}w`}
        sizes={
          item.wide
            ? '(max-width: 1120px) 100vw, min(100vw, 1280px)'
            : '(max-width: 1120px) 100vw, 50vw'
        }
      />
      <img
        src={`/assets/${item.slug}.jpg`}
        alt={alt}
        width={item.width}
        height={item.height}
        loading="lazy"
        decoding="async"
      />
    </picture>
  )
}

function ReviewForm() {
  const [values, setValues] = useState({ name: '', object: '', review: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setStatus(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    const name = normalizeText(values.name)
    const review = normalizeText(values.review)
    const nextErrors = {}

    if (name.length < 2) nextErrors.name = 'Укажите имя — минимум 2 символа.'
    if (review.length < 20) nextErrors.review = 'Опишите впечатление подробнее — минимум 20 символов.'

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setStatus({ type: 'error', text: 'Проверьте отмеченные поля.' })
      requestAnimationFrame(() => event.currentTarget.querySelector('[aria-invalid="true"]')?.focus())
      return
    }

    setSubmitting(true)
    setStatus(null)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, object: normalizeText(values.object), review }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки отзыва.')
      setValues({ name: '', object: '', review: '' })
      setStatus({
        type: 'success',
        text: 'Спасибо за ваш отзыв! Он отправлен на модерацию и появится на сайте после проверки.',
      })
    } catch (err) {
      setStatus({
        type: 'error',
        text: err.message || 'Ошибка связи с сервером. Пожалуйста, повторите позже.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="field-grid" data-reveal="card" noValidate onSubmit={submit}>
      <div className="field">
        <label htmlFor="review-name">Ваше имя</label>
        <input
          id="review-name"
          name="name"
          type="text"
          autoComplete="name"
          minLength={2}
          maxLength={80}
          value={values.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'review-name-error' : undefined}
          onChange={update('name')}
          required
        />
        {errors.name ? <p className="field-error" id="review-name-error">{errors.name}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="review-object">Номер договора или объекта <span>(необязательно)</span></label>
        <input
          id="review-object"
          name="object"
          type="text"
          maxLength={80}
          value={values.object}
          onChange={update('object')}
        />
      </div>
      <div className="field">
        <label htmlFor="review-text">Отзыв</label>
        <textarea
          id="review-text"
          name="review"
          rows={4}
          minLength={20}
          maxLength={1200}
          value={values.review}
          aria-invalid={Boolean(errors.review)}
          aria-describedby={errors.review ? 'review-text-error' : undefined}
          onChange={update('review')}
          required
        />
        {errors.review ? <p className="field-error" id="review-text-error">{errors.review}</p> : null}
      </div>
      <button className="button button-primary" type="submit" disabled={submitting}>
        <span>{submitting ? 'Отправляем…' : 'Проверить отзыв'}</span>
        <ArrowRight size={18} />
      </button>
      {status ? (
        <p
          className={`form-status form-status-${status.type}`}
          role={status.type === 'error' ? 'alert' : 'status'}
          aria-live={status.type === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {status.text}
        </p>
      ) : null}
    </form>
  )
}

function ContactForm() {
  const [values, setValues] = useState({ name: '', phone: '' })
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentLead, setSentLead] = useState(null)

  const update = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setStatus(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    const name = normalizeText(values.name)
    const phone = normalizeText(values.phone)
    const phoneDigits = phone.replace(/\D/g, '')
    const nextErrors = {}

    if (name.length < 2) nextErrors.name = 'Укажите имя — минимум 2 символа.'
    if (!/^[+\d][\d\s()-]{8,20}$/.test(phone) || phoneDigits.length < 10 || phoneDigits.length > 15) {
      nextErrors.phone = 'Введите номер из 10–15 цифр, например +7 700 000 00 00.'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setStatus({ type: 'error', text: 'Проверьте имя и номер телефона.' })
      requestAnimationFrame(() => event.currentTarget.querySelector('[aria-invalid="true"]')?.focus())
      return
    }

    setSubmitting(true)
    setStatus(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки заявки.')
      setSentLead({ name, phone })
      setValues({ name: '', phone: '' })
      setStatus({
        type: 'success',
        text: 'Заявка успешно принята! Мы перезвоним вам в ближайшее время.',
      })
    } catch (err) {
      setStatus({
        type: 'error',
        text: err.message || 'Ошибка отправки. Пожалуйста, напишите нам в WhatsApp или позвоните.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="field-grid" data-reveal="card" noValidate onSubmit={submit}>
      <div className="field">
        <label htmlFor="contact-name">Имя</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          minLength={2}
          maxLength={80}
          value={values.name}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'contact-name-error' : undefined}
          onChange={update('name')}
          required
        />
        {errors.name ? <p className="field-error" id="contact-name-error">{errors.name}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="contact-phone">Телефон</label>
        <input
          id="contact-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+7 700 000 00 00"
          minLength={10}
          maxLength={21}
          value={values.phone}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? 'contact-phone-error' : 'contact-phone-help'}
          onChange={update('phone')}
          required
        />
        <p className="field-help" id="contact-phone-help">Допустимы цифры, пробелы, скобки, «+» и «-».</p>
        {errors.phone ? <p className="field-error" id="contact-phone-error">{errors.phone}</p> : null}
      </div>
      <button className="button button-primary" type="submit" disabled={submitting}>
        <span>{submitting ? 'Отправляем…' : 'Отправить заявку'}</span>
        <ArrowRight size={18} />
      </button>
      {status ? (
        <div className={`form-status-box form-status-${status.type}`}>
          <p
            className={`form-status form-status-${status.type}`}
            role={status.type === 'error' ? 'alert' : 'status'}
            aria-live={status.type === 'error' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            {status.text}
          </p>
          {status.type === 'success' && sentLead ? (
            <a
              className="button button-lead-wa"
              href={`https://wa.me/77066606362?text=${encodeURIComponent(
                `Здравствуйте! Я оставил заявку на сайте remont360.kz.\nИмя: ${sentLead.name}\nТелефон: ${sentLead.phone}\nХочу обсудить проект ремонта.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} />
              <span>Написать в WhatsApp</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

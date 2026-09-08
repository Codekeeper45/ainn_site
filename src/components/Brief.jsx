import { useState } from 'react'
import { ArrowRight, MessageCircle } from './Icons.jsx'

/**
 * Interactive brief — mechanics preserved from the approved version:
 * area 25–220 m² (default 86), тип ремонта, состояние объекта, уровень материалов.
 * It intentionally does not quote a price: the tariffs state that cost is fixed
 * after a site visit, so inventing a number here would contradict them.
 */

const REPAIR_TYPES = ['Косметический', 'Комплексный', 'Под ключ']
const CONDITIONS = ['Черновая', 'Предчистовая', 'Чистовая']
const MATERIALS = ['Стандарт', 'Стандарт+', 'Премиум']

const AREA_MIN = 25
const AREA_MAX = 220

export default function Brief() {
  const [area, setArea] = useState(86)
  const [type, setType] = useState('Комплексный')
  const [condition, setCondition] = useState('Предчистовая')
  const [material, setMaterial] = useState('Стандарт+')
  const [status, setStatus] = useState('')

  const progress = ((area - AREA_MIN) / (AREA_MAX - AREA_MIN)) * 100

  return (
    <section className="section calculator-section" id="calculator">
      <div className="page-shell calculator-layout">
        <div className="calculator-intro" data-reveal>
          <p className="eyebrow">Бриф</p>
          <h2 data-split>Бриф за минуту</h2>
          <p>
            Ответьте на четыре вопроса. Команда сможет начать разговор уже с понятного объёма
            задачи.
          </p>
          <div className="brief-summary" aria-live="polite">
            <span>{area} м²</span>
            <span>{type}</span>
            <span>{condition}</span>
            <span>{material}</span>
          </div>
        </div>

        <form
          className="calculator-card"
          data-reveal="card"
          onSubmit={(event) => {
            event.preventDefault()
            setStatus(true)
          }}
        >
          <fieldset className="area-field">
            <legend>Площадь квартиры</legend>
            <output htmlFor="area-range">{area} м²</output>
            <input
              id="area-range"
              name="area"
              type="range"
              min={AREA_MIN}
              max={AREA_MAX}
              step={1}
              value={area}
              style={{ '--range-progress': `${progress}%` }}
              onChange={(event) => setArea(Number(event.target.value))}
            />
            <div className="range-labels">
              <span>{AREA_MIN} м²</span>
              <span>{AREA_MAX} м²</span>
            </div>
          </fieldset>

          <ChoiceGroup label="Тип ремонта" options={REPAIR_TYPES} value={type} onChange={setType} />
          <ChoiceGroup
            label="Состояние объекта"
            options={CONDITIONS}
            value={condition}
            onChange={setCondition}
          />
          <ChoiceGroup
            label="Уровень материалов"
            options={MATERIALS}
            value={material}
            onChange={setMaterial}
          />

          <button className="button button-primary form-submit" type="submit">
            Собрать расчёт
            <ArrowRight size={19} />
          </button>

          {status ? (
            <div className="brief-result-box">
              <p className="brief-result-text">
                ✓ Параметры сформированы: <b>{area} м²</b>, <b>{type.toLowerCase()}</b> ремонт, объект <b>{condition.toLowerCase()}</b>, материалы <b>{material.toLowerCase()}</b>.
              </p>
              <div className="brief-result-actions">
                <a
                  className="button button-lead-wa"
                  href={`https://wa.me/77066606362?text=${encodeURIComponent(
                    `Здравствуйте! Хочу рассчитать стоимость ремонта на remont360.kz:\n• Площадь: ${area} м²\n• Тип ремонта: ${type}\n• Состояние: ${condition}\n• Уровень материалов: ${material}\nПодскажите примерную стоимость и сроки?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={18} />
                  <span>Отправить расчёт в WhatsApp</span>
                </a>
                <a className="button button-secondary" href="#contacts">
                  <span>Заказать выезд на замер</span>
                  <ArrowRight size={18} />
                </a>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  )
}

function ChoiceGroup({ label, options, value, onChange }) {
  const groupName = label.toLowerCase().replaceAll(' ', '-')

  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      <div className="choice-row">
        {options.map((option) => (
          <label className={`choice${option === value ? ' active' : ''}`} key={option}>
            <input
              className="visually-hidden"
              type="radio"
              name={groupName}
              value={option}
              checked={option === value}
              onChange={() => onChange(option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

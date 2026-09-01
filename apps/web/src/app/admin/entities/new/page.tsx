import Link from 'next/link'
import { attribute, category, db, eq, place } from '@aividi/db'
import { createEntityAction } from '../../actions'

export const dynamic = 'force-dynamic'

const WEEKDAYS = ['Понеделник', 'Вторник', 'Среда', 'Четврток', 'Петок', 'Сабота', 'Недела']

export default async function NewEntityPage() {
  const towns = await db
    .select({ id: place.id, nameMk: place.nameMk })
    .from(place)
    .where(eq(place.kind, 'grad'))
    .orderBy(place.nameMk)

  const categories = await db
    .select({ id: category.id, nameMk: category.nameMk })
    .from(category)
    .where(eq(category.isPilot, true))
    .orderBy(category.sort)

  const attributes = await db
    .select({ id: attribute.id, nameMk: attribute.nameMk })
    .from(attribute)
    .orderBy(attribute.sort)

  const strumica = towns.find((p) => p.nameMk === 'Струмица')

  return (
    <>
      <nav className="crumbs">
        <Link href="/admin">Админ</Link>
        <span>/</span>
        <Link href="/admin/entities">Субјекти</Link>
        <span>/</span>
        нов
      </nav>

      <h1>Нов бизнис</h1>
      <p className="sub">
        Влегува како извор „Рачен внес (админ)“ со полна доверба и веднаш се означува како
        проверен - истото ниво на доверба што го добива и рачна исправка на постоечки субјект.
      </p>

      <form action={createEntityAction} className="stack">
        <div className="panel panel-pad form-stack">
          <h2 style={{ margin: 0 }}>Основни податоци</h2>
          <div className="grid-2">
            <label>
              <b>Име (МК) *</b>
              <input name="nameMk" required placeholder="Кај Мире" />
            </label>
            <label>
              <b>Име (АЛ)</b>
              <input name="nameSq" />
            </label>
          </div>
          <label>
            <b>Целосно правно име</b>
            <span className="hint">Со фирма - ДООЕЛ и сл., ако е познато.</span>
            <input name="legalName" />
          </label>
          <div className="grid-2">
            <label>
              <b>ЕМБС</b>
              <input name="embs" />
            </label>
            <label>
              <b>ЕДБ</b>
              <input name="edb" />
            </label>
          </div>
        </div>

        <div className="panel panel-pad form-stack">
          <h2 style={{ margin: 0 }}>Локација</h2>
          <label>
            <b>Место *</b>
            <select name="placeId" required defaultValue={strumica?.id ?? ''}>
              <option value="" disabled>
                избери место
              </option>
              {towns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameMk}
                </option>
              ))}
            </select>
          </label>
          <label>
            <b>Адреса</b>
            <input name="address" placeholder="ул. Маршал Тито бр. 1" />
          </label>
          <div className="grid-2">
            <label>
              <b>Гео. ширина</b>
              <input name="lat" type="number" step="any" />
            </label>
            <label>
              <b>Гео. должина</b>
              <input name="lng" type="number" step="any" />
            </label>
          </div>
        </div>

        <div className="panel panel-pad form-stack">
          <h2 style={{ margin: 0 }}>Контакт</h2>
          <div className="grid-2">
            <label>
              <b>Телефон</b>
              <input name="phoneE164" placeholder="070 123 456 или 034 xxx xxx" />
            </label>
            <label>
              <b>Е-пошта</b>
              <input name="email" type="email" />
            </label>
          </div>
          <div className="grid-2">
            <label>
              <b>Веб-страница</b>
              <input name="website" placeholder="example.mk" />
            </label>
            <label>
              <b>Facebook</b>
              <input name="facebook" placeholder="@handle или полн линк" />
            </label>
          </div>
          <label>
            <b>Instagram</b>
            <input name="instagram" placeholder="@handle или полн линк" />
          </label>
        </div>

        <div className="panel panel-pad form-stack">
          <h2 style={{ margin: 0 }}>Опис</h2>
          <label>
            <b>Опис</b>
            <textarea name="descriptionMk" rows={3} />
          </label>
          <label>
            <b>Резиме („Што велат гостите“)</b>
            <span className="hint">Наше резиме во наши зборови, не туѓи рецензии.</span>
            <textarea name="summaryMk" rows={2} />
          </label>
          <label>
            <b>Ценовно ниво</b>
            <select name="priceLevel" defaultValue="">
              <option value="">непознато</option>
              <option value="1">₋ ефтино</option>
              <option value="2">₋₋ средно</option>
              <option value="3">₋₋₋ скапо</option>
              <option value="4">₋₋₋₋ многу скапо</option>
            </select>
          </label>
        </div>

        <div className="panel panel-pad form-stack">
          <h2 style={{ margin: 0 }}>Категории</h2>
          <span className="hint">Штиклирај ги сите што важат; означи една како примарна.</span>
          <div className="stack">
            {categories.map((c) => (
              <label key={c.id} className="row" style={{ gap: 10 }}>
                <input type="checkbox" name="categoryId" value={c.id} />
                {c.nameMk}
                <span className="row" style={{ gap: 4, marginLeft: 'auto' }}>
                  <input type="radio" name="primaryCategoryId" value={c.id} />
                  <span className="hint">примарна</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="panel panel-pad form-stack">
          <h2 style={{ margin: 0 }}>Атрибути</h2>
          <div className="row">
            {attributes.map((a) => (
              <label key={a.id} className="row" style={{ gap: 6 }}>
                <input type="checkbox" name="attributeId" value={a.id} />
                {a.nameMk}
              </label>
            ))}
          </div>
        </div>

        <div className="panel panel-pad form-stack">
          <h2 style={{ margin: 0 }}>Работно време</h2>
          <span className="hint">
            Празно = нема податок. Штиклирај „затворено“ за денови кога не работи.
          </span>
          <div className="stack">
            {WEEKDAYS.map((label, i) => {
              const day = i + 1
              return (
                <div key={day} className="row" style={{ gap: 10 }}>
                  <span style={{ width: 100 }}>{label}</span>
                  <input type="time" name={`hoursOpens${day}`} />
                  <span>–</span>
                  <input type="time" name={`hoursCloses${day}`} />
                  <label className="row" style={{ gap: 4 }}>
                    <input type="checkbox" name={`hoursClosed${day}`} /> затворено
                  </label>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel panel-pad form-stack">
          <h2 style={{ margin: 0 }}>Лого и насловна фотографија</h2>
          <span className="hint">Полн URL или име на датотека од /public/uploads.</span>
          <div className="grid-2">
            <label>
              <b>Лого</b>
              <input name="logoKey" placeholder="logo.png" />
            </label>
            <label>
              <b>Кредит за лого</b>
              <input name="logoCredit" />
            </label>
          </div>
          <div className="grid-2">
            <label>
              <b>Насловна</b>
              <input name="coverKey" placeholder="cover.jpg" />
            </label>
            <label>
              <b>Кредит за насловна</b>
              <input name="coverCredit" />
            </label>
          </div>
        </div>

        <div className="panel panel-pad form-stack">
          <h2 style={{ margin: 0 }}>Статус</h2>
          <label>
            <b>Почетен статус</b>
            <select name="status" defaultValue="published">
              <option value="draft">нацрт</option>
              <option value="review">за преглед</option>
              <option value="published">објавен</option>
            </select>
          </label>
        </div>

        <div>
          <button type="submit" className="primary">
            Зачувај бизнис
          </button>
        </div>
      </form>
    </>
  )
}

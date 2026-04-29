import { useEffect, useState } from 'react'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { legalApi } from '../api/legal'
import { company, fallbackDocuments, legalNav } from '../config/legal'

const pages = {
  requisites: {
    title: 'Реквизиты',
    eyebrow: 'Данные продавца',
    type: null,
  },
  offer: {
    title: 'Публичная оферта',
    eyebrow: 'Условия покупки',
    type: 'offer',
  },
  returns: {
    title: 'Возврат и обмен',
    eyebrow: 'Порядок обращения',
    type: 'returns',
  },
  privacy: {
    title: 'Персональные данные',
    eyebrow: 'Согласие на обработку',
    type: 'privacy',
  },
}

export default function LegalPage() {
  const { section } = useParams()
  const page = pages[section]
  const [profile, setProfile] = useState(company)
  const [document, setDocument] = useState(null)
  const [archive, setArchive] = useState([])

  useEffect(() => {
    legalApi.profile()
      .then(({ data }) => setProfile({ ...company, ...data }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!page?.type) return

    setDocument(fallbackDocuments[page.type])
    setArchive([])

    Promise.all([
      legalApi.currentDocument(page.type),
      legalApi.archive(page.type),
    ])
      .then(([currentRes, archiveRes]) => {
        setDocument(currentRes.data)
        setArchive(Array.isArray(archiveRes.data) ? archiveRes.data : [])
      })
      .catch(() => {})
  }, [page?.type])

  if (!page) return <Navigate to="/legal/requisites" replace />

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="max-w-3xl mb-8">
        <p className="font-body text-xs text-sage-600 uppercase tracking-widest mb-2">
          {page.eyebrow}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-light text-stone-800 leading-tight">
          {page.title}
        </h1>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6 items-start">
        <nav className="card p-3 lg:sticky lg:top-24">
          {legalNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'block rounded-xl px-3 py-2.5 text-sm font-body transition-colors',
                  isActive
                    ? 'bg-sage-100 text-sage-700'
                    : 'text-stone-600 hover:bg-sand-100 hover:text-stone-800'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <article className="card p-6 sm:p-8">
          {section === 'requisites'
            ? <Requisites profile={profile} />
            : <DocumentView document={document || fallbackDocuments[page.type]} archive={archive} />
          }
        </article>
      </div>
    </div>
  )
}

function Requisites({ profile }) {
  const rows = [
    ['Полное наименование', profile.legalName],
    ['Сокращенное наименование', profile.shortName],
    ['ИНН', profile.inn],
    ['КПП', profile.kpp],
    ['ОГРН', profile.ogrn],
    ['Дата регистрации', profile.registrationDate],
    ['Генеральный директор', profile.director],
    ['Юридический адрес', profile.address],
  ]

  return (
    <LegalGrid rows={rows} />
  )
}

function DocumentView({ document, archive }) {
  return (
    <div>
      <ContentText content={document?.content || ''} />
      {archive.length > 0 && (
        <section className="mt-8 pt-6 border-t border-sand-100">
          <h2 className="font-display text-2xl text-stone-800 mb-3">Архив версий</h2>
          <div className="space-y-2">
            {archive.map((item) => (
              <details key={item.id} className="rounded-2xl bg-sand-50 px-4 py-3">
                <summary className="cursor-pointer font-body text-sm text-stone-700">
                  {archiveTitle(item)}
                </summary>
                <div className="mt-4">
                  <ContentText content={item.content} compact />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ContentText({ content, compact = false }) {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        const [first, ...rest] = block.split('\n')
        const hasBody = rest.length > 0

        if (!hasBody) {
          return (
            <p key={index} className="font-body text-sm sm:text-base text-stone-600 leading-relaxed whitespace-pre-line">
              {first}
            </p>
          )
        }

        return (
          <section key={index}>
            <h2 className={`font-display text-stone-800 mb-2 ${compact ? 'text-xl' : 'text-2xl'}`}>
              {first}
            </h2>
            <p className="font-body text-sm sm:text-base text-stone-600 leading-relaxed whitespace-pre-line">
              {rest.join('\n')}
            </p>
          </section>
        )
      })}
    </div>
  )
}

function archiveTitle(item) {
  const typeLabel = item.type === 'privacy'
    ? 'Согласие на обработку ПД'
    : item.type === 'returns'
    ? 'Возврат'
    : 'Оферта'
  return `${typeLabel} с ${formatShortDate(item.effectiveFrom)} по ${formatShortDate(item.effectiveTo)}`
}

function formatShortDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\./g, '')
}

function LegalGrid({ rows }) {
  return (
    <div className="divide-y divide-sand-100">
      {rows.map(([label, value]) => (
        <div key={label} className="grid sm:grid-cols-[220px_1fr] gap-1 sm:gap-4 py-3">
          <dt className="font-body text-xs text-stone-400 uppercase tracking-wider">{label}</dt>
          <dd className="font-body text-sm text-stone-700 leading-relaxed">{value}</dd>
        </div>
      ))}
    </div>
  )
}

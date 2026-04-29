import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { company, legalNav } from '../config/legal'
import { legalApi } from '../api/legal'

export default function ContactsPage() {
  const [profile, setProfile] = useState(company)

  useEffect(() => {
    legalApi.profile()
      .then(({ data }) => setProfile(mapProfile(data)))
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="max-w-3xl mb-8">
        <p className="font-body text-xs text-sage-600 uppercase tracking-widest mb-2">
          Связь с продавцом
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-light text-stone-800 leading-tight">
          Контакты
        </h1>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <section className="card p-6 sm:p-8">
          <div className="grid sm:grid-cols-2 gap-4">
            <ContactItem label="Компания" value={profile.legalName} />
            <ContactItem label="Бренд сервиса" value={profile.brand} />
            <ContactItem label="Режим работы" value={profile.workHours} />
            <ContactItem label="Телефон" value={profile.supportPhone} />
            <ContactItem label="Email" value={profile.supportEmail} />
            <ContactItem label="Адрес" value={profile.address} />
          </div>
        </section>

        <aside className="card p-5">
          <p className="font-body text-xs text-stone-400 uppercase tracking-wider mb-3">
            Юридическая информация
          </p>
          <div className="flex flex-col gap-1">
            {legalNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-xl px-3 py-2 text-sm font-body text-stone-600 hover:bg-sand-100 hover:text-stone-800 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

function mapProfile(profile) {
  return {
    ...company,
    ...profile,
  }
}

function ContactItem({ label, value, muted }) {
  return (
    <div className="rounded-2xl bg-sand-50 p-4">
      <p className="font-body text-xs text-stone-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-body text-sm leading-relaxed ${muted ? 'text-amber-700' : 'text-stone-700'}`}>
        {value}
      </p>
    </div>
  )
}

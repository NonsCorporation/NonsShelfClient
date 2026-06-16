import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from '@/lib/router'
import Layout from '../components/layout/Layout'
import PersonModal from '../components/PersonModal'
import { authedFetch } from '../lib/api'
import { isLibrarian } from '../services/librarianService'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { IoArrowBack, IoPersonOutline, IoBookOutline, IoFilmOutline, IoCreateOutline } from 'react-icons/io5'

// Shape returned by GET /api/people/:uuid.
interface PersonResp {
  person: {
    uuid: string
    name: string
    photo_url?: string
    bio?: string
    birth_year?: number
  }
  aliases: { name: string; lang?: string }[]
  credits: {
    role: string
    character?: string
    media: { uuid: string; type: 'book' | 'movie'; title: string; year?: number; cover_url?: string }
  }[]
}

// Role display order + labels. The same person can appear under several groups
// (an actor who also directs and writes).
const ROLE_ORDER = ['actor', 'director', 'writer', 'author', 'translator'] as const
const ROLE_LABEL: Record<string, string> = {
  actor: 'Actor', director: 'Director', writer: 'Writer', author: 'Author', translator: 'Translator',
}

// Books live at /b/<uuid>, movies at /m/<uuid>.
const mediaHref = (m: PersonResp['credits'][number]['media']) =>
  `${m.type === 'book' ? '/b' : '/m'}/${m.uuid}`

export default function PersonPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { uuid } = useParams<{ uuid: string }>()
  const [data, setData] = useState<PersonResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const canEdit = isLibrarian(user?.role)

  const load = useCallback(() => {
    if (!uuid) return
    authedFetch(`/api/people/${uuid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [uuid])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <Layout>
        <div className="py-24 text-center text-[var(--text-muted)]">{t('loading')}</div>
      </Layout>
    )
  }
  if (!data) {
    return (
      <Layout>
        <div className="py-24 text-center text-[var(--text-muted)]">{t('itemNotFound') || 'Not found'}</div>
      </Layout>
    )
  }

  const { person, aliases, credits } = data
  const grouped = ROLE_ORDER.map((role) => ({
    role,
    items: credits.filter((c) => c.role === role),
  })).filter((g) => g.items.length > 0)

  return (
    <Layout>
      <button
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
      >
        <IoArrowBack className="h-4 w-4" />
        {t('back')}
      </button>

      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        {/* ── Left: portrait ── */}
        <div className="w-full flex-shrink-0 md:w-56">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
            {person.photo_url ? (
              <img src={person.photo_url} alt={person.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--container-2)]">
                <IoPersonOutline className="h-10 w-10 text-[var(--placeholder)]" />
              </div>
            )}
          </div>
        </div>

        {/* ── Right: identity + credits ── */}
        <div className="flex flex-1 flex-col gap-6">
          <div>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-[var(--text)] md:text-[2.6rem]">
                {person.name}
              </h1>
              {canEdit && (
                <button
                  onClick={() => setEditing(true)}
                  title={t('edit')}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:border-nonsprimary hover:text-nonsprimary"
                >
                  <IoCreateOutline className="h-4 w-4" />
                </button>
              )}
            </div>
            {person.birth_year ? (
              <p className="mt-1 text-sm text-[var(--text-muted)]">b. {person.birth_year}</p>
            ) : null}
            {aliases.length > 0 && (
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {t('alsoKnownAs') || 'Also known as'}:{' '}
                <span className="text-[var(--text)]">{aliases.map((a) => a.name).join(' · ')}</span>
              </p>
            )}
          </div>

          {person.bio && (
            <div>
              <h3 className="mb-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">{t('about') || 'About'}</h3>
              <p className="text-sm leading-7 text-[var(--text-muted)]">{person.bio}</p>
            </div>
          )}

          <hr className="border-[var(--divider)]" />

          {grouped.map(({ role, items }) => (
            <div key={role}>
              <h3 className="mb-3 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                {ROLE_LABEL[role] || role}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((c) => (
                  <Link
                    key={`${role}-${c.media.uuid}`}
                    to={mediaHref(c.media)}
                    className="group flex flex-col gap-2"
                  >
                    <div className="aspect-[2/3] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)]">
                      {c.media.cover_url ? (
                        <img
                          src={c.media.cover_url}
                          alt={c.media.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {c.media.type === 'book' ? (
                            <IoBookOutline className="h-7 w-7 text-[var(--placeholder)]" />
                          ) : (
                            <IoFilmOutline className="h-7 w-7 text-[var(--placeholder)]" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{c.media.title}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {c.character ? c.character : c.media.year || ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <PersonModal
        isOpen={editing}
        person={{ id: 0, credit_count: 0, uuid: person.uuid, name: person.name, photo_url: person.photo_url, bio: person.bio }}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          load()
        }}
      />
    </Layout>
  )
}

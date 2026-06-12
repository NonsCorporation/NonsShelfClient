import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/layout/Layout'
import CatalogCard from '../components/CatalogCard'
import { catalogService, compactCount } from '../services/catalogService'
import type { CatalogItem } from '../services/catalogService'
import { libraryService } from '../services/libraryService'
import type { MediaItem } from '../types'
import { useLanguage } from '../contexts/LanguageContext'
import { IoStar, IoFlame, IoPeopleOutline } from 'react-icons/io5'

const keyOf = (it: { type: string; title: string }) => `${it.type}:${it.title.trim().toLowerCase()}`

export default function DiscoverPage() {
  const { t } = useLanguage()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [libKeys, setLibKeys] = useState<Set<string>>(new Set())
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([catalogService.getCatalog(), libraryService.getItems()]).then(([cat, lib]) => {
      setCatalog(cat)
      setLibKeys(new Set(lib.map(keyOf)))
      setLoading(false)
    })
  }, [])

  const inLibrary = (it: CatalogItem) => libKeys.has(keyOf(it)) || added.has(keyOf(it))

  const handleAdd = async (it: CatalogItem) => {
    // it.id is the backend media id — pass it so the item is added to the shelf
    // against the existing catalog row instead of creating a duplicate.
    const payload: Omit<MediaItem, 'id'> & { id?: string } = {
      id: it.id,
      type: it.type,
      title: it.title,
      author: it.author,
      director: it.director,
      coverUrl: it.coverUrl,
      year: it.year,
      genre: it.genre,
      description: it.description,
      status: 'wishlist',
    }
    await libraryService.addItem(payload)
    setAdded((prev) => new Set(prev).add(keyOf(it)))
  }

  const trending = useMemo(() => [...catalog].sort((a, b) => b.trendScore - a.trendScore), [catalog])
  const featured = trending[0]
  const recommended = useMemo(() => catalog.filter((c) => c.recommendedBecause), [catalog])
  const popularBooks = useMemo(
    () => catalog.filter((c) => c.type === 'book').sort((a, b) => b.ratingsCount - a.ratingsCount),
    [catalog],
  )
  const popularFilms = useMemo(
    () => catalog.filter((c) => c.type === 'movie').sort((a, b) => b.ratingsCount - a.ratingsCount),
    [catalog],
  )

  const Row = ({ title, items, showReason }: { title: string; items: CatalogItem[]; showReason?: boolean }) =>
    items.length === 0 ? null : (
      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-[var(--text)]">{title}</h2>
        <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
          {items.map((it) => (
            <div key={it.id} className="w-36 flex-shrink-0 sm:w-40">
              <CatalogCard item={it} inLibrary={inLibrary(it)} onAdd={() => handleAdd(it)} showReason={showReason} />
            </div>
          ))}
        </div>
      </section>
    )

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">{t('discover')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{t('discoverSubtitle')}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        <div className="animate-fade-up">
          {/* Featured — top trending, hero on top */}
          {featured && (
            <section className="mb-10">
              <div className="mb-3 flex items-center gap-2">
                <IoFlame className="h-4 w-4 text-nonslightred" />
                <h2 className="text-base font-semibold text-[var(--text)]">{t('trendingNow')}</h2>
              </div>
              <div className="flex flex-col gap-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--container)] p-4 sm:flex-row sm:p-5">
                <div className="aspect-[2/3] w-32 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--container-2)] sm:w-44">
                  {featured.coverUrl && (
                    <img src={featured.coverUrl} alt={featured.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-[var(--text-muted)]">
                    <span>{featured.type === 'book' ? t('book') : t('film')}</span>
                    {featured.year && (
                      <>
                        <span className="text-[var(--border-strong)]">·</span>
                        <span>{featured.year}</span>
                      </>
                    )}
                    {featured.genre && featured.genre.length > 0 && (
                      <>
                        <span className="text-[var(--border-strong)]">·</span>
                        <span className="normal-case tracking-normal">{featured.genre.slice(0, 3).join(', ')}</span>
                      </>
                    )}
                  </div>

                  <h3 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight text-[var(--text)]">
                    {featured.title}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    {featured.type === 'book' ? featured.author : featured.director || featured.author}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
                      <IoStar className="h-4 w-4 text-nonsprimaryfocus" />
                      {featured.communityRating.toFixed(1)}
                      <span className="font-normal text-[var(--text-muted)]">
                        ({compactCount(featured.ratingsCount)})
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                      <IoPeopleOutline className="h-4 w-4" />
                      {t(featured.type === 'book' ? 'membersReading' : 'membersWatching', {
                        n: compactCount(featured.activeNow),
                      })}
                    </span>
                  </div>

                  {featured.description && (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--text-muted)]">
                      {featured.description}
                    </p>
                  )}

                  <div className="mt-auto pt-4">
                    <button
                      onClick={() => handleAdd(featured)}
                      disabled={inLibrary(featured)}
                      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors ${
                        inLibrary(featured)
                          ? 'cursor-default border border-[var(--border-subtle)] text-[var(--text-muted)]'
                          : 'bg-nonsprimary text-white hover:bg-nonsprimaryfocus'
                      }`}
                    >
                      {inLibrary(featured) ? t('inLibrary') : t('addToLibrary')}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          <Row title={t('recommendedForYou')} items={recommended} showReason />
          <Row title={t('trendingNow')} items={trending.slice(1)} />
          <Row title={t('popularBooks')} items={popularBooks} />
          <Row title={t('popularFilms')} items={popularFilms} />
        </div>
      )}
    </Layout>
  )
}

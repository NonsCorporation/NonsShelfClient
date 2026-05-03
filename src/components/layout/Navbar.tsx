import { Link, useLocation } from 'react-router-dom';
import { IoCalendarOutline, IoHomeOutline, IoFilm, IoLanguage } from 'react-icons/io5';
import { useLanguage } from '../../contexts/LanguageContext';

export default function Navbar() {
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();

  const navItems = [
    { label: t('home'), to: '/', icon: IoHomeOutline },
    { label: t('calendar'), to: '/calendar', icon: IoCalendarOutline },
  ];

  const utilityItems = [
    { label: 'Oppenheimer', to: '/oppenheimer', icon: IoFilm },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="flex items-center gap-2.5 self-start">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface)]">
            <img src="/favicon.svg" alt="Nons Shelf" className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-[var(--text)]">Nons Shelf</p>
          </div>
        </Link>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex rounded-xl bg-[var(--surface)] p-1 border border-[var(--border-subtle)]">
            <button
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${language === 'en' ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('ru')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${language === 'ru' ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              RU
            </button>
          </div>

          {utilityItems.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-[var(--surface-active)] text-[var(--text)]' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
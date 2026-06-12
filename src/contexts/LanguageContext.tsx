import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type Language = 'en' | 'ru';

interface Translations {
  [key: string]: {
    [key in Language]: string;
  };
}

export const translations: Translations = {
  searchPlaceholder: {
    en: 'Search by title or author',
    ru: 'Поиск по названию или автору',
  },
  all: {
    en: 'All',
    ru: 'Все',
  },
  books: {
    en: 'Books',
    ru: 'Книги',
  },
  movies: {
    en: 'Movies',
    ru: 'Фильмы',
  },
  clearFilters: {
    en: 'Clear Filters',
    ru: 'Сбросить фильтры',
  },
  type: {
    en: 'Type',
    ru: 'Тип',
  },
  commonFilters: {
    en: 'Common Filters',
    ru: 'Общие фильтры',
  },
  tagStatusPlaceholder: {
    en: 'Tag / Status (e.g. Read, Watched)',
    ru: 'Тег / Статус (например, Прочитано, Просмотрено)',
  },
  year: {
    en: 'Year',
    ru: 'Год',
  },
  genre: {
    en: 'Genre',
    ru: 'Жанр',
  },
  directorActors: {
    en: 'Director & Actors',
    ru: 'Режиссер и актеры',
  },
  director: {
    en: 'Director',
    ru: 'Режиссер',
  },
  actor: {
    en: 'Actor',
    ru: 'Актер',
  },
  addNewEntry: {
    en: 'Add New Entry',
    ru: 'Добавить запись',
  },
  chooseTypeDesc: {
    en: 'Choose a type and fill in the details',
    ru: 'Выберите тип и заполните детали',
  },
  book: {
    en: 'Book',
    ru: 'Книга',
  },
  movie: {
    en: 'Movie',
    ru: 'Фильм',
  },
  title: {
    en: 'Title',
    ru: 'Название',
  },
  authorDirector: {
    en: 'Author / Director',
    ru: 'Автор / Режиссер',
  },
  coverUrl: {
    en: 'Cover URL',
    ru: 'Ссылка на обложку',
  },
  genrePlaceholder: {
    en: 'Genre (comma separated)',
    ru: 'Жанр (через запятую)',
  },
  tagsPlaceholder: {
    en: 'Tags (comma separated, e.g. Read, Want to Watch)',
    ru: 'Теги (через запятую, например, Прочитано)',
  },
  actorsPlaceholder: {
    en: 'Actors (comma separated)',
    ru: 'Актеры (через запятую)',
  },
  save: {
    en: 'Save',
    ru: 'Сохранить',
  },
  cancel: {
    en: 'Cancel',
    ru: 'Отмена',
  },
  delete: {
    en: 'Delete',
    ru: 'Удалить',
  },
  add: {
    en: 'Add',
    ru: 'Добавить',
  },
  home: {
    en: 'Home',
    ru: 'Главная',
  },
  calendar: {
    en: 'Calendar',
    ru: 'Календарь',
  },
  mediaCalendar: {
    en: 'Media Calendar',
    ru: 'Медиа Календарь',
  },
  calendarSubtitle: {
    en: 'What have you watched and read this month?',
    ru: 'Что вы посмотрели и прочитали в этом месяце?',
  },
  mon: { en: 'Mon', ru: 'Пн' },
  tue: { en: 'Tue', ru: 'Вт' },
  wed: { en: 'Wed', ru: 'Ср' },
  thu: { en: 'Thu', ru: 'Чт' },
  fri: { en: 'Fri', ru: 'Пт' },
  sat: { en: 'Sat', ru: 'Сб' },
  sun: { en: 'Sun', ru: 'Вс' },
  loading: { en: 'Loading...', ru: 'Загрузка...' },
  itemNotFound: { en: 'Item not found', ru: 'Запись не найдена' },
  saved: { en: 'Saved', ru: 'Сохранено' },
  film: { en: 'Film', ru: 'Фильм' },
  writtenBy: { en: 'Written by', ru: 'Автор:' },
  directedBy: { en: 'Directed by', ru: 'Режиссер:' },
  synopsis: { en: 'Synopsis', ru: 'Синопсис' },
  noDescription: { en: 'No description available.', ru: 'Описание отсутствует.' },
  cast: { en: 'Cast', ru: 'В ролях' },
  yourReview: { en: 'Your Review', ru: 'Ваш отзыв' },
  reviewPlaceholder: { 
    en: 'What did you think of this {type}?', 
    ru: 'Что вы думаете об этой {type}?' 
  },
  editDetails: { en: 'Edit Details', ru: 'Редактировать детали' },
  updateInfo: { 
    en: 'Update the information for this {type}', 
    ru: 'Обновить информацию об этой {type}' 
  },
  pages: { en: 'Pages', ru: 'Страницы' },
  duration: { en: 'Duration', ru: 'Длительность' },
  durationPlaceholder: { en: 'E.g., 120 min', ru: 'Например, 120 мин' },
  pagesCount: { en: '{count} pages', ru: '{count} стр.' },

  // Library / shelves
  library: { en: 'Library', ru: 'Библиотека' },
  librarySubtitle: { en: 'Your books and films, all in one shelf.', ru: 'Ваши книги и фильмы на одной полке.' },
  shelves: { en: 'Shelves', ru: 'Полки' },
  browse: { en: 'Browse', ru: 'Обзор' },
  allItems: { en: 'Everything', ru: 'Всё' },
  favorites: { en: 'Favorites', ru: 'Избранное' },
  shelfWishlist: { en: 'Want to', ru: 'В планах' },
  shelfActive: { en: 'In progress', ru: 'В процессе' },
  shelfDone: { en: 'Finished', ru: 'Завершено' },
  continueHint: { en: 'Pick up where you left off', ru: 'Продолжите с того места, где остановились' },
  hide: { en: 'Hide', ru: 'Скрыть' },
  show: { en: 'Show', ru: 'Показать' },
  inProgressHiddenHint: {
    en: 'The “In progress” section is hidden. Click the eye next to In progress in the shelves to bring it back.',
    ru: 'Раздел «В процессе» скрыт. Нажмите на глаз рядом с «В процессе» в полках, чтобы вернуть его.',
  },
  wantToRead: { en: 'Want to read', ru: 'Хочу прочитать' },
  wantToWatch: { en: 'Want to watch', ru: 'Хочу посмотреть' },
  reading: { en: 'Reading', ru: 'Читаю' },
  watching: { en: 'Watching', ru: 'Смотрю' },
  read: { en: 'Read', ru: 'Прочитано' },
  watched: { en: 'Watched', ru: 'Просмотрено' },

  // Stats
  statTotal: { en: 'Total', ru: 'Всего' },
  statBooks: { en: 'Books', ru: 'Книги' },
  statMovies: { en: 'Films', ru: 'Фильмы' },
  statAvg: { en: 'Avg. rating', ru: 'Ср. оценка' },
  statFinished: { en: 'Finished', ru: 'Завершено' },

  // Feed
  feedSubtitle: { en: 'Updates from you and the people you follow.', ru: 'Обновления от вас и тех, на кого вы подписаны.' },
  friendsActivity: { en: 'Friends activity', ru: 'Активность друзей' },
  noActivity: { en: 'No activity yet.', ru: 'Пока нет активности.' },
  verbRated: { en: 'rated', ru: 'оценил(а)' },
  verbFinished: { en: 'finished', ru: 'завершил(а)' },
  verbStarted: { en: 'started', ru: 'начал(а)' },
  verbAdded: { en: 'added', ru: 'добавил(а)' },
  verbReviewed: { en: 'reviewed', ru: 'оставил(а) отзыв на' },

  // Discover / social
  discover: { en: 'Discover', ru: 'Интересное' },
  discoverSubtitle: {
    en: 'What the community is reading and watching right now.',
    ru: 'Что сообщество читает и смотрит прямо сейчас.',
  },
  trendingNow: { en: 'Trending now', ru: 'Сейчас в тренде' },
  popularBooks: { en: 'Popular books', ru: 'Популярные книги' },
  popularFilms: { en: 'Popular films', ru: 'Популярные фильмы' },
  recommendedForYou: { en: 'Recommended for you', ru: 'Рекомендуем вам' },
  addToLibrary: { en: 'Add', ru: 'Добавить' },
  inLibrary: { en: 'In library', ru: 'В библиотеке' },
  ratingsCountLabel: { en: '{n} ratings', ru: 'оценок: {n}' },
  membersReading: { en: '{n} reading now', ru: 'читают сейчас: {n}' },
  membersWatching: { en: '{n} watching now', ru: 'смотрят сейчас: {n}' },

  // Search / global
  globalSearch: { en: 'Search books & films…', ru: 'Поиск книг и фильмов…' },
  searchResults: { en: 'Results for "{q}"', ru: 'Результаты по запросу «{q}»' },
  searchLibrary: { en: 'Search your library…', ru: 'Поиск в библиотеке…' },
  viewProfile: { en: 'View profile', ru: 'Открыть профиль' },
  logout: { en: 'Log out', ru: 'Выйти' },
  login: { en: 'Sign in', ru: 'Войти' },
  loginSubtitle: { en: 'Sign in with your nons account.', ru: 'Войдите с аккаунтом nons.' },
  loginEmailOrUsername: { en: 'Email or username', ru: 'Эл. почта или имя пользователя' },
  loginPassword: { en: 'Password', ru: 'Пароль' },
  loginSubmitting: { en: 'Signing in…', ru: 'Вход…' },

  // Signed-out landing page
  landingEyebrow: { en: 'Part of the nons family', ru: 'Часть семейства nons' },
  landingTitle: { en: 'Every book and film you love,', ru: 'Все любимые книги и фильмы —' },
  landingTitle2: { en: 'on one shelf.', ru: 'на одной полке.' },
  landingSubtitle: {
    en: 'Track what you read and watch, rate it, and see what your friends on nons are into — without the noise.',
    ru: 'Отмечайте, что читаете и смотрите, ставьте оценки и следите, чем увлечены ваши друзья в nons — без лишнего шума.',
  },
  landingCta: { en: 'Continue with nons', ru: 'Продолжить с nons' },
  landingSsoNote: {
    en: 'One nons account — sign in once, use every nons app.',
    ru: 'Один аккаунт nons — войдите один раз и пользуйтесь всеми приложениями.',
  },
  landingFeat1Title: { en: 'Books and films together', ru: 'Книги и фильмы вместе' },
  landingFeat1Text: {
    en: 'Want to, in progress, finished — shelves that match how you actually read and watch.',
    ru: 'Хочу, в процессе, завершено — полки, которые соответствуют тому, как вы читаете и смотрите.',
  },
  landingFeat2Title: { en: 'Ratings from your circle', ru: 'Оценки вашего круга' },
  landingFeat2Text: {
    en: 'See what your nons friends are reading and watching — recommendations from people, not algorithms.',
    ru: 'Смотрите, что читают и смотрят ваши друзья в nons — рекомендации от людей, а не алгоритмов.',
  },
  landingFeat3Title: { en: 'Powered by your nons account', ru: 'Работает на вашем аккаунте nons' },
  landingFeat3Text: {
    en: 'Your profile, friends and privacy settings follow you here. No new account, no new password.',
    ru: 'Ваш профиль, друзья и настройки приватности доступны и здесь. Без нового аккаунта и пароля.',
  },
  landingFooterNons: {
    en: 'Built on the nons platform — nonsapp.com',
    ru: 'Создано на платформе nons — nonsapp.com',
  },
  landingLovedWeek: { en: 'Loved this week', ru: 'Понравилось на этой неделе' },
  landingQuote1: {
    en: 'Finally one shelf for everything — I rate a film and my friends actually see it.',
    ru: 'Наконец одна полка для всего — я оцениваю фильм, и друзья это действительно видят.',
  },
  landingQuote2: {
    en: 'The “in progress” shelf quietly replaced three apps for me.',
    ru: 'Полка «в процессе» незаметно заменила мне три приложения.',
  },
  landingQuote3: {
    en: 'Recommendations come from my circle on nons, not from an algorithm.',
    ru: 'Рекомендации приходят от моего круга в nons, а не от алгоритма.',
  },
  profileSubtitle: { en: 'Your shelf at a glance', ru: 'Ваша полка с высоты птичьего полёта' },

  // Controls
  sortBy: { en: 'Sort', ru: 'Сортировка' },
  sortAdded: { en: 'Recently added', ru: 'Недавно добавленные' },
  sortRating: { en: 'Highest rated', ru: 'По рейтингу' },
  sortTitle: { en: 'Title (A–Z)', ru: 'Название (А–Я)' },
  sortYear: { en: 'Newest', ru: 'По году' },
  gridView: { en: 'Grid', ru: 'Сетка' },
  listView: { en: 'List', ru: 'Список' },
  addEntry: { en: 'Add', ru: 'Добавить' },
  filters: { en: 'Filters', ru: 'Фильтры' },
  noResults: { en: 'Nothing on this shelf yet.', ru: 'На этой полке пока пусто.' },
  noResultsHint: { en: 'Try a different shelf, or add something new.', ru: 'Выберите другую полку или добавьте новое.' },
  showing: { en: 'Showing {n} of {total}', ru: 'Показано {n} из {total}' },
  itemsCount: { en: '{n} items', ru: '{n} элементов' },

  // Status control
  status: { en: 'Status', ru: 'Статус' },
  unrated: { en: 'Unrated', ru: 'Без оценки' },
  markFavorite: { en: 'Add to favorites', ru: 'В избранное' },
  unmarkFavorite: { en: 'Remove from favorites', ru: 'Убрать из избранного' },
  back: { en: 'Back', ru: 'Назад' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved === 'en' || saved === 'ru') return saved;
    
    // Default to browser language if supported
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'ru') return 'ru';
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string, variables?: Record<string, string | number>): string => {
    if (!translations[key]) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
    let translation = translations[key][language];
    if (variables) {
      Object.entries(variables).forEach(([name, value]) => {
        translation = translation.replace(`{${name}}`, String(value));
      });
    }
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

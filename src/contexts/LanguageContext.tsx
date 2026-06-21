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
  userNotFound: { en: 'User not found', ru: 'Пользователь не найден' },
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
  originalTitle: { en: 'Original title', ru: 'Оригинальное название' },
  firstPublished: { en: 'First published', ru: 'Год издания' },
  name: { en: 'Name', ru: 'Имя' },
  bio: { en: 'Bio', ru: 'Биография' },
  birthYear: { en: 'Birth year', ru: 'Год рождения' },
  birthDate: { en: 'Date of birth', ru: 'Дата рождения' },
  altNames: { en: 'Alternative names', ru: 'Альтернативные имена' },
  altNamesPlaceholder: { en: 'Comma-separated (e.g. Достоевский, Dostoevsky)', ru: 'Через запятую (напр. Достоевский, Dostoevsky)' },
  avatarUrl: { en: 'Avatar URL', ru: 'Ссылка на фото' },
  addAuthor: { en: 'Add author', ru: 'Добавить автора' },
  editPerson: { en: 'Edit person', ru: 'Редактировать персону' },
  linkAuthor: { en: 'Link author', ru: 'Связать автора' },
  linkDirector: { en: 'Link director', ru: 'Связать режиссёра' },
  castAndCrew: { en: 'Cast & crew', ru: 'Актёры и создатели' },
  character: { en: 'Character', ru: 'Персонаж' },
  role_actor: { en: 'Actors', ru: 'Актёры' },
  role_director: { en: 'Directors', ru: 'Режиссёры' },
  role_writer: { en: 'Writers', ru: 'Сценаристы' },
  role_producer: { en: 'Producers', ru: 'Продюсеры' },
  role_composer: { en: 'Composers', ru: 'Композиторы' },
  role_cinematographer: { en: 'Cinematographers', ru: 'Операторы' },
  role_author: { en: 'Authors', ru: 'Авторы' },
  role_translator: { en: 'Translators', ru: 'Переводчики' },
  role_editor: { en: 'Editors', ru: 'Редакторы' },
  role_illustrator: { en: 'Illustrators', ru: 'Иллюстраторы' },
  role_narrator: { en: 'Narrators', ru: 'Чтецы' },
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

  // Statistics page
  statistics: { en: 'Statistics', ru: 'Статистика' },
  statsPages: { en: 'Pages read', ru: 'Страниц прочитано' },
  statsFinishedByMonth: { en: 'Finished by month', ru: 'Завершено по месяцам' },
  statsYearTotal: { en: '{n} finished in {year}', ru: 'завершено в {year}: {n}' },
  statsPerMonthAvg: { en: '{n} / month avg', ru: 'в среднем {n} / мес' },
  statsRatings: { en: 'Ratings breakdown', ru: 'Распределение оценок' },
  statsNoData: { en: 'Not enough data yet.', ru: 'Пока недостаточно данных.' },
  statsOutOf: { en: '{n} of {total}', ru: '{n} из {total}' },
  statsAverages: { en: 'Averages', ru: 'Средние значения' },
  statsAvgPerMonthYear: { en: 'per month in {year}', ru: 'в месяц в {year}' },
  statsAvgPerYear: { en: 'per year (avg)', ru: 'в год (среднее)' },
  statsAvgRatingAll: { en: 'avg rating', ru: 'средняя оценка' },
  statsRatedShare: { en: 'of library rated', ru: 'оценено из библиотеки' },

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
  inviteFriends: {
    en: 'Invite friends to Nons Shelf to share your books and movies experience',
    ru: 'Пригласите друзей в Nons Shelf, чтобы делиться впечатлениями о книгах и фильмах',
  },
  verbRated: { en: 'rated', ru: 'оценил(а)' },
  verbFinished: { en: 'finished', ru: 'завершил(а)' },
  verbStarted: { en: 'started', ru: 'начал(а)' },
  verbAdded: { en: 'added', ru: 'добавил(а)' },
  verbReviewed: { en: 'reviewed', ru: 'оставил(а) отзыв на' },
  verbProgress: { en: 'made progress on', ru: 'продвинулся(ась) в' },
  removeFromFeed: { en: 'Remove from feed', ru: 'Убрать из ленты' },
  shareToFeed: { en: 'Share to feed', ru: 'Поделиться в ленте' },

  // Discover / social
  discover: { en: 'Discover', ru: 'Интересное' },
  discoverSubtitle: {
    en: 'What the community is reading and watching right now.',
    ru: 'Что сообщество читает и смотрит прямо сейчас.',
  },
  trendingNow: { en: 'Trending now', ru: 'Сейчас в тренде' },
  popularBooks: { en: 'Popular books', ru: 'Популярные книги' },
  popularFilms: { en: 'Popular films', ru: 'Популярные фильмы' },
  popularSeries: { en: 'Popular series', ru: 'Популярные сериалы' },
  recommendedForYou: { en: 'Recommended for you', ru: 'Рекомендуем вам' },
  addToLibrary: { en: 'Add', ru: 'Добавить' },
  addToShelf: { en: 'Add to shelf', ru: 'Добавить на полку' },
  inLibrary: { en: 'In library', ru: 'В библиотеке' },
  ratingsCountLabel: { en: '{n} ratings', ru: 'оценок: {n}' },
  membersReading: { en: '{n} reading now', ru: 'читают сейчас: {n}' },
  membersWatching: { en: '{n} watching now', ru: 'смотрят сейчас: {n}' },

  // Search / global
  globalSearch: { en: 'Search books & films…', ru: 'Поиск книг и фильмов…' },
  searchResults: { en: 'Results for "{q}"', ru: 'Результаты по запросу «{q}»' },
  search: { en: 'Search', ru: 'Поиск' },
  searchSubtitle: { en: 'Books, films and series across the catalog.', ru: 'Книги, фильмы и сериалы по всему каталогу.' },
  searchPrompt: { en: 'Type in the search bar to find books, films and series.', ru: 'Введите запрос в строке поиска, чтобы найти книги, фильмы и сериалы.' },
  searchingExternal: { en: 'Searching external sources…', ru: 'Поиск во внешних источниках…' },
  searchLoadMore: { en: 'Load more', ru: 'Загрузить ещё' },
  filterAll: { en: 'All', ru: 'Все' },
  sortRelevance: { en: 'Relevance', ru: 'Релевантность' },
  sortPopular: { en: 'Popular', ru: 'Популярные' },
  searchLibrary: { en: 'Search your library…', ru: 'Поиск в библиотеке…' },
  viewProfile: { en: 'View profile', ru: 'Открыть профиль' },
  logout: { en: 'Log out', ru: 'Выйти' },
  login: { en: 'Sign in', ru: 'Войти' },
  loginSubtitle: { en: 'Sign in with your nons account.', ru: 'Войдите с аккаунтом nons.' },
  loginEmailOrUsername: { en: 'Email or username', ru: 'Эл. почта или имя пользователя' },
  loginPassword: { en: 'Password', ru: 'Пароль' },
  loginSubmitting: { en: 'Signing in…', ru: 'Вход…' },
  signInToShelfTitle: { en: 'Track this on your shelf', ru: 'Добавьте на свою полку' },
  signInToShelfText: {
    en: 'Sign in with your nons account to rate it, write a review, and add it to your shelf.',
    ru: 'Войдите с аккаунтом nons, чтобы поставить оценку, написать отзыв и добавить на полку.',
  },

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
  profileSubtitleOther: { en: 'Their shelf at a glance', ru: 'Полка пользователя с высоты птичьего полёта' },
  viewNonsProfile: { en: 'nons profile', ru: 'Профиль nons' },
  // "In progress" is the cross-media term for currently reading OR watching.
  inProgressTitle: { en: 'In progress', ru: 'В процессе' },
  reviewsTitle: { en: 'Reviews', ru: 'Рецензии' },
  ratingsReviewsTitle: { en: 'Ratings & reviews', ru: 'Оценки и рецензии' },
  noReviewsYet: { en: 'No reviews yet.', ru: 'Пока нет рецензий.' },
  noRatingsReviews: { en: 'No ratings or reviews yet.', ru: 'Пока нет оценок и рецензий.' },
  nothingInProgress: { en: 'Nothing in progress right now.', ru: 'Сейчас ничего нет в процессе.' },
  // Settings (own profile only)
  settingsTitle: { en: 'Settings', ru: 'Настройки' },
  settingsImport: { en: 'Import library', ru: 'Импорт библиотеки' },
  settingsImportHint: { en: 'Bring your books over from Goodreads or Book Diary Pro.', ru: 'Перенесите книги из Goodreads или Book Diary Pro.' },
  settingsShowInProgress: { en: 'Show “In progress” on Library', ru: 'Показывать «В процессе» в библиотеке' },

  // Settings modal sections
  settingsPrivacy: { en: 'Privacy', ru: 'Приватность' },
  settingsPrivacyHint: {
    en: 'Choose who can see each part of your profile. Applies across nons.',
    ru: 'Выберите, кто видит каждую часть вашего профиля. Действует во всём nons.',
  },
  settingsPreferences: { en: 'Preferences', ru: 'Предпочтения' },
  settingsAccount: { en: 'Account', ru: 'Аккаунт' },

  // Privacy facets
  privacyShelf: { en: 'My shelf', ru: 'Моя полка' },
  privacyShelfHint: { en: 'The books, films and series in your library.', ru: 'Книги, фильмы и сериалы в вашей библиотеке.' },
  privacyRatings: { en: 'Ratings & reviews', ru: 'Оценки и рецензии' },
  privacyRatingsHint: { en: 'Your star ratings and written reviews.', ru: 'Ваши оценки и написанные рецензии.' },
  privacyFavorites: { en: 'Favorites', ru: 'Избранное' },
  privacyFavoritesHint: { en: 'The items you’ve marked as favorite.', ru: 'Элементы, отмеченные как избранные.' },
  privacyActivity: { en: 'Activity & in-progress', ru: 'Активность и в процессе' },
  privacyActivityHint: { en: 'What you’re reading or watching right now.', ru: 'Что вы читаете или смотрите прямо сейчас.' },

  // Visibility options
  visibilityNobody: { en: 'Only me', ru: 'Только я' },
  visibilityFriends: { en: 'Friends', ru: 'Друзья' },
  visibilityEveryone: { en: 'Everyone', ru: 'Все' },
  visibilityNobodyHint: { en: 'Private to you.', ru: 'Видно только вам.' },
  visibilityFriendsHint: { en: 'People you follow on nons.', ru: 'Те, на кого вы подписаны в nons.' },
  visibilityEveryoneHint: { en: 'Anyone with the link.', ru: 'Любой, у кого есть ссылка.' },

  // Controls
  sortBy: { en: 'Sort', ru: 'Сортировка' },
  sortAdded: { en: 'Recently added', ru: 'Недавно добавленные' },
  sortRating: { en: 'Highest rated', ru: 'По рейтингу' },
  sortTitle: { en: 'Title (A–Z)', ru: 'Название (А–Я)' },
  sortYear: { en: 'Newest', ru: 'По году' },
  gridView: { en: 'Grid', ru: 'Сетка' },
  listView: { en: 'List', ru: 'Список' },
  addEntry: { en: 'Add entry', ru: 'Добавить запись' },
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

  // Librarian dashboard
  librarians: { en: 'Librarians', ru: 'Библиотекари' },
  librarianDashboard: { en: 'Librarian dashboard', ru: 'Панель библиотекаря' },
  editMetadataSubtitle: {
    en: 'Curate the shared catalog — books, films, authors and editions.',
    ru: 'Управляйте общим каталогом — книги, фильмы, авторы и издания.',
  },
  tabCatalog: { en: 'Catalog', ru: 'Каталог' },
  tabAuthors: { en: 'Authors', ru: 'Авторы' },
  searchCatalogPlaceholder: { en: 'Search the catalog…', ru: 'Поиск по каталогу…' },
  searchAuthorsPlaceholder: { en: 'Search authors…', ru: 'Поиск авторов…' },
  searchToBegin: { en: 'Start typing to search.', ru: 'Начните вводить для поиска.' },
  addBook: { en: 'Add book', ru: 'Добавить книгу' },
  edit: { en: 'Edit', ru: 'Изменить' },
  open: { en: 'Open', ru: 'Открыть' },
  rename: { en: 'Rename', ru: 'Переименовать' },
  merge: { en: 'Merge', ru: 'Объединить' },
  creditsCount: { en: '{n} credits', ru: 'упоминаний: {n}' },
  notAuthorized: { en: 'You don’t have access to this page.', ru: 'У вас нет доступа к этой странице.' },

  // Author management
  mergeAuthorsTitle: { en: 'Merge duplicates', ru: 'Объединить дубликаты' },
  mergeAuthorsHint: {
    en: 'Pick the duplicate first, then the person to keep. Credits and aliases move to the survivor.',
    ru: 'Сначала выберите дубликат, затем человека, которого оставить. Упоминания и псевдонимы перейдут к нему.',
  },
  selectDuplicate: { en: 'Select as duplicate', ru: 'Выбрать как дубликат' },
  duplicateLabel: { en: 'Duplicate', ru: 'Дубликат' },
  keepLabel: { en: 'Keep', ru: 'Оставить' },
  mergeInto: { en: 'Merge into this person', ru: 'Объединить с этим человеком' },
  clearSelection: { en: 'Clear', ru: 'Сбросить' },
  mergedToast: { en: 'Authors merged.', ru: 'Авторы объединены.' },
  renameAuthor: { en: 'Rename author', ru: 'Переименовать автора' },
  authorName: { en: 'Name', ru: 'Имя' },

  // Book editor
  editBook: { en: 'Edit catalog entry', ru: 'Редактировать запись каталога' },
  metadata: { en: 'Metadata', ru: 'Метаданные' },
  editionsTitle: { en: 'Editions', ru: 'Издания' },
  noEditionsYet: { en: 'No editions linked yet.', ru: 'Издания ещё не привязаны.' },
  addEdition: { en: 'Add edition', ru: 'Добавить издание' },
  editionTitle: { en: 'Edition title', ru: 'Название издания' },
  editionDescription: { en: 'Synopsis override (optional) — leave blank to use the work’s', ru: 'Своё описание (необязательно) — оставьте пустым для общего' },
  publisher: { en: 'Publisher', ru: 'Издательство' },
  language: { en: 'Language', ru: 'Язык' },
  publishedYear: { en: 'Published year', ru: 'Год издания' },
  removeEdition: { en: 'Remove edition', ru: 'Удалить издание' },
  mergeDuplicateTitle: { en: 'Merge a duplicate', ru: 'Объединить дубликат' },
  mergeDuplicateHint: {
    en: 'Search for another catalog entry of the same work. It becomes an edition of this one and is removed.',
    ru: 'Найдите другую запись того же произведения. Она станет изданием этой записи и будет удалена.',
  },
  mergeHere: { en: 'Merge into this entry', ru: 'Объединить с этой записью' },
  mergeIntoTitle: { en: 'Merge this into another entry', ru: 'Объединить эту запись с другой' },
  mergeIntoHint: {
    en: 'Search for the entry to keep. This one’s editions and signals move to it, and this entry is removed.',
    ru: 'Найдите запись, которую нужно оставить. Издания и данные этой записи перейдут к ней, а эта запись будет удалена.',
  },
  mergeIntoEntry: { en: 'Merge into this', ru: 'Объединить с этой' },
  confirmMergeInto: {
    en: 'Merge “{title}” into the selected entry? This entry will be removed and can’t be restored.',
    ru: 'Объединить «{title}» с выбранной записью? Эта запись будет удалена без возможности восстановления.',
  },
  mergeIntoDone: { en: 'Merged.', ru: 'Объединено.' },
  moveEditionTitle: { en: 'Move to another book', ru: 'Перенести в другую книгу' },
  moveEditionHint: {
    en: 'Find the book this edition belongs to, or create a new one.',
    ru: 'Найдите книгу, которой принадлежит это издание, или создайте новую.',
  },
  moveHere: { en: 'Move here', ru: 'Перенести сюда' },
  moveBookPlaceholder: { en: 'Search books by title…', ru: 'Поиск книг по названию…' },
  createBook: { en: 'Create book “{title}”', ru: 'Создать книгу «{title}»' },
  moving: { en: 'Moving…', ru: 'Перенос…' },
  linkedAuthor: { en: 'Linked author', ru: 'Связанный автор' },
  linkAuthorTitle: { en: 'Link the author', ru: 'Связать автора' },
  linkAuthorHint: {
    en: 'Connect this entry’s author to a person page so the byline links and credits line up.',
    ru: 'Свяжите автора этой записи со страницей человека, чтобы подпись вела на профиль.',
  },
  linkMaker: { en: 'Link', ru: 'Связать' },
  makerLinked: { en: 'Author linked.', ru: 'Автор связан.' },
  deleteEntry: { en: 'Delete entry', ru: 'Удалить запись' },
  confirmDeleteEntry: {
    en: 'Delete this catalog entry for everyone? This can’t be undone.',
    ru: 'Удалить эту запись каталога для всех? Это нельзя отменить.',
  },
  savedToast: { en: 'Saved.', ru: 'Сохранено.' },
  saveChanges: { en: 'Save changes', ru: 'Сохранить изменения' },
  series: { en: 'Series', ru: 'Сериал' },
  seriesPlural: { en: 'Series', ru: 'Сериалы' },
  episodes: { en: 'Episodes', ru: 'Эпизоды' },
  season: { en: 'Season', ru: 'Сезон' },
  episodesCount: { en: '{count} episodes', ru: 'Эпизодов: {count}' },
  watchedOfTotal: { en: 'Watched {watched} of {total}', ru: 'Просмотрено {watched} из {total}' },
  updateProgress: { en: 'Update progress', ru: 'Обновить прогресс' },
  currentPage: { en: 'Current page', ru: 'Текущая страница' },
  page: { en: 'Page', ru: 'Страница' },
  saving: { en: 'Saving…', ru: 'Сохранение…' },
  episodeInfo: { en: 'Episode info', ru: 'Об эпизоде' },
  finishedReadingHint: { en: 'Done reading it?', ru: 'Дочитали?' },
  finishedWatchingHint: { en: 'Done watching it?', ru: 'Досмотрели?' },
  imFinished: { en: "I'm finished", ru: 'Завершить' },
  profile: { en: 'Profile', ru: 'Профиль' },
  noEpisodes: { en: 'No episodes listed yet.', ru: 'Эпизоды пока не добавлены.' },
  markWatched: { en: 'Mark watched', ru: 'Отметить просмотренным' },
  episodesTitle: { en: 'Episodes', ru: 'Эпизоды' },
  episodesHint: { en: 'Add, edit, or remove the episodes of this series.', ru: 'Добавляйте, редактируйте или удаляйте эпизоды этого сериала.' },
  noEpisodesYet: { en: 'No episodes yet.', ru: 'Эпизодов пока нет.' },
  deleteSeason: { en: 'Delete season', ru: 'Удалить сезон' },
  specials: { en: 'Specials', ru: 'Спецвыпуски' },
  confirmDeleteSeason: {
    en: 'Delete all {count} episodes of season {season}? This can’t be undone.',
    ru: 'Удалить все эпизоды ({count}) сезона {season}? Это нельзя отменить.',
  },
  addEpisode: { en: 'Add episode', ru: 'Добавить эпизод' },
  episodeNumber: { en: 'Episode #', ru: 'Эпизод №' },
  episodeTitle: { en: 'Episode title', ru: 'Название эпизода' },
  airDate: { en: 'Air date (YYYY-MM-DD)', ru: 'Дата выхода (ГГГГ-ММ-ДД)' },
  runtimeMin: { en: 'Runtime (min)', ru: 'Длительность (мин)' },
  stillUrl: { en: 'Still image URL', ru: 'Ссылка на кадр' },
  importEntry: { en: 'Import', ru: 'Импорт' },
  importTitle: { en: 'Import from a database', ru: 'Импорт из базы' },
  importSubtitle: { en: 'Search OpenLibrary + Google Books (books) or TMDB (movies & series), then import in one click.', ru: 'Поиск в OpenLibrary + Google Books (книги) или TMDB (фильмы и сериалы) — импорт в один клик.' },
  inCatalog: { en: 'In catalog', ru: 'В каталоге' },
  openInCatalog: { en: 'Open', ru: 'Открыть' },
  bulkTitle: { en: 'Bulk import from TMDB', ru: 'Массовый импорт из TMDB' },
  bulkHint: { en: 'Import the most popular movies or series in one go. Runs in the background — series also pull their episodes.', ru: 'Импорт самых популярных фильмов или сериалов сразу. Выполняется в фоне — у сериалов подтягиваются эпизоды.' },
  bulkStart: { en: 'Start import', ru: 'Начать импорт' },
  bulkCreated: { en: 'added', ru: 'добавлено' },
  bulkSkipped: { en: 'existing', ru: 'уже есть' },
  bulkFailed: { en: 'failed', ru: 'ошибок' },
  bulkDoneLabel: { en: 'Done', ru: 'Готово' },
  selectEditionHint: { en: 'Tap an edition to view it (and mark the one you’re reading).', ru: 'Нажмите на издание, чтобы открыть его (и отметить читаемое).' },
  selectThisEdition: { en: 'Select this', ru: 'Выбрать' },
  selectedEdition: { en: 'Selected', ru: 'Выбрано' },
  findByIsbn: { en: 'Find by ISBN…', ru: 'Поиск по ISBN…' },
  loadMore: { en: 'Load more', ru: 'Показать ещё' },
  rusify: { en: 'Rusify title', ru: 'В кириллицу' },
  rusifyAll: { en: 'Rusify romanized titles', ru: 'Перевести в кириллицу' },
  autoFindEditions: { en: 'Auto-find editions', ru: 'Найти издания' },
  autoFindCredits: { en: 'Auto-find cast & crew (TMDB)', ru: 'Найти актёров и команду (TMDB)' },
  by: { en: 'by', ru: 'от' },
  rating: { en: 'Rating', ru: 'Оценка' },

  // Reading / watching dates (editable relationship on the media page)
  readingProgress: { en: 'Reading progress', ru: 'Прогресс чтения' },
  pageOfTotal: { en: 'Page {page} of {total}', ru: 'Страница {page} из {total}' },
  pageN: { en: 'Page {page}', ru: 'Страница {page}' },
  readingDates: { en: 'Reading dates', ru: 'Даты чтения' },
  watchingDates: { en: 'Watching dates', ru: 'Даты просмотра' },
  dateStarted: { en: 'Started reading', ru: 'Начал(а) читать' },
  dateFinished: { en: 'Finished reading', ru: 'Закончил(а) читать' },
  dateStartedWatching: { en: 'Started watching', ru: 'Начал(а) смотреть' },
  dateFinishedWatching: { en: 'Finished watching', ru: 'Закончил(а) смотреть' },
  dateRead: { en: 'Date read', ru: 'Дата прочтения' },
  dateWatched: { en: 'Date watched', ru: 'Дата просмотра' },
  postToNons: { en: 'Post to Nons', ru: 'Опубликовать в Nons' },
  post: { en: 'Post', ru: 'Опубликовать' },
  continueReading: { en: ' …more', ru: ' …подробнее' },
  like: { en: 'Like', ru: 'Нравится' },
  comment: { en: 'Comment', ru: 'Комментировать' },
  writeComment: { en: 'Write a comment…', ru: 'Написать комментарий…' },
  writeReply: { en: 'Write a reply…', ru: 'Написать ответ…' },
  reply: { en: 'Reply', ru: 'Ответить' },
  noCommentsYet: { en: 'No comments yet. Start the conversation.', ru: 'Пока нет комментариев. Начните обсуждение.' },
  autofill: { en: 'Autofill', ru: 'Заполнить' },
  looking: { en: 'Looking…', ru: 'Поиск…' },
  importBookPlaceholder: { en: 'Title, author, or ISBN…', ru: 'Название, автор или ISBN…' },
  importTmdbPlaceholder: { en: 'Search by title…', ru: 'Поиск по названию…' },
  import: { en: 'Import', ru: 'Импорт' },
  importing: { en: 'Importing…', ru: 'Импорт…' },
  creating: { en: 'Creating…', ru: 'Создание…' },
  createAndLink: { en: 'Create & link “{name}”', ru: 'Создать и связать «{name}»' },
  createAuthor: { en: 'Create person', ru: 'Создать персону' },
  newPersonName: { en: 'New person name…', ru: 'Имя новой персоны…' },
  create: { en: 'Create', ru: 'Создать' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    // Guarded for SSR: the public /b and /m pages render on the server (no
    // localStorage/navigator), where we default to English — which is also what
    // crawlers index. The client adopts the stored/browser language on hydration.
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('language');
    if (saved === 'en' || saved === 'ru') return saved;

    // Default to browser language if supported
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'ru') return 'ru';
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') localStorage.setItem('language', lang);
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

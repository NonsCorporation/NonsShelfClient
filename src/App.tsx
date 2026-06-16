import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './screens/Home.tsx';
import FeedPage from './screens/Feed.tsx';
import DiscoverPage from './screens/Discover.tsx';
import CalendarPage from './screens/Calendar.tsx';
import MediaOnePage from './screens/MediaOne.tsx';
import PersonPage from './screens/Person.tsx';
import ProfilePage from './screens/Profile.tsx';
import RequireAuth from './components/RequireAuth.tsx';
import LibrariansPage from './screens/Librarians.tsx';
import LibrarianEditPage from './screens/LibrarianEdit.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <RequireAuth>
        <Routes>
          <Route path='/' element={<FeedPage />} />
          <Route path='/library' element={<Home />} />
          <Route path='/discover' element={<DiscoverPage />} />
          <Route path='/calendar' element={<CalendarPage />} />
          <Route path='/librarians' element={<LibrariansPage />} />
          <Route path='/librarian/edit/:id' element={<LibrarianEditPage />} />
          <Route path='/b/:id' element={<MediaOnePage />} />
          <Route path='/m/:id' element={<MediaOnePage />} />
          {/* Legacy numeric-id links keep working */}
          <Route path='/shelf/:id' element={<MediaOnePage />} />
          <Route path='/p/:uuid' element={<PersonPage />} />
          <Route path='/u/:id' element={<ProfilePage />} />
        </Routes>
      </RequireAuth>
    </BrowserRouter>
  );
}


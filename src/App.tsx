import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.tsx';
import FeedPage from './pages/Feed.tsx';
import DiscoverPage from './pages/Discover.tsx';
import CalendarPage from './pages/Calendar.tsx';
import MediaOnePage from './pages/MediaOne.tsx';
import PersonPage from './pages/Person.tsx';
import ProfilePage from './pages/Profile.tsx';
import RequireAuth from './components/RequireAuth.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <RequireAuth>
        <Routes>
          <Route path='/' element={<FeedPage />} />
          <Route path='/library' element={<Home />} />
          <Route path='/discover' element={<DiscoverPage />} />
          <Route path='/calendar' element={<CalendarPage />} />
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


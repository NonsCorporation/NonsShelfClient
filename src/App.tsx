import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.tsx';
import CalendarPage from './pages/Calendar.tsx';
import MediaOnePage from './pages/MediaOne.tsx';

export default function App() {
  return (
    <BrowserRouter basename="/NonsLibraryClient">
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/calendar' element={<CalendarPage />} />
        <Route path='/shelf/:id' element={<MediaOnePage />} />
      </Routes>
    </BrowserRouter>
  );
}

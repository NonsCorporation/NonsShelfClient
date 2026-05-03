import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.tsx';
import CalendarPage from './pages/Calendar.tsx';
import MediaOnePage from './pages/MediaOne.tsx';
import ShelfPage from './pages/Shelf.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/calendar' element={<CalendarPage />} />
        <Route path='/oppenheimer' element={<MediaOnePage />} />
        <Route path='/media/:id' element={<MediaOnePage />} />
        <Route path='/shelf/:id' element={<ShelfPage />} />
      </Routes>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.tsx';
import CalendarPage from './pages/Calendar.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/calendar' element={<CalendarPage />} />
      </Routes>
    </BrowserRouter>
  );
}

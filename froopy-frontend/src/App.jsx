// App.jsx - Two routes, that's it (Supabase Migration)
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContextSupabase';
import AuthPageSupabase from './components/AuthPageSupabase';
import MainPage from './components/MainPage';

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPageSupabase />} />
          <Route path="/" element={<MainPage />} />
          {/* Catch-all route - redirect invalid routes to auth */}
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
// App.jsx - Two routes, that's it
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import AuthPage from './components/AuthPage';
import MainPage from './components/MainPage';

function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<MainPage />} />
          {/* Catch-all route - redirect invalid routes to auth */}
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
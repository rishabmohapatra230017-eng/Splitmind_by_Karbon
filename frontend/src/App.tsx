import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { api } from './api';
import type { CurrentUser } from './lib/types';
import { Dashboard } from './pages/Dashboard';
import { GroupDetail } from './pages/GroupDetail';
import { Login } from './pages/Login';

function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const user = await api.getCurrentUser();
        setCurrentUser(user);
      } finally {
        setLoading(false);
      }
    }

    void loadSession();
  }, []);

  async function handleLogout() {
    await api.logout();
    setCurrentUser(null);
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0a0f17]" />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login onLogin={setCurrentUser} />} />
        <Route
          path="/"
          element={currentUser ? <Dashboard currentUser={currentUser} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/groups/:groupId"
          element={currentUser ? <GroupDetail currentUser={currentUser} /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

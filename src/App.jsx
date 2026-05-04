import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SettingsProvider } from './SettingsContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import HerdView from './pages/HerdView'
import ExpenseTracker from './pages/ExpenseTracker'
import HealthCenter from './pages/HealthCenter'
import Reports from './pages/Reports'
import DataImport from './pages/DataImport'
import ManualEntry from './pages/ManualEntry'
import Settings from './pages/Settings'
import Toast from './components/Toast'
import './App.css'

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('cowculator-theme') || 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [syncVersion, setSyncVersion] = useState(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cowculator-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  
  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    const handleRemoteSync = () => {
      setSyncVersion((version) => version + 1);
      addToast('Data synced from another device');
    };

    window.addEventListener('cowculator:remote-sync', handleRemoteSync);
    return () => window.removeEventListener('cowculator:remote-sync', handleRemoteSync);
  }, []);

  return (
    <SettingsProvider key={syncVersion}>
      <div className="app-layout">
        <Sidebar 
          theme={theme} 
          toggleTheme={toggleTheme} 
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard addToast={addToast} />} />
            <Route path="/herd" element={<HerdView addToast={addToast} />} />
            <Route path="/expenses" element={<ExpenseTracker addToast={addToast} />} />
            <Route path="/health" element={<HealthCenter addToast={addToast} />} />
            <Route path="/reports" element={<Reports addToast={addToast} />} />
            <Route path="/import" element={<DataImport addToast={addToast} />} />
            <Route path="/entry" element={<ManualEntry addToast={addToast} />} />
            <Route path="/settings" element={<Settings addToast={addToast} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <div className="toast-container">
          {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
        </div>
      </div>
    </SettingsProvider>
  )
}

export default App

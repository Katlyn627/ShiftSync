import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import SchedulePage from './pages/SchedulePage';
import EmployeesPage from './pages/EmployeesPage';
import SwapsPage from './pages/SwapsPage';

const NAV_ITEMS = [
  { to: '/', label: '📊 Dashboard' },
  { to: '/schedule', label: '📅 Schedule' },
  { to: '/employees', label: '👥 Employees' },
  { to: '/swaps', label: '🔄 Shift Swaps' },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <span className="text-xl font-bold tracking-tight">ShiftSync</span>
            <span className="text-blue-200 text-sm hidden sm:block">Smart Scheduling + Burnout Prevention</span>
          </div>
          <nav className="flex gap-1">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive ? 'bg-white text-blue-700' : 'text-blue-100 hover:bg-blue-600'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/swaps" element={<SwapsPage />} />
        </Routes>
      </main>
      <footer className="text-center text-gray-400 text-xs py-3 border-t">
        ShiftSync © 2025 — Smart scheduling for hospitality
      </footer>
    </div>
  );
}

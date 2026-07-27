import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import ScrapePage from './pages/ScrapePage'
import LeadsPage from './pages/LeadsPage'
import './App.css'

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation()
  const active = location.pathname === to
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        active
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </Link>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-white/80 dark:bg-[var(--color-bg)] backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold">
              L
            </div>
            <span className="font-semibold text-[var(--color-text-h)]">LeadScraper</span>
          </div>
          <nav className="flex gap-2">
            <NavLink to="/">Scrape</NavLink>
            <NavLink to="/leads">Leads</NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<ScrapePage />} />
          <Route path="/leads" element={<LeadsPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App

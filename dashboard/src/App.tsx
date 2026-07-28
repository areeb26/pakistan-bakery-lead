import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, ProtectedRoute } from './components'

// Public pages
import { LoginPage }    from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'

// Protected pages
import { CampaignsPage }      from './pages/CampaignsPage'
import { CampaignDetailPage } from './pages/CampaignDetailPage'
import { ScrapeHistoryPage }  from './pages/ScrapeHistoryPage'
import ScrapePage             from './pages/ScrapePage'

import './App.css'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected */}
          <Route path="/campaigns" element={
            <ProtectedRoute><CampaignsPage /></ProtectedRoute>
          } />
          <Route path="/campaigns/:campaignId" element={
            <ProtectedRoute><CampaignDetailPage /></ProtectedRoute>
          } />
          <Route path="/campaigns/:campaignId/history" element={
            <ProtectedRoute><ScrapeHistoryPage /></ProtectedRoute>
          } />
          <Route path="/scrape" element={
            <ProtectedRoute><ScrapePage /></ProtectedRoute>
          } />

          {/* Redirects */}
          <Route path="/"         element={<Navigate to="/campaigns" replace />} />
          <Route path="/projects" element={<Navigate to="/campaigns" replace />} />
          <Route path="/projects/:id" element={<Navigate to="/campaigns" replace />} />
          <Route path="*"         element={<Navigate to="/campaigns" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App

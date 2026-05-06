import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'

import LoginPage    from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import CatalogPage  from './pages/CatalogPage'
import TrainingPage from './pages/TrainingPage'
import LiveKitRoomPage from './pages/LiveKitRoomPage'
import ProfilePage  from './pages/ProfilePage'
import TrainerPage  from './pages/TrainerPage'
import AdminPage    from './pages/AdminPage'
import ContactsPage from './pages/ContactsPage'
import LegalPage    from './pages/LegalPage'
import PaymentResultPage from './pages/PaymentResultPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => { init() }, [init])

  return (
    <Routes>
      {/* Auth — без лэйаута */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Основные страницы */}
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/catalog" replace />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/trainer" element={<ProtectedRoute roles={['TRAINER','ADMIN']}><TrainerPage /></ProtectedRoute>} />
        <Route path="/admin"   element={<ProtectedRoute roles={['ADMIN']}><AdminPage /></ProtectedRoute>} />
        <Route path="/training/:id" element={<TrainingPage />} />
        <Route path="/payment/success" element={<PaymentResultPage status="success" />} />
        <Route path="/payment/fail" element={<PaymentResultPage status="fail" />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/legal/:section" element={<LegalPage />} />
      </Route>

      {/* Комната — без шапки, на весь экран */}
      <Route path="/room/:id" element={<NavigateToLiveKitRoom />} />
      <Route path="/room-livekit/:id" element={<ProtectedRoute><LiveKitRoomPage /></ProtectedRoute>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function NavigateToLiveKitRoom() {
  return <Navigate to={window.location.pathname.replace('/room/', '/room-livekit/')} replace />
}

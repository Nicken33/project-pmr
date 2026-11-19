import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { AuthProvider, useAuth } from './state/auth'
import { RefsProvider } from './state/refs'
import { FavoritesProvider } from './state/favorites'
import { RoleStatsProvider } from './state/roleStats'
import { ToastProvider } from './state/toast'
import { OrgDraftSync } from './state/OrgDraftSync'
import { isOwner } from './api/endpoints'
import CatalogPage from './pages/CatalogPage'

const ActivityPage = lazy(() => import('./pages/ActivityPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterChoicePage = lazy(() => import('./pages/auth/RegisterChoicePage'))
const RegisterUserPage = lazy(() => import('./pages/auth/RegisterUserPage'))
const RegisterOrgPage = lazy(() => import('./pages/auth/RegisterOrgPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const CheckEmailPage = lazy(() => import('./pages/auth/CheckEmailPage'))
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const MyActivitiesPage = lazy(() => import('./pages/owner/MyActivitiesPage'))
const ActivityEditorPage = lazy(() => import('./pages/owner/ActivityEditorPage'))
const OrganizationEditPage = lazy(() => import('./pages/owner/OrganizationEditPage'))
const ModerationPage = lazy(() => import('./pages/ModerationPage'))
const OrganizationPage = lazy(() => import('./pages/OrganizationPage'))
const MapPage = lazy(() => import('./pages/MapPage'))
const AboutPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.AboutPage })))
const TermsPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.TermsPage })))
const RulesPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.RulesPage })))
const PrivacyPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPage })))
const RequestPage = lazy(() => import('./pages/RequestPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

/** Пускает только вошедших (и при необходимости — с нужной ролью). */
function Guard({ children, role }: { children: ReactNode; role?: 'owner' | 'moderator' }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <div className="spinner" />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  if (role === 'owner' && !isOwner(user)) return <NotFoundPage />
  if (role === 'moderator' && user.account_type !== 'moderator') return <NotFoundPage />
  return <>{children}</>
}

/**
 * Прокрутка: новый экран — наверх, «Назад» — на то же место (ТЗ §10.9).
 * Позицию запоминаем по ключу записи истории; список догружается не сразу,
 * поэтому восстанавливаем несколько раз, пока страница не станет достаточно длинной.
 */
function ScrollManager() {
  const loc = useLocation()
  const type = useNavigationType()
  const prevPath = useRef('')
  useEffect(() => {
    const key = `talentro.scroll.${loc.key}`
    const save = () => sessionStorage.setItem(key, String(window.scrollY))
    let timer = 0
    if (type === 'POP') {
      const y = Number(sessionStorage.getItem(key) || 0)
      let tries = 0
      const tick = () => {
        window.scrollTo(0, y)
        if (Math.abs(window.scrollY - y) > 2 && tries++ < 30) timer = window.setTimeout(tick, 100)
      }
      tick()
    } else if (!loc.hash && prevPath.current !== loc.pathname) {
      // наверх — только при переходе на другую страницу (смена фильтров и «Показать ещё» не прыгают)
      window.scrollTo(0, 0) // в новых Chrome scrollTo возвращает Promise — не отдаём его в useEffect
    }
    prevPath.current = loc.pathname
    window.addEventListener('scroll', save, { passive: true })
    return () => {
      clearTimeout(timer)
      save()
      window.removeEventListener('scroll', save)
    }
  }, [loc.key, loc.hash, loc.pathname, type])
  return null
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RefsProvider>
          <FavoritesProvider>
          <RoleStatsProvider>
            <ScrollManager />
            <OrgDraftSync />
            <div className="app">
              <Header />
              <main>
                <Suspense fallback={<div className="spinner" />}>
                  <Routes>
                    <Route path="/" element={<CatalogPage home />} />
                    <Route path="/catalog" element={<CatalogPage />} />
                    <Route path="/map" element={<MapPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/rules" element={<RulesPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/request" element={<RequestPage />} />
                    <Route path="/activity/:id" element={<ActivityPage />} />
                    <Route path="/org/:id" element={<OrganizationPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterChoicePage />} />
                    <Route path="/register/user" element={<RegisterUserPage />} />
                    <Route path="/register/org" element={<RegisterOrgPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/check-email" element={<CheckEmailPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/favorites" element={<Guard><FavoritesPage /></Guard>} />
                    <Route path="/profile" element={<Guard><ProfilePage /></Guard>} />
                    <Route path="/my" element={<Guard role="owner"><MyActivitiesPage /></Guard>} />
                    <Route path="/my/organization" element={<Guard role="owner"><OrganizationEditPage /></Guard>} />
                    <Route path="/my/new" element={<Guard role="owner"><ActivityEditorPage /></Guard>} />
                    <Route path="/my/:id/edit" element={<Guard role="owner"><ActivityEditorPage /></Guard>} />
                    <Route path="/moderation" element={<Guard role="moderator"><ModerationPage /></Guard>} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
            </div>
          </RoleStatsProvider>
          </FavoritesProvider>
        </RefsProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

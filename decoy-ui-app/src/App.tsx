import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage }    from './pages/LandingPage'
import { LoginPage }      from './pages/LoginPage'
import { DashboardPage }  from './pages/DashboardPage'
import { TransferPage }   from './pages/TransferPage'
import { StatementsPage } from './pages/StatementsPage'
import { RecoverPage }    from './pages/RecoverPage'
import { SupportPage }    from './pages/SupportPage'
import { NotFoundPage }   from './pages/NotFoundPage'
import { AboutPage }      from './pages/AboutPage'
import { ProductsPage }   from './pages/ProductsPage'
import { BranchesPage }   from './pages/BranchesPage'
import { NewsPage }       from './pages/NewsPage'
import { InvestorPage }   from './pages/InvestorPage'
import { SecurityPage }   from './pages/SecurityPage'
import { CardsPage }      from './pages/CardsPage'

export default function App() {
  return (
    <BrowserRouter basename="/bank">
      <Routes>
        <Route path="/"                   element={<LandingPage />} />
        <Route path="/login"              element={<LoginPage />} />
        <Route path="/dashboard"          element={<DashboardPage />} />
        <Route path="/transfer"           element={<TransferPage />} />
        <Route path="/statements"         element={<StatementsPage />} />
        <Route path="/recover"            element={<RecoverPage />} />
        <Route path="/support"            element={<SupportPage />} />
        <Route path="/about"              element={<AboutPage />} />
        <Route path="/products"           element={<ProductsPage />} />
        <Route path="/products-services"  element={<ProductsPage />} />
        <Route path="/branches"           element={<BranchesPage />} />
        <Route path="/news"               element={<NewsPage />} />
        <Route path="/investor"           element={<InvestorPage />} />
        <Route path="/security"           element={<SecurityPage />} />
        <Route path="/cards"              element={<CardsPage />} />
        <Route path="*"                   element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { useApp } from './data/AppContext'
import { Link } from 'react-router-dom'
import { HOME_FOR_ROLE, NAV_ITEMS } from './navigation'
const About = lazy(() => import('./pages/About'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Data = lazy(() => import('./pages/Data'))
const ExecSummary = lazy(() => import('./pages/ExecSummary'))
const Help = lazy(() => import('./pages/Help'))
const Pulse = lazy(() => import('./pages/Pulse'))
const Recommendations = lazy(() => import('./pages/Recommendations'))
const Scenarios = lazy(() => import('./pages/Scenarios'))
const Support = lazy(() => import('./pages/Support'))

const PAGES: Record<string, React.ReactElement> = {
  '/summary': <ExecSummary />,
  '/dashboard': <Dashboard />,
  '/scenarios': <Scenarios />,
  '/recommendations': <Recommendations />,
  '/data': <Data />,
  '/pulse': <Pulse />,
  '/support': <Support />,
  '/help': <Help />,
  '/about': <About />,
}

/** Pages that need at least one team to make sense. */
const NEEDS_TEAMS = new Set(['/summary', '/dashboard', '/scenarios', '/recommendations', '/pulse'])

function EmptyState({ canEdit }: { canEdit: boolean }) {
  return (
    <section className="max-w-xl space-y-2">
      <h1 className="text-2xl font-semibold">No data yet</h1>
      <p className="text-muted">There are no teams to show. {canEdit ? <>Add or import your data on the <Link to="/data" className="underline text-accent-dark">Data page</Link>, or reset to the demo data there.</> : 'Ask your HR lead to add the organisation’s data.'}</p>
    </section>
  )
}

export default function App() {
  const { role, data } = useApp()
  return (
    <Routes>
      <Route element={<Layout />}>
        {NAV_ITEMS.map((item) => (
          <Route
            key={item.path}
            path={item.path}
            // A role that is not allowed to see a page is sent to its own home page.
            element={!item.roles.includes(role) ? <Navigate to={HOME_FOR_ROLE[role]} replace /> : data.teams.length === 0 && NEEDS_TEAMS.has(item.path) ? <EmptyState canEdit={role === 'hr'} /> : PAGES[item.path]}
          />
        ))}
        <Route path="*" element={<Navigate to={HOME_FOR_ROLE[role]} replace />} />
      </Route>
    </Routes>
  )
}

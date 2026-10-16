import { Suspense, useEffect, useRef } from 'react'
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../data/AppContext'
import { ROLE_LABELS, type Role } from '../data/schemas'
import { HOME_FOR_ROLE, NAV_ITEMS, navFor } from '../navigation'

export default function Layout() {
  const { role, setRole, data, teamLeadTeamId, setTeamLeadTeamId } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstLoad = useRef(true)

  // On every page change: set a descriptive tab title, and move keyboard/screen-reader focus to the
  // page content (not on the very first load, so the page does not jump).
  useEffect(() => {
    const label = NAV_ITEMS.find((n) => n.path === location.pathname)?.label ?? 'Steady'
    document.title = `${label} – Steady`
    if (firstLoad.current) firstLoad.current = false
    else mainRef.current?.focus()
  }, [location.pathname])

  const changeRole = (r: Role) => {
    setRole(r)
    navigate(HOME_FOR_ROLE[r])
  }

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-white focus:p-2 focus:z-50"
      >
        Skip to main content
      </a>

      <div className="bg-amber-100 text-amber-950 text-sm text-center py-1.5 px-4 border-b border-amber-300">
        <span aria-hidden="true">ⓘ </span>
        Demo – fictional organisation and data
      </div>

      <header className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Link to={HOME_FOR_ROLE[role]} className="text-xl font-semibold text-accent-dark">
            Steady
            <span className="ml-2 text-sm font-normal text-muted">{data.orgName}</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-muted flex items-center gap-2">
              Viewing as:
              <select
                value={role}
                onChange={(e) => changeRole(e.target.value as Role)}
                className="border border-line rounded-md bg-white px-2 py-1.5 text-ink"
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>

            {role === 'team-lead' && (
              <label className="text-sm text-muted flex items-center gap-2">
                Team:
                <select
                  value={teamLeadTeamId}
                  onChange={(e) => setTeamLeadTeamId(e.target.value)}
                  className="border border-line rounded-md bg-white px-2 py-1.5 text-ink"
                >
                  {data.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <nav aria-label="Main" className="max-w-6xl mx-auto px-4 pb-2 flex flex-wrap gap-1">
          {navFor(role).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                'px-3 py-1.5 rounded-md text-sm ' +
                (isActive
                  ? 'bg-accent text-white font-medium'
                  : 'text-ink hover:bg-accent-soft')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 outline-none">
        <Suspense fallback={<p role="status" className="text-muted">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-line bg-white text-sm text-muted">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap justify-between gap-2">
          <span>Steady is a portfolio prototype. It is not a clinical tool.</span>
          {role === 'employee' && (
            <Link to="/help" className="text-accent-dark underline font-medium">
              Need support now?
            </Link>
          )}
        </div>
      </footer>
    </div>
  )
}

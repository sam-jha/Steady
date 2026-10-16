// Shares the organisation data and the "Viewing as" role with every page.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { loadData, loadRole, resetData, saveData, saveRole } from './store'
import type { OrgData, Role } from './schemas'

interface AppState {
  data: OrgData
  updateData: (change: (current: OrgData) => OrgData) => void
  resetToDemo: () => void
  role: Role
  setRole: (role: Role) => void
  /** Which team a "Team lead" is looking at (used for the team lead view). */
  teamLeadTeamId: string
  setTeamLeadTeamId: (id: string) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OrgData>(loadData)
  const [role, setRoleState] = useState<Role>(loadRole)
  const [chosenTeam, setTeamLeadTeamId] = useState('team-netops')
  // If the chosen team no longer exists (data was replaced), fall back to the first team.
  const teamLeadTeamId = data.teams.some((t) => t.id === chosenTeam) ? chosenTeam : (data.teams[0]?.id ?? '')

  const updateData = useCallback((change: (current: OrgData) => OrgData) => {
    setData((current) => {
      const next = change(current)
      saveData(next)
      return next
    })
  }, [])

  const resetToDemo = useCallback(() => setData(resetData()), [])

  const setRole = useCallback((r: Role) => {
    setRoleState(r)
    saveRole(r)
  }, [])

  const value = useMemo(
    () => ({ data, updateData, resetToDemo, role, setRole, teamLeadTeamId, setTeamLeadTeamId }),
    [data, updateData, resetToDemo, role, setRole, teamLeadTeamId],
  )
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

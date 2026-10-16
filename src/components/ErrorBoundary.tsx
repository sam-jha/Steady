import { Component, type ReactNode } from 'react'
import { resetData } from '../data/store'

/** Catches unexpected errors so a visitor sees a helpful message, not a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="max-w-xl mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p>Sorry, Steady hit a problem. This can happen if saved data in your browser is out of date. Resetting to the demo data usually fixes it. Your files and spreadsheets are not affected.</p>
        <button type="button" className="px-4 py-2 rounded-md bg-accent text-white" onClick={() => { resetData(); window.location.reload() }}>Reset to demo data and reload</button>
      </main>
    )
  }
}

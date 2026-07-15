/**
 * Route-scoped error boundary (v1's one correct pattern, ported as design).
 * It wraps the routed page only — the dock survives every crash, so the user
 * can always navigate away.
 */
import { Component, type ReactNode } from 'react'

interface Props {
  /** Change this (e.g. pathname) to auto-reset after navigation. */
  resetKey: string
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page error-state">
          <p className="eyebrow">SOMETHING BROKE</p>
          <h1 className="t-display">The lights flickered.</h1>
          <p className="t-body">The rest of the app is fine — try another tab, or try again.</p>
          <button className="pill pill-primary press" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

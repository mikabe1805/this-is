// Navigation history management for proper back button functionality

export interface NavigationState {
  from: 'home' | 'list-modal' | 'hub-modal' | 'list-page' | 'hub-page'
  listId?: string
  hubId?: string
  timestamp: number
}

class NavigationHistory {
  public history: NavigationState[] = []
  private maxHistory = 10

  push(state: Omit<NavigationState, 'timestamp'>) {
    const navigationState: NavigationState = {
      ...state,
      timestamp: Date.now()
    }
    
    this.history.push(navigationState)
    
    // Keep only the last maxHistory items
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory)
    }
    
    // Store in localStorage for persistence across page reloads
    localStorage.setItem('navigationHistory', JSON.stringify(this.history))
  }

  pop(): NavigationState | null {
    const state = this.history.pop()
    if (state) {
      localStorage.setItem('navigationHistory', JSON.stringify(this.history))
    }
    return state || null
  }

  peek(): NavigationState | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null
  }

  clear() {
    this.history = []
    localStorage.removeItem('navigationHistory')
  }

  getHistory(): NavigationState[] {
    return this.history;
  }

  // Load history from localStorage on app start
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('navigationHistory')
      if (stored) {
        this.history = JSON.parse(stored)
      }
    } catch (error) {
      console.warn('Failed to load navigation history from storage:', error)
      this.history = []
    }
  }

  // Get the previous state (second to last)
  getPreviousState(): NavigationState | null {
    return this.history.length > 1 ? this.history[this.history.length - 2] : null
  }
}

export const navigationHistory = new NavigationHistory()

// Initialize on module load
if (typeof window !== 'undefined') {
  navigationHistory.loadFromStorage()
} 
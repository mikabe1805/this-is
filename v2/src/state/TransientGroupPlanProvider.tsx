import { useCallback, useMemo, useReducer, type ReactNode } from 'react'
import {
  currentTransientGroupPlanDraft,
  transientGroupPlanReducer,
  type TransientGroupPlanDraftInput,
  type TransientGroupPlanEvidence,
} from '../domain/transientGroupPlan'
import {
  TransientGroupPlanContext,
  type TransientGroupPlanContextValue,
} from './transientGroupPlanContext'

/** App-lifetime memory only. Deliberately no storage, URL, Firebase, analytics,
 * or serialization adapter exists in this provider. A reload clears it. */
export function TransientGroupPlanProvider({ children }: { children: ReactNode }) {
  const [draft, dispatch] = useReducer(transientGroupPlanReducer, null)

  const rememberDraft = useCallback((value: TransientGroupPlanDraftInput) => {
    const normalized = transientGroupPlanReducer(null, { type: 'remember', draft: value })
    dispatch({ type: 'remember', draft: value })
    return normalized
  }, [])

  const peekDraft = useCallback((evidence: TransientGroupPlanEvidence) => (
    currentTransientGroupPlanDraft(draft, evidence)
  ), [draft])

  const clearDraft = useCallback((groupId?: string) => {
    dispatch({ type: 'clear', ...(groupId ? { groupId } : {}) })
  }, [])

  const consumeDraft = useCallback((evidence: TransientGroupPlanEvidence) => {
    const current = currentTransientGroupPlanDraft(draft, evidence)
    dispatch({ type: 'clear', groupId: evidence.groupId })
    return current
  }, [draft])

  const value = useMemo<TransientGroupPlanContextValue>(() => ({
    draft,
    rememberDraft,
    peekDraft,
    consumeDraft,
    clearDraft,
  }), [clearDraft, consumeDraft, draft, peekDraft, rememberDraft])

  return (
    <TransientGroupPlanContext.Provider value={value}>
      {children}
    </TransientGroupPlanContext.Provider>
  )
}

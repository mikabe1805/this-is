import { createContext } from 'react'
import type {
  TransientGroupPlanDraft,
  TransientGroupPlanDraftInput,
  TransientGroupPlanEvidence,
} from '../domain/transientGroupPlan'

export interface TransientGroupPlanContextValue {
  draft: TransientGroupPlanDraft | null
  rememberDraft(value: TransientGroupPlanDraftInput): TransientGroupPlanDraft | null
  peekDraft(evidence: TransientGroupPlanEvidence): TransientGroupPlanDraft | null
  /** Call from an event or effect, not while rendering. */
  consumeDraft(evidence: TransientGroupPlanEvidence): TransientGroupPlanDraft | null
  clearDraft(groupId?: string): void
}

export const TransientGroupPlanContext = createContext<TransientGroupPlanContextValue | null>(null)

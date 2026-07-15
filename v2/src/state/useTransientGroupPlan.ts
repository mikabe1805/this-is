import { useContext } from 'react'
import { TransientGroupPlanContext, type TransientGroupPlanContextValue } from './transientGroupPlanContext'

export function useTransientGroupPlan(): TransientGroupPlanContextValue {
  const value = useContext(TransientGroupPlanContext)
  if (!value) throw new Error('useTransientGroupPlan must be used inside TransientGroupPlanProvider')
  return value
}

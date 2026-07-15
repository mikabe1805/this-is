import { useEffect, useState } from 'react'
import { watchGroupDraftPasses, type GroupDraftPass } from '../data/groups'
import { groupDraftKey, groupDraftPassId, type GroupDraftIdentity } from '../domain/groupDraft'

interface GroupDraftPassState {
  draftKey: string | null
  passes: GroupDraftPass[]
  status: 'idle' | 'loading' | 'live' | 'error'
}

export function useGroupDraftPasses(input: {
  enabled: boolean
  groupId: string
  identity: GroupDraftIdentity | null
  candidatePlaceIds: string[]
}): GroupDraftPassState {
  const [state, setState] = useState<GroupDraftPassState>({
    draftKey: null,
    passes: [],
    status: 'idle',
  })

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    if (!input.enabled || !input.identity || input.candidatePlaceIds.length === 0) {
      setState({ draftKey: null, passes: [], status: 'idle' })
      return
    }
    setState({ draftKey: null, passes: [], status: 'loading' })
    void (async () => {
      try {
        const draftKey = await groupDraftKey(input.identity!)
        const passIds = await Promise.all(input.candidatePlaceIds.map(placeId =>
          groupDraftPassId(draftKey, placeId)))
        if (cancelled) return
        unsubscribe = watchGroupDraftPasses(input.groupId, passIds, passes => {
          if (!cancelled) setState({ draftKey, passes, status: 'live' })
        }, () => {
          if (!cancelled) setState(current => ({ ...current, status: 'error' }))
        })
      } catch {
        if (!cancelled) setState({ draftKey: null, passes: [], status: 'error' })
      }
    })()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [input.candidatePlaceIds, input.enabled, input.groupId, input.identity])

  return state
}

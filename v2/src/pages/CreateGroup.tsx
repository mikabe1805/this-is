import { FormEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { createGroup } from '../data/groups'
import { haptics } from '../lib/haptics'
import { useSession } from '../state/session'
import { signIn } from '../lib/authWatch'
import { prototypeFailure } from '../lib/prototypeMode'

export default function CreateGroup() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useSession()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle')
  const creationKey = useRef(crypto.randomUUID())

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'creating' || name.trim().length < 2) return
    setStatus('creating')
    haptics.tap()
    try {
      if (prototypeFailure('create-group-response')) throw new Error('prototype ambiguous response')
      const groupId = await createGroup(name, creationKey.current)
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      haptics.success()
      navigate(`/g/${groupId}`, { replace: true })
    } catch {
      haptics.warn()
      setStatus('error')
    }
  }

  if (session.status === 'unknown') {
    return <div className="page group-page" aria-busy="true" aria-label="Checking your account">
      <div className="together-skeleton skeleton" aria-hidden />
    </div>
  }

  if (session.status === 'signed-out') {
    return (
      <div className="page group-page">
        <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>
        <section className="empty-state invite-scene group-invite-scene group-auth-gate">
          <p className="eyebrow">NEW GROUP</p>
          <h1 className="t-display">Sign in before you create a group.</h1>
          <p className="t-body">Invitations and membership belong to your account. Signing in does not share anything from Keep.</p>
          <button className="pill pill-primary press" onClick={() => void signIn()}>Continue with Google</button>
        </section>
      </div>
    )
  }

  return (
    <div className="page group-page">
      <button className="eyebrow back-link press" onClick={() => navigate(-1)}>← BACK</button>
      <section className="group-refractive-field group-create-field">
        <p className="eyebrow">NEW GROUP</p>
        <h1 className="t-display">Give your group a name.</h1>
        <p className="t-small">Use the name already familiar in chat. You’ll make a separate private link for each person next.</p>
      </section>
      <form className="group-create-form" onSubmit={event => void submit(event)}>
        <label className="eyebrow" htmlFor="group-name">GROUP NAME</label>
        <input
          id="group-name"
          className="add-input"
          value={name}
          maxLength={60}
          autoComplete="off"
          placeholder="Friday Table"
          disabled={status === 'creating'}
          onChange={event => {
            setName(event.target.value)
            creationKey.current = crypto.randomUUID()
            setStatus('idle')
          }}
        />
        <p className="t-small">Family, roommates, the coffee crew—whatever you already call them. Creating or joining never exposes personal Keep. After everyone accepts, the first shared hint or place closes invitations so the audience cannot change.</p>
        <button className="pill pill-primary press" disabled={status === 'creating' || name.trim().length < 2}>
          {status === 'creating' ? 'Creating…' : status === 'error' ? 'Try creating again' : 'Create group'}
        </button>
        {status === 'error' && <p className="t-small" role="alert">We couldn’t confirm the result. Nothing from Keep was shared, and trying again won’t make a duplicate.</p>}
      </form>
    </div>
  )
}

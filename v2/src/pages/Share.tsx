/**
 * /s/:token — public shared board, browsable signed-out (W4). The Cloud
 * Function bakes ≤100 denormalized card snapshots into shares/{token} so
 * rules never grant cross-user reads. Route reserved.
 */
import { useParams } from 'react-router-dom'

export default function Share() {
  const { token } = useParams<{ token: string }>()
  return (
    <div className="page">
      <section className="empty-state">
        <p className="eyebrow">SHARED BOARD</p>
        <h1 className="t-display">Sharing lands in week 4.</h1>
        <p className="t-small">token: {token}</p>
      </section>
    </div>
  )
}

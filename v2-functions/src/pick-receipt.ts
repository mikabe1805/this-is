export const PICK_RECEIPT_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

export type ReceiptStatus = 'selected' | 'visited'
const RECEIPT_CONTEXTS = ['Anything', 'Food', 'Drinks', 'Coffee']

export interface PickReceipt {
  placeId: string
  placeName: string
  primaryType?: string
  neighborhood?: string
  reason: string
  context: string
  attendeeCount: number
  status: ReceiptStatus
  createdAt: number
  expiresAt: number
}

const RECEIPT_STYLES = `
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#120b0d;color:#f6eadc}
    *{box-sizing:border-box}html{min-width:320px;background:#120b0d}body{position:relative;margin:0;min-height:100vh;display:grid;place-items:center;overflow-x:hidden;padding:24px;background:radial-gradient(circle at 16% 12%,#95594880,transparent 36%),radial-gradient(circle at 88% 84%,#a7673552,transparent 38%),linear-gradient(160deg,#201315,#10090b 68%)}
    body::before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.1;background:repeating-linear-gradient(118deg,transparent 0 22px,#f4d5b50d 23px,transparent 24px);mix-blend-mode:screen}
    main{position:relative;isolation:isolate;overflow:hidden;width:min(100%,520px);padding:clamp(26px,8vw,38px);border:1px solid #f7d8b43d;border-radius:28px;background:linear-gradient(145deg,#70443152,#211719eb);box-shadow:0 30px 90px #09050499,inset 0 1px #ffe1bd33;backdrop-filter:blur(20px)}
    main::before{content:"";position:absolute;z-index:-1;width:240px;height:240px;right:-120px;top:-140px;border-radius:50%;background:#d2874650;filter:blur(34px)}
    .mark,.label{font-size:12px;letter-spacing:.16em;text-transform:uppercase}.mark{color:#e8aa70}.label{color:#c8a88e;margin:30px 0 9px}h1{overflow-wrap:anywhere;font-family:Georgia,"Times New Roman",serif;font-size:clamp(38px,10vw,64px);line-height:.95;letter-spacing:-.04em;margin:20px 0 12px}p{line-height:1.55}.meta{overflow-wrap:anywhere;color:#cbb7a7;margin:0}.reason{overflow-wrap:anywhere;font-size:20px;margin:0}.state{display:inline-flex;align-items:center;flex-wrap:wrap;gap:7px 10px;margin-top:26px;padding:9px 13px;border-radius:999px;background:#e6a7681f;border:1px solid #f0ba8338;color:#f1c397}.state-detail{color:#d4b69d;font-size:13px}a{display:flex;align-items:center;justify-content:center;min-height:50px;margin-top:30px;padding:14px 18px;border-radius:999px;text-align:center;text-decoration:none;color:#241714;background:#e5a463;font-weight:750}a:focus-visible{outline:3px solid #f8ddc1;outline-offset:4px}.unavailable h1{font-size:clamp(36px,9vw,56px)}.unavailable p{color:#d3bdab;margin:0}.unavailable .mark{margin-bottom:8px}
    @media(max-width:420px){body{padding:16px}main{border-radius:22px}.reason{font-size:18px}}
  `

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character)
}

function mapsUrl(receipt: PickReceipt): string {
  const query = encodeURIComponent(receipt.placeName)
  const googlePlaceId = receipt.placeId.startsWith('g:') ? receipt.placeId.slice(2) : ''
  return `https://www.google.com/maps/search/?api=1&query=${query}${googlePlaceId ? `&query_place_id=${encodeURIComponent(googlePlaceId)}` : ''}`
}

export function validPickReceipt(value: unknown, now = Date.now()): value is PickReceipt {
  if (!value || typeof value !== 'object') return false
  const receipt = value as Record<string, unknown>
  return typeof receipt.placeId === 'string'
    && receipt.placeId.length > 0
    && receipt.placeId.length <= 512
    && typeof receipt.placeName === 'string'
    && receipt.placeName.length > 0
    && receipt.placeName.length <= 160
    && (receipt.primaryType === undefined
      || (typeof receipt.primaryType === 'string' && receipt.primaryType.length <= 80))
    && (receipt.neighborhood === undefined
      || (typeof receipt.neighborhood === 'string' && receipt.neighborhood.length <= 160))
    && typeof receipt.reason === 'string'
    && receipt.reason.length > 0
    && receipt.reason.length <= 240
    && typeof receipt.context === 'string'
    && RECEIPT_CONTEXTS.includes(receipt.context)
    && Number.isSafeInteger(receipt.attendeeCount)
    && Number(receipt.attendeeCount) >= 2
    && Number(receipt.attendeeCount) <= 7
    && ['selected', 'visited'].includes(String(receipt.status))
    && typeof receipt.createdAt === 'number'
    && Number.isFinite(receipt.createdAt)
    && receipt.createdAt <= now + 60_000
    && typeof receipt.expiresAt === 'number'
    && Number.isFinite(receipt.expiresAt)
    && receipt.expiresAt > now
    && receipt.expiresAt <= receipt.createdAt + PICK_RECEIPT_LIFETIME_MS
}

export function renderPickReceiptHtml(receipt: PickReceipt, canonicalUrl: string): string {
  const placeName = escapeHtml(receipt.placeName)
  const reason = escapeHtml(receipt.reason)
  const canonical = escapeHtml(canonicalUrl)
  const map = escapeHtml(mapsUrl(receipt))
  const metadata = [receipt.primaryType, receipt.neighborhood]
    .filter((value): value is string => Boolean(value))
    .map(escapeHtml)
    .join(' · ')
  const state = receipt.status === 'visited' ? 'The group went' : `${receipt.attendeeCount} going`
  const stateDetail = receipt.status === 'visited' ? `${receipt.attendeeCount} were on the plan` : ''
  const description = escapeHtml(`${reason} ${state}.`)
  const context = escapeHtml(receipt.context)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#1c1113">
  <title>${placeName} · this.is</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="this.is">
  <meta property="og:title" content="${placeName} · ${escapeHtml(state)}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${placeName} · ${escapeHtml(state)}">
  <meta name="twitter:description" content="${description}">
  <link rel="canonical" href="${canonical}">
  <style>${RECEIPT_STYLES}</style>
</head>
<body><main aria-labelledby="pick-title">
  <div class="mark">this.is · ${context}</div>
  <h1 id="pick-title">${placeName}</h1>
  ${metadata ? `<p class="meta">${metadata}</p>` : ''}
  <p class="label">Why it fits</p><p class="reason">${reason}</p>
  <div class="state"><span>${escapeHtml(state)}</span>${stateDetail ? `<span class="state-detail">${escapeHtml(stateDetail)}</span>` : ''}</div>
  <a href="${map}" target="_blank" rel="noopener noreferrer" aria-label="Open ${placeName} in Google Maps">Open in Google Maps ↗</a>
</main></body>
</html>`
}

export function renderUnavailablePickReceiptHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#1c1113">
  <title>Pick unavailable · this.is</title>
  <meta name="robots" content="noindex,nofollow,noarchive">
  <style>${RECEIPT_STYLES}</style>
</head>
<body><main class="unavailable" aria-labelledby="unavailable-title">
  <div class="mark">this.is · Pick unavailable</div>
  <h1 id="unavailable-title">That Pick link is no longer available.</h1>
  <p>It may have expired, or someone in the group may have turned it off. Ask the sender for the current plan.</p>
</main></body>
</html>`
}

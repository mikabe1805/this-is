import {
  PICK_RECEIPT_LIFETIME_MS,
  renderPickReceiptHtml,
  renderUnavailablePickReceiptHtml,
  validPickReceipt,
  type PickReceipt,
} from './pick-receipt.js'

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const now = 1_000
const receipt: PickReceipt = {
  placeId: 'g:ChIJproof', placeName: 'Radio & Bakery', primaryType: 'Bakery',
  neighborhood: 'Greenpoint', reason: 'All 3 want this.', context: 'Coffee',
  attendeeCount: 3, status: 'selected', createdAt: now,
  expiresAt: now + PICK_RECEIPT_LIFETIME_MS,
}
assert(validPickReceipt(receipt, now), 'current bounded receipt is accepted')
assert(!validPickReceipt({ ...receipt, expiresAt: now }, now), 'expired receipt is rejected')
assert(validPickReceipt({ ...receipt, attendeeCount: 7 }, now), 'a six-person group may include one unnamed guest')
assert(!validPickReceipt({ ...receipt, attendeeCount: 8 }, now), 'audience count stays bounded')
assert(!validPickReceipt({ ...receipt, context: 'Secret meeting' }, now), 'context stays allowlisted')

const hostile = renderPickReceiptHtml({
  ...receipt,
  placeName: '<script>alert(1)</script>',
  reason: '" onload="steal()',
}, 'https://this.is/pick/token?x=<bad>')
assert(!hostile.includes('<script>alert(1)</script>'), 'place name is HTML-escaped')
assert(!hostile.includes('" onload="steal()'), 'attribute-shaped reason is HTML-escaped')
assert(hostile.includes('query_place_id=ChIJproof'), 'Google Place ID is handed to Maps')

const html = renderPickReceiptHtml(receipt, 'https://this.is/pick/proof')
assert(html.includes('og:title'), 'receipt is crawler-readable without JavaScript')
assert(html.includes('3 going'), 'receipt includes attendee count, not identities')
assert(!html.includes('uid'), 'receipt has no member identifiers')
const visitedHtml = renderPickReceiptHtml({ ...receipt, status: 'visited' }, 'https://this.is/pick/proof')
assert(visitedHtml.includes('The group went'), 'visited receipt closes the shared status')
assert(visitedHtml.includes('3 were on the plan'), 'visited receipt keeps the attendee count without claiming everyone attended')
const unavailableHtml = renderUnavailablePickReceiptHtml()
assert(unavailableHtml.includes('That Pick link is no longer available.'), 'expired and revoked links receive a calm recipient explanation')
assert(!unavailableHtml.includes('sign in'), 'an unavailable public receipt does not manufacture an account task')
console.log('✓ public Pick receipts are bounded, escaped, and unfurlable')

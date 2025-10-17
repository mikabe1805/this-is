// Lightweight tests for map cache key and throttling

function cellIdFromBounds(bounds: { north: number; south: number; east: number; west: number }): string {
  const snap = (v: number) => (Math.round(v * 100) / 100).toFixed(2)
  return `${snap(bounds.north)}:${snap(bounds.south)}:${snap(bounds.east)}:${snap(bounds.west)}`
}

function throttle<T extends (...a: any[]) => any>(fn: T, ms: number) {
  let last = 0; let timer: any
  return (...args: any[]) => {
    const now = Date.now()
    if (now - last >= ms) { last = now; return fn(...args) }
    clearTimeout(timer)
    timer = setTimeout(() => { last = Date.now(); fn(...args) }, ms - (now - last))
  }
}

async function testCellId() {
  const id = cellIdFromBounds({ north: 37.8099, south: 37.7001, east: -122.349, west: -122.531 })
  if (id !== '37.81:37.70:-122.35:-122.53') throw new Error('cellId rounding failed: ' + id)
}

async function testThrottle() {
  let calls = 0
  const fn = throttle(() => { calls++ }, 750)
  fn(); fn(); fn()
  await new Promise(r => setTimeout(r, 100))
  fn()
  await new Promise(r => setTimeout(r, 800))
  if (calls < 2) throw new Error('throttle did not allow second call after window')
}

(async () => {
  try {
    await testCellId()
    await testThrottle()
    console.log('OK: maps throttling + cache key tests passed')
  } catch (e) {
    console.error('FAIL:', (e as any).message)
    process.exit(1)
  }
})()


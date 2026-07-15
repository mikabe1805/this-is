const expectedMajor = 22
const actual = process.versions.node
const actualMajor = Number(actual.split('.')[0])

if (actualMajor !== expectedMajor) {
  console.error(`Node ${expectedMajor}.x is required for canonical Firebase Functions parity; current runtime is ${actual}.`)
  console.error('Switch Node using .nvmrc or .node-version, then rerun this command.')
  process.exit(1)
}

console.log(`PASS Node ${actual} matches the canonical Firebase Functions 22.x runtime.`)

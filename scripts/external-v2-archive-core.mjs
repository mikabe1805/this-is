export function parsePorcelainV1Z(source) {
  const records = source.split('\0')
  const changes = []
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    if (!record) continue
    if (record.length < 4 || record[2] !== ' ') throw new Error('Unexpected Git status record.')
    const status = record.slice(0, 2)
    const path = record.slice(3)
    const change = { status, path }
    if (/[RC]/.test(status)) {
      const originalPath = records[++index]
      if (!originalPath) throw new Error('Rename/copy record is missing its original path.')
      change.originalPath = originalPath
    }
    changes.push(change)
  }
  return changes
}

export function summarizeArchiveChanges(changes) {
  return {
    total: changes.length,
    modified: changes.filter(change => /M/.test(change.status)).length,
    added: changes.filter(change => /A/.test(change.status)).length,
    deleted: changes.filter(change => /D/.test(change.status)).length,
    renamedOrCopied: changes.filter(change => /[RC]/.test(change.status)).length,
    untracked: changes.filter(change => change.status === '??').length,
  }
}

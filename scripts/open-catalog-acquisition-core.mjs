import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { validateOpenCatalogManifest } from './open-catalog-manifest-core.mjs'

const OUTPUT_PATH = /^output\/open-catalog\/[A-Za-z0-9._/-]+\.json$/
const MIN_DUCKDB = [1, 1, 0]

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function validOutputPath(value) {
  return typeof value === 'string' && OUTPUT_PATH.test(value)
    && !value.includes('..') && !value.includes('\\')
}

export function parseDuckDbVersion(output) {
  const match = String(output).match(/\bv?(\d+)\.(\d+)\.(\d+)\b/i)
  if (!match) return null
  const version = match.slice(1, 4).map(Number)
  const supported = version.some((part, index) => part > MIN_DUCKDB[index]
    && version.slice(0, index).every((prior, priorIndex) => prior === MIN_DUCKDB[priorIndex]))
    || version.every((part, index) => part === MIN_DUCKDB[index])
  return supported ? { text: match[0].replace(/^v/i, ''), parts: version } : null
}

export function buildOpenCatalogDuckDbSql(manifest, ndjsonPath) {
  const issues = validateOpenCatalogManifest(manifest)
  if (issues.length || manifest.stage !== 'planned') {
    throw new Error(`Open-catalog acquisition requires one valid planned manifest: ${issues[0] ?? 'stage must be planned'}`)
  }
  if (typeof ndjsonPath !== 'string' || !ndjsonPath.trim()) throw new Error('Raw output path is required.')
  const [west, south, east, north] = manifest.areaExtraction.bbox
  const limit = manifest.limits.maxRawRows + 1
  return [
    'LOAD spatial;',
    'LOAD httpfs;',
    "SET s3_region='us-west-2';",
    'COPY (',
    '  SELECT',
    '    id,',
    "    struct_pack(type := 'Point', coordinates := [ST_X(geometry), ST_Y(geometry)]) AS geometry,",
    '    struct_pack(primary := names.primary) AS names,',
    '    basic_category,',
    '    struct_pack(primary := taxonomy.primary, alternates := taxonomy.alternates, hierarchy := taxonomy.hierarchy) AS taxonomy,',
    '    operating_status,',
    '    websites,',
    '    confidence,',
    '    sources',
    `  FROM read_parquet(${sqlString(manifest.release.placesUri)}, filename = true, hive_partitioning = true)`,
    `  WHERE bbox.xmin >= ${west} AND bbox.ymin >= ${south}`,
    `    AND bbox.xmax <= ${east} AND bbox.ymax <= ${north}`,
    '  ORDER BY id',
    `  LIMIT ${limit}`,
    `) TO ${sqlString(ndjsonPath.replaceAll('\\', '/'))} (FORMAT JSON, ARRAY false);`,
  ].join('\n')
}

function checkedSpawn(command, args, label, spawn = spawnSync) {
  const result = spawn(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    maxBuffer: 1_000_000,
  })
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.error?.message || '').trim().slice(0, 500)
    throw new Error(`${label} failed${detail ? `: ${detail}` : '.'}`)
  }
  return result
}

function resolveArtifactPath(workspaceRoot, artifactOutputPath) {
  if (!isAbsolute(workspaceRoot) || !validOutputPath(artifactOutputPath)) {
    throw new Error('Artifact output must stay under output/open-catalog and end in .json.')
  }
  const root = resolve(workspaceRoot)
  const output = resolve(root, ...artifactOutputPath.split('/'))
  const outputRoot = resolve(root, 'output', 'open-catalog')
  const fromRoot = relative(outputRoot, output)
  if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) {
    throw new Error('Artifact output escaped output/open-catalog.')
  }
  return { output, outputRoot }
}

function parseRows(path, maxRawRows, maxBytes) {
  const size = statSync(path).size
  if (size < 1 || size > maxBytes) throw new Error('Raw extraction byte ceiling exceeded.')
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
  if (lines.length < 1) throw new Error('DuckDB returned no rows.')
  if (lines.length > maxRawRows) throw new Error('Raw row ceiling exceeded; use a smaller explicit bbox.')
  return lines.map((line, index) => {
    try {
      const value = JSON.parse(line)
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('shape')
      return value
    } catch {
      throw new Error(`DuckDB row ${index + 1} is not one JSON object.`)
    }
  })
}

/** Explicit network acquisition only. The caller supplies the compiled domain
 * codec; this core cannot upload, activate, or mutate the reviewed manifest. */
export function runOpenCatalogAcquisition({
  manifest,
  workspaceRoot,
  artifactOutputPath,
  duckdbCommand,
  duckdbArgsPrefix = [],
  domain,
  ingestedAt = Date.now(),
  spawn = spawnSync,
}) {
  const issues = validateOpenCatalogManifest(manifest)
  if (issues.length || manifest.stage !== 'planned') {
    throw new Error(`Open-catalog acquisition requires one valid planned manifest: ${issues[0] ?? 'stage must be planned'}`)
  }
  if (typeof duckdbCommand !== 'string' || !isAbsolute(duckdbCommand) || !existsSync(duckdbCommand)) {
    throw new Error('DuckDB must be an explicit existing absolute executable path.')
  }
  if (!Array.isArray(duckdbArgsPrefix) || !duckdbArgsPrefix.every(value => typeof value === 'string')) {
    throw new Error('DuckDB argument prefix is invalid.')
  }
  if (!domain || typeof domain.extractOpenCatalogRows !== 'function'
    || typeof domain.buildOpenCatalogArtifact !== 'function'
    || typeof domain.serializeOpenCatalogArtifact !== 'function') {
    throw new Error('Compiled open-catalog domain codec is unavailable.')
  }
  const versionResult = checkedSpawn(duckdbCommand, [...duckdbArgsPrefix, '--version'], 'DuckDB version check', spawn)
  const version = parseDuckDbVersion(versionResult.stdout)
  if (!version) throw new Error('DuckDB 1.1.0 or newer is required.')

  const { output, outputRoot } = resolveArtifactPath(workspaceRoot, artifactOutputPath)
  if (existsSync(output)) throw new Error('Artifact output already exists; refusing to overwrite it.')
  mkdirSync(outputRoot, { recursive: true })
  const rawPath = join(outputRoot, `.raw-${process.pid}-${Date.now()}.ndjson`)
  const sql = buildOpenCatalogDuckDbSql(manifest, rawPath)
  try {
    checkedSpawn(duckdbCommand, [...duckdbArgsPrefix, '-c', sql], 'DuckDB acquisition', spawn)
    if (!existsSync(rawPath)) throw new Error('DuckDB did not create the bounded raw extraction.')
    const rows = parseRows(rawPath, manifest.limits.maxRawRows, manifest.limits.maxArtifactBytes)
    const context = {
      releaseId: manifest.release.releaseId,
      schemaVersion: manifest.release.schemaVersion,
      licenseLedgerId: manifest.licenseLedger.id,
      ingestedAt,
    }
    const extraction = domain.extractOpenCatalogRows({
      rows,
      bbox: manifest.areaExtraction.bbox,
      context,
      limits: {
        maxRawRows: manifest.limits.maxRawRows,
        maxAcceptedRows: manifest.limits.maxAcceptedRows,
        maxCells: manifest.areaExtraction.maxCells,
      },
    })
    const serialized = domain.serializeOpenCatalogArtifact(domain.buildOpenCatalogArtifact({
      extraction,
      bbox: manifest.areaExtraction.bbox,
      context,
    }))
    const bytes = Buffer.from(serialized, 'utf8')
    if (bytes.byteLength < 1 || bytes.byteLength > manifest.limits.maxArtifactBytes) {
      throw new Error('Final artifact byte ceiling exceeded.')
    }
    writeFileSync(output, bytes, { flag: 'wx' })
    return {
      stage: 'extracted',
      provider: 'overture',
      releaseId: context.releaseId,
      overtureSchemaVersion: context.schemaVersion,
      licenseLedgerId: context.licenseLedgerId,
      duckdbVersion: version.text,
      artifact: {
        relativePath: artifactOutputPath,
        bytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        generatedAt: new Date(ingestedAt).toISOString(),
      },
      counts: extraction.counts,
      cellCount: extraction.cells.length,
      safety: {
        explicitBboxOnly: true,
        providerPathPinned: true,
        manifestMutated: false,
        uploaded: false,
        servingEnabled: false,
      },
    }
  } finally {
    if (existsSync(rawPath)) rmSync(rawPath)
    const strayRaw = readdirSync(outputRoot).filter(name => name.startsWith('.raw-'))
    if (strayRaw.length) throw new Error('Temporary raw extraction cleanup did not complete.')
  }
}

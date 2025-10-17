#!/usr/bin/env node

/**
 * Search endpoint synthetic benchmark
 * Simulates concurrent users making search queries over a fixed duration
 */

import { request } from 'undici';
import { writeFileSync } from 'fs';
import { calculateStats } from './percentiles.mjs';
import 'dotenv/config';

// Cost constants (USD)
const COSTS = {
  firestoreRead: 0.06 / 100000,
  firestoreWrite: 0.18 / 100000,
  cloudFunction: 0.40 / 1000000
};

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = { reads: 3, writes: 0 };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--reads' && args[i + 1]) {
      params.reads = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--writes' && args[i + 1]) {
      params.writes = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  return params;
}

const CLI_PARAMS = parseArgs();

// Sample queries - realistic search patterns
const QUERIES = [
  'coffee shops near me',
  'best pizza',
  'italian restaurant downtown',
  'sushi',
  'craft beer bar',
  'vegan restaurants',
  'rooftop bar',
  'romantic dinner spot',
  'brunch',
  'late night food',
  'tacos',
  'wine bar',
  'ramen',
  'michelin star',
  'burger joint',
  'seafood',
  'live music venue',
  'cocktail bar',
  'date night ideas',
  'happy hour',
  'food trucks',
  'bakery',
  'dim sum',
  'steakhouse',
  'thai food',
  'mediterranean',
  'breakfast spots',
  'dessert cafe',
  'sports bar',
  'ethiopian restaurant',
  'korean bbq',
  'jazz club',
  'dive bar',
  'farm to table',
  'outdoor dining',
];

// Configuration
const BASE_URL = process.env.BASE_URL;
const USERS = parseInt(process.env.USERS || '300', 10);
const DURATION_SEC = parseInt(process.env.DURATION_SEC || '300', 10);
const MIN_THINK_MS = parseInt(process.env.MIN_THINK_MS || '5000', 10);
const MAX_THINK_MS = parseInt(process.env.MAX_THINK_MS || '10000', 10);
const REQUEST_TIMEOUT_MS = 10000;

// Results storage
const results = [];
let running = true;

/**
 * Get random integer between min and max (inclusive)
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get random query from the queries array
 */
function randomQuery() {
  return QUERIES[Math.floor(Math.random() * QUERIES.length)];
}

/**
 * Sleep for a random "think time" between min and max
 */
async function thinkTime() {
  const ms = randomInt(MIN_THINK_MS, MAX_THINK_MS);
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a single search request and record results
 */
async function makeSearchRequest(userId) {
  const query = randomQuery();
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    
    const response = await request(`${BASE_URL}/api/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headersTimeout: REQUEST_TIMEOUT_MS,
      bodyTimeout: REQUEST_TIMEOUT_MS,
    });
    
    clearTimeout(timeout);
    
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    // Get response body and calculate size
    const bodyText = await response.body.text();
    const contentLength = response.headers['content-length'];
    const bytes = contentLength ? parseInt(contentLength, 10) : Buffer.byteLength(bodyText, 'utf8');
    
    // Calculate cost per request
    const costPerRequest = 
      (CLI_PARAMS.reads * COSTS.firestoreRead) +
      (CLI_PARAMS.writes * COSTS.firestoreWrite) +
      COSTS.cloudFunction;
    
    return {
      ts_iso: timestamp,
      latency_ms: latency.toFixed(2),
      status: response.statusCode,
      query,
      userId,
      bytes,
      cost_usd: costPerRequest,
    };
  } catch (error) {
    const endTime = performance.now();
    const latency = endTime - startTime;
    
    // Record error with actual time elapsed or null if timeout
    const isTimeout = error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT';
    
    return {
      ts_iso: timestamp,
      latency_ms: isTimeout ? null : latency.toFixed(2),
      status: 'ERROR',
      query,
      userId,
      error: error.message,
      bytes: 0,
      cost_usd: 0,
    };
  }
}

/**
 * Simulate a single user making requests
 */
async function simulateUser(userId) {
  while (running) {
    await thinkTime();
    
    if (!running) break;
    
    const result = await makeSearchRequest(userId);
    results.push(result);
    
    // Log progress periodically
    if (results.length % 100 === 0) {
      process.stdout.write(`\rRequests: ${results.length}`);
    }
  }
}

/**
 * Write results to CSV file
 */
function writeCSV() {
  const header = 'ts_iso,latency_ms,status,bytes,cost_usd,query\n';
  const rows = results.map(r => 
    `${r.ts_iso},${r.latency_ms},${r.status},${r.bytes},${r.cost_usd.toFixed(10)},"${r.query.replace(/"/g, '""')}"`
  ).join('\n');
  
  writeFileSync('results-thisis.csv', header + rows);
  console.log('\n✓ Written results-thisis.csv');
}

/**
 * Generate and write markdown summary
 */
function writeMarkdown() {
  const totalRequests = results.length;
  const successResults = results.filter(r => typeof r.status === 'number' && r.status >= 200 && r.status < 400);
  const errorResults = results.filter(r => r.status === 'ERROR' || r.status >= 400);
  
  const latencies = successResults
    .map(r => parseFloat(r.latency_ms))
    .filter(l => !isNaN(l));
  
  const stats = calculateStats(latencies);
  const throughput = (totalRequests / DURATION_SEC).toFixed(2);
  
  // Calculate totals for cost and bytes
  const totalBytes = results.reduce((sum, r) => sum + (r.bytes || 0), 0);
  const totalCost = results.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
  const avgBytes = totalRequests > 0 ? (totalBytes / totalRequests).toFixed(0) : 0;
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  
  const summary = `# this.is Search Benchmark Results

**Synthetic load test in staging. Results represent engineered baselines, not real-user traffic.**

## Configuration

- **Endpoint**: \`${BASE_URL}/api/search\`
- **Users**: ${USERS} concurrent synthetic users
- **Duration**: ${DURATION_SEC}s
- **Think time**: ${MIN_THINK_MS}-${MAX_THINK_MS}ms between requests
- **Timeout**: ${REQUEST_TIMEOUT_MS}ms per request
- **Test date**: ${new Date().toISOString()}
- **Cost model**: ${CLI_PARAMS.reads} Firestore reads, ${CLI_PARAMS.writes} writes per request

## Summary

**this.is search benchmark — users=${USERS}, duration=${DURATION_SEC}s → p50=${stats.p50?.toFixed(2) || 'N/A'} ms | p95=${stats.p95?.toFixed(2) || 'N/A'} ms | p99=${stats.p99?.toFixed(2) || 'N/A'} ms | throughput=${throughput} req/s | ok=${successResults.length} | err=${errorResults.length}**

## Detailed Metrics

### Latency (Successful Requests)

| Metric | Value (ms) |
|--------|------------|
| p50 (median) | ${stats.p50?.toFixed(2) || 'N/A'} |
| p95 | ${stats.p95?.toFixed(2) || 'N/A'} |
| p99 | ${stats.p99?.toFixed(2) || 'N/A'} |
| Mean | ${stats.mean?.toFixed(2) || 'N/A'} |
| Min | ${stats.min?.toFixed(2) || 'N/A'} |
| Max | ${stats.max?.toFixed(2) || 'N/A'} |

### Throughput

| Metric | Value |
|--------|-------|
| Total requests | ${totalRequests} |
| Successful | ${successResults.length} (${((successResults.length / totalRequests) * 100).toFixed(1)}%) |
| Errors | ${errorResults.length} (${((errorResults.length / totalRequests) * 100).toFixed(1)}%) |
| Throughput | ${throughput} req/s |
| Avg requests/user | ${(totalRequests / USERS).toFixed(1)} |

### Data Transfer

| Metric | Value |
|--------|-------|
| Total data transferred | ${totalMB} MB |
| Average response size | ${avgBytes} bytes |
| Total bytes | ${totalBytes.toLocaleString()} |

### Cost Estimate

| Component | Rate | Usage | Cost (USD) |
|-----------|------|-------|------------|
| Firestore reads | $0.06 / 100k | ${(successResults.length * CLI_PARAMS.reads).toLocaleString()} | $${(successResults.length * CLI_PARAMS.reads * COSTS.firestoreRead).toFixed(4)} |
| Firestore writes | $0.18 / 100k | ${(successResults.length * CLI_PARAMS.writes).toLocaleString()} | $${(successResults.length * CLI_PARAMS.writes * COSTS.firestoreWrite).toFixed(4)} |
| Cloud Functions | $0.40 / 1M | ${successResults.length.toLocaleString()} invocations | $${(successResults.length * COSTS.cloudFunction).toFixed(4)} |
| **TOTAL** | | | **$${totalCost.toFixed(4)}** |

**Estimated Firestore/API cost for this synthetic load: $${totalCost.toFixed(4)}**

### Status Code Distribution

${getStatusDistribution(results)}

## Sample Queries Tested

${QUERIES.slice(0, 10).map(q => `- "${q}"`).join('\n')}
- _(... and ${QUERIES.length - 10} more)_

## Notes

- Latency measured client-side (includes network overhead)
- Queries randomly selected from ${QUERIES.length} predefined patterns
- Users staggered with random think times to simulate realistic load
- Errors include timeouts (>${REQUEST_TIMEOUT_MS}ms) and network failures
- Cost estimates assume ${CLI_PARAMS.reads} Firestore reads and ${CLI_PARAMS.writes} writes per successful request

---

**Raw data**: See \`results-thisis.csv\` for per-request details.
`;

  writeFileSync('results-thisis.md', summary);
  console.log('✓ Written results-thisis.md');
}

/**
 * Get status code distribution
 */
function getStatusDistribution(results) {
  const distribution = {};
  
  for (const r of results) {
    const status = r.status;
    distribution[status] = (distribution[status] || 0) + 1;
  }
  
  const sorted = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1]);
  
  return sorted.map(([status, count]) => 
    `- **${status}**: ${count} (${((count / results.length) * 100).toFixed(1)}%)`
  ).join('\n');
}

/**
 * Main benchmark execution
 */
async function runBenchmark() {
  // Validate configuration
  if (!BASE_URL) {
    console.error('❌ Error: BASE_URL environment variable is required');
    console.error('   Set it in your .env file, e.g.: BASE_URL=https://localhost:8080');
    process.exit(1);
  }
  
  console.log('🚀 Starting search benchmark\n');
  console.log(`Configuration:`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Users: ${USERS}`);
  console.log(`  Duration: ${DURATION_SEC}s`);
  console.log(`  Think time: ${MIN_THINK_MS}-${MAX_THINK_MS}ms`);
  console.log(`  Queries: ${QUERIES.length} patterns`);
  console.log(`  Cost model: ${CLI_PARAMS.reads} reads, ${CLI_PARAMS.writes} writes per request\n`);
  
  const startTime = Date.now();
  
  // Set timer to stop after duration
  setTimeout(() => {
    running = false;
    console.log('\n\n⏱️  Time limit reached, stopping...');
  }, DURATION_SEC * 1000);
  
  // Start all users
  console.log('👥 Spawning users...');
  const userPromises = [];
  for (let i = 0; i < USERS; i++) {
    userPromises.push(simulateUser(i));
  }
  
  console.log('📊 Benchmark running...\n');
  
  // Wait for all users to complete
  await Promise.all(userPromises);
  
  const endTime = Date.now();
  const actualDuration = (endTime - startTime) / 1000;
  
  console.log(`\n\n✅ Benchmark complete in ${actualDuration.toFixed(1)}s`);
  console.log(`   Total requests: ${results.length}\n`);
  
  // Write results
  console.log('📝 Writing results...');
  writeCSV();
  writeMarkdown();
  
  console.log('\n🎉 Done! Check results-thisis.md and results-thisis.csv');
}

// Run benchmark
runBenchmark().catch(error => {
  console.error('❌ Benchmark failed:', error);
  process.exit(1);
});


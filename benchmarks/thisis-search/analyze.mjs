#!/usr/bin/env node

/**
 * Analyze existing benchmark results from CSV
 * Recomputes statistics and regenerates the markdown summary
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { calculateStats } from './percentiles.mjs';

const CSV_FILE = 'results-thisis.csv';
const MD_FILE = 'results-thisis.md';

/**
 * Parse CSV file
 */
function parseCSV(filename) {
  if (!existsSync(filename)) {
    console.error(`❌ Error: ${filename} not found`);
    console.error('   Run "npm run bench" first to generate results');
    process.exit(1);
  }

  const content = readFileSync(filename, 'utf-8');
  const lines = content.trim().split('\n');
  
  // Skip header
  const dataLines = lines.slice(1);
  
  const results = dataLines.map(line => {
    // CSV format: ts_iso,latency_ms,status,bytes,cost_usd,query
    const match = line.match(/^([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),"(.+)"$/);
    if (!match) {
      console.warn('Warning: Could not parse line:', line);
      return null;
    }
    
    const [, ts_iso, latency_ms, status, bytes, cost_usd, query] = match;
    
    return {
      ts_iso,
      latency_ms: latency_ms === 'null' ? null : parseFloat(latency_ms),
      status: status === 'ERROR' ? 'ERROR' : parseInt(status, 10),
      bytes: parseInt(bytes, 10) || 0,
      cost_usd: parseFloat(cost_usd) || 0,
      query: query.replace(/""/g, '"'),
    };
  }).filter(Boolean);
  
  return results;
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
 * Calculate duration from timestamps
 */
function calculateDuration(results) {
  if (results.length === 0) return 0;
  
  const timestamps = results.map(r => new Date(r.ts_iso).getTime());
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  
  return (max - min) / 1000; // Convert to seconds
}

/**
 * Generate markdown summary
 */
function generateMarkdown(results, duration) {
  const totalRequests = results.length;
  const successResults = results.filter(r => 
    typeof r.status === 'number' && r.status >= 200 && r.status < 400
  );
  const errorResults = results.filter(r => 
    r.status === 'ERROR' || r.status >= 400
  );
  
  const latencies = successResults
    .map(r => r.latency_ms)
    .filter(l => l !== null && !isNaN(l));
  
  const stats = calculateStats(latencies);
  const throughput = duration > 0 ? (totalRequests / duration).toFixed(2) : 'N/A';
  
  // Calculate totals for cost and bytes
  const totalBytes = results.reduce((sum, r) => sum + (r.bytes || 0), 0);
  const totalCost = results.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
  const avgBytes = totalRequests > 0 ? (totalBytes / totalRequests).toFixed(0) : 0;
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  
  const summary = `# this.is Search Benchmark Results

**Synthetic load test in staging. Results represent engineered baselines, not real-user traffic.**

## Analysis Date

${new Date().toISOString()}

## Summary

**this.is search benchmark — duration=${duration.toFixed(0)}s → p50=${stats.p50?.toFixed(2) || 'N/A'} ms | p95=${stats.p95?.toFixed(2) || 'N/A'} ms | p99=${stats.p99?.toFixed(2) || 'N/A'} ms | throughput=${throughput} req/s | ok=${successResults.length} | err=${errorResults.length}**

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
| Duration | ${duration.toFixed(1)}s |

### Data Transfer

| Metric | Value |
|--------|-------|
| Total data transferred | ${totalMB} MB |
| Average response size | ${avgBytes} bytes |
| Total bytes | ${totalBytes.toLocaleString()} |

### Cost Estimate

**Estimated Firestore/API cost for this synthetic load: $${totalCost.toFixed(4)}**

*(Breakdown available in original benchmark report)*

### Status Code Distribution

${getStatusDistribution(results)}

---

**Raw data**: See \`results-thisis.csv\` for per-request details.

*This analysis was regenerated from existing CSV data using \`npm run analyze\`*
`;

  return summary;
}

/**
 * Main analysis
 */
function analyze() {
  console.log('📊 Analyzing benchmark results...\n');
  
  const results = parseCSV(CSV_FILE);
  console.log(`✓ Parsed ${results.length} requests from ${CSV_FILE}`);
  
  const duration = calculateDuration(results);
  console.log(`✓ Test duration: ${duration.toFixed(1)}s`);
  
  const markdown = generateMarkdown(results, duration);
  writeFileSync(MD_FILE, markdown);
  console.log(`✓ Written ${MD_FILE}`);
  
  console.log('\n🎉 Analysis complete!');
}

// Run analysis
analyze();


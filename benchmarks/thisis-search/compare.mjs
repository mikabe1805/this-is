#!/usr/bin/env node

/**
 * Compare two benchmark results (before/after optimization)
 * Shows performance improvements and cost savings
 */

import { readFileSync, existsSync } from 'fs';
import { calculateStats } from './percentiles.mjs';

/**
 * Parse CSV file
 */
function parseResults(filename) {
  if (!existsSync(filename)) {
    throw new Error(`File not found: ${filename}`);
  }

  const content = readFileSync(filename, 'utf-8');
  const lines = content.trim().split('\n');
  const dataLines = lines.slice(1);
  
  const results = dataLines.map(line => {
    const match = line.match(/^([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),"(.+)"$/);
    if (!match) return null;
    
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
 * Calculate summary statistics
 */
function getSummary(results) {
  const successResults = results.filter(r => 
    typeof r.status === 'number' && r.status >= 200 && r.status < 400
  );
  
  const latencies = successResults
    .map(r => r.latency_ms)
    .filter(l => l !== null && !isNaN(l));
  
  const stats = calculateStats(latencies);
  
  const totalBytes = results.reduce((sum, r) => sum + (r.bytes || 0), 0);
  const totalCost = results.reduce((sum, r) => sum + (r.cost_usd || 0), 0);
  
  return {
    total: results.length,
    success: successResults.length,
    errors: results.length - successResults.length,
    p50: stats.p50,
    p95: stats.p95,
    p99: stats.p99,
    mean: stats.mean,
    totalBytes,
    totalCost,
    avgBytes: totalBytes / results.length,
  };
}

/**
 * Calculate improvement percentage
 */
function improvement(before, after) {
  if (before === 0) return 0;
  return ((before - after) / before) * 100;
}

/**
 * Format improvement
 */
function formatImprovement(value, isReverse = false) {
  const sign = value > 0 ? '↓' : '↑';
  const color = (value > 0 && !isReverse) || (value < 0 && isReverse) ? '✓' : '✗';
  return `${color} ${sign}${Math.abs(value).toFixed(1)}%`;
}

/**
 * Compare two benchmark results
 */
function compare(beforeFile, afterFile) {
  console.log('📊 Benchmark Comparison\n');
  console.log('═'.repeat(70));
  
  const before = parseResults(beforeFile);
  const after = parseResults(afterFile);
  
  const beforeSummary = getSummary(before);
  const afterSummary = getSummary(after);
  
  console.log('\n📈 Latency Metrics\n');
  console.log('Metric'.padEnd(20) + 'Before'.padEnd(15) + 'After'.padEnd(15) + 'Change');
  console.log('─'.repeat(70));
  
  const p50Change = improvement(beforeSummary.p50, afterSummary.p50);
  const p95Change = improvement(beforeSummary.p95, afterSummary.p95);
  const p99Change = improvement(beforeSummary.p99, afterSummary.p99);
  const meanChange = improvement(beforeSummary.mean, afterSummary.mean);
  
  console.log('p50 (median)'.padEnd(20) + 
    `${beforeSummary.p50?.toFixed(2)}ms`.padEnd(15) +
    `${afterSummary.p50?.toFixed(2)}ms`.padEnd(15) +
    formatImprovement(p50Change));
  
  console.log('p95'.padEnd(20) + 
    `${beforeSummary.p95?.toFixed(2)}ms`.padEnd(15) +
    `${afterSummary.p95?.toFixed(2)}ms`.padEnd(15) +
    formatImprovement(p95Change));
  
  console.log('p99'.padEnd(20) + 
    `${beforeSummary.p99?.toFixed(2)}ms`.padEnd(15) +
    `${afterSummary.p99?.toFixed(2)}ms`.padEnd(15) +
    formatImprovement(p99Change));
  
  console.log('Mean'.padEnd(20) + 
    `${beforeSummary.mean?.toFixed(2)}ms`.padEnd(15) +
    `${afterSummary.mean?.toFixed(2)}ms`.padEnd(15) +
    formatImprovement(meanChange));
  
  console.log('\n💰 Cost Metrics\n');
  console.log('Metric'.padEnd(20) + 'Before'.padEnd(15) + 'After'.padEnd(15) + 'Change');
  console.log('─'.repeat(70));
  
  const costChange = improvement(beforeSummary.totalCost, afterSummary.totalCost);
  
  console.log('Total cost'.padEnd(20) + 
    `$${beforeSummary.totalCost.toFixed(4)}`.padEnd(15) +
    `$${afterSummary.totalCost.toFixed(4)}`.padEnd(15) +
    formatImprovement(costChange));
  
  const costPerReqBefore = beforeSummary.totalCost / beforeSummary.total;
  const costPerReqAfter = afterSummary.totalCost / afterSummary.total;
  const costPerReqChange = improvement(costPerReqBefore, costPerReqAfter);
  
  console.log('Cost per request'.padEnd(20) + 
    `$${costPerReqBefore.toFixed(8)}`.padEnd(15) +
    `$${costPerReqAfter.toFixed(8)}`.padEnd(15) +
    formatImprovement(costPerReqChange));
  
  console.log('\n📦 Data Transfer\n');
  console.log('Metric'.padEnd(20) + 'Before'.padEnd(15) + 'After'.padEnd(15) + 'Change');
  console.log('─'.repeat(70));
  
  const bytesChange = improvement(beforeSummary.avgBytes, afterSummary.avgBytes);
  
  console.log('Avg response size'.padEnd(20) + 
    `${beforeSummary.avgBytes.toFixed(0)} bytes`.padEnd(15) +
    `${afterSummary.avgBytes.toFixed(0)} bytes`.padEnd(15) +
    formatImprovement(bytesChange));
  
  const totalMbBefore = (beforeSummary.totalBytes / (1024 * 1024)).toFixed(2);
  const totalMbAfter = (afterSummary.totalBytes / (1024 * 1024)).toFixed(2);
  
  console.log('Total transfer'.padEnd(20) + 
    `${totalMbBefore} MB`.padEnd(15) +
    `${totalMbAfter} MB`.padEnd(15));
  
  console.log('\n✅ Reliability\n');
  console.log('Metric'.padEnd(20) + 'Before'.padEnd(15) + 'After'.padEnd(15) + 'Change');
  console.log('─'.repeat(70));
  
  const successRateBefore = (beforeSummary.success / beforeSummary.total) * 100;
  const successRateAfter = (afterSummary.success / afterSummary.total) * 100;
  const reliabilityChange = successRateAfter - successRateBefore;
  
  console.log('Success rate'.padEnd(20) + 
    `${successRateBefore.toFixed(1)}%`.padEnd(15) +
    `${successRateAfter.toFixed(1)}%`.padEnd(15) +
    formatImprovement(-reliabilityChange, true));
  
  console.log('\n═'.repeat(70));
  
  // Summary for resume
  console.log('\n📝 Resume-Worthy Summary:\n');
  
  if (p50Change > 0) {
    console.log(`"Reduced search API latency by ${p50Change.toFixed(0)}% (p50: ${beforeSummary.p50?.toFixed(0)}ms → ${afterSummary.p50?.toFixed(0)}ms) and ${p95Change.toFixed(0)}% at p95 (${beforeSummary.p95?.toFixed(0)}ms → ${afterSummary.p95?.toFixed(0)}ms)"`);
  }
  
  if (costChange > 0) {
    console.log(`\n"Optimized infrastructure costs by ${costChange.toFixed(0)}%, reducing per-query cost from $${(costPerReqBefore * 1000).toFixed(4)} to $${(costPerReqAfter * 1000).toFixed(4)} per 1,000 queries"`);
  }
  
  console.log('\n');
}

/**
 * Main
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node compare.mjs <before.csv> <after.csv>');
    console.log('\nExample:');
    console.log('  node compare.mjs results-before.csv results-after.csv');
    console.log('  node compare.mjs results-2025-10-01.csv results-2025-10-15.csv');
    process.exit(1);
  }
  
  const [beforeFile, afterFile] = args;
  
  try {
    compare(beforeFile, afterFile);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();


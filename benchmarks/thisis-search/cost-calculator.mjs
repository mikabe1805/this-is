#!/usr/bin/env node

/**
 * Cost calculator for estimating production costs
 * Projects benchmark results to real-world usage
 */

import { readFileSync, existsSync } from 'fs';

// Cost constants (USD)
const COSTS = {
  firestoreRead: 0.06 / 100000,
  firestoreWrite: 0.18 / 100000,
  cloudFunction: 0.40 / 1000000
};

/**
 * Format currency
 */
function formatCurrency(amount) {
  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`;
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * Format large numbers
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

/**
 * Calculate costs for different scales
 */
function calculateCosts(reads, writes, invocations) {
  const readCost = reads * COSTS.firestoreRead;
  const writeCost = writes * COSTS.firestoreWrite;
  const functionCost = invocations * COSTS.cloudFunction;
  const total = readCost + writeCost + functionCost;
  
  return { readCost, writeCost, functionCost, total };
}

/**
 * Calculate cost per request from benchmark results
 */
function getCostPerRequest() {
  if (!existsSync('results-thisis.csv')) {
    return null;
  }
  
  try {
    const content = readFileSync('results-thisis.csv', 'utf-8');
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) return null;
    
    // Parse first data line to get cost_usd column
    const firstLine = lines[1];
    const match = firstLine.match(/^([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),"(.+)"$/);
    
    if (!match) return null;
    
    const costPerRequest = parseFloat(match[5]);
    
    // Count successful requests
    const dataLines = lines.slice(1);
    let successCount = 0;
    let totalCost = 0;
    
    for (const line of dataLines) {
      const m = line.match(/^([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),"(.+)"$/);
      if (m) {
        const status = m[3];
        const cost = parseFloat(m[5]);
        if (status !== 'ERROR' && status >= 200 && status < 400) {
          successCount++;
          totalCost += cost;
        }
      }
    }
    
    return successCount > 0 ? totalCost / successCount : costPerRequest;
  } catch (error) {
    return null;
  }
}

/**
 * Project costs to different scales
 */
function projectCosts(costPerRequest) {
  const scales = [
    { name: '1,000 requests', count: 1000 },
    { name: '10,000 requests', count: 10000 },
    { name: '100K requests/day', count: 100000 },
    { name: '1M requests/month', count: 1000000 },
    { name: '10M requests/month', count: 10000000 },
    { name: '100M requests/month', count: 100000000 },
  ];
  
  console.log('\n💰 Cost Projections\n');
  console.log('Scale'.padEnd(25) + 'Monthly Cost'.padEnd(20) + 'Annual Cost');
  console.log('─'.repeat(65));
  
  for (const scale of scales) {
    const monthlyCost = costPerRequest * scale.count;
    const annualCost = monthlyCost * 12;
    
    console.log(
      scale.name.padEnd(25) +
      formatCurrency(monthlyCost).padEnd(20) +
      formatCurrency(annualCost)
    );
  }
}

/**
 * Show cost breakdown for custom scale
 */
function showCustomScale(requestsPerMonth, readsPerRequest, writesPerRequest) {
  console.log('\n🔢 Custom Scale Analysis\n');
  console.log(`Assumptions:`);
  console.log(`  • ${formatNumber(requestsPerMonth)} requests per month`);
  console.log(`  • ${readsPerRequest} Firestore reads per request`);
  console.log(`  • ${writesPerRequest} Firestore writes per request\n`);
  
  const totalReads = requestsPerMonth * readsPerRequest;
  const totalWrites = requestsPerMonth * writesPerRequest;
  const totalInvocations = requestsPerMonth;
  
  const costs = calculateCosts(totalReads, totalWrites, totalInvocations);
  
  console.log('Monthly Breakdown:');
  console.log('─'.repeat(65));
  console.log(`Firestore reads    ${formatNumber(totalReads).padStart(12)} × $0.06/100K    ${formatCurrency(costs.readCost).padStart(12)}`);
  console.log(`Firestore writes   ${formatNumber(totalWrites).padStart(12)} × $0.18/100K    ${formatCurrency(costs.writeCost).padStart(12)}`);
  console.log(`Cloud Functions    ${formatNumber(totalInvocations).padStart(12)} × $0.40/1M     ${formatCurrency(costs.functionCost).padStart(12)}`);
  console.log('─'.repeat(65));
  console.log(`TOTAL MONTHLY                                  ${formatCurrency(costs.total).padStart(12)}`);
  console.log(`TOTAL ANNUAL                                   ${formatCurrency(costs.total * 12).padStart(12)}\n`);
  
  const costPer1K = (costs.total / requestsPerMonth) * 1000;
  console.log(`Cost per 1,000 requests: ${formatCurrency(costPer1K)}`);
  console.log(`Cost per request:        ${formatCurrency(costs.total / requestsPerMonth)}\n`);
}

/**
 * Show optimization suggestions
 */
function showOptimizations(readsPerRequest, writesPerRequest) {
  console.log('💡 Optimization Opportunities\n');
  
  if (readsPerRequest >= 5) {
    const optimizedReads = Math.ceil(readsPerRequest * 0.6);
    console.log(`• Reduce Firestore reads from ${readsPerRequest} to ${optimizedReads} with:`);
    console.log('  - Query denormalization');
    console.log('  - Client-side caching');
    console.log('  - Composite indexes');
    const savings = ((readsPerRequest - optimizedReads) / readsPerRequest * 100).toFixed(0);
    console.log(`  → Potential ${savings}% cost reduction on read operations\n`);
  }
  
  if (writesPerRequest > 0) {
    console.log(`• Optimize writes (${writesPerRequest} per request):`);
    console.log('  - Batch write operations');
    console.log('  - Use background jobs for analytics');
    console.log('  - Cache aggregations');
    console.log('  → Write operations cost 3x more than reads\n');
  }
  
  console.log('• General optimizations:');
  console.log('  - Implement Redis/Memcached for hot data');
  console.log('  - Use CDN for static responses');
  console.log('  - Add query result caching (5-15 min TTL)');
  console.log('  - Implement request deduplication\n');
}

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    requests: 1000000,
    reads: 3,
    writes: 0,
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--requests' && args[i + 1]) {
      params.requests = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--reads' && args[i + 1]) {
      params.reads = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--writes' && args[i + 1]) {
      params.writes = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  return params;
}

/**
 * Main
 */
function main() {
  console.log('💵 Search API Cost Calculator\n');
  console.log('═'.repeat(65));
  
  const params = parseArgs();
  
  // Check if we have benchmark results
  const costPerRequest = getCostPerRequest();
  
  if (costPerRequest) {
    console.log('\n📊 Based on your benchmark results:\n');
    console.log(`Cost per request: ${formatCurrency(costPerRequest)}`);
    projectCosts(costPerRequest);
  }
  
  // Show custom scale
  showCustomScale(params.requests, params.reads, params.writes);
  
  // Show optimizations
  showOptimizations(params.reads, params.writes);
  
  console.log('═'.repeat(65));
  console.log('\n📚 Usage Examples:\n');
  console.log('Calculate for 5M requests/month with 5 reads and 1 write:');
  console.log('  node cost-calculator.mjs --requests 5000000 --reads 5 --writes 1\n');
  console.log('Calculate for 100K requests/month (default: 3 reads, 0 writes):');
  console.log('  node cost-calculator.mjs --requests 100000\n');
}

main();


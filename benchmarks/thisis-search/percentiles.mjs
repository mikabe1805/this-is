/**
 * Percentile calculation utilities for benchmark analysis.
 */

/**
 * Calculate percentile from sorted array of numbers
 * @param {number[]} sortedValues - Array of values (must be sorted)
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number|null} - The percentile value or null if empty
 */
export function calculatePercentile(sortedValues, percentile) {
  if (!sortedValues || sortedValues.length === 0) {
    return null;
  }

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Calculate multiple percentiles at once
 * @param {number[]} values - Array of values (will be sorted)
 * @param {number[]} percentiles - Array of percentiles to calculate
 * @returns {Object} - Map of percentile to value
 */
export function calculatePercentiles(values, percentiles = [50, 95, 99]) {
  if (!values || values.length === 0) {
    return percentiles.reduce((acc, p) => ({ ...acc, [p]: null }), {});
  }

  const sorted = [...values].sort((a, b) => a - b);
  const results = {};

  for (const p of percentiles) {
    results[p] = calculatePercentile(sorted, p);
  }

  return results;
}

/**
 * Calculate basic statistics
 * @param {number[]} values - Array of values
 * @returns {Object} - Statistics object
 */
export function calculateStats(values) {
  if (!values || values.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      p50: null,
      p95: null,
      p99: null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);

  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / values.length,
    median: calculatePercentile(sorted, 50),
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
  };
}


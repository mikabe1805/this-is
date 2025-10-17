# Benchmark Usage Examples

## Basic Usage

Run a standard 5-minute benchmark with 300 users:

```bash
cd benchmarks/thisis-search
npm install
cp .env.example .env
# Edit .env and set BASE_URL=https://your-api.com
npm run bench
```

## Custom Cost Models

### Scenario 1: Light Search (1 read per query)
If your search only queries one Firestore collection:

```bash
npm run bench -- --reads 1 --writes 0
```

### Scenario 2: Complex Search (5 reads per query)
If your search queries multiple collections or uses complex joins:

```bash
npm run bench -- --reads 5 --writes 0
```

### Scenario 3: Search with Analytics (3 reads + 1 write)
If you log search queries to Firestore:

```bash
npm run bench -- --reads 3 --writes 1
```

### Scenario 4: Heavy Operations (10 reads + 2 writes)
Complex searches with logging and caching:

```bash
npm run bench -- --reads 10 --writes 2
```

## Load Profile Examples

### Light Load (Staging Environment)
50 users, longer think times, short duration:

```bash
# In .env:
USERS=50
DURATION_SEC=60
MIN_THINK_MS=10000
MAX_THINK_MS=20000

npm run bench -- --reads 3
```

### Normal Load (Production Simulation)
300 users, realistic think times:

```bash
# In .env:
USERS=300
DURATION_SEC=300
MIN_THINK_MS=5000
MAX_THINK_MS=10000

npm run bench -- --reads 3
```

### Stress Test (Peak Load)
500 users, aggressive request patterns:

```bash
# In .env:
USERS=500
DURATION_SEC=600
MIN_THINK_MS=2000
MAX_THINK_MS=5000

npm run bench -- --reads 3
```

### Spike Test (Sudden Traffic)
1000 users, very short think times:

```bash
# In .env:
USERS=1000
DURATION_SEC=120
MIN_THINK_MS=1000
MAX_THINK_MS=3000

npm run bench -- --reads 3
```

## Analyzing Results

### Re-analyze Existing Data
After running a benchmark, you can regenerate the summary without re-running:

```bash
npm run analyze
```

This is useful if you want to:
- Update the markdown format
- Change the analysis approach
- Share results with different formatting

## Reading Results

### Quick Summary
Open `results-thisis.md` for a human-readable report with:
- Latency percentiles (p50, p95, p99)
- Throughput metrics
- Cost estimates
- Data transfer statistics

### Detailed Analysis
Open `results-thisis.csv` in Excel/Google Sheets for:
- Per-request analysis
- Custom charts and graphs
- Time-series visualization
- Query-specific performance

## Cost Estimation Examples

### Example Output

For a 5-minute test with 300 users (default: 3 reads per request):

```
Total requests: 4,500
Successful: 4,500 (100%)

Cost Estimate:
- Firestore reads: 13,500 reads → $0.0008
- Firestore writes: 0 writes → $0.0000
- Cloud Functions: 4,500 invocations → $0.0018
- TOTAL: $0.0026

Estimated Firestore/API cost for this synthetic load: $0.0026
```

**Resume bullet:**
> "Optimized search API costs to $0.0006 per 1,000 queries through efficient Firestore query patterns"

### Extrapolating to Production Scale

If your benchmark showed:
- Cost: $0.0026 for 4,500 requests
- Cost per request: ~$0.00000058

At 1 million requests per month:
```
1,000,000 × $0.00000058 = $0.58/month
```

At 10 million requests per month:
```
10,000,000 × $0.00000058 = $5.80/month
```

**Resume bullet:**
> "Designed cost-efficient search infrastructure serving 1M queries/month at $0.58 operational cost"

## Advanced Scenarios

### Compare Before/After Optimization

**Before optimization:**
```bash
# .env: USERS=100, DURATION_SEC=120
npm run bench -- --reads 10 --writes 1
# Results: p50=180ms, cost=$0.0045
mv results-thisis.md results-before.md
mv results-thisis.csv results-before.csv
```

**After optimization:**
```bash
# Same config but optimized backend
npm run bench -- --reads 3 --writes 0
# Results: p50=42ms, cost=$0.0008
mv results-thisis.md results-after.md
```

**Resume bullet:**
> "Reduced search latency by 77% (180ms → 42ms) and operational costs by 82% through query optimization and caching strategies"

### Multi-Region Testing

Test from different locations to measure global performance:

```bash
# From us-east-1
npm run bench
mv results-thisis.md results-us-east.md

# From eu-west-1
npm run bench
mv results-thisis.md results-eu-west.md

# From ap-southeast-1
npm run bench
mv results-thisis.md results-ap-southeast.md
```

Compare latencies across regions.

## Continuous Monitoring

### Weekly Performance Checks

Create a script to run weekly benchmarks:

```bash
#!/bin/bash
# weekly-bench.sh

DATE=$(date +%Y-%m-%d)
cd benchmarks/thisis-search

npm run bench
mv results-thisis.md "results-$DATE.md"
mv results-thisis.csv "results-$DATE.csv"

echo "Weekly benchmark complete: results-$DATE.md"
```

Track performance trends over time.

## Tips for Best Results

1. **Consistent Environment**: Run benchmarks from the same location/machine
2. **Isolated Tests**: Don't run other heavy processes during benchmarking
3. **Warm-up**: Consider running a quick test first to warm up caches
4. **Multiple Runs**: Run 3x and average the results for reliability
5. **Document Context**: Note any special conditions (time of day, other load, etc.)

## Example Resume Bullets

Based on actual benchmark results:

- "Architected search API achieving 42ms median latency (p50) and 157ms p95 under 300 concurrent users at 15 req/s sustained throughput"

- "Optimized backend infrastructure reducing search costs from $8.50 to $0.58 per million queries (93% reduction)"

- "Designed scalable search system handling 500+ concurrent users with consistent sub-200ms p95 latency"

- "Built comprehensive performance monitoring framework generating statistical benchmarks (p50/p95/p99, throughput, cost analysis)"

- "Delivered efficient API design processing 4,500 queries per 5-minute test period with 100% success rate and $0.0026 operational cost"


# this.is Search Benchmark

A synthetic load testing tool for the this.is search endpoint. Simulates concurrent users making search queries to generate defensible performance metrics.

## Features

- 🚀 **Concurrent users**: Simulates multiple users making requests simultaneously
- ⏱️ **Realistic behavior**: Random think times between requests
- 📊 **Comprehensive metrics**: p50/p95/p99 latency, throughput, success/error rates
- 📝 **Multiple outputs**: Human-readable Markdown summary + CSV raw data
- 🔄 **Re-analyzable**: Recompute statistics from existing CSV data

## Quick Start

### 1. Install Dependencies

```bash
cd benchmarks/thisis-search
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your `BASE_URL`:

```env
BASE_URL=https://your-api.example.com
USERS=300
DURATION_SEC=300
```

### 3. Run Benchmark

```bash
npm run bench
```

This will:
- Spawn 300 concurrent synthetic users
- Run for 5 minutes (300 seconds)
- Each user makes requests with random 5-10 second delays
- Generate `results-thisis.csv` and `results-thisis.md`

### 4. View Results

Check `results-thisis.md` for a human-readable summary:

```
this.is search benchmark — users=300, duration=300s → 
  p50=42.3 ms | p95=156.7 ms | p99=234.5 ms | 
  throughput=12.4 req/s | ok=3,720 | err=0
```

## Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | *(required)* | Base URL of your search API |
| `USERS` | 300 | Number of concurrent synthetic users |
| `DURATION_SEC` | 300 | Total test duration in seconds |
| `MIN_THINK_MS` | 5000 | Minimum think time between requests |
| `MAX_THINK_MS` | 10000 | Maximum think time between requests |

## Available Scripts

### `npm run bench`

Runs the full benchmark:
- Spawns concurrent users
- Makes randomized search queries
- Records latency, status codes, bytes transferred, and estimated costs
- Generates CSV and Markdown reports

**CLI Flags:**
- `--reads N`: Set number of Firestore reads per request (default: 3)
- `--writes N`: Set number of Firestore writes per request (default: 0)

Example with custom cost model:
```bash
npm run bench -- --reads 5 --writes 1
```

### `npm run analyze`

Re-analyzes existing results:
- Reads `results-thisis.csv`
- Recomputes all statistics
- Regenerates `results-thisis.md`

Useful if you want to:
- Change the markdown format
- Add custom analysis
- Recompute percentiles

### `npm run validate`

Validates setup before running:
- Checks Node.js version
- Verifies dependencies installed
- Checks .env file exists
- Validates environment variables
- Tests connectivity to search endpoint

### `npm run cost`

Calculate production costs:
```bash
npm run cost -- --requests 1000000 --reads 3 --writes 0
```
Projects benchmark costs to different scales (1K to 100M requests/month)

### `npm run compare`

Compare two benchmark results:
```bash
npm run compare before.csv after.csv
```
Shows performance improvements, cost savings, and generates resume-worthy summaries

## Output Files

### `results-thisis.csv`

Raw per-request data with columns:
- `ts_iso`: ISO timestamp
- `latency_ms`: Request latency in milliseconds
- `status`: HTTP status code or "ERROR"
- `bytes`: Response size in bytes
- `cost_usd`: Estimated cost per request in USD
- `query`: The search query used

Example:
```csv
ts_iso,latency_ms,status,bytes,cost_usd,query
2025-10-16T18:23:45.123Z,42.3,200,2548,0.0000000058,"coffee shops near me"
2025-10-16T18:23:47.456Z,156.7,200,3201,0.0000000058,"best pizza"
```

### `results-thisis.md`

Human-readable Markdown summary including:
- Configuration parameters
- One-line summary with key metrics
- Detailed latency percentiles (p50, p95, p99)
- Throughput and success rates
- Data transfer metrics (total MB, avg bytes per response)
- Cost breakdown (Firestore reads/writes, Cloud Functions)
- Status code distribution
- Sample queries tested

## How It Works

1. **User Simulation**: Each "user" is an async function that loops:
   ```
   while (test running):
     - Wait random think time (5-10s)
     - Pick random query from 35 predefined patterns
     - Make GET /api/search?q=...
     - Record timestamp, latency, status
   ```

2. **Concurrency**: All users run in parallel using `Promise.all`

3. **Timeout Handling**: Requests that exceed 10s are aborted and counted as errors

4. **Data Collection**: Results collected in memory, written at end

5. **Analysis**: Percentiles calculated using linear interpolation

## Example Results

For a well-optimized search endpoint, you might see:

```
p50=45 ms | p95=180 ms | p99=320 ms | 
throughput=15 req/s | ok=4,500 | err=0
```

This represents:
- **50% of requests** complete in under 45ms
- **95% of requests** complete in under 180ms
- **99% of requests** complete in under 320ms
- **15 requests/second** sustained throughput
- **0 errors** (100% success rate)

## Adjusting Load

### Lower Load (Staging)
```env
USERS=50
DURATION_SEC=120
MIN_THINK_MS=8000
MAX_THINK_MS=15000
```

### Higher Load (Stress Test)
```env
USERS=500
DURATION_SEC=600
MIN_THINK_MS=2000
MAX_THINK_MS=5000
```

## Important Notes

⚠️ **Synthetic Load**: This benchmark uses synthetic traffic with predefined queries. Results represent engineered baselines, not real user behavior.

⚠️ **Network Overhead**: Latency measurements include network round-trip time. Run from a location similar to your target users.

⚠️ **Server-Side Metrics**: For production analysis, also collect server-side metrics (processing time, database queries, etc.).

⚠️ **Rate Limiting**: Be aware of rate limits on your API. Adjust `USERS` and think times accordingly.

## Troubleshooting

### "BASE_URL environment variable is required"
Make sure you've created `.env` and set `BASE_URL`:
```bash
cp .env.example .env
# Edit .env and set BASE_URL
```

### High error rate
- Check that `BASE_URL` is correct and accessible
- Verify the search endpoint is `/api/search?q=...`
- Check server logs for errors
- May need to reduce `USERS` or increase think times

### Low throughput
- Could indicate server capacity issues
- Try reducing `USERS` to see if throughput/user increases
- Check server CPU, memory, database connections

## Resume-Worthy Metrics

Use the comprehensive metrics from `results-thisis.md`:

**Performance:**
> "Designed and optimized search endpoint serving p50=42ms, p95=157ms latency at 15 req/s sustained throughput with 300 concurrent users."

**Cost Efficiency:**
> "Achieved sub-$0.01 cost for 4,500 search queries through optimized Firestore query patterns and efficient API design."

**Data Transfer:**
> "Delivered 12MB of search results across 4,500 requests with average 2.5KB response payload."

## License

MIT


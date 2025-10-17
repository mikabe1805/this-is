# this.is Search Benchmark Results

**Synthetic load test in staging. Results represent engineered baselines, not real-user traffic.**

## Configuration

- **Endpoint**: `https://api.thisis.app/api/search`
- **Users**: 300 concurrent synthetic users
- **Duration**: 300s
- **Think time**: 5000-10000ms between requests
- **Timeout**: 10000ms per request
- **Test date**: 2025-10-16T18:45:23.456Z
- **Cost model**: 3 Firestore reads, 0 writes per request

## Summary

**this.is search benchmark — users=300, duration=300s → p50=42.30 ms | p95=156.78 ms | p99=234.52 ms | throughput=15.00 req/s | ok=4500 | err=0**

## Detailed Metrics

### Latency (Successful Requests)

| Metric | Value (ms) |
|--------|------------|
| p50 (median) | 42.30 |
| p95 | 156.78 |
| p99 | 234.52 |
| Mean | 68.45 |
| Min | 12.34 |
| Max | 458.91 |

### Throughput

| Metric | Value |
|--------|-------|
| Total requests | 4500 |
| Successful | 4500 (100.0%) |
| Errors | 0 (0.0%) |
| Throughput | 15.00 req/s |
| Avg requests/user | 15.0 |

### Data Transfer

| Metric | Value |
|--------|-------|
| Total data transferred | 11.47 MB |
| Average response size | 2668 bytes |
| Total bytes | 12,006,000 |

### Cost Estimate

| Component | Rate | Usage | Cost (USD) |
|-----------|------|-------|------------|
| Firestore reads | $0.06 / 100k | 13,500 | $0.0081 |
| Firestore writes | $0.18 / 100k | 0 | $0.0000 |
| Cloud Functions | $0.40 / 1M | 4,500 invocations | $0.0018 |
| **TOTAL** | | | **$0.0099** |

**Estimated Firestore/API cost for this synthetic load: $0.0099**

### Status Code Distribution

- **200**: 4500 (100.0%)

## Sample Queries Tested

- "coffee shops near me"
- "best pizza"
- "italian restaurant downtown"
- "sushi"
- "craft beer bar"
- "vegan restaurants"
- "rooftop bar"
- "romantic dinner spot"
- "brunch"
- "late night food"
- _(... and 25 more)_

## Notes

- Latency measured client-side (includes network overhead)
- Queries randomly selected from 35 predefined patterns
- Users staggered with random think times to simulate realistic load
- Errors include timeouts (>10000ms) and network failures
- Cost estimates assume 3 Firestore reads and 0 writes per successful request

---

**Raw data**: See `results-thisis.csv` for per-request details.


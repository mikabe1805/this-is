# this.is Search Benchmark Results

**Synthetic load test in staging. Results represent engineered baselines, not real-user traffic.**

## Configuration

- **Endpoint**: `http://localhost:5173/api/search`
- **Users**: 300 concurrent synthetic users
- **Duration**: 300s
- **Think time**: 5000-10000ms between requests
- **Timeout**: 10000ms per request
- **Test date**: 2025-10-17T02:04:03.267Z
- **Cost model**: 3 Firestore reads, 0 writes per request

## Summary

**this.is search benchmark — users=300, duration=300s → p50=3.10 ms | p95=4.92 ms | p99=8.10 ms | throughput=39.58 req/s | ok=11873 | err=0**

## Detailed Metrics

### Latency (Successful Requests)

| Metric | Value (ms) |
|--------|------------|
| p50 (median) | 3.10 |
| p95 | 4.92 |
| p99 | 8.10 |
| Mean | 3.39 |
| Min | 1.86 |
| Max | 50.52 |

### Throughput

| Metric | Value |
|--------|-------|
| Total requests | 11873 |
| Successful | 11873 (100.0%) |
| Errors | 0 (0.0%) |
| Throughput | 39.58 req/s |
| Avg requests/user | 39.6 |

### Data Transfer

| Metric | Value |
|--------|-------|
| Total data transferred | 16.61 MB |
| Average response size | 1467 bytes |
| Total bytes | 17,417,691 |

### Cost Estimate

| Component | Rate | Usage | Cost (USD) |
|-----------|------|-------|------------|
| Firestore reads | $0.06 / 100k | 35,619 | $0.0214 |
| Firestore writes | $0.18 / 100k | 0 | $0.0000 |
| Cloud Functions | $0.40 / 1M | 11,873 invocations | $0.0047 |
| **TOTAL** | | | **$0.0261** |

**Estimated Firestore/API cost for this synthetic load: $0.0261**

### Status Code Distribution

- **200**: 11873 (100.0%)

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

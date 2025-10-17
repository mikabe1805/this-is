# React + TypeScript + Vite

# this.is (Prototype)

A social discovery platform prototype built with modern web technologies.

## Tech Highlights
- **Frontend:** React (with Vite bundler), TypeScript, TailwindCSS
- **Backend/Cloud:** Firebase (Authentication, Firestore, Functions, Hosting)
- **Infrastructure:** Emulators for local dev, Firestore security rules, automated seed scripts
- **APIs:** Integrated external APIs (e.g., OpenAI) for enriched functionality
- **Tooling:** ESLint, PostCSS, modular TypeScript configs

## Repo Notes
- Modular architecture with `components/`, `contexts/`, `hooks/`, `services/`
- Cloud Functions setup (`functions/`) for backend extensions
- Database setup and seed utilities for rapid prototyping
- Deployment-ready with Firebase Hosting and Emulator Suite

*(Feature details redacted pending disclosure)*

### Performance Benchmarks (Synthetic Load Test)

**this.is Search Benchmark — 2025-10-17**

| Metric | Result | Notes |
|--------|--------|-------|
| **Users** | 300 synthetic users | random query mix |
| **Duration** | 300 s | steady-state |
| **p50 latency** | **3.1 ms** | median response |
| **p95 latency** | **4.9 ms** | 95 % < 5 ms |
| **p99 latency** | **8.1 ms** | negligible tail |
| **Throughput** | **39.6 req/s** | 11 873 requests total |
| **Success rate** | **100 %** | no timeouts |
| **Cost** | **$0.026 per 5 min load** | ≈ $2.20 per 1 M queries |

**Result:** Search API sustains millisecond-level response times and near-zero variance across 300 simulated users, with operational cost ≈ $2.20 per million queries.

![Latency Chart](assets/thisis-latency-distribution.png)
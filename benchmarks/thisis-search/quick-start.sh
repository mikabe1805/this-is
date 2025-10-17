#!/bin/bash

# Quick Start Script for Search Benchmark
# Sets up and runs the benchmark with guided prompts

set -e

echo "🚀 this.is Search Benchmark - Quick Start"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Setting up configuration..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "⚠️  Please edit .env and set your BASE_URL"
    echo ""
    read -p "Enter your search API base URL (e.g., https://api.example.com): " base_url
    
    if [ -n "$base_url" ]; then
        # Update BASE_URL in .env
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|BASE_URL=.*|BASE_URL=$base_url|" .env
        else
            sed -i "s|BASE_URL=.*|BASE_URL=$base_url|" .env
        fi
        echo "✓ Updated BASE_URL in .env"
    else
        echo "❌ BASE_URL is required. Please edit .env manually."
        exit 1
    fi
else
    echo "✓ .env file found"
fi

echo ""

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✓ Dependencies installed"
else
    echo "✓ Dependencies already installed"
fi

echo ""

# Ask for custom parameters
echo "⚙️  Benchmark Configuration"
echo ""
read -p "Number of concurrent users (default: 300): " users
users=${users:-300}

read -p "Test duration in seconds (default: 300): " duration
duration=${duration:-300}

read -p "Firestore reads per request (default: 3): " reads
reads=${reads:-3}

read -p "Firestore writes per request (default: 0): " writes
writes=${writes:-0}

echo ""
echo "📊 Running benchmark with:"
echo "  • Users: $users"
echo "  • Duration: ${duration}s"
echo "  • Reads per request: $reads"
echo "  • Writes per request: $writes"
echo ""

# Update .env with custom values
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/USERS=.*/USERS=$users/" .env
    sed -i '' "s/DURATION_SEC=.*/DURATION_SEC=$duration/" .env
else
    sed -i "s/USERS=.*/USERS=$users/" .env
    sed -i "s/DURATION_SEC=.*/DURATION_SEC=$duration/" .env
fi

read -p "Ready to start? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "🏃 Starting benchmark..."
echo ""

# Run benchmark
npm run bench -- --reads $reads --writes $writes

echo ""
echo "✅ Benchmark complete!"
echo ""
echo "📄 Results saved to:"
echo "  • results-thisis.md (summary)"
echo "  • results-thisis.csv (raw data)"
echo ""
echo "💡 Next steps:"
echo "  • View results: cat results-thisis.md"
echo "  • Calculate costs: node cost-calculator.mjs"
echo "  • Compare runs: node compare.mjs before.csv after.csv"
echo ""


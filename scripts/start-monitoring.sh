#!/bin/bash

set -e

echo "🔍 Starting hasteCRM Monitoring Stack..."

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it first."
    exit 1
fi

# Create network if it doesn't exist
docker network create haste_network 2>/dev/null || true

# Start monitoring stack
echo "📊 Starting Prometheus, Grafana, and exporters..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
echo "✅ Checking service status..."
docker-compose -f docker-compose.monitoring.yml ps

echo ""
echo "🎉 Monitoring stack started successfully!"
echo ""
echo "📊 Access points:"
echo "   - Prometheus: http://localhost:9090"
echo "   - Grafana: http://localhost:3001 (admin/admin)"
echo "   - Node Exporter: http://localhost:9100/metrics"
echo "   - PostgreSQL Exporter: http://localhost:9187/metrics"
echo "   - Redis Exporter: http://localhost:9121/metrics"
echo "   - cAdvisor: http://localhost:8080"
echo ""
echo "📈 hasteCRM metrics endpoint: http://localhost:3333/metrics/prometheus"
echo ""
echo "💡 To stop the monitoring stack, run:"
echo "   docker-compose -f docker-compose.monitoring.yml down"
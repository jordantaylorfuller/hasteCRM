#!/bin/bash

echo "🚀 Starting hasteCRM Logging Stack..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating log directories..."
mkdir -p logs

# Start the main services first (if not already running)
if ! docker-compose ps | grep -q "crm-postgres.*Up"; then
    echo "🔧 Starting main services..."
    docker-compose up -d
fi

# Start the logging stack
echo "📊 Starting ELK stack..."
docker-compose -f docker-compose.logging.yml up -d

# Wait for Elasticsearch to be ready
echo "⏳ Waiting for Elasticsearch to be ready..."
until curl -s http://localhost:9200/_cluster/health | grep -q '"status":"green"\|"status":"yellow"'; do
    printf '.'
    sleep 5
done
echo " ✅"

# Wait for Kibana to be ready
echo "⏳ Waiting for Kibana to be ready..."
until curl -s http://localhost:5601/api/status | grep -q '"state":"green"'; do
    printf '.'
    sleep 5
done
echo " ✅"

echo ""
echo "✅ Logging stack is ready!"
echo ""
echo "📊 Access points:"
echo "  - Kibana: http://localhost:5601"
echo "  - Elasticsearch: http://localhost:9200"
echo "  - Logstash: http://localhost:9600"
echo ""
echo "📝 Next steps:"
echo "  1. Open Kibana at http://localhost:5601"
echo "  2. Go to Stack Management → Index Patterns"
echo "  3. Create pattern: hastecrm-*"
echo "  4. Start exploring your logs!"
echo ""
echo "💡 To view logs:"
echo "  docker-compose -f docker-compose.logging.yml logs -f"
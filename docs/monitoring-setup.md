# Monitoring Stack Setup

## Overview

The hasteCRM monitoring stack provides comprehensive observability for the application using:

- **Prometheus**: Time-series database for metrics collection
- **Grafana**: Visualization and dashboarding
- **Node Exporter**: System metrics
- **PostgreSQL Exporter**: Database metrics
- **Redis Exporter**: Cache metrics
- **cAdvisor**: Container metrics

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   hasteCRM  │────▶│  Prometheus  │────▶│   Grafana   │
│     API     │     │              │     │             │
└─────────────┘     └──────────────┘     └─────────────┘
                            ▲
                            │
      ┌─────────────────────┼─────────────────────┐
      │                     │                     │
┌─────▼──────┐      ┌───────▼─────┐      ┌───────▼─────┐
│    Node    │      │  PostgreSQL │      │    Redis    │
│  Exporter  │      │   Exporter  │      │  Exporter   │
└────────────┘      └─────────────┘      └─────────────┘
```

## Quick Start

1. **Start the monitoring stack**:

   ```bash
   ./scripts/start-monitoring.sh
   ```

2. **Access the services**:

   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001 (default: admin/admin)
   - cAdvisor: http://localhost:8080

3. **View the dashboard**:
   - Login to Grafana
   - Navigate to Dashboards
   - Open "hasteCRM Overview"

## Metrics Collected

### Application Metrics

- **Uptime**: Application uptime in seconds
- **Memory Usage**: Heap, RSS, and external memory
- **CPU Usage**: User and system CPU time
- **HTTP Metrics**: Request count, error count, response time
- **Database Connections**: Active PostgreSQL connections
- **Redis Clients**: Connected Redis clients

### System Metrics (via Node Exporter)

- CPU usage by core
- Memory usage and availability
- Disk I/O statistics
- Network traffic
- System load averages

### Container Metrics (via cAdvisor)

- Container CPU usage
- Container memory usage
- Container network I/O
- Container disk I/O

## Custom Metrics

The hasteCRM API exposes custom metrics at `/metrics/prometheus`:

```prometheus
# Application uptime
app_uptime_seconds

# Memory metrics
app_memory_heap_used_bytes
app_memory_heap_total_bytes
app_memory_rss_bytes

# CPU metrics
app_cpu_user_seconds
app_cpu_system_seconds

# HTTP metrics
app_http_requests_total
app_http_errors_total
app_http_response_time_milliseconds

# Database metrics
app_database_connections

# Redis metrics
app_redis_connected_clients
```

## Adding Custom Metrics

To add new metrics to the API:

1. Update `MetricsController` in `apps/api/src/modules/health/metrics.controller.ts`
2. Add the metric calculation in `getMetrics()`
3. Export it in Prometheus format in `getPrometheusMetrics()`

Example:

```typescript
// In getMetrics()
customMetric: {
  value: calculateCustomMetric(),
}

// In getPrometheusMetrics()
# HELP app_custom_metric Description of metric
# TYPE app_custom_metric gauge
app_custom_metric ${metrics.customMetric.value}
```

## Alerting

To set up alerts:

1. Create alert rules in `monitoring/prometheus/alerts.yml`
2. Configure Alertmanager in `docker-compose.monitoring.yml`
3. Update Prometheus configuration to load alert rules

Example alert rule:

```yaml
groups:
  - name: hastecrm
    rules:
      - alert: HighErrorRate
        expr: rate(app_http_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High error rate detected
          description: "Error rate is {{ $value }} errors per second"
```

## Grafana Dashboards

### Included Dashboards

- **hasteCRM Overview**: Main application dashboard
- Additional dashboards can be added to `monitoring/grafana/dashboards/`

### Creating Custom Dashboards

1. Create dashboard in Grafana UI
2. Export as JSON
3. Save to `monitoring/grafana/dashboards/`
4. Restart Grafana to auto-provision

## Maintenance

### Backup

- Prometheus data: `docker volume create prometheus_backup && docker run --rm -v prometheus_data:/from -v prometheus_backup:/to alpine cp -a /from/. /to`
- Grafana data: Similar process with `grafana_data` volume

### Cleanup Old Data

Prometheus retains data for 15 days by default. To change:

```yaml
# In docker-compose.monitoring.yml
command:
  - "--storage.tsdb.retention.time=30d"
```

### Performance Tuning

- Adjust scrape intervals in `prometheus.yml`
- Configure memory limits in Docker Compose
- Use recording rules for expensive queries

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose -f docker-compose.monitoring.yml logs [service_name]

# Verify network exists
docker network ls | grep haste_network
```

### No Metrics in Prometheus

1. Check target status: http://localhost:9090/targets
2. Verify service connectivity
3. Check application logs for metric endpoint errors

### Grafana Dashboard Empty

1. Verify Prometheus datasource is configured
2. Check query syntax in dashboard panels
3. Ensure metrics are being collected

## Security Considerations

1. **Change default passwords**:

   - Set `GRAFANA_ADMIN_PASSWORD` in `.env`
   - Configure authentication for exporters

2. **Network isolation**:

   - Use internal Docker network
   - Expose only necessary ports

3. **Access control**:
   - Configure Grafana user roles
   - Set up OAuth/LDAP integration
   - Implement reverse proxy with authentication

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node Exporter](https://github.com/prometheus/node_exporter)
- [PostgreSQL Exporter](https://github.com/prometheus-community/postgres_exporter)
- [Redis Exporter](https://github.com/oliver006/redis_exporter)

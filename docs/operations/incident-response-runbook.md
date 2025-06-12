# Incident Response Runbook

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Incident Commander | On-Call Lead | See PagerDuty | ic@haste.nyc |
| Engineering Lead | TBD | See PagerDuty | eng-lead@haste.nyc |
| Security Lead | TBD | See PagerDuty | security@haste.nyc |
| Communications | TBD | See PagerDuty | comms@haste.nyc |

## Incident Severity Levels

| Level | Impact | Response Time | Examples |
|-------|--------|---------------|----------|
| **P1** | Complete outage | 15 min | API down, data loss |
| **P2** | Major degradation | 30 min | Login failures, slow API |
| **P3** | Minor issue | 2 hours | Feature broken |
| **P4** | Low impact | Next day | UI bugs |

## Response Procedures

### 1. Initial Response (0-15 minutes)

**Incident Commander Actions:**
```bash
# 1. Acknowledge alert
./scripts/incident.sh acknowledge <incident-id>

# 2. Create incident channel
./scripts/incident.sh create-channel <incident-name>

# 3. Start incident timeline
./scripts/incident.sh start-timeline
```

**First Responder Checklist:**
- [ ] Join incident channel
- [ ] Assess severity
- [ ] Check monitoring dashboards
- [ ] Identify affected services
- [ ] Notify stakeholders

### 2. Diagnosis (15-30 minutes)

**System Health Checks:**
```bash
# API health
curl -f https://api.haste.nyc/health || echo "API DOWN"

# Database status
kubectl exec -it postgres-0 -- pg_isready

# Redis status
kubectl exec -it redis-0 -- redis-cli ping

# Queue depth
kubectl exec -it worker-0 -- npm run queue:status
```

**Log Analysis:**
```bash
# Recent errors
kubectl logs -l app=api --since=1h | grep ERROR

# Database slow queries
kubectl exec -it postgres-0 -- psql -c "SELECT * FROM pg_stat_statements WHERE mean_exec_time > 100 ORDER BY mean_exec_time DESC LIMIT 10;"

# Failed jobs
kubectl exec -it worker-0 -- npm run jobs:failed
```

### 3. Mitigation Strategies

#### API Down
```bash
# 1. Check pod status
kubectl get pods -l app=api

# 2. Restart if needed
kubectl rollout restart deployment/api

# 3. Scale up if load issue
kubectl scale deployment/api --replicas=10

# 4. Enable maintenance mode
kubectl set env deployment/api MAINTENANCE_MODE=true
```

#### Database Issues
```bash
# 1. Check connections
kubectl exec -it postgres-0 -- psql -c "SELECT count(*) FROM pg_stat_activity;"

# 2. Kill long queries
kubectl exec -it postgres-0 -- psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 minutes';"

# 3. Failover to replica
./scripts/db-failover.sh promote-replica
```

#### High Load
```bash
# 1. Enable rate limiting
kubectl set env deployment/api RATE_LIMIT_EMERGENCY=true

# 2. Scale services
kubectl scale deployment/api --replicas=20
kubectl scale deployment/worker --replicas=10

# 3. Increase cache TTL
kubectl set env deployment/api CACHE_TTL=3600
```

### 4. Communication Templates

#### Status Page Update
```
We are currently experiencing [ISSUE DESCRIPTION].

**Impact**: [AFFECTED SERVICES]
**Status**: Investigating
**Next Update**: In 30 minutes

Subscribe for updates: https://status.haste.nyc
```

#### Customer Communication
```
Subject: [SEVERITY] - Service Disruption

We are aware of an issue affecting [SERVICE]. Our team is actively working on a resolution.

Current Impact:
- [SPECIFIC IMPACT]

Workaround:
- [IF AVAILABLE]

We apologize for any inconvenience and will update you within [TIMEFRAME].
```

### 5. Recovery Procedures

#### Service Restoration
```bash
# 1. Verify fix
./scripts/smoke-test.sh production

# 2. Gradual rollout
kubectl set image deployment/api api=hastenyc/api:fixed --record
kubectl rollout status deployment/api

# 3. Monitor metrics
watch -n 5 'kubectl top pods -l app=api'
```

#### Data Recovery
```bash
# 1. Identify corruption time
SELECT max(updated_at) FROM audit_logs WHERE action = 'normal';

# 2. Restore from backup
./scripts/restore-db.sh --point-in-time "2024-01-15 14:30:00"

# 3. Verify integrity
./scripts/db-integrity-check.sh
```

### 6. Post-Incident

#### Timeline Documentation
```markdown
## Incident Timeline

- **14:00** - First alert received
- **14:05** - IC acknowledged, P1 declared
- **14:10** - Root cause identified: [CAUSE]
- **14:25** - Mitigation applied
- **14:40** - Service restored
- **15:00** - Incident closed
```

#### Action Items Template
```markdown
## Post-Mortem Action Items

1. **Prevent Recurrence**
   - [ ] [SPECIFIC FIX]
   - Owner: [NAME]
   - Due: [DATE]

2. **Improve Detection**
   - [ ] Add monitoring for [METRIC]
   - Owner: [NAME]
   - Due: [DATE]

3. **Update Runbooks**
   - [ ] Document [NEW PROCEDURE]
   - Owner: [NAME]
   - Due: [DATE]
```

## Common Issues Reference

### Issue: 503 Service Unavailable
**Symptoms**: API returns 503 errors
**Cause**: Pod crashes, OOM kills
**Fix**:
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous
kubectl set resources deployment/api --limits=memory=2Gi
```

### Issue: Database Connection Pool Exhausted
**Symptoms**: "too many connections" errors
**Cause**: Connection leak, high load
**Fix**:
```bash
# Increase pool size temporarily
kubectl set env deployment/api DATABASE_POOL_MAX=50

# Find leaking connections
SELECT pid, usename, application_name, state, query_start 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND query_start < now() - interval '10 minutes';
```

### Issue: Redis Memory Full
**Symptoms**: Redis OOM errors
**Cause**: Cache not expiring, memory leak
**Fix**:
```bash
# Check memory usage
kubectl exec -it redis-0 -- redis-cli info memory

# Flush if needed (CAUTION)
kubectl exec -it redis-0 -- redis-cli FLUSHDB

# Increase memory limit
kubectl set resources statefulset/redis --limits=memory=4Gi
```

### Issue: Email Queue Backed Up
**Symptoms**: Emails delayed, queue growing
**Cause**: Provider rate limit, worker crash
**Fix**:
```bash
# Check queue size
kubectl exec -it worker-0 -- npm run queue:stats

# Pause queue
kubectl exec -it worker-0 -- npm run queue:pause email

# Clear failed jobs
kubectl exec -it worker-0 -- npm run queue:clean email --status=failed
```

## Automation Scripts

All scripts are in `/scripts/incident/`:
- `incident.sh` - Main incident management
- `rollback.sh` - Quick rollback to last known good
- `scale-emergency.sh` - Emergency scaling
- `drain-traffic.sh` - Graceful traffic drain
- `capture-state.sh` - Capture system state for debugging

## Escalation

1. **15 min**: No progress → Escalate to Engineering Lead
2. **30 min**: P1 ongoing → Escalate to CTO
3. **60 min**: Data loss risk → Escalate to Security Lead
4. **2 hours**: Extended outage → Executive notification

## Remember

- **Stay Calm**: Follow the runbook
- **Communicate**: Over-communicate status
- **Document**: Record all actions
- **Learn**: Every incident improves our system
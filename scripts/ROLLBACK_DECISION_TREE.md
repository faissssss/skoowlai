# Rollback Decision Tree

Quick reference guide to help decide whether to rollback migration `20260209000000_add_feature_usage_dates`.

## Decision Flow

```
┌─────────────────────────────────────────┐
│ Issue detected after migration deploy   │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Is the application completely down?     │
│ (All users unable to access)            │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │ YES               │ NO
        ▼                   ▼
┌───────────────┐   ┌───────────────────────┐
│ ROLLBACK NOW  │   │ Check error rate      │
│ (Critical)    │   └───────┬───────────────┘
└───────────────┘           │
                            ▼
                  ┌─────────────────────────┐
                  │ Error rate > 10%?       │
                  └─────────┬───────────────┘
                            │
                  ┌─────────┴─────────┐
                  │ YES               │ NO
                  ▼                   ▼
        ┌─────────────────┐   ┌─────────────────────┐
        │ ROLLBACK        │   │ Check data integrity│
        │ (High Priority) │   └─────────┬───────────┘
        └─────────────────┘             │
                                        ▼
                              ┌─────────────────────┐
                              │ Data loss detected? │
                              └─────────┬───────────┘
                                        │
                              ┌─────────┴─────────┐
                              │ YES               │ NO
                              ▼                   ▼
                    ┌─────────────────┐   ┌─────────────────┐
                    │ ROLLBACK        │   │ MONITOR         │
                    │ (Critical)      │   │ (Continue)      │
                    └─────────────────┘   └─────────────────┘
```

## Quick Assessment Checklist

### ⚠️ IMMEDIATE ROLLBACK REQUIRED

Check if ANY of these conditions are true:

- [ ] Application fails to start or crashes immediately
- [ ] Database corruption detected
- [ ] Data loss or unexpected data modifications
- [ ] All users unable to access the application
- [ ] Error rate > 50%
- [ ] Database connection pool exhausted
- [ ] Critical security vulnerability introduced

**Action:** Execute rollback immediately without further investigation.

### 🔴 HIGH PRIORITY ROLLBACK

Check if ANY of these conditions are true:

- [ ] Error rate > 10% and increasing
- [ ] Multiple critical features completely broken
- [ ] Significant performance degradation (>5x slower)
- [ ] User-reported issues increasing rapidly (>50% increase)
- [ ] P2022 errors appearing in logs (schema mismatch)
- [ ] Database queries timing out frequently

**Action:** Execute rollback within 15 minutes. Brief investigation acceptable but prioritize rollback.

### 🟡 CONSIDER ROLLBACK

Check if ANY of these conditions are true:

- [ ] Error rate 5-10%
- [ ] Single critical feature broken
- [ ] Performance degradation 2-5x slower
- [ ] User-reported issues increasing moderately (10-50% increase)
- [ ] Non-critical data integrity issues
- [ ] Intermittent errors affecting subset of users

**Action:** Investigate for 30 minutes. If issue not resolved or worsening, execute rollback.

### 🟢 MONITOR (No Rollback Needed)

Check if ALL of these conditions are true:

- [ ] Error rate < 5%
- [ ] No critical features broken
- [ ] Performance within acceptable range (<2x slower)
- [ ] User-reported issues stable or decreasing
- [ ] No data integrity issues
- [ ] Isolated issues affecting <1% of users

**Action:** Continue monitoring. Document issues for investigation. No rollback needed.

## Specific Error Patterns

### P2022 Errors (Schema Mismatch)

**Error Message:**
```
PrismaClientKnownRequestError: The column User.lastFlashcardUsageDate does not exist in the current database. (code: P2022)
```

**Decision:**
- If affecting ALL requests → IMMEDIATE ROLLBACK
- If affecting >10% of requests → HIGH PRIORITY ROLLBACK
- If affecting <10% of requests → INVESTIGATE (may be caching issue)

### Database Connection Errors

**Error Message:**
```
Error: Can't reach database server
Error: Connection pool timeout
```

**Decision:**
- If persistent (>5 minutes) → HIGH PRIORITY ROLLBACK
- If intermittent → INVESTIGATE (may be network issue)

### Type Errors

**Error Message:**
```
TypeError: Cannot read property 'lastFlashcardUsageDate' of undefined
```

**Decision:**
- If widespread → HIGH PRIORITY ROLLBACK
- If isolated → INVESTIGATE (may be code issue, not migration)

### Performance Degradation

**Symptoms:**
- Slow query logs showing User table queries taking >1s
- Database CPU usage >80%
- Response times >5s

**Decision:**
- If affecting all queries → HIGH PRIORITY ROLLBACK
- If affecting specific queries → INVESTIGATE (may be indexing issue)

## Metrics to Monitor

### Application Metrics
- **Error Rate**: Target <1%, Alert >5%, Rollback >10%
- **Response Time**: Target <500ms, Alert >2s, Rollback >5s
- **Request Success Rate**: Target >99%, Alert <95%, Rollback <90%

### Database Metrics
- **Connection Pool Usage**: Target <70%, Alert >85%, Rollback >95%
- **Query Duration**: Target <100ms, Alert >500ms, Rollback >1s
- **Lock Wait Time**: Target <10ms, Alert >100ms, Rollback >500ms

### User Impact Metrics
- **Active Users**: Monitor for sudden drops (>20% = investigate, >50% = rollback)
- **Feature Usage**: Monitor for drops in file uploads, flashcard generation, etc.
- **Support Tickets**: Monitor for spikes (>50% increase = investigate, >100% = rollback)

## Time-Based Decision Matrix

| Time Since Deploy | Error Rate | Action |
|-------------------|------------|--------|
| 0-5 minutes | >50% | IMMEDIATE ROLLBACK |
| 0-5 minutes | 10-50% | HIGH PRIORITY ROLLBACK |
| 0-5 minutes | <10% | MONITOR |
| 5-30 minutes | >20% | HIGH PRIORITY ROLLBACK |
| 5-30 minutes | 10-20% | CONSIDER ROLLBACK |
| 5-30 minutes | <10% | MONITOR |
| 30+ minutes | >10% | CONSIDER ROLLBACK |
| 30+ minutes | <10% | MONITOR |

## Rollback Execution Time

Estimated time to complete rollback:

1. **Pre-rollback checks**: 5-10 minutes
   - Create database backup
   - Enable maintenance mode
   - Document issue

2. **Rollback execution**: 2-5 minutes
   - Run rollback script
   - Update migrations table
   - Verify columns removed

3. **Application deployment**: 5-15 minutes
   - Revert code
   - Regenerate Prisma client
   - Deploy application

4. **Post-rollback verification**: 5-10 minutes
   - Test endpoints
   - Verify functionality
   - Disable maintenance mode

**Total Time**: 15-40 minutes (depending on deployment platform)

## Communication Templates

### Internal Alert (Slack/Teams)

```
🚨 MIGRATION ROLLBACK IN PROGRESS

Migration: 20260209000000_add_feature_usage_dates
Reason: [Brief description of issue]
Impact: [Number of users affected / features impacted]
ETA: [Estimated completion time]
Status: [In Progress / Completed]

Action Items:
- [ ] Database backup created
- [ ] Rollback script executed
- [ ] Application reverted and deployed
- [ ] Functionality verified

Updates will be posted every 10 minutes.
```

### User-Facing Status Update

```
We're currently experiencing technical difficulties and are working to resolve them. 
The application may be temporarily unavailable while we perform maintenance.

Expected resolution: [Time]

We apologize for the inconvenience and appreciate your patience.
```

## Post-Rollback Checklist

After successful rollback:

- [ ] Verify all endpoints are functioning
- [ ] Confirm error rate returned to normal
- [ ] Check database metrics are stable
- [ ] Disable maintenance mode
- [ ] Update status page
- [ ] Notify stakeholders of resolution
- [ ] Document incident in post-mortem
- [ ] Schedule root cause investigation
- [ ] Plan for re-attempting migration

## Questions to Ask Before Rollback

1. **Do we have a recent database backup?**
   - If NO → Create backup before rollback
   - If YES → Proceed with rollback

2. **Is the issue definitely caused by the migration?**
   - If UNSURE → Check deployment logs, compare with pre-migration state
   - If YES → Proceed with rollback

3. **Can the issue be fixed forward (without rollback)?**
   - If YES and quick (<15 min) → Attempt fix
   - If NO or time-consuming → Proceed with rollback

4. **What is the user impact?**
   - If CRITICAL (all users) → Immediate rollback
   - If MODERATE (some users) → Consider rollback
   - If MINOR (few users) → Monitor and investigate

5. **Are we within the rollback window?**
   - If <1 hour since deploy → Rollback is safe
   - If >1 hour since deploy → Consider data implications

## Contact Information

**Escalation Path:**
1. On-call engineer (immediate response)
2. Database administrator (for database issues)
3. Engineering manager (for authorization)
4. CTO (for critical incidents)

**Emergency Contacts:**
- On-Call: [Phone/Slack]
- DBA: [Phone/Slack]
- Manager: [Phone/Slack]

---

**Remember:** When in doubt, prioritize user experience and data integrity. It's better to rollback and investigate than to leave users with a broken application.

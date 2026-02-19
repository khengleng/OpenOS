# OpenOS Employee Release Checklist

Use this as a hard go/no-go gate before enabling employee access.

## 1) Authentication and Authorization
- [ ] `401/403` behavior verified across all protected endpoints.
- [ ] OpenOS session refresh/expiry tested.
- [ ] Role and tenant boundaries verified.
- [ ] Email registration/confirmation/login flow validated end-to-end.

Owner: `@auth-owner`  
Evidence: test run links/screenshots

## 2) Database and Migrations
- [ ] Production schema is up-to-date (including `coworker_tasks` table).
- [ ] Migration pipeline blocks deploy if schema drift is detected.
- [ ] Rollback/backup procedure documented and tested.

Owner: `@db-owner`  
Command examples:
```bash
# Run in Supabase SQL editor
select to_regclass('public.coworker_tasks');
```

## 3) ClawWork Runtime Stability
- [ ] Single and multi-agent launches succeed repeatedly.
- [ ] Expected lifecycle statuses handled: `running`, `stopped`, `terminated`, `completed`.
- [ ] Retry behavior and limits validated.
- [ ] No stuck simulations after stop/terminate.

Owner: `@runtime-owner`  
Evidence: logs + launch activity screenshots

## 4) Security Baseline
- [ ] Secrets set only in Railway/Supabase secret stores.
- [ ] JWT/API tokens rotated and documented.
- [ ] Tenant isolation test passed.
- [ ] API rate limiting enabled on sensitive routes.
- [ ] Security audit log pipeline enabled.

Owner: `@security-owner`  
Evidence: checklist + sample audit entries

## 5) Observability and Alerting
- [ ] Centralized logs for OpenOS + ClawWork.
- [ ] Alerts configured for:
  - [ ] 5xx error spikes
  - [ ] auth failure spikes
  - [ ] simulation launch failures
  - [ ] readiness failures
- [ ] On-call escalation path defined.

Owner: `@ops-owner`

## 6) UX and Failure Handling
- [ ] No silent failures for:
  - [ ] `Hire New Agent`
  - [ ] `Run Task`
  - [ ] `Create Coworker Task`
  - [ ] Mesh `New Post`
- [ ] Error states are human-readable and actionable.
- [ ] Loading and retry states present on all async actions.

Owner: `@frontend-owner`

## 7) End-to-End Test Gate
- [ ] Core smoke tests pass against production URL.
- [ ] E2E scenarios pass:
  - [ ] register/login/confirm
  - [ ] create coworker task
  - [ ] run coworker task
  - [ ] launch/stop agent
  - [ ] open core pages (`/agents`, `/settings`, `/community`, `/wellness`)

Owner: `@qa-owner`  
Command examples:
```bash
OPENOS_URL=https://nexus-os-production.up.railway.app npm run smoke:railway
OPENOS_URL=https://nexus-os-production.up.railway.app CLAWWORK_URL=https://clawwork-backend-production.up.railway.app npm run release:preflight
curl -s https://nexus-os-production.up.railway.app/api/readiness
```

## 8) Product/Policy Readiness
- [ ] Internal AI usage policy approved.
- [ ] Employee-facing documentation available.
- [ ] Support runbook and FAQ published.
- [ ] Data retention and deletion policy confirmed.

Owner: `@product-owner`

## 9) Rollout Plan
- [ ] Phase 1 pilot (5%) complete.
- [ ] Phase 2 expansion (25%) complete.
- [ ] Full rollout approved.
- [ ] Rollback trigger conditions defined.

Owner: `@release-manager`

## Final Go/No-Go
- [ ] All sections above complete.
- [ ] Executive sign-off recorded.
- [ ] Release timestamp and version tagged.

Release decision: `GO / NO-GO`  
Version/tag: `__________`  
Date: `__________`  
Approver: `__________`

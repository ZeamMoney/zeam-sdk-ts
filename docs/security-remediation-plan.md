# SDK security remediation - multi-session TDD runbook

Status: PHASE 1 IN PROGRESS. Created 2026-11-05. S01 authorized for local
implementation and commit; later phases remain unstarted.

This document executes the [findings register](security-review-findings.md).
The register preserves what was found and why; this runbook defines order,
tests, completion checkboxes and handoff mechanics. Baseline:
`712a3b5df1624792ee6176cb0f88f905460efe7f`, `fix/security-vitest-v3`,
[PR #6](https://github.com/ZeamMoney/zeam-sdk-ts/pull/6).

## Red / Green / Refactor rule

**No production behavior change without a failing regression test first.**

For each behavior: write RED, run it, verify the failure is the intended defect
and not a syntax/import/fixture failure, implement minimal GREEN, rerun the
affected suite, then REFACTOR while green. A test that unexpectedly passes is
investigated before implementation. For config, workflow and packaging changes,
use executable policy, discovery, fixture or artifact assertions as the RED test.
Documentation-only edits require link, formatting and accuracy checks, not
fabricated behavior tests.

## How to use this document

- Start each new session by reading this runbook, its assigned register IDs,
  repository instructions and the latest progress/amendment entries.
- Work one session per sitting. Tick `[x]` only when the named evidence exists.
  A session is not DONE until its Definition of Done is met; use BLOCKED or
  PARTIAL otherwise. Never remove an unmet checkbox to make a session complete.
- Split oversized sessions by appending a dependency-linked session with a new
  stable ID. Record deferrals with date, accountable owner and reason.
- Before the first RED, check the working tree, revision, prerequisite changes,
  named existing files and actual runnable commands. Paths labelled NEW are
  proposed additions, not claims that those files exist.
- One branch per session, with the exact names below. Use the approved integration
  base described under Decisions; do not lose the current branch's security fixes.
  If prerequisites are unmerged, stop for integration instructions or explicitly
  approve a stack on the tested prerequisite tip. Never silently branch from a
  stale or unrelated main.
- No automatic commits, pushes, PR creation, merges, tags, publication, credential
  rotation or deployments. When separately authorized, use short attributed
  commits and record checkpoint SHAs. Otherwise save Red/Green evidence and leave
  changes uncommitted; do not manufacture historical test-first evidence.
- No live authentication, smoke scripts or money movement by default. Essential
  isolated regression fixtures are allowed; no fabricated production data.
- Proposed code should preserve backwards compatibility where safe. Stop for
  approval if public signatures, decimal wire shapes or recovery semantics change.
- No child agents are scheduled. Execute serially by default to avoid shared-file
  conflicts. Any future concurrency requires approved isolated worktrees, exclusive
  ownership of the shared runbook and an explicit integration point.
- Mark a register ID closed only after all assigned sessions and its acceptance
  criteria pass. Source completion, CI completion, human approval and release
  completion are separate states.

## Decisions and execution gates

- [x] G01: Danie confirmed as accountable owner on 2026-11-05. User approved local
      implementation/commit with independent review retained as an explicit pre-merge
      requirement. No independent review or approval is claimed.
- [x] G02: On 2026-11-05 the user approved a repository-specific exception: create
      `fix/remediation-s01-test-harness` from freshly fetched `origin/main`.
      Base `c8f9952` contains merged PR #6 and the reviewed security fixes; no
      dev/develop branch exists in the fetched remote refs. No push or merge authorized.
      Reconfirm the integration route for later sessions rather than extending this
      exception automatically.
- [ ] G03: Before S04/S08, approve the caller-operation-key API and unknown-outcome
      recovery contract. Proposed safe default: stop on ambiguity, preserve
      evidence, require reconciliation; never automatically refund or re-fund.
- [ ] G04: Before S07, confirm checked-in gateway amount semantics, maximums,
      quote expiry, accepted asset/network and memo requirements. Any public
      number-to-string migration needs explicit compatibility approval.
- [ ] G05: Before S11, confirm owned read-only contract endpoints and explicit
      target/credential authorization. Live financial tests are out of scope.
- [ ] G06: Before S15, approve the npm release source/tag policy and identify the
      human who can verify/configure protections. Do not substitute an AKS release
      process for the package's actual publication workflow.

## Session dependency map

Dependency edges (session IDs are identifiers, not independent authorization):

- S01 -> S02 -> S03 -> S04 -> S05 -> S06 -> S07 -> S08.
- S01 -> S09 -> S10 -> S11 -> S12.
- S08 -> S12.
- S01 -> S13 -> S14 -> S15.
- S12 -> S15; S15 plus every earlier session -> S16.

S09 and S13 are technically independent of auth/payment implementation after S01,
but the default is sequential sessions, not parallel agents. S16 requires all
S01-S15, including sessions not connected by a direct edge above.

## Common validation and handoff

Gate A applies to every implementation session:

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run build`
- `git diff --check`

Use installed tool binaries via npm scripts or `./node_modules/.bin`; do not
download an arbitrary tool to perform validation. Full coverage is recorded
from S01 and becomes an enforced Gate A addition at S12. The maintained test
typecheck becomes a Gate A addition at S10. Run targeted suites as well, not
instead of Gate A. Record exact commands, exit codes, counts, Node version and
candidate revision plus uncommitted diff identity. Do not claim a SHA alone
identifies an uncommitted candidate.

Every session's handoff must record actual changed files, RED failure, GREEN
result, refactor verification, decisions, risks, unchecked work and next session.
Append a dated entry to Progress Log, newest first, preserving earlier entries.

Standing baseline limitations:

- Six lint warnings existed; no new warnings are allowed. S10 owns removal of
  stale lint directives, after which require zero warnings.
- The 61 test-type errors remain explicitly open until S10. Existing failures
  are not a waiver for newly added tests to be ill-typed.
- Contract discovery remains broken until S11; no earlier session may claim
  live-contract assurance.
- Coverage floors are not imposed on the untouched baseline; S12 makes the
  final agreed floors blocking. Never lower them later just to turn CI green.
- Review evidence was on Node 25.5.0. Record the active version on every session;
  Node 22 verification is mandatory before final acceptance.

## Phase 1 - Restore trustworthy tests

Status: IN PROGRESS (2026-11-05).

### S01 - Harness and non-vacuous guards (TEST-01, TEST-02, TEST-04) - IN PROGRESS

Depends on: G01/G02. Branch: `fix/remediation-s01-test-harness`.
Files expected: `vitest.config.ts`, `src/client/connect/connect.test.ts`,
`src/transport/transport.test.ts`, `package.json`; NEW `test/unit/harness.test.ts`.

TDD tasks:

- [x] RED: prove runtime index implementations are omitted from coverage and
      prove a guard-removal mutation is not detected by the current SSRF tests.
- [x] Verify RED: distinguish a reached-fetch exception from a real guard failure.
- [ ] GREEN: include real implementations; assert specific errors and zero fetches,
      with valid-session allowed-path success tests.
- [ ] Verify GREEN: run `npm test` and `npm run test:coverage`; record full
      denominators and retain the unmodified historical baseline in the register.
- [ ] REFACTOR: keep reusable offline fixtures at boundaries; establish the
      Red/Green evidence format without claiming historic TDD compliance.

Definition of Done:

- [ ] Gate A passes at the stated baseline; targeted guard mutation is killed.
- [ ] G01/G02 decisions, actual file list, coverage metrics and handoff are logged.

Amendments: none yet.
Handoff: later sessions can rely on meaningful guard tests and complete measurement.

## Phase 2 - Authentication and transport safety

Status: NOT STARTED. No live financial exercises while these boundaries remain open.

### S02 - Principal binding and refresh isolation (SEC-01, SEC-08) - NOT STARTED

Depends on: S01. Branch: `fix/remediation-s02-refresh-identity`.
Files expected: `src/auth/sep10.ts`, `src/client.ts`, `src/auth/auth.test.ts`,
`docs/auth.md`; NEW `src/auth/sep10.test.ts`, `src/client.refresh.test.ts`.

TDD tasks:

- [ ] RED / verify RED: mismatched subjects reject before fetch and do not mutate;
      two same-track users refresh independently; the same session coalesces.
- [ ] GREEN: bind configured credentials to the session principal and scope pending
      work to session identity. Validate response shape before updating credentials.
- [ ] Verify GREEN: run `npm test -- src/auth src/client.refresh.test.ts`.
- [ ] REFACTOR: document the single-session-per-track store scope and explicit
      behavior for an empty/unknown subject; do not infer identities from unverified JWTs.

Definition of Done:

- [ ] Gate A and targeted tests pass; wrong-track and refresh-failure paths remain closed.
- [ ] Independent reviewer checks identity semantics; actual files and evidence logged.

Amendments: none yet.
Handoff: S03 uses the settled refresh identity and coalescing model.

### S03 - Invalidation fences (SEC-02) - NOT STARTED

Depends on: S02. Branch: `fix/remediation-s03-session-invalidation`.
Files expected: `src/auth/session.ts`, `src/auth/store.ts`, `src/auth/otp.ts`,
`src/auth/sep10.ts`, `src/auth/autorefresh.ts`, `src/client/call.ts`,
`src/auth/auth.test.ts`, `src/client.refresh.test.ts`, `docs/auth.md`.

TDD tasks:

- [ ] RED / verify RED: deferred OTP/Connect refresh after erase, delete, close or
      replacement cannot restore credentials, overwrite a new session, or retry a call.
- [ ] GREEN: fence response commits and AutoRefresher store writeback against local
      invalidation; recheck session validity before a post-refresh retry.
- [ ] Verify GREEN: run `npm test -- src/auth src/client.refresh.test.ts`, including
      failed refresh, repeated invalidation and successful ordinary refresh.
- [ ] REFACTOR: use one clear invalidation invariant; preserve token redaction and
      distinguish local logout guarantees from server-side revocation.

Definition of Done:

- [ ] Gate A passes; deterministic deferred-promise tests cover the race orderings.
- [ ] Reviewer checks late-response/writeback paths; actual files and handoff logged.

Amendments: none yet.
Handoff: S04 can rely on safe refresh completion and retry eligibility.

### S04 - Stable operation idempotency (SEC-05) - NOT STARTED

Depends on: S03 and G03. Branch: `fix/remediation-s04-idempotency`.
Files expected: `src/client/call.ts`, `src/transport/fetcher.ts`,
`src/transport/retry.ts`, typed mutation wrappers, `docs/recipes.md`;
NEW `src/client/call.test.ts`.

TDD tasks:

- [ ] RED / verify RED: mutation key/body remain identical across a 401, simulated
      response loss and permitted network retry; distinct operations use distinct keys.
- [ ] GREEN: create the key once per logical call and propagate an approved optional
      caller key through typed writes without breaking existing AbortSignal arguments.
- [ ] Verify GREEN: run `npm test -- src/client src/transport`; assert response-status
      retry policy and cancellation still hold and caller keys are not overwritten.
- [ ] REFACTOR: document retry budgets and unknown-outcome limitations; a local key
      is not proof of gateway deduplication or permission for financial replay.

Definition of Done:

- [ ] Gate A passes; supported typed mutation surfaces have key-propagation tests.
- [ ] API compatibility and gateway assumptions reviewed; actual files/handoff logged.

Amendments: none yet.
Handoff: S08 reuses this key contract for payment recovery.

### S05 - Gateway origin confinement (SEC-06) - NOT STARTED

Depends on: S04. Branch: `fix/remediation-s05-origin`.
Files expected: `src/client.ts`, `src/client/call.ts`, `src/transport/fetcher.ts`,
`src/client.test.ts`, `src/transport/transport.test.ts`.

TDD tasks:

- [ ] RED / verify RED: protocol-relative, backslash, credentials-in-URL and other
      normalized origin escapes never reach injected fetch; valid paths still work.
- [ ] GREEN: enforce origin/protocol admission after URL resolution at SDK request
      boundaries; document the behavior of the public fetch escape hatch.
- [ ] Verify GREEN: run `npm test -- src/client.test.ts src/client/call.test.ts src/transport`.
- [ ] REFACTOR: preserve redirect rejection and dual HTTP opt-in; avoid pretending
      an unrestricted custom fetch implementation provides network egress isolation.

Definition of Done:

- [ ] Gate A passes; forbidden URLs cause zero network-boundary calls.
- [ ] Actual files, attack matrix and API-compatibility review recorded.

Amendments: none yet.
Handoff: S06 can centralize deadlines without reintroducing origin escape.

### S06 - Deadlines and cancellation (SEC-07) - NOT STARTED

Depends on: S05. Branch: `fix/remediation-s06-cancellation`.
Files expected: `src/client.ts`, `src/client/call.ts`, `src/transport/retry.ts`,
`src/auth/otp.ts`, `src/auth/sep10.ts`, `src/recipes/quoteThenExecute.ts`,
`src/recipes/connectPayment.ts`; NEW `src/transport/retry.test.ts`,
`src/client.deadlines.test.ts`, `src/recipes/quoteThenExecute.test.ts`.

TDD tasks:

- [ ] RED / verify RED: already-aborted input, abort during refresh/backoff/body read,
      deadline expiration, and abort between quote/decision/execute stop subsequent work.
- [ ] GREEN: validate timeout options, compose caller/deadline signals, bound body
      reads, cancel waits and pass cancellation through auth/recipe steps.
- [ ] Verify GREEN: run `npm test -- src/client src/transport src/auth src/recipes`;
      use fake clocks and controlled streams, not timing-sensitive sleeps.
- [ ] REFACTOR: remove timers/listeners on all exits; define whether caller signals
      override or compose the default deadline and document total retry budget behavior.

Definition of Done:

- [ ] Gate A passes; no new payment step or retry begins after cancellation.
- [ ] Resource cleanup and public signature compatibility reviewed; handoff logged.

Amendments: none yet.
Handoff: S07/S08 build on deterministic cancellation and bounded requests.

## Phase 3 - Financial admission and recovery

Status: NOT STARTED. Requires Phase 2 completion and G03/G04 decisions.

### S07 - Exact amounts and quote fidelity (SEC-04, SEC-09) - NOT STARTED

Depends on: S06 and G04. Branch: `fix/remediation-s07-quote-admission`.
Files expected: `src/recipes/connectPayment.ts`, `src/client/connect/types.ts`,
`src/client/connect/quotes/index.ts`, `src/client/business/wallets/index.ts`,
`api/openapi.yaml`, `docs/connect.md`; NEW `src/recipes/connectPayment.test.ts`.

TDD tasks:

- [ ] RED / verify RED: reject invalid amount/sendMax, over-seven-decimal Stellar
      values, unsafe numeric conversion, expired/missing/mismatched quotes and
      incompatible assets/networks before funding. Include valid boundary amounts.
- [ ] GREEN: implement exact admission using the approved existing wire contract;
      validate destination, quote/connector identity, funding amount and expiry.
      Preserve required quote memo/type and reject conflicting caller overrides.
- [ ] Verify GREEN: run `npm test -- src/recipes src/client`; assert exact outbound
      payment fields and zero funding calls for every rejected case.
- [ ] REFACTOR: centralize narrowly scoped validation without floating-point
      rounding; document compatibility changes. Do not edit the gateway-owned
      OpenAPI spec to make SDK behavior appear compliant.

Definition of Done:

- [ ] Gate A passes; seven-decimal, memo and expiry boundaries have behavioral tests.
- [ ] Human reviews financial/wire semantics; actual files and unresolved owner inputs logged.

Amendments: none yet.
Handoff: S08 receives a fully admitted immutable payment intent/quote.

### S08 - Preflight and non-replaying recovery (SEC-03) - NOT STARTED

Depends on: S07, S04 and G03. Branch: `fix/remediation-s08-payment-recovery`.
Files expected: `src/recipes/connectPayment.ts`, `src/recipes/connectPayment.test.ts`,
`docs/recipes.md`, `docs/connect.md`.

TDD tasks:

- [ ] RED / verify RED: missing destination, wrong wallet/association and invalid
      connector cause zero funding; repeated/concurrent do calls do not duplicate
      successful funding; payout failure preserves the funding hash and operation key.
- [ ] GREEN: resolve deterministic preflight before mutation, guard execution state,
      and provide approved explicit resume behavior for a known completed funding leg.
- [ ] RED / verify RED then GREEN: ambiguous funding response stops with recovery
      evidence and cannot automatically re-fund. A replacement process without
      durable evidence must not claim exactly-once execution.
- [ ] Verify GREEN: run `npm test -- src/recipes`; challenge payout failure, response
      loss, cancellation, re-entry and stale quote boundaries.
- [ ] REFACTOR: document recovery and remaining gateway reconciliation requirements.
      Do not invent automatic compensation/refunds or a new datastore.

Definition of Done:

- [ ] Gate A passes; financial happy/failure paths are independently reviewed.
- [ ] Record state-transition contract, actual files, evidence and recovery limitations.

Amendments: none yet.
Handoff: S12/S16 challenge the integrated money-movement boundaries offline.

## Phase 4 - Adapter and contract assurance

Status: NOT STARTED.

### S09 - Bounded Node webhook adapter (OPS-03) - NOT STARTED

Depends on: S01. Branch: `fix/remediation-s09-webhook-adapter`.
Files expected: `examples/webhook-server/main.ts`, `src/webhook/index.ts`,
`src/webhook/webhook.test.ts`; NEW `test/unit/webhook-server.test.ts`.

TDD tasks:

- [ ] RED / verify RED: real loopback Node requests exceeding the cap, including
      chunked bodies with no trusted length, stop buffering and receive controlled errors.
- [ ] GREEN: bound actual bytes before buffering, handle disconnects/read failures
      and catch the server callback's asynchronous errors.
- [ ] Verify GREEN: run `npm test -- src/webhook test/unit/webhook-server.test.ts`;
      retain valid/bad HMAC, replay, byte-count and callback-failure coverage.
- [ ] REFACTOR: extract an import-safe adapter if needed, without starting a server
      during tests or logging payloads/credentials. Close all test sockets.

Definition of Done:

- [ ] Gate A passes; actual Node adapter behavior, not just verifier behavior, is tested.
- [ ] Actual files and local-only verification evidence logged.

Amendments: none yet.
Handoff: S10 includes the maintained example and its adapter in typing gates.

### S10 - Maintained test/script typing (TEST-03, partial) - NOT STARTED

Depends on: S09. Branch: `fix/remediation-s10-test-types`.
Files expected: `tsconfig.test.json`, `tsconfig.json`, `package.json`,
`eslint.config.js`, `src/client/*/index.ts`, `test/**/*.ts`, `examples/**/*.ts`,
`docs/local-dev.md`; NEW script-specific config if genuinely required.

TDD tasks:

- [ ] RED / verify RED: reproduce and inventory all 61 baseline errors by file;
      verify newly maintained tests/examples are actually compiled.
- [ ] GREEN: port retained scripts to supported APIs and resolve missing names/types;
      classify obsolete signing/challenge scripts with human-approved disposition.
      Do not introduce dummy production APIs, blanket casts, ts-ignore or silent exclusions.
- [ ] Verify GREEN: `./node_modules/.bin/tsc --noEmit -p tsconfig.test.json` and any
      explicitly added maintained-example config pass without running live scripts.
- [ ] REFACTOR: remove the six stale lint-disable directives and wire test typing into
      CI. Record any approved archival with evidence; split this session if scope grows.

Definition of Done:

- [ ] Gate A plus maintained test/example typecheck passes; zero lint warnings.
- [ ] Every retained/archived script is accounted for; actual files and commands logged.

Amendments: none yet.
Handoff: all later sessions enforce the maintained-test typecheck.

### S11 - Opt-in read-only contracts (TEST-03, remainder) - NOT STARTED

Depends on: S10 and G05. Branch: `fix/remediation-s11-contracts`.
Files expected: `vitest.config.ts`, `test/contract/health.test.ts`,
`.github/workflows/contract-staging.yml`, `package.json`;
NEW dedicated contract config, discovery tests and read-only contract tests.

TDD tasks:

- [ ] RED / verify RED: explicit contract discovery collects the intended files;
      default unit discovery and missing opt-in never make live requests.
- [ ] GREEN: separate configurations/commands; enforce explicit target, opt-in and
      credential checks. Never default a contract command to production.
- [ ] RED / verify RED then GREEN: exercise health/version, envelopes/errors,
      authentication/track boundaries and approved read-only wire shapes against
      a controlled local peer before any authorized live run.
- [ ] Verify GREEN: run offline discovery-policy tests and the local-peer suite;
      prove supplied credentials are used only on the admitted target.
- [ ] REFACTOR: document gateway-owner gaps and read-only live invocation separately.
      Remove unnecessary credential retrieval only where coverage no longer requires it.

Definition of Done:

- [ ] Gate A and typing pass; record exact nonempty discovered test inventory.
- [ ] Authorized read-only live result recorded, or mark the external gate BLOCKED
      with a named owner; never label an unrun/skipped contract suite verified.

Amendments: none yet.
Handoff: S16 distinguishes local contract assurance from actual gateway evidence.

### S12 - Meaningful coverage gates (TEST-01, remainder) - NOT STARTED

Depends on: S08 and S11. Branch: `fix/remediation-s12-coverage-gates`.
Files expected: `vitest.config.ts`, `.github/workflows/ci.yml`, `package.json`,
all runtime-module tests; NEW focused wrapper and recipe tests.

TDD tasks:

- [ ] RED / verify RED: policy fails when real index implementations disappear,
      a protected module drops below its floor, or a security guard mutation survives.
- [ ] GREEN: add missing behavioral tests for application/business wrappers,
      call/envelope paths, OTP/SEP10 and all recipes; assert method/path/body,
      authorization/track, failure propagation and zero side effects on rejection.
- [ ] Verify GREEN: run `npm run test:coverage` with full implementations and
      persist measured global/per-file denominators in the progress entry.
- [ ] REFACTOR: enforce proposed minimum 80% statements/branches/functions/lines
      globally and for auth, transport, call, webhook and payment recipes. Obtain
      approval for any change to this proposed floor; no exclusion-based inflation.

Definition of Done:

- [ ] Gate A, typing and enforced coverage pass; critical security behaviors and
      selected guard-removal mutations pass regardless of numeric coverage.
- [ ] Record all module gaps, independent review and actual files; split unbounded
      wrapper backlog into appended sessions rather than waiving it.

Amendments: none yet.
Handoff: coverage becomes a blocking common gate, not a reporting-only command.

## Phase 5 - Supply-chain and release controls

Status: NOT STARTED.

### S13 - Safe and functional spec sync (SEC-10, OPS-02, OPS-05) - NOT STARTED

Depends on: S01. Branch: `fix/remediation-s13-spec-sync`.
Files expected: `.github/workflows/api-sync.yml`, `scripts/sync-spec.mjs`,
`api/openapi.yaml`, `api/openapi.sha256`, `src/version.ts`;
NEW `test/unit/spec-sync.test.ts`.

TDD tasks:

- [ ] RED / verify RED: hostile tag input cannot execute shell, escape an approved
      ref/path or alter unexpected files; missing token fails before any network request.
- [ ] GREEN: pass validated tags as quoted data; separate narrow private-repo read
      credentials from PR-write credentials, with no value output or CLI-secret arguments.
- [ ] RED / verify RED then GREEN: sync success updates all hash surfaces; network,
      invalid-content and interrupted-write failures preserve a consistent prior state.
      A deliberate spec/hash drift is detected by a real check.
- [ ] Verify GREEN: run `npm test -- test/unit/spec-sync.test.ts` and workflow-policy
      checks against isolated fixtures; never overwrite the live contract during tests.
- [ ] REFACTOR: correct the nonexistent compile-time assertion claim and document
      owner-provisioned credentials; no live dispatch or credential provisioning.

Definition of Done:

- [ ] Applicable common gates pass; negative workflow and spec-integrity checks pass.
- [ ] Cross-repository capability and settings requirements have an owner; actual files logged.

Amendments: none yet.
Handoff: S14/S15 reuse enforced artifact/spec identity checks.

### S14 - Patched tooling and package identity (DEP-01, OPS-04) - NOT STARTED

Depends on: S13. Branch: `fix/remediation-s14-package-integrity`.
Files expected: `package.json`, `package-lock.json`, `src/version.ts`,
`tsup.config.ts`; NEW `test/unit/package-integrity.test.ts`.

TDD tasks:

- [ ] RED / verify RED: package version differs from built ESM/CJS VERSION and
      user agent; package export/declaration consistency is asserted.
- [ ] GREEN: use one version source or an enforced synchronization mechanism;
      inspect current advisories and update only compatible affected tooling.
- [ ] Verify GREEN: run `npm audit --audit-level=high`, inspect full advisory output,
      run build and offline tests on Node 22, and inspect `npm pack --dry-run --ignore-scripts`.
- [ ] REFACTOR: verify published-file allowlists exclude credentials, fixtures and
      reports. Do not run publish or an automatic forced dependency downgrade.

Definition of Done:

- [ ] All applicable common gates and built-package assertions pass on Node 22.
- [ ] Remaining advisories, if any, retain approved owner/applicability/expiry and
      remain OPEN in the ledger; record actual versions and files.

Amendments: none yet.
Handoff: S15 validates the exact artifact and source identity before publication.

### S15 - Release and protection gates (OPS-01) - NOT STARTED

Depends on: S12, S14 and G06. Branch: `fix/remediation-s15-release-gates`.
Files expected: `.github/workflows/release.yml`, `.github/workflows/ci.yml`,
`.github/workflows/contract-staging.yml`, `SECURITY.md`, `docs/operational.md`;
NEW `test/unit/release-policy.test.ts`.

TDD tasks:

- [ ] RED / verify RED: unapproved source/tag, version mismatch, failed audit,
      failed tests/typing/coverage, or wrong environment cannot reach publishing.
- [ ] GREEN: enforce approved source policy and immutable candidate identity;
      separate validation from least-privilege publication jobs and approval gate.
      Retain provenance; validate tag equals package version.
- [ ] Verify GREEN: run `npm test -- test/unit/release-policy.test.ts` and workflow
      static validation. Never trigger publication to test the gate.
- [ ] REFACTOR: document secret scopes, pinning/update policy and rollback/advisory
      response for immutable npm versions; do not imply unpublishing is a safe rollback.

Definition of Done:

- [ ] All common gates pass; reviewed workflow paths cannot bypass checks via a tag.
- [ ] Authorized human verifies branch/tag rules, required checks/reviews, read-only
      default token, fork restrictions where applicable, secrets and release environment.
      Unknown/unconfigured controls remain explicitly BLOCKED; no settings changed here.

Settings to verify:
[branches](https://github.com/ZeamMoney/zeam-sdk-ts/settings/branches),
[rules](https://github.com/ZeamMoney/zeam-sdk-ts/settings/rules),
[Actions](https://github.com/ZeamMoney/zeam-sdk-ts/settings/actions),
[secrets](https://github.com/ZeamMoney/zeam-sdk-ts/settings/secrets/actions),
[environments](https://github.com/ZeamMoney/zeam-sdk-ts/settings/environments).
Publication contents write can change repository state; id-token/attestation
write can issue provenance assertions. Scope each to its actual job need.

Amendments: none yet.
Handoff: S16 checks source gates separately from verified external protections.

## Phase 6 - Independent acceptance

Status: NOT STARTED.

### S16 - Re-challenge every finding (all IDs, TEST-04) - NOT STARTED

Depends on: every S01-S15 session. Branch: `fix/remediation-s16-acceptance`.
Files expected: both remediation documents, all affected tests and workflows,
`CHANGELOG.md`, `SECURITY.md`, `docs/auth.md`, `docs/connect.md`, `docs/recipes.md`.

TDD tasks:

- [ ] Reproduce every register acceptance case on the integrated candidate; use
      an independent reviewer, not only the implementing session's self-assessment.
- [ ] For any new defect, append an owned session and capture genuine RED before
      the minimal fix; do not silently add a fix to acceptance or rewrite old evidence.
- [ ] Verify GREEN: run Gate A, maintained test/example typing, enforced full coverage,
      package/spec checks, workflow-policy checks and dependency audit on Node 22.
- [ ] REFACTOR: reconcile docs with actual guarantees, API compatibility and upgrade
      requirements. Preserve known limitations instead of claiming absolute exactly-once,
      memory zeroization or universal historical TDD.

Definition of Done:

- [ ] All 20 register IDs have closure evidence or an explicit dated, owned
      deferral. Any high-severity deferral blocks production-readiness approval.
- [ ] No hidden skips/exclusions/new warnings; every session has actual files and
      Red/Green evidence; final candidate revision/diff is recorded.
- [ ] Read-only gateway evidence and repository-protection evidence are recorded,
      or explicitly remain external BLOCKED gates with owners.
- [ ] Human security/payment review completed. Source completion is recorded
      separately from PR approval, merge, npm publication and deployment.
- [ ] Rollout/upgrade guidance and last known working package are identified.
      No release or financial operation performed under this plan's drafting authority.

Amendments: none yet.
Handoff: report source-ready, blocked or approved-for-separately-authorized-release;
never equate a checked local task with a published or deployed fix.

## Finding closure ledger

Tick only after the register's full acceptance criteria and all assigned sessions
pass. Include a dated evidence reference in the Progress Log.

- [ ] SEC-01 - S02 - principal binding.
- [ ] SEC-02 - S03 - invalidation fences.
- [ ] SEC-03 - S08 - preflight and recovery.
- [ ] SEC-04 - S07 - quote fidelity.
- [ ] SEC-05 - S04 - idempotency.
- [ ] SEC-06 - S05 - origin confinement.
- [ ] SEC-07 - S06 - deadlines/cancellation.
- [ ] SEC-08 - S02 - refresh isolation.
- [ ] SEC-09 - S07 - exact amounts.
- [ ] SEC-10 - S13 - workflow input safety.
- [ ] TEST-01 - S01/S12 - truthful coverage and blocking floors.
- [ ] TEST-02 - S01 - non-vacuous guard tests.
- [ ] TEST-03 - S10/S11 - maintained typing and opt-in contracts.
- [ ] TEST-04 - S01/S16 - authentic future TDD evidence.
- [ ] OPS-01 - S15 - release/protection gates.
- [ ] OPS-02 - S13 - private spec access.
- [ ] OPS-03 - S09 - bounded Node webhook adapter.
- [ ] OPS-04 - S14 - package/runtime version parity.
- [ ] OPS-05 - S13 - enforced spec integrity.
- [ ] DEP-01 - S14 - dependency advisories.

## Cross-cutting amendments

- 2026-11-05: Plan is documentation only. User authorization to draft does not
  authorize executing any session or Git/cloud operation.
- 2026-11-05: Supplied team branch workflow overrides conflicting generic MCP
  examples, but the missing repository integration-branch mapping is G02, not
  an inferred permission to use main.
- 2026-11-05: Session risk is HIGH for S02-S08 and S15; implementation can be
  prepared offline only after relevant design gates. All consequential external
  actions are human-controlled. Remaining sessions are bounded assurance work,
  with final independent review required.
- Future amendments: record date, affected sessions, incorrect assumption,
  observed truth, decision owner and revised verification. Never silently waive
  a gate or remove an item from the register.

## Progress Log

### 2026-11-05 - S01 - RED checkpoint

- User authorized Phase 1 implementation and commits, approved the origin/main
  exception and confirmed Danie as owner; independent review remains pre-merge work.
- Fetched `origin/main`, created `fix/remediation-s01-test-harness` at
  `c8f9952`. Runtime: Node 25.5.0. Both previously untracked planning documents
  are included in this session's requested commit scope.
- Baseline `npm test` and `npm run test:coverage`: exit 0, 71 tests/5 files;
  statements 43.35%, branches 34.58%, functions 45.71%, lines 46.81%.
- Removed only exec path-validation guards in an isolated temporary source copy.
  The original `src/client/connect/connect.test.ts` still passed 8/8: mutant survived.
  The real checkout's runtime source was not modified.
- Added the coverage source-inventory assertion and stronger Connect guard tests.
  `npm test -- test/unit/harness.test.ts src/client/connect/connect.test.ts`:
  exit 1, the inventory assertion failed on omitted runtime index.ts files;
  all 16 strengthened Connect tests passed against unchanged production guards.
- `./node_modules/.bin/tsc --noEmit -p tsconfig.test.json`: exit 2, the same
  61 existing errors across 11 files; no errors in the new or modified tests.
- Next: commit this authentic RED checkpoint, remove the coverage exclusion,
  prove the strengthened tests kill the isolated mutant, then run Gate A.

### 2026-11-05 - Planning only

- Created the findings register and this draft runbook against reviewed commit
  `712a3b5df1624792ee6176cb0f88f905460efe7f`.
- Sixteen implementation/acceptance sessions and 20 finding IDs are assigned;
  every remediation checkbox remains unchecked.
- No fixes, commits, pushes, merges, publication, credential actions or live
  transactions performed. Review baseline results are historical, not re-run
  implementation-session evidence.
- Next: review the draft and resolve G01/G02 before authorizing S01. Resolve each
  later design/external gate before its dependent session starts.

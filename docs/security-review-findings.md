# SDK security review findings

Evidence date: 2026-11-05. Reviewed commit:
`712a3b5df1624792ee6176cb0f88f905460efe7f`, branch
`fix/security-vitest-v3`, [PR #6](https://github.com/ZeamMoney/zeam-sdk-ts/pull/6).

This is the evidence register, not the execution sequence. Use the
[remediation runbook](security-remediation-plan.md) for session order,
checkboxes, gates and handoffs. Locations refer to the reviewed revision and
must be rechecked before implementation. All items below are OPEN.

## Evidence and limitations

- Offline suite: 71 passing cases in five test files.
- Source typecheck, lint, formatting and package build passed. Lint had six
  unused-disable warnings.
- `tsc --noEmit -p tsconfig.test.json` failed with 61 errors across 11 files,
  including stale APIs, missing Stellar imports and missing identifiers.
- Corrected full-implementation coverage: statements 45.45%, branches 38.86%,
  functions 35.00%, lines 47.92%. The default configuration excludes every
  `src/**/index.ts`; its different denominator is not comparable as an improvement.
- `npm audit --audit-level=high` reported one low and six moderate findings
  in development tooling, with no high or critical findings on the evidence date.
  Advisory data changes; reproduce it rather than treating these counts as current.
- Review used injected offline responses and essential temporary test inputs.
  No operational secrets, live authentication, payments, deployments or remote
  configuration changes were used. Local validation ran on Node 25.5.0, not
  the CI baseline Node 22; final acceptance must include Node 22.
- GitHub protections, actual staging controls, gateway enforcement, server-side
  idempotency behavior and production deployment state were not verified.
- Temporary review probes are not durable regression tests. Recreate the
  smallest reproductions in the maintained suite before changing behavior.

## Runtime security and financial safety

### SEC-01 - Refresh principal substitution - HIGH

Location: `src/auth/sep10.ts:47-55`. Assigned session: S02.

A refresher configured with application A's credentials can overwrite session B's
tokens without comparing subjects. Offline result: subject remained `app-B`
while its token authenticated application A.

Acceptance: a mismatch rejects before fetch and leaves B unchanged; same-subject
refresh works; supported auth-response fields are validated before session mutation.
Do not claim this proves a gateway challenge-validation defect.

### SEC-02 - In-flight refresh defeats local invalidation - HIGH

Locations: `src/auth/otp.ts:119-124`, `src/auth/session.ts:70-73`,
`src/client/call.ts:66-68`, `src/auth/store.ts:35-38`. Assigned session: S03.

Deleting a session while refresh is awaiting its response leaves the store empty,
but the delayed response restores tokens on the erased object and the original
request retries with them. This is a local logout race, not proof of bypassing
server-side token revocation.

Acceptance: erase, delete, close and replacement fence pending refresh commits
and prevent authenticated retries; ordinary refresh and same-session coalescing
still work. Cover OTP, Connect and AutoRefresher store writeback.

### SEC-03 - Funding precedes payout validation and safe recovery - HIGH

Locations: `src/recipes/connectPayment.ts:80-89`, `:219-249`.
Assigned session: S08.

An empty beneficiary destination list was detected only after a wallet-funding
request. Re-entering the recipe has no completed-funding guard. The latter is
source evidence, not a demonstrated duplicate on a live gateway.

Acceptance: validate all deterministic prerequisites before funding; repeated
or concurrent execution must not repeat successful funding. Unknown funding
outcomes stop with explicit recovery information, not blind replay. Preserve a
known hash and operation identity if the payout leg fails.

### SEC-04 - Quote funding instructions are not enforced - HIGH

Location: `src/recipes/connectPayment.ts:195-215`. Assigned session: S07.

An offline expired quote specifying USDC and a required memo produced an XLM
funding request without that memo. Required quote fields are optional types
without runtime admission checks.

Acceptance: quote expiry, connector identity, required fields, network, asset,
destination, amount and memo are checked before funding. Quote instructions
are authoritative; incompatible caller inputs fail closed. Resolve amount
semantics against the checked-in gateway contract before changing the wire.

### SEC-05 - Idempotency key changes after refresh - MEDIUM

Locations: `src/client/call.ts:50-68`, `src/transport/fetcher.ts:42-44`.
Assigned session: S04.

Offline wallet-operation attempts before and after a 401 used different keys.
Typed calls also lack caller-controlled operation keys for separate recovery
calls. A 401 ordinarily precedes mutation; no actual duplicate payment was proven.

Acceptance: one logical mutation preserves key and body through supported
transport and auth retries; distinct operations remain distinct. Expose a
backwards-compatible caller key mechanism. Document that server deduplication
and reconciliation remain necessary.

### SEC-06 - Raw URL origin escape - MEDIUM

Location: `src/client.ts:212-215`. Assigned session: S05.

`raw().get("//outside.invalid/path")` resolved outside the configured gateway.
Impact requires an integrator to pass untrusted paths. Automatic session bearer
leakage was not demonstrated because raw calls do not add session authorization.

Acceptance: reject protocol-relative, backslash-normalized and alternate-origin
paths before fetch; ordinary rooted paths and query parameters still work.
Preserve redirect rejection and the dual opt-in for plain HTTP.

### SEC-07 - Deadlines and cancellation are not enforced - MEDIUM

Locations: `src/client.ts:99-111`, `src/recipes/quoteThenExecute.ts:23-40`.
Assigned session: S06.

An offline 5 ms timeout did not abort after 25 ms. An already-aborted recipe
signal became a non-aborted quote signal and execution was reached when callbacks
returned normally.

Acceptance: validated deadlines bound requests including body reads; cancellation
interrupts retries/backoff, propagates through auth and recipes, and prevents the
next financial step. Remove listeners/timers on every terminal path.

### SEC-08 - Refresh coalesces unrelated sessions - MEDIUM

Location: `src/client.ts:115-125`. Assigned session: S02.

Concurrent refreshes for Business sessions A and B invoked only A's refresher;
B's promise resolved without refreshing B. No token disclosure from this map
alone was demonstrated.

Acceptance: distinct session identities refresh independently; repeated calls
for the same session coalesce. Document MemoryStore's one-session-per-track
scope rather than silently redesigning it as a multi-tenant store.

### SEC-09 - Invalid financial amounts accepted - MEDIUM

Locations: `src/recipes/connectPayment.ts:116`,
`src/client/business/wallets/index.ts:68`. Assigned session: S07.

Recipe construction accepted -1, Infinity and 0.00000001. Wallet amount strings
are forwarded without a seven-decimal Stellar guard.

Acceptance: reject non-finite, non-positive, non-canonical, over-precision and
out-of-range Stellar amounts before fetch. Preserve exact decimal values;
never silently round. Check amount/sendMax and supported quote boundaries.
Display formatting must not leak spaces or locale separators into wire amounts.

### SEC-10 - Workflow input becomes shell source - MEDIUM

Location: `.github/workflows/api-sync.yml:29-32`. Assigned session: S13.

Gateway tags are interpolated into shell source. Harmless local command
substitution confirmed execution. Dispatch rights are required; this is not a
public unauthenticated exploit. The workflow grants contents/PR write.

Acceptance: validated refs travel as quoted data through environment variables,
never executable expressions. Reject metacharacters, control characters and
path escapes under the approved ref policy. Regression tests must show no
subprocess execution or unintended output-file modification.

## Test assurance

### TEST-01 - Coverage hides implementations and has no gate

Locations: `vitest.config.ts:7-12`, `.github/workflows/ci.yml`.
Assigned sessions: S01 and S12.

Every index.ts is excluded, including the webhook verifier and client methods.
The call layer, SEP-10, recipes and application/business wrappers have major
zero-coverage areas. CI runs ordinary tests without thresholds.

Acceptance: discover every runtime implementation; exclude only actual barrels,
types or generated code with justification. Test important success/failure
branches and enforce explicit global and security-module coverage floors in CI.

### TEST-02 - SSRF tests accept unrelated failures

Location: `src/client/connect/connect.test.ts:10-27`. Assigned session: S01.

The fake fetch always throws and assertions accept any rejection. A valid path
reaching fetch can satisfy the same assertion; guard removal can remain green.

Acceptance: test exact validation failures, zero fetch calls, and positive
allowed paths with valid sessions. A targeted guard-removal mutation must fail
the relevant test rather than produce another accepted exception.

### TEST-03 - Contract discovery and test typing are broken

Locations: `vitest.config.ts:7-8`, `tsconfig.test.json`,
`test/contract/health.test.ts`, `.github/workflows/contract-staging.yml`.
Assigned sessions: S10 and S11.

Contract tests are excluded by the same configuration used by test:contract.
The only contract test checks health-version truthiness. Its fetched staging
token is unused. Maintained/manual test code has 61 type errors.

Acceptance: compile every retained supported test/example/script, explicitly
classify obsolete scripts, discover contracts only under opt-in, and run
meaningful read-only contract assertions with explicit target/credential gates.
Default tests must never contact a live service.

### TEST-04 - Universal historical TDD is not evidenced

Locations: Git history and existing test files. Assigned sessions: S01 and S16.

Some helper tests were committed after implementation; combined implementation
and test commits do not establish local Red/Green order.

Acceptance: retain this historical limitation; record authentic failing-before
and passing-after evidence for new work. Never retroactively label the old
implementation test-first.

## Operational and supply-chain findings

### OPS-01 - Release can bypass source audit policy

Locations: `.github/workflows/release.yml:3-35`, `.github/workflows/ci.yml`.
Assigned session: S15.

Any matching v\* tag can start publication; the file does not enforce the audit
gate, approved source ancestry or a protected release environment. Actual
repository-side restrictions are unverified.

Acceptance: approve the package-release policy, enforce source/tag/version and
validation gates before write credentials are exposed, use least privilege,
and separately verify protection rules and human approval. Do not assume AKS
application-deployment mechanics apply to this npm library.

### OPS-02 - Spec-sync token is not configured

Locations: `.github/workflows/api-sync.yml:25-32`,
`scripts/sync-spec.mjs:18-21`. Assigned session: S13.

The workflow does not export the token required by the script. It exits before
fetching; a default token may also lack access to the private gateway repository.

Acceptance: explicitly provision the narrow required cross-repository read
capability, keep PR-write capability separate, and test failure paths offline.
Never print the credential or put it in command arguments.

### OPS-03 - Webhook example buffers an unbounded body

Location: `examples/webhook-server/main.ts:8-14`. Assigned session: S09.

The Node adapter buffers before the verifier's byte cap, bypassing that memory
protection. Copying the example exposes a memory-exhaustion path.

Acceptance: bound actual incoming bytes before buffering, handle cancellation
and rejected promises, and return controlled errors. Test the real Node adapter,
not only the Fetch verifier.

### OPS-04 - Runtime version does not match package version

Locations: `package.json:3`, `src/version.ts:4`, `tsup.config.ts`.
Assigned session: S14.

Package version is 0.1.1 but the built VERSION export and user agent report 0.1.0.

Acceptance: package metadata, built ESM/CJS exports and default user agent agree.
Check exports/declarations and package contents without publishing.

### OPS-05 - Spec-integrity assurance is only a claim

Location: `src/version.ts:12-17`, `scripts/sync-spec.mjs`.
Assigned session: S13.

The comment promises an internal/wire compile-time assertion, but no such
implementation exists. The hashes matched at review time; actual drift was not
observed. This is an assurance gap, not an existing hash mismatch.

Acceptance: enforce agreement among the spec bytes, openapi.sha256 and SPEC_HASH;
a changed fixture/spec must fail the check. Correct misleading documentation.

### DEP-01 - Development dependency advisories remain

Location: `package-lock.json` and development dependency closure.
Assigned session: S14.

One low esbuild advisory and six moderate minimatch/TypeScript-ESLint closure
findings were reported. Exploit applicability differs by tool and platform.

Acceptance: use compatible patched versions where available; verify Node 22,
build, tests and lint. Do not use audit fix --force blindly. Any unfixed advisory
needs explicit applicability, owner, expiry and approval, not a green label.

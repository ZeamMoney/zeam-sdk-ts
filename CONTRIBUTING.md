# Contributing to zeam-sdk-ts

Thanks for contributing. The goal of this document is to get you from
clone to first passing test in **under ten minutes**.

## Prerequisites

- Node.js 22+ (see `.nvmrc`).
- `npm` 10+ (ships with Node 22).

## Quick start

```bash
git clone https://github.com/ZeamMoney/zeam-sdk-ts.git
cd zeam-sdk-ts

npm install
npm run typecheck
npm run lint
npm test
```

Optional: run contract tests against a local gateway on
`http://localhost:8080`:

```bash
ZEAM_API_URL=http://localhost:8080 npm run test:contract
```

## Project layout

- `src/index.ts` — barrel, `Client`, `Environment`, errors, options.
- `src/auth/` — OTP + SEP-10 flows, session, token store, refresh.
- `src/transport/` — HTTP plumbing (retry, redaction, envelope unwrap).
- `src/stellar/` — the **only** module allowed to import
  `@stellar/stellar-sdk`.
- `src/client/<domain>/` — typed 1:1 wrappers for gateway endpoints.
- `src/recipes/` — opinionated multi-step workflows.
- `src/webhook/` — inbound webhook HMAC verification.
- `src/internal/` — implementation details, not part of the public API.
- `examples/<name>/` — runnable examples.
- `test/contract/` — tests exercising a live gateway (skipped unless
  `ZEAM_CONTRACT_TESTS=1`).
- `test/fake/` — lightweight httptest-style fakes used by unit tests.
- `api/openapi.yaml` — gateway-owned contract, synced via
  `npm run sync-spec`.

## Code guidelines

- Every exported symbol has a TSDoc comment with a one-line summary.
- No module may import from `src/internal/**` outside its own subtree.
- `@stellar/stellar-sdk` is only imported from `src/stellar/**`;
  everything else uses the wrapper types.
- `src/transport/redaction.ts` runs **before** any user-supplied logger.
  When you add a new sensitive field, update
  `src/internal/redact/denylist.ts`.
- Every mutating call generates or propagates an `Idempotency-Key`.
- Tests are colocated as `*.test.ts` under `src/`. Contract tests
  (`test/contract/**`) live under a separate directory and are skipped
  unless `ZEAM_CONTRACT_TESTS=1`.

## Pull request checklist

- [ ] `npm run lint` is clean.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] New public symbols have TSDoc.
- [ ] CHANGELOG entry added under `[Unreleased]`.
- [ ] If the change touches wire shape: the accompanying gateway PR is
      linked and the `api/CHANGELOG.md` entry matches.

## Signing commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).
All commits are DCO-signed (`git commit -s`). Release tags are
cosign-signed by the maintainers.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

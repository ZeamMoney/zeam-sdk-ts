SHELL := /bin/bash

GATEWAY_TAG ?= main
GATEWAY_RAW_BASE := https://raw.githubusercontent.com/BeamMoney/zeam-api-gateway.go/$(GATEWAY_TAG)

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## npm install
	npm install

.PHONY: lint
lint: ## eslint + prettier check
	npm run lint
	npm run format:check

.PHONY: fmt
fmt: ## prettier --write
	npm run format

.PHONY: typecheck
typecheck: ## tsc --noEmit
	npm run typecheck

.PHONY: test
test: ## Unit tests
	npm test

.PHONY: test-watch
test-watch: ## Vitest watch mode
	npm run test:watch

.PHONY: test-contract
test-contract: ## Live-gateway smoke (requires ZEAM_API_URL + ZEAM_CONTRACT_TESTS=1)
	npm run test:contract

.PHONY: build
build: ## tsup build (ESM + CJS + d.ts)
	npm run build

.PHONY: sync-spec
sync-spec: ## Pull OpenAPI spec from gateway at GATEWAY_TAG
	@echo "Syncing OpenAPI spec from $(GATEWAY_RAW_BASE)"
	curl -sSfL $(GATEWAY_RAW_BASE)/docs/openapi.yaml -o api/openapi.yaml
	shasum -a 256 api/openapi.yaml | awk '{print $$1}' > api/openapi.sha256

.PHONY: check
check: lint typecheck test ## Full pre-commit gate

.DEFAULT_GOAL := help

# Invoice Tracker Cloud Template

This repo is a client-ready template for:
- Azure Functions (Node/TypeScript)
- Bicep infrastructure
- GitHub Actions deployment with OIDC
- Microsoft Graph + SharePoint list integration

## Read In Order (Runbook Map)

Follow these in sequence when cloning for a new client:

1. [Start Here: Architecture + Path](./docs/00-start-here.md)
2. [Bootstrap Dev Environment](./docs/01-bootstrap-dev.md)
3. [GitHub OIDC Deployment Setup](./docs/02-github-oidc-deploy.md)
4. [Promote To Production](./docs/03-promote-to-prod.md)
5. [Graph + SharePoint Integration](./docs/04-graph-sharepoint-integration.md)
6. [Secrets, App Settings, Local Dev](./docs/05-secrets-runtime-local.md)
7. [Troubleshooting Playbook](./docs/06-troubleshooting.md)
8. [Security + Handover Checklist](./docs/07-security-handover.md)

## Core Files

- `infra/main.bicep`
- `infra/main.parameters.dev.json`
- `infra/main.parameters.prod.json`
- `.github/workflows/deploy-dev.yml`
- `.github/workflows/deploy-prod.yml`
- `scripts/bootstrap-client.sh`
- `my-func-api/src/functions/sharepointListTest.ts`

## Sample Data

- `sample-data/invoice-tracker-au-sharepoint-import.xlsx`
- `sample-data/invoice-tracker-au-sharepoint-import.csv`

## Deep Reference

- Full detailed reference: [knowledgeBase.md](./knowledgeBase.md)

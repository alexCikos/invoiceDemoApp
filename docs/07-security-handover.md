# 07 - Security + Handover Checklist

## Security Checklist

Before go-live:
1. OIDC used for deployment (no deployment secrets in workflow).
2. `dev`/`prod` GitHub environment protections configured.
3. Least-privilege RBAC reviewed for deployer app.
4. Runtime Graph app is separate from deployer app.
5. Runtime Graph app limited to `Sites.Selected` and explicit site grant.
6. Runtime secret stored in Key Vault only.
7. Key Vault access limited to required identities/users.
8. Function auth settings reviewed (`anonymous` endpoints are demo-only).
9. Secret rotation dates documented.

## Handover Artifacts

Provide to client:
1. Repo URL and branch/release policy.
2. Environments and variable inventory.
3. Azure resource inventory and naming convention.
4. App registrations inventory:
   - deployment app(s)
   - runtime graph app(s)
   - admin grant app (if used)
5. Permission matrix:
   - Azure RBAC
   - Graph permissions
   - Site grants
6. Troubleshooting runbook link.
7. Secret rotation runbook and owner.
8. Support and escalation contacts.

## Recommended Rotation Cadence

1. Graph client secrets: rotate before expiry.
2. Revalidate site grants quarterly.
3. Re-audit app permissions quarterly.

## References

- Azure Login OIDC:
  - https://github.com/Azure/login
- GitHub to Azure OIDC:
  - https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect
- Key Vault references:
  - https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references
- Graph site permission API:
  - https://learn.microsoft.com/en-us/graph/api/site-post-permissions?view=graph-rest-1.0&tabs=http


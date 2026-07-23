# Security Policy — ZAIRE Backend

## Supported Versions

| Version | Supported |
|---|---|
| `main` (latest) | ✅ Active |
| Older branches or tags | ❌ Not supported |

Only the latest commit on the `main` branch receives security fixes.

---

## Reporting a Vulnerability

**Please do not open a public GitHub Issue for security vulnerabilities.**

If you discover a security issue in ZAIRE's backend, report it privately through one of the following channels:

- **Email:** [mugheessiddiqui202@gmail.com](mailto:mugheessiddiqui202@gmail.com)
- **GitHub Private Advisory:** [GitHub Security Advisories](https://github.com/mughees011/zaire-backend/security/advisories/new)

### What to include in your report

1. **Description** — a clear explanation of the vulnerability
2. **Impact** — what an attacker could achieve by exploiting it
3. **Steps to reproduce** — a minimal, reproducible example or proof of concept
4. **Affected files or routes** — the specific files or API endpoints involved
5. **Suggested fix** *(optional)* — a recommended mitigation, if you have one

### What happens next

- You'll receive an acknowledgement within **48 hours**
- We will investigate and aim to patch critical issues within **7 days**
- You'll be credited in the release notes, unless you prefer to remain anonymous

---

## Known Security Considerations

### Secret Scanning
The `/engineer/export` route runs an automatic secret scan on every generated file before packaging. Files containing API keys, tokens, or credentials are redacted before the ZIP is created.

### Path Traversal Protection
Every file path used in `materializeProject` and `exportProjectZip` is validated through `assertSafeRelativePath`. Paths containing `..` or absolute segments are rejected with a 400 error.

### Rate Limiting
All LLM and license endpoints are protected by `express-rate-limit` to prevent abuse.

### API Key Handling
Never commit `.env` files. Provide secrets through environment variables on your deployment platform (Render, Railway, or similar).

---

## Out of Scope

The following are **not** considered security vulnerabilities for reporting purposes:

- Bugs that only affect the reporter's own account or data
- Missing security headers (Helmet is already configured)
- Rate limit bypass via VPN (accepted within the current design)
- Issues in third-party dependencies — please report those directly to the upstream package maintainers

---

## Security Best Practices for Self-Hosters

If you are running your own instance of the ZAIRE backend:

1. **Never expose the backend directly** — always place it behind a reverse proxy (Nginx, Cloudflare)
2. **Rotate all API keys** periodically
3. **Enable Clerk webhook signature verification** before deploying to production
4. **Set `NODE_ENV=production`** to disable debug logging and error stack traces in responses
5. **Restrict CORS** in `index.js` to your actual frontend domain only
# Security Policy

This repository is a **personal open-source showcase** (CodeBook — computer science eBook e-commerce). It is not a commercial product with a paid bug-bounty program.

## Supported versions

| Version | Supported |
| ------- | --------- |
| Latest `main` | Yes |
| Live demo ([codebook-aws.vercel.app](https://codebook-aws.vercel.app/)) | Best-effort (legacy AWS-backed showcase) |
| Older forks / tags | No |

> **Migration note:** the live demo still points at the **legacy AWS Lambda + DynamoDB** backend. The new Express + Prisma API lives in `backend/` and is **not yet deployed** to production/Coolify; the Vite frontend has **not** been cut over on Vercel to that new API yet. Treat both surfaces as educational demos, not production SLAs.

## Reporting a vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Email a private report to: **[contact@arnobmahmud.com](mailto:contact@arnobmahmud.com)**

Please include:

- Short summary and potential impact
- Steps to reproduce (or a proof of concept)
- Affected path, commit SHA, or demo URL if known
- Your preferred contact for follow-up

**Do not** include production secrets, `.env` files, API keys, or credentials in the report.

## Out of scope

- Abuse of published demo / test accounts (`test@admin.com`, `test@user.com`, etc.)
- Denial-of-service or volumetric attacks against the live demo
- Social engineering, phishing, or physical attacks
- Issues solely in third-party services (Stripe, Shippo, Brevo, Cloudinary, Sentry, Google OAuth, LLM providers, Vercel, AWS, etc.) unless caused by clear misconfiguration in this repo
- Findings that require already-compromised admin credentials with no additional bug

## Response

Reports are handled **best-effort** for a personal OSS project. Prefer coordinated disclosure: private report → fix on `main` (when applicable) → optional public discussion after a fix is available.

There is no SLA and no commitment to assign CVEs. Thank you for helping keep the project safer for learners and operators.

## Author

**Arnob Mahmud** — [https://www.arnobmahmud.com](https://www.arnobmahmud.com) · [contact@arnobmahmud.com](mailto:contact@arnobmahmud.com)

# Security Policy

## Supported Versions

This project currently supports the `main` branch.

## Reporting a Vulnerability

Please do not open public issues for security vulnerabilities.

Report security issues privately via GitHub Security Advisories:
https://github.com/aurelienlewin/rgaa-vitrine/security/advisories

If unavailable, contact the maintainer profile:
https://github.com/aurelienlewin

## Security Notes for Contributors

- Never remove SSRF protections around remote URL fetching.
- Keep DNS/IP validation for private/local targets.
- Keep request timeout and response size limits.
- Avoid rendering untrusted HTML from analyzed websites.

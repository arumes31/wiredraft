# Authentication, organization access, and guest workspace

## Product behavior

WireDraft gains a dedicated `/login` experience while keeping the topology workstation focused on rack operations. A bootstrap administrator is sourced from Docker environment variables. The administrator can open every organization and create local user accounts assigned to one or more existing organizations. Local users authenticate with a password and must enroll an authenticator app on their first successful login. Enrollment presents a QR code and manual Base32 secret, verifies a six-digit TOTP, then shows ten one-use recovery codes exactly once.

Guest access remains enabled by default and can be disabled with `WIREDRAFT_GUEST_ENABLED=false`. The first authenticated startup records every existing topology ID in a persistent Guest workspace. This preserves current maps and their organization/location metadata instead of rewriting those business fields. Maps created by a guest are added to the same workspace and are labeled with the Guest organization. Administrators always retain access; regular users see only maps whose organization appears in their account membership.

## Security and persistence

Passwords use uniquely salted Argon2id PHC strings. TOTP secrets are encrypted with AES-GCM using a random 256-bit key stored beside the auth database with owner-only permissions. Recovery codes are random, high-entropy, one-use values stored only as SHA-256 digests. The bootstrap password is never written in plaintext and the bootstrap TOTP secret is encrypted before persistence.

Authentication uses short-lived, one-use password challenges followed by TOTP or recovery-code verification. Successful verification rotates into an opaque, random, server-side session. The cookie is `HttpOnly`, `SameSite=Strict`, host-only, and optionally `Secure`; unsafe browser requests must pass same-origin and CSRF-token checks. Login attempts and second-factor challenges are bounded. Error responses do not reveal whether a username exists.

The auth database and encryption key live in `/data/auth/`, separate from topology JSON discovery. Writes use the same temporary-file, fsync, rename, and restrictive-permission approach as topology persistence. A versioned state file records users, Guest topology IDs, and the one-time legacy workspace initialization.

## API and authorization

Public routes are limited to health, login/status/second-factor endpoints, static login assets, and existing tokenized read-only shares. Every topology route is wrapped after `ServeMux` matching, so the middleware can evaluate the real `{id}` path value before a handler runs. Unauthorized topology IDs return not-found to avoid cross-organization enumeration. Listing is filtered and creation validates the requested organization against the principal; guests are forced into Guest ownership.

Admin-only endpoints list and create accounts. Public user responses contain identity, role, assigned organizations, TOTP state, and disabled state—never password hashes, encrypted secrets, recovery digests, or bootstrap environment values. The main app bootstraps its session before loading maps, installs the CSRF token in the existing API client, and exposes a compact account control with logout and an administrator-only account dialog.

## Verification

Unit tests cover Argon2id parsing and comparison, encrypted secret round trips, RFC-compatible TOTP validation, first-login setup, one-use recovery codes, source-port-resistant rate limiting, bootstrap synchronization, Guest migration, and organization authorization. Handler tests cover public/private route boundaries, CSRF enforcement, filtered topology lists, forbidden cross-organization access, guest disablement, and admin account creation. Browser contract tests cover the QR/manual setup, recovery-code, logout, and organization-assignment surfaces; Playwright exercises the accessible login page, Guest transition, displayed session identity, and authenticated topology workflows. The final gate includes race tests, static analysis, vulnerability scanning, frontend coverage, accessibility, and a rebuilt healthy Docker service.

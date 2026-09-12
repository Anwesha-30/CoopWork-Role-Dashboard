---
name: CoopWork provider boundary
description: Authentication and persistence provider boundary for the CoopWork dashboard.
---

The first CoopWork build uses the existing project PostgreSQL service and a clearly labeled demo role selector because the requested Supabase connection was not authorized. Keep real authentication and server-side role enforcement as a provider boundary rather than spreading demo identity assumptions through dashboard components.

**Why:** The dashboards and CRUD flows can be built and previewed without blocking on an external connection, while production access control still requires a real authenticated identity and cooperative-scoped policies.

**How to apply:** When Supabase is connected, replace the demo session adapter and role gate first, then apply the authenticated identity to every API authorization check and database policy.
# Privacy Policy (GDPR)

**Last updated:** June 2026

## Data Controller

The application is operated by the development team. For GDPR inquiries, contact the administrator via the deployed application.

## Data We Store

### Account Data
- **Email address** — used for authentication and notifications
- **Password hash** — bcrypt, never stored in plaintext
- **Role** (`admin` / `beta`) — access control
- **Approval status** — whether the account is active
- **Timestamps** — account creation, last activity

### Game Data
- **Game state** — serialized JSON containing all simulation data (teams, players, matches, standings, negotiations, etc.)
- **Game metadata** — name, seed, current year, creation date

All game data is owned by the user who created it and is stored in the `game_engine_states` table as the authoritative simulation state. Relational projections (teams, matches, etc.) are derived from this state.

### Access Requests
- **Name, email, reason** — submitted when requesting access to the application
- **Status** (pending / approved / rejected) — review workflow
- **Reviewer** — admin who processed the request

### Password Reset Tokens
- Temporary tokens stored securely, expire after use or timeout

## How We Use Your Data

- Authentication and authorization
- Game simulation and persistence
- Admin management (access requests, user approval)

We do **not** share, sell, or transmit personal data to third parties.

## Data Retention

- **Access requests** — rejected/pending requests older than 90 days are automatically purged daily at 03:00 UTC
- **Game data** — retained indefinitely while the account is active
- **Account data** — retained while the account exists

## Your Rights (GDPR Art. 15–21)

### Right to Access (Art. 15)
Request a copy of all personal data we hold about you.

### Right to Erasure (Art. 17)
Request complete deletion of your account and all associated data:
- All games and their cascaded data (teams, players, matches, standings, etc.)
- Your user account and credentials
- Password reset tokens

**Admin action required:** Contact the administrator to initiate deletion. The `DELETE /admin/users/:id/hard` endpoint performs a full GDPR-compliant hard delete.

### Right to Rectification (Art. 16)
Request correction of inaccurate personal data (currently: email address via admin).

### Right to Data Portability (Art. 20)
Export your game data via the import/export feature in the Games lobby (JSON format).

## Data Security

- Passwords hashed with bcrypt (cost factor ≥10)
- JWT authentication with secure tokens
- Rate limiting on auth endpoints (5 requests/5min per IP)
- CORS restricted to configured origins
- Helmet HTTP security headers
- Stack traces hidden in production error responses
- Database connections via connection pooling with configurable limits

## Contact

For GDPR requests (access, erasure, rectification), contact the application administrator.

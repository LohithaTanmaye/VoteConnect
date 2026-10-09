# VoteConnect

VoteConnect is an academic voter-information prototype. It provides candidate listings, voter registration, registration-status lookup, and an administrator page for reviewing registrations and managing candidates. It is not an official election system and does not collect or count votes.

## Features

- Browse candidate information.
- Submit voter registration details.
- Check a registration's status.
- Sign in as an administrator to review registrations, verify or reject them, and manage candidates.

## Requirements

- Node.js and npm
- A Supabase project

## Run locally

1. Clone the repository and open its directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with the required values:

   ```dotenv
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ADMIN_USERNAME=your-admin-username
   ADMIN_PASSWORD=use-a-strong-unique-password
   ADMIN_SESSION_SECRET=replace-with-a-long-random-secret
   PORT=3000
   ```

   `PORT` is optional. The other values are required for database access and administrator login.

4. In the Supabase SQL Editor, run the SQL in [`supabase.sql`](./supabase.sql) to create the `voters` and `candidates` tables.
5. Start the server:

   ```bash
   npm start
   ```

6. Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

This repository includes [`vercel.json`](./vercel.json) for deployment. Import the repository into Vercel and add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` as project environment variables. Set them for each environment where the application will run, then deploy.

Never put secrets in frontend JavaScript or commit them to Git. The Supabase service-role key bypasses normal row-level security controls; keep it server-side and restrict access to the deployment settings.

## Main routes

| Route | Purpose |
| --- | --- |
| `GET /api/candidates` | List candidates |
| `POST /api/voters` | Register a voter |
| `GET /api/voters/status?email=...` | Return the registration status for an email address |
| `POST /api/admin/login` | Sign in as an administrator |
| `GET /api/admin/voters` | List registrations (administrator token required) |
| `PUT /api/admin/voters/:id/verify` | Verify a registration (administrator token required) |
| `PUT /api/admin/voters/:id/reject` | Reject a registration (administrator token required) |
| `POST /api/admin/candidates` | Add a candidate (administrator token required) |
| `DELETE /api/admin/candidates/:id` | Delete a candidate (administrator token required) |

The status lookup currently uses email as its lookup value and returns only the status. For a public production deployment, add an ownership-verification step (such as a one-time code) before exposing registration status.

## Project layout

- `server.js` — Express server, API routes, and Supabase access
- `public/` — Frontend pages and browser JavaScript served by the server
- `supabase.sql` — Database table definitions
- `vercel.json` — Vercel deployment configuration

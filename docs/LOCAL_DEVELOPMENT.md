# Local Development Guide

## Project Structure

- **`src/`**: Contains the application source code.
  - **`src/server/db/`**: Contains the **application code** to connect to Supabase. This is where the Supabase client is initialized (`createClient`) for use in your API routes and React components.
- **`supabase/`**: Contains the **database infrastructure** definitions.
  - **`migrations/`**: SQL files that define your database schema changes over time.
  - **`config.toml`**: Supabase CLI configuration.

## Prerequisites

1.  **Node.js**: Ensure you have Node.js installed (v18+ recommended).
2.  **Docker**: Docker Desktop must be installed and running for local Supabase development.
3.  **Supabase Project**: You need a Supabase project (either in the cloud or running locally via Supabase CLI).

## Setup

1.  **Environment Variables**:
    Create a `.env.local` file in the root directory with your Supabase credentials:

    ```bash
    NEXT_PUBLIC_SUPABASE_URL=your_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    ```

    *   If using Supabase Cloud: Get these from Project Settings > API.
    *   If using Supabase Local: Run `npx supabase status` to see them.

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Database Setup**:
    *   **Migrations**: If you are setting up a fresh database, you might need to apply the schema.
        *   The schema is defined in `supabase/migrations` (or `schema.sql` in the artifacts).
        *   You can run migrations using the Supabase CLI: `npx supabase db reset` (local) or link to your remote project.
    *   **Seeding**: To populate the database with initial data (Organizations, Varieties, etc.):
        ```bash
        npx tsx scripts/seed-data.ts
        ```

## Running the Application

To start the Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Common Commands

- **`npm run build`**: Build the application for production.
- **`npm run lint`**: Run the linter.
- **`npx tsx scripts/seed-data.ts`**: Run the database seed script.

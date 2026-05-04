# Cowculator

Cowculator is a Vite + React herd-management app for buffalo fattening operations.

## Local development

```bash
npm install
npm run dev
```

## Supabase sync setup

This project now supports cross-device syncing through Supabase.

1. Create or open your Supabase project.
2. In the Supabase SQL Editor, run [supabase/schema.sql](./supabase/schema.sql).
3. Create a local `.env` file from [.env.example](./.env.example).
4. Start the app with `npm run dev`.

Required env vars:

```bash
VITE_SUPABASE_URL=https://yjoeegeuabldsrbzisku.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

## Deployment

The production app is deployed on Vercel. Once the Supabase SQL schema is applied, changes made on one PC will sync to the others using the shared Supabase state row.

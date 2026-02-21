# MetricsHub

SaaS metrics for indie hackers — Baremetrics, but $9/mo.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL with Drizzle ORM
- **Payments:** Stripe OAuth + Billing
- **Charts:** Recharts
- **Email:** Resend
- **Monorepo:** Turborepo + pnpm

## Project Structure

```
metricshub/
├── apps/
│   └── web/          # Next.js 14 frontend
├── packages/
│   ├── db/           # Drizzle ORM schema & client
│   └── config/       # Shared configuration
├── turbo.json        # Turborepo config
└── pnpm-workspace.yaml
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development
pnpm dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all apps and packages |
| `pnpm type-check` | Run TypeScript type checking |

# plan.fast

The fastest way to find when your group is free. Create a plan, share the link, everyone marks their availability, and the system finds the best overlap.

## How it works

1. **Create** — Name your plan, pick a date range, choose time slots or day blocks
2. **Share** — Send the link via WhatsApp, native share, or clipboard
3. **Mark** — Everyone taps/drags to mark when they're free or maybe
4. **Find** — Heatmap view highlights the best times for the group

No sign-up required. Works on any device.

## Tech stack

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 14 (App Router), Tailwind CSS 3, Framer Motion |
| **Backend** | Go (Chi router), SQLite (WAL mode), pure Go driver (modernc.org/sqlite) |
| **Auth** | Google OAuth + Apple Sign-In (optional, guest-first) |
| **Design** | Notion-inspired earthy palette — warm parchment, terracotta accents, sage greens |

## Project structure

```
planner/
├── backend/
│   ├── cmd/server/          # Entry point
│   ├── internal/
│   │   ├── config/          # Environment config
│   │   ├── db/              # SQLite connection + pragmas
│   │   ├── handler/         # HTTP handlers
│   │   ├── middleware/       # CORS, auth
│   │   ├── model/           # Domain types
│   │   ├── repository/      # Data access layer
│   │   ├── router/          # Chi route definitions
│   │   └── service/         # Business logic
│   └── migrations/          # SQL migrations
├── frontend/
│   └── src/
│       ├── app/             # Next.js pages + API proxy
│       ├── components/      # UI components
│       │   ├── auth/        # Google/Apple sign-in
│       │   ├── grid/        # Availability grid + cells
│       │   ├── heatmap/     # Group heatmap overlay
│       │   ├── layout/      # Header, theme toggle
│       │   ├── plan/        # Create form, plan view, share sheet
│       │   └── ui/          # Button, input, badge primitives
│       ├── hooks/           # useAuth, useAvailability, useGridInteraction
│       ├── lib/             # API client, types, utils, constants
│       └── providers/       # Theme + auth context
├── shared/
└── Makefile
```

## Getting started

### Prerequisites

- **Go** 1.24+
- **Node.js** 22+ (via nvm)
- **pnpm** (via corepack)

### Run locally

```bash
# Start both backend and frontend
make dev
```

Or run them separately:

```bash
# Backend (port 8080)
cd backend && go run ./cmd/server

# Frontend (port 3000)
cd frontend && pnpm install && pnpm dev
```

### Build

```bash
make build-backend    # → backend/bin/server
make build-frontend   # → frontend/.next/
```

### Test

```bash
make test-backend     # Go tests
make lint-backend     # Go vet
```

## API routes

All routes are under `/api`:

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/plans` | Create a new plan |
| `GET` | `/plans/:slug` | Get plan with participants |
| `POST` | `/plans/:slug/join` | Join as participant |
| `PUT` | `/plans/:slug/availability` | Update cell availability |
| `GET` | `/plans/:slug/heatmap` | Get group heatmap data |
| `POST` | `/plans/:slug/lock` | Lock plan (host only) |
| `POST` | `/auth/google` | Google OAuth sign-in |
| `POST` | `/auth/apple` | Apple sign-in |
| `GET` | `/auth/me` | Current user info |
| `GET` | `/health` | Health check |

## Architecture notes

- **API proxy**: Next.js catch-all route (`/api/[...path]`) proxies to Go backend — no CORS needed in production
- **SQLite WAL mode**: Single writer, production pragmas, zero external database dependencies
- **Grid interaction**: FSM handles tap, drag, and long-press with three states: free (sage green), maybe (amber), clear
- **Polling**: ETag-based, 3s plan / 5s heatmap, pauses when tab is hidden
- **Timezone handling**: All times stored as UTC, displayed in user's local timezone
- **Dark mode**: `next-themes` + CSS custom properties for instant switching

## License

Private.

# plan.fast

I built this because every time my friends and I try to plan something — a dinner, a trip, a movie — we go in circles. Someone drops a "let's do something this weekend" in the group chat. Twenty messages later, nobody knows when anyone's free, half the group hasn't replied, and the plan dies.

We've all been there. The plan doesn't fail because nobody wants to go. It fails because coordinating 6 people over text is pain.

**plan.fast** fixes that. One link. Everyone taps when they're free. Done.

## How it works

1. **Create a plan** — give it a name, pick dates, share the link
2. **Friends open the link** — no app download, no sign-up, just tap their name and join
3. **Everyone marks availability** — tap and drag on a grid, takes 10 seconds
4. **Best time surfaces automatically** — heatmap shows where the group overlaps

That's it. No back-and-forth. No "does Saturday work?" No forgotten plans.

## Three ways to plan

- **Pick times** — 30-minute slots throughout the day. For dinners, hangouts, meetings.
- **Pick days** — Morning, afternoon, or evening blocks. For trips, weekend plans.
- **Custom options** — Free-form poll. "9:45 PM show or 10:55 PM show?" For movies, restaurants, anything with fixed choices.

## The small things that matter

- **No sign-up required** — your friends will actually use it because there's zero friction
- **Works on any phone** — mobile-first, tap-and-drag grid that feels native
- **WhatsApp sharing** — one tap to drop the link in your group chat
- **Nudge people** — see who hasn't responded yet and poke them
- **Dark mode** — because not everything needs to be bright white at midnight

## Tech stack

For the curious:

| | |
|---|---|
| **Frontend** | Next.js 14, Tailwind CSS, Framer Motion |
| **Backend** | Go, Chi router, SQLite (WAL mode) |
| **Auth** | Google + Apple sign-in (optional) |
| **Design** | Notion-inspired, earthy palette |
| **Infra** | Zero external dependencies — no Redis, no Postgres, no queues |

## Run it yourself

```bash
# Prerequisites: Go 1.24+, Node 22+, pnpm

# Start everything
make dev

# Or separately
cd backend && go run ./cmd/server    # :8080
cd frontend && pnpm install && pnpm dev  # :3000
```

## Why I didn't just use when2meet

I tried. My friends took one look at the UI and closed the tab. If the tool is harder to use than the group chat, nobody will use it.

plan.fast is what when2meet would be if it was built in 2026 for people who plan things on their phones.

## License

Private.

# EMS Pro — Client

React 19 + Vite + TypeScript frontend for the EMS Pro Employee Management System.
See the **[root README](../README.md)** for full setup, documentation, and demo
accounts.

## Development

```bash
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:4000/api
npm run dev            # http://localhost:5173
```

## Scripts

| Script            | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start Vite dev server          |
| `npm run build`   | Type-check + production build  |
| `npm run preview` | Preview the production build   |
| `npm run lint`    | Run ESLint                     |

## Shared UI kit

Reusable primitives live in [`src/components/ui/index.tsx`](src/components/ui/index.tsx)
(`Button`, `Card`, `Badge`, `EmptyState`, `Field`, `Input`, `Select`, `Spinner`,
`Alert`) — prefer these over ad-hoc markup in feature pages.

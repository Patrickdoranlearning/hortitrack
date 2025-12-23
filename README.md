# Hortitrack

Horticultural production management system built with Next.js.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## UI Templates

Reusable component templates for consistent UI/UX. See [src/ui/templates/README.md](src/ui/templates/README.md).

```tsx
import { DataPage, ConfirmDialog, EmptyState, SearchInput } from '@/ui/templates'
```

### Storybook

View all templates with interactive examples:

```bash
npm run storybook
```

## Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # Feature components
│   └── ui/           # shadcn/ui components
├── ui/
│   └── templates/    # Reusable UI templates
├── lib/              # Utilities and types
├── hooks/            # Custom React hooks
└── config/           # App configuration
```

## Backend

Region: `us-central1` (matches Vertex). Don't change one without the other.

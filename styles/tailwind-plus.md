# Tailwind Plus Style Guide

Dark/charcoal marketing site implementation for Next.js + React + Tailwind CSS.

---

## Tech Stack

- Next.js App Router
- React Server Components + Client Components
- Tailwind CSS
- tailwindcss-animate (optional)
- Headless UI / Radix UI (accessible primitives)
- next/font for typography
- next/image for all images
- lucide-react for icons
- MDX (optional) for long-form content

---

## Project Structure

```
app/
  (plus)/
    plus/page.tsx
    plus/pricing/page.tsx
components/
  layout/
    SiteHeader.tsx
  ui/
    Button.tsx
lib/
  cn.ts
styles/
  globals.css
```

---

## Color Palette

Dark default with CSS variables:

| Token | Usage | Value |
|-------|-------|-------|
| `--bg` | App background | `#09090b` |
| `--surface` | Card background | `#0f172a` |
| `--surface-2` | Raised surface | `#111827` |
| `--border` | Borders/dividers | `rgba(255,255,255,0.08)` |
| `--text` | Primary text | `#e5e7eb` |
| `--muted` | Secondary text | `#94a3b8` |
| `--brand` | Primary accent | `#38bdf8` |
| `--brand-2` | Secondary accent | `#a78bfa` |
| `--success` | Success state | `#22c55e` |
| `--warn` | Warning state | `#f59e0b` |

---

## Visual Style

- Dark default / charcoal UI
- High contrast text
- Soft borders
- Subtle gradients
- Blurred glow effects
- Premium spacing
- Rounded-2xl cards/inputs

---

## Typography

Modern sans-serif (Inter) with clear weight steps:

| Level | Tailwind |
|-------|----------|
| Hero | `text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight` |
| Section | `text-2xl sm:text-3xl font-semibold` |
| Body | `text-base leading-7` |
| Small | `text-sm leading-6` |

---

## Layout

### Container

```
max-w-[80rem] px-4 sm:px-6 lg:px-8
```

### Section Spacing

```
py-16 sm:py-20 lg:py-24
```

### Grid Patterns

| Pattern | Tailwind |
|---------|----------|
| Hero split | `grid lg:grid-cols-2 gap-10 lg:gap-14` |
| Cards | `grid sm:grid-cols-2 lg:grid-cols-3 gap-6` |
| Feature list | `grid md:grid-cols-2 gap-x-10 gap-y-8` |
| Pricing | `grid lg:grid-cols-3 gap-6 items-start` |
| Footer | `grid sm:grid-cols-2 lg:grid-cols-4 gap-10` |

---

## Components

### Border Radius

```
rounded-xl rounded-2xl rounded-3xl
```

### Border Pattern

```
border border-white/10
```

### Button (Primary)

```tsx
<button className="inline-flex items-center justify-center rounded-full bg-gradient-to-b from-sky-400 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
  Get Tailwind Plus
</button>
```

### Navigation Header

```tsx
<header className="sticky top-0 z-50 backdrop-blur bg-zinc-950/40 border-b border-white/10">
  {/* nav content */}
</header>
```

### Hero Background Glow

```tsx
<div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%),radial-gradient(circle_at_bottom,rgba(167,139,250,0.16),transparent_55%)]" />
```

### Pricing Card (Featured)

```tsx
<div className="ring-1 ring-sky-400/40 bg-gradient-to-b from-sky-400/10 to-white/5 rounded-2xl p-6">
  {/* plan content */}
</div>
```

---

## Accessibility

- `focus-visible` rings on all interactive elements
- Correct button vs link usage
- Mobile menu keyboard-accessible
- Accordion uses `aria-controls`
- Color contrast for muted text

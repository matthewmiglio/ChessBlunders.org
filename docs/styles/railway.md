# Railway Style Guide

Dark-first marketing site implementation for Next.js + React + Tailwind CSS.

---

## Tech Stack

- Next.js 14+ (App Router)
- React 18 + TypeScript
- Tailwind CSS (+ tailwind-merge, clsx)
- Framer Motion (scroll reveals)
- Radix UI or shadcn/ui (dropdowns, dialogs)
- next/font (self-hosted)
- lucide-react (icons)

---

## Project Structure

```
src/
  app/
    (marketing)/
      page.tsx
      layout.tsx
      pricing/page.tsx
      docs/page.tsx
  components/
    marketing/
      Navbar.tsx
      Hero.tsx
      LogoCloud.tsx
      FeatureGrid.tsx
      CodeDemo.tsx
      Testimonials.tsx
      PricingPreview.tsx
      CTA.tsx
      Footer.tsx
    ui/
      Button.tsx
      Card.tsx
      Badge.tsx
      Container.tsx
      Section.tsx
      GradientText.tsx
  lib/
    cn.ts
    motion.ts
    constants.ts
  styles/
    globals.css
tailwind.config.ts
```

---

## Color Tokens

Dark-first HSL values:

```css
:root {
  --bg: 250 24% 9%;
  --bg-2: 250 21% 11%;
  --fg: 0 0% 100%;
}

body {
  background: hsl(var(--bg));
  color: hsl(var(--fg));
}
```

### Palette

| Token | HSL |
|-------|-----|
| `background` | `hsl(250 24% 9%)` |
| `secondaryBg` | `hsl(250 21% 11%)` |
| `foreground` | `hsl(0 0% 100%)` |
| `gray-50` | `hsl(248 21% 13%)` |
| `gray-100` | `hsl(246 18% 15%)` |
| `gray-200` | `hsl(246 11% 22%)` |
| `gray-300` | `hsl(246 8% 35%)` |
| `gray-400` | `hsl(246 7% 45%)` |
| `gray-500` | `hsl(246 6% 55%)` |
| `pink-500` | `hsl(270 60% 52%)` |
| `blue-500` | `hsl(220 80% 55%)` |
| `cyan-500` | `hsl(180 50% 44%)` |
| `green-500` | `hsl(152 38% 42%)` |
| `yellow-500` | `hsl(44 74% 52%)` |
| `red-500` | `hsl(1 62% 44%)` |

---

## Typography

Use Inter via `next/font/google`:

```tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

### Type Scale

| Level | Tailwind |
|-------|----------|
| Hero | `text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight` |
| Section | `text-2xl md:text-3xl font-semibold tracking-tight` |
| Body | `text-base md:text-lg text-white/80 leading-relaxed` |
| Labels | `text-xs uppercase tracking-widest text-white/60` |

---

## Layout

### Container

```tsx
export function Container({ children }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
      {children}
    </div>
  );
}
```

### Section Spacing

| Type | Tailwind |
|------|----------|
| Default | `py-16 md:py-24` |
| Hero/Major | `py-24 md:py-32` |
| Grid gap | `gap-6 md:gap-10` |

---

## Components

### Navbar

Sticky, semi-transparent blur, subtle border.

```tsx
<header className="sticky top-0 z-50">
  <div className="backdrop-blur-md bg-black/30 border-b border-white/10">
    <Container>
      <nav className="flex h-16 items-center justify-between">
        <div className="font-semibold">Railway</div>
        <div className="hidden md:flex gap-6 text-sm text-white/70">
          <a className="hover:text-white transition">Docs</a>
          <a className="hover:text-white transition">Pricing</a>
          <a className="hover:text-white transition">Blog</a>
        </div>
        <div className="flex items-center gap-3">
          <button className="hidden md:inline-flex px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15">
            Sign in
          </button>
          <button className="px-4 py-2 rounded-xl bg-white text-black font-medium">
            Start deploying
          </button>
        </div>
      </nav>
    </Container>
  </div>
</header>
```

### Hero

Two-column: left pitch + CTAs, right code/demo panel.

```tsx
<section className="py-24 md:py-32">
  <Container>
    <div className="grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight">
          Build and ship faster
        </h1>
        <p className="mt-6 text-base md:text-lg text-white/80 leading-relaxed">
          Instant deployments, managed infrastructure, and developer-first workflows.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button className="px-5 py-3 rounded-2xl bg-white text-black font-medium">
            Start a project
          </button>
          <button className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15">
            View docs
          </button>
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        {/* code snippet / image */}
      </div>
    </div>
  </Container>
</section>
```

### Feature Grid

2-3 columns with rounded cards, soft borders.

```tsx
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
  {features.map(f => (
    <div key={f.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 hover:bg-white/7 transition">
      <div className="text-sm text-white/60">{f.kicker}</div>
      <div className="mt-2 text-lg font-semibold">{f.title}</div>
      <p className="mt-2 text-sm text-white/70 leading-relaxed">{f.body}</p>
    </div>
  ))}
</div>
```

---

## Motion

Subtle: short durations, small transforms, scroll-triggered fades.

```ts
// lib/motion.ts
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};
```

Usage:

```tsx
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";

<motion.div
  initial="hidden"
  whileInView="show"
  viewport={{ once: true, amount: 0.2 }}
  variants={fadeUp}
>
  <h2 className="text-3xl font-semibold">Deploy in seconds</h2>
</motion.div>
```

---

## Responsive

### Breakpoints

| Name | Width |
|------|-------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |

### Patterns

- Navbar: collapse to menu drawer below md
- Hero: single-column stack below lg
- Feature grid: 1 col mobile, 2 col md, 3 col lg
- Padding: px-5 -> px-8 on md+
- Typography scales up on md/lg

---

## Accessibility

- All interactive elements keyboard reachable
- Visible focus rings: `focus-visible:outline`
- Color contrast: `text-white/80` for body, avoid low-contrast gray
- Respect `prefers-reduced-motion`
- Proper landmarks: `header`, `nav`, `main`, `footer`
- Descriptive CTA labels, `aria-label` for icon-only buttons

---

## Performance

- Use `next/image` for screenshots
- Preload critical fonts via `next/font`
- Keep hero SVG/gradients as CSS
- Avoid heavy Lottie on mobile; prefer CSS/Framer transitions
- Dynamic import for non-critical components

---

## Tailwind Config

```ts
export default {
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        bg2: "hsl(var(--bg-2))",
        fg: "hsl(var(--fg))",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
    },
  },
};
```

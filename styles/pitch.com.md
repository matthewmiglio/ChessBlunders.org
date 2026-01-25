# Pitch.com Style Guide

Marketing site implementation guide for Next.js + React.

---

## Design Principles

- Clean, high-contrast editorial layout
- Big headlines, generous whitespace
- Softly-rounded buttons/cards, subtle borders, minimal shadows
- Alternating text/media sections
- Subtle motion: fades, slides, scroll reveals, gentle hover lift

---

## Color Tokens

```css
:root {
  --bg: 0 0% 100%;           /* near-white */
  --fg: 240 10% 10%;         /* near-black */
  --muted: 240 4% 45%;       /* gray body copy */
  --border: 240 6% 90%;      /* light gray */
  --card: 0 0% 100%;         /* white */
  --brand: 258 90% 60%;      /* vivid accent */
  --brand-contrast: 0 0% 100%;
}
```

---

## Typography

- Single modern sans-serif (variable font preferred)
- Heavy weights for headlines, normal/medium for body

### Scale

| Level | Tailwind |
|-------|----------|
| Display | `text-5xl md:text-6xl font-semibold tracking-tight` |
| H1 | `text-4xl md:text-5xl font-semibold tracking-tight` |
| H2 | `text-3xl md:text-4xl font-semibold` |
| H3 | `text-xl md:text-2xl font-medium` |
| Body | `text-base md:text-lg text-[hsl(var(--muted))]` |
| Small | `text-sm` |

---

## Spacing & Layout

### Base Grid

8px increments: 8, 16, 24, 32, 48, 64...

### Max Widths

| Content Type | Width |
|--------------|-------|
| Marketing text | 720-820px |
| Media sections | 1100-1200px |

### Section Padding

| Screen | Padding |
|--------|---------|
| Desktop | 72-120px |
| Mobile | 48-72px |

### Border Radius

| Element | Radius |
|---------|--------|
| Buttons | 9999px (pill) or 12-16px |
| Cards | 16-24px |

---

## Breakpoints

| Name | Width |
|------|-------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |

---

## Layout Patterns

### Hero Grid
- Left: headline + copy + CTAs
- Right: product screenshot
- Single column on mobile (visual below CTAs)

### Logo Row
- Horizontal scroll on mobile
- Wrapped grid on desktop

### Alternating Feature Rows
- Two-column on lg
- Alternate media left/right

### Pricing Cards
- 3-4 columns on desktop
- Stacked on mobile
- Comparison table becomes accordions on mobile

### Sticky Header
```css
position: sticky;
top: 0;
backdrop-filter: blur(12px);
border-bottom: 1px solid var(--border);
```

---

## Components

### Button

```tsx
const button = cva(
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-[hsl(var(--brand))] text-[hsl(var(--brand-contrast))] hover:brightness-95",
        secondary: "bg-white border border-[hsl(var(--border))] hover:bg-black/5",
        ghost: "hover:bg-black/5",
        link: "underline-offset-4 hover:underline",
      },
      size: {
        sm: "px-4 py-2 text-sm",
        md: "px-5 py-2.5 text-sm",
        lg: "px-6 py-3 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);
```

### Section Shell

```tsx
function Section({ title, description, children }) {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-4 text-base md:text-lg text-[hsl(var(--muted))]">{description}</p>}
        </div>
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}
```

### Component Props Pattern

```tsx
type SectionProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  cta?: { label: string; href: string };
};
```

---

## Motion

### Micro-interactions
- Buttons: 150-200ms transitions, slight translate/brightness
- Cards: hover lift + border emphasis
- Links: underline reveal or color shift
- Nav: mega-menu fade + small vertical slide

### Scroll Animations
- `opacity: 0 -> 1`
- `y: 8-16px -> 0`
- Duration: 400-600ms
- Stagger children in grids

### Implementation
```tsx
// Use framer-motion + useInView
// Respect prefers-reduced-motion
```

---

## Project Structure

```
app/
  (marketing)/
    layout.tsx       // header/footer
    page.tsx         // home
    product/page.tsx
    pricing/page.tsx
    templates/page.tsx
    resources/page.tsx
  api/
  components/
  lib/
```

---

## Rendering Strategy

- Marketing pages: SSG/ISR (mostly static)
- Use `next/image` for logos/screenshots
- Aggressive caching

---

## Performance

- Defer below-the-fold media
- Preload hero image (don't block TTFB)
- Lightweight icon set
- Avoid heavy animation on mobile

---

## Accessibility

- Visible focus styles on all interactive controls
- Mega-menu: keyboard navigable (tab required)
- Drawer: focus trap + escape to close
- Pricing toggle: `role="tablist"` with proper tabs
- Motion: respect `prefers-reduced-motion`

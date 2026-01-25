# ChessPecker.org Style Guide

A comprehensive design system reference extracted from the ChessPecker codebase.

---

## 1. Color Palette

### Core Colors (Dark Theme - Always)

| Token | Value | Usage |
|-------|-------|-------|
| Background | `rgb(20, 20, 20)` / `#141414` | Page background |
| Foreground | `rgb(245, 245, 245)` / `#f5f5f5` | Primary text |
| Card | `rgb(32, 32, 32)` / `#202020` | Card backgrounds |
| Card Foreground | `rgb(245, 245, 245)` / `#f5f5f5` | Card text |

### Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `rgb(235, 235, 235)` / `#ebebeb` | Primary buttons |
| Primary Foreground | `rgb(32, 32, 32)` / `#202020` | Text on primary |
| Secondary | `rgb(60, 60, 60)` / `#3c3c3c` | Secondary elements |
| Secondary Foreground | `rgb(245, 245, 245)` / `#f5f5f5` | Text on secondary |

### Accent & Status Colors

| Color | Value | Usage |
|-------|-------|-------|
| Red (Primary Accent) | `rgb(244, 67, 54)` / `#f44336` | Main accent, highlights |
| Red Light | `rgb(255, 165, 165)` / `#fca5a5` | Light red accents |
| Orange | `rgb(255, 111, 0)` / `#ff6f00` | Warnings |
| Yellow | `rgb(255, 235, 59)` / `#ffeb3b` | Caution indicators |
| Green | `rgb(24, 190, 93)` / `#18be5d` | Success states |
| Blue | `rgb(66, 165, 245)` / `#42a5f5` | Information |
| Violet | `rgb(138, 43, 226)` / `#8a2be2` | Premium features |
| Indigo | `rgb(63, 81, 181)` / `#3f51b5` | Secondary accent |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| Muted | `rgb(60, 60, 60)` / `#3c3c3c` | Subdued backgrounds |
| Muted Foreground | `rgb(180, 180, 180)` / `#b4b4b4` | Secondary text |
| Border | `rgba(255, 255, 255, 0.1)` | Subtle borders |
| Input | `rgba(255, 255, 255, 0.15)` | Input backgrounds |
| Ring/Focus | `rgb(140, 140, 140)` / `#8c8c8c` | Focus rings |
| Popover | `rgb(32, 32, 32)` / `#202020` | Dropdown backgrounds |

### Progress Indicators

| Threshold | Color | Value |
|-----------|-------|-------|
| >= 80% | Green | `rgb(34, 197, 94)` |
| >= 60% | Yellow | `rgb(234, 179, 8)` |
| < 60% | Red | `rgb(239, 68, 68)` |
| Default | Gray | `rgb(156, 163, 175)` |

### Chess Board Themes

10 available themes:

1. **Classic Blue**: Dark `#5994EF`, Light `#F2F6FA`
2. **Traditional Brown**: Dark `#B58863`, Light `#F0D9B5`
3. **Forest Green**: Dark `#769656`, Light `#EEEED2`
4. **Ocean Blue**: Dark `#4A90A4`, Light `#FFFFFF`
5. **Purple Haze**: Dark `#9F7AEA`, Light `#E9D5FF`
6. **Sunset Orange**: Dark `#F97316`, Light `#FED7AA`
7. **Bubblegum Pink**: Dark `#EC4899`, Light `#FCE7F3`
8. **Neon Cyber**: Dark `#10B981`, Light `#1F2937`
9. **Lava Red**: Dark `#DC2626`, Light `#FEE2E2`
10. **Cosmic Purple**: Dark `#7C3AED`, Light `#1E1B4B`

---

## 2. Typography

### Font Families

| Type | Font | Usage |
|------|------|-------|
| Sans Serif | Inter + Geist Sans | Body text, UI elements |
| Serif | Playfair Display, Georgia | Logo, major headings |
| Monospace | Geist Mono | Code, technical labels |

### Font Sizes

| Name | Size | Usage |
|------|------|-------|
| Headline 1 | 1.875rem - 3rem (30-48px) | Page titles |
| Headline 2 | 1.5rem (24px) | Section headers |
| Headline 3 | 1.25rem (20px) | Subsections |
| Body | 1rem (16px) | Default text |
| Small | 0.875rem (14px) | Secondary info |
| XSmall | 0.75rem (12px) | Captions, labels |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Branding elements |
| Normal | 400 | Body text |
| Medium | 500 | Buttons, labels |
| Semibold | 600 | Headings, emphasis |
| Bold | 700 | Strong headings |

### Letter Spacing

| Type | Value | Usage |
|------|-------|-------|
| Normal | Default | Body text |
| Wide | 0.05em | Section headers |
| Wider | 0.08-0.1em | Navigation, labels |
| Widest | 0.25-0.3em | Uppercase, technical |

---

## 3. Component Patterns

### Buttons

**Variants:**

```css
/* Default */
bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs

/* Outline */
border border-input bg-input/30 hover:bg-input/50

/* Secondary */
bg-secondary text-secondary-foreground hover:bg-secondary/80

/* Destructive */
bg-destructive/60 text-white hover:bg-destructive/90

/* Ghost */
hover:bg-accent/50 hover:text-accent-foreground

/* Link */
text-primary underline-offset-4
```

**Sizes:**

| Size | Classes |
|------|---------|
| Default | `h-9 px-4 py-2` |
| Small | `h-8 px-3 gap-1.5 rounded-md` |
| Large | `h-10 px-6 rounded-md` |
| Icon | `size-9` (square) |

**Global Properties:**
- Border radius: `rounded-md` (0.375rem)
- Font weight: Medium
- Transition: `transition-all`
- Focus: Blue ring outline (3px)
- Disabled: `opacity-50 pointer-events-none`

### Cards

```css
/* Card Container */
bg-card text-card-foreground py-6 px-6 gap-6 shadow-sm

/* CardHeader */
auto-rows-min grid-rows-[auto_auto] gap-1.5 px-6

/* CardTitle */
font-semibold leading-none

/* CardDescription */
text-muted-foreground text-sm

/* CardContent */
px-6

/* CardFooter */
flex items-center px-6
```

### Inputs & Forms

```css
/* Input */
bg-input/30 border border-input px-3 py-1 h-9 rounded-md
focus-visible:ring-ring/50 focus-visible:ring-[3px]
placeholder:text-muted-foreground

/* Textarea */
bg-input/30 border border-input min-h-16

/* Label */
text-sm font-medium gap-2

/* Checkbox */
size-4 border border-input bg-input/30 rounded-[4px]
data-[state=checked]:bg-primary
```

### Badges

**Variants:**

```css
/* Default */
bg-primary text-primary-foreground hover:bg-primary/90

/* Secondary */
bg-secondary text-secondary-foreground hover:bg-secondary/90

/* Outline */
border text-foreground hover:bg-accent

/* Destructive */
bg-destructive/60 text-white hover:bg-destructive/90
```

**Base Properties:**
- Padding: `px-2 py-0.5`
- Font: `text-xs font-medium`
- Border radius: `rounded-md`

### Tabs

```css
/* TabsList */
bg-muted text-muted-foreground rounded-lg inline-flex

/* TabsTrigger */
px-2 py-1 text-sm font-medium
data-[state=active]:bg-input/30
data-[state=active]:text-foreground
data-[state=active]:shadow-sm
transition-[color,box-shadow]
```

---

## 4. Layout Patterns

### Root Layout

```css
/* Body */
flex flex-col min-h-screen

/* Main Content */
flex-1

/* Desktop Sidebar Offset */
lg:pl-64
```

### Page Container

```css
w-full px-6 flex flex-col items-center min-h-screen
bg-background text-foreground
```

### Sidebar Navigation (Desktop)

```css
fixed left-0 top-0 w-72 h-screen z-50
py-12 px-8
border-r with gradient
bg-gradient-to-b from-[#0a0a0a] to-[#111111]
```

### Mobile Navigation

```css
sticky top-0 z-50 lg:hidden
bg-gradient-dark
/* Collapsible with max-h transition (500ms ease-out) */
```

### Hero Sections

```css
bg-zinc-900
border-l-4 border-[theme-color]
p-10 md:py-32 md:px-16
w-[calc(100%+3rem)] -mx-6 /* Break container */
```

### Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Mobile | 0px | Default |
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop (sidebar shows) |
| `xl` | 1280px | Large screens |
| `2xl` | 1536px | Extra large |

---

## 5. Animations & Transitions

### Custom Keyframes

```css
/* Fade In */
@keyframes fade-in {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Duration: 1s ease-out */

/* Slide Up */
@keyframes slide-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Duration: 0.8s ease-out, delay 0.2s */

/* Float (Infinite) */
@keyframes float {
  0% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
  50% { transform: translateY(-20px) rotate(180deg); opacity: 0.8; }
  100% { transform: translateY(0) rotate(360deg); opacity: 0.3; }
}
/* Duration: 8s infinite ease-in-out */

/* Shimmer (Loading) */
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
/* Duration: 2s infinite ease-in-out */
```

### Transition Durations

| Duration | Usage |
|----------|-------|
| 150ms | Button press |
| 300ms | Modal open/close |
| 500ms | Menu collapse |
| 700ms | Navigation |

### Radix UI Animations

```css
data-[state=open]:animate-in
data-[state=closed]:animate-out
fade-in-0 fade-out-0
zoom-in-95 zoom-out-95
slide-in-from-top-2
```

---

## 6. Design Tokens (CSS Variables)

### Border Radius

```css
--radius: 0.625rem;      /* 10px - Base */
--radius-sm: 6px;        /* calc(var(--radius) - 4px) */
--radius-md: 8px;        /* calc(var(--radius) - 2px) */
--radius-lg: 10px;       /* var(--radius) */
--radius-xl: 14px;       /* calc(var(--radius) + 4px) */
```

---

## 7. Special Styling Patterns

### Glow Effects

```css
/* Text Glow */
text-shadow: 0 0 20px rgba(color, 0.2);

/* Icon Glow */
filter: drop-shadow(0 0 8px rgba(color, 0.3-0.8));

/* Box Glow */
box-shadow: 0 0 12px rgba(color, 0.6);
```

### Carbon-style Technical UI

```css
bg-zinc-900 bg-zinc-800
font-mono text-xs uppercase tracking-[0.25em]
border-l-4 /* Colored accent */
```

### Blog Prose Styling

- Blockquotes: Red left border (4px), gradient background
- Tables: Gradient red header, separate borders
- Headings: h2 with red left border, h3 with red text
- Code: Red background tint, red syntax

### Notification Badges

```css
/* Position */
-top-1 -right-1

/* Style */
bg-red-500 text-white text-xs
rounded-full

/* Glow */
box-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
```

---

## 8. Icon System

### Library
- **Source**: lucide-react
- Import individually

### Sizes

| Size | Classes |
|------|---------|
| Default | `size-4` (w-4 h-4) |
| Small | `size-3`, `size-3.5` |
| Large | `w-5 h-5`, `w-6 h-6` |

### Common Icons Used
Home, Puzzle, Plus, BarChart3, Trophy, User, Crown, Info, BookOpen, MessageSquare, Menu, X, ChevronLeft, ChevronRight, CheckIcon, Copy, Eye, Play, RotateCcw, ArrowRight, Volume2, Palette

---

## 9. Focus & Accessibility

### Focus Visible

```css
focus-visible:border-ring
focus-visible:ring-ring/50
focus-visible:ring-[3px]
```

### Error States

```css
aria-invalid:ring-destructive/40
aria-invalid:border-destructive
```

### Disabled States

```css
disabled:pointer-events-none
disabled:opacity-50
disabled:cursor-not-allowed
```

---

## 10. Technology Stack

- **Framework**: Next.js 15 + React 19
- **Components**: shadcn/ui (customized)
- **Primitives**: Radix UI
- **Styling**: Tailwind CSS 4 with CSS variables
- **Icons**: lucide-react
- **Utilities**: clsx, tailwind-merge (cn function)
- **Motion**: framer-motion
- **Charts**: recharts

---

## 11. File Structure

```
src/
  app/
    globals.css       # Root styles, themes, animations
    layout.tsx        # Root layout with navbar
    page.tsx          # Home page
  components/
    ui/               # Base UI (button, card, input, etc.)
    header-footer/    # Navigation and footer
    home-page/        # Home sections
    puzzles/          # Puzzle components
    dashboard-page/   # Analytics
  lib/
    utils.ts          # cn() utility
  types/              # TypeScript definitions
```

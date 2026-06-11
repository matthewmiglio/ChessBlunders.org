# Chess.com Style Guide

Design system for React + Next.js, extracted from Chess.com's interface.

---

## Color Palette

### Primary (Green)

| Token | Hex | Usage |
|-------|-----|-------|
| `chess-green` | `#81B64C` | Primary actions, success, highlights |
| `chess-green-dark` | `#5D9948` | Hover states |
| `chess-green-darker` | `#468254` | Active states |
| `chess-green-darkest` | `#2c6415` | Button hover/active |

### Backgrounds (Dark Mode)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg` | `#312E2B` | Main app background |
| `bg-alt` | `#302E2B` | Theme color |
| `card` | `#262421` | Cards, panels |
| `surface` | `#21201D` | Sidebar, navigation |

### Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#81B64C` | Win, positive |
| `error` | `#FA412D` | Loss, errors |
| `warning` | `#F0A000` | Warnings, draw |
| `info` | `#1f96db` | Links |

### Move Quality (Analysis)

| Token | Hex |
|-------|-----|
| `brilliant` | `#1BACA6` |
| `great` | `#5C8BB0` |
| `best` | `#9EBC5A` |
| `good` | `#A3BF7F` |
| `inaccuracy` | `#F7C631` |
| `mistake` | `#E6912C` |
| `blunder` | `#CA3431` |
| `miss` | `#DBAC16` |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `text-primary` | `#FFFFFF` | Main text |
| `text-secondary` | `#A0A0A0` | Muted, labels |
| `text-tertiary` | `#757575` | Disabled |

---

## Typography

### Font Stack

```css
--font-primary: 'Chess Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

### Type Scale

| Size | px | Usage |
|------|-----|-------|
| `x-small` | 11px | Badges |
| `small` | 12px | Captions |
| `medium` | 14px | Body (default) |
| `large` | 16px | Navigation |
| `x-large` | 18px | Subheadings |
| `2x-large` | 24px | Section headings |
| `3x-large` | 32px | Page titles |

### Weights

- Regular: `400`
- Medium: `500`
- Bold: `700`
- Extra Bold: `800`

---

## Spacing

4px base grid:

| Token | Value |
|-------|-------|
| `1` | 4px |
| `2` | 8px |
| `3` | 12px |
| `4` | 16px |
| `5` | 20px |
| `6` | 24px |
| `8` | 32px |
| `10` | 40px |
| `12` | 48px |
| `16` | 64px |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 2px | Badges |
| `md` | 4px | Buttons, inputs |
| `lg` | 8px | Cards |
| `xl` | 12px | Modals |
| `full` | 9999px | Pills, avatars |

---

## Layout

```
+--------------------------------------------------+
|                     Header                        |
+--------+-----------------------------------------+
| Side-  |           Main Content                  |
|  bar   |                                         |
| (240px)|                                         |
+--------+-----------------------------------------+
```

- **Sidebar**: 240px, collapsible
- **Max Content**: 1200px (with ads), 960px (no ads)
- **Chessboard**: Always square, responsive

### Breakpoints

| Name | Width |
|------|-------|
| Mobile | < 768px |
| Tablet | 768px - 1024px |
| Desktop | > 1024px |

---

## Components

### Button

```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'small' | 'medium' | 'large';
}
```

| Size | Padding | Font |
|------|---------|------|
| small | 6px 12px | 12px |
| medium | 8px 16px | 14px |
| large | 12px 24px | 16px |

### Avatar

Sizes: 16, 24, 32, 48, 64px

### Icons

Sizes: 16, 20, 24, 32px

Common categories:
- **Game Types**: bullet, blitz, rapid, daily
- **Navigation**: play, puzzle, lessons, training, watch, friends
- **Game Status**: win (+), loss (-), draw (=)

---

## Z-Index

| Layer | Value |
|-------|-------|
| Dropdown | 100 |
| Sticky | 200 |
| Modal Backdrop | 1000 |
| Modal | 1001 |
| Tooltip | 1100 |
| Toast | 1200 |

---

## Animations

```css
/* Default transition */
transition: 0.1s ease;

/* Loading spinner */
animation: spin 1s linear infinite;

/* Skeleton */
animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
```

---

## Accessibility

```css
*:focus-visible {
  outline: 2px solid #1f96db;
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Tailwind Config

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        'chess-green': {
          DEFAULT: '#81B64C',
          500: '#5D9948',
          600: '#468254',
          700: '#2c6415',
        },
        'chess-dark': {
          DEFAULT: '#312E2B',
          100: '#3D3A37',
          200: '#312E2B',
          300: '#262421',
          400: '#21201D',
        },
        'chess-red': '#FA412D',
        'chess-gold': '#ECAC2D',
      },
    },
  },
}
```

---

## Chessboard Theme

```css
:root {
  --board-light: #EEEED2;
  --board-dark: #769656;
  --highlight-move: rgba(255, 255, 0, 0.4);
  --highlight-check: rgba(255, 0, 0, 0.5);
}
```

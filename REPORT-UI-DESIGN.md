# Football GM — UI/UX Design Improvement Plan

**Aesthetic Direction:** Editorial / Sports Magazine  
**Inspiration:** The Athletic, ESPN Analytics, The Ringer, FourFourTwo

---

## 1. Current State Analysis

### Architecture

| Aspect | Current |
|--------|---------|
| Framework | React 18 + Vite 5 |
| Component Library | Mantine 7.15 (all styling via props) |
| Routing | TanStack Router (file-based-ish, lazy-loaded pages) |
| State | TanStack React Query (staleTime: 30s, retry: 1) |
| Charts | Recharts 3.8 (BarChart only) |
| Icons | Tabler Icons 3.44 |
| CSS Files | **ZERO** — 100% Mantine inline props |
| Dark Mode | Forced dark via `defaultColorScheme="dark"` |
| Fonts | Inter (system default via theme.ts) |

### Page Inventory (17 screens)

| Page | Lines | Complexity | Purpose |
|------|-------|------------|---------|
| GamesPage | 144 | Low | Game list + create form |
| GameLayout | 250 | Med | Shell: header stats + 13-tab nav |
| DashboardPage | 498 | High | Preseason / in-season actions, standings, fixtures |
| TeamsPage | 63 | Low | Simple team table |
| TeamDetailPage | 177 | Med | Team card + squad table + trajectory |
| FederationPage | 80 | Low | Federation card + divisions table |
| FederationsPage | 71 | Low | All federations table |
| MarketPage | 106 | Med | Market teams table with negotiation buttons |
| NegotiationsPage | 88 | Low | Negotiation history table |
| StructurePage | 279 | Med-High | Division grid + format toggle + create team |
| EconomyPage | 407 | High | Treasury, contracts, policy, compliance chart |
| EventsPage | 223 | Med | Pending events + recent events |
| CupsPage | 261 | Med-High | Cup creation form + cup results |
| NormsPage | 344 | Med-High | Norm definition + breaches + sanctions |
| TransfersPage | 139 | Med | Transfer window + history |
| PrizesPage | 383 | Med-High | Prize pools + payments |
| HistoryPage | 215 | Med | Season records + palmarés + awards + chart |

### Component Breakdown

- **Charts:** `PalmaresChart.tsx` (61 lines) — horizontal bar chart of titles per team  
  `EconomyChart.tsx` (53 lines) — vertical bar chart of financial summary
- **Layout:** `GameLayout.tsx` — Paper header with stats + horizontal Tabs (13 tabs)
- **Shared pattern:** Every page follows: `Paper withBorder p="md" mb="md"` → title → table/form

### Key Observations

1. **Zero CSS files** — everything is `px`, `py`, `mb`, `fw`, `c="dimmed"` via Mantine props. No custom properties, no gradients, no shadows beyond defaults.
2. **Flat visual hierarchy** — all Cards and Papers look identical. No elevation system. No distinction between primary content, secondary panels, and tertiary data.
3. **Tables are spreadsheet-grade** — `Table striped highlightOnHover` with no row density control, no alignment system, no visual weight for important columns.
4. **No branding** — the header is `<Anchor>Football GM</Anchor>` in bold Inter. No logo, no tagline, no identity.
5. **Charts use raw Mantine CSS variables** — colors are `var(--mantine-color-green-5)` etc. No custom chart palette.
6. **No animations whatsoever** — no page transitions, no hover effects, no loading shimmer beyond basic Skeleton.
7. **Inter font is generic** — the design document explicitly calls this out as looking "like an admin panel."
8. **Badge usage is inconsistent** — some badges show tier, some show prestige, some show counts, all with different sizes and colors.
9. **13 tabs is overwhelming** — the horizontal tab bar overflows on mobile and becomes icon-only with tooltips.
10. **Money values have no visual treatment** — `+1.2 M€` and `−3.5 M€` look identical except for a minus sign.

---

## 2. Design Direction: Editorial / Sports Magazine

### 2.1 Typography

| Role | Font | Weight | Size | Source |
|------|------|--------|------|--------|
| Display / Headlines | **Plus Jakarta Sans** | 800 | 32–48px | Google Fonts |
| Section Headings | **Plus Jakarta Sans** | 700 | 20–28px | Google Fonts |
| Body / UI Text | **DM Sans** | 400–500 | 14–16px | Google Fonts |
| Data / Numbers | **Geist Mono** | 500–600 | 13–15px | Self-hosted or CDN |
| Captions / Labels | **DM Sans** | 500 | 11–12px | Google Fonts |

**Why these fonts:**
- **Plus Jakarta Sans** has the editorial gravitas of a magazine masthead. Its extra-bold weight feels like a sports headline.
- **DM Sans** is clean, geometric, and slightly more characterful than Inter. It has excellent readability in data-dense UIs.
- **Geist Mono** is a modern monospace designed for code and data. Numbers align perfectly and it has a distinctive "analytics dashboard" feel.

**Font loading approach:**
```html
<!-- index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

### 2.2 Color Palette

#### Base (Dark Surface System)

The editorial look uses **layered dark tones** — not a flat dark background. Think of a magazine spread: dark page, lighter content panels, bright accent for pull quotes and highlights.

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#0B0F14` | Page background (darkest) |
| `--bg-surface` | `#111820` | Card / Panel background |
| `--bg-elevated` | `#1A2332` | Elevated card, hover state, active tab |
| `--bg-inset` | `#0D1219` | Inset panels, table row alternation |
| `--bg-overlay` | `rgba(17,24,32,0.85)` | Modal overlays |

#### Text System

| Token | Hex | Usage |
|-------|-----|-------|
| `--text-primary` | `#F0F2F5` | Headlines, key numbers |
| `--text-secondary` | `#A0AEC0` | Body text, descriptions |
| `--text-tertiary` | `#5A6A7A` | Labels, captions, timestamps |
| `--text-inverse` | `#0B0F14` | Text on bright backgrounds |

#### Brand Colors

| Token | Hex | Name | Usage |
|-------|-----|------|-------|
| `--accent-primary` | `#10B981` | Emerald | Primary actions, positive values, wins |
| `--accent-gold` | `#F59E0B` | Amber | Prestige, trophies, gold, Tier badge |
| `--accent-danger` | `#EF4444` | Red | Errors, losses, red cards, salary breaches |
| `--accent-blue` | `#3B82F6` | Blue | Info, neutral actions, draw results |
| `--accent-purple` | `#8B5CF6` | Violet | Impulse/Commissioner power, special actions |
| `--accent-orange` | `#F97316` | Orange | Warnings, suspensions, events |

#### Semantic Data Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--data-income` | `#10B981` | Positive cash flow |
| `--data-expense` | `#F87171` | Negative cash flow |
| `--data-neutral` | `#6B7280` | Net zero, neutral |
| `--data-highlight` | `#FBBF24` | Chart emphasis, current position |

### 2.3 Spacing & Layout System

Mantine's default spacing scale (xs–xl) is too coarse for the density needed. Use these multipliers:

| Mantine Token | Pixel Value | Usage |
|---------------|-------------|-------|
| `xxs` (custom) | `2px` | Tight internal padding (badge gaps) |
| `xs` | `4px` | Icon-to-text gap, compact element spacing |
| `sm` | `8px` | Default internal gaps |
| `md` | `16px` | Card padding, section separation |
| `lg` | `24px` | Major section breaks |
| `xl` | `32px` | Page-level padding |
| `xxl` (custom) | `48px` | Hero sections, page tops |

**Content density strategy:**
- **Tables:** `size="xs"` default, `pt={2}` `pb={2}` on cells for tight rows. Data-dense tables (standings, squad) get even tighter.
- **Cards:** `p="lg"` for primary content cards, `p="md"` for secondary panels, `p="sm"` for inline stats.
- **Page container:** `size="xl"` (wider than current `lg`) to give tables room.
- **Section gaps:** `gap="xl"` between major page sections, `gap="md"` between subsections.

### 2.4 Data Visualization Philosophy

Tables and charts should feel like **infographics**, not spreadsheets:

**Tables:**
- Right-align ALL numeric columns (already done — keep)
- Left-align ALL text columns (already done — keep)
- Use **Geist Mono** for all numeric cells
- Color-code: wins in emerald, losses in red, draws in blue
- Goal difference: `+5` in green, `-3` in red, `0` in dimmed
- Points column: bold + larger font + subtle background highlight for top 3
- Position column: top 3 get gold/silver/bronze dot indicators
- Row hover: subtle left border accent (2px emerald on hover)

**Charts:**
- Replace default Recharts tooltip with custom styled tooltip matching the dark surface palette
- Bar charts: rounded corners (`radius={[4,4,0,0]}`), gradient fills
- Add subtle grid lines: `stroke="rgba(255,255,255,0.05)"` for horizontal guides
- X/Y axis text in tertiary color, monospace font
- Chart entrance animation: bars grow from zero with `animation: fadeInUp 0.6s ease-out`

**Number treatment:**
- Key numbers (prestige, treasury, goals) get `font-family: 'Geist Mono'` and a subtle glow effect on large values
- Currency values: always with sign (+ green / − red), formatted as `1.2 M€` not `1,200,000 €`
- Trend indicators: small up/down arrows next to values where comparison exists

### 2.5 Component Style Targets

| Component | Current | Target |
|-----------|---------|--------|
| Card | `withBorder radius="md"` | Subtle gradient border, left accent stripe on hover, shadow: `0 1px 3px rgba(0,0,0,0.3)` |
| Paper | `withBorder p="md"` | `bg="var(--bg-surface)"`, subtle border `1px solid rgba(255,255,255,0.06)` |
| Table | `striped highlightOnHover` | Custom row styles, monospace numbers, color-coded cells |
| Badge | `variant="light"` | Pill shape, subtle gradient or solid fill, uppercase text |
| Button | `radius="md"` | Slightly rounded (`radius="lg"`), subtle shadow, gradient for primary actions |
| Tabs | Horizontal list | **Replace with vertical sidebar nav** or segmented control for <8 tabs |
| Alert | `color="orange"` | Left-bordered panel with icon, softer background |
| Skeleton | Basic rectangle | Shimmer animation with gradient sweep |
| TextInput | Default | Custom border glow on focus |
| NumberInput | Default | Monospace font, right-aligned |

---

## 3. Page-by-Page Recommendations

### 3.1 GamesPage (Home)

**Priority: HIGH**

| Change | Details |
|--------|---------|
| **Branding hero** | Replace `<Title order={2}>Football GM</Title>` with a masthead: logo placeholder (shield icon) + "FOOTBALL GM" in Plus Jakarta Sans 800 at 40px + tagline in DM Sans italic |
| **Background** | Full-viewport gradient from `--bg-base` to `--bg-surface` |
| **Create form** | Redesign as a "New Game" card with prominent gradient border (emerald→blue), larger input fields, bold CTA button |
| **Saved games** | Each game as a Card with left accent color (based on prestige tier), not a flat table row |
| **Empty state** | Illustration placeholder + inviting copy in editorial tone |
| **Page transition** | Fade-in from black on mount |

### 3.2 GameLayout (Shell)

**Priority: HIGH**

| Change | Details |
|--------|---------|
| **Header redesign** | Replace flat Paper with a full-width header bar: left = federation crest (placeholder shield) + name + tier badge; right = stat pills (Season, Prestige, Matchday, Impulses) |
| **Stat pills** | Each stat as a compact Card with monospace value + label below. Prestige gets gold accent. Impulses get purple accent. |
| **Tab navigation** | **Replace horizontal Tabs with a vertical sidebar** on desktop (left column, 200px wide), bottom tab bar on mobile. The 13 horizontal tabs overflow and look cluttered. |
| **Tab groupings** | Group tabs: Overview (Dashboard), Management (Teams, Federations, Market, Negotiations), Operations (Structure, Economy, Norms, Events), Competitions (Cups, Prizes), Archive (Transfers, History) |
| **Active tab indicator** | Left border accent (2px emerald) instead of Mantine's default underline |
| **Logo/header height** | Fixed at 72px on desktop, 56px on mobile |
| **Container** | Increase from `size="lg"` to `size="xl"` — tables need more room |

### 3.3 DashboardPage

**Priority: HIGH**

| Change | Details |
|--------|---------|
| **Preseason hero** | Full-width gradient card (dark → emerald tint) with checklist items as styled cards, not a flat List |
| **Action buttons** | "Advance Matchday" becomes a large prominent CTA (gradient emerald, 48px height). "Advance Season" and "Close Season" are secondary buttons. |
| **Standings table** | Add position number styling: 1st = gold circle, 2nd = silver circle, 3rd = bronze circle. Team names as bold links. Points column gets a subtle right-border accent. |
| **Fixtures section** | Each match as a mini-card with team names left/right, "vs" center in monospace, impulse buttons styled as flag icons |
| **Alert banners** | Redesign as left-bordered panels with icon, not full-width colored alerts |
| **Cup fixtures** | Show as a bracket-style layout (even if simplified: left team → right team with winner advancing) |
| **Page entrance** | Staggered fade-in: header → actions → alerts → standings (100ms delay each) |

### 3.4 TeamsPage

**Priority: MEDIUM**

| Change | Details |
|--------|---------|
| **Page title** | Add icon + section label above table (consistent with other pages) |
| **Table rows** | Add team strength as a mini bar (colored inline bar from 0–100). Prestige as a gold-tinted number. |
| **Row hover** | Left border accent (2px emerald) on hover |
| **Division grouping** | Group teams by division with section headers instead of a flat list |
| **Strength visualization** | Small horizontal bar next to the number: `████████░░ 80` style using a colored div |
| **Page transition** | Fade-in on mount |

### 3.5 TeamDetailPage

**Priority: HIGH**

| Change | Details |
|--------|---------|
| **Hero card** | Full-width card with team name as Plus Jakarta Sans 800, federation + division as badges, gradient background tint |
| **Attribute grid** | Each attribute in a mini-card with icon, label, and large monospace value. Strength gets a gauge-like visual (circular progress or bar). |
| **Squad table** | Position column color-coded (GK=yellow, DEF=blue, MID=green, FWD=red). Quality as a colored badge. Suspension/injury status as left-border accent (red/orange). |
| **Trajectory table** | Each row shows year + position as a mini trend chart (up/down arrow). If 3+ seasons, show as a sparkline. |
| **Club structure section** | Academy/medical/scouts/coach ratings shown as 4 small circular progress indicators or rating bars (like FIFA-style) |
| **Money formatting** | Presupuesto in Geist Mono with currency color |

### 3.6 FederationPage

**Priority: MEDIUM**

| Change | Details |
|--------|---------|
| **Hero card** | Federation name as headline, tier badge prominent (gold background + dark text), prestige as large monospace number |
| **"Your federation" indicator** | Distinct badge with accent stripe, not just `<Badge>Tu federación</Badge>` |
| **Divisions table** | Add visual hierarchy: top division gets a subtle gold tint. Team count vs plazas shown as a filled/unfilled bar. |
| **Empty state** | More descriptive, editorial tone |

### 3.7 FederationsPage

**Priority: MEDIUM**

| Change | Details |
|--------|---------|
| **Player federation row** | Highlight with left accent (gold) + bold + slight background tint |
| **Tier column** | Use badge with tier-colored background (tier 1 = gold, tier 5 = gray) |
| **Prestige column** | Monospace font, with a bar visualization |
| **Comparison view** | Add a "vs your federation" indicator showing the gap |

### 3.8 MarketPage

**Priority: MEDIUM**

| Change | Details |
|--------|---------|
| **Arraigo visualization** | Replace flat badge with a colored bar: green (easy) → yellow (medium) → red (hard). The current color mapping is correct but the bar makes it more visual. |
| **Tier column** | Colored badge matching federation tier system |
| **Negotiation button** | Only show when negotiation is actually possible (currently always shown) |
| **Empty state** | More editorial, explain what to do |
| **Card header** | Add tier badge + explanation panel styled like a sports article pullquote |

### 3.9 NegotiationsPage

**Priority: MEDIUM**

| Change | Details |
|--------|---------|
| **Timeline visualization** | Show negotiation lifecycle as a horizontal timeline with dots for each phase (gathering → offer → accepted → effective) |
| **State badges** | Each state gets a distinct icon + color treatment, not just colored text |
| **Active vs completed** | Separate active negotiations from completed/rejected with section headers |
| **Empty state** | Editorial guidance with link to Market page |

### 3.10 StructurePage

**Priority: MEDIUM**

| Change | Details |
|--------|---------|
| **Division cards** | Each division as a styled card with colored header (gradient based on division level). Top division = gold header, lower = gray. |
| **Team rows in divisions** | Add strength as bar, arraigo as color indicator |
| **Pending teams** | Alert styled as a highlighted card with integration status |
| **Create team form** | Redesign as a prominent call-to-action card with cost visualization (5M€ shown as a declining treasury bar) |
| **Format toggle** | Styled segmented control with visual icons for "one way" vs "two way" |

### 3.11 EconomyPage

**Priority: HIGH**

| Change | Details |
|--------|---------|
| **Treasury hero** | Large monospace number (32px+) with color (green if positive, red if negative). Financial health badge as a pill with gradient. |
| **Last season breakdown** | Income row in green with up-arrow, expenses in red with down-arrow, net as bold summary. Each row gets a small bar visualization. |
| **Policy section** | NumberInput with large monospace display, step buttons more prominent |
| **Contracts table** | Type column with colored badges, value in monospace |
| **Offers table** | Highlight "Firmar" button with gradient fill |
| **Compliance table** | Color-coded status: green "Cumple" vs red "Excede" with delta shown |
| **Chart** | Custom styled Recharts with dark theme, rounded bars, gradient fills, custom tooltip |
| **Money formatting** | All values in Geist Mono with + (green) / − (red) prefix |

### 3.12 EventsPage

**Priority: MEDIUM**

| Change | Details |
|--------|---------|
| **Pending events** | Each event as a styled card with colored left border based on type (arbitral = orange, fan = red, declarations = purple) |
| **Action buttons** | "Actuar" = blue gradient, "Ignorar" = subtle gray. Show cost implications as inline text. |
| **Resolved events** | Muted styling, collapsible section |
| **Count badge** | Animated pulse effect on the pending count badge |
| **Event type icons** | Use distinct icons per event type (whistle for arbitral, users for fan, mic for declarations) |

### 3.13 CupsPage

**Priority: MEDIUM**

| Change | Details |
|--------|---------|
| **Cup cards** | Each cup as a prominent card with trophy icon, status badge, champion highlight |
| **Match results** | Score centered in large monospace font, winning team highlighted |
| **Round headers** | Styled as section dividers with "ROUND 1", "SEMI-FINALS", "FINAL" typography |
| **Create form** | Multi-step wizard feel with progress indicator |
| **Champion badge** | Gold gradient background + trophy icon |

### 3.14 NormsPage

**Priority: LOW**

| Change | Details |
|--------|---------|
| **Norm cards** | Each active norm as a mini-card with type icon + value + action button |
| **Breach visualization** | Show actual/limit as a progress bar (green if under, red if over) |
| **Sanction history** | Muted table with red accent for severity |
| **Gavel icon** | Use for sanctions section header |

### 3.15 TransfersPage

**Priority: LOW**

| Change | Details |
|--------|---------|
| **Transfer cards** | Each transfer as a mini-card: player name (bold) → arrow → destination team. Quality as a badge. |
| **Year selector** | Styled segmented control with year buttons |
| **History summary** | Bar chart of transfers per year |
| **Empty state** | Editorial note about preseason transfers |

### 3.16 PrizesPage

**Priority: LOW**

| Change | Details |
|--------|---------|
| **Prize cards** | League and Cup prize sections as styled cards with pool amount in large monospace |
| **Share visualization** | Show percentage distribution as a horizontal stacked bar |
| **Payment history** | Table with year/competition/team/amount, sorted chronologically |
| **Amount formatting** | All in Geist Mono, with color coding |

### 3.17 HistoryPage

**Priority: MEDIUM**

| Change | Details |
|--------|---------|
| **Season records** | Each record as a mini-card with year (large), champion (bold link), division badge |
| **Palmarés** | Trophy count shown as stacked medals/icons, not just a number |
| **Awards** | Award badges with distinct icons (boot for top scorer, glove for best keeper, etc.) |
| **Top scorers** | Leaderboard-style: 1st/2nd/3rd highlighted, rest in standard table |
| **PalmaresChart** | Custom chart with team-colored bars, trophy icons on top |

---

## 4. Design System

### 4.1 `design-tokens.ts`

Create `apps/frontend/src/design-tokens.ts`:

```typescript
export const tokens = {
  colors: {
    bg: {
      base: '#0B0F14',
      surface: '#111820',
      elevated: '#1A2332',
      inset: '#0D1219',
    },
    text: {
      primary: '#F0F2F5',
      secondary: '#A0AEC0',
      tertiary: '#5A6A7A',
    },
    accent: {
      primary: '#10B981',
      gold: '#F59E0B',
      danger: '#EF4444',
      blue: '#3B82F6',
      purple: '#8B5CF6',
      orange: '#F97316',
    },
    data: {
      income: '#10B981',
      expense: '#F87171',
      neutral: '#6B7280',
      highlight: '#FBBF24',
    },
  },
  fonts: {
    display: '"Plus Jakarta Sans", sans-serif',
    body: '"DM Sans", sans-serif',
    mono: '"Geist Mono", monospace',
  },
  spacing: {
    xxs: '2px',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px rgba(0,0,0,0.3)',
    md: '0 4px 6px rgba(0,0,0,0.3)',
    lg: '0 10px 15px rgba(0,0,0,0.4)',
    glow: {
      emerald: '0 0 20px rgba(16,185,129,0.15)',
      gold: '0 0 20px rgba(245,158,11,0.15)',
      red: '0 0 20px rgba(239,68,68,0.15)',
    },
  },
  transitions: {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '400ms ease-out',
  },
} as const;
```

### 4.2 Extended Mantine Theme

```typescript
// theme.ts — extended version
import { createTheme, type MantineThemeOverride } from '@mantine/core';

export const theme: MantineThemeOverride = createTheme({
  primaryColor: 'accent',
  primaryShade: { light: 5, dark: 5 },
  colors: {
    accent: [
      '#D1FAE5', '#A7F3D0', '#6EE7B7', '#34D399', '#10B981',
      '#059669', '#047857', '#065F46', '#064E3B', '#022C22',
    ],
    gold: [
      '#FFFBEB', '#FEF3C7', '#FDE68A', '#FCD34D', '#FBBF24',
      '#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F',
    ],
    dark: [
      '#C1C2C5', '#A6A7AB', '#909296', '#5c5f66', '#373A40',
      '#2C2E33', '#1A2332', '#111820', '#0B0F14', '#070A0E',
    ],
  },
  fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: '"Geist Mono", "SF Mono", "Fira Code", monospace',
  headings: {
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '36px', lineHeight: '1.2', fontWeight: '800' },
      h2: { fontSize: '28px', lineHeight: '1.25', fontWeight: '700' },
      h3: { fontSize: '22px', lineHeight: '1.3', fontWeight: '700' },
      h4: { fontSize: '18px', lineHeight: '1.35', fontWeight: '600' },
      h5: { fontSize: '16px', lineHeight: '1.4', fontWeight: '600' },
      h6: { fontSize: '14px', lineHeight: '1.4', fontWeight: '600' },
    },
  },
  fontSizes: {
    xs: '11px',
    sm: '13px',
    md: '15px',
    lg: '17px',
    xl: '20px',
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  spacing: {
    xxs: '2px',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        root: {
          fontWeight: 600,
          transition: 'all 250ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          },
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        p: 'lg',
      },
      styles: {
        root: {
          backgroundColor: 'var(--bg-surface, #111820)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'all 250ms ease',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
      },
      styles: {
        root: {
          backgroundColor: 'var(--bg-surface, #111820)',
          border: '1px solid rgba(255,255,255,0.06)',
        },
      },
    },
    Badge: {
      defaultProps: {
        radius: 'full',
        variant: 'light',
      },
      styles: {
        root: {
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          fontSize: '11px',
        },
      },
    },
    Table: {
      defaultProps: {
        striped: true,
        highlightOnHover: true,
        withTableBorder: false,
      },
      styles: {
        th: {
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 600,
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-tertiary, #5A6A7A)',
          borderBottom: '2px solid rgba(255,255,255,0.08)',
          padding: '8px 12px',
        },
        td: {
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        },
        tr: {
          transition: 'background-color 150ms ease',
        },
      },
    },
    Tabs: {
      styles: {
        list: {
          borderBottom: '2px solid rgba(255,255,255,0.06)',
        },
        tab: {
          fontWeight: 500,
          fontSize: '13px',
          transition: 'all 150ms ease',
          '&[data-active]': {
            borderBottom: '2px solid var(--accent-primary, #10B981)',
            marginBottom: '-2px',
          },
        },
      },
    },
    TextInput: {
      styles: {
        input: {
          fontFamily: '"DM Sans", sans-serif',
          '&:focus-within': {
            borderColor: 'var(--accent-primary, #10B981)',
            boxShadow: '0 0 0 2px rgba(16,185,129,0.1)',
          },
        },
      },
    },
    NumberInput: {
      styles: {
        input: {
          fontFamily: '"Geist Mono", monospace',
          textAlign: 'right',
        },
      },
    },
    Alert: {
      styles: {
        root: {
          border: 'none',
          borderLeft: '4px solid',
          borderRadius: '8px',
        },
      },
    },
    Skeleton: {
      styles: {
        root: {
          '&::after': {
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
          },
        },
      },
    },
  },
});
```

---

## 5. Transitions & Animations

### 5.1 CSS Variables (add to `global.css` or `index.html` style block)

```css
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms ease-out;
}

/* Page entrance animation */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Card hover lift */
@keyframes cardHover {
  from { box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
  to { box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
}

/* Shimmer loading */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Pulse for notification badges */
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Bar chart grow */
@keyframes growUp {
  from { transform: scaleY(0); transform-origin: bottom; }
  to { transform: scaleY(1); transform-origin: bottom; }
}

/* Number counter */
@keyframes countUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Staggered fade-in for lists */
.stagger-item {
  animation: fadeInUp 0.4s ease-out both;
}
.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 60ms; }
.stagger-item:nth-child(3) { animation-delay: 120ms; }
.stagger-item:nth-child(4) { animation-delay: 180ms; }
.stagger-item:nth-child(5) { animation-delay: 240ms; }
.stagger-item:nth-child(6) { animation-delay: 300ms; }
.stagger-item:nth-child(7) { animation-delay: 360ms; }
.stagger-item:nth-child(8) { animation-delay: 420ms; }
```

### 5.2 Implementation Targets

| Element | Animation | Method |
|---------|-----------|--------|
| Page content | Fade-in-up on route change | CSS `@keyframes fadeInUp` + `animation-delay` stagger |
| Cards | Subtle lift on hover | CSS `:hover` → `transform: translateY(-2px)` + shadow increase |
| Table rows | Left border accent on hover | CSS `:hover` → `border-left: 2px solid var(--accent-primary)` |
| Stat numbers | Count-up entrance | CSS `@keyframes countUp` on mount |
| Badges | Pulse on pending count | CSS `@keyframes pulse` for notification badges |
| Charts | Bars grow from zero | Recharts `isAnimationActive` + custom `animationBegin` stagger |
| Skeletons | Shimmer gradient sweep | CSS `@keyframes shimmer` on `::after` pseudo-element |
| Buttons | Scale + glow on hover | CSS `:hover` → `transform: scale(1.02)` + shadow glow |
| Tab transitions | Smooth underline slide | CSS `transition: border-bottom-color 150ms ease` |
| Alert dismissal | Fade-out | Mantine `AnimatePresence` + `motion.div` |

### 5.3 Mantine Animation Integration

Use `@mantine/core`'s built-in animation props where available:

```tsx
// Example: Card with hover animation
<Card
  withBorder
  style={{
    transition: 'all 250ms ease',
  }}
  className="hover-lift"
/>

// Example: Badge with pulse
<Badge
  className={hasPending ? 'badge-pulse' : ''}
  style={hasPending ? { animation: 'pulse 2s infinite' } : undefined}
/>
```

For page transitions, wrap `<Outlet />` in `GameLayout.tsx`:

```tsx
import { AnimatePresence, motion } from 'framer-motion';
// OR use CSS-only approach:
<Box className="page-enter">
  <Outlet />
</Box>
```

If framer-motion is not desired (to keep bundle small), pure CSS works:

```css
.page-enter {
  animation: fadeInUp 0.3s ease-out;
}
```

---

## 6. Implementation Plan

### Phase 1: Foundation (Days 1–2)

| Step | File | Change | Effort |
|------|------|--------|--------|
| 1.1 | `index.html` | Add Google Fonts links for Plus Jakarta Sans, DM Sans, Geist Mono | 5 min |
| 1.2 | `apps/frontend/src/styles/global.css` | **Create new file.** CSS variables, keyframes, utility classes. Import in `main.tsx`. | 30 min |
| 1.3 | `apps/frontend/src/theme.ts` | Full rewrite: new colors, fonts, component overrides as shown in §4.2 | 1 hr |
| 1.4 | `apps/frontend/src/main.tsx` | Add `import './styles/global.css'` after Mantine CSS imports | 2 min |
| 1.5 | `apps/frontend/src/design-tokens.ts` | **Create new file.** Export tokens as shown in §4.1 | 15 min |

### Phase 2: Core Components (Days 2–3)

| Step | File | Change | Effort |
|------|------|--------|--------|
| 2.1 | `apps/frontend/src/App.tsx` | Redesign RootLayout: new branding header with shield icon + "Football GM" in Plus Jakarta Sans | 30 min |
| 2.1a | `apps/frontend/src/App.tsx` | Add CSS class `page-enter` to `<Outlet />` wrapper | 5 min |
| 2.2 | All page files | Add `className="page-enter"` wrapper to page return values (one-line change per file) | 30 min |
| 2.3 | All `Paper withBorder` usages | Verify new theme styles apply (no prop changes needed — theme override handles it) | 10 min |
| 2.4 | All `Table` usages | Verify striped/highlightOnHover + new th/td styles from theme apply | 10 min |

### Phase 3: Layout (Days 3–4)

| Step | File | Change | Effort |
|------|------|--------|--------|
| 3.1 | `apps/frontend/src/routes/GameLayout.tsx` | Redesign header: federation name + stat pills in a styled bar | 1 hr |
| 3.2 | `apps/frontend/src/routes/GameLayout.tsx` | **Replace horizontal Tabs with vertical sidebar** on desktop. Use Mantine `Tabs orientation="vertical"` or build custom nav. | 2 hr |
| 3.3 | `apps/frontend/src/routes/GameLayout.tsx` | Mobile: horizontal scrollable tab bar at bottom of screen (fixed position) | 1 hr |
| 3.4 | `apps/frontend/src/routes/GameLayout.tsx` | Add tab groupings with section labels | 30 min |

### Phase 4: High-Impact Pages (Days 4–7)

| Step | File | Change | Effort |
|------|------|--------|--------|
| 4.1 | `DashboardPage.tsx` | Redesign preseason hero card with gradient background | 1 hr |
| 4.2 | `DashboardPage.tsx` | Style standings table: position indicators, colored goal diff, highlighted points column | 1.5 hr |
| 4.3 | `DashboardPage.tsx` | Style action buttons: primary CTA gradient, secondary buttons | 30 min |
| 4.4 | `TeamDetailPage.tsx` | Hero card redesign with team name + badges | 45 min |
| 4.5 | `TeamDetailPage.tsx` | Attribute grid as mini-cards with icons | 1 hr |
| 4.6 | `TeamDetailPage.tsx` | Squad table: position color-coding, quality badges | 1 hr |
| 4.7 | `EconomyPage.tsx` | Treasury hero with large monospace number + health badge | 45 min |
| 4.8 | `EconomyPage.tsx` | Money values: all in Geist Mono with +/− color | 30 min |
| 4.9 | `EconomyPage.tsx` | Custom chart styling (dark theme, rounded bars) | 1 hr |
| 4.10 | `components/EconomyChart.tsx` | Custom tooltip, gradient fills, axis styling | 45 min |
| 4.11 | `components/PalmaresChart.tsx` | Custom tooltip, team-colored bars, axis styling | 45 min |

### Phase 5: Remaining Pages (Days 7–10)

| Step | File | Change | Effort |
|------|------|--------|--------|
| 5.1 | `TeamsPage.tsx` | Strength bars, row hover accents, division grouping | 30 min |
| 5.2 | `FederationPage.tsx` | Hero card redesign, tier badge prominent | 30 min |
| 5.3 | `FederationsPage.tsx` | Player row highlight, tier badges, prestige bars | 30 min |
| 5.4 | `MarketPage.tsx` | Arraigo visualization, negotiation button states | 30 min |
| 5.5 | `NegotiationsPage.tsx` | Timeline visualization, state badges with icons | 45 min |
| 5.6 | `StructurePage.tsx` | Division cards with colored headers, team row visuals | 45 min |
| 5.7 | `EventsPage.tsx` | Event cards with type-colored left borders, action button styling | 30 min |
| 5.8 | `CupsPage.tsx` | Cup cards, match score formatting, round headers | 45 min |
| 5.9 | `NormsPage.tsx` | Norm cards, breach progress bars | 30 min |
| 5.10 | `TransfersPage.tsx` | Transfer cards with arrow visualization | 30 min |
| 5.11 | `PrizesPage.tsx` | Prize cards, share visualization | 30 min |
| 5.12 | `HistoryPage.tsx` | Season record cards, palmarés medals, award icons | 45 min |
| 5.13 | `GamesPage.tsx` | Masthead redesign, saved games as cards | 45 min |

### Phase 6: Polish (Days 10–12)

| Step | File | Change | Effort |
|------|------|--------|--------|
| 6.1 | `global.css` | Add all remaining keyframes and utility classes | 30 min |
| 6.2 | All pages | Add `animation-delay` stagger classes to table rows and card lists | 1 hr |
| 6.3 | `GameLayout.tsx` | Add skeleton shimmer animation (replace basic Skeleton with styled version) | 30 min |
| 6.4 | All `Badge` usages | Audit and standardize: pill shape, correct colors, consistent sizing | 30 min |
| 6.5 | All `Button` usages | Audit: primary actions get gradient, secondary get light/subtle | 30 min |
| 6.6 | All `Alert` usages | Apply left-bordered panel style from theme override | 15 min |
| 6.7 | Global | Test all pages on mobile (responsive audit) | 1 hr |
| 6.8 | Global | Accessibility pass: focus rings, contrast ratios, ARIA labels | 1 hr |

---

## Appendix A: Files to Create/Modify

### New Files

| Path | Purpose |
|------|---------|
| `apps/frontend/src/styles/global.css` | CSS variables, keyframes, utility classes |
| `apps/frontend/src/design-tokens.ts` | TypeScript token definitions |

### Modified Files

| Path | Change Type |
|------|-------------|
| `apps/frontend/index.html` | Add Google Fonts links |
| `apps/frontend/src/theme.ts` | Full rewrite (new colors, fonts, component overrides) |
| `apps/frontend/src/main.tsx` | Import global.css |
| `apps/frontend/src/App.tsx` | Redesign RootLayout |
| `apps/frontend/src/routes/GameLayout.tsx` | Major redesign (header + nav) |
| `apps/frontend/src/routes/DashboardPage.tsx` | High-impact visual overhaul |
| `apps/frontend/src/routes/TeamDetailPage.tsx` | High-impact visual overhaul |
| `apps/frontend/src/routes/EconomyPage.tsx` | High-impact visual overhaul |
| `apps/frontend/src/routes/GamesPage.tsx` | Masthead + card redesign |
| All other page files | Moderate visual updates |

---

## Appendix B: Font Loading Optimization

For the fastest load with no FOUT (flash of unstyled text):

```html
<!-- index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

<style>
  /* Prevent FOUT */
  body {
    font-family: "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif;
    visibility: hidden;
  }
  body.fonts-loaded {
    visibility: visible;
  }
</style>
<script>
  // Mark fonts as loaded
  document.fonts.ready.then(() => document.body.classList.add('fonts-loaded'));
</script>
```

---

## Appendix C: Quick-Win Checklist

If time is limited, these changes deliver the most visual impact with the least effort:

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | Add Google Fonts (Plus Jakarta Sans + DM Sans) to `index.html` | **HIGH** — instant editorial feel | 5 min |
| 2 | Rewrite `theme.ts` with new colors, fonts, component overrides | **HIGH** — cascades to all components | 1 hr |
| 3 | Create `global.css` with CSS variables + keyframes | **HIGH** — enables all animations | 30 min |
| 4 | Redesign `GameLayout.tsx` header with stat pills | **HIGH** — first thing user sees | 1 hr |
| 5 | Add `page-enter` animation class to all pages | **MEDIUM** — smooth transitions | 15 min |
| 6 | Style `EconomyPage.tsx` treasury as large monospace number | **MEDIUM** — makes data feel important | 30 min |
| 7 | Add hover-lift effect to all Cards | **MEDIUM** — tactile feel | 5 min (CSS only) |
| 8 | Style table headers (uppercase, small, monospace) | **MEDIUM** — editorial data feel | 5 min (theme only) |

---

*Report generated for Football GM — Editorial/Sports Magazine Design Direction*
*Target stack: React 18, Mantine 7, Recharts 3, Vite 5*
*Total estimated effort: 10–12 working days*

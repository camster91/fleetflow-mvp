# FleetFlow Brand Assets

Complete logo and icon suite for FleetFlow - a fleet management SaaS application.

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary (Deep Navy) | `#1E3A5F` | Headers, primary buttons, dark backgrounds |
| Secondary (Electric Blue) | `#3B82F6` | Links, interactive elements, accents |
| Accent (Success Green) | `#10B981` | Success states, CTAs, highlights |
| Background | `#FFFFFF` / Slate | Page backgrounds, cards |

## Logo Variants

### Main Logos

| File | Usage | Dimensions |
|------|-------|------------|
| `logo/logo-horizontal.svg` | Primary logo - navbar, headers | 200x40px |
| `logo/logo-icon.svg` | App icon, favicon source | 512x512px |
| `logo/logo-wordmark.svg` | Text-only for specific layouts | 140x32px |

### Dark Variants

| File | Usage |
|------|-------|
| `logo/logo-horizontal-dark.svg` | For dark backgrounds (navbar-dark, footer) |
| `logo/logo-icon-dark.svg` | App icon for dark mode |

## Icons

| File | Size | Usage |
|------|------|-------|
| `icons/favicon.ico` | Multi-size | Browser tab icon |
| `icons/favicon.png` | 32x32 | Fallback favicon |
| `icons/icon-192.png` | 192x192 | PWA icon, Android |
| `icons/icon-512.png` | 512x512 | PWA splash screen |
| `icons/apple-touch-icon.png` | 180x180 | iOS home screen |

## Usage Guidelines

### HTML Implementation

```html
<!-- Favicon -->
<link rel="icon" type="image/x-icon" href="/brand/icons/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/brand/icons/favicon.png">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/brand/icons/apple-touch-icon.png">

<!-- PWA Icons -->
<link rel="icon" type="image/png" sizes="192x192" href="/brand/icons/icon-192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/brand/icons/icon-512.png">
```

### React/Next.js Usage

```jsx
// Horizontal Logo
<img src="/brand/logo/logo-horizontal.svg" alt="FleetFlow" width={200} height={40} />

// Icon only
<img src="/brand/logo/logo-icon.svg" alt="FleetFlow" width={32} height={32} />

// Wordmark only
<img src="/brand/logo/logo-wordmark.svg" alt="FleetFlow" width={140} height={32} />
```

### Logo Spacing

- Minimum clear space: Equal to the height of the "F" in FleetFlow
- Minimum size: Never display logo smaller than 100px width

### Background Usage

| Logo Variant | Background |
|--------------|------------|
| Standard (dark) | White, light gray, light blue |
| Dark variant | Navy (#1E3A5F), dark gray, black |

## Design Principles

The FleetFlow logo represents:
- **Movement**: Three arrows showing forward motion
- **Flow**: Connected elements showing seamless workflow
- **Fleet**: Multiple elements representing a fleet of vehicles
- **Network**: Dots connected by flow lines

## Regenerating Icons

If the source SVG changes, regenerate PNGs and ICO:

```bash
node scripts/generate-icons.js
```

## License

© FleetFlow - All rights reserved.

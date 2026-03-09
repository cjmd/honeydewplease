

## Update PWA Details

### Changes

**1. Copy the uploaded honeydew icon to the project**
- Copy `user-uploads://image-52.png` to `public/pwa-icon.png` (replaces existing apple-touch-icon)
- Copy to `public/icon-192.png` and `public/icon-512.png` (replaces existing PWA icons)

**2. Update theme color to match brand green**
- Change theme color from `#333333` to the brand's mint green background `#c6f0c6` (derived from the honeydew character's background) in both:
  - `public/manifest.json` (`theme_color` and `background_color`)
  - `index.html` (`theme-color` meta tag)

**3. Fix remaining "love or squirrel" reference**
- In `index.html` line 15, update `apple-mobile-web-app-title` from `"love or squirrel"` to `"honeydew, please"`

### Files Modified
- `public/pwa-icon.png` -- replaced with uploaded image
- `public/icon-192.png` -- replaced with uploaded image
- `public/icon-512.png` -- replaced with uploaded image
- `public/manifest.json` -- update theme/background colors
- `index.html` -- update theme-color meta tag and fix app title


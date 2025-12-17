# Frontend Customization

## App Name

You can optionally display a custom app name next to the logo.

### Configuration

Create a `.env` file in the `frontend/` directory:

```bash
# Show logo only (default)
# Leave VITE_APP_NAME undefined or empty

# Show logo + custom name
VITE_APP_NAME=Zoku

# Or use your organization name
VITE_APP_NAME=Acme Projects
```

### Behavior

- **Undefined/Empty**: Shows logo only (56px)
- **Set**: Shows logo (56px) + text name

### Examples

**Logo only:**
```
[族 logo]
```

**Logo + name:**
```
[族 logo] Zoku
```

**Custom organization:**
```
[族 logo] Acme Projects
```

### Development

After changing `.env`:

```bash
# Restart dev server
npm run dev
```

### Production

Build with your custom name:

```bash
# Set in .env or environment
VITE_APP_NAME="My Organization" npm run build
```

Or set in your deployment platform's environment variables.

### Note

The `.env` file is gitignored, so each deployment can have its own branding without code changes.

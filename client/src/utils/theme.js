/**
 * Apply a per-user theme (Copilot P5) at runtime.
 *
 * Sets the bounded accent/gradient override CSS custom properties as inline
 * styles on <html>. Inline styles beat the stylesheet's :root / [data-theme]
 * rules, so the user's palette wins over the default brand colors while the
 * dark/light system keeps owning backgrounds + text (we never override those).
 *
 * The same token→CSS-var mapping is mirrored in index.html's pre-paint script
 * (to avoid a flash of the default palette on first load) — keep them in sync.
 */

// Direct token → CSS variable mapping.
const VAR_MAP = {
    accentPrimary: '--accent-primary',
    accentPrimaryStrong: '--accent-primary-strong',
    accentSecondary: '--accent-secondary',
    accentAction: '--accent-action',
    accentActionStrong: '--accent-action-strong',
    gradientPrimary: '--gradient-primary',
};

// Extra vars we recolor from the same palette so status/info/gradients stay
// consistent with the chosen accent.
const derivedVars = (t) => ({
    '--accent-success': t.accentPrimary,
    '--accent-info': t.accentSecondary,
    '--gradient-success': t.gradientPrimary,
    '--gradient-secondary': t.gradientPrimary,
});

const ALL_VARS = [...Object.values(VAR_MAP), '--accent-success', '--accent-info', '--gradient-success', '--gradient-secondary'];

const STORAGE_KEY = 'prism_user_theme';

export function applyUserTheme(theme) {
    const root = document.documentElement;
    if (!theme || !theme.accentPrimary) {
        // No theme (e.g. after logout) — drop the overrides, fall back to brand.
        ALL_VARS.forEach((v) => root.style.removeProperty(v));
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        return;
    }
    for (const [key, cssVar] of Object.entries(VAR_MAP)) {
        if (theme[key]) root.style.setProperty(cssVar, theme[key]);
    }
    for (const [cssVar, val] of Object.entries(derivedVars(theme))) {
        if (val) root.style.setProperty(cssVar, val);
    }
    // Cache for the index.html pre-paint script so there's no flash next load.
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(theme)); } catch { /* ignore */ }
}

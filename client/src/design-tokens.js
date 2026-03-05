/**
 * ShiftSync Design Tokens
 *
 * These tokens are the single source of truth that mirrors your Figma UI kit.
 * When you update a value in Figma, update it here so every component and the
 * Tailwind theme stay in sync.
 *
 * How to export tokens from Figma:
 *  1. Open your Figma file → Plugins → "Tokens Studio" (or "Design Tokens")
 *  2. Export as JSON and replace the values below with the exported data.
 *  3. Alternatively, copy color hex values manually from the Figma color styles panel.
 */
export const colors = {
    /** Primary brand color — map this to your Figma "Primary" color style. */
    brand: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
    },
    /** Neutral grays — map to your Figma "Neutral" color style. */
    neutral: {
        50: '#f8fafc',
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
        700: '#334155',
        800: '#1e293b',
        900: '#0f172a',
    },
    /** Semantic colors — map to your Figma status/feedback color styles. */
    success: {
        light: '#dcfce7',
        DEFAULT: '#22c55e',
        dark: '#15803d',
    },
    warning: {
        light: '#fef9c3',
        DEFAULT: '#eab308',
        dark: '#a16207',
    },
    danger: {
        light: '#fee2e2',
        DEFAULT: '#ef4444',
        dark: '#b91c1c',
    },
    info: {
        light: '#e0f2fe',
        DEFAULT: '#0ea5e9',
        dark: '#0369a1',
    },
    /**
     * Role-specific badge colors (maps to the hospitality role color styles
     * in your Figma component library).
     */
    roles: {
        manager: { bg: '#f3e8ff', text: '#6b21a8' }, // purple
        server: { bg: '#dbeafe', text: '#1e40af' }, // blue  (reuses brand)
        kitchen: { bg: '#ffedd5', text: '#9a3412' }, // orange
        bar: { bg: '#dcfce7', text: '#166534' }, // green
        host: { bg: '#fce7f3', text: '#9d174d' }, // pink
    },
};
export const typography = {
    /**
     * Font family — replace with the font from your Figma "Text Styles".
     * If your kit uses a Google Font, add the @import to index.css and set
     * the family name here.
     */
    fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
    },
    /** Font-size scale (matches Figma text style sizes in px). */
    fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    },
};
export const spacing = {
    /** Base spacing unit (4 px) — adjust if your Figma uses a different grid. */
    unit: 4,
};
export const radii = {
    /** Border-radius values — map to your Figma corner-radius styles. */
    none: '0',
    sm: '0.25rem', // 4 px
    md: '0.5rem', // 8 px
    lg: '0.75rem', // 12 px
    xl: '1rem', // 16 px
    '2xl': '1.5rem', // 24 px
    full: '9999px',
};
export const shadows = {
    /** Elevation/shadow values — map to your Figma effect styles. */
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    none: 'none',
};

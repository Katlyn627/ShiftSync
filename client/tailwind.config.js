/**
 * Tailwind CSS configuration wired to ShiftSync design tokens.
 *
 * The `colors.brand`, `colors.neutral`, and semantic color keys below come
 * directly from `src/design-tokens.ts`.  When you update the Figma UI kit,
 * update `design-tokens.ts` and the changes propagate here automatically.
 *
 * @type {import('tailwindcss').Config}
 */
import { colors, typography, radii, shadows } from './src/design-tokens.ts';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /** Figma "Primary" color style */
        brand: colors.brand,
        /** Figma "Neutral" color style */
        neutral: colors.neutral,
        /** Figma semantic/status color styles */
        success: colors.success,
        warning: colors.warning,
        danger:  colors.danger,
        info:    colors.info,
        // Keep legacy `primary.*` alias so existing classes don't break
        primary: colors.brand,
      },
      fontFamily: typography.fontFamily,
      fontSize:   typography.fontSize,
      borderRadius: radii,
      boxShadow:  shadows,
    },
  },
  plugins: [],
};

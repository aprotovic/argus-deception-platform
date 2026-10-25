import type { Config } from 'tailwindcss'

/*
 * GEBEREW BANK — Unified Brand Palette
 * Primary  : Deep Indigo-Navy  #1B2B5E  (professional, trustworthy)
 * Accent   : Warm Gold/Amber   #D4930A  (Ethiopian warmth, calls to action)
 * Surface  : Off-white         #F9FAFB  (clean, breathable)
 * All greens removed. Every component uses these tokens.
 */

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── Primary brand navy ── */
        primary:          '#1B2B5E',
        'primary-dark':   '#111A3D',
        'primary-light':  '#2D4080',
        'primary-muted':  '#3D5298',
        'primary-faint':  '#EEF1FA',

        /* ── Gold accent ── */
        gold:             '#D4930A',
        'gold-dark':      '#A97208',
        'gold-light':     '#E8B03C',
        'gold-faint':     '#FDF5E0',

        /* ── Neutrals ── */
        surface:          '#F9FAFB',
        'surface-card':   '#FFFFFF',
        'border-light':   '#E5E8F0',
        'text-dark':      '#0D1526',
        'text-body':      '#374151',
        'text-muted':     '#6B7280',
        'text-light':     '#9CA3AF',

        /* ── Semantic ── */
        success:          '#15803D',
        'success-bg':     '#F0FDF4',
        'success-border': '#86EFAC',
        danger:           '#DC2626',
        'danger-bg':      '#FEF2F2',
        'danger-border':  '#FCA5A5',
        warning:          '#B45309',
        'warning-bg':     '#FFFBEB',
        'warning-border': '#FDE68A',

        /* ── Legacy aliases so old components still compile ── */
        'brand-green':        '#1B2B5E',
        'brand-green-dark':   '#111A3D',
        'brand-green-light':  '#2D4080',
        'brand-amber':        '#D4930A',
        'brand-amber-dark':   '#A97208',
        'brand-amber-light':  '#E8B03C',
        navy:                 '#1B2B5E',
      },
      fontFamily: {
        sans:     ['Inter', 'system-ui', 'sans-serif'],
        serif:    ['"Playfair Display"', 'Georgia', 'serif'],
        ethiopic: ['"Noto Sans Ethiopic"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:       '0 2px 12px rgba(27,43,94,0.07)',
        'card-hover':'0 6px 24px rgba(27,43,94,0.13)',
        glow:       '0 0 0 3px rgba(212,147,10,0.25)',
        'glow-nav': '0 4px 20px rgba(27,43,94,0.10)',
      },
      animation: {
        'fade-in':        'fadeIn 0.35s ease-out',
        'fade-up':        'fadeUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left':  'slideInLeft 0.3s ease-out',
        'pulse-dot':      'pulseDot 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:        { '0%': { opacity:'0', transform:'translateY(6px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
        fadeUp:        { '0%': { opacity:'0', transform:'translateY(16px)' }, '100%': { opacity:'1', transform:'translateY(0)' } },
        slideInRight:  { '0%': { transform:'translateX(100%)' }, '100%': { transform:'translateX(0)' } },
        slideInLeft:   { '0%': { transform:'translateX(-100%)' }, '100%': { transform:'translateX(0)' } },
        pulseDot:      { '0%,100%': { transform:'scale(1)', opacity:'1' }, '50%': { transform:'scale(1.4)', opacity:'0.7' } },
      },
    },
  },
  plugins: [],
}

export default config

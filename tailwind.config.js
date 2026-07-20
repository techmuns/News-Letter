/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // base
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-solid': 'var(--surface-solid)',
        // borders
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        glow: 'var(--glow)',
        // primary
        violet: 'var(--violet)',
        'violet-dim': 'var(--violet-dim)',
        // status
        green: 'var(--green)',
        amber: 'var(--amber)',
        'grey-dot': 'var(--grey-dot)',
        pink: 'var(--pink)',
        // text
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-muted': 'var(--text-muted)',
        'text-dim': 'var(--text-dim)',
      },
      fontFamily: {
        display: ['Satoshi', 'Clash Display', 'system-ui', 'sans-serif'],
        sans: ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '18px',
        panel: '20px',
      },
      boxShadow: {
        glow: 'var(--glow-shadow)',
        'glow-soft': '0 0 16px rgba(157,140,245,0.14)',
      },
      backdropBlur: {
        glass: '20px',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.4,0,0.2,1)',
      },
      keyframes: {
        'pulse-pink': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(251,94,126,0.45)' },
          '50%': { opacity: '0.55', boxShadow: '0 0 0 6px rgba(251,94,126,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-pink': 'pulse-pink 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-up': 'fade-up 0.35s cubic-bezier(0.4,0,0.2,1)',
      },
    },
  },
  plugins: [],
}

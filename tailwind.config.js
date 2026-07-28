/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // base
        bg: 'var(--bg)',
        'bg-2': 'var(--bg-2)',
        surface: 'var(--surface)',
        'surface-soft': 'var(--surface-soft)',
        'surface-hover': 'var(--surface-hover)',
        'surface-solid': 'var(--surface-solid)',
        // the rail — plum in both themes, so it has its own scale
        rail: 'var(--rail)',
        'rail-text': 'var(--rail-text)',
        'rail-text-2': 'var(--rail-text-2)',
        'rail-text-dim': 'var(--rail-text-dim)',
        'rail-accent': 'var(--rail-accent)',
        'rail-hover': 'var(--rail-hover)',
        'rail-active': 'var(--rail-active)',
        'rail-border': 'var(--rail-border)',
        // borders
        border: 'var(--border)',
        'border-soft': 'var(--border-soft)',
        'border-strong': 'var(--border-strong)',
        glow: 'var(--glow)',
        // primary — plum action, lilac accent
        violet: 'var(--violet)',
        'violet-dim': 'var(--violet-dim)',
        purple: 'var(--purple)',
        'purple-bright': 'var(--purple-bright)',
        'purple-soft': 'var(--purple-soft)',
        plum: 'var(--plum)',
        lilac: 'var(--lilac)',
        'on-accent': 'var(--on-accent)',
        cream: 'var(--cream)',
        // secondary — soft mauve-lilac (orange/sky kept as aliases)
        orange: 'var(--orange)',
        sky: 'var(--sky)',
        'sky-soft': 'var(--sky-soft)',
        'sky-border': 'var(--sky-border)',
        'bg-translucent': 'var(--bg-translucent)',
        // status
        green: 'var(--green)',
        'green-soft': 'var(--green-soft)',
        'green-border': 'var(--green-border)',
        amber: 'var(--amber)',
        'amber-soft': 'var(--amber-soft)',
        'grey-dot': 'var(--grey-dot)',
        pink: 'var(--pink)',
        red: 'var(--red)',
        'red-soft': 'var(--red-soft)',
        // text
        heading: 'var(--heading)',
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
        card: '14px',
        panel: '16px',
      },
      boxShadow: {
        glow: 'var(--glow-shadow)',
        'glow-soft': '0 0 16px var(--purple-soft)',
        panel: 'var(--shadow-card)',
        card: 'var(--shadow-card)',
        modal: 'var(--shadow-modal)',
        glass: 'var(--shadow-glass)',
        accent: 'var(--shadow-accent)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
      },
      backgroundImage: {
        rail: 'var(--rail-gradient)',
        'plum-lilac': 'linear-gradient(135deg, var(--purple) 0%, var(--purple-bright) 100%)',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.4,0,0.2,1)',
      },
      keyframes: {
        'pulse-pink': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(232,111,176,0.45)' },
          '50%': { opacity: '0.55', boxShadow: '0 0 0 6px rgba(232,111,176,0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        /* a newly added material announcing itself in the list */
        'row-in': {
          '0%': { opacity: '0', transform: 'translateY(-10px)', backgroundColor: 'var(--purple-soft)' },
          '55%': { backgroundColor: 'var(--purple-soft)' },
          '100%': { opacity: '1', transform: 'translateY(0)', backgroundColor: 'transparent' },
        },
        /* staged file chip landing in the box */
        'chip-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'pulse-pink': 'pulse-pink 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-up': 'fade-up 0.35s cubic-bezier(0.4,0,0.2,1)',
        'row-in': 'row-in 0.9s cubic-bezier(0.4,0,0.2,1)',
        'chip-in': 'chip-in 0.22s cubic-bezier(0.4,0,0.2,1)',
        spin: 'spin 0.7s linear infinite',
      },
    },
  },
  plugins: [],
}

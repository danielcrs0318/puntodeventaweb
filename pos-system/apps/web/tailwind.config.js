/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta principal — azules oscuros
        'bg-primary':      '#0B1220',
        'bg-secondary':    '#101A2E',
        'bg-elevated':     '#16223B',
        'border-subtle':   '#24304D',
        'accent-primary':  '#2563EB',
        'accent-hover':    '#3B82F6',
        'accent-muted':    '#1E3A5F',
        'text-primary':    '#E8EDF7',
        'text-secondary':  '#93A2C2',
        'success':         '#16A34A',
        'warning':         '#D97706',
        'danger':          '#DC2626',
        // Tonos adicionales
        'bg-input':        '#0E1726',
        'bg-hover':        '#192844',
        'accent-light':    '#60A5FA',
        'success-muted':   '#14532D',
        'warning-muted':   '#78350F',
        'danger-muted':    '#7F1D1D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs':  ['0.75rem',  { lineHeight: '1rem',    letterSpacing: '0.02em' }],
        'sm':  ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }],
        'base':['1rem',     { lineHeight: '1.5rem' }],
        'lg':  ['1.125rem', { lineHeight: '1.75rem' }],
        'xl':  ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem',   { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem',  { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        'sm': '0.25rem',
        DEFAULT: '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '72': '18rem',
        '80': '20rem',
        '88': '22rem',
        '96': '24rem',
        '112': '28rem',
        '128': '32rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.3), 0 1px 2px -1px rgba(0,0,0,0.2)',
        'elevated': '0 4px 12px 0 rgba(0,0,0,0.4), 0 2px 4px -1px rgba(0,0,0,0.3)',
        'modal': '0 20px 60px 0 rgba(0,0,0,0.5)',
        'glow-accent': '0 0 20px rgba(37,99,235,0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
      },
    },
  },
  plugins: [],
}

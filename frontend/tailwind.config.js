/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand green
        brand: {
          50: '#f0ffdd',
          100: '#e1ffbb',
          200: '#c5ff77',
          300: '#a5ff33',
          400: '#95ff0c',
          500: '#7cdb00',
          600: '#53FC18',
          700: '#39a700',
          800: '#2d8300',
          900: '#235900',
        },
        // Dark theme
        dark: {
          0: '#ffffff',
          50: '#f9f9f9',
          100: '#f3f3f3',
          200: '#e5e5e5',
          300: '#d0d0d0',
          400: '#a1a1a1',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#2d2d2d',
          900: '#0a0a0a',
        },
      },
      backgroundColor: {
        'surface': '#0a0a0a',
        'surface-1': '#111111',
        'surface-2': '#161616',
        'surface-3': '#1e1e1e',
        'surface-4': '#252525',
      },
      borderColor: {
        'border': 'rgba(255,255,255,0.07)',
        'border-2': 'rgba(255,255,255,0.11)',
      },
      textColor: {
        'text': '#f2f2f2',
        'text-muted': 'rgba(242,242,242,0.38)',
        'text-muted-2': 'rgba(242,242,242,0.6)',
      },
      fontFamily: {
        'sans': ['Inter', '-apple-system', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 16px rgba(83,252,24,0.25)' },
          '50%': { boxShadow: '0 0 32px rgba(83,252,24,0.4)' },
        },
        slideUp: {
          'from': { transform: 'translateY(100%)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        glow: 'glow 3s ease infinite',
        slideUp: 'slideUp 0.3s ease-out',
      },
    },
  },
  plugins: [],
}

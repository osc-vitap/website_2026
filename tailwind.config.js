/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    borderRadius: {
      'none': '0',
      'sm': '0',
      DEFAULT: '0',
      'md': '0',
      'lg': '0',
      'xl': '0',
      '2xl': '0',
      '3xl': '0',
      'full': '9999px',
    },
    extend: {
      colors: {
        dark: {
          900: '#0a0a0c',
          800: '#131316',
          700: '#1c1c21',
          600: '#2a2a32',
        },
        brand: {
          primary: '#6d28d9',
          accent: '#c084fc',
        }
      },
      fontFamily: {
        sans: ['"Geist Mono"', 'monospace'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        bebas: ['"Bebas Neue"', 'sans-serif'],
        michroma: ['"Michroma"', 'sans-serif'],
        lora: ['"Lora"', 'serif'],
      },
      animation: {
        'glitch': 'glitch 1s linear infinite',
        'scanlines': 'scanlines 8s linear infinite',
      },
      keyframes: {
        glitch: {
          '2%, 64%': { transform: 'translate(2px,0) skew(0deg)' },
          '4%, 60%': { transform: 'translate(-2px,0) skew(0deg)' },
          '62%': { transform: 'translate(0,0) skew(5deg)' },
        },
        scanlines: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(100vh)' }
        }
      }
    },
  },
  plugins: [],
}

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
        sans: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}

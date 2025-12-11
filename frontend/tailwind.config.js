/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        quantum: {
          900: '#0a0e1a',
          800: '#111827',
          700: '#1f2937',
          600: '#374151',
          500: '#6366f1',
          400: '#818cf8',
        }
      }
    },
  },
  plugins: [],
}

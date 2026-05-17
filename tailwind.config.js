/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'g-bg': 'var(--theme-g-bg)',
        'g-surface': 'var(--theme-g-surface)',
        'g-primary': 'var(--theme-g-primary)',
        'g-primary-container': 'var(--theme-g-primary-container)',
        'g-text': 'var(--theme-g-text)',
        'g-text-variant': 'var(--theme-g-text-variant)',
        'g-outline': 'var(--theme-g-outline)',
        'g-aluminium': 'var(--theme-g-aluminium)',
      },
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'display': ['Outfit', 'sans-serif'],
        'mono': ['Roboto Mono', 'monospace'],
      },
      boxShadow: {
        'elevation-1': '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        'elevation-2': '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
        'elevation-3': '0px 4px 8px 3px rgba(0, 0, 0, 0.15), 0px 1px 3px 0px rgba(0, 0, 0, 0.3)',
      }
    },
  },
  plugins: [],
}

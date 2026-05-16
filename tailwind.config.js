/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'g-bg': '#F0F4F8',
        'g-surface': '#FFFFFF',
        'g-primary': '#0B57D0',
        'g-primary-container': '#D3E3FD',
        'g-text': '#1F1F1F',
        'g-text-variant': '#444746',
        'g-outline': '#C4C7C5',
        'g-aluminium': '#E8EAED',
      },
      fontFamily: {
        'sans': ['DM Sans', 'sans-serif'],
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

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-navy': '#111928',
        'royal-blue': '#2563EB',
        'white': '#FEFFFE',
        'tangerine': '#FF9B71',
      }
    },
  },
  plugins: [],
}


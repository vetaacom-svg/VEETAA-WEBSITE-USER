/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        veetaa: {
          orange: '#ea580c',
          'orange-light': '#fff7ed',
          slate: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ys: {
          sage: '#7A9B76',
          dark: '#3F4740',
          muted: '#A8B2A6',
          lime: '#C7F000',
          cream: '#F5F7F3',
          soft: '#E8EEE5'
        }
      },
      boxShadow: {
        soft: '0 18px 45px rgba(63, 71, 64, 0.13)'
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

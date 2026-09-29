module.exports = {
  content: [
    './*.html',
    './admin/*.html',
    './public/*.js',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0A1A2F',
          card: '#122238',
          light: '#1B2E4B',
          dark: '#06101E',
        },
        brandRed: {
          DEFAULT: '#E31217',
          hover: '#C00F13',
        },
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

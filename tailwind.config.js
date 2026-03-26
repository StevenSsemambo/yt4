/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink:    { DEFAULT: '#05080f', 2: '#0c1120', 3: '#131c2e', 4: '#1a2540' },
        aqua:   { DEFAULT: '#22d3ee', 2: '#06b6d4', 3: '#0891b2' },
        violet: { DEFAULT: '#a78bfa', 2: '#8b5cf6', 3: '#7c3aed' },
        amber:  { DEFAULT: '#fbbf24', 2: '#f59e0b' },
        jade:   { DEFAULT: '#34d399', 2: '#10b981' },
        rose:   { DEFAULT: '#fb7185', 2: '#f43f5e' },
      },
    },
  },
  plugins: [],
}

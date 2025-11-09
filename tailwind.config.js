/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enables dark mode with 'dark' class
  content: [
    "./views/**/*.ejs", // Scans all .ejs files
  ],
  theme: {
    extend: {
      // Custom Colors
      colors: {
        primary: {
          DEFAULT: '#6366F1', // Indigo
          dark: '#4F46E5',
          light: '#818CF8',
          50: '#EEF2FF',
          900: '#312E81',
        },
        secondary: {
          DEFAULT: '#EC4899', // Pink
          dark: '#DB2777',
          light: '#F472B6',
          50: '#FDF2F8',
          900: '#831843',
        },
        accent: {
          DEFAULT: '#10B981', // Emerald
          dark: '#059669',
          light: '#34D399',
          50: '#ECFDF5',
          900: '#064E3B',
        },
        background: {
          DEFAULT: '#F9FAFB', // Light gray
          dark: '#1F2937',    // Dark gray
          card: '#FFFFFF',
          muted: '#E5E7EB',
          darkMuted: '#374151',
        },
        neutral: {
          DEFAULT: '#6B7280', // Gray
          light: '#9CA3AF',
          dark: '#4B5563',
          50: '#F9FAFB',
          900: '#111827',
        },
        danger: {
          DEFAULT: '#EF4444', // Red
          dark: '#DC2626',
          light: '#F87171',
        },
        warning: {
          DEFAULT: '#F59E0B', // Amber
          dark: '#D97706',
          light: '#FBBF24',
        },
        success: {
          DEFAULT: '#22C55E', // Green
          dark: '#16A34A',
          light: '#4ADE80',
        },
      },

      // Custom Spacing
      spacing: {
        '18': '4.5rem',  // 72px
        '22': '5.5rem',  // 88px
        '72': '18rem',   // 288px
        '84': '21rem',   // 336px
        '96': '24rem',   // 384px
      },

      // Custom Font Sizes
      fontSize: {
        'xxs': '0.65rem',  // 10px
        '3xl': '1.875rem', // 30px
        '4xl': '2.25rem',  // 36px
        '5xl': '3rem',     // 48px
      },

      // Custom Box Shadows
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'deep': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 15px rgba(99, 102, 241, 0.5)', // Primary color glow
      },

      // Custom Animations
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'bounce-slow': 'bounce 3s infinite',
        'spin-slow': 'spin 2s linear infinite',
        'pulse-soft': 'pulse 1.5s infinite',
        'wiggle': 'wiggle 0.3s ease-in-out infinite',
      },

      // Custom Keyframes
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),         // Form styling
    require('@tailwindcss/aspect-ratio'), // Aspect ratio utilities
    require('@tailwindcss/typography'),   // Rich text styling
    require('@tailwindcss/container-queries'), // Container query support
  ],
};
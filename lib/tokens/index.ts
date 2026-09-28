export const bauhausTokens = {
  colors: {
    background: '#F0F0F0',
    foreground: '#121212',
    primaryRed: '#D02020',
    primaryBlue: '#1040C0',
    primaryYellow: '#F0C020',
    border: '#121212',
    muted: '#E0E0E0',
    white: '#FFFFFF',
  },
  typography: {
    family: 'Outfit',
    weights: {
      regular: 400,
      medium: 500,
      bold: 700,
      black: 900,
    },
    display: {
      mobile: 'text-4xl',
      tablet: 'text-6xl',
      desktop: 'text-8xl',
      weight: 900,
      transform: 'uppercase',
      tracking: 'tight',
    },
  },
  borders: {
    mobile: '2px',
    desktop: '4px',
    color: '#121212',
  },
  radius: {
    square: '0',
    circle: '9999px',
  },
  shadows: {
    sm: '3px 3px 0 #121212',
    md: '6px 6px 0 #121212',
    lg: '8px 8px 0 #121212',
  },
  spacing: {
    scale: ['4px', '8px', '12px', '16px', '24px'],
  },
  container: {
    maxWidth: '80rem',
  },
  breakpoints: {
    mobile: '640px',
    tablet: '1024px',
    desktop: '1025px',
  },
  motion: {
    duration: {
      fast: '200ms',
      standard: '300ms',
    },
    easing: {
      interaction: 'ease-out',
    },
    distance: {
      press: '2px',
      lift: '4px',
    },
    scale: {
      icon: '1.04',
    },
    focus: {
      offset: '2px',
    },
  },
} as const

import React from 'react';

// Full-screen dithered gradient backdrop, using the exact asset exported from
// Figma ("dither gradient", 390×991 @2x → public/bg-dither.png).
// Anchored to the bottom so the green glow always sits behind the dock.
export const DitherBackground: React.FC<{ theme?: 'dark' | 'light' }> = ({ theme = 'dark' }) => {
  if (theme === 'light') return null;
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
      style={{
        backgroundColor: '#000',
        backgroundImage: 'url(/bg-dither.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center bottom',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
};

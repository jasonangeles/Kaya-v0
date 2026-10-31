import React from 'react';

// Kaya logo mark (home icon in the dock). Uses currentColor so it tints with
// the button's text color — brand green when active, faint when not.
export const KayaMark: React.FC<{ size?: number; className?: string; style?: React.CSSProperties }> = ({
  size = 24,
  className = '',
  style,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 22 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={style}
    aria-hidden
  >
    <path
      d="M8.58984 8.18848L6.1875 11L8.58984 13.8105L2.75 20.625V1.375L8.58984 8.18848ZM11 11L19.25 20.625H14.4141L8.58984 13.8105L11 11L8.58984 8.18848L14.4141 1.375H19.25L11 11Z"
      fill="currentColor"
    />
  </svg>
);

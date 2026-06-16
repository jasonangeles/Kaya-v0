import React from 'react';
import { AssetCategory } from '../types';
import { Icons } from './icons';
import { findInstitution, textOn, Institution } from '../data/institutions';

// Auto-discover any real logo files dropped into src/assets/logos/<id>.svg|png.
// Empty by default — these override the generated monogram when present.
const realLogos = import.meta.glob('../assets/logos/*.{svg,png}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const logoFor = (id: string): string | undefined => {
  const hit = Object.entries(realLogos).find(([p]) => p.split('/').pop()?.replace(/\.(svg|png)$/, '') === id);
  return hit?.[1];
};

const categoryIcon = (category?: AssetCategory, size = 18) => {
  if (category === AssetCategory.BANK_PH) return <Icons.Bank size={size} />;
  if (category === AssetCategory.CRYPTO) return <Icons.Crypto size={size} />;
  return <Icons.Wallet size={size} />;
};

export const InstitutionLogo: React.FC<{
  name?: string;
  category?: AssetCategory;
  size?: number;
  radius?: number;
  className?: string;
}> = ({ name, category, size = 38, radius = 11, className = '' }) => {
  const inst: Institution | null = findInstitution(name);
  const box: React.CSSProperties = { width: size, height: size, borderRadius: radius };

  // No known institution → neutral tile with the category icon (unchanged look).
  if (!inst) {
    return (
      <div className={`flex items-center justify-center bg-surface2 border border-ink/5 text-textMuted ${className}`} style={box}>
        {categoryIcon(category, Math.round(size * 0.47))}
      </div>
    );
  }

  const real = logoFor(inst.id);
  if (real) {
    return (
      <div className={`flex items-center justify-center bg-white border border-ink/5 overflow-hidden ${className}`} style={box}>
        <img src={real} alt={name} style={{ width: size * 0.66, height: size * 0.66, objectFit: 'contain' }} />
      </div>
    );
  }

  // Brand-colored monogram tile.
  return (
    <div
      className={`flex items-center justify-center font-semibold border border-white/10 ${className}`}
      style={{ ...box, background: inst.color, color: textOn(inst.color), fontSize: Math.round(size * 0.36), letterSpacing: '-0.02em' }}
      aria-label={name}
    >
      {inst.short}
    </div>
  );
};

'use client';

import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export function Spinner({ size = 'md', text, className = '' }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : 'spinner-md';

  return (
    <div className={`spinner-container ${className}`.trim()}>
      <div className={`spinner-circle ${sizeClass}`} />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
}

'use client';

import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary',
  trend,
}: StatCardProps) {
  return (
    <div className={`stat-card stat-card-${variant}`}>
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {icon && <span className="stat-card-icon">{icon}</span>}
      </div>

      <div className="stat-card-body">
        <span className="stat-card-value">{value}</span>
        {trend && (
          <span
            className={`stat-card-trend ${
              trend.isPositive ? 'trend-positive' : 'trend-negative'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && <p className="stat-card-subtitle">{subtitle}</p>}
    </div>
  );
}

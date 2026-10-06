import React from 'react';

interface TokenExpiryBadgeProps {
  theme?: 'dark' | 'light';
  className?: string;
  showRefreshButton?: boolean;
}

export function TokenExpiryBadge(_props?: TokenExpiryBadgeProps) {
  // Token expiry indicator is disabled across all account types
  return null;
}

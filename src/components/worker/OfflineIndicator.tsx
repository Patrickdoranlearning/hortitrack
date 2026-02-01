'use client';

import { useWorkerOffline, type ConnectionStatus } from '@/offline/WorkerOfflineProvider';
import { cn } from '@/lib/utils';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface OfflineIndicatorProps {
  /** Show full banner mode (default: false - just shows a dot/icon) */
  showBanner?: boolean;
  /** Custom className */
  className?: string;
}

// =============================================================================
// STATUS DOT COMPONENT
// =============================================================================

interface StatusDotProps {
  status: ConnectionStatus;
  pendingCount: number;
  className?: string;
}

function StatusDot({ status, pendingCount, className }: StatusDotProps) {
  const dotColors: Record<ConnectionStatus, string> = {
    online: 'bg-green-500',
    offline: 'bg-amber-500',
    syncing: 'bg-blue-500',
  };

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <span
        className={cn(
          'h-2.5 w-2.5 rounded-full',
          dotColors[status],
          status === 'syncing' && 'animate-pulse'
        )}
      />
      {pendingCount > 0 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 min-w-[14px] h-[14px]',
            'flex items-center justify-center',
            'rounded-full bg-amber-500 text-[10px] font-medium text-white',
            'px-0.5'
          )}
        >
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

interface StatusBadgeProps {
  status: ConnectionStatus;
  pendingCount: number;
  lastSyncedAt: Date | null;
  onSyncClick?: () => void;
  className?: string;
}

function StatusBadge({
  status,
  pendingCount,
  lastSyncedAt: _lastSyncedAt,
  onSyncClick,
  className,
}: StatusBadgeProps) {
  const getIcon = () => {
    switch (status) {
      case 'online':
        return <Cloud className="h-4 w-4" />;
      case 'offline':
        return <CloudOff className="h-4 w-4" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
  };

  const getText = () => {
    switch (status) {
      case 'online':
        if (pendingCount > 0) {
          return `${pendingCount} pending`;
        }
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'syncing':
        return 'Syncing...';
    }
  };

  const badgeStyles: Record<ConnectionStatus, string> = {
    online: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    offline: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    syncing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <button
      type="button"
      onClick={onSyncClick}
      disabled={status === 'syncing'}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        'transition-colors',
        badgeStyles[status],
        status !== 'syncing' && 'hover:opacity-80 active:opacity-70',
        className
      )}
    >
      {getIcon()}
      <span>{getText()}</span>
    </button>
  );
}

// =============================================================================
// OFFLINE BANNER COMPONENT
// =============================================================================

interface OfflineBannerProps {
  status: ConnectionStatus;
  pendingCount: number;
  lastSyncedAt: Date | null;
  onSyncClick?: () => void;
  className?: string;
}

function OfflineBanner({
  status,
  pendingCount,
  lastSyncedAt: _lastSyncedAt,
  onSyncClick,
  className,
}: OfflineBannerProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);

  // Show success message briefly after syncing completes
  useEffect(() => {
    if (prevStatus === 'syncing' && status === 'online') {
      setShowSuccess(true);
      const timeout = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timeout);
    }
    setPrevStatus(status);
  }, [status, prevStatus]);

  // Don't show banner when online with no pending actions
  if (status === 'online' && pendingCount === 0 && !showSuccess) {
    return null;
  }

  const getContent = () => {
    if (showSuccess) {
      return {
        icon: <Check className="h-4 w-4" />,
        text: 'Changes synced successfully',
        style: 'bg-green-500 text-white',
      };
    }

    switch (status) {
      case 'offline':
        return {
          icon: <CloudOff className="h-4 w-4" />,
          text: pendingCount > 0
            ? `You're offline. ${pendingCount} change${pendingCount === 1 ? '' : 's'} will sync when connected.`
            : "You're offline. Changes will sync when connected.",
          style: 'bg-amber-500 text-white',
        };
      case 'syncing':
        return {
          icon: <RefreshCw className="h-4 w-4 animate-spin" />,
          text: 'Syncing changes...',
          style: 'bg-blue-500 text-white',
        };
      case 'online':
        if (pendingCount > 0) {
          return {
            icon: <AlertCircle className="h-4 w-4" />,
            text: `${pendingCount} change${pendingCount === 1 ? '' : 's'} pending. Tap to sync.`,
            style: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
          };
        }
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  const isClickable = status === 'online' && pendingCount > 0;

  const BannerElement = isClickable ? 'button' : 'div';

  return (
    <BannerElement
      {...(isClickable ? { type: 'button', onClick: onSyncClick } : {})}
      className={cn(
        'w-full px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium',
        content.style,
        isClickable && 'hover:opacity-90 active:opacity-80 cursor-pointer',
        className
      )}
    >
      {content.icon}
      <span>{content.text}</span>
    </BannerElement>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function OfflineIndicator({ showBanner = false, className }: OfflineIndicatorProps) {
  const { status, pendingActionCount, lastSyncedAt, syncNow } = useWorkerOffline();

  const handleSyncClick = async () => {
    if (status === 'syncing') return;
    await syncNow();
  };

  if (showBanner) {
    return (
      <OfflineBanner
        status={status}
        pendingCount={pendingActionCount}
        lastSyncedAt={lastSyncedAt}
        onSyncClick={handleSyncClick}
        className={className}
      />
    );
  }

  return (
    <StatusBadge
      status={status}
      pendingCount={pendingActionCount}
      lastSyncedAt={lastSyncedAt}
      onSyncClick={handleSyncClick}
      className={className}
    />
  );
}

// Export sub-components for flexibility
export { StatusDot, StatusBadge, OfflineBanner };

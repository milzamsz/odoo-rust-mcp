import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import type { StatusMessage as StatusMessageType } from '../types';

interface StatusMessageProps {
  status: StatusMessageType;
  onDismiss?: () => void;
}

export function StatusMessage({ status, onDismiss }: StatusMessageProps) {
  const variants = {
    loading: {
      icon: Loader2,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
      iconColor: 'text-blue-600',
      dismissColor: 'text-blue-600 hover:text-blue-800',
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-900',
      iconColor: 'text-green-600',
      dismissColor: 'text-green-600 hover:text-green-800',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-900',
      iconColor: 'text-yellow-600',
      dismissColor: 'text-yellow-600 hover:text-yellow-800',
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-900',
      iconColor: 'text-red-600',
      dismissColor: 'text-red-600 hover:text-red-800',
    },
  };

  const config = variants[status.type];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${config.bgColor} ${config.borderColor} ${config.textColor} animate-in slide-in-from-top-2 duration-300`}
    >
      <Icon
        className={`${config.iconColor} flex-shrink-0 ${status.type === 'loading' ? 'animate-spin' : ''}`}
        size={20}
      />
      <p className="flex-1 text-sm font-medium">{status.message}</p>
      {(status.type === 'error' || status.type === 'warning') && onDismiss && (
        <button
          onClick={onDismiss}
          className={`flex-shrink-0 ${config.dismissColor} transition-colors`}
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}

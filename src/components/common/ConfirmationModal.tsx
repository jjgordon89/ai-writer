import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger' | 'info';
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning'
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'Enter') {
      handleConfirm();
    }
  };

  const variantStyles = {
    warning: {
      icon: 'text-yellow-600',
      border: 'border-yellow-200',
      bg: 'bg-yellow-50',
      button: 'bg-yellow-600 hover:bg-yellow-700'
    },
    danger: {
      icon: 'text-red-600',
      border: 'border-red-200',
      bg: 'bg-red-50',
      button: 'bg-red-600 hover:bg-red-700'
    },
    info: {
      icon: 'text-blue-600',
      border: 'border-blue-200',
      bg: 'bg-blue-50',
      button: 'bg-blue-600 hover:bg-blue-700'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${styles.bg} ${styles.border} border`}>
              <AlertTriangle className={`w-5 h-5 ${styles.icon}`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-4">
          <p className="text-gray-600 leading-relaxed">{message}</p>
        </div>

        <div className="flex justify-end space-x-3 px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.button}`}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage
export function useConfirmation() {
  const [modalState, setModalState] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    variant: 'warning' | 'danger' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'warning',
    onConfirm: () => {}
  });

  const confirm = React.useCallback((options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'warning' | 'danger' | 'info';
  }) => {
    return new Promise<boolean>((resolve) => {
      setModalState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'warning',
        onConfirm: () => resolve(true)
      });
    });
  }, []);

  const closeModal = React.useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmationModalComponent = React.useCallback(() => (
    <ConfirmationModal
      isOpen={modalState.isOpen}
      onClose={closeModal}
      onConfirm={modalState.onConfirm}
      title={modalState.title}
      message={modalState.message}
      confirmText={modalState.confirmText}
      cancelText={modalState.cancelText}
      variant={modalState.variant}
    />
  ), [modalState, closeModal]);

  return {
    confirm,
    ConfirmationModal: ConfirmationModalComponent
  };
}
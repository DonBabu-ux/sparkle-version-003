import toast, { Toaster } from 'react-hot-toast';

// Export Toaster as ToastProvider for compatibility
export const ToastProvider = Toaster;

// Default toast options applied to all toasts
const defaultOptions = {
  duration: 2000,
  position: 'top-right' as const,
};

/**
 * Show a success toast with a custom message.
 * @param message - Message to display.
 */
export const showSuccess = (message: string) => {
  toast.success(message, { ...defaultOptions });
};

/**
 * Show an error toast with a custom message.
 * @param message - Message to display.
 */
export const showError = (message: string) => {
  toast.error(message, { ...defaultOptions });
};

/**
 * Show an informational toast.
 * @param message - Message to display.
 */
export const showInfo = (message: string) => {
  toast(message, { ...defaultOptions });
};

export default { showSuccess, showError, showInfo };
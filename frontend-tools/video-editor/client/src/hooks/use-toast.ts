import { useState } from "react";

interface Toast {
  id: string;
  title?: string;
  description?: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({ title, description }: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { id, title, description };
    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);

    return { id };
  };

  const dismiss = (toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  return {
    toasts,
    toast,
    dismiss,
  };
}

export { useToast };
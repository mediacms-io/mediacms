import * as React from "react";
import * as Toast from "@radix-ui/react-toast";

interface ToastProps {
  title?: string;
  description?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ToastComponent = ({ title, description, open, onOpenChange }: ToastProps) => {
  return (
    <Toast.Provider>
      <Toast.Root
        className="bg-white rounded-md shadow-lg p-4 flex items-start gap-4 data-[state=open]:animate-in data-[state=closed]:animate-out"
        open={open}
        onOpenChange={onOpenChange}
      >
        <div className="grid gap-1">
          {title && (
            <Toast.Title className="font-semibold text-sm">
              {title}
            </Toast.Title>
          )}
          {description && (
            <Toast.Description className="text-sm text-gray-500">
              {description}
            </Toast.Description>
          )}
        </div>
        <Toast.Close className="absolute top-2 right-2">
          ✕
        </Toast.Close>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-0 right-0 p-6 w-full max-w-sm flex flex-col gap-2" />
    </Toast.Provider>
  );
};

export { ToastComponent };

"use client"

import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider duration={6_000} label="Notifications">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            {props.variant === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-800 dark:text-green-300" aria-hidden="true" />}
            {props.variant === 'destructive' && <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-800 dark:text-red-300" aria-hidden="true" />}
            <div className="grid min-w-0 flex-1 gap-1 break-words">
              {title && <ToastTitle className={props.variant === 'success' ? 'text-green-800 dark:text-green-300' : props.variant === 'destructive' ? 'text-red-800 dark:text-red-300' : undefined}>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

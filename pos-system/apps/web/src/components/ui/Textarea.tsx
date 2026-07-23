import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, fullWidth = true, className = '', ...props }, ref) => {
    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label className="label">
            {label}
            {props.required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          rows={3}
          className={[
            'input resize-none',
            error ? 'border-danger focus:ring-danger/30' : '',
            className,
          ].join(' ')}
          {...props}
        />
        {error && <p className="input-error">{error}</p>}
        {helperText && !error && <p className="helper-text">{helperText}</p>}
      </div>
    )
  },
)
Textarea.displayName = 'Textarea'

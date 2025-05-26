import * as React from "react"
import { CheckIcon } from "lucide-react"

// Simple cn utility function to merge class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function Checkbox({ 
  checked, 
  onCheckedChange, 
  className, 
  id,
  disabled = false,
  ...props 
}) {
  const handleClick = () => {
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked)
    }
  }

  const handleKeyDown = (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
      e.preventDefault()
      if (onCheckedChange) {
        onCheckedChange(!checked)
      }
    }
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        // Base styles
        "w-4 h-4 border-2 rounded flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2",
        // Checked state
        checked 
          ? "bg-blue-600 border-blue-600 text-white focus:ring-blue-500" 
          : "bg-white border-gray-300 hover:border-gray-400 focus:ring-blue-500",
        // Disabled state
        disabled 
          ? "opacity-50 cursor-not-allowed" 
          : "cursor-pointer",
        className
      )}
      {...props}
    >
      {checked && (
        <CheckIcon className="w-3 h-3" />
      )}
    </button>
  )
}

export { Checkbox }
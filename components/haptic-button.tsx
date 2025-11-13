"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import type { ButtonProps } from "@/components/ui/button"
import { forwardRef } from "react"

interface HapticButtonProps extends ButtonProps {
  hapticIntensity?: "light" | "medium" | "heavy"
}

export const HapticButton = forwardRef<HTMLButtonElement, HapticButtonProps>(
  ({ onClick, hapticIntensity = "medium", children, className, ...props }, ref) => {
    const triggerHaptic = () => {
      // Vibration API for haptic feedback
      if ("vibrate" in navigator) {
        const patterns = {
          light: 10,
          medium: 20,
          heavy: 30,
        }
        navigator.vibrate(patterns[hapticIntensity])
      }
    }

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      triggerHaptic()
      onClick?.(e)
    }

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        className={`active:scale-95 transition-transform touch-manipulation ${className}`}
        {...props}
      >
        {children}
      </Button>
    )
  },
)

HapticButton.displayName = "HapticButton"

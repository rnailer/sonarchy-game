"use client"

import { useEffect, useState } from "react"

interface AnimatedTitleProps {
  text: string
  className?: string
}

export function AnimatedTitle({ text, className = "" }: AnimatedTitleProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    console.log("[v0] AnimatedTitle mounted with text:", text)
    // Trigger animation on mount
    setIsVisible(true)
  }, [text])

  return (
    <h1 className={className}>
      {text.split("").map((char, index) => (
        <span
          key={index}
          className="inline-block animate-[letterBounce_0.8s_ease-out_forwards]"
          style={{
            animationDelay: `${index * 0.08}s`,
            opacity: 0,
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </h1>
  )
}

import { cn } from "@/lib/utils"
import { ElementType, ComponentPropsWithoutRef } from "react"

interface StarBorderProps<T extends ElementType> {
  as?: T
  color?: string
  speed?: string
  className?: string
  children: React.ReactNode
  disableBorderAnimation?: boolean
  size?: "default" | "compact"
}

export function StarBorder<T extends ElementType = "button">({
  as,
  className,
  color,
  speed = "6s",
  children,
  disableBorderAnimation = false,
  size = "default",
  ...props
}: StarBorderProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof StarBorderProps<T>>) {
  const Component = as || "button"
  const defaultColor = color || "hsl(var(--foreground))"

  return (
    <Component 
      className={cn(
        "relative inline-block py-[1px] overflow-hidden rounded-[20px]",
        className
      )} 
      {...props}
    >
      {!disableBorderAnimation && (
        <>
          <div
            className={cn(
              "absolute w-[300%] h-[50%] bottom-[-11px] right-[-250%] rounded-full animate-star-movement-bottom z-0",
              "opacity-20 dark:opacity-70" 
            )}
            style={{
              background: `radial-gradient(circle, ${defaultColor}, transparent 10%)`,
              animationDuration: speed,
            }}
          />
          <div
            className={cn(
              "absolute w-[300%] h-[50%] top-[-10px] left-[-250%] rounded-full animate-star-movement-top z-0",
              "opacity-20 dark:opacity-70"
            )}
            style={{
              background: `radial-gradient(circle, ${defaultColor}, transparent 10%)`,
              animationDuration: speed,
            }}
          />
        </>
      )}
      <div className={cn(
        "relative z-1 border text-foreground text-center text-base rounded-[20px]",
        "bg-gradient-to-b from-background/90 to-muted/90 border-border/40",
        "dark:from-background dark:to-muted dark:border-border",
        size === "compact" ? "py-3 px-6" : "py-5 px-8"
      )}>
        {children}
      </div>
    </Component>
  )
}

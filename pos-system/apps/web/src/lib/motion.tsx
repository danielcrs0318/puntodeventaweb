import { type ReactNode } from 'react'
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'

/** Duraciones cortas: fluidas en móvil y respetan prefer-reduced-motion */
export const motionDur = {
  fast: 0.12,
  base: 0.18,
  slow: 0.28,
} as const

export const easeOut = [0.22, 1, 0.36, 1] as const

export const fadeUp = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 3 },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
}

type PageMotionProps = {
  children: ReactNode
  className?: string
} & Omit<HTMLMotionProps<'div'>, 'children'>

/** Entrada de página / sección — desactiva movimiento si el SO lo pide */
export function PageMotion({ children, className, ...rest }: PageMotionProps) {
  const reduce = useReducedMotion()
  if (reduce) {
    return <div className={className}>{children}</div>
  }
  return (
    <motion.div
      className={className}
      initial={fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ duration: motionDur.base, ease: easeOut }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

type StaggerProps = {
  children: ReactNode
  className?: string
  delayChildren?: number
  staggerChildren?: number
}

export function Stagger({
  children,
  className,
  delayChildren = 0,
  staggerChildren = 0.025,
}: StaggerProps) {
  const reduce = useReducedMotion()
  if (reduce) {
    return <div className={className}>{children}</div>
  }
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="animate"
      variants={{
        initial: {},
        animate: {
          transition: { staggerChildren, delayChildren },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) {
    return <div className={className}>{children}</div>
  }
  return (
    <motion.div
      className={className}
      variants={{
        initial: fadeUp.initial,
        animate: fadeUp.animate,
      }}
      transition={{ duration: motionDur.base, ease: easeOut }}
    >
      {children}
    </motion.div>
  )
}

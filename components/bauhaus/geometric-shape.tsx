import type { CSSProperties, HTMLAttributes } from 'react'

export type GeometricShapeName = 'circle' | 'square' | 'triangle' | 'diamond' | 'bar'
export type GeometricColor = 'red' | 'blue' | 'yellow' | 'black' | 'white'
export type GeometricSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type GeometricRotation = 0 | 45 | 90 | -45 | -90

const sizes: Record<GeometricSize, string> = {
  xs: 'h-4 w-4', sm: 'h-6 w-6', md: 'h-10 w-10', lg: 'h-20 w-20', xl: 'h-32 w-32',
}
const colors: Record<GeometricColor, string> = {
  red: 'bg-primary-red', blue: 'bg-primary-blue', yellow: 'bg-primary-yellow', black: 'bg-foreground', white: 'bg-white',
}
const rotations: Record<GeometricRotation, string> = {
  0: 'rotate-0', 45: 'rotate-45', 90: 'rotate-90', '-45': '-rotate-45', '-90': '-rotate-90',
}
const shapes: Record<GeometricShapeName, string> = {
  circle: 'rounded-full', square: '', triangle: 'clip-triangle', diamond: 'rotate-45', bar: 'h-1 w-20',
}

export type GeometricShapeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'color'> & {
  shape: GeometricShapeName
  size?: GeometricSize
  color?: GeometricColor
  rotation?: GeometricRotation
  opacity?: number
  decorative?: boolean
}

export function GeometricShape({
  shape, size = 'md', color = 'red', rotation = 0, opacity, decorative = true,
  className = '', style, ...props
}: GeometricShapeProps) {
  const classNames = [
    'pointer-events-none inline-block shrink-0',
    shape === 'bar' ? '' : sizes[size],
    colors[color], shapes[shape], rotations[rotation], className,
  ].filter(Boolean).join(' ')
  const shapeStyle: CSSProperties | undefined = opacity === undefined ? style : { ...style, opacity }
  return <span aria-hidden={decorative ? true : undefined} className={classNames} style={shapeStyle} {...props} />
}

export function GeometricCircle(props: Omit<GeometricShapeProps, 'shape'>) {
  return <GeometricShape {...props} shape="circle" />
}
export function GeometricSquare(props: Omit<GeometricShapeProps, 'shape'>) {
  return <GeometricShape {...props} shape="square" />
}
export function GeometricTriangle(props: Omit<GeometricShapeProps, 'shape'>) {
  return <GeometricShape {...props} shape="triangle" />
}
export function GeometricBar(props: Omit<GeometricShapeProps, 'shape'>) {
  return <GeometricShape {...props} shape="bar" />
}

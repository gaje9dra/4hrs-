import type { GeometricShapeProps } from './geometric-shape'
import { GeometricShape } from './geometric-shape'

export type GeometricDecorationProps = Omit<GeometricShapeProps, 'shape'> & {
  shape: 'circle' | 'square' | 'triangle' | 'line'
}

export function GeometricDecoration({ shape, ...props }: GeometricDecorationProps) {
  return <GeometricShape {...props} shape={shape === 'line' ? 'bar' : shape} />
}

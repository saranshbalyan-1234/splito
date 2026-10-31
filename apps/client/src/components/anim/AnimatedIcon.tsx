import {createElement, useEffect, useRef} from 'react'
import {View} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, {Circle, Path} from 'react-native-svg'
import {type LucideIconData} from 'lucide-react-native'

import {useButtonContext} from '#/components/Button'
import {type Props, useCommonSVGProps} from '#/components/icons/common'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

/*
 * The one animated-icon primitive (F-1713, owner 96, 210, 213). Motion only where it explains a change; the
 * twinkle (sparkles) and plus-to-X (no FAB menu exists) of the owner-96 list are not built: they would be decoration. Every animated
 * icon in the app is this component bound to a Lucide glyph (ISC) by
 * `createAnimatedIcon`; nothing else draws a moving icon. Motion runs on the
 * UI thread (Reanimated shared values), is under 400 ms, and ends at rest;
 * with reduced motion or the Animations preference off the icon shows its
 * end state at once. Variants:
 *
 *   draw    the stroke draws in on mount, again on press (check on Save / Settle / Accept)
 *   tick    the stroke redraws each time `playKey` goes up (Activity when an item lands)
 *   lid     the `moving` parts lift while `active` or while the enclosing Button is hovered, pressed or focused (trash)
 *   rotate  the glyph turns `turn` degrees while `active` (chevron on expand)
 */
export type AnimatedIconVariant = 'draw' | 'tick' | 'lid' | 'rotate'

export type AnimatedIconOptions = {
  variant: AnimatedIconVariant
  /** Outline length for draw and tick: the dash length that hides the whole stroke. */
  length?: number
  /** Indexes into the glyph's nodes that move apart from the rest (the trash lid). */
  moving?: number[]
  /** Degrees for rotate. */
  turn?: number
  strokeWidth?: number
}

export type AnimatedIconProps = Omit<Props, 'strokeWidth'> & {
  /** Drives lid and rotate; lid also follows its enclosing Button's hover and press. */
  active?: boolean
  /** Tick redraws whenever this goes up. */
  playKey?: number
}

const AnimatedPath = Animated.createAnimatedComponent(Path)
const ShapeFor = {path: Path, circle: Circle} as const

type Node = readonly [string, Record<string, string | number>]

function Nodes({nodes, dash, dashProps}: {
  nodes: Node[]
  dash?: number
  dashProps?: ReturnType<typeof useAnimatedProps>
}) {
  return nodes.map(([tag, {key: _key, ...attrs}], i) => {
    if (dash && tag === 'path')
      return (
        <AnimatedPath
          key={i}
          {...(attrs as object)}
          animatedProps={dashProps}
          strokeDasharray={`${dash} ${dash}`}
        />
      )
    const Shape = ShapeFor[tag as keyof typeof ShapeFor] as React.ComponentType<object> | undefined
    return Shape ? createElement(Shape, {key: i, ...attrs}) : null
  })
}

/** One 24x24 Svg of some of the glyph's nodes. */
function Layer({nodes, color, size, strokeWidth, dash, dashProps}: {
  nodes: Node[]
  color: string
  size: number
  strokeWidth: number
  dash?: number
  dashProps?: ReturnType<typeof useAnimatedProps>
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Nodes nodes={nodes} dash={dash} dashProps={dashProps} />
    </Svg>
  )
}

const MS = 220

export function AnimatedIcon({
  data,
  variant,
  length = 24,
  moving = [],
  turn = 0,
  strokeWidth = 2,
  active,
  playKey = 0,
  ...props
}: AnimatedIconProps & AnimatedIconOptions & {data: LucideIconData}) {
  const {fill, size, style} = useCommonSVGProps(props)
  const color = String(fill)
  const isReduced = useShouldReduceMotion()
  const {pressed, interacting} = useButtonContext()
  const nodes = data.node as Node[]

  /* 0 = rest at the start of the motion, 1 = its end. Reduced motion jumps straight to the end state. */
  const isOn = variant === 'lid' ? (active ?? interacting) : (active ?? true)
  const target = variant === 'rotate' || variant === 'lid' ? Number(isOn) : 1
  /* A press redraws the check: the enclosing Button's pressed state is part of the effect's inputs. */
  const isRedrawn = variant === 'draw' && pressed
  const progress = useSharedValue(isReduced || variant === 'tick' ? target : 0)
  const prevKey = useRef(playKey)
  const hasDrawn = useRef(false)

  useEffect(() => {
    if (isReduced) {
      cancelAnimation(progress)
      progress.set(target)
      return
    }
    if (variant === 'draw') {
      /* Draws on mount and when a press starts; a release is not a new draw. */
      if (hasDrawn.current && !isRedrawn) return
      hasDrawn.current = true
      progress.set(0)
      progress.set(withTiming(1, {duration: 320, easing: Easing.out(Easing.cubic)}))
    } else if (variant === 'rotate' || variant === 'lid') {
      progress.set(withTiming(target, {duration: MS, easing: Easing.out(Easing.cubic)}))
    }
  }, [isReduced, variant, target, progress, isRedrawn])

  useEffect(() => {
    const isUp = playKey > prevKey.current
    prevKey.current = playKey
    if (isReduced) return
    if (variant === 'tick' && isUp) {
      progress.set(0)
      progress.set(withTiming(1, {duration: 380, easing: Easing.out(Easing.cubic)}))
    }
  }, [playKey, isReduced, variant, progress])

  const dashProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.get()),
  }))
  const turnStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${turn * progress.get()}deg`}],
  }))
  /* The lid swings open about its left hinge and lifts a little. */
  const lidStyle = useAnimatedStyle(() => ({
    transformOrigin: '12.5% 25%',
    transform: [
      {translateY: (-1.5 * size * progress.get()) / 24},
      {rotate: `${-16 * progress.get()}deg`},
    ],
  }))

  const base = nodes.filter((_, i) => !moving.includes(i))
  const part = nodes.filter((_, i) => moving.includes(i))
  const layer = (n: Node[], dash?: number) => (
    <Layer nodes={n} color={color} size={size} strokeWidth={strokeWidth} dash={dash} dashProps={dashProps} />
  )
  const box = [{width: size, height: size}, style]

  switch (variant) {
    case 'draw':
    case 'tick':
      return <View style={box}>{layer(nodes, length)}</View>
    case 'rotate':
      return (
        <Animated.View style={[box, turnStyle]}>{layer(nodes)}</Animated.View>
      )
    case 'lid':
      return (
        <View style={box}>
          {layer(base)}
          <Animated.View style={[{position: 'absolute', left: 0, top: 0}, lidStyle]}>
            {layer(part)}
          </Animated.View>
        </View>
      )
  }
}

/** A Lucide glyph bound to a variant, with the icon API every other icon has (`size`, `fill`, `style`). */
export function createAnimatedIcon(data: LucideIconData, options: AnimatedIconOptions) {
  function AnimatedGlyph(props: AnimatedIconProps) {
    return <AnimatedIcon data={data} {...options} {...props} />
  }
  AnimatedGlyph.displayName = `AnimatedIcon(${data.name})`
  return AnimatedGlyph
}

/**
 * Swaps an outline glyph for its filled one when `isActive` turns on (tab, drawer and sidebar icons) and the new
 * glyph pops in (scale and opacity, 180 ms, UI thread). Only one glyph is mounted at a time, as before, so a tab
 * switch costs no extra render; `playKey` reaches the glyphs (the Activity tick).
 */
export function MorphIcon({
  outline: Outline,
  filled: Filled,
  isActive,
  playKey,
  ...props
}: Props & {
  outline: React.ComponentType<Props & {playKey?: number}>
  filled: React.ComponentType<Props & {playKey?: number}>
  isActive: boolean
  playKey?: number
}) {
  const isReduced = useShouldReduceMotion()
  const progress = useSharedValue(1)
  const isFirst = useRef(true)
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    if (isReduced) return
    progress.set(0)
    progress.set(withTiming(1, {duration: 180, easing: Easing.out(Easing.cubic)}))
  }, [isActive, isReduced, progress])
  const popStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * progress.get(),
    transform: [{scale: 0.8 + 0.2 * progress.get()}],
  }))
  const Glyph = isActive ? Filled : Outline
  return (
    <Animated.View style={[popStyle, props.style as object]}>
      <Glyph {...props} {...(playKey === undefined ? {} : {playKey})} />
    </Animated.View>
  )
}

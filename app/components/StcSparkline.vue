<script setup lang="ts">
const props = withDefaults(defineProps<{
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  dot?: string
}>(), {
  width: 240,
  height: 38,
  stroke: '#ea9d13',
  fill: '#ea9d13',
  dot: '#f5c842',
})

// Catmull-Rom → cubic bezier
function smooth(p: { x: number; y: number }[]) {
  if (p.length < 2) return ''
  let d = `M ${p[0]!.x} ${p[0]!.y}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]!, p1 = p[i]!, p2 = p[i + 1]!, p3 = p[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}

const gradId = `spark-${Math.random().toString(36).slice(2, 9)}`

const paths = computed(() => {
  const vals = props.data ?? []
  if (vals.length < 2) return { line: '', area: '', last: null as { x: number; y: number } | null }
  const W = props.width, H = props.height, pad = 4
  const min = Math.min(...vals), max = Math.max(...vals)
  const rng = (max - min) || 1
  const pts = vals.map((v, i) => ({
    x: pad + (W - 2 * pad) * i / (vals.length - 1),
    y: pad + (H - 2 * pad) * (1 - (v - min) / rng),
  }))
  const line = smooth(pts)
  const last = pts[pts.length - 1]!
  const first = pts[0]!
  const area = line + ` L ${last.x} ${H} L ${first.x} ${H} Z`
  return { line, area, last }
})
</script>

<template>
  <svg
    class="stc-spark"
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    role="img"
    aria-label="sparkline"
  >
    <defs>
      <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="fill" stop-opacity="0.22" />
        <stop offset="100%" :stop-color="fill" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path v-if="paths.area" :d="paths.area" :fill="`url(#${gradId})`" />
    <path
      v-if="paths.line"
      :d="paths.line"
      fill="none"
      :stroke="stroke"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle
      v-if="paths.last"
      :cx="paths.last.x"
      :cy="paths.last.y"
      r="2.6"
      :fill="dot"
    />
  </svg>
</template>

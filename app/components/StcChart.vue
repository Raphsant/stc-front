<script setup lang="ts">
interface DataPoint { label: string; value: number }

const props = withDefaults(defineProps<{
  data: DataPoint[]
  height?: number
}>(), {
  height: 320,
})

const svgEl  = ref<SVGSVGElement | null>(null)
const wrapEl = ref<HTMLDivElement | null>(null)

const readout = reactive({
  visible: false,
  x: 0,
  y: 0,
  value: '',
  label: '',
})

let pts: { x: number; y: number; value: number; label: string }[] = []

// ── helpers ────────────────────────────────────────────────
function niceNum(x: number) {
  const p = Math.pow(10, Math.floor(Math.log10(x)))
  const f = x / p
  const nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10
  return nf * p
}
function fmt(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0) + 'k' : String(n)
}
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

// ── build SVG ──────────────────────────────────────────────
const svgContent = computed(() => {
  const data = props.data
  if (!data?.length) return ''

  const W = 820, H = props.height
  const padL = 42, padR = 14, padT = 14, padB = 30
  const plotW = W - padL - padR, plotH = H - padT - padB

  const maxV = Math.max(...data.map(d => d.value), 1)
  const step = niceNum(maxV / 5)
  const yMax = Math.ceil(maxV / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= yMax + 1; v += step) ticks.push(v)

  const xFn = (i: number) => padL + (data.length === 1 ? plotW / 2 : plotW * i / (data.length - 1))
  const yFn = (v: number) => padT + plotH * (1 - v / yMax)

  pts = data.map((d, i) => ({ x: xFn(i), y: yFn(d.value), value: d.value, label: d.label }))

  const showEvery = Math.ceil(data.length / 8)
  const linePath = smooth(pts)
  const last = pts[pts.length - 1]!
  const first = pts[0]!
  const areaPath = linePath + ` L ${last.x} ${padT + plotH} L ${first.x} ${padT + plotH} Z`

  let out = `
<defs>
  <linearGradient id="stcChartFill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stop-color="#ea9d13" stop-opacity="0.22"/>
    <stop offset="80%"  stop-color="#ea9d13" stop-opacity="0.01"/>
    <stop offset="100%" stop-color="#ea9d13" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="stcChartLine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%"   stop-color="#ea9d13"/>
    <stop offset="100%" stop-color="#f5c842"/>
  </linearGradient>
</defs>`

  // Y grid + labels
  ticks.forEach(v => {
    const yy = yFn(v)
    out += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="#1a1a1a" stroke-width="1"/>`
    out += `<text x="${padL - 10}" y="${yy + 3.5}" text-anchor="end" font-family="Inter" font-size="10" fill="#6b6b6b">${fmt(v)}</text>`
  })

  // X labels (thinned)
  pts.forEach((p, i) => {
    if (i % showEvery === 0 || i === pts.length - 1) {
      out += `<text x="${p.x}" y="${H - 10}" text-anchor="middle" font-family="Inter" font-size="9.5" fill="#6b6b6b">${p.label}</text>`
    }
  })

  // area + line (no static data dots)
  out += `<path d="${areaPath}" fill="url(#stcChartFill)"/>`
  out += `<path d="${linePath}" fill="none" stroke="url(#stcChartLine)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`

  // hover crosshair: dashed vertical line + hollow gold dot
  out += `<line class="stc-cross" y1="${padT}" y2="${padT + plotH}" stroke="rgba(234,157,19,0.45)" stroke-width="1" stroke-dasharray="2 4" opacity="0"/>`
  out += `<circle class="stc-cdot" r="4" style="fill:var(--bg)" stroke="#ea9d13" stroke-width="2" opacity="0"/>`

  // hot zone
  out += `<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent"/>`

  return out
})

// ── hover ──────────────────────────────────────────────────
function onMouseMove(e: MouseEvent) {
  if (!pts.length || !svgEl.value) return
  const rect = svgEl.value.getBoundingClientRect()
  const vb = svgEl.value.viewBox.baseVal
  const mx = (e.clientX - rect.left) / rect.width * vb.width

  let best = pts[0]!, bd = Infinity
  pts.forEach(p => {
    const d = Math.abs(p.x - mx)
    if (d < bd) { bd = d; best = p }
  })

  const cross = svgEl.value.querySelector('.stc-cross')
  const dot   = svgEl.value.querySelector('.stc-cdot')
  if (cross) {
    cross.setAttribute('x1', String(best.x))
    cross.setAttribute('x2', String(best.x))
    cross.setAttribute('opacity', '1')
  }
  if (dot) {
    dot.setAttribute('cx', String(best.x))
    dot.setAttribute('cy', String(best.y))
    dot.setAttribute('opacity', '1')
  }

  readout.value   = best.value.toLocaleString('es') + ' registros'
  readout.label   = best.label
  readout.x       = (best.x / vb.width)  * rect.width
  readout.y       = (best.y / vb.height) * rect.height
  readout.visible = true
}

function onMouseLeave() {
  readout.visible = false
  if (!svgEl.value) return
  const cross = svgEl.value.querySelector('.stc-cross')
  const dot   = svgEl.value.querySelector('.stc-cdot')
  cross?.setAttribute('opacity', '0')
  dot?.setAttribute('opacity', '0')
}
</script>

<template>
  <div ref="wrapEl" class="relative" style="margin-top:16px">
    <svg
      ref="svgEl"
      :viewBox="`0 0 820 ${height}`"
      preserveAspectRatio="none"
      class="block w-full"
      :style="{ height: height + 'px' }"
      v-html="svgContent"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
    />
    <div
      class="stc-readout"
      :style="{
        left: readout.x + 'px',
        top:  readout.y + 'px',
        opacity: readout.visible ? 1 : 0,
      }"
    >
      <div class="rv">{{ readout.value }}</div>
      <div class="rl">{{ readout.label }}</div>
    </div>
  </div>
</template>

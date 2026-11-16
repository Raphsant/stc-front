// v-sheet="close" — comportamiento nativo para las hojas inferiores en móvil:
//
//  · Arrastrar hacia abajo mueve la hoja con el dedo; al soltar pasado el
//    umbral (o con un gesto rápido) se cierra, si no vuelve a su sitio.
//  · Si el dedo empieza sobre contenido con scroll, el arrastre solo toma el
//    control cuando ese contenido ya está arriba del todo.
//  · Mientras la hoja está abierta la página de detrás no se desplaza
//    (clase `stc-sheet-open` en <html>, ver main.css).
//
// El valor es la función que cierra la hoja; con null/undefined no hace nada
// (útil cuando la misma hoja es un panel lateral en pantallas grandes).

import type { Directive } from 'vue'

const CLOSE_DISTANCE = 110   // px arrastrados para cerrar al soltar
const FLICK_DISTANCE = 36    // px mínimos para un gesto rápido
const FLICK_VELOCITY = 0.5   // px/ms
const START_SLOP = 6         // px antes de decidir que es un arrastre

interface SheetState {
  close: (() => void) | null
  cleanup: () => void
}
const states = new WeakMap<HTMLElement, SheetState>()
let openCount = 0

function lock() {
  if (++openCount === 1) document.documentElement.classList.add('stc-sheet-open')
}
function unlock() {
  openCount = Math.max(0, openCount - 1)
  if (openCount === 0) document.documentElement.classList.remove('stc-sheet-open')
}

/** Primer ancestro con scroll vertical real entre el objetivo y la hoja. */
function findScroller(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  let node = target as HTMLElement | null
  while (node && node !== root.parentElement) {
    if (node.scrollHeight > node.clientHeight + 1) {
      const oy = getComputedStyle(node).overflowY
      if (oy === 'auto' || oy === 'scroll') return node
    }
    if (node === root) break
    node = node.parentElement
  }
  return null
}

function setup(el: HTMLElement, state: SheetState) {
  // Las hojas de Nuxt UI envuelven nuestro contenido: se mueve el diálogo entero.
  const sheet = (el.closest('[data-slot="content"][role="dialog"]') as HTMLElement | null) ?? el

  let active = false       // hay un dedo/ratón abajo
  let dragging = false
  let x0 = 0, y0 = 0, t0 = 0, dy = 0
  let scroller: HTMLElement | null = null
  let suppressClick = false

  const start = (x: number, y: number, target: EventTarget | null) => {
    if (!state.close) return
    active = true
    dragging = false
    x0 = x; y0 = y; dy = 0; t0 = performance.now()
    scroller = findScroller(target, el)
  }

  /** Devuelve true si el evento debe cancelarse (preventDefault). */
  const move = (x: number, y: number): boolean => {
    if (!active) return false
    const mx = x - x0
    dy = y - y0
    if (!dragging) {
      if (Math.abs(dy) < START_SLOP && Math.abs(mx) < START_SLOP) return false
      const vertical = Math.abs(dy) > Math.abs(mx)
      if (vertical && dy > 0 && (!scroller || scroller.scrollTop <= 0)) {
        dragging = true
        sheet.style.transition = 'none'
        sheet.style.willChange = 'transform'
      } else {
        // Gesto vertical fuera de una zona con scroll: no debe mover la página.
        return vertical && !scroller
      }
    }
    sheet.style.transform = `translateY(${Math.max(0, dy)}px)`
    return true
  }

  const end = () => {
    if (!active) return
    active = false
    if (!dragging) return
    dragging = false
    suppressClick = true
    setTimeout(() => { suppressClick = false }, 0)

    const elapsed = Math.max(1, performance.now() - t0)
    const flick = dy > FLICK_DISTANCE && dy / elapsed > FLICK_VELOCITY
    sheet.style.transition = 'transform .2s cubic-bezier(.2,.8,.2,1)'
    sheet.style.willChange = ''
    if ((dy > CLOSE_DISTANCE || flick) && state.close) {
      sheet.style.transform = 'translateY(100%)'
      const close = state.close
      setTimeout(close, 180)
    } else {
      sheet.style.transform = ''
      setTimeout(() => { if (!dragging) sheet.style.transition = '' }, 220)
    }
  }

  // Táctil: touch events, porque touchmove se puede cancelar de forma fiable.
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]!
    start(t.clientX, t.clientY, e.target)
  }
  const onTouchMove = (e: TouchEvent) => {
    const t = e.touches[0]
    if (t && move(t.clientX, t.clientY) && e.cancelable) e.preventDefault()
  }
  // Ratón (escritorio estrecho / pruebas)
  const onMouseDown = (e: MouseEvent) => { if (e.button === 0) start(e.clientX, e.clientY, e.target) }
  const onMouseMove = (e: MouseEvent) => { if (move(e.clientX, e.clientY)) e.preventDefault() }
  // Tras arrastrar, el clic que sigue no debe activar lo que hubiera debajo.
  const onClickCapture = (e: MouseEvent) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation() }
  }

  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  el.addEventListener('touchend', end)
  el.addEventListener('touchcancel', end)
  el.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', end)
  el.addEventListener('click', onClickCapture, true)

  state.cleanup = () => {
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', end)
    el.removeEventListener('touchcancel', end)
    el.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', end)
    el.removeEventListener('click', onClickCapture, true)
  }
}

const vSheet: Directive<HTMLElement, (() => void) | null | undefined> = {
  mounted(el, binding) {
    const state: SheetState = { close: binding.value ?? null, cleanup: () => {} }
    states.set(el, state)
    setup(el, state)
    lock()
  },
  updated(el, binding) {
    const state = states.get(el)
    if (state) state.close = binding.value ?? null
  },
  // La hoja sigue en el DOM durante la animación de salida: se libera el
  // bloqueo en cuanto empieza a irse.
  beforeUnmount(el) {
    const state = states.get(el)
    if (!state) return
    state.cleanup()
    states.delete(el)
    unlock()
  },
  getSSRProps: () => ({}),
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('sheet', vSheet)
})

import {HOLD, intent, pullDistance, THRESHOLD} from '#/lib/refresh/pullMath'

/**
 * The phone-web pull gesture (iOS Safari, Android Chrome). Bluesky has none on web, so this is the one place it lives;
 * `PullSurface` hands it the DOM nodes of each screen's list and it moves them directly: no React render per frame
 * (owner 166). The window scrolls (ARCHITECTURE 23), so a pull is a touch that starts with the window at the top and
 * moves down; anything else is left to the browser. While pulling it cancels the browser's own overscroll (iOS rubber
 * band, Android's pull to refresh) and moves only the list under the header: the header never moves.
 */
export type Surface = {
  /** The screen around the list: a touch must start inside it. */
  screen: HTMLElement
  /** The list's content, moved down while pulling. */
  content: HTMLElement
  /** The strip above the content that holds the spinner (or, under reduced motion, the label). */
  indicator: HTMLElement
  spinner: HTMLElement
  label: HTMLElement
  /** Read live: the person can change it while the screen is up. */
  reduced: () => boolean
  texts: () => {pull: string; release: string; refreshing: string}
  refresh: () => Promise<unknown>
}

const surfaces = new Set<Surface>()
let gesture: {surface: Surface; x0: number; y0: number; state: 'pending' | 'pull' | 'ignore'; pull: number} | null = null
let busy: Surface | null = null
let settleTimer: ReturnType<typeof setTimeout> | undefined

const scrollTop = () => window.scrollY || document.documentElement.scrollTop || 0

/** Whether a scroller between the touch and the page is itself scrolled down: that one takes the touch. */
function insideScrolledScroller(target: Element) {
  for (let el: Element | null = target; el && el !== document.documentElement; el = el.parentElement) {
    if (el === document.body) break
    const {overflowY} = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight && el.scrollTop > 0) return true
  }
  return false
}

function paint(s: Surface, pull: number, mode: 'drag' | 'hold' | 'rest') {
  const refreshing = busy === s
  const reduced = s.reduced()
  const ready = pull >= THRESHOLD
  const progress = Math.min(1, pull / THRESHOLD)
  s.content.style.transition = mode === 'drag' ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)'
  s.indicator.style.transition = mode === 'drag' ? 'none' : 'height 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms'
  if (reduced) {
    /* A simpler indicator: nothing moves; a label says where the gesture is. */
    s.content.style.transform = ''
    s.indicator.style.height = 'auto'
    s.indicator.style.opacity = pull > 0 || refreshing ? '1' : '0'
    s.spinner.style.display = 'none'
    s.label.style.display = 'block'
    const texts = s.texts()
    s.label.textContent = refreshing ? texts.refreshing : ready ? texts.release : texts.pull
  } else {
    s.content.style.transform = pull > 0 ? `translate3d(0, ${pull}px, 0)` : ''
    s.indicator.style.height = `${pull}px`
    s.indicator.style.opacity = String(Math.min(1, pull / 28))
    s.spinner.style.display = 'block'
    s.label.style.display = 'none'
    s.spinner.style.transform = refreshing ? '' : `rotate(${progress * 270}deg) scale(${ready ? 1.08 : 1})`
    s.spinner.className = refreshing ? 'rotate-500ms' : ''
  }
  s.indicator.setAttribute('aria-hidden', pull > 0 || refreshing ? 'false' : 'true')
}

function settle(s: Surface) {
  paint(s, 0, 'rest')
  clearTimeout(settleTimer)
  // Back at rest the transform goes away entirely, so nothing inside keeps a containing block.
  settleTimer = setTimeout(() => {
    if (busy !== s && gesture?.surface !== s) {
      s.content.style.transition = ''
      s.indicator.style.transition = ''
    }
  }, 260)
}

function startRefresh(s: Surface) {
  busy = s
  paint(s, HOLD, 'hold')
  Promise.resolve()
    .then(s.refresh)
    .catch(() => {})
    .finally(() => {
      busy = null
      if (s.content.isConnected) settle(s)
    })
}

function onTouchStart(e: TouchEvent) {
  if (gesture || busy || e.touches.length !== 1 || scrollTop() > 0) return
  const target = e.target as Element | null
  if (!target || !('closest' in target)) return
  const surface = [...surfaces].reverse().find(s => s.screen.contains(target))
  if (!surface || insideScrolledScroller(target)) return
  clearTimeout(settleTimer)
  const touch = e.touches[0]!
  gesture = {surface, x0: touch.clientX, y0: touch.clientY, state: 'pending', pull: 0}
}

function onTouchMove(e: TouchEvent) {
  const g = gesture
  if (!g || g.state === 'ignore') return
  const touch = e.touches[0]
  if (!touch) return
  const dx = touch.clientX - g.x0
  const dy = touch.clientY - g.y0
  if (g.state === 'pending') {
    g.state = scrollTop() > 0 ? 'ignore' : intent(dx, dy)
    if (g.state !== 'pull') return
  }
  if (dy <= 0) {
    // Back up past where it started: give the touch back to the browser.
    g.state = 'ignore'
    settle(g.surface)
    return
  }
  // Cancels the browser's overscroll; not cancelable once it has started scrolling, which is then no pull.
  if (e.cancelable) e.preventDefault()
  g.pull = pullDistance(dy)
  paint(g.surface, g.pull, 'drag')
}

function onTouchEnd() {
  const g = gesture
  gesture = null
  if (!g || g.state !== 'pull') return
  if (g.pull >= THRESHOLD) startRefresh(g.surface)
  else settle(g.surface)
}

let installed = false
function install() {
  if (installed) return
  installed = true
  /* Non-passive on purpose: a passive touchmove cannot cancel the overscroll. Android Chrome also needs the root not to chain it into its own refresh. */
  window.addEventListener('touchstart', onTouchStart, {passive: true})
  window.addEventListener('touchmove', onTouchMove, {passive: false})
  window.addEventListener('touchend', onTouchEnd, {passive: true})
  window.addEventListener('touchcancel', onTouchEnd, {passive: true})
  document.documentElement.style.overscrollBehaviorY = 'contain'
}
function uninstall() {
  installed = false
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
  window.removeEventListener('touchcancel', onTouchEnd)
  document.documentElement.style.overscrollBehaviorY = ''
}

/** Makes a screen's list pullable; returns the undo. */
export function registerSurface(s: Surface) {
  surfaces.add(s)
  install()
  return () => {
    surfaces.delete(s)
    if (gesture?.surface === s) gesture = null
    if (busy === s) busy = null
    if (surfaces.size === 0) uninstall()
  }
}

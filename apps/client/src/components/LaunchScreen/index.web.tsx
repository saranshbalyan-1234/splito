/*
 * Web: the launch screen is the `#launch` element in public/index.html, animated by CSS from first paint, before any
 * script. React draws nothing for it; this only fades it out (~200 ms) once the app is ready. It is `position: fixed`
 * over `#root`, which renders underneath meanwhile, so removing it shifts nothing.
 */
export function LaunchScreen() {
  return null
}

/** Ends the launch screen: the store is open (or cannot be), so the first screen shows. Safe to call twice. */
export function markLaunchReady() {
  const el = document.getElementById('launch')
  if (!el || el.dataset.leaving) return
  el.dataset.leaving = 'true'
  el.style.pointerEvents = 'none'
  const done = () => el.remove()
  el.animate(
    {opacity: [1, 0]},
    {duration: 200, easing: 'ease-out', fill: 'forwards'},
  ).finished.then(done, done)
}

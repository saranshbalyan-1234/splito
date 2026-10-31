import {readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

/** Every file under `dir` (recursive) whose name matches `pattern`. */
export function filesUnder(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, {withFileTypes: true})
    .flatMap(e => (e.isDirectory() ? filesUnder(join(dir, e.name), pattern) : [join(dir, e.name)]))
    .filter(f => pattern.test(f))
}

/** The text of every such file, for the bundle specs that look for (or for the absence of) markers in a shipped export. */
export function readFiles(dir: string, pattern: RegExp) {
  return filesUnder(dir, pattern).map(file => ({file, text: readFileSync(file, 'utf8')}))
}

/** What why-did-you-render and its report store leave in a bundle (ARCHITECTURE 17): none of these may ship. */
export const WDYR_MARKERS = ['wdyrStore', '__wdyr', 'whyDidYouRender', '@welldone-software']

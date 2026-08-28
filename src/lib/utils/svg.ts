/**
 * Utilities for safely embedding Typst-rendered SVG into the page.
 *
 * Typst's SVG output embeds a `<style>` block whose rules are *unscoped* –
 * in particular `svg { fill: none; }`, which would otherwise leak out of the
 * document SVG and turn every icon in the app invisible. These helpers scope
 * every rule under the document root so the styles stay contained.
 */

/** CSS selector that identifies the document root in the injected markup. */
const ROOT_SELECTOR = '.typst-doc';

/**
 * Rewrite a Typst SVG string so its embedded `<style>` rules only apply
 * inside the document (descendant of `.typst-doc`).
 *
 * - Element/tag and class selectors are prefixed with the root selector.
 * - `@keyframes` are renamed with a document-specific suffix so they can't
 *   collide with other animations on the page, and left unscoped (keyframe
 *   names are global by nature).
 */
export function scopeTypstSvg(svg: string): string {
  const styleMatch = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!styleMatch) return svg;

  const scopedCss = scopeCssRules(styleMatch[1]);
  return svg.replace(styleMatch[0], `<style>${scopedCss}</style>`);
}

function scopeCssRules(css: string): string {
  // Parse into top-level rules with a simple brace counter, so nested blocks
  // (keyframe steps, etc.) stay intact. Each entry is `{ selector, body }`
  // where `body` is the raw text between the outer braces.
  const rules: { selector: string; body: string }[] = [];
  let i = 0;
  while (i < css.length) {
    // Skip whitespace / stray chars before a selector.
    const start = i;
    while (i < css.length && css[i] !== '{') i++;
    if (i >= css.length) break;
    const selector = css.slice(start, i).trim();
    i++; // skip '{'
    let depth = 1;
    const bodyStart = i;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    const body = css.slice(bodyStart, i - 1); // strip closing '}'
    rules.push({ selector, body });
  }

  // Rename animation references inside rule bodies so the renamed @keyframes
  // definitions stay wired up (`animation: name …` / `animation-name: name`).
  const referenceBody = (body: string): string =>
    body.replace(/(animation(?:-name)?\s*:\s*)([\w-]+)/g, '$1typst-doc-$2');

  return rules
    .map(({ selector, body }) => {
      // `@keyframes name { … }` – rename the animation, keep the nested
      // keyframe steps unscoped (they're global by nature).
      if (selector.startsWith('@keyframes')) {
        const renamed = selector.replace(/@keyframes\s+([\w-]+)/, '@keyframes typst-doc-$1');
        return `${renamed} {${body}}`;
      }
      // Regular rule: prefix every selector with the root, and rewire any
      // animation names to the renamed keyframes.
      const scopedSelectors = selector
        .split(',')
        .map((sel) => sel.trim())
        .filter(Boolean)
        .map((sel) => `${ROOT_SELECTOR} ${sel}`)
        .join(', ');
      return `${scopedSelectors} {${referenceBody(body)}}`;
    })
    .join('');
}

function hasVisibleBackground(style: CSSStyleDeclaration) {
  const backgroundColor = style.getPropertyValue('background-color').trim()
  const background = style.getPropertyValue('background').trim()
  return Boolean(backgroundColor || background)
}

const BG_FALLBACK_CLASS = 'bg-transparent'
const TEXT_FALLBACK_CLASS = 'text-current'

function hasClassTokenWithPrefix(element: Element, prefixes: string[]) {
  for (const className of Array.from(element.classList)) {
    for (const prefix of prefixes) {
      if (className.startsWith(prefix) || className.includes(`:${prefix}`)) {
        return true
      }
    }
  }
  return false
}

function pairElementClassTokens(element: Element) {
  const hasTextClass = hasClassTokenWithPrefix(element, ['text-'])
  const hasBackgroundClass = hasClassTokenWithPrefix(element, ['bg-'])
  const htmlElement = element as HTMLElement

  if (hasTextClass && !hasBackgroundClass) {
    element.classList.add(BG_FALLBACK_CLASS)
    if (!htmlElement.style.backgroundColor) {
      htmlElement.style.backgroundColor = 'transparent'
    }
  }

  if (hasBackgroundClass && !hasTextClass) {
    element.classList.add(TEXT_FALLBACK_CLASS)
    if (!htmlElement.style.color) {
      htmlElement.style.color = 'inherit'
    }
  }
}

function pairDomClassTokens() {
  if (typeof document === 'undefined') {
    return
  }

  document.querySelectorAll('[class]').forEach((element) => {
    pairElementClassTokens(element)
  })
}

let classTokenObserver: MutationObserver | null = null

function observeClassTokenChanges() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return
  }

  if (classTokenObserver) {
    return
  }

  classTokenObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        pairElementClassTokens(mutation.target)
      }

      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) {
            return
          }
          if (node.hasAttribute('class')) {
            pairElementClassTokens(node)
          }
          node.querySelectorAll('[class]').forEach((childElement) => {
            pairElementClassTokens(childElement)
          })
        })
      }
    }
  })

  classTokenObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    childList: true,
    subtree: true,
  })
}

export function ensureCssColorPairs() {
  if (typeof document === 'undefined' || typeof CSSRule === 'undefined') {
    return
  }

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }

    for (const rule of Array.from(rules)) {
      if (rule.type !== CSSRule.STYLE_RULE) {
        continue
      }

      const styleRule = rule as CSSStyleRule
      const hasTextColor = Boolean(styleRule.style.getPropertyValue('color').trim())
      const hasBackground = hasVisibleBackground(styleRule.style)

      if (hasTextColor && !hasBackground) {
        styleRule.style.setProperty('background-color', 'transparent')
      } else if (hasBackground && !hasTextColor) {
        styleRule.style.setProperty('color', 'inherit')
      }
    }
  }

  pairDomClassTokens()
  observeClassTokenChanges()
}

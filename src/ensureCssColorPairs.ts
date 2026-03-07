function hasVisibleBackground(style: CSSStyleDeclaration) {
  const backgroundColor = style.getPropertyValue('background-color').trim()
  const background = style.getPropertyValue('background').trim()
  return Boolean(backgroundColor || background)
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
}

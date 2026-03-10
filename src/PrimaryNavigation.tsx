import type { RefObject } from 'react'
import { focusTargetClass, focusTargetScrollMarginClass } from './hashNavigation'

type PrimaryNavigationPath = '/' | '/plan-du-site' | '/accessibilite' | '/moderation'

type PrimaryNavigationProps = {
  currentPath?: PrimaryNavigationPath | null
  navId?: string
  navRef?: RefObject<HTMLElement | null>
  className?: string
  listClassName?: string
  linkClassName?: string
}

type NavLink = {
  href: string
  label: string
  path?: PrimaryNavigationPath
}

const navLinks: NavLink[] = [
  { href: '/', label: 'Accueil de l’annuaire', path: '/' },
  { href: '/#moteur-recherche-global', label: 'Recherche annuaire' },
  { href: '/#aide-accessibilite', label: 'Aide accessibilité' },
  { href: '/plan-du-site', label: 'Plan du site', path: '/plan-du-site' },
  { href: '/accessibilite', label: 'Accessibilité', path: '/accessibilite' },
  { href: '/moderation', label: 'Modération', path: '/moderation' },
]

function PrimaryNavigation({
  currentPath = null,
  navId = 'navigation-principale',
  navRef,
  className = '',
  listClassName = '',
  linkClassName = '',
}: PrimaryNavigationProps) {
  return (
    <nav
      id={navId}
      ref={navRef}
      tabIndex={-1}
      aria-label="Navigation principale"
      className={`${focusTargetScrollMarginClass} ${focusTargetClass} ${className}`.trim()}
    >
      <ul className={listClassName}>
        {navLinks.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              aria-current={link.path && link.path === currentPath ? 'page' : undefined}
              className={linkClassName}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default PrimaryNavigation

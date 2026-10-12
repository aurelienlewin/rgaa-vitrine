import type { RefObject } from 'react'
import PrimaryNavigation from './PrimaryNavigation'

type SiteHeaderBarProps = {
  currentPath?: '/' | '/plan-du-site' | '/accessibilite' | '/moderation' | null
  navId?: string
  navRef?: RefObject<HTMLElement | null>
}

// Brand and main navigation share one row aligned on the container edges, on every public page.
function SiteHeaderBar({ currentPath = null, navId = 'navigation-principale', navRef }: SiteHeaderBarProps) {
  return (
    <div className="border-b border-slate-200">
      <div className="ui-container ui-site-bar">
        <a href="/" className="ui-brand">
          <img src="/logo-rgaa-vitrine.svg" alt="" width={40} height={40} className="h-10 w-10 flex-none" />
          <span className="ui-brand-name">Annuaire RGAA</span>
        </a>
        <PrimaryNavigation
          currentPath={currentPath}
          navId={navId}
          navRef={navRef}
          className="app-secondary-nav"
          listClassName="app-secondary-nav__list ui-nav-list"
          linkClassName="app-secondary-nav__link ui-nav-link"
        />
      </div>
    </div>
  )
}

export default SiteHeaderBar

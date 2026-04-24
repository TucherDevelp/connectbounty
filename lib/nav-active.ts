/**
 * Active state for main nav links. `/bounties` must not match `/bounties/mine` or
 * `/bounties/new` (those are separate entries).
 */
export function isNavItemActive(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  if (href === "/bounties") {
    const rest = pathname.slice("/bounties/".length);
    const first = rest.split("/")[0] ?? "";
    if (first === "mine" || first === "new") return false;
  }
  return true;
}

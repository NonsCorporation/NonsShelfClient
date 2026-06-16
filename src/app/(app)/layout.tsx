import Providers from './providers'

// Everything under (app) is the signed-in application: client-only and gated by
// the shared-SSO RequireAuth check (Providers). The (app) route group adds no
// path segment, so these routes still live at /, /library, /discover, etc.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <Providers>{children}</Providers>
}

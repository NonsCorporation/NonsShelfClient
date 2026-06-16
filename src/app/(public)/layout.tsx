import PublicProviders from './PublicProviders'

// Public, server-rendered pages (book/film detail). No auth gate — anonymous
// visitors and crawlers see the content; signed-in users still get the
// interactive controls once the session resolves on the client.
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <PublicProviders>{children}</PublicProviders>
}

import { ClientApp } from "./client";

// Optional catch-all route: every path (/, /library, /b/:id, …) renders the
// same client shell, exactly like the old GitHub Pages 404.html → index.html
// fallback. Client-side React Router then resolves the actual page.
export default function Page() {
  return <ClientApp />;
}

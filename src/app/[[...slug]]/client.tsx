"use client";

import dynamic from "next/dynamic";

// The whole product is a client-side React Router SPA that relies on the
// browser (window.history, the shared-SSO cookie, localStorage, …). We load it
// with ssr:false so nothing renders on the server — this keeps behavior
// identical to the previous Vite build while running on Next.js.
const Root = dynamic(() => import("@/Root"), { ssr: false });

export function ClientApp() {
  return <Root />;
}

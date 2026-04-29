import { MarketingPage } from "@/components/marketing/marketing-page";

// Static page: the middleware (proxy.ts) redirects authenticated users from
// "/" to "/dashboard" before this page is ever rendered.
export default function HomePage() {
  return <MarketingPage />;
}

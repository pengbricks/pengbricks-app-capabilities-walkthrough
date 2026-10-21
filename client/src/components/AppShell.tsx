import { Button, Separator } from '@databricks/appkit-ui/react';
import { ArrowUpRight, BookOpen, Github, Layers3 } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { ScrollToHash } from './ScrollToHash.tsx';

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-5 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Databricks Capability Atlas home">
            <Layers3 className="brand-mark size-6 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">Databricks Capability Atlas</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/#guide-library">
                <BookOpen className="size-4" />
                <span className="hidden sm:inline">Guides</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://github.com/pengbricks/pengbricks-app-capabilities-walkthrough"
                target="_blank"
                rel="noreferrer"
              >
                <Github className="size-4" />
                <span className="hidden sm:inline">Repository</span>
                <ArrowUpRight className="size-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <ScrollToHash />
        <Outlet />
      </main>

      <footer className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
        <Separator />
        <div className="flex flex-col gap-2 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Databricks Capability Atlas</p>
          <p>Guide · reference code · artifacts</p>
        </div>
      </footer>
    </div>
  );
}

import { ResourceStatusIndicator, ResourceStatusProvider } from '@databricks/appkit-ui/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';

document.documentElement.classList.add('light');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/*
       * Surfaces resource readiness (e.g. SQL warehouse cold-starts) as a
       * single sonner toast across the whole tree. Both are no-ops when
       * nothing's pending; remove them to render the aggregate yourself
       * via useResourceStatus(). Apps that already mount their own
       * <Toaster /> can swap the indicator for useResourceStatusToaster().
       */}
      <ResourceStatusProvider>
        <ResourceStatusIndicator />
        <App />
      </ResourceStatusProvider>
    </ErrorBoundary>
  </StrictMode>
);

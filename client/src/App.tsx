import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './components/AppShell.tsx';
import { GuidePage } from './pages/GuidePage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { EnvironmentSeparationPage } from './pages/walkthroughs/EnvironmentSeparationPage.tsx';
import { WalkthroughPage } from './pages/walkthroughs/WalkthroughPage.tsx';

const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { path: '/', element: <HomePage /> },
        { path: '/guides/:slug', element: <GuidePage /> },
        { path: '/walkthroughs/environment-separation', element: <EnvironmentSeparationPage /> },
        { path: '/walkthroughs/:slug', element: <WalkthroughPage /> },
      ],
    },
  ],
  { basename: '/capability-guides' },
);

export default function App() {
  return <RouterProvider router={router} />;
}

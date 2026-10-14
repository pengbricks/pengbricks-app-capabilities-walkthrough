import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './components/AppShell.tsx';
import { GuidePage } from './pages/GuidePage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { SrpDemoPage } from './pages/SrpDemoPage.tsx';
import { SrpOverviewPage } from './pages/SrpOverviewPage.tsx';

const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { path: '/', element: <HomePage /> },
        { path: '/guides/:slug', element: <GuidePage /> },
        { path: '/demos/srp', element: <SrpOverviewPage /> },
        { path: '/demos/srp/:slug', element: <SrpDemoPage /> },
      ],
    },
  ],
  { basename: '/capability-guides' },
);

export default function App() {
  return <RouterProvider router={router} />;
}

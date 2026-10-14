import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppShell } from './components/AppShell.tsx';
import { GuidePage } from './pages/GuidePage.tsx';
import { HomePage } from './pages/HomePage.tsx';

const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { path: '/', element: <HomePage /> },
        { path: '/guides/:slug', element: <GuidePage /> },
      ],
    },
  ],
  { basename: '/capability-guides' },
);

export default function App() {
  return <RouterProvider router={router} />;
}

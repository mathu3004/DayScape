/**
 * pages/NotFoundPage.jsx — 404 Not Found Page (re-export)
 *
 * This file is a thin re-export shim for React Router lazy-loading.
 * The actual NotFoundPage component is co-located in AboutPage.jsx
 * alongside the AboutPage component (both are defined in the same file).
 *
 * Why co-located: NotFoundPage is a simple one-screen component that
 * shares the same module boundary as AboutPage. Re-exporting it here
 * keeps the route config clean: <Route path="*" element={<NotFoundPage />} />
 *
 * The NotFoundPage component renders a centered 404 message with a
 * "Go Home" button that navigates to the root path ("/").
 */
export { NotFoundPage as default } from './AboutPage';

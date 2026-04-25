/**
 * main.jsx — React Application Entry Point
 *
 * This is the first JavaScript file executed by the browser.
 * It mounts the root React component (<App />) into the #root div
 * defined in index.html.
 *
 * React.StrictMode:
 *  Wrapping the app in StrictMode enables additional development-time
 *  checks and warnings:
 *   - Detects components with unsafe lifecycle methods
 *   - Warns about deprecated API usage
 *   - Intentionally double-invokes certain functions to surface side-effects
 *  StrictMode has no effect in production builds.
 *
 * index.css:
 *  Global stylesheet imported here so it applies to the entire application.
 *  Contains CSS custom properties (design tokens), reset rules, utility
 *  classes, and the Navbar/Footer layout styles.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Mount the React application tree into the #root element in index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode adds development-only warnings — no runtime cost in production
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

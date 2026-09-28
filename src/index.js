// index.js or main file
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import Login from './pages/login/login';
import AdminRedirect from './adminRedirect/admin';
import Admin from './admin/admin';
import Home from './admin/pages/home/home';
import Rules from './admin/pages/rules/rules';
import { Provider } from 'react-redux';
import { store } from './admin/store';
import LoginPage from './admin/pages/login/login';
import UserRules from './pages/rules/rules';
import Hall1 from './pages/hall_1/hall_1';
import HallStage1 from './pages/hall_1/stage1';
import HallStage2 from './pages/hall_1/stage2';
import HallStage3 from './pages/hall_1/stage3';
import HallStage4 from './pages/hall_1/stage4';
import HallStage5 from './pages/hall_1/stage5';
import HallStage6 from './pages/hall_1/stage6';
import FinalPage from './pages/final/final';
import ThankYou from './pages/thankyou/thankyou';
import Leaderboard from './pages/leaderboard/Leaderboard';
import USER from './pages/dddUI/user';
import ThemeUpdate from './admin/pages/themeupdate/themeupdate';

// Benign Chrome warning when modals/route changes trigger ResizeObserver in the same frame.
const RESIZE_OBSERVER_LOOP = /ResizeObserver loop/;
window.addEventListener(
  'error',
  (event) => {
    if (RESIZE_OBSERVER_LOOP.test(event.message ?? '')) {
      event.stopImmediatePropagation();
    }
  },
  true
);

function usePageBackground() {
  const location = useLocation();
  useEffect(() => {
    const body = document.body;
    if (!location.pathname.startsWith("/admin")) {
      body.classList.add("common-bg");
    } else {
      body.classList.remove("common-bg");
    }
  }, [location]);
}

function App() {
  usePageBackground();

  return (
    <Provider store={store}>
      <Routes>
        {/* Explicit paths (most specific first) so /admin always = theme admin, never the superadmin login */}
        <Route path="/admin/superadmin" element={<LoginPage />} />
        <Route path="/admin/rules" element={<Admin><Rules /></Admin>} />
        <Route path="/admin/themeupdate" element={<Admin><ThemeUpdate /></Admin>} />
        <Route path="/admin" element={<Admin><Home /></Admin>} />

        <Route path="*" element={
          <USER>
            <Routes>
              <Route index element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/rules" element={<UserRules />} />
              <Route path="/hall-1" element={<Hall1 />} />
              <Route path="/hall-1/stage1" element={<HallStage1 />} />
              <Route path="/hall-1/stage2" element={<HallStage2 />} />
              <Route path="/hall-1/stage3" element={<HallStage3 />} />
              <Route path="/hall-1/stage4" element={<HallStage4 />} />
              <Route path="/hall-1/stage5" element={<HallStage5 />} />
              <Route path="/hall-1/stage6" element={<HallStage6 />} />
              <Route path="/complete" element={<FinalPage />} />
              <Route path="/final" element={<Navigate to="/complete" replace />} />
              <Route path="/stage1" element={<Navigate to="/hall-1" replace />} />
              <Route path="/welcome" element={<Navigate to="/hall-1" replace />} />
              <Route path="/game" element={<Navigate to="/hall-1" replace />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/AdminRedirect" element={<AdminRedirect />} />
              <Route path="/thankyou" element={<ThankYou />} />
              {/* Removed pages: old history entries (browser back) land on their replacements. */}
              <Route path="/intro" element={<Navigate to="/rules" replace />} />
              <Route path="/begin" element={<Navigate to="/hall-1" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </USER>
        } />
      </Routes>
    </Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

reportWebVitals();

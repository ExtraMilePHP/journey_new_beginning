import React,{ useEffect, useState } from "react";
import "./user.css";
import { useDispatch, useSelector } from 'react-redux';
import { fetchThemeData } from '../../admin/themeSlice';
import { themeBackgroundKeyForStage, themeBackgroundKeyForViewport, parseStageNumberFromPath } from '../../functions/themeAssets';
import { ensureStageSessionForUser } from '../../functions/stageReportSync';
import { useLocation } from "react-router-dom";

function USER({children }) {
  const dispatch = useDispatch();
    const location = useLocation();

    const {companyLogoUrl,backButtonUrl} = useSelector(state => state.ui);
    const [logoUrl,setLogoUrl]=useState("");
    const [backUrl,setBackUrl]=useState("");

    const { user } = useSelector(state => state.auth);
    const { status: themeStatus, data: themeData, currentTheme } = useSelector(state => state.theme);
    const fromMobileAppInUrl =
      String(new URLSearchParams(location.search).get("fromMobileApp") || "").toLowerCase() ===
      "true";
    const fromMobileAppInUser = String(user?.fromMobileApp || "").toLowerCase() === "true";
    const persistedFromMobileApp = (() => {
      try {
        const persisted = JSON.parse(
          sessionStorage.getItem("userData") || "{}"
        );
        return String(persisted?.fromMobileApp || "").toLowerCase() === "true";
      } catch {
        return false;
      }
    })();
    const isFromMobileApp = fromMobileAppInUrl || fromMobileAppInUser || persistedFromMobileApp;
  const isGameStageRoute = /^\/stage[1-5](?:\/|$)/.test(location.pathname);

  const applyCustomTheme = (theme) => {
  if (!theme) return;

  document.documentElement.style.setProperty('--text-color', theme.text_color);
  document.documentElement.style.setProperty('--ui-color-1', theme.ui_color_1);
  document.documentElement.style.setProperty('--ui-color-2', theme.ui_color_2);
  document.documentElement.style.setProperty('--option-color', theme.option_color);
  document.documentElement.style.setProperty('--option-text-color', theme.option_text_color);
};
    
  useEffect(() => {
      if (!/^\/login(?:\/)?$/.test(location.pathname)) {
        if (themeStatus === "idle") {
          dispatch(fetchThemeData({ themeId: currentTheme || null }));
        }
      }
  }, [themeStatus, dispatch, location.pathname, currentTheme]);

  useEffect(() => {
    try {
      const storedUser = user || JSON.parse(sessionStorage.getItem("userData") || "{}");
      ensureStageSessionForUser(storedUser);
    } catch {
      /* ignore */
    }
  }, [user?.userId, user?.userid, user?.id]);

  useEffect(()=>{
    setBackUrl(backButtonUrl);
    setLogoUrl(companyLogoUrl);
  },[backButtonUrl,companyLogoUrl])


  useEffect(() => {
    if (themeStatus !== "succeeded" || !themeData) return;

    applyCustomTheme(themeData.colors);

    const applyBodyBackground = () => {
      const body = document.body;
      if (/^\/(?:login)?$/.test(location.pathname)) return;
      if (/^\/rules(?:\/)?$/.test(location.pathname)) return;
      if (/^\/hall-1(?:\/|$)/.test(location.pathname)) return;
      if (/^\/stage1(?:\/|$)/.test(location.pathname)) return;
      if (/^\/leaderboard(?:\/|$)/.test(location.pathname)) return;
      const stageNum = parseStageNumberFromPath(location.pathname);
      const bg =
        stageNum != null
          ? themeBackgroundKeyForStage(themeData, stageNum)
          : themeBackgroundKeyForViewport(themeData);
      const bgUrl = bg ? encodeURI(process.env.REACT_APP_S3_PATH + bg) : null;
      if (bgUrl) {
        body.style.backgroundImage = `url("${bgUrl}")`;
        body.style.backgroundSize = stageNum != null ? "cover" : "100% 100%";
        body.style.backgroundPosition = "center center";
        body.style.backgroundRepeat = "no-repeat";
        body.style.backgroundAttachment = "fixed";
      } else {
        body.style.removeProperty("background-image");
      }
    };

    applyBodyBackground();
    window.addEventListener("resize", applyBodyBackground);
    window.addEventListener("orientationchange", applyBodyBackground);
    return () => {
      window.removeEventListener("resize", applyBodyBackground);
      window.removeEventListener("orientationchange", applyBodyBackground);
    };
  }, [themeStatus, themeData, location.pathname]);

  const handleLogoClick = (e) => {
    if (!isFromMobileApp) return;
    e.preventDefault();
    window.GameStatus?.postMessage?.("navigate_back");
  };

  const handleBackClick = (e) => {
    if (isGameStageRoute) {
      e.preventDefault();
      return;
    }
    if (!backUrl) {
      e.preventDefault();
      return;
    }
    const current =
      window.location.pathname + window.location.search + window.location.hash;
    if (backUrl === current) {
      e.preventDefault();
    }
  };

  const backHref = isGameStageRoute
    ? location.pathname
    : backUrl || "#";

  return (
    <>
      <header className="upperaction">
      <a href={process.env.REACT_APP_BASE_URL} onClick={handleLogoClick}><img src={logoUrl} className="logo-holder" /></a>
        {!isFromMobileApp && (
          <div className="back-holder">
            <a
              href={backHref}
              onClick={handleBackClick}
              aria-disabled={isGameStageRoute ? true : undefined}
            >
              <button type="button" className="back-default">
                Back
              </button>
            </a>
          </div>
        )}
       
      </header>
      {children}
    </>
  );
}

export default USER;

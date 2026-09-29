import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { selectAdminToken } from "../../admin/sessionSlice";
import { setBackButtonUrl } from "../uiSlice";
import StageTimer from "../game/StageTimer";
import {
  HALL1_HOTSPOT_ORDER,
  resolveActiveHall1Hotspot,
  resolveTrophyVaultRoute,
  hydrateHall1ProgressFromStage,
  getHall1HubRedirect,
  isHallStageScorePresent,
  readHall1Completed,
} from "./medalDisplayData";
import {
  formatSecondsToClock,
  loadHallElapsedFromDb,
  persistHallElapsedTime,
  readTotalScoreFromStage,
} from "./hallTimer";
import { ensureHallHotspotStyles, styleHallHotspot } from "./hallHotspotFx";
import { setupHallPageBodyBackground, isMobViewport } from "../game/gameStageBackground";
import "../fonts/breuer-headline.css";
import "./hall_1.css";
import { CHECKPOINT_KEY_IMAGES } from "./keyImages";

/** Large Illustrator SVG — served from /public (SVGR cannot parse embedded binary). */
const HALL1_DESK_SVG = `${process.env.PUBLIC_URL || ""}/hall_1/hall1.svg`;
const HALL1_MOB_SVG = `${process.env.PUBLIC_URL || ""}/hall_1/hall1_mob.svg`;

function useHallSvgUrl(deskUrl, mobUrl) {
  const [svgUrl, setSvgUrl] = useState(() =>
    typeof window !== "undefined" && isMobViewport() ? mobUrl : deskUrl
  );

  useEffect(() => {
    const sync = () => {
      const next = isMobViewport() ? mobUrl : deskUrl;
      setSvgUrl((prev) => (prev === next ? prev : next));
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [deskUrl, mobUrl]);

  return svgUrl;
}

const HOTSPOT_ROUTES = {
  medal_display: "/hall-1/stage1",
  commentary_booth: "/hall-1/stage2",
  museum_archive: "/hall-1/stage3",
  newspaper: "/hall-1/stage4",
  trophy_vault: "/hall-1/stage5",
};

const HOTSPOT_LABELS = {
  medal_display: "Medal Display",
  commentary_booth: "Commentary Booth",
  museum_archive: "Museum Archive",
  newspaper: "Newspaper",
  trophy_vault: "Trophy Vault",
};

const ALL_HOTSPOT_IDS = Object.keys(HOTSPOT_LABELS);

/** Reward message shown on return from a completed checkpoint. */
const CHECKPOINT_TOASTS = {
  village_square: "Key of Traditions earned — Village Square complete!",
  riverside_crossing: "Key of Beliefs earned — the bridge is built! Festival Market unlocked.",
  festival_market: "Key of Symbolism earned — the path to the Celebration Steps is lit!",
  celebration_steps: "Key of Values earned — the Grand Celebration awaits!",
};

function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("userData") || "{}");
  } catch {
    return {};
  }
}

/** Hotspots whose puzzle stages are already scored in DB / session. */
function resolveCompletedHall1Hotspots(stage) {
  const completed = new Set(readHall1Completed());
  HALL1_HOTSPOT_ORDER.forEach((id, index) => {
    if (isHallStageScorePresent(stage, index + 1)) completed.add(id);
  });
  return [...completed];
}

export default function Hall1() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminToken = useSelector(selectAdminToken);
  const { user } = useSelector((s) => s.auth);
  const storedUser = useMemo(() => user || getStoredUser(), [user]);
  const isDemoBypass = storedUser?.sessionId === "demobypass";
  const backendBase = String(process.env.REACT_APP_BACKEND_URL || "").replace(
    /\/+$/,
    ""
  );

  const objectRef = useRef(null);
  const elapsedRef = useRef(0);
  const stageRowIdRef = useRef("");
  const hallSvgUrl = useHallSvgUrl(HALL1_DESK_SVG, HALL1_MOB_SVG);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [progressReady, setProgressReady] = useState(false);
  const [svgReady, setSvgReady] = useState(false);
  /** Single clickable hotspot from DB stage scores (null = all done). */
  const [activeHotspot, setActiveHotspot] = useState("medal_display");
  const [completedHotspots, setCompletedHotspots] = useState([]);
  const [stageRecord, setStageRecord] = useState(null);
  const location = useLocation();
  /** Set by a checkpoint's "Continue Journey" (e.g. Village Square → Key of Traditions). */
  const [rewardToast, setRewardToast] = useState(
    () => CHECKPOINT_TOASTS[location.state?.checkpointComplete] || ""
  );
  const [rewardKeyImg] = useState(
    () => CHECKPOINT_KEY_IMAGES[location.state?.checkpointComplete] || ""
  );

  useEffect(() => {
    if (!rewardToast) return undefined;
    const id = window.setTimeout(() => setRewardToast(""), 5000);
    return () => clearTimeout(id);
  }, [rewardToast]);

  useEffect(() => {
    dispatch(setBackButtonUrl("/rules"));
  }, [dispatch]);

  useEffect(() => {
    return setupHallPageBodyBackground(document.body, {
      className: "hall1-page",
    });
  }, []);

  useEffect(() => {
    setSvgReady(false);
  }, [hallSvgUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { stageId, elapsedSec: sec, stage } = await loadHallElapsedFromDb({
        backendBase,
        adminToken,
        storedUser,
        isDemoBypass,
      });
      if (cancelled) return;

      // DB is source of truth: empty stage1 → medal; stage1 set → commentary; etc.
      if (stage) {
        hydrateHall1ProgressFromStage(stage);
        const hubRedirect = getHall1HubRedirect(stage);
        if (hubRedirect) {
          navigate(hubRedirect, { replace: true });
          return;
        }
        setActiveHotspot(resolveActiveHall1Hotspot(stage));
        setCompletedHotspots(resolveCompletedHall1Hotspots(stage));
        setStageRecord(stage);
      } else {
        setActiveHotspot("medal_display");
        setCompletedHotspots([]);
        setStageRecord(null);
      }

      stageRowIdRef.current = stageId || "";
      elapsedRef.current = sec;
      setElapsedSec(sec);
      setTimerReady(true);
      setProgressReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [backendBase, adminToken, storedUser, isDemoBypass, navigate]);

  useEffect(() => {
    if (!timerReady) return undefined;
    const tick = window.setInterval(() => {
      setElapsedSec((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [timerReady]);

  useEffect(() => {
    if (!timerReady) return undefined;
    const save = () => {
      persistHallElapsedTime({
        backendBase,
        adminToken,
        storedUser,
        isDemoBypass,
        stageId: stageRowIdRef.current,
        elapsedSec: elapsedRef.current,
      });
    };
    const id = window.setInterval(save, 15000);
    return () => {
      clearInterval(id);
      save();
    };
  }, [timerReady, backendBase, adminToken, storedUser, isDemoBypass]);

  const handleHotspotClick = useCallback(
    (id) => {
      let route = HOTSPOT_ROUTES[id];
      if (id === "trophy_vault") {
        route = resolveTrophyVaultRoute(stageRecord) || route;
      }
      if (route) navigate(route);
    },
    [navigate, stageRecord]
  );

  const bindHotspots = useCallback(() => {
    const obj = objectRef.current;
    if (!obj || !progressReady) return;
    let doc = null;
    try {
      doc = obj.contentDocument;
    } catch {
      doc = null;
    }
    if (!doc) return;

    const svg = doc.querySelector("svg");
    if (svg) {
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.setAttribute("preserveAspectRatio", "none");
    }

    ensureHallHotspotStyles(doc);
    const completedSet = new Set(completedHotspots);

    ALL_HOTSPOT_IDS.forEach((id) => {
      let el = doc.getElementById(id);
      if (!el) {
        console.warn(`[Hall1] missing hotspot id: ${id}`);
        return;
      }

      // Replace node so rebinds after DB hydrate do not stack listeners
      const fresh = el.cloneNode(true);
      el.parentNode?.replaceChild(fresh, el);
      el = fresh;

      const enabled = id === activeHotspot && Boolean(HOTSPOT_ROUTES[id]);
      const active = enabled;
      const completed = !active && completedSet.has(id);
      styleHallHotspot(el, { enabled, active, completed });
      el.setAttribute("aria-label", HOTSPOT_LABELS[id] || id);
      el.setAttribute("aria-disabled", enabled ? "false" : "true");

      if (!enabled) return;

      const onActivate = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleHotspotClick(id);
      };

      el.addEventListener("click", onActivate);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") onActivate(e);
      });
    });

    setSvgReady(true);
  }, [handleHotspotClick, activeHotspot, completedHotspots, progressReady]);

  useEffect(() => {
    const obj = objectRef.current;
    if (!obj) return undefined;

    if (obj.contentDocument?.querySelector("svg")) {
      bindHotspots();
    }

    obj.addEventListener("load", bindHotspots);
    return () => {
      obj.removeEventListener("load", bindHotspots);
    };
  }, [bindHotspots, hallSvgUrl]);

  return (
    <div className="hall1-escape">
      <div className="stage-escape-hud">
        <StageTimer
          timeLabel={formatSecondsToClock(elapsedSec)}
          points={readTotalScoreFromStage(stageRecord)}
        />
      </div>

      <object
        ref={objectRef}
        className="hall1-svg"
        data={hallSvgUrl}
        type="image/svg+xml"
        aria-label="Hall of Champions"
      >
        <p className="hall1-svg-fallback">Unable to load hall scene.</p>
      </object>

      {!svgReady ? (
        <p className="hall1-loading" aria-live="polite">
          Loading hall…
        </p>
      ) : null}

      {rewardToast ? (
        <p className="hall1-hotspot-toast hall1-reward-toast" role="status">
          {rewardKeyImg ? <img className="hall1-reward-toast__key" src={rewardKeyImg} alt="" /> : null}
          {rewardToast}
        </p>
      ) : null}

      {progressReady && activeHotspot && HOTSPOT_LABELS[activeHotspot] ? (
        <p className="hall1-hotspot-toast" role="status">
          Click: {HOTSPOT_LABELS[activeHotspot]}
        </p>
      ) : null}
    </div>
  );
}

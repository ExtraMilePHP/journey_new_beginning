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
import { isMobViewport } from "../game/gameStageBackground";
import { useLevelPage, useSceneFit, useApplySceneFit } from "./levelScene";
import "../fonts/breuer-headline.css";
import "./hall_1.css";
import { CHECKPOINT_KEY_IMAGES } from "./keyImages";

/** Large Illustrator SVG — served from /public (SVGR cannot parse embedded binary). */
const HALL1_DESK_SVG = `${process.env.PUBLIC_URL || ""}/hall_1/main.svg`;
const HALL1_MOB_SVG = `${process.env.PUBLIC_URL || ""}/hall_1/main_mob.svg`;

/**
 * Layers of main.svg / main_mob.svg per checkpoint (in HALL1_HOTSPOT_ORDER).
 * `label` (the name plaque) always shows and is the button while the
 * checkpoint is the current one; `pin` appears once it has been completed.
 * Every other layer shows exactly as authored in the SVG.
 */
const HALL1_LOCATIONS = {
  medal_display: {
    pin: "location_01",
    label: { desk: "Village1", mob: "Village_square" },
  },
  commentary_booth: {
    pin: "location_02",
    label: { desk: "river_side", mob: "River_side" },
  },
  museum_archive: {
    pin: "location_03",
    label: { desk: "Festival_market", mob: "Festival_market" },
  },
  newspaper: {
    pin: "location_04",
    label: { desk: "Celebration_steps", mob: "Celebration_steps" },
  },
  trophy_vault: {
    pin: "location_05",
    label: { desk: "Grand_celebration", mob: "Grand_celebration" },
  },
};

/**
 * Scene fit, as in the level stages: the art covers the screen (behind the
 * header too), cropping only outside `safe` — the band holding every
 * location label and pin (fractions of the art). Desktop never crops top or
 * bottom: on screens wider than 16:9 the whole art is stretched to fit.
 */
const HALL1_FIT = {
  desk: { w: 1920, h: 1080, fill: true, safe: { x0: 0.1, x1: 0.9, y0: 0, y1: 1 } },
  mob: { w: 414, h: 896, fill: true, safe: { x0: 0.2, x1: 0.9, y0: 0.19, y1: 0.82 } },
};

function setLayerVisible(el, visible) {
  if (el) el.style.display = visible ? "" : "none";
}

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
  medal_display: "Village Square",
  commentary_booth: "Riverside Crossing",
  museum_archive: "Festival Market",
  newspaper: "Celebration Steps",
  trophy_vault: "Grand Celebration",
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

  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const objectRef = useRef(null);
  const elapsedRef = useRef(0);
  const stageRowIdRef = useRef("");
  const hallSvgUrl = useHallSvgUrl(HALL1_DESK_SVG, HALL1_MOB_SVG);
  // Same page chrome as the level stages; no blurred backdrop copy of the (huge) SVG.
  useLevelPage(stageRef, null);
  const sceneFit = useSceneFit(
    wrapRef,
    hallSvgUrl === HALL1_MOB_SVG ? HALL1_FIT.mob : HALL1_FIT.desk
  );
  /** Bumped on every SVG (re)bind so the fitted viewBox is re-applied. */
  const [bindVersion, setBindVersion] = useState(0);
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
      svg.__vsBound = true; // lets useApplySceneFit set the fitted viewBox
    }

    ensureHallHotspotStyles(doc);
    const layout = obj.data && String(obj.data).endsWith("main_mob.svg") ? "mob" : "desk";
    const completedSet = new Set(completedHotspots);
    const byId = (layerId) => doc.getElementById(layerId);

    ALL_HOTSPOT_IDS.forEach((id) => {
      const loc = HALL1_LOCATIONS[id];
      const enabled = id === activeHotspot && Boolean(HOTSPOT_ROUTES[id]);
      const completed = !enabled && completedSet.has(id);

      // Pin marks a checkpoint already played; hidden until it is completed.
      const pin = byId(loc.pin);
      if (pin) {
        setLayerVisible(pin, completedSet.has(id));
        styleHallHotspot(pin, { enabled: false, completed: true });
      } else {
        console.warn(`[Hall1] missing location pin: ${loc.pin}`);
      }

      // Name labels always show; the current checkpoint's label is the button.
      [loc.label[layout]].forEach((layerId) => {
        let el = byId(layerId);
        if (!el) {
          console.warn(`[Hall1] missing location label: ${layerId}`);
          return;
        }

        // Replace node so rebinds after DB hydrate do not stack listeners
        const fresh = el.cloneNode(true);
        el.parentNode?.replaceChild(fresh, el);
        el = fresh;

        styleHallHotspot(el, { enabled, active: enabled, completed });
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
    });

    setSvgReady(true);
    setBindVersion((v) => v + 1);
  }, [handleHotspotClick, activeHotspot, completedHotspots, progressReady]);

  useApplySceneFit(objectRef, sceneFit, svgReady, bindVersion);

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
    <div className="vs-stage vs-stage--full-bleed hall1-stage" ref={stageRef}>
      <div className="stage-escape-hud">
        <StageTimer
          timeLabel={formatSecondsToClock(elapsedSec)}
          points={readTotalScoreFromStage(stageRecord)}
        />
      </div>

      <div className="vs-scene-wrap" ref={wrapRef}>
        <object
          ref={objectRef}
          className={`vs-scene-svg hall1-svg${svgReady ? "" : " is-loading"}`}
          data={hallSvgUrl}
          type="image/svg+xml"
          aria-label="Journey map"
        >
          <p className="hall1-svg-fallback">Unable to load hall scene.</p>
        </object>

        {!svgReady ? (
          <p className="hall1-loading" aria-live="polite">
            Loading hall…
          </p>
        ) : null}
      </div>

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

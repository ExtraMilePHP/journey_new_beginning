import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { selectAdminToken } from "../../admin/sessionSlice";
import { setBackButtonUrl } from "../uiSlice";
import { setupAppPageBodyBackground } from "../game/gameStageBackground";
import {
  STAGE_ROW_KEY,
  ensureStageRowId,
  ensureStageSessionForUser,
  saveGameStageAndReport,
} from "../../functions/stageReportSync";
import StageTimer from "../game/StageTimer";
import {
  formatSecondsToClock,
  loadHallElapsedFromDb,
  persistHallElapsedTime,
  readTotalScoreFromStage,
  liveProgressPoints,
} from "./hallTimer";
import { markHall1HotspotCompleted, getRedirectIfHall1StageDone } from "./medalDisplayData";
import {
  TROPHIES,
  NAMEPLATES,
  TROPHY_VAULT_POINTS,
  shuffleArray,
  validateTrophyPlacements,
  assignNameplate,
  clearTrophySlot,
  unassignedNameplateIds,
  markHallOfChampionsComplete,
} from "./trophyVaultData";
import { createDragAutoScroller } from "./dragDropHelpers";
import deskBg from "./stage6/stage6_desk.jpg";
import mobBg from "./stage6/stage6_mob.jpg";
import finalDesk from "./stage6/final_desk.jpg";
import finalMob from "./stage6/final_mob.jpg";
import objectiveBox from "./stage6/box.png";
import nameplateBg from "./stage6/nameplate.png";
import proceedBtn from "./stage6/button.png";
import championsSeal from "./stage6/final_vault.png";
import "../fonts/breuer-headline.css";
import "./stage6.css";

function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("userData") || "{}");
  } catch {
    return {};
  }
}

function Nameplate({ plate, lifted, wrong, locked, onPointerDown, compact }) {
  return (
    <button
      type="button"
      className={`trophy-nameplate${lifted ? " trophy-nameplate--lifted" : ""}${
        wrong ? " trophy-nameplate--wrong" : ""
      }${locked ? " trophy-nameplate--locked" : ""}${
        compact ? " trophy-nameplate--compact" : ""
      }`}
      style={{ backgroundImage: `url(${nameplateBg})` }}
      onPointerDown={(e) => {
        if (locked) return;
        onPointerDown?.(e, plate.id);
      }}
      aria-label={plate.label}
      aria-grabbed={lifted ? "true" : "false"}
      aria-disabled={locked ? "true" : undefined}
    >
      <span className="trophy-nameplate__text">{plate.label}</span>
    </button>
  );
}

function DragGhost({ plate, x, y, width }) {
  if (!plate) return null;
  return (
    <div
      className="trophy-drag-ghost"
      style={{
        left: x,
        top: y,
        width: width ? `${width}px` : undefined,
        backgroundImage: `url(${nameplateBg})`,
      }}
      aria-hidden
    >
      <span className="trophy-nameplate__text">{plate.label}</span>
    </div>
  );
}

/** Hall Stage 6 — Trophy Vault finale */
export default function HallStage6() {
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

  const plateById = useMemo(
    () => Object.fromEntries(NAMEPLATES.map((p) => [p.id, p])),
    []
  );
  const trophyById = useMemo(
    () => Object.fromEntries(TROPHIES.map((t) => [t.id, t])),
    []
  );

  const [plateOrder] = useState(() =>
    shuffleArray(NAMEPLATES.map((p) => p.id))
  );
  const [placements, setPlacements] = useState(() =>
    Object.fromEntries(TROPHIES.map((t) => [t.id, null]))
  );
  const [lockedTrophyIds, setLockedTrophyIds] = useState([]);
  const [drag, setDrag] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [feedback, setFeedback] = useState({ wrong: [], correct: [] });
  const [status, setStatus] = useState("playing");
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [timerReady, setTimerReady] = useState(false);
  const [stageRowId, setStageRowId] = useState(
    () => sessionStorage.getItem(STAGE_ROW_KEY) || ""
  );
  const [sealReveal, setSealReveal] = useState(false);

  const elapsedRef = useRef(0);
  const dragRef = useRef(null);
  const placementsRef = useRef(placements);
  const lockedRef = useRef([]);
  const completingRef = useRef(false);
  const autoScrollRef = useRef(null);
  if (!autoScrollRef.current) {
    autoScrollRef.current = createDragAutoScroller();
  }

  useEffect(() => {
    placementsRef.current = placements;
  }, [placements]);

  useEffect(() => {
    lockedRef.current = lockedTrophyIds;
  }, [lockedTrophyIds]);

  const liveStagePoints = useMemo(
    () =>
      liveProgressPoints(
        lockedTrophyIds.length,
        TROPHIES.length,
        TROPHY_VAULT_POINTS
      ),
    [lockedTrophyIds.length]
  );

  const displayPoints =
    status === "success" ? totalScore : totalScore + liveStagePoints;

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    dispatch(setBackButtonUrl(status === "success" ? "/hall-1" : "/hall-1"));
  }, [dispatch, status]);

  useEffect(() => {
    document.body.classList.add("hall1-stage6-page");
    const isSuccess = status === "success";
    const cleanupBg = setupAppPageBodyBackground(document.body, {
      deskForeground: isSuccess ? finalDesk : deskBg,
      mobForeground: isSuccess ? finalMob : mobBg,
    });
    return () => {
      cleanupBg?.();
      document.body.classList.remove("hall1-stage6-page");
    };
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      ensureStageSessionForUser(storedUser);
      const { stageId, elapsedSec: sec, stage } = await loadHallElapsedFromDb({
        backendBase,
        adminToken,
        storedUser,
        isDemoBypass,
      });
      if (cancelled) return;

      const redirect = getRedirectIfHall1StageDone(stage, 6);
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }

      if (stageId) setStageRowId(String(stageId));
      elapsedRef.current = sec;
      setElapsedSec(sec);
      setTotalScore(readTotalScoreFromStage(stage));
      setTimerReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [backendBase, adminToken, storedUser, isDemoBypass, navigate]);

  useEffect(() => {
    if (!timerReady || status === "success") return undefined;
    const tick = window.setInterval(() => {
      setElapsedSec((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [timerReady, status]);

  useEffect(() => {
    if (!timerReady) return undefined;
    const save = () => {
      persistHallElapsedTime({
        backendBase,
        adminToken,
        storedUser,
        isDemoBypass,
        stageId: stageRowId || sessionStorage.getItem(STAGE_ROW_KEY),
        elapsedSec: elapsedRef.current,
      });
    };
    const id = window.setInterval(save, 15000);
    return () => {
      clearInterval(id);
      if (status === "playing") save();
    };
  }, [
    timerReady,
    backendBase,
    adminToken,
    storedUser,
    isDemoBypass,
    stageRowId,
    status,
  ]);

  useEffect(() => {
    if (status !== "success") return undefined;
    const id = window.setTimeout(() => setSealReveal(true), 80);
    return () => clearTimeout(id);
  }, [status]);

  const poolIds = useMemo(() => {
    const free = new Set(unassignedNameplateIds(placements));
    return plateOrder.filter((id) => free.has(id));
  }, [placements, plateOrder]);

  const clearDrag = useCallback(() => {
    autoScrollRef.current?.stop();
    setDrag(null);
    setDropTargetId(null);
    document.body.classList.remove("trophy-dragging");
  }, []);

  useEffect(() => () => clearDrag(), [clearDrag]);

  const lockCorrectTrophies = useCallback((nextPlacements) => {
    const toLock = TROPHIES.filter(
      (t) =>
        nextPlacements[t.id] === t.nameplateId &&
        !lockedRef.current.includes(t.id)
    ).map((t) => t.id);
    if (!toLock.length) return;
    setLockedTrophyIds((prev) => {
      const set = new Set(prev);
      toLock.forEach((id) => set.add(id));
      return [...set];
    });
  }, []);

  const onPointerDownPlate = useCallback(
    (e, nameplateId) => {
      if (status === "success" || status === "saving") return;
      if (e.button != null && e.button !== 0) return;

      let originTrophy = null;
      Object.entries(placementsRef.current).forEach(([trophyId, pid]) => {
        if (pid === nameplateId) originTrophy = trophyId;
      });
      if (originTrophy && lockedRef.current.includes(originTrophy)) return;

      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();

      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);

      // Keep plate in slot while dragging (matches stage1/3). Clearing the slot
      // unmounts the capture target and can hide the OS cursor mid-drag.
      setDrag({
        nameplateId,
        originTrophy,
        pointerId: e.pointerId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        x: rect.left,
        y: rect.top,
        width: rect.width,
      });
      setFeedback({ wrong: [], correct: [] });
      setErrorMsg("");
      document.body.classList.add("trophy-dragging");
      autoScrollRef.current?.update(e.clientY);
    },
    [status]
  );

  const tryDropOnTrophy = useCallback(
    (nameplateId, trophyId, originTrophy) => {
      const trophy = trophyById[trophyId];
      if (!trophy) {
        clearDrag();
        return;
      }

      if (lockedRef.current.includes(trophyId)) {
        clearDrag();
        return;
      }

      if (originTrophy === trophyId) {
        clearDrag();
        return;
      }

      const next = assignNameplate(
        placementsRef.current,
        trophyId,
        nameplateId,
        originTrophy
      );
      placementsRef.current = next;
      setPlacements(next);
      lockCorrectTrophies(next);
      setFeedback({ wrong: [], correct: [] });
      setErrorMsg("");
      clearDrag();
    },
    [trophyById, clearDrag, lockCorrectTrophies]
  );

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;

      autoScrollRef.current?.update(e.clientY);

      setDrag((prev) =>
        prev
          ? {
              ...prev,
              x: e.clientX - prev.offsetX,
              y: e.clientY - prev.offsetY,
            }
          : prev
      );

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slotEl = el?.closest?.("[data-trophy-slot]");
      setDropTargetId(slotEl?.getAttribute("data-trophy-slot") || null);
    };

    const onUp = (e) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;

      autoScrollRef.current?.stop();

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slotEl = el?.closest?.("[data-trophy-slot]");
      const poolEl = el?.closest?.("[data-nameplate-pool]");

      if (slotEl) {
        tryDropOnTrophy(
          d.nameplateId,
          slotEl.getAttribute("data-trophy-slot"),
          d.originTrophy
        );
      } else if (poolEl) {
        if (d.originTrophy && lockedRef.current.includes(d.originTrophy)) {
          clearDrag();
          return;
        }
        if (d.originTrophy) {
          setPlacements((prev) => clearTrophySlot(prev, d.originTrophy));
        }
        clearDrag();
      } else {
        // Cancel — plate stays in origin slot (never cleared on pick-up)
        clearDrag();
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      autoScrollRef.current?.stop();
      clearDrag();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [tryDropOnTrophy, clearDrag]);

  const handleSubmit = useCallback(async () => {
    if (status === "success" || status === "saving" || completingRef.current) {
      return;
    }

    const result = validateTrophyPlacements(placements);
    if (!result.ok) {
      setFeedback({
        wrong: [...result.wrongTrophyIds, ...result.missingTrophyIds],
        correct: TROPHIES.filter(
          (t) =>
            placements[t.id] &&
            !result.wrongTrophyIds.includes(t.id) &&
            !result.missingTrophyIds.includes(t.id)
        ).map((t) => t.id),
      });
      setErrorMsg(
        result.missingTrophyIds.length
          ? "Place a nameplate under every trophy, then try again."
          : "Some nameplates don’t match. Try again."
      );
      return;
    }

    completingRef.current = true;
    setFeedback({
      wrong: [],
      correct: TROPHIES.map((t) => t.id),
    });
    setErrorMsg("");
    setStatus("saving");

    const timeStr = formatSecondsToClock(elapsedRef.current);
    const answers = {
      puzzle: "trophy_vault",
      placements,
    };

    try {
      let stageId = stageRowId || sessionStorage.getItem(STAGE_ROW_KEY);
      if (!stageId && !isDemoBypass && backendBase && adminToken) {
        stageId = await ensureStageRowId({
          backendBase,
          adminToken,
          storedUser,
          isDemoBypass,
        });
        if (stageId) setStageRowId(String(stageId));
      }

      if (!isDemoBypass && backendBase && adminToken && stageId) {
        const result = await saveGameStageAndReport({
          backendBase,
          adminToken,
          storedUser,
          isDemoBypass,
          stageId,
          stageNumber: 6,
          score: TROPHY_VAULT_POINTS,
          answers,
          time: timeStr,
        });
        if (result?.total_score != null) {
          setTotalScore(Number(result.total_score) || 0);
        } else {
          setTotalScore((prev) => prev + TROPHY_VAULT_POINTS);
        }
      } else {
        setTotalScore((prev) => prev + TROPHY_VAULT_POINTS);
      }

      markHall1HotspotCompleted("trophy_vault");
      markHallOfChampionsComplete();
      setStatus("success");
    } catch (err) {
      console.error("Trophy vault save:", err);
      completingRef.current = false;
      setStatus("playing");
      setErrorMsg("Could not save progress. Please try again.");
    }
  }, [
    status,
    placements,
    stageRowId,
    isDemoBypass,
    backendBase,
    adminToken,
    storedUser,
  ]);

  const dragPlate = drag ? plateById[drag.nameplateId] : null;

  if (status === "success") {
    return (
      <div className="hall1-stage6 trophy-vault trophy-vault--success">
        <div className="stage-escape-hud">
          <StageTimer
            timeLabel={formatSecondsToClock(elapsedSec)}
            points={displayPoints}
          />
        </div>

        <header className="trophy-vault__header trophy-vault__header--success">
          <h1 className="trophy-vault__title">Champion&apos;s Seal restored!</h1>
          <div className="trophy-vault__title-rule" aria-hidden>
            <span />
          </div>
          <p className="trophy-vault__finale-sub">
            The Hall of Champions is ready for visitors.
          </p>
        </header>

        <div
          className={`trophy-vault__seal-wrap${
            sealReveal ? " trophy-vault__seal-wrap--in" : ""
          }`}
        >
          <img
            src={championsSeal}
            alt="Champion's Seal"
            className="trophy-vault__seal"
            draggable={false}
          />
          <div className="trophy-vault__seal-sparks" aria-hidden />
        </div>

        <button
          type="button"
          className="trophy-vault__proceed"
          style={{ backgroundImage: `url(${proceedBtn})` }}
          onClick={() => navigate("/complete")}
        >
          VIEW SUMMARY
        </button>
      </div>
    );
  }

  return (
    <div className="hall1-stage6 trophy-vault">
      <div className="stage-escape-hud">
        <StageTimer
          timeLabel={formatSecondsToClock(elapsedSec)}
          points={displayPoints}
        />
      </div>

      <div className="trophy-vault__inner">
        <header className="trophy-vault__header">
          <h1 className="trophy-vault__title">TROPHY VAULT</h1>
          <div className="trophy-vault__title-rule" aria-hidden>
            <span />
          </div>
        </header>

        <div className="trophy-vault__layout">
          <aside
            className="trophy-vault__objective"
            style={{ backgroundImage: `url(${objectiveBox})` }}
          >
            <p className="trophy-vault__objective-text">
            Match every trophy with its correct nameplate to complete the final exhibit.
            </p>
          </aside>

          <div className="trophy-vault__cases" role="list">
            {TROPHIES.map((trophy) => {
              const assignedId = placements[trophy.id];
              const assigned = assignedId ? plateById[assignedId] : null;
              const isLocked = lockedTrophyIds.includes(trophy.id);
              const isOver = dropTargetId === trophy.id && drag && !isLocked;
              const isWrong = feedback.wrong.includes(trophy.id);
              const isCorrect =
                isLocked || feedback.correct.includes(trophy.id);

              return (
                <div
                  key={trophy.id}
                  role="listitem"
                  data-trophy-slot={trophy.id}
                  className={`trophy-case${isOver ? " trophy-case--over" : ""}${
                    isWrong ? " trophy-case--wrong" : ""
                  }${isCorrect ? " trophy-case--correct" : ""}`}
                >
                  <img
                    src={trophy.image}
                    alt={trophy.label}
                    className="trophy-case__img"
                    draggable={false}
                  />
                  <div className="trophy-case__slot">
                    {assigned ? (
                      <Nameplate
                        plate={assigned}
                        compact
                        locked={isLocked}
                        lifted={drag?.nameplateId === assigned.id}
                        onPointerDown={onPointerDownPlate}
                      />
                    ) : (
                      <span className="trophy-case__slot-empty">
                        Drop nameplate
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="trophy-vault__pool" data-nameplate-pool="1">
          {poolIds.map((id) => (
            <Nameplate
              key={id}
              plate={plateById[id]}
              lifted={drag?.nameplateId === id}
              onPointerDown={onPointerDownPlate}
            />
          ))}
        </div>

        {errorMsg ? (
          <p className="trophy-vault__error" role="alert">
            {errorMsg}
          </p>
        ) : null}

        <button
          type="button"
          className="trophy-vault__submit"
          style={{ backgroundImage: `url(${proceedBtn})` }}
          disabled={status === "saving"}
          onClick={handleSubmit}
        >
          {status === "saving" ? "SAVING…" : "RESTORE SEAL"}
        </button>
      </div>

      {drag && dragPlate ? (
        <DragGhost
          plate={dragPlate}
          x={drag.x}
          y={drag.y}
          width={drag.width}
        />
      ) : null}
    </div>
  );
}

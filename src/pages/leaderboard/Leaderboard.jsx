import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchThemeData } from "../../admin/themeSlice";
import { selectAdminToken } from "../../admin/sessionSlice";
import { setBackButtonUrl } from "../uiSlice";
import { setupAppPageBodyBackground } from "../game/gameStageBackground";
import deskBg from "../hall_1/stage5/stage5_desk.png";
import mobBg from "../hall_1/stage5/stage5_mob.png";
import "../fonts/breuer-headline.css";
import "./leaderboard.css";

const TOTAL_KEYS = 5;
const LEADERBOARD_TOP_N = 10;

function readSessionUserId() {
  let u = {};
  try {
    u = JSON.parse(sessionStorage.getItem("userData") || "{}") || {};
  } catch {
    u = {};
  }
  const id = u?.userId ?? u?.userid ?? u?.id;
  if (id == null || id === "") return "";
  return String(id).trim();
}

function normalizeLeaderboardRow(row, index) {
  if (!row || typeof row !== "object") {
    return {
      key: `row-${index}`,
      rank: index + 1,
      userId: "",
      name: "—",
      points: 0,
      time: "00:00",
      keys: 0,
      completed: false,
    };
  }
  const name =
    row.name ??
    row.player_name ??
    row.user_name ??
    row.display_name ??
    (row.email ? String(row.email).split("@")[0] : null) ??
    "—";
  const rawPoints = row.points ?? row.score ?? row.total_score ?? row.point ?? 0;
  const n = Number(rawPoints);
  const points = Number.isFinite(n) ? n : 0;
  const rawTime = row.time ?? row.display_time ?? "00:00";
  const time = String(rawTime).trim() || "00:00";
  const rankNum = Number(row.rank ?? row.rk);
  const rank = Number.isFinite(rankNum) && rankNum > 0 ? rankNum : index + 1;
  const userId =
    row.userId != null && row.userId !== ""
      ? String(row.userId)
      : row.userid != null && row.userid !== ""
        ? String(row.userid)
        : "";
  const keysNum = Number(row.keys);
  const keys = Number.isFinite(keysNum) ? Math.max(0, Math.min(TOTAL_KEYS, keysNum)) : 0;

  return {
    key: String(row.userId ?? row.userid ?? row.rank ?? row.id ?? index),
    rank,
    userId,
    name: String(name),
    points,
    time,
    keys,
    completed: row.completed != null ? Boolean(row.completed) : keys >= TOTAL_KEYS,
  };
}

/** Top N, plus the viewer's own row pinned underneath when they rank lower. */
function buildTopRows(rows, currentUserId) {
  if (!rows.length) return [];
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const top = sorted.filter((r) => r.rank >= 1 && r.rank <= LEADERBOARD_TOP_N);
  if (!currentUserId) return top;
  const userRow = sorted.find((r) => r.userId && String(r.userId) === String(currentUserId));
  if (!userRow || userRow.rank <= LEADERBOARD_TOP_N) return top;
  return [...top, { ...userRow, isPinnedViewer: true }];
}

/** Rank 1–3: numbered medal inside a laurel; others: plain number. */
function RankBadge({ rank }) {
  if (rank > 3) return <span className="lb-rank-num">{rank}</span>;
  return (
    <span className={`lb-medal lb-medal--${rank}`} aria-label={`Rank ${rank}`}>
      <svg className="lb-medal__laurel" viewBox="0 0 48 40" aria-hidden="true">
        <g fill="currentColor">
          {[0, 1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <ellipse cx={9 - i * 0.6} cy={30 - i * 7} rx="3.2" ry="1.6" transform={`rotate(${-50 + i * 18} ${9 - i * 0.6} ${30 - i * 7})`} />
              <ellipse cx={39 + i * 0.6} cy={30 - i * 7} rx="3.2" ry="1.6" transform={`rotate(${50 - i * 18} ${39 + i * 0.6} ${30 - i * 7})`} />
            </React.Fragment>
          ))}
        </g>
      </svg>
      <span className="lb-medal__disc">{rank}</span>
    </span>
  );
}

function LeaderboardRow({ row, isYou }) {
  const tone = row.rank <= 3 ? ` lb-row--top${row.rank}` : "";
  return (
    <li
      className={`lb-row${tone}${isYou ? " lb-row--you" : ""}${
        row.isPinnedViewer ? " lb-row--pinned" : ""
      }`}
    >
      <span className="lb-cell lb-cell--rank">
        <RankBadge rank={row.rank} />
      </span>
      <span className="lb-cell lb-cell--player">
        <span className="lb-row__name">{row.name}</span>
        {isYou ? <span className="lb-you">You</span> : null}
      </span>
      <span className="lb-cell lb-cell--keys">{row.keys}</span>
      <span className="lb-cell lb-cell--score">{row.points.toLocaleString()}</span>
      <span className="lb-cell lb-cell--time">{row.time}</span>
      <span className={`lb-cell lb-cell--status${row.completed ? " is-done" : ""}`}>
        {row.completed ? "Completed" : "In progress"}
      </span>
    </li>
  );
}

function Leaderboard() {
  const dispatch = useDispatch();
  const adminToken = useSelector(selectAdminToken);
  const { currentTheme } = useSelector((s) => s.theme);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(() => readSessionUserId());
  /** "top" | "mine" */
  const [tab, setTab] = useState("top");

  const backendBase = useMemo(
    () => String(process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, ""),
    []
  );

  useEffect(() => {
    dispatch(fetchThemeData({ themeId: currentTheme || null }));
  }, [dispatch, currentTheme]);

  /* Header BACK leaves the game (platform link), never back into Stage 5. */
  useEffect(() => {
    let redirect = null;
    try {
      redirect = JSON.parse(sessionStorage.getItem("userData") || "{}")?.backButtonRedirect || null;
    } catch {
      redirect = null;
    }
    dispatch(setBackButtonUrl(redirect || process.env.REACT_APP_BASE_URL || null));
  }, [dispatch]);

  useEffect(() => {
    document.body.classList.add("leaderboard-page");
    const cleanupBg = setupAppPageBodyBackground(document.body, {
      deskForeground: deskBg,
      mobForeground: mobBg,
    });
    const t = window.setTimeout(() => {
      const mob =
        window.innerWidth > 0 &&
        window.innerWidth <= 768 &&
        window.matchMedia("(orientation: portrait)").matches;
      document.body.style.setProperty(
        "background-image",
        `url("${mob ? mobBg : deskBg}")`,
        "important"
      );
      document.body.style.setProperty("background-size", "cover", "important");
      document.body.style.setProperty("background-position", "center center", "important");
      document.body.style.setProperty("background-repeat", "no-repeat", "important");
      document.body.style.setProperty("background-attachment", "fixed", "important");
    }, 0);
    return () => {
      window.clearTimeout(t);
      cleanupBg?.();
      document.body.classList.remove("leaderboard-page");
      document.body.style.removeProperty("background-image");
    };
  }, []);

  const loadLeaderboard = useCallback(async () => {
    if (!adminToken || !backendBase) {
      setLoading(false);
      setError(!adminToken ? "Not signed in." : "Server URL not configured.");
      return;
    }
    setLoading(true);
    setError(null);
    const uid = readSessionUserId();
    setCurrentUserId(uid);
    try {
      const res = await fetch(`${backendBase}/getLeaderboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          userId: uid || undefined,
          limit: LEADERBOARD_TOP_N,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && Array.isArray(data.data)) {
        setRows(data.data.map(normalizeLeaderboardRow));
      } else {
        setError(data.error || data.message || "Failed to load leaderboard.");
      }
    } catch (e) {
      setError(e.message || "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }, [adminToken, backendBase]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const isYou = useCallback(
    (r) => Boolean(currentUserId && r.userId && String(r.userId) === String(currentUserId)),
    [currentUserId]
  );

  const topRows = useMemo(() => buildTopRows(rows, currentUserId), [rows, currentUserId]);
  const myRow = useMemo(() => rows.find(isYou) || null, [rows, isYou]);
  const shownRows = tab === "top" ? topRows : myRow ? [myRow] : [];


  let body;
  if (loading) body = <p className="lb-status">Loading scores…</p>;
  else if (error) body = <p className="lb-status lb-status--error">{error}</p>;
  else if (!shownRows.length) {
    body = (
      <p className="lb-status">
        {tab === "top" ? "No scores yet." : "Your rank will appear here once you start the journey."}
      </p>
    );
  } else {
    body = (
      <div className="lb-table" role="table" aria-label="Leaderboard rankings">
        <div className="lb-head" role="row">
          <span className="lb-cell lb-cell--rank" role="columnheader">Rank</span>
          <span className="lb-cell lb-cell--player" role="columnheader">Player</span>
          <span className="lb-cell lb-cell--keys" role="columnheader">Keys</span>
          <span className="lb-cell lb-cell--score" role="columnheader">Score</span>
          <span className="lb-cell lb-cell--time" role="columnheader">Time</span>
          <span className="lb-cell lb-cell--status" role="columnheader">Status</span>
        </div>
        <ul className="lb-rows">
          {shownRows.map((r) => (
            <LeaderboardRow
              key={r.isPinnedViewer ? `pinned-${r.key}` : r.key}
              row={r}
              isYou={isYou(r)}
            />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="lb-page">
      <section className="lb-board" aria-labelledby="lb-title">
        <header className="lb-banner">
          <h1 id="lb-title" className="lb-banner__title">
            Leaderboard
          </h1>
        </header>

        <p className="lb-subtitle">
          <span className="lb-subtitle__gem" aria-hidden="true" />
          Journey of New Beginnings
          <span className="lb-subtitle__gem" aria-hidden="true" />
        </p>

        <div className="lb-tabs" role="tablist" aria-label="Leaderboard view">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "top"}
            className={`lb-tab${tab === "top" ? " is-active" : ""}`}
            onClick={() => setTab("top")}
          >
            Top Players
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            className={`lb-tab${tab === "mine" ? " is-active" : ""}`}
            onClick={() => setTab("mine")}
          >
            My Rank
          </button>
        </div>

        <div className="lb-panel" role="tabpanel">
          {body}
        </div>

        <footer className="lb-footer">
          <p className="lb-note">
            <span className="lb-note__icon" aria-hidden="true">
              i
            </span>
            Ranks are based on score, then completion time.
          </p>
        </footer>
      </section>
    </div>
  );
}

export default Leaderboard;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchThemeData } from "../../admin/themeSlice";
import { selectAdminToken } from "../../admin/sessionSlice";
import { setupAppPageBodyBackground } from "../game/gameStageBackground";
import deskBg from "../final_screen/final_desk.jpg";
import mobBg from "../final_screen/final_mob.jpg";
import "../fonts/breuer-headline.css";
import "./leaderboard.css";

function readSessionUserId() {
  try {
    const raw = sessionStorage.getItem("userData");
    if (!raw) return "";
    const u = JSON.parse(raw);
    const id = u?.userId ?? u?.userid ?? u?.id;
    if (id == null || id === "") return "";
    return String(id).trim();
  } catch {
    return "";
  }
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

  return {
    key: String(row.userId ?? row.userid ?? row.rank ?? row.id ?? index),
    rank,
    userId,
    name: String(name),
    points,
    time,
  };
}

const LEADERBOARD_TOP_N = 4;

function buildDisplayRows(rows, currentUserId) {
  if (!rows.length) return [];

  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const top = sorted
    .filter((r) => r.rank >= 1 && r.rank <= LEADERBOARD_TOP_N)
    .slice(0, LEADERBOARD_TOP_N);

  if (!currentUserId) return top;

  const userRow = sorted.find(
    (r) => r.userId && String(r.userId) === String(currentUserId)
  );

  if (!userRow || userRow.rank <= LEADERBOARD_TOP_N) return top;

  return [...top, { ...userRow, isPinnedViewer: true }];
}

function TempleIcon() {
  return (
    <svg className="lb-temple" viewBox="0 0 64 40" aria-hidden>
      <path
        d="M32 2 L58 16 H6 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M10 16 V34 H54 V16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M4 34 H60" stroke="currentColor" strokeWidth="2.4" />
      <path d="M18 16 V34 M32 16 V34 M46 16 V34" stroke="currentColor" strokeWidth="2" />
      <path
        d="M2 12 C10 8, 14 18, 22 14 M42 14 C50 18, 54 8, 62 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.85"
      />
    </svg>
  );
}

function LaurelRank({ rank }) {
  return (
    <span className="lb-laurel" aria-label={`Rank ${rank}`}>
      <svg className="lb-laurel__wreath" viewBox="0 0 48 48" aria-hidden>
        <path
          d="M14 38c-6-6-8-14-6-22 4 3 7 8 8 14-3-1-6-4-8-8 1 7 3 13 6 16z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M34 38c6-6 8-14 6-22-4 3-7 8-8 14 3-1 6-4 8-8-1 7-3 13-6 16z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M12 18c2-1 4 0 5 2M11 24c2 0 4 1 5 3M13 30c2 0 3 2 4 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M36 18c-2-1-4 0-5 2M37 24c-2 0-4 1-5 3M35 30c-2 0-3 2-4 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M22 40c2 1 4 1 6 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="lb-laurel__num">{rank}</span>
    </span>
  );
}

function RankDisplay({ rank }) {
  if (rank === 1 || rank === 2) {
    return <LaurelRank rank={rank} />;
  }
  return <span className="lb-rank-num">{rank}</span>;
}

function RowDivider() {
  return (
    <div className="lb-divider" aria-hidden>
      <span className="lb-divider__line" />
      <span className="lb-divider__gem" />
      <span className="lb-divider__line" />
    </div>
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

  const backendBase = useMemo(
    () => String(process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, ""),
    []
  );

  useEffect(() => {
    dispatch(fetchThemeData({ themeId: currentTheme || null }));
  }, [dispatch, currentTheme]);

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
      document.body.style.setProperty("background-size", "100% 100%", "important");
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

  const displayRows = useMemo(
    () => buildDisplayRows(rows, currentUserId),
    [rows, currentUserId]
  );

  return (
    <div className="lb-page">
      <div className="lb-layout">
        <header className="lb-title-block">
          <TempleIcon />
          <div className="lb-title-row">
            <span className="lb-title-row__rule" aria-hidden />
            <h1 className="lb-title">LEADERBOARD</h1>
            <span className="lb-title-row__rule" aria-hidden />
          </div>
          <div className="lb-title-ornament" aria-hidden>
            <span className="lb-title-ornament__line" />
            <span className="lb-title-ornament__gem" />
            <span className="lb-title-ornament__line" />
          </div>
        </header>

        <div className="lb-card">
          <div className="lb-card__frame">
            {loading ? (
              <p className="lb-status">Loading scores…</p>
            ) : error ? (
              <p className="lb-status lb-status--error">{error}</p>
            ) : rows.length === 0 ? (
              <p className="lb-status">No scores yet.</p>
            ) : (
              <div
                className="lb-table"
                role="region"
                aria-label="Leaderboard rankings"
                tabIndex={0}
              >
                <div className="lb-colhead" aria-hidden>
                  <span className="lb-colhead__cell lb-colhead__cell--rank">
                    RANK
                  </span>
                  <span className="lb-colhead__cell lb-colhead__cell--player">
                    PLAYER
                  </span>
                  <span className="lb-colhead__cell lb-colhead__cell--time">
                    TIME TAKEN
                  </span>
                  <span className="lb-colhead__cell lb-colhead__cell--score">
                    SCORE
                  </span>
                </div>

                <ul className="lb-rows">
                  {displayRows.map((r, idx) => {
                    const isYou =
                      currentUserId &&
                      r.userId &&
                      String(r.userId) === String(currentUserId);

                    return (
                      <React.Fragment
                        key={r.isPinnedViewer ? `pinned-${r.key}` : r.key}
                      >
                        {r.isPinnedViewer && idx > 0 ? (
                          <li className="lb-rows__divider" aria-hidden>
                            <RowDivider />
                          </li>
                        ) : null}
                        <li
                          className={`lb-row${isYou ? " lb-row--you" : ""}${
                            r.isPinnedViewer ? " lb-row--pinned" : ""
                          }`}
                        >
                          <div className="lb-row__rank">
                            <RankDisplay rank={r.rank} />
                          </div>
                          <div className="lb-row__player">
                            <span className="lb-row__name">{r.name}</span>
                          </div>
                          <div className="lb-row__time">{r.time}</div>
                          <div className="lb-row__score">
                            {r.points.toLocaleString()}
                          </div>
                        </li>
                      </React.Fragment>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Leaderboard;

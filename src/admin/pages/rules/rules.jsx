import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import "./rules.css";
import "../themeupdate/themeupdate.css";
import { fetchThemeData } from "../../themeSlice";
import { selectAdminToken, selectOrganizationId, selectSessionId } from "../../sessionSlice";
import { updateThemeData } from "../../functions/updateThemeData";

const MAX_TITLE_LEN = 200;
const MAX_THANKYOU_TEXT_LEN = 300;
/** Per-right-answer points and wrong-answer penalty (admin rules page). */
const MIN_SCORE_MARKS = 1;
const MAX_SCORE_MARKS = 100;
const MAX_TITLE_FONT_PX = 200;
const MIN_TITLE_FONT_PX = 8;
const DEFAULT_TITLE_FONT_PX = 22;

/** Digits only; empty while typing; max capped (min applied on blur). */
const normalizeTitleFontPxInput = (raw, max) => {
  const digits = String(raw).replace(/\D/g, "");
  if (digits === "") return "";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  if (n > max) return String(max);
  return String(n);
};

const NAMED_COLORS = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  gray: "#808080",
  grey: "#808080",
};

function toColorInputValue(val) {
  if (!val || typeof val !== "string") return "#000000";
  const v = val.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(v)) return `#${v.slice(1, 7).toLowerCase()}`;
  const named = NAMED_COLORS[v.toLowerCase()];
  if (named) return named;
  return "#000000";
}

const clampInt = (n, min, max, fallback) => {
  const x = parseInt(String(n), 10);
  if (Number.isNaN(x)) return fallback;
  return Math.min(max, Math.max(min, x));
};

/** Digits only; no negatives, no letters. Empty while typing; 0 and below become "". Capped at max. */
const normalizeMarksInput = (raw, max) => {
  const digits = String(raw).replace(/\D/g, "");
  if (digits === "") return "";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1) return "";
  if (n > max) return String(max);
  return String(n);
};

const Rules = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const adminToken = useSelector(selectAdminToken);
  const organizationId = useSelector(selectOrganizationId);
  const sessionId = useSelector(selectSessionId);
  const { currentTheme, data, status } = useSelector((state) => state.theme);

  const [loading, setLoading] = useState(false);
  const [landingTitle, setLandingTitle] = useState("");
  const [thankyouText, setThankyouText] = useState("");
  const [thankyouBadgeText, setThankyouBadgeText] = useState("");
  const [points, setPoints] = useState("1");
  const [wrongPoints, setWrongPoints] = useState("1");
  const [titleDesktopFontPx, setTitleDesktopFontPx] = useState(String(DEFAULT_TITLE_FONT_PX));
  const [titleColor, setTitleColor] = useState("#000000");
  const [gameTextColor, setGameTextColor] = useState("#111111");
  const [beltColor, setBeltColor] = useState("#c4a574");
  const [buttonColor, setButtonColor] = useState("#e9695e");
  const [buttonTextColor, setButtonTextColor] = useState("#000000");
  useEffect(() => {
    if (currentTheme) dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true }));
  }, [dispatch, currentTheme]);

  useEffect(() => {
    if (!data) return;
    setLandingTitle(String(data.landing_page_title ?? "").replace(/^\s+/, ""));
    setThankyouText(String(data.custom_text_thank_you_page ?? "").trim());
    setThankyouBadgeText(String(data.custom_text_thank_you_page_badge_earned ?? "").trim());

    setPoints(String(clampInt(data.points, MIN_SCORE_MARKS, MAX_SCORE_MARKS, MIN_SCORE_MARKS)));
    setWrongPoints(String(clampInt(data.wrong_points, MIN_SCORE_MARKS, MAX_SCORE_MARKS, MIN_SCORE_MARKS)));

    const tf = data.landing_page_title_desktop_font_size_px;
    if (tf == null || tf === "") {
      setTitleDesktopFontPx(String(DEFAULT_TITLE_FONT_PX));
    } else {
      setTitleDesktopFontPx(String(clampInt(tf, MIN_TITLE_FONT_PX, MAX_TITLE_FONT_PX, DEFAULT_TITLE_FONT_PX)));
    }

    setTitleColor(toColorInputValue(data.landing_page_title_color));
    setGameTextColor(toColorInputValue(data.game_text_color || "#111111"));
    setBeltColor(toColorInputValue(data.belt_color || "#c4a574"));
    setButtonColor(toColorInputValue(data.button_color));
    setButtonTextColor(toColorInputValue(data.button_Textcolor ?? data.button_text_color));
  }, [data]);

  const stripLeading = useCallback((val) => val.replace(/^\s+/, ""), []);

  const validate = () => {
    const title = landingTitle.trim();
    if (!title) return { ok: false, msg: "Title cannot be empty." };
    if (title.length > MAX_TITLE_LEN) return { ok: false, msg: `Title must be at most ${MAX_TITLE_LEN} characters.` };

    const ty = thankyouText.trim();
    if (ty.length > MAX_THANKYOU_TEXT_LEN) {
      return { ok: false, msg: `Thank you text must be at most ${MAX_THANKYOU_TEXT_LEN} characters.` };
    }
    const tyBadge = thankyouBadgeText.trim();
    if (tyBadge.length > MAX_THANKYOU_TEXT_LEN) {
      return {
        ok: false,
        msg: `Thank you message (badge earned) must be at most ${MAX_THANKYOU_TEXT_LEN} characters.`,
      };
    }

    return {
      ok: true,
      payload: {
        landing_page_title: title,
        custom_text_thank_you_page: ty,
        custom_text_thank_you_page_badge_earned: tyBadge,
        points: clampInt(points, MIN_SCORE_MARKS, MAX_SCORE_MARKS, MIN_SCORE_MARKS),
        wrong_points: clampInt(wrongPoints, MIN_SCORE_MARKS, MAX_SCORE_MARKS, MIN_SCORE_MARKS),
        landing_page_title_desktop_font_size_px: clampInt(
          titleDesktopFontPx === "" ? DEFAULT_TITLE_FONT_PX : titleDesktopFontPx,
          MIN_TITLE_FONT_PX,
          MAX_TITLE_FONT_PX,
          DEFAULT_TITLE_FONT_PX
        ),
        landing_page_title_color: titleColor,
        game_text_color: gameTextColor,
        belt_color: beltColor,
        button_color: buttonColor,
        button_Textcolor: buttonTextColor,
      },
    };
  };

  const handleSave = async () => {
    const v = validate();
    if (!v.ok) {
      Swal.fire("Error", v.msg, "error");
      return;
    }
    setLoading(true);
    try {
      await updateThemeData({
        payload: {
          data: v.payload,
          organizationId: organizationId || "admin",
          sessionId: sessionId || "admin",
          currentTheme,
        },
        token: adminToken,
      });
      await dispatch(fetchThemeData({ themeId: currentTheme, isAdmin: true })).unwrap();
      Swal.fire("Success", "Data updated", "success");
    } catch (e) {
      Swal.fire("Error", e.message || "Failed to save", "error");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" && !data) {
    return (
      <div className="rules-page-new">
        <div className="themeupdate-loading">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="back-button-holder">
        <button type="button" className="back-button" onClick={() => navigate("/admin")}>
          <i className="fa-solid fa-arrow-left" /> Back
        </button>
      </div>

      <div className="themeupdate-row rules-php-layout">
        <div className="themeupdate-col rules-php-col rules-php-col--full">
          <div className="themeupdate-card rules-php-card rules-php-card--right">
            <div className="themeupdate-card-body rules-php-card-body">
              <h4 className="themeupdate-label rules-php-card-title">Theme settings</h4>
              <p className="themeupdate-muted" style={{ marginTop: 0 }}>
                How-to-play rules are configured per stage under Game Content.
              </p>
              <h4 className="themeupdate-label rules-php-card-title" style={{ marginTop: 20 }}>
                Page Content
              </h4>

              <div className="rules-php-marks-row">
                <label htmlFor="rules-points" className="rules-php-marks-label">
                  points per right answer
                </label>
                <input
                  id="rules-points"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="themeupdate-input rules-php-number"
                  value={points}
                  onChange={(e) => setPoints(normalizeMarksInput(e.target.value, MAX_SCORE_MARKS))}
                  onBlur={() => {
                    const n = parseInt(points, 10);
                    if (points === "" || Number.isNaN(n) || n < MIN_SCORE_MARKS) {
                      setPoints(String(MIN_SCORE_MARKS));
                    } else {
                      setPoints(String(clampInt(n, MIN_SCORE_MARKS, MAX_SCORE_MARKS, MIN_SCORE_MARKS)));
                    }
                  }}
                />
              </div>

              <div className="rules-php-marks-row">
                <label htmlFor="rules-title-font-px" className="rules-php-marks-label" style={{ display: 'none' }}>
                  Title font size (desktop, px)
                </label>
                <input style={{ display: 'none' }}
                  id="rules-title-font-px"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="themeupdate-input rules-php-number"
                  value={titleDesktopFontPx}
                  onChange={(e) =>
                    setTitleDesktopFontPx(normalizeTitleFontPxInput(e.target.value, MAX_TITLE_FONT_PX))
                  }
                  onBlur={() => {
                    const n = parseInt(titleDesktopFontPx, 10);
                    if (titleDesktopFontPx === "" || Number.isNaN(n) || n < MIN_TITLE_FONT_PX) {
                      setTitleDesktopFontPx(String(DEFAULT_TITLE_FONT_PX));
                    } else {
                      setTitleDesktopFontPx(
                        String(clampInt(n, MIN_TITLE_FONT_PX, MAX_TITLE_FONT_PX, DEFAULT_TITLE_FONT_PX))
                      );
                    }
                  }}
                />
              </div>

              <div className="rules-php-marks-row rules-php-color-row">
                <label htmlFor="rules-title-color" className="rules-php-marks-label">
                  Text color
                </label>
                <input
                  id="rules-title-color"
                  type="color"
                  className="themeupdate-color-input rules-php-color-input"
                  value={titleColor}
                  onChange={(e) => setTitleColor(e.target.value)}
                />
              </div>

              <div className="rules-php-marks-row rules-php-color-row" style={{ display: 'none' }}>
                <label htmlFor="rules-game-text-color" className="rules-php-marks-label">
                  Game text colour
                </label>
                <input
                  id="rules-game-text-color"
                  type="color"
                  className="themeupdate-color-input rules-php-color-input"
                  value={gameTextColor}
                  onChange={(e) => setGameTextColor(e.target.value)}
                />
              </div>

              <div className="rules-php-marks-row rules-php-color-row" style={{ display: 'none' }}>
                <label htmlFor="rules-belt-color" className="rules-php-marks-label">
                  Title box colour
                </label>
                <input
                  id="rules-belt-color"
                  type="color"
                  className="themeupdate-color-input rules-php-color-input"
                  value={beltColor}
                  onChange={(e) => setBeltColor(e.target.value)}
                />
              </div>

              <div className="rules-php-marks-row rules-php-color-row" >
                <label htmlFor="rules-btn-color" className="rules-php-marks-label">
                  Button background color
                </label>
                <input
                  id="rules-btn-color"
                  type="color"
                  className="themeupdate-color-input rules-php-color-input"
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value)}
                />
              </div>

              <div className="rules-php-marks-row rules-php-color-row">
                <label htmlFor="rules-btn-text" className="rules-php-marks-label">
                  Button text color
                </label>
                <input
                  id="rules-btn-text"
                  type="color"
                  className="themeupdate-color-input rules-php-color-input"
                  value={buttonTextColor}
                  onChange={(e) => setButtonTextColor(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rules-action-holder">
        <button type="button" className="save-and-continue" onClick={handleSave} disabled={loading}>
          Save
        </button>
        <button type="button" className="save-and-continue rules-continue-outline" onClick={() => navigate("/admin/themeupdate")}>
          Continue to Categories
        </button>
      </div>
    </>
  );
};

export default Rules;

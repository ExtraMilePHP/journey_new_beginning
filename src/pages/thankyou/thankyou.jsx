import React, { useEffect, useMemo, useState } from 'react';
import '../fonts/breuer-headline.css';
import './thankyou.css';
import { useDispatch, useSelector } from 'react-redux';import { useLocation, useNavigate } from 'react-router-dom';
import { selectAdminToken } from '../../admin/sessionSlice';
import { setBackButtonUrl } from '../uiSlice';
import { ensureThemeJsonArray } from '../../functions/themeAssets';

/** Total draggable items for Sort & Toss (same buckets as welcome game). */
function getSortTossItemCount(theme) {
  if (!theme || typeof theme !== 'object') return 0;
  return (
    ensureThemeJsonArray(theme.category1_items).length +
    ensureThemeJsonArray(theme.category2_items).length +
    ensureThemeJsonArray(theme.category3_items).length
  );
}

function getAdminPointsPerCorrect(theme) {
  const raw = parseInt(theme?.points, 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

const FEEDBACK_OPTIONS = [
  { value: 'Amazingggg', emoji: '🤩', label: 'Amazingggg' },
  { value: 'Loved it', emoji: '😍', label: 'Loved it' },
  { value: 'It was fun', emoji: '😊', label: 'It was fun' },
  { value: 'It was okay', emoji: '👍', label: 'It was okay' },
];

const CONFETTI_MS = 2000;
const CONFETTI_COUNT = 64;

function buildEmojiConfettiPieces() {
  const ts = Date.now();
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    key: `${ts}-${i}`,
    x: Math.random() * 92 + 4,
    y: Math.random() * 85 + 5,
    dx: (Math.random() - 0.5) * 520,
    dy: (Math.random() - 0.5) * 600 + Math.random() * 120,
    rot: Math.random() * 1080 - 540,
    delay: Math.random() * 0.45,
    size: 36 + Math.floor(Math.random() * 44),
  }));
}

function readThankYouUserId(user) {
  const fromUser = user?.userId ?? user?.id;
  if (fromUser != null && String(fromUser).trim() !== '') return String(fromUser).trim();
  try {
    const u = JSON.parse(sessionStorage.getItem('userData') || '{}');
    const id = u?.userId ?? u?.userid ?? u?.id;
    if (id != null && String(id).trim() !== '') return String(id).trim();
  } catch {
    /* ignore */
  }
  return '';
}

function ThankYou() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const adminToken = useSelector(selectAdminToken);
  const { data: themeData } = useSelector((state) => state.theme);

  const backendBase = useMemo(
    () => String(process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, ''),
    []
  );

  const nav = location.state;
  const [points, setPoints] = useState(
    typeof nav?.points === 'number' ? nav.points : 0
  );
  const [time, setTime] = useState(
    nav?.time != null && nav.time !== '' ? String(nav.time) : ''
  );

  const [savedFeedback, setSavedFeedback] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [confettiOn, setConfettiOn] = useState(false);
  const [confettiEmoji, setConfettiEmoji] = useState('');
  const [confettiPieces, setConfettiPieces] = useState(null);

  useEffect(() => {
    if (user?.backButtonRedirect != null) {
      dispatch(setBackButtonUrl(user.backButtonRedirect));
    }
  }, [user, dispatch]);

  useEffect(() => {
    const body = document.body;
    const prev = body.style.getPropertyValue("backdrop-filter");
    body.style.setProperty("backdrop-filter", "blur(9px)");
    return () => {
      if (prev) body.style.setProperty("backdrop-filter", prev);
      else body.style.removeProperty("backdrop-filter");
    };
  }, []);

  useEffect(() => {
    const uid = readThankYouUserId(user);
    if (!uid || !adminToken || !backendBase) return;

    (async () => {
      try {
        const res = await fetch(`${backendBase}/fetchReport`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ userId: uid }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !data.report) return;
        const r = data.report;
        if (r.points !== undefined && r.points !== null) {
          setPoints(Number(r.points) || 0);
        }
        const t = r.time;
        if (t != null && String(t).trim() !== '') {
          setTime(String(t).trim());
        }
        if (r.feedback != null && String(r.feedback).trim() !== '') {
          setSavedFeedback(String(r.feedback).trim());
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [user, adminToken, backendBase]);

  const showBadgeBlock = useMemo(() => {
    const totalItems = getSortTossItemCount(themeData);
    const perCorrect = getAdminPointsPerCorrect(themeData);
    const maxPossible = totalItems * perCorrect;
    if (maxPossible <= 0) return false;
    return points > maxPossible * 0.5;
  }, [themeData, points]);

  const thankYouDisplayText = useMemo(() => {    const standard = themeData?.custom_text_thank_you_page;
    if (!showBadgeBlock) return standard;
    const badgeMsg = String(themeData?.custom_text_thank_you_page_badge_earned ?? '').trim();
    return badgeMsg || standard;
  }, [showBadgeBlock, themeData]);

  const thankYouTextColor = useMemo(() => {
    const raw =
      themeData?.landing_page_title_color ??
      themeData?.landing_page_title_colour;
    if (raw == null || raw === '') return undefined;
    const c = String(raw).trim();
    return c || undefined;
  }, [themeData]);

  const submitFeedback = async (value) => {
    const uid = readThankYouUserId(user);
    if (!uid || !adminToken || !backendBase || feedbackSaving || savedFeedback) return;
    setFeedbackError('');
    setFeedbackSaving(true);
    try {
      const res = await fetch(`${backendBase}/welcomeStageFeedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ userId: uid, feedback: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setFeedbackError(data.message || 'Could not save feedback. Please try again.');
        return;
      }
      setSavedFeedback(value);

      const opt = FEEDBACK_OPTIONS.find((o) => o.value === value);
      const emojiChar = opt?.emoji || '';
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (emojiChar && !reduceMotion) {
        setConfettiEmoji(emojiChar);
        setConfettiPieces(buildEmojiConfettiPieces());
        setConfettiOn(true);
        window.setTimeout(() => {
          setConfettiOn(false);
          setConfettiPieces(null);
          setConfettiEmoji('');
        }, CONFETTI_MS);
      }
    } catch (e) {
      setFeedbackError(e.message || 'Could not save feedback.');
    } finally {
      setFeedbackSaving(false);
    }
  };

  const feedbackLocked = Boolean(savedFeedback) || feedbackSaving;
  const viewerId = readThankYouUserId(user);
  const canSubmitFeedback = Boolean(viewerId && adminToken && backendBase);

  return (
    <>
      {confettiOn && confettiEmoji && confettiPieces ? (
        <div className="thank-you-confetti" aria-hidden="true">
          {confettiPieces.map((p) => (
            <span
              key={p.key}
              className="thank-you-confetti-emoji"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                fontSize: p.size,
                '--ty-dx': `${p.dx}px`,
                '--ty-dy': `${p.dy}px`,
                '--ty-rot': `${p.rot}deg`,
                animationDelay: `${p.delay}s`,
              }}
            >
              {confettiEmoji}
            </span>
          ))}
        </div>
      ) : null}
      <div
        className="thank-you-container thank-you-container--centered"
        style={thankYouTextColor ? { color: thankYouTextColor } : undefined}
      >        <section
          className="thank-you-feedback"
          aria-label="How was your recipe experience? Tap an emoji to share your thoughts"
        >
          <h2
            className="thank-you-feedback__title"
            style={{ color: themeData?.landing_page_title_color ?? themeData?.landing_page_title_colour }}
          >
            How was your recipe experience? Tap an emoji to share your thoughts 🥗😊
          </h2>
          <div className="thank-you-feedback__grid">
            {FEEDBACK_OPTIONS.map((opt) => {
              const selected = savedFeedback === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`thank-you-feedback__card${selected ? ' thank-you-feedback__card--selected' : ''}`}
                  onClick={() => submitFeedback(opt.value)}
                  disabled={!canSubmitFeedback || feedbackLocked}
                  aria-pressed={selected}
                >
                  <span className="thank-you-feedback__emoji" aria-hidden="true">
                    {opt.emoji}
                  </span>
                  <span className="thank-you-feedback__label">{opt.label}</span>
                </button>
              );
            })}
          </div>
          {feedbackError ? <p className="thank-you-feedback__error">{feedbackError}</p> : null}
          <p className="thank-you-feedback__hint">Your feedback helps us improve!</p>
        </section>

        {showBadgeBlock ? (
          thankYouDisplayText ? (
            <h1 className="thank-you-heading thank-you-heading--prewrap">{thankYouDisplayText}</h1>
          ) : null
        ) : (
          <div className="thank-you-text">{thankYouDisplayText}</div>
        )}
       
        <button
          type="button"
          className="thank-you-leaderboard-btn"
          onClick={() => navigate('/leaderboard')}
          style={{
            ...(themeData?.button_color ? { background: themeData.button_color } : null),
            ...(themeData?.button_Textcolor
              ? { color: themeData.button_Textcolor, borderColor: themeData.button_Textcolor }
              : null),
          }}
        >
          Leaderboard
        </button>
      </div>
    </>
  );
}

export default ThankYou;

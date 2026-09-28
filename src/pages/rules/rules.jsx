import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { selectAdminToken } from "../../admin/sessionSlice";
import { processQuestions } from "../../admin/questionSlice";
import { initQuestions } from "../../functions/setUserQuestions";
import { setBackButtonUrl } from "../uiSlice";
import { setupAppPageBodyBackground } from "../game/gameStageBackground";
import "../fonts/breuer-headline.css";
import "./rules.css";

import rulesBg from "./img/rules_bg.png";
import rulesImg from "./img/rules.png";
import rulesMobImg from "./img/rules_mob.png";
import startBtnImg from "../img/button1.png";

function UserRules() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data: themeData } = useSelector((state) => state.theme);
  const { user } = useSelector((state) => state.auth);
  const adminToken = useSelector(selectAdminToken);
  const [nextLoading, setNextLoading] = useState(false);

  useEffect(() => {
    dispatch(setBackButtonUrl("/login?&save=true"));
  }, [dispatch]);

  useEffect(() => {
    return setupAppPageBodyBackground(document.body, {
      deskForeground: rulesBg,
      mobForeground: rulesBg,
    });
  }, []);

  useEffect(() => {
    if (!themeData || !user || !adminToken) return;

    const baseQuestions = parseInt(
      themeData.noOfQuestion ?? themeData.no_of_questions,
      10
    );
    const needsQuizInit = Number.isFinite(baseQuestions) && baseQuestions >= 1;
    if (!needsQuizInit) return;

    dispatch(processQuestions())
      .unwrap()
      .then(() =>
        initQuestions({
          userId: user.userId,
          email: user.email,
          fullName: user.name,
          themeName: themeData.themename,
          token: adminToken,
        })
      )
      .catch((err) => {
        console.error("Error in process→init chain:", err);
      });
  }, [themeData, user, adminToken, dispatch]);

  const handleContinue = useCallback(
    (e) => {
      e.preventDefault();
      if (!user || nextLoading) return;
      setNextLoading(true);
      navigate("/hall-1", { replace: true });
    },
    [user, nextLoading, navigate]
  );

  return (
    <div className="rules-page">
      <div
        className="rules-page__bg"
        style={{ backgroundImage: `url(${rulesBg})` }}
        aria-hidden="true"
      />
      <div className="rules-layout">
        <div className="rules-board-wrap">
          <picture>
            <source
              media="(max-width: 768px) and (orientation: portrait)"
              srcSet={rulesMobImg}
            />
            <img
              src={rulesImg}
              alt="How to play: 1. Explore - visit each checkpoint. 2. Solve - complete a new challenge. 3. Learn - discover festive traditions. 4. Unlock - collect five Keys of Knowledge. Complete all five checkpoints to unlock the Grand Celebration."
              className="rules-board"
              draggable={false}
            />
          </picture>

          <button
            type="button"
            className="rules-continue-btn"
            disabled={nextLoading || !user}
            onClick={handleContinue}
            style={{ backgroundImage: `url(${startBtnImg})` }}
          >
            {nextLoading ? "LOADING…" : "START JOURNEY"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserRules;

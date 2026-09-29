import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../loginSlice";
import "./login.css";
import { setBackButtonUrl } from "../uiSlice";
import Swal from "sweetalert2";
import logoImg from "../../img/logo.png";
import startBtnImg from "../img/button1.png";
import backgroundDesk from "../../img/background.png";
import backgroundMob from "../../img/mob.png";
import {
  setupAppPageBodyBackground,
} from "../game/gameStageBackground";

function Login() {
  const dispatch = useDispatch();
  const { status, user, error } = useSelector((state) => state.auth);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdmin = searchParams.get("admin") === "true";
  const [beginLoading, setBeginLoading] = useState(false);

  const handleBeginPlay = useCallback(
    (e) => {
      e.preventDefault();
      if (!user || beginLoading) return;
      setBeginLoading(true);
      navigate("/rules", { replace: true });
    },
    [user, beginLoading, navigate]
  );

  useEffect(() => {
    dispatch(loginUser());
  }, [dispatch]);

  useEffect(() => {
    if (status === "succeeded" && user && isAdmin) {
      navigate("/admin");
    }
  }, [status, user, isAdmin, navigate]);

  useEffect(() => {
    if (status === "succeeded" && user?.backButtonRedirect) {
      dispatch(setBackButtonUrl(user.backButtonRedirect));
    }
  }, [status, user, dispatch]);

  useEffect(() => {
    return setupAppPageBodyBackground(document.body, {
      deskForeground: backgroundDesk,
      mobForeground: backgroundMob,
    });
  }, []);

  useEffect(() => {
    if (status !== "failed") return;
    const msg = error ? String(error) : "Session expired";
    const redirect = user && user.backButtonRedirect ? user.backButtonRedirect : "/";
    Swal.fire("Session Expired!", msg, "error").then(() => {
      window.location.href = redirect;
    });
  }, [status, error, user]);

  // show "already played" when login payload has gameover > 0 (DB stages.gameover)
  useEffect(() => {
    if (isAdmin) return;
    if (status !== "succeeded" || !user) return;
    if (Number(user.gameover ?? 0) > 0) {
      const redirect = user.backButtonRedirect || "/";
      Swal.fire("You have already played!", "  ", "error").then(() => {
        window.location.href = redirect;
      });
    }
  }, [status, user, isAdmin]);

  if (status === "loading") {
    return (
      <div className="login-main-container">
        <div className="quiz-loader-container">
          <div className="quiz-loader"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-main-container">
      <img
        src={logoImg}
        className="login-logo1"
        alt="Restore India's Legacy"
      />
      {user && status === "succeeded" && (
        <button
          type="button"
          className="begin-play-btn"
          disabled={beginLoading}
          onClick={handleBeginPlay}
          style={{ backgroundImage: `url(${startBtnImg})` }}
        >
          {beginLoading ? "LOADING…" : "BEGIN JOURNEY"}
        </button>
      )}
    </div>
  );
}

export default Login;

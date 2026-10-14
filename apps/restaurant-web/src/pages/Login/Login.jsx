import React, { useCallback, useState, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import TurnstileWidget from "../../components/auth/TurnstileWidget";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  const handleTurnstileError = useCallback(() => {
    setTurnstileToken("");
  }, []);

  const handleTurnstileExpired = useCallback(() => {
    setTurnstileToken("");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (captchaRequired && !turnstileToken) return;

    const result = await login(email, password, turnstileToken);
    if (result?.captchaRequired) setCaptchaRequired(true);
    if (captchaRequired) {
      setTurnstileToken("");
      setTurnstileResetKey((current) => current + 1);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Restaurant Admin Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {captchaRequired && (
          <TurnstileWidget
            action="login"
            onToken={setTurnstileToken}
            onExpired={handleTurnstileExpired}
            onError={handleTurnstileError}
            resetKey={turnstileResetKey}
          />
        )}
        <button type="submit" disabled={captchaRequired && !turnstileToken}>Login</button>
        <p>
          Don't have an account? <a href="/register">Register now</a>
        </p>
      </form>
    </div>
  );
};

export default Login;

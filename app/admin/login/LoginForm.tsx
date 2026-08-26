"use client";

import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
        cache: "no-store",
      });
      let payload: { error?: string } = {};
      try { payload = await response.json() as { error?: string }; } catch { /* handled below */ }
      if (!response.ok) throw new Error(payload.error ?? "Неверный логин или пароль");
      window.location.assign("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось выполнить вход");
      setBusy(false);
    }
  }

  return <form className="admin-login-form" onSubmit={submit} noValidate>
    <label className="admin-visual-field"><span>Логин</span><input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" /></label>
    <label className="admin-visual-field"><span>Пароль</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
    <button type="submit" className="button" disabled={busy}>{busy ? "Входим…" : "Войти"}</button>
    {error && <p className="admin-message admin-message--error" role="alert">{error}</p>}
  </form>;
}

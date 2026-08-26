import LoginForm from "./LoginForm";

export const metadata = {
  title: "Вход · Администрирование · Ассоль",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return <main className="admin-visual-page admin-login-page">
    <section className="admin-login-card" aria-labelledby="admin-login-title">
      <p className="admin-kicker">Ассоль · Администрирование</p>
      <h1 id="admin-login-title">Войти</h1>
      <p>Введите данные администратора, чтобы продолжить.</p>
      <LoginForm />
    </section>
  </main>;
}

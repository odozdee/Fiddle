import AuthForm from "../auth-form";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot" />;
}

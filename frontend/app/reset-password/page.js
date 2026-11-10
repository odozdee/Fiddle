import AuthForm from "../auth-form";

export const metadata = { title: "Choose password" };

export default function ResetPasswordPage() {
  return <AuthForm mode="reset" />;
}

import AuthPanel from "../components/auth-panel";

function safeReturnTo(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/account";
}

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const initialNotice = params?.error === "email-confirmation"
    ? "That confirmation link could not be verified. Please try signing in or create a new account."
    : "";
  return <AuthPanel mode="login" returnTo={safeReturnTo(params?.next)} initialNotice={initialNotice} />;
}

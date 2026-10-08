import AuthPanel from "../components/auth-panel";

function safeReturnTo(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/account";
}

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;
  return <AuthPanel mode="signup" returnTo={safeReturnTo(params?.next)} />;
}

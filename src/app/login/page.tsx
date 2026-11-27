import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-serif text-4xl font-semibold text-forest-700">Vansakhi</h1>
        <p className="mt-1 text-center font-serif text-lg italic text-muted">The team&apos;s field journal for Kanha</p>
        <div className="mt-8 rounded-xl border border-line bg-paper p-6">
          <LoginForm linkError={error === "link"} blocked={error === "blocked"} />
        </div>
        <p className="mt-6 text-center text-xs text-muted">This is a private app. Accounts are by invite only.</p>
      </div>
    </main>
  );
}

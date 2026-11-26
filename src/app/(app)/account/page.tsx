import { getCurrentMember } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const member = await getCurrentMember();
  const { welcome } = await searchParams;
  return (
    <>
      <PageHeader title="Your account" />
      {welcome === "1" && (
        <div className="mb-4 max-w-md rounded-xl border border-forest-600 bg-forest-50 p-4 text-sm">
          <p className="font-medium">Welcome to Vansakhi!</p>
          <p className="mt-0.5 text-muted">Please choose a password below. You&apos;ll use it with your email to sign in from now on.</p>
        </div>
      )}
      <Card className="max-w-md">
        <p className="text-sm font-medium">{member.name}</p>
        <p className="mb-6 text-sm text-muted">{member.email}</p>
        <PasswordForm />
      </Card>
    </>
  );
}

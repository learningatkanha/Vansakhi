import { getCurrentMember } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const member = await getCurrentMember();
  return (
    <>
      <PageHeader title="Your account" />
      <Card className="max-w-md">
        <p className="text-sm font-medium">{member.name}</p>
        <p className="mb-6 text-sm text-muted">{member.email}</p>
        <PasswordForm />
      </Card>
    </>
  );
}

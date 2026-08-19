import { redirect } from "next/navigation";
import { requireUser } from "@/lib/access";
import { getUserAccount, listUsers } from "@/lib/users";
import { UserManager } from "./UserManager";

export default async function UsersPage() {
  const session = await requireUser();
  if (!session) redirect("/admin/login");
  const account = await getUserAccount(session.user.id);
  if (account?.role !== "superadmin") redirect("/admin");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <div>
        <h1 className="text-3xl font-light tracking-[0.12em] uppercase">Users</h1>
        <p className="mt-2 text-sm text-muted">
          Invite operators, grant credits, and promote other superadmins. One capture or regenerate costs one credit.
        </p>
      </div>
      <UserManager initialUsers={await listUsers()} selfId={session.user.id} />
    </main>
  );
}

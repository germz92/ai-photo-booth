import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureBootstrapAdmin } from "@/lib/auth-bootstrap";
import { applyProductionAuthUrl, isLocalHostUrl } from "@/lib/public-url";
import { loadUserAccount, markLogin } from "@/lib/users";

applyProductionAuthUrl();

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        await ensureBootstrapAdmin();
        const email = String(credentials?.email || "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const account = await loadUserAccount(user.id);
        if (!account || account.status !== "active") return null;
        await markLogin(user.id);
        return { id: user.id, email: user.email, role: account.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.role = user.role === "superadmin" ? "superadmin" : "user";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub || "";
        session.user.email = token.email as string;
        session.user.role = token.role === "superadmin" ? "superadmin" : "user";
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const next = new URL(url);
        const base = new URL(baseUrl);
        if (next.origin === base.origin) return url;
        if (isLocalHostUrl(url)) {
          return `${base.origin}${next.pathname}${next.search}`;
        }
      } catch {
        return baseUrl;
      }
      return baseUrl;
    },
  },
});

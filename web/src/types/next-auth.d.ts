import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "superadmin" | "user";
    };
  }

  interface User {
    role?: "superadmin" | "user";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "superadmin" | "user";
  }
}

import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getAgentByEmail } from "@/lib/db";

// Validar que NEXTAUTH_SECRET existe al inicializar
if (!process.env.NEXTAUTH_SECRET) {
  console.error(
    "[next-auth] FATAL: NEXTAUTH_SECRET is not set. Authentication will fail."
  );
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log("[next-auth][authorize] attempt for:", credentials?.email);

          if (!credentials?.email || !credentials?.password) {
            console.log("[next-auth][authorize] missing credentials");
            return null;
          }

          const agent = await getAgentByEmail(credentials.email);

          if (!agent) {
            console.log("[next-auth][authorize] agent not found for:", credentials.email);
            return null;
          }

          // Comparar password hasheado con bcrypt
          const isPasswordValid = await compare(
            credentials.password,
            agent.password
          );

          if (!isPasswordValid) {
            console.log("[next-auth][authorize] invalid password for:", credentials.email);
            return null;
          }

          console.log("[next-auth][authorize] success for:", credentials.email);
          return {
            id: agent.id,
            email: agent.email,
            name: agent.name,
            role: agent.role,
          };
        } catch (err: any) {
          // Log detallado para diagnosticar en Vercel
          console.error("[next-auth][authorize] error:", {
            message: err?.message,
            code: err?.code,
            name: err?.name,
            stack: err?.stack?.split("\n").slice(0, 5).join("\n"),
          });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { decode } from "next-auth/jwt";
import { compare } from "bcryptjs";
import { getAgentByEmail, getAgentById } from "@/lib/db";
import { SESSION_MAX_SECONDS, accountSessionProof, validAccountSession } from "@/lib/session-security";
import { allowLoginAttempt } from "@/lib/auth-rate-limit";

export const authOptions: NextAuthOptions = {
  debug: false,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials.password || credentials.email.length > 254 || credentials.password.length > 1024) return null;
          if (!await allowLoginAttempt(credentials.email)) return null;
          const agent = await getAgentByEmail(credentials.email);
          if (!agent || !agent.active || !await compare(credentials.password,agent.password)) return null;
          return { id: agent.id, email: agent.email, name: agent.name, role: agent.role,
            sessionProof: accountSessionProof(agent,process.env.NEXTAUTH_SECRET || "") };
        } catch { return null; }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionProof = user.sessionProof;
        token.sessionIssuedAt = Date.now();
      }
      // Do not reset the absolute deadline on refresh or accept client-provided roles.
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      session.expires = new Date((token.sessionIssuedAt || 0) + SESSION_MAX_SECONDS * 1000).toISOString();
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_SECONDS },
  jwt: {
    maxAge: SESSION_MAX_SECONDS,
    async decode(params) {
      try {
        const token = await decode(params);
        if (!token?.id || !token.sessionProof || typeof token.sessionIssuedAt !== "number") return null;
        const account = await getAgentById(token.id);
        return validAccountSession(token,account,process.env.NEXTAUTH_SECRET || "") ? token : null;
      } catch { return null; }
    },
  },
  // Never log passwords, tokens, email addresses or detailed provider errors.
  logger: { error(code) { if (code !== "JWT_SESSION_ERROR") console.error("Authentication error",code); } },
  secret: process.env.NEXTAUTH_SECRET,
};

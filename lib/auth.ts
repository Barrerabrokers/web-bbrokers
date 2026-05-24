import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getAgentByEmail } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const agent = await getAgentByEmail(credentials.email);

          if (!agent) {
            return null;
          }

          // Comparar password hasheado con bcrypt
          const isPasswordValid = await compare(
            credentials.password,
            agent.password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: agent.id,
            email: agent.email,
            name: agent.name,
            role: agent.role,
          };
        } catch (err) {
          // Si la DB falla o cualquier dependencia revienta, devolvemos null
          // en vez de propagar la excepcion para que NextAuth no muestre
          // el error generico "Server configuration". Logueamos para Vercel.
          console.error("[next-auth][authorize] error:", err);
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
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

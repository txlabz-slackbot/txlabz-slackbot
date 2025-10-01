import CredentialsProvider from "next-auth/providers/credentials";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password123";

export const authOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        captchaToken: { label: "Captcha", type: "text" }, // Added captchaToken
      },
      async authorize(credentials) {
        // 1. Verify the CAPTCHA token with Google
        try {
          const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${credentials.captchaToken}`,
          });
          const data = await response.json();
          if (!data.success) {
            console.error("CAPTCHA verification failed:", data["error-codes"]);
            return null; // Deny login if CAPTCHA is invalid
          }
        } catch (error) {
          console.error("Error verifying CAPTCHA:", error);
          return null; // Deny login if there's an error
        }

        // 2. If CAPTCHA is valid, proceed to check user credentials
        if (!credentials?.email || !credentials?.password) return null;
        
        const isValid =
          credentials.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
          credentials.password === ADMIN_PASSWORD;
          
        if (!isValid) return null;
        
        return { id: "admin", name: "Admin", email: ADMIN_EMAIL, role: "admin" };
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = user.role || "user";
      return token;
    },
    async session({ session, token }) {
      if (session?.user) session.user.role = token.role || "user";
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
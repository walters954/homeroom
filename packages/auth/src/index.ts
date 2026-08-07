import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { db } from "@homeroom/db";
import { env } from "@homeroom/env";
import { buttonHtml, emailLayout, sendAuthEmail } from "./email";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Without this, a member who forgets their password is locked out for good.
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail(
        user.email,
        "Reset your password",
        emailLayout(
          "Reset your password",
          `<p>Click below to choose a new password. This link expires in one hour.</p>${buttonHtml(url, "Reset password")}`,
        ),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail(
        user.email,
        "Confirm your email",
        emailLayout(
          "Confirm your email",
          `<p>Welcome! Confirm your address to finish setting up your account.</p>${buttonHtml(url, "Confirm email")}`,
        ),
      );
    },
  },
  plugins: [
    // Invited members sign in without inventing a password.
    magicLink({
      expiresIn: 60 * 60 * 24 * 7,
      sendMagicLink: async ({ email, url }) => {
        await sendAuthEmail(
          email,
          "Your sign-in link",
          emailLayout(
            "You're invited",
            `<p>Click below to sign in. No password needed — this link is good for 7 days.</p>${buttonHtml(url, "Sign in")}`,
          ),
        );
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        // First user to register owns the school.
        after: async (user) => {
          const count = await db.user.count();
          if (count === 1) {
            await db.user.update({
              where: { id: user.id },
              data: { role: "ADMIN" },
            });
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "MEMBER",
        input: false,
      },
      bio: {
        type: "string",
        required: false,
      },
    },
  },
});

export type Auth = typeof auth;

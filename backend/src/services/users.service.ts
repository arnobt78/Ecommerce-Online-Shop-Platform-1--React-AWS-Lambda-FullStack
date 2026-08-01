// Parent: REQ-1202, REQ-1205, REQ-1301, REQ-1304, REQ-1500-1507
// Ported from aws-lambda/shared/users.js — same function contracts, Prisma
// instead of DynamoDB (no more manual GSI/Scan fallbacks, Prisma handles it).

import { z } from "zod";
import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { hashPassword, comparePassword } from "../lib/auth";
import type { GoogleProfile } from "../lib/googleOAuth";

// Parent: REQ-1302 — single-source DTO: the Prisma User type minus the
// password hash, which must never leave this layer in an API response.
export type PublicUser = Omit<User, "password">;

// Parent: REQ-1304 — validated at the /register route boundary.
export const registerSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
  name: z.string().min(1, "Name is required"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.string().optional(),
  notificationsReadAt: z.union([z.string(), z.date()]).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

function omitPassword(user: User): PublicUser;
function omitPassword(user: null): null;
function omitPassword(user: User | null): PublicUser | null;
function omitPassword(user: User | null): PublicUser | null {
  if (!user) return null;
  const { password: _password, ...rest } = user;
  return rest;
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return omitPassword(user);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser({ email, password, name }: RegisterInput): Promise<PublicUser> {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error("User already exists");
  }

  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, name, password: hashedPassword, role: "user" },
  });

  return omitPassword(user);
}

export async function verifyUser(email: string, password: string): Promise<PublicUser | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const isValid = await comparePassword(password, user.password);
  if (!isValid) return null;

  return omitPassword(user);
}

// Parent: REQ-1500, REQ-1505 — find an existing user by Google ID or email
// (linking by verified email), or create a new Google-authenticated account.
export async function findOrCreateGoogleUser(googleProfile: GoogleProfile): Promise<PublicUser> {
  const { sub: googleId, email, name, picture, email_verified } = googleProfile;

  let user = await prisma.user.findUnique({ where: { googleId } });

  if (!user) {
    // Link to an existing password account with the same verified email,
    // otherwise create a brand-new Google-only account (no password).
    const existingByEmail = await getUserByEmail(email);
    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId,
          image: existingByEmail.image || picture || null,
          emailVerified: email_verified ? new Date() : existingByEmail.emailVerified,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name: name || "Customer",
          role: "user",
          googleId,
          image: picture || null,
          emailVerified: email_verified ? new Date() : null,
        },
      });
    }
  } else {
    // Refresh name/picture from Google on every login (keeps avatar current).
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name || user.name,
        image: picture || user.image,
      },
    });
  }

  return omitPassword(user);
}

export interface DemoAccount {
  email: string;
  name: string | null;
  role: string;
}

// Parent: REQ-1510 — public, password-free list of seed demo accounts for the
// login page's one-click quick-login. Never returns password/email of non-demo users.
export async function getDemoAccounts(): Promise<DemoAccount[]> {
  return prisma.user.findMany({
    where: { isDemo: true },
    select: { email: true, name: true, role: true },
    orderBy: { role: "asc" }, // "admin" before "user"
  });
}

// Parent: REQ-1510 — issues a real JWT for a demo account without a password,
// since the account was already selected from the vetted getDemoAccounts() list.
export async function demoLogin(email: string): Promise<PublicUser | null> {
  const user = await prisma.user.findFirst({ where: { email, isDemo: true } });
  if (!user) return null;
  return omitPassword(user);
}

export type UserListItem = Pick<User, "id" | "email" | "name" | "role" | "image" | "createdAt">;

export async function getAllUsers(): Promise<UserListItem[]> {
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, image: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

const VALID_ROLES = ["user", "admin"] as const;

export async function updateUser(userId: string, updates: UpdateUserInput): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new Error("User not found");
  }

  const data: Record<string, unknown> = {};

  if (updates.name !== undefined) data.name = updates.name;

  if (updates.email !== undefined) {
    const userWithEmail = await getUserByEmail(updates.email);
    if (userWithEmail && userWithEmail.id !== userId) {
      throw new Error("Email already in use");
    }
    data.email = updates.email;
  }

  if (updates.role !== undefined) {
    if (!(VALID_ROLES as readonly string[]).includes(updates.role)) {
      throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
    }
    data.role = updates.role;
  }

  if (updates.notificationsReadAt !== undefined) {
    data.notificationsReadAt = new Date(updates.notificationsReadAt);
  }

  if (Object.keys(data).length === 0) {
    return omitPassword(existing);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return omitPassword(updated);
}

export async function deleteUser(userId: string): Promise<{ message: string; id: string }> {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new Error("User not found");
  }

  await prisma.user.delete({ where: { id: userId } });
  return { message: "User deleted successfully", id: userId };
}

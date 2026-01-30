import { prisma } from "./prisma";
import { Role } from "@prisma/client";

/**
 * v1: Mock Auth
 * - 用環境變數代表「目前登入者」
 * - 之後接 SSO 時，替換成 session 取得即可
 */
export async function getCurrentUser() {
  const email = process.env.APP_DEFAULT_USER_EMAIL || "lei@example.com";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Mock user not found. Run seed first.");
  return user;
}

export function isAdmin(role: Role) {
  return role === Role.ADMIN;
}

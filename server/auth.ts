import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { isClerkMigrationEnabled, resolveInternalUserFromClerkUserId } from "./clerkService";

function readRequiredAuthSecret(name: "JWT_SECRET", fallback: string) {
  const configured = process.env[name]?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be configured in production.`);
  }

  return fallback;
}

function readRefreshSecret(jwtSecret: string) {
  const configured = process.env.REFRESH_SECRET?.trim();
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    return jwtSecret;
  }

  return "serviceconnect-dev-refresh-secret";
}

const JWT_SECRET = readRequiredAuthSecret("JWT_SECRET", "serviceconnect-dev-jwt-secret");
const REFRESH_SECRET = readRefreshSecret(JWT_SECRET);

export function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "30m" });
  const refreshToken = jwt.sign({ userId, role }, REFRESH_SECRET, { expiresIn: "30d" });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string; role: string };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    authType: "legacy" | "clerk";
    clerkUserId?: string | null;
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (isClerkMigrationEnabled()) {
    try {
      const auth = getAuth(req);
      if (auth.userId) {
        const internalUser = await resolveInternalUserFromClerkUserId(auth.userId);
        if (!internalUser) {
          return res.status(401).json({ error: "No linked ServiceConnect account found for this Clerk session" });
        }
        if (internalUser.status === "SUSPENDED" || internalUser.status === "BANNED") {
          return res.status(403).json({ error: `Account ${internalUser.status.toLowerCase()}` });
        }
        req.user = {
          userId: internalUser.id,
          role: internalUser.role,
          authType: "clerk",
          clerkUserId: auth.userId,
        };
        return next();
      }
    } catch {
      // Fall back to legacy JWT validation during the migration.
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = { ...payload, authType: "legacy", clerkUserId: null };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

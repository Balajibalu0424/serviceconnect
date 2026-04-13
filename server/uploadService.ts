import path from "path";
import { randomUUID } from "crypto";
import { get, put, type GetBlobResult } from "@vercel/blob";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { uploads, type Upload } from "@shared/schema";
import { UPLOAD_RULES, type UploadPurpose } from "@shared/uploads";
import { DeliveryConfigurationError, isUploadConfigured } from "./deliveryConfig";

export class UploadValidationError extends Error {}

function sanitizeFilename(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  const base = path
    .basename(filename, ext)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return `${base || "file"}${ext}`;
}

export function assertUploadConfigured() {
  if (!isUploadConfigured()) {
    throw new DeliveryConfigurationError("File uploads are not configured.");
  }
}

export function validateUploadFile(purpose: UploadPurpose, file?: Express.Multer.File | null) {
  const rules = UPLOAD_RULES[purpose];
  if (!file) {
    throw new UploadValidationError("A file is required.");
  }

  if (!rules.allowedMimeTypes.includes(file.mimetype)) {
    throw new UploadValidationError("That file type is not allowed.");
  }

  if (file.size > rules.maxBytes) {
    throw new UploadValidationError(`File is too large. Maximum size is ${Math.floor(rules.maxBytes / (1024 * 1024))}MB.`);
  }
}

export function buildVerificationDocumentAccessUrl(uploadId: string) {
  return `/api/uploads/${uploadId}/access`;
}

export async function createUploadRecord(input: {
  createdBy: string;
  purpose: UploadPurpose;
  file: Express.Multer.File;
  entityType?: string | null;
  entityId?: string | null;
}) {
  assertUploadConfigured();
  validateUploadFile(input.purpose, input.file);

  const safeName = sanitizeFilename(input.file.originalname);
  const pathname = `${input.purpose.toLowerCase()}/${input.createdBy}/${Date.now()}-${randomUUID()}-${safeName}`;
  const blob = await put(pathname, input.file.buffer, {
    access: input.purpose === "VERIFICATION_DOCUMENT" ? "private" : "public",
    addRandomSuffix: false,
    contentType: input.file.mimetype,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const [upload] = await db.insert(uploads).values({
    createdBy: input.createdBy,
    purpose: input.purpose,
    storagePath: blob.pathname,
    storageUrl: blob.url,
    originalName: input.file.originalname,
    mimeType: input.file.mimetype,
    sizeBytes: input.file.size,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
  }).returning();

  return upload;
}

export async function getActiveUpload(uploadId: string) {
  const [upload] = await db.select().from(uploads).where(
    and(eq(uploads.id, uploadId), eq(uploads.status, "ACTIVE"), isNull(uploads.deletedAt)),
  );
  return upload ?? null;
}

export async function markUploadDeleted(uploadId: string) {
  await db.update(uploads)
    .set({ status: "DELETED", deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(uploads.id, uploadId));
}

export function isPrivateUpload(upload: Upload) {
  return upload.purpose === "VERIFICATION_DOCUMENT";
}

export async function getPrivateUploadBlob(upload: Upload, ifNoneMatch?: string | null): Promise<GetBlobResult | null> {
  if (!isPrivateUpload(upload)) {
    throw new UploadValidationError("Only private uploads can be fetched through the blob proxy.");
  }

  return get(upload.storagePath, {
    access: "private",
    ifNoneMatch: ifNoneMatch ?? undefined,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

export function getUploadPublicUrl(upload: Upload) {
  if (upload.purpose === "VERIFICATION_DOCUMENT") {
    return buildVerificationDocumentAccessUrl(upload.id);
  }
  return upload.storageUrl;
}

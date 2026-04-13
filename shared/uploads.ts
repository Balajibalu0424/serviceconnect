export type UploadPurpose = "JOB_PHOTO" | "PORTFOLIO_IMAGE" | "VERIFICATION_DOCUMENT";

export interface UploadedAsset {
  id: string;
  purpose: UploadPurpose;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt?: string;
}

export const UPLOAD_RULES: Record<
  UploadPurpose,
  { maxBytes: number; allowedMimeTypes: string[]; maxFiles: number }
> = {
  JOB_PHOTO: {
    maxBytes: 8 * 1024 * 1024,
    maxFiles: 5,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  },
  PORTFOLIO_IMAGE: {
    maxBytes: 8 * 1024 * 1024,
    maxFiles: 6,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
  },
  VERIFICATION_DOCUMENT: {
    maxBytes: 10 * 1024 * 1024,
    maxFiles: 1,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
};

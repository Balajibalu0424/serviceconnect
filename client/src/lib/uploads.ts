import type { UploadedAsset } from "@shared/uploads";
import { getAccessToken } from "@/lib/queryClient";

type UploadRoutePurpose = "job-photo" | "portfolio-image" | "verification-document";

function getApiBase() {
  return import.meta.env.VITE_API_URL || "";
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadAsset(
  purpose: UploadRoutePurpose,
  file: File,
  options?: { entityType?: string; entityId?: string },
): Promise<UploadedAsset> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("You must be signed in before uploading files.");
  }

  const formData = new FormData();
  formData.append("file", file);
  if (options?.entityType) formData.append("entityType", options.entityType);
  if (options?.entityId) formData.append("entityId", options.entityId);

  const response = await fetch(`${getApiBase()}/api/uploads/${purpose}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Upload failed");
  }

  return payload.asset as UploadedAsset;
}

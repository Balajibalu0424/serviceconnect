import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Clock, XCircle, Upload, CheckCircle2, LogOut, ArrowRight } from "lucide-react";
import { formatFileSize, uploadAsset } from "@/lib/uploads";
import type { UploadedAsset } from "@shared/uploads";

export default function ProVerificationPending() {
  const { user, refreshUser, logout } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const profile = user?.profile;
  const status: string = profile?.verificationStatus ?? "UNSUBMITTED";

  const [licenseNumber, setLicenseNumber] = useState(profile?.licenseNumber ?? "");
  const [documentAsset, setDocumentAsset] = useState<UploadedAsset | null>(
    profile?.verificationDocumentUrl
      ? {
          id: profile?.verificationDocumentUploadId ?? "existing",
          purpose: "VERIFICATION_DOCUMENT",
          url: profile.verificationDocumentUrl,
          originalName: "Submitted verification document",
          mimeType: "application/octet-stream",
          sizeBytes: 0,
        }
      : null,
  );
  const [uploadingDocument, setUploadingDocument] = useState(false);

  // Listen for real-time approval notification from admin via Pusher
  useEffect(() => {
    const handleNotification = async (data: any) => {
      if (data?.type === "VERIFICATION_APPROVED") {
        await refreshUser();
        toast({ title: "Verification approved!", description: "You now have full access to the platform." });
        navigate("/pro/dashboard");
      }
    };

    socket?.on("new_notification", handleNotification);
    return () => {
      socket?.off("new_notification", handleNotification);
    };
  }, [socket, refreshUser, toast, navigate]);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pro/verification/submit", { uploadId: documentAsset?.id, licenseNumber });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: async () => {
      await refreshUser();
      toast({ title: "Submitted!", description: "Your verification is pending admin review." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleDocumentUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingDocument(true);
    try {
      const asset = await uploadAsset("verification-document", file, { entityType: "professional_verification" });
      setDocumentAsset(asset);
      toast({ title: "Document uploaded", description: "Your file is ready to submit for review." });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingDocument(false);
    }
  };

  const statusConfig = {
    UNSUBMITTED: {
      icon: <Upload className="w-10 h-10 text-muted-foreground" />,
      badge: <Badge variant="outline">Optional</Badge>,
      title: "Boost Your Credibility (Optional)",
      desc: "Submitting your license or insurance document is completely optional. Verified profiles attract more customers and earn a trust badge — but you can start using the platform right away.",
    },
    PENDING: {
      icon: <Clock className="w-10 h-10 text-amber-500" />,
      badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-300">Under review</Badge>,
      title: "Verification Under Review",
      desc: "Your documents have been submitted and are being reviewed by our team. This usually takes 1–2 business days. You can use the platform while you wait.",
    },
    REJECTED: {
      icon: <XCircle className="w-10 h-10 text-destructive" />,
      badge: <Badge variant="destructive">Not approved</Badge>,
      title: "Documents Not Approved",
      desc: profile?.verificationReviewNote
        ? `Reason: ${profile.verificationReviewNote}. You can resubmit updated documents or continue using the platform without verification.`
        : "You can resubmit updated documents or continue using the platform without verification.",
    },
    APPROVED: {
      icon: <CheckCircle2 className="w-10 h-10 text-green-500" />,
      badge: <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 border-green-300">Verified</Badge>,
      title: "You're Verified!",
      desc: "Your account is verified. Your profile displays a trust badge to help you stand out to customers.",
    },
  };

  const cfg = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.UNSUBMITTED;
  const canSubmit = status === "UNSUBMITTED" || status === "REJECTED";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">ServiceConnect</span>
        </div>

        <Card>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">{cfg.icon}</div>
            <div className="flex justify-center mb-2">{cfg.badge}</div>
            <CardTitle className="text-xl">{cfg.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">{cfg.desc}</p>

            {status === "APPROVED" && (
              <Button
                className="w-full"
                onClick={() => navigate("/pro/dashboard")}
                data-testid="button-go-to-dashboard"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {canSubmit && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>Verification document</Label>
                  <Input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      void handleDocumentUpload(e.target.files?.[0] ?? null);
                      e.currentTarget.value = "";
                    }}
                    disabled={uploadingDocument}
                    data-testid="input-document-file"
                  />
                  <p className="text-xs text-muted-foreground">Upload your licence, insurance certificate, or similar proof of trade.</p>
                  {documentAsset && (
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{documentAsset.originalName}</p>
                          <p className="text-xs text-muted-foreground">
                            {documentAsset.sizeBytes > 0 ? formatFileSize(documentAsset.sizeBytes) : "Previously submitted"}
                          </p>
                        </div>
                        <a href={documentAsset.url} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">
                          Open
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>License Number <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={licenseNumber}
                    onChange={e => setLicenseNumber(e.target.value)}
                    placeholder="e.g. RGI-12345"
                    data-testid="input-license-number"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => submit.mutate()}
                  disabled={submit.isPending || uploadingDocument || !documentAsset?.id}
                  data-testid="button-submit-verification"
                >
                  {submit.isPending ? "Submitting…" : status === "REJECTED" ? "Resubmit Documents" : "Submit Documents (Optional)"}
                </Button>
              </div>
            )}

            {status === "PENDING" && (
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 text-center">
                You'll receive a notification once your review is complete.
              </div>
            )}

            {status !== "APPROVED" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => navigate("/pro/dashboard")}
                data-testid="button-skip-verification"
              >
                Skip for now — go to Dashboard
              </Button>
            )}

            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => logout()}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

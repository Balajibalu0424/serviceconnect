import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListChecks, MessageCircle, MapPin, User, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function ProBookings() {
  const { data: bookings = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/bookings"] });
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const markInProgress = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/bookings/${id}/in-progress`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Booking updated", description: "The job is now marked as in progress." });
      setSelectedBooking(null);
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  });

  const startMessage = useMutation({
    mutationFn: async (booking: any) => {
      const res = await apiRequest("POST", "/api/conversations", { participantId: booking.customerId });
      return res.json();
    },
    onSuccess: (data) => {
      setLocation(`/pro/chat?conversationId=${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Could not start conversation", description: error.message, variant: "destructive" });
    }
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">My Bookings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your active and past jobs</p>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-white/20 dark:border-white/5">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <ListChecks className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-heading font-medium text-lg text-foreground">No bookings yet</p>
            <p className="text-sm mt-1 max-w-sm mx-auto">When a customer accepts your quote, the booking will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b: any) => (
              <Card 
                key={b.id} 
                className="transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white/60 dark:bg-black/40 backdrop-blur-xl border-white/40 dark:border-white/10 rounded-2xl overflow-hidden group cursor-pointer"
                onClick={() => setSelectedBooking(b)}
              >
                <CardContent className="p-5 md:p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-lg group-hover:text-primary transition-colors">
                        {b.job?.title || `Booking #${b.id.toString().slice(-8)}`}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                           {b.customer ? `${b.customer.firstName} ${b.customer.lastName}` : "Customer"}
                        </span>
                      </div>

                      <div className="flex items-center gap-x-4 gap-y-2 mt-3 flex-wrap text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/80 bg-muted/40 px-2 py-0.5 rounded-md">€{b.totalAmount}</span>
                        <span>{formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto">
                      <Badge className="text-xs px-2.5 py-1 uppercase tracking-wider bg-white/50 shadow-sm">{b.status}</Badge>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        View Details →
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        {selectedBooking && (
          <DialogContent className="max-w-md bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-white/20">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl">{selectedBooking.job?.title || "Booking Details"}</DialogTitle>
              <DialogDescription>
                Created {formatDistanceToNow(new Date(selectedBooking.createdAt), { addSuffix: true })}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Customer</h4>
                {selectedBooking.customer ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-white/20 shadow-sm">
                      <AvatarImage src={selectedBooking.customer.avatarUrl || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary uppercase">
                        {selectedBooking.customer.firstName[0]}{selectedBooking.customer.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedBooking.customer.firstName} {selectedBooking.customer.lastName}</p>
                      {selectedBooking.customer.phone && <p className="text-xs text-muted-foreground">{selectedBooking.customer.phone}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Details unavailable</p>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Job Specifications</h4>
                {selectedBooking.job ? (
                  <div className="space-y-2 text-sm">
                    <p className="text-foreground/90">{selectedBooking.job.description}</p>
                    <div className="flex items-center gap-2 text-muted-foreground mt-2">
                       <MapPin className="w-4 h-4" />
                       <span>{selectedBooking.job.location}</span>
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs">{selectedBooking.job.serviceCategory}</Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Job details not attached</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <span className="font-medium">Agreed Quote</span>
                <span className="text-lg font-bold">€{selectedBooking.totalAmount}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => startMessage.mutate(selectedBooking)}
                disabled={startMessage.isPending}
              >
                <MessageCircle className="w-4 h-4" /> Message
              </Button>
              {selectedBooking.status === "CONFIRMED" && (
                <Button 
                  className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40"
                  onClick={() => markInProgress.mutate(selectedBooking.id)}
                  disabled={markInProgress.isPending}
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark In Progress
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </DashboardLayout>
  );
}

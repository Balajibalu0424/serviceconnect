import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator } from "lucide-react";

const ICON_MAP: Record<string, any> = { Wrench, Zap, Sparkles, Paintbrush, Leaf, Truck, Hammer, BookOpen, Camera, ChefHat, Globe, Dumbbell, Heart, Car, Scale, Calculator };

export default function Services() {
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">ServiceConnect</Link>
          <Link href="/login"><Button variant="ghost" size="sm">Login</Button></Link>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4 text-center">All Services</h1>
        <p className="text-muted-foreground text-center mb-10">Find trusted professionals for any job</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat: any) => {
            const Icon = ICON_MAP[cat.icon] || Wrench;
            return (
              <Link key={cat.id} href={`/post-job?category=${cat.id}`}>
                <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group h-full">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="font-medium mb-1">{cat.name}</div>
                    <div className="text-xs text-muted-foreground">{cat.description}</div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

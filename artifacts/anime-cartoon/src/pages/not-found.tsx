import { Link } from "wouter";
import { Tv } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background px-6 font-sans">
      <div className="text-center">
        <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-2xl">
          <Tv className="w-12 h-12 text-white/20" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-3">Channel 404</h1>
        <p className="text-muted-foreground font-medium mb-8 text-lg">
          Looks like this frequency is just static.
        </p>
        <Link href="/" className="inline-flex items-center justify-center bg-primary text-primary-foreground font-black px-8 py-4 rounded-full active:scale-95 transition-transform hover:brightness-110">
          Back to TV Guide
        </Link>
      </div>
    </div>
  );
}
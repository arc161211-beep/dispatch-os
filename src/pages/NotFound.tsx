import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center"
      >
        <p className="text-7xl font-extrabold tabular-nums tracking-tight text-primary/20">404</p>
        <h1 className="mt-4 text-xl font-bold tracking-tight">Page Not Found</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/dashboard">
            <Button className="gap-1.5 bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20">
              <Home className="size-3.5" /> Go to Dashboard
            </Button>
          </Link>
          <Button variant="outline" onClick={() => window.history.back()} className="gap-1.5">
            <ArrowLeft className="size-3.5" /> Go Back
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// /register redirects to /pro/onboarding — the full Bark-style multi-step pro signup
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Register() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/pro/onboarding"); }, []);
  return null;
}

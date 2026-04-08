import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";

export default function ProOnboarding() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const nextSearch = search ? `&${search.replace(/^\?/, "")}` : "";
    setLocation(`/register?role=PROFESSIONAL${nextSearch}`);
  }, [search, setLocation]);

  return null;
}

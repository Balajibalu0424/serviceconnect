import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";

export default function RegisterCustomer() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const nextSearch = search ? `&${search.replace(/^\?/, "")}` : "";
    setLocation(`/register?role=CUSTOMER${nextSearch}`);
  }, [search, setLocation]);

  return null;
}

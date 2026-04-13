export function getClerkPublishableKey() {
  return (
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

export function isClerkFrontendEnabled() {
  return Boolean(getClerkPublishableKey());
}

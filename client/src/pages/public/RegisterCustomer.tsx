import RoleAwareOnboarding from "@/components/onboarding/RoleAwareOnboarding";

export default function RegisterCustomer() {
  return <RoleAwareOnboarding initialRole="CUSTOMER" />;
}

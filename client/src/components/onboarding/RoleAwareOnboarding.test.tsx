import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RoleAwareOnboarding from "./RoleAwareOnboarding";

let mockSearch = "";
const {
  navigateMock,
  apiRequestMock,
  setTokensMock,
  refreshUserMock,
  toastMock,
  getStoredSessionIdMock,
  storeSessionIdMock,
  clearStoredSessionIdMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  apiRequestMock: vi.fn(),
  setTokensMock: vi.fn(),
  refreshUserMock: vi.fn(),
  toastMock: vi.fn(),
  getStoredSessionIdMock: vi.fn(),
  storeSessionIdMock: vi.fn(),
  clearStoredSessionIdMock: vi.fn(),
}));

vi.mock("wouter", () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  useLocation: () => ["/register", navigateMock],
  useSearch: () => mockSearch,
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: apiRequestMock,
  setTokens: setTokensMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    refreshUser: refreshUserMock,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/onboarding", () => ({
  getStoredOnboardingSessionId: getStoredSessionIdMock,
  storeOnboardingSessionId: storeSessionIdMock,
  clearStoredOnboardingSessionId: clearStoredSessionIdMock,
}));

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  });
}

function buildCustomerSession(overrides: Partial<any> = {}) {
  return {
    id: "session-1",
    role: "CUSTOMER",
    currentStep: "JOB_INTAKE",
    status: "ACTIVE",
    payload: {
      role: "CUSTOMER",
      customerJob: {
        title: "",
        description: "",
        categoryId: "",
        categoryLabel: "",
        urgency: "NORMAL",
        locationText: "",
        budgetMin: null,
        budgetMax: null,
        preferredDate: null,
        completionIssues: [],
        aiQualityScore: null,
        aiQualityPrompt: null,
      },
      professionalProfile: null,
      personalDetails: {},
      password: "",
    },
    transcript: [
      {
        role: "assistant",
        content: "Tell me what needs sorting, where it is, and anything important about the job.",
        createdAt: new Date().toISOString(),
      },
    ],
    verificationState: {
      emailVerified: false,
      phoneVerified: false,
      emailLastSentAt: null,
      phoneLastSentAt: null,
    },
    expiresAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

function buildProfessionalSession(overrides: Partial<any> = {}) {
  return {
    id: "session-pro",
    role: "PROFESSIONAL",
    currentStep: "PERSONAL_REVIEW",
    status: "ACTIVE",
    payload: {
      role: "PROFESSIONAL",
      customerJob: null,
      professionalProfile: {
        categoryIds: ["cat-elec"],
        categoryLabels: ["Electrical"],
        location: "Dublin",
        serviceAreas: ["Dublin", "Kildare"],
        serviceRadius: 30,
        yearsExperience: 9,
        bio: "RECI registered electrician covering domestic rewires, lighting and urgent callouts.",
        businessName: "Bright Current",
        credentials: "RECI, insured",
      },
      personalDetails: {
        firstName: "Sean",
        lastName: "Kelly",
        email: "sean@example.com",
        phone: "+353861111111",
      },
      password: "",
    },
    transcript: [],
    verificationState: {
      emailVerified: false,
      phoneVerified: false,
      emailLastSentAt: null,
      phoneLastSentAt: null,
    },
    expiresAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  };
}

function renderOnboarding() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const [url] = queryKey as [string];
          const response = await apiRequestMock("GET", url);
          return response.json();
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <RoleAwareOnboarding />
    </QueryClientProvider>,
  );
}

describe("RoleAwareOnboarding", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockSearch = "";
    navigateMock.mockReset();
    apiRequestMock.mockReset();
    setTokensMock.mockReset();
    refreshUserMock.mockReset();
    toastMock.mockReset();
    getStoredSessionIdMock.mockReset();
    storeSessionIdMock.mockReset();
    clearStoredSessionIdMock.mockReset();
  });

  it("shows role selection and routes clicks into the primary onboarding path", async () => {
    getStoredSessionIdMock.mockReturnValue(null);
    apiRequestMock.mockImplementation((method: string, url: string) => {
      if (method === "GET" && url === "/api/categories") {
        return jsonResponse([]);
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    renderOnboarding();

    expect(await screen.findByText("I need help with a job")).toBeInTheDocument();
    fireEvent.click(screen.getByText("I need help with a job"));
    expect(navigateMock).toHaveBeenCalledWith("/register?role=CUSTOMER");
  });

  it("boots a customer session and advances from AI intake into review", async () => {
    mockSearch = "role=CUSTOMER";
    getStoredSessionIdMock.mockReturnValue("session-1");

    apiRequestMock.mockImplementation((method: string, url: string) => {
      if (method === "GET" && url === "/api/categories") {
        return jsonResponse([{ id: "cat-1", name: "Plumbing", slug: "plumbing" }]);
      }
      if (method === "GET" && url === "/api/onboarding/sessions/session-1") {
        return jsonResponse(buildCustomerSession());
      }
      if (method === "POST" && url === "/api/onboarding/sessions/session-1/chat") {
        return jsonResponse(buildCustomerSession({
          currentStep: "JOB_REVIEW",
          payload: {
            role: "CUSTOMER",
            customerJob: {
              title: "Fix leaking kitchen tap",
              description: "Kitchen tap is leaking under the sink and needs repair today.",
              categoryId: "cat-1",
              categoryLabel: "Plumbing",
              urgency: "URGENT",
              locationText: "Dublin 8",
              budgetMin: null,
              budgetMax: null,
              preferredDate: null,
              completionIssues: [],
              aiQualityScore: 91,
              aiQualityPrompt: null,
            },
            professionalProfile: null,
            personalDetails: {},
            password: "",
          },
          transcript: [
            {
              role: "assistant",
              content: "Tell me what needs sorting, where it is, and anything important about the job.",
              createdAt: new Date().toISOString(),
            },
            {
              role: "user",
              content: "My kitchen tap is leaking badly in Dublin 8.",
              createdAt: new Date().toISOString(),
            },
            {
              role: "assistant",
              content: "That looks complete. Review the job summary below, make any edits you want, and then we will collect your contact details.",
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    renderOnboarding();

    expect(await screen.findByPlaceholderText("Tell the assistant about the job...")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Tell the assistant about the job..."), {
      target: { value: "My kitchen tap is leaking badly in Dublin 8." },
    });
    fireEvent.click(screen.getByText("Send"));

    expect(await screen.findByDisplayValue("Fix leaking kitchen tap")).toBeInTheDocument();
    expect(screen.getByText("Continue to personal details")).toBeInTheDocument();
  });

  it("resumes a stored professional onboarding session after refresh", async () => {
    getStoredSessionIdMock.mockReturnValue("session-pro");
    apiRequestMock.mockImplementation((method: string, url: string) => {
      if (method === "GET" && url === "/api/categories") {
        return jsonResponse([{ id: "cat-elec", name: "Electrical", slug: "electrical" }]);
      }
      if (method === "GET" && url === "/api/onboarding/sessions/session-pro") {
        return jsonResponse(buildProfessionalSession());
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    renderOnboarding();

    expect((await screen.findAllByText("Electrical")).length).toBeGreaterThan(0);
    expect(screen.getByText("Live onboarding snapshot")).toBeInTheDocument();
  });

  it("creates the account from the password step and redirects to the correct dashboard", async () => {
    getStoredSessionIdMock.mockReturnValue("session-pro");

    apiRequestMock.mockImplementation((method: string, url: string) => {
      if (method === "GET" && url === "/api/categories") {
        return jsonResponse([{ id: "cat-elec", name: "Electrical", slug: "electrical" }]);
      }
      if (method === "GET" && url === "/api/onboarding/sessions/session-pro") {
        return jsonResponse(buildProfessionalSession({
          id: "session-pro",
          currentStep: "PASSWORD",
          verificationState: {
            emailVerified: true,
            phoneVerified: true,
            emailLastSentAt: new Date().toISOString(),
            phoneLastSentAt: new Date().toISOString(),
          },
        }));
      }
      if (method === "POST" && url === "/api/onboarding/sessions/session-pro/complete") {
        return jsonResponse({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          user: { id: "pro-1", role: "PROFESSIONAL" },
          redirectTo: "/pro/dashboard",
          createdProfileId: "profile-1",
          nextPrompt: "Your account is ready.",
        });
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    renderOnboarding();

    expect(await screen.findByText("Set your password")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("At least 8 characters, with a letter and a number"), {
      target: { value: "Strongpass1" },
    });
    fireEvent.click(screen.getByText("Create account and continue"));

    await waitFor(() => {
      expect(setTokensMock).toHaveBeenCalledWith("access-token", "refresh-token");
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/pro/dashboard");
    }, { timeout: 2500 });
  }, 8000);
});

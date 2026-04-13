import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Chat from "./Chat";

let mockPathname = "/chat/missing-conv";
let mockSearch = "";

const { apiRequestMock, navigateMock, toastMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => [mockPathname, navigateMock],
  useSearch: () => mockSearch,
}));

vi.mock("@/components/layouts/DashboardLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: apiRequestMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "customer-1", role: "CUSTOMER" },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  });
}

function renderChat() {
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
      <Chat />
    </QueryClientProvider>,
  );
}

describe("Customer chat deep links", () => {
  beforeEach(() => {
    mockPathname = "/chat/missing-conv";
    mockSearch = "";
    apiRequestMock.mockReset();
    navigateMock.mockReset();
    toastMock.mockReset();
  });

  it("shows the missing conversation fallback instead of an empty thread shell", async () => {
    apiRequestMock.mockImplementation((method: string, url: string) => {
      if (method === "GET" && url === "/api/chat/conversations") {
        return jsonResponse([
          {
            id: "real-conv",
            unreadCount: 0,
            lastMessage: "Latest message",
            lastMessageAt: new Date().toISOString(),
            participants: [{ id: "pro-1", firstName: "Pat", lastName: "Murphy" }],
            job: { title: "Fix leaking sink", status: "OPEN" },
          },
        ]);
      }
      if (method === "GET" && url === "/api/chat/unread-count") {
        return jsonResponse({ count: 0 });
      }
      if (method === "GET" && url === "/api/chat/conversations/missing-conv/messages") {
        return jsonResponse({ error: "Missing" }, false);
      }
      if (method === "PATCH" && url === "/api/chat/conversations/missing-conv/read") {
        return jsonResponse({});
      }
      throw new Error(`Unexpected request ${method} ${url}`);
    });

    renderChat();

    expect(await screen.findByText("This conversation is no longer available.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("No messages yet â€” say hello!")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Back to inbox" })).toBeInTheDocument();
  });
});

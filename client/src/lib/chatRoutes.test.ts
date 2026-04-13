import { describe, expect, it } from "vitest";
import { buildConversationPath, extractConversationId, getRouteSearchParam } from "@shared/chatRoutes";

describe("chatRoutes", () => {
  it("builds clean customer and pro conversation paths", () => {
    expect(buildConversationPath(false)).toBe("/chat");
    expect(buildConversationPath(false, "abc-123")).toBe("/chat/abc-123");
    expect(buildConversationPath(true, "xyz-789")).toBe("/pro/chat/xyz-789");
  });

  it("extracts conversation ids from path-based and legacy query URLs", () => {
    expect(extractConversationId("/chat/conv-1")).toBe("conv-1");
    expect(extractConversationId("/pro/chat/conv-2")).toBe("conv-2");
    expect(extractConversationId("/chat", "?conversationId=conv-3")).toBe("conv-3");
    expect(extractConversationId("/chat?conversationId=conv-4")).toBe("conv-4");
  });

  it("reads route search params from either browser search or hash path", () => {
    expect(getRouteSearchParam("/pro/feed", "?highlight=job-1", "highlight")).toBe("job-1");
    expect(getRouteSearchParam("/pro/feed?highlight=job-2", "", "highlight")).toBe("job-2");
    expect(getRouteSearchParam("/pro/feed", "", "highlight")).toBeNull();
  });
});

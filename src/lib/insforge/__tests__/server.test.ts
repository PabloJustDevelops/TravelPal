import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { createServerInsforgeClient } from "../server";

jest.mock("@insforge/sdk/ssr", () => ({
  createServerClient: jest.fn(),
}));
jest.mock("next/headers");

const createServerClientMock = createServerClient as jest.Mock;
const cookiesMock = cookies as unknown as jest.Mock;

describe("createServerInsforgeClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pasa el store de cookies al cliente de servidor", async () => {
    const store = { get: jest.fn() };
    cookiesMock.mockResolvedValue(store);
    createServerClientMock.mockReturnValue({});

    await createServerInsforgeClient();

    expect(cookies).toHaveBeenCalled();
    expect(createServerClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: expect.stringContaining("insforge.app"),
        anonKey: expect.any(String),
        cookies: store,
      }),
    );
  });
});

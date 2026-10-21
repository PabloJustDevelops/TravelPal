/** @jest-environment-options {"url":"https://app.example.test"} */
import { avatarUrlSchema } from "../avatar-url";
import { publicEnv } from "../public-env";

describe("avatarUrlSchema", () => {
  const backend = new URL(publicEnv.NEXT_PUBLIC_INSFORGE_URL).origin;
  const storage = "https://insforge-storage.s3.us-east-2.amazonaws.com";

  it.each(["", "   ", `${backend}/avatar.png`, `${storage}/photo.png?signature=abc`, "https://app.example.test/images/avatar.png"])(
    "acepta avatar opcional o permitido: %s", (value) => {
      expect(avatarUrlSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([
    "not a url", "/images/avatar.png", "http://insforge-storage.s3.us-east-2.amazonaws.com/a.png",
    "data:image/png;base64,AAAA", "javascript:alert(1)", "https://tracker.example/a.png",
    `${backend}.evil.example/a.png`, `${backend}:444/a.png`,
    `${backend.replace("https://", "https://user:pass@")}/a.png`,
    `${backend.replace("https://", "https://@")}/a.png`,
    `${backend}/a.png#fragment`, `${backend}/a.png#`, `${backend}/a\n.png`,
    `${backend}/${"a".repeat(2048)}`,
  ])("rechaza URL insegura o fuera de CSP: %s", (value) => {
    expect(avatarUrlSchema.safeParse(value).success).toBe(false);
  });
});

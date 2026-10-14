import { createServerFn } from "@tanstack/react-start";

import type { DetectionReport } from "./detect.server";

export const detectPestsFn = createServerFn({ method: "POST" })
  .inputValidator((data: { imageDataUrl: string }) => {
    if (!data?.imageDataUrl || !data.imageDataUrl.startsWith("data:image/")) {
      throw new Error("Please upload a valid image file.");
    }
    if (data.imageDataUrl.length > 14_000_000) {
      throw new Error("Image is too large. Please use an image under 10 MB.");
    }
    return data;
  })
  .handler(async ({ data }): Promise<DetectionReport> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { detectPests } = await import("./detect.server");
    return detectPests(getRequest(), data.imageDataUrl);
  });

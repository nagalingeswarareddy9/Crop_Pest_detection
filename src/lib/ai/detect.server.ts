import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export interface PestDetection {
  pest: string;
  scientificName: string;
  confidence: number;
  severity: "low" | "medium" | "high";
  count: number;
  box: { x: number; y: number; width: number; height: number };
  damage: string;
  treatment: string;
}

export interface DetectionReport {
  cropType: string;
  healthStatus: "healthy" | "at_risk" | "infested";
  summary: string;
  environmentalNotes: string;
  detections: PestDetection[];
}

const INSTRUCTIONS = `You are an expert agricultural entomologist and computer-vision pest detection system.
Analyze the provided crop/field image and identify every visible pest or sign of pest damage.

Rules:
- Detect pests even when small, partially occluded by leaves, camouflaged, or in poor lighting.
- For each detection provide a bounding box as NORMALIZED coordinates (0 to 1) relative to image width/height: x and y are the top-left corner, width and height are the box size. Boxes must tightly enclose the pest or pest cluster.
- count = estimated number of individual pests inside the box.
- confidence is 0-100.
- severity reflects potential crop damage: low, medium, or high.
- damage: one short sentence on the damage this pest causes.
- treatment: one short, practical IPM (integrated pest management) recommendation.
- If no pests are visible, return an empty detections array and healthStatus "healthy".
- cropType: your best guess of the crop, or "Unknown".
- environmentalNotes: one sentence on image conditions (lighting, blur, occlusion) that affect detection reliability.

Respond with ONLY valid JSON matching this exact shape, no markdown fences:
{"cropType":string,"healthStatus":"healthy"|"at_risk"|"infested","summary":string,"environmentalNotes":string,"detections":[{"pest":string,"scientificName":string,"confidence":number,"severity":"low"|"medium"|"high","count":number,"box":{"x":number,"y":number,"width":number,"height":number},"damage":string,"treatment":string}]}`;

export async function detectPests(request: Request, imageDataUrl: string): Promise<DetectionReport> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new Error("AI is not configured for this app yet. Please try again later.");
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: [
        { type: "text", text: "Detect all crop pests in this image. Return JSON only." },
        { type: "image", image: new URL(imageDataUrl) },
      ],
    },
  ];

  const result = streamText({
    model: provider.responses(MODEL),
    system: INSTRUCTIONS,
    messages,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const text = (await result.text).trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("The AI returned an unreadable result. Please try another image.");
  }

  const parsed = JSON.parse(match[0]) as DetectionReport;
  parsed.detections = (parsed.detections ?? []).map((d) => ({
    ...d,
    box: {
      x: clamp01(d.box?.x ?? 0),
      y: clamp01(d.box?.y ?? 0),
      width: clamp01(d.box?.width ?? 0.1),
      height: clamp01(d.box?.height ?? 0.1),
    },
    confidence: Math.max(0, Math.min(100, Math.round(d.confidence ?? 0))),
    count: Math.max(1, Math.round(d.count ?? 1)),
  }));
  return parsed;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

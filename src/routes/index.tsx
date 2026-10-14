import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  Bug,
  Camera,
  CheckCircle2,
  Leaf,
  Loader2,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Upload,
} from "lucide-react";

import heroField from "@/assets/hero-field.jpg";
import { detectPestsFn } from "@/lib/ai/detect.functions";
import type { DetectionReport, PestDetection } from "@/lib/ai/detect.server";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgriShield — AI Crop Pest Detection" },
      {
        name: "description",
        content:
          "Upload a crop or field photo to detect pests, locate them on the image, gauge severity, and get treatment advice in seconds.",
      },
      { property: "og:title", content: "AgriShield — AI Crop Pest Detection" },
      {
        property: "og:description",
        content: "Detect crop pests from a single photo — even small, overlapping, or camouflaged ones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const MAX_DIM = 1600;

async function fileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("This file is not a readable image."));
    el.src = raw;
  });
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

const severityStyles: Record<PestDetection["severity"], string> = {
  low: "border-leaf text-leaf",
  medium: "border-amber-alert text-amber-alert",
  high: "border-destructive text-destructive",
};
const severityBg: Record<PestDetection["severity"], string> = {
  low: "bg-leaf",
  medium: "bg-amber-alert",
  high: "bg-destructive",
};

function Index() {
  const detect = useServerFn(detectPestsFn);
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [report, setReport] = useState<DetectionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const run = useCallback(
    async (file: File) => {
      setError(null);
      setReport(null);
      setActive(null);
      try {
        const dataUrl = await fileToDataUrl(file);
        setImage(dataUrl);
        setLoading(true);
        const result = await detect({ data: { imageDataUrl: dataUrl } });
        setReport(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Detection failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [detect],
  );

  const reset = () => {
    setImage(null);
    setReport(null);
    setError(null);
    setActive(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const totalPests = report?.detections.reduce((s, d) => s + d.count, 0) ?? 0;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">AgriShield</span>
          </div>
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Field Pest Detection · v1
          </span>
        </div>
      </header>

      {/* Hero */}
      {!image && (
        <section className="relative overflow-hidden bg-field text-field-foreground">
          <img
            src={heroField}
            alt="Aphid colony on a maize leaf"
            width={1600}
            height={912}
            className="absolute inset-0 h-full w-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-field via-field/80 to-transparent" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:py-28">
            <div>
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-accent">
                Precision agriculture
              </p>
              <h1 className="text-balance text-4xl font-bold leading-[1.05] md:text-6xl">
                Find every pest. Even the ones hiding.
              </h1>
              <p className="mt-6 max-w-md text-lg text-field-foreground/80">
                Upload a field photo. AI detects small, overlapping, and camouflaged pests — through leaf
                shade, glare, and blur — then tells you what to do.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 font-mono text-xs">
                {["Small objects", "Multi-species", "Density count", "Low light & blur"].map((t) => (
                  <span key={t} className="rounded-full border border-field-foreground/25 px-3 py-1">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <UploadZone
              dragging={dragging}
              setDragging={setDragging}
              onFile={run}
              onClick={() => inputRef.current?.click()}
            />
          </div>
        </section>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) run(f);
        }}
      />

      {/* Analysis */}
      {image && (
        <section className="bg-grid-field">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[1.4fr_1fr]">
            {/* Image with boxes */}
            <div>
              <div className="relative overflow-hidden rounded-lg border border-border bg-field shadow-xl">
                <img src={image} alt="Uploaded crop for analysis" className="block w-full" />
                {loading && (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="scanline absolute inset-x-0 h-1/3" />
                  </div>
                )}
                {report?.detections.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onClick={() => setActive(i)}
                    className={cn(
                      "absolute border-2 transition-all",
                      severityStyles[d.severity],
                      active === i ? "z-10 border-[3px]" : "animate-pulse-box",
                    )}
                    style={{
                      left: `${d.box.x * 100}%`,
                      top: `${d.box.y * 100}%`,
                      width: `${d.box.width * 100}%`,
                      height: `${d.box.height * 100}%`,
                    }}
                    aria-label={`${d.pest}, ${d.confidence}% confidence`}
                  >
                    <span
                      className={cn(
                        "absolute -top-6 left-[-2px] whitespace-nowrap rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary-foreground",
                        severityBg[d.severity],
                      )}
                    >
                      {i + 1}. {d.pest} · {d.confidence}%
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" /> Analyze another
                </button>
                <button
                  type="button"
                  onClick={reset}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" /> Start over
                </button>
              </div>
            </div>

            {/* Report */}
            <aside className="space-y-4">
              {loading && (
                <div className="rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="font-semibold">Scanning for pests…</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Checking leaves, stems, and soil for small or hidden pests. This takes about 15–40
                    seconds.
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Couldn't analyze image
                  </div>
                  <p className="mt-1 text-foreground/80">{error}</p>
                </div>
              )}

              {report && (
                <>
                  <div className="rounded-lg border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                          Crop · {report.cropType}
                        </p>
                        <StatusBadge status={report.healthStatus} />
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-3xl font-semibold">{totalPests}</div>
                        <div className="text-xs text-muted-foreground">pests est.</div>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed">{report.summary}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 font-mono text-xs">
                      <Stat label="Species" value={new Set(report.detections.map((d) => d.pest)).size} />
                      <Stat label="Regions" value={report.detections.length} />
                    </div>
                    <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Conditions: </span>
                      {report.environmentalNotes}
                    </p>
                  </div>

                  {report.detections.length === 0 ? (
                    <div className="rounded-lg border border-border bg-card p-6 text-center">
                      <Leaf className="mx-auto h-8 w-8 text-leaf" />
                      <p className="mt-2 font-semibold">No pests detected</p>
                      <p className="text-sm text-muted-foreground">This crop looks clean.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {report.detections.map((d, i) => (
                        <li
                          key={i}
                          onMouseEnter={() => setActive(i)}
                          onMouseLeave={() => setActive(null)}
                          className={cn(
                            "rounded-lg border bg-card p-4 transition",
                            active === i ? "border-primary shadow-md" : "border-border",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span
                                className={cn(
                                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm font-mono text-xs font-semibold text-primary-foreground",
                                  severityBg[d.severity],
                                )}
                              >
                                {i + 1}
                              </span>
                              <div>
                                <p className="font-semibold leading-tight">{d.pest}</p>
                                <p className="text-xs italic text-muted-foreground">{d.scientificName}</p>
                              </div>
                            </div>
                            <div className="text-right font-mono text-xs">
                              <div className="font-semibold">{d.confidence}%</div>
                              <div className="text-muted-foreground">×{d.count}</div>
                            </div>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full", severityBg[d.severity])}
                              style={{ width: `${d.confidence}%` }}
                            />
                          </div>
                          <p className="mt-3 text-sm">
                            <span className="font-semibold">Damage: </span>
                            {d.damage}
                          </p>
                          <p className="mt-1 text-sm">
                            <span className="font-semibold text-primary">Treatment: </span>
                            {d.treatment}
                          </p>
                          <span
                            className={cn(
                              "mt-3 inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                              severityStyles[d.severity],
                            )}
                          >
                            {d.severity} severity
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </aside>
          </div>
        </section>
      )}

      {/* Capabilities */}
      {!image && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: ScanSearch,
                title: "Small & hidden targets",
                body: "Spots tiny, overlapping, and camouflaged pests under leaf shade or soil glare.",
              },
              {
                icon: Bug,
                title: "Species & density",
                body: "Names each species, estimates how many are present, and marks where they are.",
              },
              {
                icon: ShieldCheck,
                title: "Actionable advice",
                body: "Severity rating with practical, integrated pest management treatment for each find.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-lg border border-border bg-card p-6">
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function UploadZone({
  dragging,
  setDragging,
  onFile,
  onClick,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onFile: (f: File) => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex min-h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center backdrop-blur-sm transition",
        dragging
          ? "border-accent bg-accent/15"
          : "border-field-foreground/35 bg-field/40 hover:border-accent hover:bg-field/60",
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Upload className="h-6 w-6" />
      </div>
      <p className="mt-5 text-lg font-semibold">Drop a crop photo here</p>
      <p className="mt-1 text-sm text-field-foreground/70">or tap to choose / take a photo</p>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-field-foreground/50">
        JPG · PNG · WEBP
      </p>
    </button>
  );
}

function StatusBadge({ status }: { status: DetectionReport["healthStatus"] }) {
  const map = {
    healthy: { label: "Healthy", icon: CheckCircle2, cls: "text-leaf" },
    at_risk: { label: "At risk", icon: AlertTriangle, cls: "text-amber-alert" },
    infested: { label: "Infested", icon: Bug, cls: "text-destructive" },
  } as const;
  const { label, icon: Icon, cls } = map[status] ?? map.at_risk;
  return (
    <div className={cn("mt-1 flex items-center gap-2 text-xl font-bold", cls)}>
      <Icon className="h-5 w-5" /> {label}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

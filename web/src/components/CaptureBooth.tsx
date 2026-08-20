"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { QrCodeImage } from "./QrCodeImage";
import { APP_NAME } from "@/lib/brand";
import { LOOK_OPTIONS, type LookId } from "@/lib/theme-looks";

type Step = "camera" | "countdown" | "form" | "qr" | "done";

type LiveTheme = { id: string; title: string; splitLooks?: boolean };

/** Flux Krea / booth portrait size. FluxKontextImageScale then maps this to 832x1248. */
const CAPTURE_WIDTH = 832;
const CAPTURE_HEIGHT = 1216;
const CAPTURE_ASPECT = CAPTURE_WIDTH / CAPTURE_HEIGHT;

function LookIcon({ id }: { id: LookId }) {
  if (id === "feminine") {
    return (
      <svg viewBox="0 0 32 48" width="36" height="52" aria-hidden="true" fill="currentColor">
        <circle cx="16" cy="6" r="5" />
        <path d="M10 14h12l6 16h-5l3 14h-5l-3-10h-4l-3 10h-5l3-14H4l6-16Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 48" width="36" height="52" aria-hidden="true" fill="currentColor">
      <circle cx="16" cy="6" r="5" />
      <rect x="4" y="14" width="24" height="5" rx="1" />
      <rect x="11" y="14" width="10" height="16" />
      <rect x="11" y="30" width="4" height="14" />
      <rect x="17" y="30" width="4" height="14" />
    </svg>
  );
}

function coverCrop(srcW: number, srcH: number) {
  const srcAspect = srcW / Math.max(srcH, 1);
  if (srcAspect > CAPTURE_ASPECT) {
    const sw = srcH * CAPTURE_ASPECT;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / CAPTURE_ASPECT;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

function imageToJpegDataUrl(source: CanvasImageSource, width: number, height: number, mirror = false) {
  if (width < 2 || height < 2) return null;
  const { sx, sy, sw, sh } = coverCrop(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = CAPTURE_WIDTH;
  canvas.height = CAPTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(CAPTURE_WIDTH, 0);
    ctx.scale(-1, 1);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function CaptureBooth({
  eventId,
  eventName,
  allowUpload,
  themes,
  credits: initialCredits,
  mode = "operator",
  jobsPath = "/api/jobs",
}: {
  eventId: string;
  eventName: string;
  allowUpload: boolean;
  themes: LiveTheme[];
  credits: number;
  mode?: "operator" | "shared";
  jobsPath?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const unlockTaps = useRef({ count: 0, timer: 0 });
  const [step, setStep] = useState<Step>("camera");
  const [themeId, setThemeId] = useState(themes.length === 1 ? themes[0].id : "");
  const [look, setLook] = useState<LookId | "">("");
  const [count, setCount] = useState(3);
  const [photo, setPhoto] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [credits, setCredits] = useState(initialCredits);
  const shared = mode === "shared";
  const noCreditsMessage = shared
    ? "This event isn't accepting photos right now."
    : "Insufficient credits";

  const startCamera = useCallback(async () => {
    try {
      const existing = streamRef.current;
      const live = existing?.getVideoTracks().some((track) => track.readyState === "live");
      if (!live) {
        existing?.getTracks().forEach((track) => track.stop());
        try {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch {
          streamRef.current = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false,
          });
        }
      }
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setError("");
    } catch {
      setCameraReady(false);
      setError("Camera unavailable.");
    }
  }, []);

  const cameraLive = step === "camera" || step === "countdown";

  useEffect(() => {
    if (!cameraLive) return undefined;
    void startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraLive, startCamera]);

  useEffect(() => {
    if (step !== "countdown" || count < 1) return undefined;
    const timer = window.setTimeout(() => {
      if (count === 1) {
        const video = videoRef.current;
        if (video) {
          const dataUrl = imageToJpegDataUrl(video, video.videoWidth, video.videoHeight, true);
          if (dataUrl) {
            setPhoto(dataUrl);
            setStep("form");
          }
        }
      }
      setCount((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [step, count]);

  function startCountdown() {
    if (credits < 1) {
      setError(noCreditsMessage);
      return;
    }
    if (!cameraReady) {
      setError(allowUpload ? "Camera unavailable. Upload a photo to continue." : "Camera unavailable.");
      return;
    }
    setCount(3);
    setStep("countdown");
  }

  function retake() {
    setPhoto(null);
    setThemeId(themes.length === 1 ? themes[0].id : "");
    setLook("");
    setError("");
    setStep("camera");
  }

  function nextGuest() {
    setEmail("");
    setPhone("");
    setThemeId(themes.length === 1 ? themes[0].id : "");
    setLook("");
    setPhoto(null);
    setError("");
    setResultUrl("");
    setStep("camera");
  }

  function secretUnlockTap() {
    if (shared) return;
    window.clearTimeout(unlockTaps.current.timer);
    unlockTaps.current.count += 1;
    if (unlockTaps.current.count >= 5) {
      unlockTaps.current.count = 0;
      window.location.href = "/kiosk-lock";
      return;
    }
    unlockTaps.current.timer = window.setTimeout(() => {
      unlockTaps.current.count = 0;
    }, 2000);
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Image must be under 12MB.");
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const dataUrl = imageToJpegDataUrl(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      if (!dataUrl) {
        setError("Could not read that image.");
        return;
      }
      setError("");
      setPhoto(dataUrl);
      setStep("form");
    } catch {
      setError("Could not read that image.");
    }
  }

  async function submit(event: FormEvent | null, viaQr = false) {
    event?.preventDefault();
    if (!photo || !eventId) return;
    if (credits < 1) {
      setError(noCreditsMessage);
      return;
    }
    if (!themeId) {
      setError("Please select a theme.");
      return;
    }
    const selectedTheme = themes.find((theme) => theme.id === themeId);
    if (selectedTheme?.splitLooks && !look) {
      setError("Please choose a look.");
      return;
    }
    if (!viaQr && !email.trim() && !phone.trim()) {
      setError("Enter an email or mobile number, or use Skip — QR code only.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const blob = await (await fetch(photo)).blob();
      const form = new FormData();
      form.append("photo", blob, "guest.jpg");
      form.append("email", viaQr ? "" : email);
      form.append("phone", viaQr ? "" : phone);
      form.append("eventId", eventId);
      form.append("themeId", themeId);
      if (look) form.append("look", look);
      if (viaQr) form.append("skipContact", "1");
      const response = await fetch(jobsPath, { method: "POST", body: form });
      const json = (await response.json()) as { error?: string; resultUrl?: string };
      if (!response.ok) throw new Error(json.error || "Could not submit");
      setCredits((current) => Math.max(0, current - 1));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (viaQr && json.resultUrl) {
        setResultUrl(json.resultUrl);
        setStep("qr");
      } else {
        setStep("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (step === "camera" || step === "countdown") {
    return (
      <main className="relative flex h-[100dvh] items-center justify-center overflow-hidden bg-black">
        <div className="kiosk-viewfinder">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          <div className="kiosk-top">
            <div className="kiosk-camera-cue">
              <svg className="kiosk-camera-pointer" viewBox="0 0 64 40" aria-hidden="true">
                <polygon points="32,3 61,37 3,37" />
              </svg>
              {step === "countdown" && count > 0 ? (
                <>
                  <p key={count} className="kiosk-countdown" aria-live="assertive">
                    {count}
                  </p>
                  <p className="kiosk-camera-label">Look up at the camera</p>
                </>
              ) : (
                <>
                  <p
                    className={`text-xs tracking-[0.28em] uppercase text-accent${shared ? "" : " pointer-events-auto"}`}
                    onClick={shared ? undefined : secretUnlockTap}
                  >
                    {eventName || APP_NAME}
                  </p>
                  <h1 className="mt-1 text-lg font-light tracking-[0.16em] text-white uppercase sm:text-xl sm:tracking-[0.2em]">Look at the camera</h1>
                </>
              )}
            </div>
          </div>
          <div className="pointer-events-auto bg-gradient-to-t from-black/90 to-transparent px-4 pt-12 text-center sm:px-6 sm:pt-16" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
            {error ? <p className="mb-4 text-sm text-[var(--danger)]">{error}</p> : null}
            {step === "camera" ? (
              <div className="flex flex-col items-center gap-4">
                <button type="button" className="booth-button kiosk-capture" onClick={startCountdown} disabled={!cameraReady || credits < 1}>
                  Take photo
                </button>
                {allowUpload ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(change) => void onUpload(change)}
                    />
                    <button type="button" className="text-sm text-muted underline" onClick={() => fileRef.current?.click()}>
                      Upload instead
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          </div>
        </div>
      </main>
    );
  }

  if (step === "form" && photo) {
    return (
      <main className="flex min-h-full flex-col">
        <header className="border-b border-[rgba(0,229,255,0.1)] bg-[rgba(18,18,18,0.95)] px-4 py-4 text-center sm:px-6 sm:py-5" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          <p className="text-xs tracking-[0.28em] uppercase text-accent">{eventName || APP_NAME}</p>
          <h1 className="page-title mt-2 tracking-[0.12em] sm:tracking-[0.16em]">Send your portrait</h1>
        </header>
        <form
          className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:grid-cols-[300px_1fr]"
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex flex-col gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt="Your photo"
              className="mx-auto w-full max-w-xs rounded border border-white/10 object-cover lg:max-w-none"
              style={{ aspectRatio: `${CAPTURE_WIDTH} / ${CAPTURE_HEIGHT}` }}
            />
            <button type="button" className="booth-button-secondary w-full" onClick={retake}>
              Retake
            </button>
          </div>
          <div className="flex flex-col gap-5 rounded border border-white/10 bg-[var(--panel)] p-4 lg:gap-6 lg:p-8">
            <div>
              <p className="booth-label">Choose a style</p>
              {themes.length === 0 ? (
                <p className="text-sm text-[var(--danger)]">This event has no active themes.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className={`kiosk-theme-btn ${themeId === theme.id ? "selected" : ""}`}
                      onClick={() => {
                        if (themeId !== theme.id) setLook("");
                        setThemeId(theme.id);
                        setError("");
                      }}
                    >
                      {theme.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {themes.find((theme) => theme.id === themeId)?.splitLooks ? (
              <div>
                <p className="booth-label">Choose a look</p>
                <p className="mb-3 text-sm text-muted">Pick the styling that fits this portrait.</p>
                <div className="grid grid-cols-2 gap-2">
                  {LOOK_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`kiosk-look-btn ${look === option.id ? "selected" : ""}`}
                      aria-label={option.label}
                      onClick={() => {
                        setLook(option.id);
                        setError("");
                      }}
                    >
                      <LookIcon id={option.id} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <label className="grid gap-2">
              <span className="booth-label">
                Email <span className="normal-case tracking-normal text-muted">(or mobile)</span>
              </span>
              <input
                className="booth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(change) => setEmail(change.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label className="grid gap-2">
              <span className="booth-label">
                Mobile <span className="normal-case tracking-normal text-muted">(or email)</span>
              </span>
              <input
                className="booth-input"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(change) => setPhone(change.target.value)}
                placeholder="+1 555 0100"
              />
            </label>
            <p className="border-l-2 border-[rgba(0,229,255,0.5)] bg-[rgba(0,229,255,0.05)] px-3 py-2 text-sm text-muted">
              We’ll send a private link when your portrait is ready. Provide email, mobile, or skip and scan a QR code.
            </p>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <div className="kiosk-form-actions">
              <button type="submit" className="booth-button w-full" disabled={busy || credits < 1}>
                {busy ? "Sending…" : "Send my portrait"}
              </button>
              <button
                type="button"
                className="booth-button-secondary w-full"
                disabled={busy || credits < 1}
                onClick={() => void submit(null, true)}
              >
                {busy ? "Creating link…" : "Skip - QR code only"}
              </button>
            </div>
          </div>
        </form>
      </main>
    );
  }

  if (step === "qr" && resultUrl) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        <p className="text-xs tracking-[0.28em] uppercase text-accent">{eventName || APP_NAME}</p>
        <h1 className="page-title mt-4">Scan for your portraits</h1>
        <p className="mt-3 max-w-md text-muted">
          Point your phone camera at this code. The page will show your portraits when they’re ready.
        </p>
        <div className="mt-8 w-[min(280px,70vw)]">
          <QrCodeImage value={resultUrl} size={280} alt="Portrait download link" className="h-auto w-full" />
        </div>
        <p className="mt-4 max-w-sm break-all text-xs text-muted">{resultUrl}</p>
        <button type="button" className="booth-button mt-10 w-full max-w-xs" onClick={nextGuest}>
          Done
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <p className="text-xs tracking-[0.28em] uppercase text-accent">{APP_NAME}</p>
      <h1 className="page-title mt-6">Thank you</h1>
      <p className="mt-4 max-w-xl text-muted">
        We’re creating your portrait. This takes about a minute. We’ll email and/or text a private
        link when it’s ready. You can step away.
      </p>
      <button type="button" className="booth-button mt-10 w-full max-w-xs" onClick={nextGuest}>
        Done
      </button>
    </main>
  );
}

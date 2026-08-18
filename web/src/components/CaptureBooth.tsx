"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

type Step = "camera" | "countdown" | "review" | "details" | "done" | "error";

function imageToJpegDataUrl(source: CanvasImageSource, width: number, height: number, mirror = false) {
  const canvas = document.createElement("canvas");
  const max = 1536;
  const scale = Math.min(1, max / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function CaptureBooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<Step>("camera");
  const [count, setCount] = useState(3);
  const [photo, setPhoto] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1600 }, height: { ideal: 1600 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setError("");
    } catch {
      setCameraReady(false);
      setError("Camera unavailable. Upload a photo to test.");
    }
  }, []);

  useEffect(() => {
    // Camera permission is an external device API.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- getUserMedia
    void startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [startCamera]);

  useEffect(() => {
    if (step !== "countdown" || count < 1) return undefined;
    const timer = window.setTimeout(() => {
      if (count === 1) {
        const video = videoRef.current;
        if (video) {
          const dataUrl = imageToJpegDataUrl(video, video.videoWidth, video.videoHeight, true);
          if (dataUrl) {
            setPhoto(dataUrl);
            setStep("review");
          }
        }
      }
      setCount((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [step, count]);

  function startCountdown() {
    if (!cameraReady) {
      setError("Camera unavailable. Upload a photo to test.");
      return;
    }
    setCount(3);
    setStep("countdown");
  }

  function resetToCamera() {
    setPhoto(null);
    setError("");
    setStep("camera");
    void startCamera();
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
      setStep("review");
    } catch {
      setError("Could not read that image.");
    }
  }

  async function submit() {
    if (!photo) return;
    setBusy(true);
    setError("");
    try {
      const blob = await (await fetch(photo)).blob();
      const form = new FormData();
      form.append("photo", blob, "guest.jpg");
      form.append("email", email);
      form.append("phone", phone);
      form.append("consent", consent ? "true" : "false");
      const response = await fetch("/api/jobs", { method: "POST", body: form });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Could not submit");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-full flex-1 flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <p className="text-xs tracking-[0.28em] uppercase text-accent">AI Photo Booth</p>
        <p className="text-xs text-muted">Look at the camera, or upload a test photo</p>
      </header>

      <section className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-8">
        <div className="relative flex-1 overflow-hidden rounded-sm bg-black ring-1 ring-white/10">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`h-full w-full object-cover ${step === "review" || step === "details" || step === "done" ? "hidden" : "block"}`}
            style={{ transform: "scaleX(-1)" }}
          />
          {photo && (step === "review" || step === "details" || step === "done") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Captured portrait" className="h-full w-full object-cover" />
          ) : null}

          {step === "countdown" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <p className="text-[8rem] font-light leading-none text-white">{count || ""}</p>
            </div>
          ) : null}
          {step === "camera" && !cameraReady ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted">No camera — upload a photo to test</p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 min-h-36">
          {step === "camera" ? (
            <div className="flex flex-col items-center gap-4">
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" className="booth-button" onClick={startCountdown} disabled={!cameraReady}>
                  Take photo
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void onUpload(event)}
                />
                <button
                  type="button"
                  className="booth-button-secondary"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload photo
                </button>
              </div>
            </div>
          ) : null}

          {step === "review" ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button type="button" className="booth-button-secondary" onClick={resetToCamera}>
                Start over
              </button>
              <button type="button" className="booth-button" onClick={() => setStep("details")}>
                Use photo
              </button>
            </div>
          ) : null}

          {step === "details" ? (
            <form
              className="mx-auto grid w-full max-w-xl gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <label className="grid gap-1 text-sm">
                Email
                <input
                  className="booth-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label className="grid gap-1 text-sm">
                Mobile
                <input
                  className="booth-input"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+1 555 0100"
                />
              </label>
              <label className="flex items-start gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  I agree to have my photo processed to generate a stylized portrait and sent to the
                  contact details I provide. The result link expires in 48 hours.
                </span>
              </label>
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button type="button" className="booth-button-secondary" onClick={() => setStep("review")}>
                  Back
                </button>
                <button type="submit" className="booth-button" disabled={busy}>
                  {busy ? "Sending…" : "Send my portrait"}
                </button>
              </div>
            </form>
          ) : null}

          {step === "done" ? (
            <div className="mx-auto max-w-lg text-center">
              <h1 className="text-2xl font-medium tracking-tight">We&apos;re creating your portrait</h1>
              <p className="mt-3 text-muted">
                This takes about a minute. We&apos;ll email and/or text a private link when it&apos;s
                ready. You can step away.
              </p>
              <button type="button" className="booth-button mt-8" onClick={() => {
                setEmail("");
                setPhone("");
                setConsent(false);
                resetToCamera();
              }}>
                Next guest
              </button>
            </div>
          ) : null}

          {step === "error" ? (
            <div className="text-center">
              <p className="text-red-300">{error}</p>
              <button type="button" className="booth-button mt-6" onClick={resetToCamera}>
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

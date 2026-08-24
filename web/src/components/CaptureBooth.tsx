"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { PhoneField } from "./PhoneField";
import { QrCodeImage } from "./QrCodeImage";
import { APP_NAME } from "@/lib/brand";
import { imageToJpegDataUrl } from "@/lib/booth-photo";
import { LOOK_OPTIONS, type LookId } from "@/lib/theme-looks";

type Step = "camera" | "countdown" | "review" | "form" | "contact" | "qr" | "done";

const STEP_ORDER: Step[] = ["camera", "countdown", "review", "form", "contact", "qr", "done"];

type LiveTheme = {
  id: string;
  title: string;
  splitLooks?: boolean;
  hasPreview?: boolean;
  hasMasculinePreview?: boolean;
  hasFemininePreview?: boolean;
  previewVersion?: string;
};

function kioskPreviewUrl(theme: LiveTheme, kind: "main" | "masculine" | "feminine") {
  const version = theme.previewVersion ? `&v=${encodeURIComponent(theme.previewVersion)}` : "";
  return `/api/t/${theme.id}/preview?kind=${kind}${version}`;
}

function themeThumbKind(theme: LiveTheme): "main" | "masculine" | "feminine" | "" {
  if (theme.hasPreview) return "main";
  if (theme.hasMasculinePreview) return "masculine";
  if (theme.hasFemininePreview) return "feminine";
  return "";
}

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
  const [previewThemeId, setPreviewThemeId] = useState("");
  const [previewLook, setPreviewLook] = useState<LookId | "">("");
  const [pickedThemeId, setPickedThemeId] = useState("");
  const [pickedLook, setPickedLook] = useState<LookId | "">("");
  const pickTimer = useRef(0);
  const shutterTimer = useRef(0);
  const stepRef = useRef<Step>("camera");
  const [count, setCount] = useState(3);
  const [photo, setPhoto] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [credits, setCredits] = useState(initialCredits);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [shutter, setShutter] = useState(false);
  const [pageDir, setPageDir] = useState<"forward" | "back">("forward");
  stepRef.current = step;
  const previewTheme = themes.find((theme) => theme.id === previewThemeId);
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
    return () => {
      window.clearTimeout(pickTimer.current);
      window.clearTimeout(shutterTimer.current);
    };
  }, []);

  function goTo(next: Step) {
    const from = STEP_ORDER.indexOf(stepRef.current);
    const to = STEP_ORDER.indexOf(next);
    setPageDir(to < from ? "back" : "forward");
    setStep(next);
  }

  function pageClass(extra = "") {
    return `kiosk-page${pageDir === "back" ? " is-back" : ""}${extra ? ` ${extra}` : ""}`;
  }

  useEffect(() => {
    if (step !== "contact") {
      setKeyboardOpen(false);
      document.documentElement.style.removeProperty("--kiosk-keyboard");
      return undefined;
    }
    const viewport = window.visualViewport;
    const sync = () => {
      const overlap = viewport
        ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
        : 0;
      document.documentElement.style.setProperty("--kiosk-keyboard", `${overlap}px`);
      setKeyboardOpen(overlap > 80);
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.closest(".kiosk-contact-form")) {
        window.setTimeout(() => focused.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
      }
    };
    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("focusin", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("focusin", sync);
      document.documentElement.style.removeProperty("--kiosk-keyboard");
    };
  }, [step]);

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
            setShutter(true);
            try {
              navigator.vibrate?.(20);
            } catch {
              /* ignore */
            }
            window.clearTimeout(shutterTimer.current);
            shutterTimer.current = window.setTimeout(() => {
              setShutter(false);
              goTo("review");
            }, 460);
            return;
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
    setShutter(false);
    setStep("countdown");
  }

  function retake() {
    setPhoto(null);
    setThemeId(themes.length === 1 ? themes[0].id : "");
    setLook("");
    setPreviewThemeId("");
    setPreviewLook("");
    setPickedThemeId("");
    setPickedLook("");
    setError("");
    setShutter(false);
    goTo("camera");
  }

  function nextGuest() {
    setGuestName("");
    setEmail("");
    setPhone("");
    setThemeId(themes.length === 1 ? themes[0].id : "");
    setLook("");
    setPreviewThemeId("");
    setPreviewLook("");
    setPickedThemeId("");
    setPickedLook("");
    setPhoto(null);
    setError("");
    setResultUrl("");
    setShutter(false);
    goTo("camera");
  }

  function goToContact(nextThemeId: string, nextLook: LookId | "") {
    setThemeId(nextThemeId);
    setLook(nextLook);
    setPreviewThemeId("");
    setPreviewLook("");
    setPickedThemeId("");
    setPickedLook("");
    setError("");
    goTo("contact");
  }

  function confirmPick(run: () => void) {
    window.clearTimeout(pickTimer.current);
    try {
      navigator.vibrate?.(16);
    } catch {
      /* ignore */
    }
    pickTimer.current = window.setTimeout(run, 280);
  }

  function chooseTheme(theme: LiveTheme) {
    if (pickedThemeId || pickedLook) return;
    setError("");
    setPickedThemeId(theme.id);
    confirmPick(() => {
      setPickedThemeId("");
      if (theme.splitLooks) {
        setPreviewThemeId(theme.id);
        return;
      }
      goToContact(theme.id, "");
    });
  }

  function chooseLook(nextLook: LookId) {
    if (pickedLook) return;
    const id = previewTheme?.id || themeId;
    if (!id) return;
    setPickedLook(nextLook);
    confirmPick(() => goToContact(id, nextLook));
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
      goTo("review");
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
      form.append("name", guestName);
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
        goTo("qr");
      } else {
        goTo("done");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  if (step === "camera" || step === "countdown") {
    return (
      <main className={pageClass("relative flex h-[100dvh] items-center justify-center overflow-hidden bg-black")}>
        <div className={`kiosk-viewfinder${shutter ? " is-capturing" : ""}`}>
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
          {shutter ? <div className="kiosk-shutter" /> : null}
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

  if (step === "review" && photo) {
    return (
      <main className={pageClass("relative flex h-[100dvh] items-center justify-center overflow-hidden bg-black")}>
        <div className="kiosk-viewfinder">
          <img src={photo} alt="Your photo" className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <div className="kiosk-top">
              <p className="text-xs tracking-[0.28em] uppercase text-accent">{eventName || APP_NAME}</p>
              <h1 className="mt-1 text-lg font-light tracking-[0.16em] text-white uppercase sm:text-xl">
                Use this photo?
              </h1>
            </div>
            <div
              className="pointer-events-auto bg-gradient-to-t from-black/90 to-transparent px-4 pt-12 sm:px-6"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            >
              <div className="kiosk-review-actions">
                <button type="button" className="booth-button-secondary kiosk-capture is-secondary w-full" onClick={retake}>
                  Retake
                </button>
                <button type="button" className="booth-button kiosk-capture w-full" onClick={() => goTo("form")}>
                  Use this photo
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (step === "form" && photo) {
    return (
      <main className={pageClass("kiosk-send")}>
        <header className="kiosk-send-header">
          <p className="text-xs tracking-[0.28em] uppercase text-accent">{eventName || APP_NAME}</p>
          <div className="flex items-center justify-center gap-3">
            <h1 className="page-title mt-2 tracking-[0.12em]">Choose a style</h1>
          </div>
          <button type="button" className="kiosk-send-back" onClick={() => goTo("review")}>
            Change photo
          </button>
        </header>
        <div className="kiosk-send-form">
          <div className="kiosk-theme-scroll">
            {themes.length === 0 ? (
              <p className="text-sm text-[var(--danger)]">This event has no active themes.</p>
            ) : (
              <div className={`kiosk-theme-grid${themes.some((theme) => themeThumbKind(theme)) ? " has-previews" : ""}`}>
                {themes.map((theme) => {
                  const thumb = themeThumbKind(theme);
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      className={`kiosk-theme-btn${thumb ? " has-preview" : ""}${
                        themeId === theme.id || pickedThemeId === theme.id ? " selected" : ""
                      }${pickedThemeId === theme.id ? " is-picked" : ""}`}
                      onClick={() => chooseTheme(theme)}
                    >
                      {thumb ? <img src={kioskPreviewUrl(theme, thumb)} alt="" /> : null}
                      <span>{theme.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {previewTheme ? (
          <div className="kiosk-preview-overlay">
            <div className="kiosk-preview-card">
              <p className="text-xs tracking-[0.28em] uppercase text-accent">Preview</p>
              <h2 className="mt-2 text-xl font-light tracking-[0.12em] uppercase">{previewTheme.title}</h2>
              <p className="mt-2 text-sm text-muted">Tap a look to continue.</p>
              <div className="kiosk-preview-looks">
                {LOOK_OPTIONS.map((option) => {
                  const kind =
                    option.id === "masculine" && previewTheme.hasMasculinePreview
                      ? "masculine"
                      : option.id === "feminine" && previewTheme.hasFemininePreview
                        ? "feminine"
                        : previewTheme.hasPreview
                          ? "main"
                          : "";
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`kiosk-preview-look${pickedLook === option.id ? " selected is-picked" : ""}`}
                      onClick={() => chooseLook(option.id)}
                    >
                      {kind ? <img src={kioskPreviewUrl(previewTheme, kind)} alt="" /> : <LookIcon id={option.id} />}
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="booth-button-secondary mt-5 w-full"
                onClick={() => {
                  setPreviewThemeId("");
                  setPreviewLook("");
                  setError("");
                }}
              >
                Back
              </button>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  if (step === "contact" && photo) {
    const selectedTheme = themes.find((theme) => theme.id === themeId);
    return (
      <main className={pageClass(`kiosk-send${keyboardOpen ? " is-keyboard" : ""}`)}>
        <header className="kiosk-send-header">
          <p className="text-xs tracking-[0.28em] uppercase text-accent">{eventName || APP_NAME}</p>
          <h1 className="page-title mt-2 tracking-[0.12em]">Send your portrait</h1>
          <button type="button" className="kiosk-send-back" onClick={() => goTo("form")}>
            Change style
          </button>
        </header>
        <form className="kiosk-send-form kiosk-contact-form" onSubmit={(event) => void submit(event)}>
          <div className="kiosk-contact-body">
            {selectedTheme ? (
              <p className="kiosk-contact-style">
                Style: {selectedTheme.title}
                {look ? ` · ${LOOK_OPTIONS.find((option) => option.id === look)?.label || look}` : ""}
              </p>
            ) : null}
            <div className="kiosk-send-contact">
              <label className="grid gap-2">
                <span className="booth-label mb-0">Name</span>
                <input
                  className="booth-input"
                  type="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  value={guestName}
                  onChange={(change) => setGuestName(change.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label className="grid gap-2">
                <span className="booth-label mb-0">Email</span>
                <input
                  className="booth-input"
                  type="email"
                  autoComplete="email"
                  enterKeyHint="next"
                  value={email}
                  onChange={(change) => setEmail(change.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label className="grid gap-2">
                <span className="booth-label mb-0">Mobile</span>
                <PhoneField value={phone} onChange={setPhone} />
              </label>
            </div>
            <p className="kiosk-contact-hint">
              We’ll send a private link when your portrait is ready. Email, mobile, or skip and scan a QR code.
            </p>
            {error ? <p className="kiosk-alert">{error}</p> : null}
            <div className="kiosk-form-actions">
              <button type="submit" className="booth-button kiosk-capture w-full" disabled={busy || credits < 1}>
                {busy ? "Sending…" : "Send my portrait"}
              </button>
              <button
                type="button"
                className="booth-button-secondary kiosk-capture is-secondary w-full"
                disabled={busy || credits < 1}
                onClick={() => void submit(null, true)}
              >
                {busy ? "Creating link…" : "Skip — QR only"}
              </button>
            </div>
          </div>
        </form>
      </main>
    );
  }

  if (step === "qr" && resultUrl) {
    return (
      <main className={pageClass("flex min-h-full flex-col items-center justify-center px-4 py-12 text-center sm:px-6")}>
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
    <main className={pageClass("flex min-h-full flex-col items-center justify-center px-4 py-16 text-center sm:px-6")}>
      <p className="text-xs tracking-[0.28em] uppercase text-accent">{APP_NAME}</p>
      <h1 className="page-title mt-6 text-[clamp(1.7rem,5.5vw,2.25rem)]">Thank you</h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
        We’re creating your portrait. This takes about a minute. We’ll email and/or text a private
        link when it’s ready. You can step away.
      </p>
      <button type="button" className="booth-button mt-10 w-full max-w-xs" onClick={nextGuest}>
        Done
      </button>
    </main>
  );
}

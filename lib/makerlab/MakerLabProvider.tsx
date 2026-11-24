import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  COMMERCIAL_KEY,
  type AppContext,
  type DisplayPrice,
  type GeneratorFunctionPayment,
  type MakerLabSDK,
  type SdkModule,
  type ToastParams,
} from "./types";

/*
 * Connects to MakerLab when the app runs inside its iframe.
 *
 * The SDK runtime is the developer kit's lib/index.js, copied to
 * lib/makerlab/sdk/index.js. The glob below finds it at build time; without it
 * (or when the page is opened on its own, outside an iframe) the app runs in
 * "standalone" mode and downloads files directly.
 */
const sdkModules = import.meta.glob<SdkModule>("./sdk/index.js");
const loadSdkModule = Object.values(sdkModules)[0] as (() => Promise<SdkModule>) | undefined;

export type MakerLabStatus = "standalone" | "connecting" | "ready" | "disconnected" | "error";

type MakerLabValue = {
  status: MakerLabStatus;
  /** True when running inside MakerLab (connected or not): downloads must go through the host. */
  hosted: boolean;
  sdk: MakerLabSDK | null;
  context: Readonly<AppContext> | null;
  lang: string;
  error: string | null;
  can: (capability: string) => boolean;
  /** Display only — never a security check. */
  isUnlocked: (functionKey: string) => boolean;
  /** Is this error the given SDK error code? Compares against the SDK's ERROR_CODE constants. */
  isError: (err: unknown, code: string) => boolean;
  /** Host toast when available, otherwise null so the caller can show its own. */
  toast: (params: ToastParams) => Promise<boolean>;
  commercial: CommercialLicense | null;
  buyCommercial: () => Promise<void>;
  buying: boolean;
  /** A paid feature from the host's price catalog, or null when it isn't offered (or not in MakerLab). */
  paidFeature: (functionKey: string) => PaidFeature | null;
  /**
   * Authorises a paid feature before it runs (Paid Features › Step 4): the
   * host checks ownership, takes payment if needed and verifies again.
   * Resolves true only when the feature may run. Cancelled payment is silent;
   * other failures show the documented message. Never unlocks on an error.
   */
  ensureAccess: (functionKey: string) => Promise<boolean>;
  /** The functionKey whose requestAccess is in flight, if any. */
  busyKey: string | null;
};

export type PaidFeature = {
  feature: GeneratorFunctionPayment;
  /** Display only (isUnlocked) — run the feature only after ensureAccess. */
  owned: boolean;
  price: string;
  originalPrice?: string;
};

export type CommercialLicense = PaidFeature;

const MakerLabCtx = createContext<MakerLabValue | null>(null);

const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const APP_ID = params.get("appId") ?? "";
const LANG = params.get("lang") ?? "en";

function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin parent
  }
}

const HOSTED = typeof window !== "undefined" && inIframe() && !!APP_ID;

/*
 * One SDK instance per page (the SDK allows a single init per instance), kept
 * outside React so StrictMode's double effects don't create a second one.
 */
type Connection = { mod: SdkModule; sdk: MakerLabSDK; ctx: AppContext };
let connection: Promise<Connection> | null = null;
const listeners = new Set<(e: { type: "payment" | "disconnect"; ctx?: Readonly<AppContext> | null }) => void>();

function connect(): Promise<Connection> {
  connection ??= (async () => {
    if (!loadSdkModule) throw new Error("MakerLab SDK not bundled: copy the kit's lib/index.js to lib/makerlab/sdk/index.js");
    const mod = await loadSdkModule();
    const sdk = mod.createMakerLabSDK({ appId: APP_ID });
    const ctx = await sdk.init({
      // The bundle (three.js + Mapbox GL JS) is a few MB; give the handshake room.
      timeout: 20000,
      onDisconnect: () => listeners.forEach((l) => l({ type: "disconnect" })),
      onError: (err) => console.error("[MakerLab] SDK runtime error", err),
      onPaymentChange: ({ payment }) => {
        const current = sdk.context;
        listeners.forEach((l) => l({ type: "payment", ctx: current ? { ...current, payment } : null }));
      },
    });
    window.addEventListener("pagehide", () => sdk.destroy(), { once: true });
    return { mod, sdk, ctx: sdk.context ?? ctx };
  })();
  return connection;
}

export function formatPrice(price: DisplayPrice): string {
  const d = price.preference ?? price.origin;
  const value = d.amount / 1000;
  return `${d.currencySign}${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

/** Messages for requestAccess failures (Paid Features › Step 5). PAYMENT_CANCELLED is silent. */
const ACCESS_MESSAGES: Record<string, string> = {
  ACCESS_DENIED: "Purchase is required to use this feature.",
  PAYMENT_FAILED: "Payment was not completed. Please try again.",
  ACCESS_TOKEN_INVALID: "Entitlement verification failed. Please try again.",
  ACCESS_CHECK_FAILED: "Network error. Please try again later.",
  CAPABILITY_NOT_GRANTED: "This feature is currently unavailable.",
};

export function MakerLabProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MakerLabStatus>(HOSTED ? "connecting" : "standalone");
  const [conn, setConn] = useState<Connection | null>(null);
  const [context, setContext] = useState<Readonly<AppContext> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!HOSTED) return;
    let alive = true;
    const onEvent: Parameters<typeof listeners.add>[0] = (e) => {
      if (!alive) return;
      if (e.type === "disconnect") setStatus("disconnected");
      else if (e.ctx) setContext(e.ctx);
    };
    listeners.add(onEvent);
    connect()
      .then((c) => {
        if (!alive) return;
        setConn(c);
        setContext(c.ctx);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const code = (err as { code?: string })?.code;
        console.error("[MakerLab] init failed", err);
        setError(code ? `[${code}] ${(err as Error).message}` : String((err as Error)?.message ?? err));
        setStatus("error");
      });
    return () => {
      alive = false;
      listeners.delete(onEvent);
    };
  }, []);

  const sdk = status === "ready" ? conn?.sdk ?? null : null;

  const can = useCallback((capability: string) => !!sdk && (context?.capabilities.includes(capability) ?? false), [sdk, context]);

  const isUnlocked = useCallback(
    // `context` is read so the result refreshes after onPaymentChange.
    (key: string) => (sdk && context ? sdk.isUnlocked(key) : false),
    [sdk, context]
  );

  const isError = useCallback(
    (err: unknown, code: string) => {
      const mod = conn?.mod;
      if (!mod || !(err instanceof mod.BridgeError)) return false;
      return (err as { code: string }).code === (mod.ERROR_CODE[code] ?? code);
    },
    [conn]
  );

  const toast = useCallback(
    async (p: ToastParams) => {
      if (!sdk || !can("toast")) return false;
      try {
        await sdk.toast(p);
        return true;
      } catch {
        return false;
      }
    },
    [sdk, can]
  );

  const paidFeature = useCallback(
    (key: string): PaidFeature | null => {
      // Prices and ownership come from the platform (context.payment) — never hard-coded.
      const feature = context?.payment.functions.find((f) => f.functionKey === key);
      if (!feature || !sdk) return null;
      return {
        feature,
        owned: isUnlocked(key),
        price: formatPrice(feature.useDiscount ? feature.discountPriceDisplay : feature.originPriceDisplay),
        originalPrice: feature.useDiscount ? formatPrice(feature.originPriceDisplay) : undefined,
      };
    },
    [context, sdk, isUnlocked]
  );

  const [busyKey, setBusyKey] = useState<string | null>(null);

  const ensureAccess = useCallback(
    async (key: string) => {
      if (!sdk || !can("requestAccess") || busyKey) return false;
      setBusyKey(key);
      try {
        await sdk.requestAccess(key);
        return true; // the feature may run; the UI updates from onPaymentChange
      } catch (err) {
        if (isError(err, "PAYMENT_CANCELLED")) return false; // user closed payment: stay silent
        const code = (err as { code?: string })?.code ?? "";
        await toast({ message: ACCESS_MESSAGES[code] ?? "Something went wrong. Please try again.", type: "info" });
        return false; // keep it locked on every failure
      } finally {
        setBusyKey(null);
      }
    },
    [sdk, can, busyKey, isError, toast]
  );

  const commercial = useMemo(() => paidFeature(COMMERCIAL_KEY), [paidFeature]);

  /** Opens the host's purchase flow for the commercial license. */
  const buyCommercial = useCallback(async () => {
    await ensureAccess(COMMERCIAL_KEY);
  }, [ensureAccess]);
  const buying = busyKey === COMMERCIAL_KEY;

  const value = useMemo<MakerLabValue>(
    () => ({
      status,
      hosted: HOSTED,
      sdk,
      context,
      lang: LANG,
      error,
      can,
      isUnlocked,
      isError,
      toast,
      commercial,
      buyCommercial,
      buying,
      paidFeature,
      ensureAccess,
      busyKey,
    }),
    [status, sdk, context, error, can, isUnlocked, isError, toast, commercial, buyCommercial, buying, paidFeature, ensureAccess, busyKey]
  );

  return <MakerLabCtx.Provider value={value}>{children}</MakerLabCtx.Provider>;
}

export function useMakerLab(): MakerLabValue {
  const v = useContext(MakerLabCtx);
  if (!v) throw new Error("useMakerLab must be used inside <MakerLabProvider>");
  return v;
}

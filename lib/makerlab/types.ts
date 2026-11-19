// The parts of the MakerLab App SDK this app uses, typed from the SDK docs
// (SDK API Reference, Paid Features, Exporting Models). The runtime itself is
// the developer kit's lib/index.js, copied to lib/makerlab/sdk/index.js.

export type Capability = "export" | "toast" | "dialog" | "buyMeACoffee" | "requestAccess";

export type DisplayCurrencyAmount = {
  amount: number; // milli-currency units — divide by 1000
  currency: string;
  currencySign: string;
};

export type DisplayPrice = {
  origin: DisplayCurrencyAmount;
  preference?: DisplayCurrencyAmount;
};

export type GeneratorFunctionPayment = {
  functionKey: string;
  functionName: string;
  originPriceDisplay: DisplayPrice;
  discountPriceDisplay: DisplayPrice;
  discountConfig: { startTime: number; endTime: number };
  useDiscount: boolean;
  owned: boolean;
  permissionScope?: string;
};

export type MembershipExportQuota = {
  remaining: number;
  limit: number;
  resetAt: number;
  period: "day" | "week" | "month" | "";
};

export type GeneratorPaymentInfo = {
  membershipType: "free" | "partial_buyout" | "full_buyout";
  status: "unpurchased" | "partial_buyout" | "full_buyout";
  functions: GeneratorFunctionPayment[];
  exportQuota?: MembershipExportQuota;
};

export type AppContext = {
  appId: string;
  capabilities: string[];
  devMode: boolean;
  payment: GeneratorPaymentInfo;
};

export type PaymentChangeEvent = {
  payment: GeneratorPaymentInfo;
  changedKeys: string[];
  source: "host" | "requestAccess";
};

export type InitOptions = {
  timeout?: number;
  onReady?: (ctx: AppContext) => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onPaymentChange?: (event: PaymentChangeEvent) => void;
};

export type ObjPrintConfig = Record<string, unknown>;

export type ExportArtifactInput = {
  fileName: string;
  format: "stl" | "obj" | "zip";
  buffer: ArrayBuffer | ArrayBuffer[];
  coverImage: string;
  description?: string;
  mtl?: string;
  mergeObj?: boolean;
  printConfig?: ObjPrintConfig;
};

export type ExportPrinterModel =
  | "A1" | "A1M" | "A2L" | "P1S" | "P2S" | "X1C" | "X2D" | "H2D" | "H2DPro" | "H2C" | "H2S" | "P1P" | "X1E" | "X1";

export type ExportOptions = {
  artifacts: ExportArtifactInput[];
  printerType?: "3D" | "2D";
  printer?: ExportPrinterModel;
  nozzle?: number;
  printerIncludeList?: ExportPrinterModel[];
  printerExcludeList?: ExportPrinterModel[];
};

export type ExportResult =
  | { success: true; format: "stl" | "3mf" | "zip" }
  | { success: false; errorCode: string; errorMessage?: string };

export type ToastParams = {
  message: string;
  type?: "success" | "info" | "warning" | "error";
  duration?: number;
};

export type MakerLabSDK = {
  readonly state: "idle" | "initializing" | "ready" | "disconnected" | "destroyed";
  readonly context: Readonly<AppContext> | null;
  init(options?: InitOptions): Promise<AppContext>;
  export(options: ExportOptions): Promise<ExportResult>;
  toast(options: ToastParams): Promise<void>;
  requestAccess(functionKey: string): Promise<unknown>;
  isUnlocked(functionKey: string): boolean;
  destroy(): void;
};

/** Shape of the developer kit's lib/index.js module. */
export type SdkModule = {
  createMakerLabSDK(options: { appId: string }): MakerLabSDK;
  BridgeError: new (...args: never[]) => Error & { code: string; details?: unknown };
  ERROR_CODE: Record<string, string>;
};

/** The reserved key MakerLab uses for the commercial license. */
export const COMMERCIAL_KEY = "commercial_eeee";

import { z } from 'zod';

declare const DOWNLOAD_FORMAT: {
	readonly STL: "stl";
	readonly "3MF": "3mf";
	readonly ZIP: "zip";
};
export type DownloadFormat = (typeof DOWNLOAD_FORMAT)[keyof typeof DOWNLOAD_FORMAT];
/**
 * Target printer category for the export flow.
 * - `3D` (default): host shows the FDM printer selection panel before download.
 * - `2D`: host skips printer selection and opens the download dialog directly.
 */
export declare const EXPORT_PRINTER_TYPE: {
	readonly TWO_D: "2D";
	readonly THREE_D: "3D";
};
export type ExportPrinterType = (typeof EXPORT_PRINTER_TYPE)[keyof typeof EXPORT_PRINTER_TYPE];
/**
 * Printer models accepted by export `printer` / `printerIncludeList` / `printerExcludeList`.
 * Keep in sync with `PrinterType` in `@bbl/generator-common` resource.
 */
export declare const EXPORT_PRINTER_MODEL: readonly [
	"A1",
	"A1M",
	"A2L",
	"P1S",
	"P2S",
	"X1C",
	"X2D",
	"H2D",
	"H2DPro",
	"H2C",
	"H2S",
	"P1P",
	"X1E",
	"X1"
];
export type ExportPrinterModel = (typeof EXPORT_PRINTER_MODEL)[number];
declare const EXPORT_LAYER_HEIGHT: readonly [
	"0.06",
	"0.08",
	"0.1",
	"0.12",
	"0.14",
	"0.16",
	"0.18",
	"0.2",
	"0.24",
	"0.28",
	"0.3",
	"0.32",
	"0.36",
	"0.4",
	"0.42",
	"0.48",
	"0.56"
];
export type ExportLayerHeight = (typeof EXPORT_LAYER_HEIGHT)[number];
declare const EXPORT_SPARSE_INFILL_PATTERN: readonly [
	"concentric",
	"zig-zag",
	"grid",
	"line",
	"cubic",
	"triangles",
	"tri-hexagon",
	"gyroid",
	"honeycomb",
	"adaptivecubic",
	"alignedrectilinear",
	"3dhoneycomb",
	"hilbertcurve",
	"archimedeanchords",
	"octagramspiral",
	"supportcubic",
	"lightning",
	"crosshatch"
];
export type ExportSparseInfillPattern = (typeof EXPORT_SPARSE_INFILL_PATTERN)[number];
declare const EXPORT_WALL_GENERATOR: readonly [
	"classic",
	"arachne"
];
export type ExportWallGenerator = (typeof EXPORT_WALL_GENERATOR)[number];
declare const TOAST_TYPE: {
	readonly SUCCESS: "success";
	readonly INFO: "info";
	readonly WARNING: "warning";
	readonly ERROR: "error";
};
export type ToastType = (typeof TOAST_TYPE)[keyof typeof TOAST_TYPE];
declare const DIALOG_VARIANT: {
	readonly ALERT: "alert";
	readonly CONFIRM: "confirm";
};
export type DialogVariant = (typeof DIALOG_VARIANT)[keyof typeof DIALOG_VARIANT];
declare const DIALOG_RESULT_REASONS: readonly [
	"confirm",
	"cancel",
	"close"
];
declare const ALERT_RESULT_REASONS: readonly [
	"confirm",
	"close"
];
export type DialogResultReason = (typeof DIALOG_RESULT_REASONS)[number];
export type AlertResultReason = (typeof ALERT_RESULT_REASONS)[number];
declare const CAPABILITY: {
	readonly EXPORT: "export";
	readonly TOAST: "toast";
	readonly DIALOG: "dialog";
	readonly BUY_ME_A_COFFEE: "buyMeACoffee";
	readonly REQUEST_ACCESS: "requestAccess";
};
export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];
/**
 * Sentinel for `exportQuota.remaining` and `exportQuota.limit` when exports are not limited.
 */
export declare const EXPORT_QUOTA_UNLIMITED = 999999;
/**
 * Error codes for bridge protocol
 * Format: DOMAIN_ERROR_NAME
 */
export declare const ERROR_CODE: {
	readonly NOT_INITIALIZED: "NOT_INITIALIZED";
	readonly HANDSHAKE_TIMEOUT: "HANDSHAKE_TIMEOUT";
	readonly HANDSHAKE_VERIFICATION_FAILED: "HANDSHAKE_VERIFICATION_FAILED";
	readonly HANDSHAKE_INVALID_RESPONSE: "HANDSHAKE_INVALID_RESPONSE";
	readonly HANDSHAKE_ORIGIN_MISMATCH: "HANDSHAKE_ORIGIN_MISMATCH";
	readonly HANDSHAKE_ALREADY_INITIALIZED: "HANDSHAKE_ALREADY_INITIALIZED";
	readonly HANDSHAKE_SDK_OUTDATED: "HANDSHAKE_SDK_OUTDATED";
	readonly EXPORT_INVALID_FORMAT: "EXPORT_INVALID_FORMAT";
	readonly EXPORT_SERIALIZATION_FAILED: "EXPORT_SERIALIZATION_FAILED";
	readonly EXPORT_USER_CANCELLED: "EXPORT_USER_CANCELLED";
	readonly EXPORT_BUFFER_TOO_LARGE: "EXPORT_BUFFER_TOO_LARGE";
	readonly EXPORT_COVER_IMAGE_TOO_LARGE: "EXPORT_COVER_IMAGE_TOO_LARGE";
	readonly EXPORT_ARTIFACT_COUNT_EXCEEDED: "EXPORT_ARTIFACT_COUNT_EXCEEDED";
	readonly EXPORT_OBJ_PLATE_COUNT_EXCEEDED: "EXPORT_OBJ_PLATE_COUNT_EXCEEDED";
	readonly EXPORT_PRINT_CONFIG_PLATES_LENGTH_MISMATCH: "EXPORT_PRINT_CONFIG_PLATES_LENGTH_MISMATCH";
	readonly EXPORT_MTL_TOO_LARGE: "EXPORT_MTL_TOO_LARGE";
	readonly MISSING_ARTIFACTS: "MISSING_ARTIFACTS";
	readonly EXPORT_FAILED: "EXPORT_FAILED";
	readonly MESSAGE_INVALID_SCHEMA: "MESSAGE_INVALID_SCHEMA";
	readonly MESSAGE_MISSING_REQUIRED_FIELD: "MESSAGE_MISSING_REQUIRED_FIELD";
	readonly MESSAGE_INVALID_FIELD_TYPE: "MESSAGE_INVALID_FIELD_TYPE";
	readonly MESSAGE_INVALID_LITERAL_VALUE: "MESSAGE_INVALID_LITERAL_VALUE";
	readonly MESSAGE_INVALID_ENUM_VALUE: "MESSAGE_INVALID_ENUM_VALUE";
	readonly MESSAGE_INVALID_STRING_FORMAT: "MESSAGE_INVALID_STRING_FORMAT";
	readonly MESSAGE_VALUE_TOO_SMALL: "MESSAGE_VALUE_TOO_SMALL";
	readonly MESSAGE_VALUE_TOO_LARGE: "MESSAGE_VALUE_TOO_LARGE";
	readonly MESSAGE_INVALID_UNION: "MESSAGE_INVALID_UNION";
	readonly MESSAGE_UNRECOGNIZED_KEYS: "MESSAGE_UNRECOGNIZED_KEYS";
	readonly MESSAGE_PROTOTYPE_POLLUTION: "MESSAGE_PROTOTYPE_POLLUTION";
	readonly MESSAGE_RATE_LIMITED: "MESSAGE_RATE_LIMITED";
	readonly MESSAGE_UNKNOWN_TYPE: "MESSAGE_UNKNOWN_TYPE";
	readonly CONNECTION_LOST: "CONNECTION_LOST";
	readonly CONNECTION_HEARTBEAT_TIMEOUT: "CONNECTION_HEARTBEAT_TIMEOUT";
	readonly CONNECTION_NOT_IN_IFRAME: "CONNECTION_NOT_IN_IFRAME";
	readonly ACCESS_DENIED: "ACCESS_DENIED";
	readonly ACCESS_TOKEN_INVALID: "ACCESS_TOKEN_INVALID";
	readonly ACCESS_CHECK_FAILED: "ACCESS_CHECK_FAILED";
	readonly PAYMENT_FAILED: "PAYMENT_FAILED";
	readonly PAYMENT_CANCELLED: "PAYMENT_CANCELLED";
	readonly SDK_INTEGRITY_TAMPERED: "SDK_INTEGRITY_TAMPERED";
	readonly UNKNOWN_ERROR: "UNKNOWN_ERROR";
	readonly CAPABILITY_NOT_GRANTED: "CAPABILITY_NOT_GRANTED";
};
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
/**
 * Structured payload returned when a BridgeError is serialized.
 * @property name - The error class name.
 * @property code - The stable bridge protocol error code.
 * @property message - The human-readable error message mapped from the error code.
 * @property details - Optional extra context attached when the error was created.
 */
export interface BridgeErrorJSON {
	name: string;
	code: ErrorCode;
	message: string;
	details?: unknown;
}
/**
 * Error type used across the bridge protocol.
 * @extends Error
 */
export declare class BridgeError extends Error {
	readonly code: ErrorCode;
	readonly details?: unknown;
	/**
	 * Create a typed bridge protocol error.
	 * @param code - The stable bridge protocol error code.
	 * @param [details] - Extra context attached to the error instance.
	 * @param [messageOverride] - Preferred human-readable message. When a non-empty
	 *   string is provided (e.g. a message relayed from the host), it takes precedence
	 *   over the local message mapped from `code`. Empty strings fall back to the
	 *   code-mapped default.
	 */
	constructor(code: ErrorCode, details?: unknown, messageOverride?: string);
	/**
	 * Convert the error instance into a serializable object.
	 * @returns A plain object that preserves the error identity and context.
	 */
	toJSON(): BridgeErrorJSON;
}
declare const accessScopeSchema: z.ZodString;
declare const membershipExportQuotaSchema: z.ZodObject<{
	/** 当前周期剩余导出次数；不限制时固定 999999 */
	remaining: z.ZodNumber;
	/** 当前周期结束时间，Unix 秒，UTC；不限制且无周期时为 0 */
	resetAt: z.ZodNumber;
	/** 当前周期导出上限；不限制时固定 999999 */
	limit: z.ZodNumber;
	/** day | week | month；不限制且未配置周期时为空字符串 */
	period: z.ZodEnum<[
		"day",
		"week",
		"month",
		""
	]>;
}, "strip", z.ZodTypeAny, {
	remaining: number;
	resetAt: number;
	limit: number;
	period: "" | "day" | "week" | "month";
}, {
	remaining: number;
	resetAt: number;
	limit: number;
	period: "" | "day" | "week" | "month";
}>;
declare const membershipResultSchema: z.ZodObject<{
	signature: z.ZodObject<{
		keyId: z.ZodString;
		algorithm: z.ZodString;
		payload: z.ZodString;
		sign: z.ZodString;
	}, "strip", z.ZodTypeAny, {
		payload: string;
		keyId: string;
		algorithm: string;
		sign: string;
	}, {
		payload: string;
		keyId: string;
		algorithm: string;
		sign: string;
	}>;
}, "strip", z.ZodTypeAny, {
	signature: {
		payload: string;
		keyId: string;
		algorithm: string;
		sign: string;
	};
}, {
	signature: {
		payload: string;
		keyId: string;
		algorithm: string;
		sign: string;
	};
}>;
export type AccessScope = z.infer<typeof accessScopeSchema>;
export type MembershipExportQuota = z.infer<typeof membershipExportQuotaSchema>;
export type MembershipResult = z.infer<typeof membershipResultSchema>;
/**
 * Options accepted by SDK helpers that initiate an export.
 * @property artifacts - Artifacts to send to the host.
 * @property printerType - Optional target printer category. Defaults to `'3D'`.
 *   When `'2D'`, the host skips the FDM printer selection panel.
 * @property printer - Optional preset printer model. When both `printer` and `nozzle` are valid
 *   (and `printer` is allowed by the include / exclude lists), the host skips the printer
 *   selection panel; otherwise the panel is shown as usual.
 * @property nozzle - Optional preset nozzle diameter in mm (`0.4` | `0.2`). See `printer`.
 * @property printerIncludeList - Optional whitelist of printers shown in the selection panel.
 *   Takes precedence over `printerExcludeList` when both are set.
 * @property printerExcludeList - Optional blacklist of printers hidden from the selection panel.
 */
export interface ExportOptions {
	artifacts: ExportArtifactInput[];
	printerType?: ExportPrinterType;
	printer?: ExportPrinterModel;
	nozzle?: number;
	printerIncludeList?: ExportPrinterModel[];
	printerExcludeList?: ExportPrinterModel[];
}
/**
 * Common fields shared by all export artifact variants.
 */
export interface BaseArtifact {
	fileName: string;
	/** Base64 data URL for the cover/thumbnail image (e.g. `data:image/png;base64,...`) */
	coverImage: string;
	description?: string;
}
export interface StlArtifact extends BaseArtifact {
	format: "stl";
	buffer: ArrayBuffer;
}
export interface ZipArtifact extends BaseArtifact {
	format: "zip";
	buffer: ArrayBuffer;
}
/**
 * Per-plate print overrides for multi-plate OBJ export.
 * Index aligns with `ObjArtifact.buffer` plate index.
 *
 * Known camelCase fields are mapped by the host; any additional snake_case
 * Studio project-setting keys are forwarded as-is via `customProjectSetting`.
 */
export interface ObjPlatePrintConfig {
	/**
	 * Optional per-plate wall generator (`"classic"` | `"arachne"`).
	 * Written as object-level `wall_generator` via exporter `customProjectSetting`.
	 * Omit → inherit artifact-level `ObjPrintConfig.wallGenerator` (else host `"classic"`).
	 */
	wallGenerator?: ExportWallGenerator;
	/**
	 * Optional per-plate top shell layers (non-negative integer string).
	 * Written as object-level `top_shell_layers` via exporter `customProjectSetting`.
	 * Omit → inherit artifact-level `ObjPrintConfig.topShellLayers` (else omit).
	 */
	topShellLayers?: string;
	/**
	 * Optional per-plate top shell thickness in mm (non-negative decimal string).
	 * Written as object-level `top_shell_thickness` via exporter `customProjectSetting`.
	 * Omit → inherit artifact-level `ObjPrintConfig.topShellThickness` (else omit).
	 */
	topShellThickness?: string;
	/**
	 * Optional per-plate enable support (`"0"` | `"1"`).
	 * Written as object-level `enable_support` via exporter `customProjectSetting`.
	 * Omit → inherit artifact-level `ObjPrintConfig.enableSupport` (else omit).
	 */
	enableSupport?: "0" | "1";
	/**
	 * Arbitrary Studio project-setting keys (typically snake_case) forwarded as-is.
	 * Prefer documented camelCase fields when available.
	 */
	[key: string]: any;
}
/**
 * OBJ → 3MF print settings.
 *
 * Known camelCase fields are validated and mapped by the host; any additional
 * snake_case Studio project-setting keys are forwarded as-is via `projectSetting`
 * so new parameters do not require a protocol / host release.
 */
export interface ObjPrintConfig {
	/**
	 * Optional layer height enum string (`"0.06"` … `"0.56"`, e.g. `"0.2"`).
	 * Aligns with `Gen3mfPrintConfig.layerHeight`; written as `layer_height` in 3MF project settings.
	 * Pass a string from `EXPORT_LAYER_HEIGHT`, not a number — other values are rejected by schema.
	 * Omit to leave the printer preset default unchanged.
	 */
	layerHeight?: ExportLayerHeight;
	/**
	 * Optional sparse infill density (`0%`–`100%`), written as `sparse_infill_density`.
	 * When set to `"100%"` without `sparseInfillPattern`, host defaults to `"alignedrectilinear"`.
	 */
	sparseInfillDensity?: string;
	/**
	 * Optional sparse infill pattern, written as `sparse_infill_pattern`.
	 * Recommended `"alignedrectilinear"` at `"100%"` density; omitted → host uses that default.
	 */
	sparseInfillPattern?: ExportSparseInfillPattern;
	/**
	 * Optional wall generator (`"classic"` | `"arachne"`), written as `wall_generator`.
	 * Omit → host keeps legacy default `"classic"`.
	 * Also the default for `plates[]` entries that omit `wallGenerator`.
	 */
	wallGenerator?: ExportWallGenerator;
	/**
	 * Optional top shell layers (non-negative integer string, e.g. `"0"`, `"3"`).
	 * Written as `top_shell_layers`. Also the default for `plates[]` that omit `topShellLayers`.
	 */
	topShellLayers?: string;
	/**
	 * Optional top shell thickness in mm (non-negative decimal string, e.g. `"0.6"`, `"1.0"`).
	 * Written as `top_shell_thickness`. Also the default for `plates[]` that omit `topShellThickness`.
	 */
	topShellThickness?: string;
	/**
	 * Optional enable support (`"0"` | `"1"`), written as exporter `enable_support`.
	 * Omit → supports remain off (exporter default).
	 * Also the default for `plates[]` entries that omit `enableSupport`.
	 */
	enableSupport?: "0" | "1";
	/**
	 * Optional per-plate overrides. When present, length must equal plate count
	 * (`buffer.length` for `ArrayBuffer[]`, otherwise `1`).
	 */
	plates?: ObjPlatePrintConfig[];
	/**
	 * Optional prime (wipe) tower X position in mm, written as `wipe_tower_x`.
	 * Single value applies to every plate; array index aligns with `buffer` plates
	 * (shorter arrays fall back to the first value, extra items are ignored).
	 */
	wipe_tower_x?: string | number | Array<string | number>;
	/**
	 * Optional prime (wipe) tower Y position in mm, written as `wipe_tower_y`.
	 * Same per-plate rules as `wipe_tower_x`. When set, the exporter skips its
	 * color-count based auto-adjustment of the tower Y position.
	 */
	wipe_tower_y?: string | number | Array<string | number>;
	/**
	 * Arbitrary Studio project-setting keys (typically snake_case) forwarded as-is.
	 * Prefer documented camelCase fields when available.
	 */
	[key: string]: any;
}
export interface ObjArtifact extends BaseArtifact {
	format: "obj";
	/** Single ArrayBuffer for single-plate OBJ; ArrayBuffer[] for multi-plate (each element = one plate) */
	buffer: ArrayBuffer | ArrayBuffer[];
	/**
	 * Optional MTL (Material Template Library) text content.
	 * Defines material colors for each `usemtl` reference in the OBJ file.
	 * Only `Kd` (diffuse color) is supported — texture maps are not supported.
	 * Each color region in the OBJ should be a separate `o` object with its own `usemtl`.
	 * Recommended maximum of 16 materials (matching AMS filament slots).
	 */
	mtl?: string;
	/**
	 * 是否强制将所有 mesh 合并为单个对象导出（对应 3MF 的 `useMergedObject`）。
	 * 默认 `false`；为 `true` 时无视 mesh 数量直接启用合并模式。
	 */
	mergeObj?: boolean;
	/**
	 * Optional OBJ → 3MF options. Omit entirely to keep printer / exporter defaults.
	 */
	printConfig?: ObjPrintConfig;
}
/**
 * Input artifact accepted by SDK export helpers.
 * Discriminated union keyed on `format` — constrains `buffer` type per format.
 */
export type ExportArtifactInput = StlArtifact | ZipArtifact | ObjArtifact;
export type ExportResult = {
	success: true;
	format: DownloadFormat;
} | {
	success: false;
	errorCode: string;
	errorMessage?: string;
};
/**
 * Base options shared by all SDK dialog helpers.
 * @property title - Dialog title text.
 * @property content - Dialog body content.
 * @property variant - Dialog variant to display.
 * @property confirmText - Optional confirm button label override.
 * @property cancelText - Optional cancel button label override.
 */
export interface DialogOptions {
	title: string;
	content: string;
	variant?: DialogVariant;
	confirmText?: string;
	cancelText?: string;
}
/**
 * Options for alert dialogs.
 * @property variant - Must be `alert`.
 */
export interface AlertDialogOptions extends Omit<DialogOptions, "variant"> {
	variant: typeof DIALOG_VARIANT.ALERT;
}
/**
 * Options for confirm dialogs.
 * @property variant - Must be `confirm`.
 */
export interface ConfirmDialogOptions extends Omit<DialogOptions, "variant"> {
	variant: typeof DIALOG_VARIANT.CONFIRM;
}
/**
 * Result returned by alert dialogs.
 * @property variant - Always `alert`.
 * @property confirmed - Whether the user explicitly confirmed the dialog.
 * @property reason - Why the dialog was closed.
 */
export interface AlertResult {
	variant: typeof DIALOG_VARIANT.ALERT;
	confirmed: boolean;
	reason: AlertResultReason;
}
/**
 * Result returned by confirm dialogs.
 * @property variant - Always `confirm`.
 * @property confirmed - Whether the user confirmed the dialog.
 * @property reason - Why the dialog was closed.
 */
export interface ConfirmResult {
	variant: typeof DIALOG_VARIANT.CONFIRM;
	confirmed: boolean;
	reason: DialogResultReason;
}
export type DialogResult = AlertResult | ConfirmResult;
declare const generatorFunctionDiscountConfigSchema: z.ZodObject<{
	/** 折扣开始时间，Unix 秒 */
	startTime: z.ZodNumber;
	/** 折扣结束时间，Unix 秒 */
	endTime: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
	startTime: number;
	endTime: number;
}, {
	startTime: number;
	endTime: number;
}>;
declare const generatorFunctionPaymentSchema: z.ZodObject<{
	functionKey: z.ZodString;
	functionName: z.ZodString;
	/** 原价的币种展示信息（含偏好币种） */
	originPriceDisplay: z.ZodObject<{
		origin: z.ZodObject<{
			amount: z.ZodNumber;
			currency: z.ZodString;
			currencySign: z.ZodString;
		}, "strip", z.ZodTypeAny, {
			amount: number;
			currency: string;
			currencySign: string;
		}, {
			amount: number;
			currency: string;
			currencySign: string;
		}>;
		preference: z.ZodOptional<z.ZodObject<{
			amount: z.ZodNumber;
			currency: z.ZodString;
			currencySign: z.ZodString;
		}, "strip", z.ZodTypeAny, {
			amount: number;
			currency: string;
			currencySign: string;
		}, {
			amount: number;
			currency: string;
			currencySign: string;
		}>>;
	}, "strip", z.ZodTypeAny, {
		origin: {
			amount: number;
			currency: string;
			currencySign: string;
		};
		preference?: {
			amount: number;
			currency: string;
			currencySign: string;
		} | undefined;
	}, {
		origin: {
			amount: number;
			currency: string;
			currencySign: string;
		};
		preference?: {
			amount: number;
			currency: string;
			currencySign: string;
		} | undefined;
	}>;
	/** 折扣价的币种展示信息（含偏好币种） */
	discountPriceDisplay: z.ZodObject<{
		origin: z.ZodObject<{
			amount: z.ZodNumber;
			currency: z.ZodString;
			currencySign: z.ZodString;
		}, "strip", z.ZodTypeAny, {
			amount: number;
			currency: string;
			currencySign: string;
		}, {
			amount: number;
			currency: string;
			currencySign: string;
		}>;
		preference: z.ZodOptional<z.ZodObject<{
			amount: z.ZodNumber;
			currency: z.ZodString;
			currencySign: z.ZodString;
		}, "strip", z.ZodTypeAny, {
			amount: number;
			currency: string;
			currencySign: string;
		}, {
			amount: number;
			currency: string;
			currencySign: string;
		}>>;
	}, "strip", z.ZodTypeAny, {
		origin: {
			amount: number;
			currency: string;
			currencySign: string;
		};
		preference?: {
			amount: number;
			currency: string;
			currencySign: string;
		} | undefined;
	}, {
		origin: {
			amount: number;
			currency: string;
			currencySign: string;
		};
		preference?: {
			amount: number;
			currency: string;
			currencySign: string;
		} | undefined;
	}>;
	/** 折扣时间窗（恒有；无折扣时为 `0/0`） */
	discountConfig: z.ZodObject<{
		/** 折扣开始时间，Unix 秒 */
		startTime: z.ZodNumber;
		/** 折扣结束时间，Unix 秒 */
		endTime: z.ZodNumber;
	}, "strip", z.ZodTypeAny, {
		startTime: number;
		endTime: number;
	}, {
		startTime: number;
		endTime: number;
	}>;
	/** 是否使用折扣价（host 已算好） */
	useDiscount: z.ZodBoolean;
	/** 当前用户是否已拥有该功能点 */
	owned: z.ZodBoolean;
	/**
	 * 商业版许可范围富文本（HTML）。
	 * 仅商家版功能点（如 `commercial_eeee`）有内容；其余功能点为空串或不下发。
	 * 列表接口不下发，仅详情 → host 透传。
	 */
	permissionScope: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
	functionKey: string;
	functionName: string;
	originPriceDisplay: {
		origin: {
			amount: number;
			currency: string;
			currencySign: string;
		};
		preference?: {
			amount: number;
			currency: string;
			currencySign: string;
		} | undefined;
	};
	discountPriceDisplay: {
		origin: {
			amount: number;
			currency: string;
			currencySign: string;
		};
		preference?: {
			amount: number;
			currency: string;
			currencySign: string;
		} | undefined;
	};
	discountConfig: {
		startTime: number;
		endTime: number;
	};
	useDiscount: boolean;
	owned: boolean;
	permissionScope?: string | undefined;
}, {
	functionKey: string;
	functionName: string;
	originPriceDisplay: {
		origin: {
			amount: number;
			currency: string;
			currencySign: string;
		};
		preference?: {
			amount: number;
			currency: string;
			currencySign: string;
		} | undefined;
	};
	discountPriceDisplay: {
		origin: {
			amount: number;
			currency: string;
			currencySign: string;
		};
		preference?: {
			amount: number;
			currency: string;
			currencySign: string;
		} | undefined;
	};
	discountConfig: {
		startTime: number;
		endTime: number;
	};
	useDiscount: boolean;
	owned: boolean;
	permissionScope?: string | undefined;
}>;
declare const generatorPaymentInfoSchema: z.ZodObject<{
	/** free 免费 | partial_buyout 部分买断 | full_buyout 整体买断 */
	membershipType: z.ZodEnum<[
		"free",
		"partial_buyout",
		"full_buyout"
	]>;
	/** 用户整体权益状态 unpurchased | partial_buyout | full_buyout */
	status: z.ZodEnum<[
		"unpurchased",
		"partial_buyout",
		"full_buyout"
	]>;
	functions: z.ZodArray<z.ZodObject<{
		functionKey: z.ZodString;
		functionName: z.ZodString;
		/** 原价的币种展示信息（含偏好币种） */
		originPriceDisplay: z.ZodObject<{
			origin: z.ZodObject<{
				amount: z.ZodNumber;
				currency: z.ZodString;
				currencySign: z.ZodString;
			}, "strip", z.ZodTypeAny, {
				amount: number;
				currency: string;
				currencySign: string;
			}, {
				amount: number;
				currency: string;
				currencySign: string;
			}>;
			preference: z.ZodOptional<z.ZodObject<{
				amount: z.ZodNumber;
				currency: z.ZodString;
				currencySign: z.ZodString;
			}, "strip", z.ZodTypeAny, {
				amount: number;
				currency: string;
				currencySign: string;
			}, {
				amount: number;
				currency: string;
				currencySign: string;
			}>>;
		}, "strip", z.ZodTypeAny, {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		}, {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		}>;
		/** 折扣价的币种展示信息（含偏好币种） */
		discountPriceDisplay: z.ZodObject<{
			origin: z.ZodObject<{
				amount: z.ZodNumber;
				currency: z.ZodString;
				currencySign: z.ZodString;
			}, "strip", z.ZodTypeAny, {
				amount: number;
				currency: string;
				currencySign: string;
			}, {
				amount: number;
				currency: string;
				currencySign: string;
			}>;
			preference: z.ZodOptional<z.ZodObject<{
				amount: z.ZodNumber;
				currency: z.ZodString;
				currencySign: z.ZodString;
			}, "strip", z.ZodTypeAny, {
				amount: number;
				currency: string;
				currencySign: string;
			}, {
				amount: number;
				currency: string;
				currencySign: string;
			}>>;
		}, "strip", z.ZodTypeAny, {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		}, {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		}>;
		/** 折扣时间窗（恒有；无折扣时为 `0/0`） */
		discountConfig: z.ZodObject<{
			/** 折扣开始时间，Unix 秒 */
			startTime: z.ZodNumber;
			/** 折扣结束时间，Unix 秒 */
			endTime: z.ZodNumber;
		}, "strip", z.ZodTypeAny, {
			startTime: number;
			endTime: number;
		}, {
			startTime: number;
			endTime: number;
		}>;
		/** 是否使用折扣价（host 已算好） */
		useDiscount: z.ZodBoolean;
		/** 当前用户是否已拥有该功能点 */
		owned: z.ZodBoolean;
		/**
		 * 商业版许可范围富文本（HTML）。
		 * 仅商家版功能点（如 `commercial_eeee`）有内容；其余功能点为空串或不下发。
		 * 列表接口不下发，仅详情 → host 透传。
		 */
		permissionScope: z.ZodOptional<z.ZodString>;
	}, "strip", z.ZodTypeAny, {
		functionKey: string;
		functionName: string;
		originPriceDisplay: {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		};
		discountPriceDisplay: {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		};
		discountConfig: {
			startTime: number;
			endTime: number;
		};
		useDiscount: boolean;
		owned: boolean;
		permissionScope?: string | undefined;
	}, {
		functionKey: string;
		functionName: string;
		originPriceDisplay: {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		};
		discountPriceDisplay: {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		};
		discountConfig: {
			startTime: number;
			endTime: number;
		};
		useDiscount: boolean;
		owned: boolean;
		permissionScope?: string | undefined;
	}>, "many">;
	/**
	 * 当前周期导出配额。来自已验签的 membership `exportQuota`。
	 * 没有导出配额时不下发。不限制时 `remaining` / `limit` 为 `999999`。
	 */
	exportQuota: z.ZodOptional<z.ZodObject<{
		remaining: z.ZodNumber;
		resetAt: z.ZodNumber;
		limit: z.ZodNumber;
		period: z.ZodEnum<[
			"day",
			"week",
			"month",
			""
		]>;
	}, "strip", z.ZodTypeAny, {
		remaining: number;
		resetAt: number;
		limit: number;
		period: "" | "day" | "week" | "month";
	}, {
		remaining: number;
		resetAt: number;
		limit: number;
		period: "" | "day" | "week" | "month";
	}>>;
}, "strip", z.ZodTypeAny, {
	status: "partial_buyout" | "full_buyout" | "unpurchased";
	membershipType: "free" | "partial_buyout" | "full_buyout";
	functions: {
		functionKey: string;
		functionName: string;
		originPriceDisplay: {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		};
		discountPriceDisplay: {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		};
		discountConfig: {
			startTime: number;
			endTime: number;
		};
		useDiscount: boolean;
		owned: boolean;
		permissionScope?: string | undefined;
	}[];
	exportQuota?: {
		remaining: number;
		resetAt: number;
		limit: number;
		period: "" | "day" | "week" | "month";
	} | undefined;
}, {
	status: "partial_buyout" | "full_buyout" | "unpurchased";
	membershipType: "free" | "partial_buyout" | "full_buyout";
	functions: {
		functionKey: string;
		functionName: string;
		originPriceDisplay: {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		};
		discountPriceDisplay: {
			origin: {
				amount: number;
				currency: string;
				currencySign: string;
			};
			preference?: {
				amount: number;
				currency: string;
				currencySign: string;
			} | undefined;
		};
		discountConfig: {
			startTime: number;
			endTime: number;
		};
		useDiscount: boolean;
		owned: boolean;
		permissionScope?: string | undefined;
	}[];
	exportQuota?: {
		remaining: number;
		resetAt: number;
		limit: number;
		period: "" | "day" | "week" | "month";
	} | undefined;
}>;
export type GeneratorFunctionDiscountConfig = z.infer<typeof generatorFunctionDiscountConfigSchema>;
export type GeneratorFunctionPayment = z.infer<typeof generatorFunctionPaymentSchema>;
export type GeneratorPaymentInfo = z.infer<typeof generatorPaymentInfoSchema>;
declare const displayCurrencyAmountSchema: z.ZodObject<{
	amount: z.ZodNumber;
	currency: z.ZodString;
	currencySign: z.ZodString;
}, "strip", z.ZodTypeAny, {
	amount: number;
	currency: string;
	currencySign: string;
}, {
	amount: number;
	currency: string;
	currencySign: string;
}>;
declare const displayPriceSchema: z.ZodObject<{
	origin: z.ZodObject<{
		amount: z.ZodNumber;
		currency: z.ZodString;
		currencySign: z.ZodString;
	}, "strip", z.ZodTypeAny, {
		amount: number;
		currency: string;
		currencySign: string;
	}, {
		amount: number;
		currency: string;
		currencySign: string;
	}>;
	preference: z.ZodOptional<z.ZodObject<{
		amount: z.ZodNumber;
		currency: z.ZodString;
		currencySign: z.ZodString;
	}, "strip", z.ZodTypeAny, {
		amount: number;
		currency: string;
		currencySign: string;
	}, {
		amount: number;
		currency: string;
		currencySign: string;
	}>>;
}, "strip", z.ZodTypeAny, {
	origin: {
		amount: number;
		currency: string;
		currencySign: string;
	};
	preference?: {
		amount: number;
		currency: string;
		currencySign: string;
	} | undefined;
}, {
	origin: {
		amount: number;
		currency: string;
		currencySign: string;
	};
	preference?: {
		amount: number;
		currency: string;
		currencySign: string;
	} | undefined;
}>;
export type DisplayCurrencyAmount = z.infer<typeof displayCurrencyAmountSchema>;
export type DisplayPrice = z.infer<typeof displayPriceSchema>;
/**
 * Application context provided after successful handshake.
 * Contains granted capabilities and runtime flags.
 * @property capabilities - The capabilities granted to the app by the host.
 * @property appId - The unique identifier of the app.
 * @property devMode - Whether the app is running in development mode.
 * @property payment - Read-only payment snapshot delivered by the host at handshake time (required).
 *   Free generators use `membershipType: 'free'` with zero prices. After a successful
 *   `requestAccess`, the app SDK folds the returned membership back into this snapshot; when the
 *   membership changes outside the app (e.g. a host UI purchase) the host pushes `MEMBERSHIP_UPDATE`
 *   and the SDK re-syncs it. Apps read it via `sdk.context.payment` / `sdk.isUnlocked(key)` and
 *   re-render on `onPaymentChange` rather than maintaining their own copy.
 */
export interface AppContext {
	capabilities: Capability[];
	appId: string;
	devMode: boolean;
	payment: GeneratorPaymentInfo;
}
/**
 * Bridge-level options for initializing the SDK client.
 * The app SDK re-exports a refined `InitOptions` that overrides `onReady` with the public context type.
 * @property timeout - Handshake timeout in milliseconds. Use `0` to disable timeout handling.
 * @property onReady - Callback invoked after the bridge handshake succeeds.
 * @property onDisconnect - Callback invoked when the host connection is lost.
 * @property onError - Callback invoked when the SDK encounters an error.
 */
export interface BridgeInitOptions {
	timeout?: number;
	onReady?: (ctx: AppContext) => void;
	onDisconnect?: () => void;
	onError?: (error: Error) => void;
}
declare const SDK_STATE: {
	readonly IDLE: "idle";
	readonly INITIALIZING: "initializing";
	readonly READY: "ready";
	readonly DISCONNECTED: "disconnected";
	readonly DESTROYED: "destroyed";
};
export type SDKState = (typeof SDK_STATE)[keyof typeof SDK_STATE];
/**
 * Host-verified membership returned to the embedded app on successful access.
 * Every non-success outcome rejects.
 */
export type AccessResult = MembershipResult;
/**
 * Toast options for SDK users.
 */
export interface ToastParams {
	/** The message content shown in the toast UI. */
	message: string;
	/** Optional toast variant. Invalid values fall back to `info`. */
	type?: ToastType;
	/** Optional display duration in milliseconds. */
	duration?: number;
}
/**
 * Public subset of `AppContext` exposed to app code.
 */
export type PublicAppContext = AppContext;
/**
 * Where a payment snapshot change came from.
 * - `host`: the host pushed a verified membership (`MEMBERSHIP_UPDATE`), e.g. a purchase from host UI
 *   or a membership recheck before export.
 * - `requestAccess`: the app's own `requestAccess` succeeded.
 */
export type PaymentChangeSource = "host" | "requestAccess";
/**
 * Payload of `InitOptions.onPaymentChange`.
 * @property payment - The latest frozen snapshot (same object as `sdk.context.payment`).
 * @property changedKeys - Short function keys whose `owned` flag changed; empty when only the
 *   aggregate `status` changed.
 * @property source - The `PaymentChangeSource` that produced this change.
 */
export interface PaymentChangeEvent {
	payment: Readonly<GeneratorPaymentInfo>;
	changedKeys: string[];
	source: PaymentChangeSource;
}
/**
 * SDK-level init options. Overrides `onReady` to receive the immutable public app context.
 * @property onPaymentChange - Optional callback invoked post-init when a function's `owned` flag or
 *   the aggregate `status` changes (host push or own `requestAccess`). Not invoked for the handshake
 *   snapshot, failed verification, cancelled / failed payments, stale (earlier-issued) memberships,
 *   or `exportQuota`-only changes (still synced into `context.payment`, but the host owns quota
 *   display and gating).
 */
export type InitOptions = Omit<BridgeInitOptions, "onReady"> & {
	onReady?: (ctx: Readonly<PublicAppContext>) => void;
	onPaymentChange?: (event: PaymentChangeEvent) => void;
};
/**
 * SDK factory options (production).
 */
export interface CreateSDKOptions {
	/** Application identifier registered in MakerLab host. */
	appId: string;
}
/**
 * Public MakerLab App SDK API surface.
 */
export interface MakerLabSDK {
	/**
	 * Initialize the SDK and establish a connection with the host runtime.
	 *
	 * @param options - Optional `InitOptions` used to control the handshake lifecycle.
	 * @param options.timeout - Optional handshake timeout in milliseconds. Use `0` to disable timeout handling.
	 * @param options.onReady - Optional callback invoked after the SDK enters the ready state.
	 * @param options.onDisconnect - Optional callback invoked after the heartbeat watchdog marks the host as disconnected.
	 * @param options.onError - Optional callback invoked when the SDK surfaces an asynchronous runtime error.
	 * @returns The granted app context from the host.
	 */
	init: (options?: InitOptions) => Promise<Readonly<PublicAppContext>>;
	/**
	 * Request the host to export one or more artifacts.
	 *
	 * @param options - The `ExportOptions` payload for the export request.
	 * @param options.artifacts - The `ExportArtifactInput[]` collection to export.
	 * @param options.printerType - Optional target printer category (`'2D'` | `'3D'`). Defaults to `'3D'`. When `'2D'`, the host skips the FDM printer selection panel.
	 * @param options.printer - Optional preset printer model (e.g. `'X1C'`). When `printer` and `nozzle` are both valid, the host skips the printer selection panel; invalid values fall back to the panel.
	 * @param options.nozzle - Optional preset nozzle diameter in mm (`0.4` | `0.2`). See `options.printer`.
	 * @param options.printerIncludeList - Optional whitelist of printers shown in the selection panel; takes precedence over `printerExcludeList`.
	 * @param options.printerExcludeList - Optional blacklist of printers hidden from the selection panel.
	 * @param options.artifacts[].fileName - Suggested output file name for the artifact.
	 * @param options.artifacts[].format - Artifact serialization format: `stl`, `obj`, or `zip`.
	 * @param options.artifacts[].buffer - Binary content. STL/ZIP: single `ArrayBuffer`; OBJ: `ArrayBuffer` (single-plate) or `ArrayBuffer[]` (multi-plate).
	 * @param options.artifacts[].description - Optional human-readable artifact description.
	 * @param options.artifacts[].coverImage - Base64 data URL used as the artifact cover image.
	 * @param options.artifacts[].mtl - Optional MTL text for OBJ format only. Defines `Kd` diffuse colors per material; each color region should be a separate `o` object in OBJ.
	 * @param options.artifacts[].mergeObj - Optional boolean for OBJ format only. Force merge OBJ meshes into a single object.
	 * @param options.artifacts[].printConfig - Optional OBJ → 3MF print settings.
	 * @param options.artifacts[].printConfig.layerHeight - Optional layer height enum string (`"0.06"`…`"0.56"`, e.g. `"0.2"`); not a number.
	 * @param options.artifacts[].printConfig.sparseInfillDensity - Optional sparse infill density (`0%`–`100%`).
	 * @param options.artifacts[].printConfig.sparseInfillPattern - Optional sparse infill pattern enum value.
	 * @param options.artifacts[].printConfig.wallGenerator - Optional wall generator (`"classic"` | `"arachne"`); omit → host default `"classic"`.
	 * @param options.artifacts[].printConfig.topShellLayers - Optional top shell layers (non-negative integer string); written as `top_shell_layers`.
	 * @param options.artifacts[].printConfig.topShellThickness - Optional top shell thickness in mm (non-negative decimal string); written as `top_shell_thickness`.
	 * @param options.artifacts[].printConfig.enableSupport - Optional enable support (`"0"` | `"1"`); written as exporter `enable_support`.
	 * @param options.artifacts[].printConfig.plates - Optional per-plate overrides; when present, length must equal plate count.
	 * @param options.artifacts[].printConfig.[key] - Additional snake_case Studio project-setting keys are forwarded as-is.
	 * @returns The host export result.
	 */
	export: (options: ExportOptions) => Promise<ExportResult>;
	/**
	 * Show a host-managed toast notification.
	 *
	 * @param options - The `ToastParams` payload for the toast request.
	 * @param options.message - The toast message content shown by the host.
	 * @param options.type - Optional toast severity such as `success`, `info`, `warning`, or `error`.
	 * @param options.duration - Optional display duration in milliseconds.
	 */
	toast: (options: ToastParams) => Promise<void>;
	/**
	 * Open a host-managed dialog.
	 *
	 * @param options - The `DialogOptions | AlertDialogOptions | ConfirmDialogOptions` request payload.
	 * @param options.title - The dialog title text.
	 * @param options.content - The dialog body content.
	 * @param options.variant - Optional dialog variant; `alert` or `confirm`.
	 * @param options.confirmText - Optional override for the confirm button label.
	 * @param options.cancelText - Optional override for the cancel button label.
	 * @returns The dialog result returned by the host.
	 */
	dialog(options: Omit<AlertDialogOptions, "variant">): Promise<AlertResult>;
	dialog(options: AlertDialogOptions): Promise<AlertResult>;
	dialog(options: ConfirmDialogOptions): Promise<ConfirmResult>;
	dialog(options: DialogOptions): Promise<DialogResult>;
	/**
	 * Open a Buy Me a Coffee creator page in a new browser tab.
	 * The creator identifier is configured on the host side via `AppRegistryEntry.buyMeACoffeeId`.
	 */
	buyMeACoffee: () => Promise<void>;
	/**
	 * Request access to a paid capability. This is the single entry point for the
	 * payment / anti-piracy flow: the host runtime performs the full
	 * check → verify → pay → recheck orchestration, and the SDK consumes the
	 * host-verified result.
	 *
	 * @param scope - The `AccessScope` (the paid function-point key, backend `function_key`).
	 * @returns The host-verified signed membership when access is granted.
	 * @throws {BridgeError} When the user is unpaid, cancels, payment fails, or verification fails.
	 */
	requestAccess: (scope: AccessScope) => Promise<AccessResult>;
	/**
	 * Presentational access check against the **current** payment snapshot.
	 *
	 * 用于首屏/渲染时判断「是否把付费功能显示为已解锁 / 是否展示付费墙」。它读取
	 * SDK 内部维护的最新 `context.payment` 快照——`requestAccess` 成功或宿主推送权益变更
	 * （如在宿主顶栏购买）时，SDK 都会按已验签权益整体同步 `status` 与各功能点 `owned`，
	 * 因此支付完成后再次调用会返回 `true`（无需 app 自己维护状态）。快照变化时会触发
	 * `InitOptions.onPaymentChange`，app 可据此重新渲染。
	 *
	 * 判定只看该功能点是否 `owned`，不看 `status`。
	 *
	 * ⚠️ 这只是展示判断，**不是安全门禁**。真正放行必须走 `requestAccess`
	 * （由 Host 验签与授权；SDK 侧验签所用公钥随消息下发，只能挡住空签名，挡不住自签名）。
	 *
	 * @param functionKey - The paid function-point key (backend `function_key`).
	 * @returns `true` when the feature should be shown as unlocked; `false` before init.
	 */
	isUnlocked: (functionKey: string) => boolean;
	/** Dispose transport resources and mark the SDK as destroyed. */
	destroy: () => void;
	/** Current SDK lifecycle state. */
	readonly state: SDKState;
	/** Host app context after initialization, or `null` before init. */
	readonly context: Readonly<PublicAppContext> | null;
}
/**
 * Create a MakerLab App SDK instance.
 * Provides init, export, toast, dialog, buyMeACoffee, requestAccess, and
 * isUnlocked for third-party apps embedded via iframe.
 *
 * @param options - The `CreateSDKOptions` used to construct the SDK instance.
 * @param options.appId - The application identifier registered with the MakerLab host.
 * @returns A MakerLab SDK instance bound to the current iframe app.
 */
export declare function createMakerLabSDK(options: CreateSDKOptions): MakerLabSDK;

export {
	PublicAppContext as AppContext,
};

export {};

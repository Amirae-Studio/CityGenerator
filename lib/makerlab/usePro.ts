import { useCallback } from "react";
import { useMakerLab } from "./MakerLabProvider";
import { COMMERCIAL_KEY, PRO_KEY } from "./types";

export type Pro = {
  /** Pro can be bought here (running inside MakerLab, with pro_pack in the price catalog). */
  available: boolean;
  /**
   * Display only — drives locks, badges and upsells. True for City Generator
   * Pro owners and for commercial-license owners (the top plan includes
   * everything). Never a security check: use `unlock()` before each use.
   */
  owned: boolean;
  /** Which purchase gives the access, for wording ("Pro" / "Commercial"). */
  via: "pro" | "commercial" | null;
  price?: string;
  originalPrice?: string;
  /** requestAccess is in flight (payment window open). */
  busy: boolean;
  /**
   * Call before every use of a Pro feature; use the feature only if it
   * resolves true (Paid Features › Step 4).
   *
   * MakerLab never turns one feature into another, so the app decides which
   * entitlement to verify: a commercial-license owner is verified with
   * requestAccess("commercial_eeee"); everyone else with
   * requestAccess("pro_pack"), which opens the payment if they don't own it.
   * Either way the host checks the entitlement — nothing is unlocked from
   * local state.
   */
  unlock: () => Promise<boolean>;
};

/** City Generator Pro ($6), included in the commercial license. */
export function usePro(): Pro {
  const ml = useMakerLab();
  const pro = ml.paidFeature(PRO_KEY);
  const commercial = ml.paidFeature(COMMERCIAL_KEY);
  const via = pro?.owned ? "pro" : commercial?.owned ? "commercial" : null;
  const unlock = useCallback(
    () => ml.ensureAccess(via === "commercial" ? COMMERCIAL_KEY : PRO_KEY),
    [ml, via]
  );
  return {
    available: !!pro && ml.can("requestAccess"),
    owned: via !== null,
    via,
    price: pro?.price,
    originalPrice: pro?.originalPrice,
    busy: ml.busyKey === PRO_KEY || ml.busyKey === COMMERCIAL_KEY,
    unlock,
  };
}

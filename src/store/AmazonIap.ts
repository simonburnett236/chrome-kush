import type { PurchaseResult, PurchaseService } from "./PurchaseService";
import { ALL_PRODUCTS, productBySku } from "./products";
import { fulfill } from "./fulfill";
import type { Entitlements } from "./Entitlements";
import type { Wallet } from "../economy/Wallet";

// Amazon In-App Purchasing for Amazon Web Apps (same bridge BillBoss uses).
// Amazon injects window.AmazonIapV2 after the Web App API script loads.

const AMAZON_SCRIPT_URL = "https://resources.amazonwebapps.com/v1/latest/Amazon-Web-App-API.min.js";
const PROCESSED_KEY = "ck.iap.processed.v1";

type Json = Record<string, any>;

export interface AmazonIapApi {
  addListener: (eventName: string, listener: (event: unknown) => void) => void;
  [op: string]: any;
}

declare global {
  interface Window {
    AmazonIapV2?: AmazonIapApi | null;
    AmazonIapReady?: boolean;
  }
}

const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const resp = (e: unknown) => obj(obj(e).response ?? e);
const status = (r: Json) => String(r.status ?? r.purchaseRequestStatus ?? r.purchaseUpdatesRequestStatus ?? r.productDataRequestStatus ?? r.userDataRequestStatus ?? "").toUpperCase();

/** Load Amazon's script and wait briefly for the bridge. Resolves null off-Amazon. */
export function detectAmazonBridge(timeoutMs = 3500): Promise<AmazonIapApi | null> {
  if (window.AmazonIapV2) return Promise.resolve(window.AmazonIapV2);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = AMAZON_SCRIPT_URL;
    s.async = true;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    const started = Date.now();
    const poll = () => {
      if (window.AmazonIapV2) resolve(window.AmazonIapV2);
      else if (Date.now() - started > timeoutMs) resolve(null);
      else window.setTimeout(poll, 150);
    };
    poll();
  });
}

export class AmazonPurchaseService implements PurchaseService {
  readonly mode = "amazon" as const;
  private userId = "";
  private prices: Record<string, string> = {};
  private pending: ((r: PurchaseResult) => void) | null = null;
  private pendingSku = "";
  private restoreDone: ((owned: string[]) => void) | null = null;
  private restored: string[] = [];
  private processed: Set<string>;
  onUserId: (id: string) => void = () => {};

  constructor(private api: AmazonIapApi, private entitlements: Entitlements, private wallet: Wallet, private apiBase = "") {
    this.processed = new Set(JSON.parse(localStorage.getItem(PROCESSED_KEY) ?? "[]"));
    api.addListener("getUserDataResponse", (e) => {
      const r = resp(e);
      const id = obj(r.amazonUserData ?? r.userData).userId ?? r.userId;
      if (typeof id === "string" && id) {
        this.userId = id;
        this.onUserId(id);
      }
    });
    api.addListener("getProductDataResponse", (e) => {
      const data = obj(resp(e).productData);
      for (const [sku, p] of Object.entries(data)) if (obj(p).price) this.prices[sku] = String(obj(p).price);
    });
    api.addListener("purchaseResponse", (e) => void this.onPurchase(e));
    api.addListener("getPurchaseUpdatesResponse", (e) => void this.onUpdates(e));
    this.call("getUserData", null);
    this.call("getProductData", { skus: ALL_PRODUCTS.map((p) => p.sku) });
    this.call("getPurchaseUpdates", { reset: true });
  }

  /** Amazon Web App API: api.op(success, error, [options]). */
  private call(op: string, options: Json | null): void {
    const fn = this.api[op];
    if (typeof fn !== "function") return;
    try {
      fn.call(this.api, () => undefined, () => this.finish({ ok: false, reason: "error", message: "Amazon could not start that request." }), options ? [options] : []);
    } catch {
      this.finish({ ok: false, reason: "error", message: "Amazon billing is unavailable. Close and reopen the app." });
    }
  }

  private finish(r: PurchaseResult): void {
    const cb = this.pending;
    this.pending = null;
    cb?.(r);
  }

  priceFor(sku: string): string | undefined {
    return this.prices[sku];
  }

  purchase(sku: string): Promise<PurchaseResult> {
    if (this.pending) return Promise.resolve({ ok: false, reason: "error", message: "A purchase is already in progress." });
    return new Promise((resolve) => {
      this.pending = resolve;
      this.pendingSku = sku;
      this.call("purchase", { sku });
      window.setTimeout(() => {
        if (this.pending === resolve) this.finish({ ok: false, reason: "error", message: "Amazon did not respond. Try again." });
      }, 60_000);
    });
  }

  restore(): Promise<string[]> {
    return new Promise((resolve) => {
      this.restored = [];
      this.restoreDone = resolve;
      this.call("getPurchaseUpdates", { reset: true });
      window.setTimeout(() => this.restoreDone === resolve && this.endRestore(), 20_000);
    });
  }

  private endRestore(): void {
    const cb = this.restoreDone;
    this.restoreDone = null;
    cb?.(this.restored);
  }

  private async onPurchase(e: unknown): Promise<void> {
    const r = resp(e);
    const st = status(r);
    if (r.amazonUserData?.userId) this.userId = r.amazonUserData.userId;
    if (st === "SUCCESSFUL") {
      const ok = await this.handleReceipt(obj(r.receipt));
      this.finish(ok ? { ok: true, sku: this.pendingSku } : { ok: false, reason: "error", message: "We couldn't verify that purchase. Use Restore purchases." });
    } else if (st === "ALREADY_PURCHASED" || st === "ALREADY_ENTITLED") {
      this.call("getPurchaseUpdates", { reset: true });
      this.finish({ ok: true, sku: this.pendingSku });
    } else if (st === "PENDING") {
      this.finish({ ok: false, reason: "pending", message: "Amazon is waiting for approval." });
    } else {
      this.finish({ ok: false, reason: "cancelled" });
    }
  }

  private async onUpdates(e: unknown): Promise<void> {
    const r = resp(e);
    if (status(r) && status(r) !== "SUCCESSFUL") return this.endRestore();
    const receipts: unknown[] = Array.isArray(r.receipts) ? r.receipts : [];
    for (const rc of receipts) {
      const receipt = obj(rc);
      if (await this.handleReceipt(receipt)) this.restored.push(String(receipt.sku ?? receipt.termSku ?? ""));
    }
    if (r.hasMore === true || r.isMore === true) this.call("getPurchaseUpdates", { reset: false });
    else this.endRestore();
  }

  /** Verify a receipt with our Worker, grant it once, then tell Amazon it is fulfilled. */
  private async handleReceipt(receipt: Json): Promise<boolean> {
    const receiptId = String(receipt.receiptId ?? "");
    let sku = String(receipt.sku ?? "");
    if (!receiptId) return false;
    const product = productBySku(sku) ?? productBySku(String(receipt.termSku ?? ""));
    if (!product) return false;
    sku = product.sku;
    if (product.type === "consumable" && this.processed.has(receiptId)) return true;

    let verified: Json;
    try {
      const res = await fetch(`${this.apiBase}/api/iap/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: this.userId, receiptId }),
      });
      verified = await res.json();
    } catch {
      return false;
    }
    if (!verified.valid) return false;
    const cancelDate = Number(verified.cancelDate ?? receipt.cancelDate ?? 0);
    const cancelled = cancelDate > 0 && cancelDate < Date.now();
    if (!cancelled) {
      // Subscriptions: active until cancel date, otherwise re-checked on every launch.
      const until = product.type === "subscription" ? (cancelDate || Date.now() + 3 * 24 * 60 * 60 * 1000) : undefined;
      fulfill(sku, this.entitlements, this.wallet, until);
    }
    if (product.type === "consumable") {
      this.processed.add(receiptId);
      localStorage.setItem(PROCESSED_KEY, JSON.stringify([...this.processed]));
    }
    this.call("notifyFulfillment", { receiptId, fulfillmentResult: "FULFILLED" });
    return !cancelled;
  }
}

import { BOOSTERS, ECONOMY, MIN_AGE, type BoosterId } from "../config";
import { Daily, SPIN_PRIZES, type Reward } from "../economy/Daily";

export interface ButtonDef {
  id: string;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}

/** Generic modal. body may be a string (text) or an element. Resolves with button id. */
export function modal(title: string, body: string | HTMLElement, buttons: ButtonDef[], opts: { dismissable?: boolean } = {}): Promise<string> {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    const card = document.createElement("div");
    card.className = "modal";
    const h = document.createElement("h2");
    h.textContent = title;
    card.appendChild(h);
    if (typeof body === "string") {
      const p = document.createElement("p");
      p.textContent = body;
      card.appendChild(p);
    } else card.appendChild(body);
    const row = document.createElement("div");
    row.className = "modal-buttons";
    for (const b of buttons) {
      const btn = document.createElement("button");
      btn.className = `btn${b.primary ? " primary" : ""}`;
      btn.textContent = b.label;
      btn.disabled = !!b.disabled;
      btn.addEventListener("click", () => {
        wrap.remove();
        resolve(b.id);
      });
      row.appendChild(btn);
    }
    card.appendChild(row);
    wrap.appendChild(card);
    if (opts.dismissable) wrap.addEventListener("click", (e) => e.target === wrap && (wrap.remove(), resolve("dismiss")));
    document.body.appendChild(wrap);
  });
}

export function el(html: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

export function fmtTime(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** First-launch age gate (mature theme). */
export async function ageGate(): Promise<boolean> {
  if (localStorage.getItem("ck.ageOk") === "1") return true;
  const choice = await modal(
    "Adults only",
    `Chrome Kush has a mature, cannabis-themed cartoon setting. It is a game only: nothing is for sale and no real products are promoted. You must be ${MIN_AGE} or older to play.`,
    [
      { id: "no", label: `I'm under ${MIN_AGE}` },
      { id: "yes", label: `I'm ${MIN_AGE} or older`, primary: true },
    ],
  );
  if (choice === "yes") localStorage.setItem("ck.ageOk", "1");
  return choice === "yes";
}

/** Pre-level screen: goal plus pre-game booster toggles. Resolves chosen boosters or null. */
export async function preLevel(level: { id: number; faction: string; targetScore: number; moves: number }, stock: Record<BoosterId, number>): Promise<BoosterId[] | null> {
  const pre = (Object.keys(BOOSTERS) as BoosterId[]).filter((id) => BOOSTERS[id].when === "pre");
  const body = el(`
    <p class="faction-sm">${level.faction}</p>
    <p>Score <strong>${level.targetScore}</strong> in <strong>${level.moves}</strong> moves.</p>
    <p class="lbl">Pre-game boosters</p>
    <div class="booster-pick">${pre
      .map((id) => `<label class="pick ${stock[id] ? "" : "empty"}"><input type="checkbox" value="${id}" ${stock[id] ? "" : "disabled"}/>
        <span class="icon">${BOOSTERS[id].icon}</span><span>${BOOSTERS[id].name}</span><small>x${stock[id] ?? 0}</small></label>`)
      .join("")}</div>`);
  const choice = await modal(`Level ${level.id}`, body, [
    { id: "back", label: "Back" },
    { id: "play", label: "Play", primary: true },
  ]);
  if (choice !== "play") return null;
  return [...body.querySelectorAll<HTMLInputElement>("input:checked")].map((i) => i.value as BoosterId);
}

/** Daily login calendar: shows the 7-day track and day 30 milestone. */
export async function dailyCalendar(daily: Daily): Promise<Reward | null> {
  const streak = daily.state.streak;
  const weekStart = Math.floor((streak - 1) / 7) * 7 + 1;
  const days = Array.from({ length: 7 }, (_, i) => weekStart + i);
  const body = el(`
    <p>Day <strong>${streak}</strong> in a row. Score multiplier: <strong>x${daily.multiplier.toFixed(2)}</strong></p>
    <div class="calendar">${days
      .map((d) => `<div class="day ${d < streak ? "past" : d === streak ? "today" : ""} ${d % 7 === 0 ? "big" : ""}">
        <span>Day ${d}</span><small>${Daily.rewardForDay(d).label}</small></div>`)
      .join("")}</div>
    <p class="fine">Day 30: ${Daily.rewardForDay(30).label}. Miss a day and the streak resets.</p>`);
  const pending = daily.rewardPending;
  const choice = await modal("Daily reward", body, [pending ? { id: "claim", label: "Claim", primary: true } : { id: "close", label: "Come back tomorrow" }]);
  return choice === "claim" ? daily.claim() : null;
}

/** Lucky Spin wheel. Returns the prize index, or null if no spin was available. */
export function spinWheel(daily: Daily): Promise<number | null> {
  return new Promise((resolve) => {
    const n = SPIN_PRIZES.length;
    const size = 280;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.className = "wheel";
    const ctx = canvas.getContext("2d")!;
    const draw = (rot: number) => {
      ctx.clearRect(0, 0, size, size);
      for (let i = 0; i < n; i++) {
        const a0 = rot + (i / n) * Math.PI * 2;
        const a1 = rot + ((i + 1) / n) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(size / 2, size / 2);
        ctx.arc(size / 2, size / 2, size / 2 - 4, a0, a1);
        ctx.fillStyle = SPIN_PRIZES[i].color;
        ctx.fill();
        ctx.strokeStyle = "#e9c46a";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate((a0 + a1) / 2);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 13px Trebuchet MS";
        ctx.textAlign = "right";
        ctx.fillText(SPIN_PRIZES[i].reward.label, size / 2 - 14, 5);
        ctx.restore();
      }
    };
    draw(0);
    const wrapBody = el(`<div class="wheel-wrap"><div class="pointer"></div></div><p class="spin-result"></p>`);
    wrapBody.querySelector(".wheel-wrap")!.prepend(canvas);
    const available = daily.spinAvailable;
    const wrap = document.createElement("div");
    wrap.className = "modal-wrap";
    const card = document.createElement("div");
    card.className = "modal";
    card.innerHTML = `<h2>Lucky Spin</h2>`;
    card.appendChild(wrapBody);
    const btns = el(`<div class="modal-buttons"><button class="btn" data-a="close">Close</button>
      <button class="btn primary" data-a="spin" ${available ? "" : "disabled"}>${available ? "Spin (free)" : "Next free spin tomorrow"}</button></div>`);
    card.appendChild(btns);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    btns.querySelector('[data-a="close"]')!.addEventListener("click", () => {
      wrap.remove();
      resolve(null);
    });
    btns.querySelector('[data-a="spin"]')!.addEventListener("click", (e) => {
      (e.target as HTMLButtonElement).disabled = true;
      const idx = daily.spin();
      // Pointer is at the top (-90deg). Land the middle of slice idx under it.
      const sliceMid = ((idx + 0.5) / n) * Math.PI * 2;
      const target = -Math.PI / 2 - sliceMid + Math.PI * 2 * 6;
      const start = performance.now();
      const dur = 3500;
      const anim = (t: number) => {
        const k = Math.min(1, (t - start) / dur);
        draw(target * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(anim);
        else {
          wrap.remove();
          resolve(idx);
        }
      };
      requestAnimationFrame(anim);
    });
  });
}

export function boosterLabel(id: BoosterId): string {
  return BOOSTERS[id].name;
}

export const LIVES_REFILL_COINS = ECONOMY.livesRefillCoinPrice;

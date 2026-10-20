// หน้าตรวจสอบก่อนสั่ง + หน้าสั่งสำเร็จ (แสดงยอดโอนและบัญชีของร้าน)
import { h, mount, baht } from "../ui.js";

// "ส่งเมื่อพร้อม" = ไม่ระบุเวลา, หรือระบุเวลา HH:MM ของวันนี้ (เวลาไทย)
export function bangkokIso(hhmm, now = new Date()) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return null;
  const day = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
  const d = new Date(day + "T" + m[1] + ":" + m[2] + ":00+07:00");
  return isNaN(d) ? null : d.toISOString();
}

// เวลาเริ่มต้นของช่องเลือกเวลา: อีก ~15 นาทีข้างหน้า ปัดขึ้นเป็นช่วง 15 นาที (เวลาไทย)
export function defaultSlot(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(now.getTime() + 15 * 60 * 1000));
  let hh = Number(parts.find((p) => p.type === "hour").value) % 24;
  let mm = Math.ceil(Number(parts.find((p) => p.type === "minute").value) / 15) * 15;
  if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
  return { hh, mm };
}

export function renderCheckout({ api, root, cart, profile, onBack, onDone }) {
  const page = cart.page;
  const picked = page.items.filter((i) => cart.lines[i.id] > 0);
  const total = picked.reduce((s, i) => s + cart.lines[i.id] * Number(i.price), 0);

  // ---------- วิธีรับอาหาร ----------
  let mode = page.fulfillment === "pickup" ? "pickup" : "delivery";
  const modeBox = h("div", { class: "seg" });
  const addressBox = h("div", null);
  const addressInput = h("input", { class: "input", type: "text", maxlength: "200", placeholder: "บ้านเลขที่ / จุดรับของ" });
  addressInput.value = profile.house_no || "";
  addressBox.append(h("label", { class: "label", for: "addr" }, "ส่งที่"), addressInput);
  addressInput.id = "addr";

  function drawMode() {
    const btn = (value, label) => h("button", {
      type: "button", class: "seg-btn" + (mode === value ? " on" : ""), "aria-pressed": mode === value,
      onclick: () => { mode = value; drawMode(); }
    }, label);
    modeBox.replaceChildren(...(page.fulfillment === "both"
      ? [btn("delivery", "ส่งถึงบ้าน"), btn("pickup", "มารับเอง")]
      : [h("p", { class: "status" }, mode === "delivery" ? "ร้านนี้ส่งถึงบ้าน" : "ร้านนี้ให้มารับเอง")]));
    addressBox.hidden = mode !== "delivery";
  }
  drawMode();

  // ---------- เวลาส่ง ----------
  let timed = false;
  const pad = (n) => String(n).padStart(2, "0");
  const hourSel = h("select", { class: "input", id: "time-h", "aria-label": "ชั่วโมง" },
    Array.from({ length: 24 }, (_, i) => h("option", { value: pad(i) }, pad(i))));
  const minSel = h("select", { class: "input", id: "time-m", "aria-label": "นาที" },
    [0, 15, 30, 45].map((m) => h("option", { value: pad(m) }, pad(m))));
  const slot = defaultSlot();
  hourSel.value = pad(slot.hh); minSel.value = pad(slot.mm);
  const timeBox = h("div", { class: "time-row", hidden: true },
    hourSel, h("span", { class: "time-sep" }, ":"), minSel, h("span", { class: "time-unit" }, "น."));
  const timeSeg = h("div", { class: "seg" });
  function drawTime() {
    const btn = (value, label) => h("button", {
      type: "button", class: "seg-btn" + (timed === value ? " on" : ""), "aria-pressed": timed === value,
      onclick: () => { timed = value; drawTime(); }
    }, label);
    timeSeg.replaceChildren(btn(false, "เมื่อพร้อม"), btn(true, "เลือกเวลา"));
    timeBox.hidden = !timed;
  }
  drawTime();

  // ---------- ออปชั่นพิเศษรายรายการ ----------
  const noteInputs = new Map();
  const lines = picked.map((i) => {
    const note = h("input", { class: "input", type: "text", maxlength: "200", placeholder: "ออปชั่นพิเศษ เช่น เผ็ดน้อย (ไม่บังคับ)", "aria-label": "ออปชั่นพิเศษของ " + i.name });
    note.value = cart.notes[i.id] || "";
    noteInputs.set(i.id, note);
    return h("section", { class: "card" },
      h("div", { class: "item-head" }, h("h3", null, cart.lines[i.id] + " × " + i.name), h("span", { class: "price" }, baht(cart.lines[i.id] * Number(i.price)))),
      note);
  });

  const errorBox = h("p", { class: "field-error", role: "alert", hidden: true });
  const fixBtn = h("button", { class: "btn btn-secondary", type: "button", hidden: true, onclick: onBack }, "กลับไปแก้จำนวน");
  const confirmBtn = h("button", { class: "btn", type: "button" }, "ยืนยันสั่ง · " + baht(total));
  function showError(t) { errorBox.textContent = t; errorBox.hidden = false; }

  confirmBtn.addEventListener("click", async () => {
    errorBox.hidden = true; fixBtn.hidden = true;
    for (const i of picked) cart.notes[i.id] = noteInputs.get(i.id).value;
    let deliverAt = null;
    if (timed) {
      deliverAt = bangkokIso(hourSel.value + ":" + minSel.value);
      if (!deliverAt) { showError("กรุณาเลือกเวลาที่ต้องการให้ส่ง หรือเลือก \"เมื่อพร้อม\""); return; }
      if (new Date(deliverAt).getTime() < Date.now() - 5 * 60 * 1000) { showError("เวลานี้ผ่านไปแล้ว กรุณาเลือกเวลาใหม่"); return; }
    }
    if (mode === "delivery" && !addressInput.value.trim()) { showError("กรุณากรอกที่อยู่สำหรับส่ง"); return; }
    confirmBtn.disabled = true;
    confirmBtn.textContent = "กำลังส่งออเดอร์...";
    try {
      const result = await api.placeOrder({
        postId: page.postId,
        lines: picked.map((i) => ({ item_id: i.id, qty: cart.lines[i.id], note: (cart.notes[i.id] || "").trim() })),
        fulfillment: mode,
        address: mode === "delivery" ? addressInput.value.trim() : null,
        deliverAt
      });
      const payment = await api.getPaymentInfo(page.shopId).catch(() => null);
      onDone({ result, payment });
    } catch (e) {
      showError(e && e.friendly ? e.friendly : "สั่งอาหารไม่สำเร็จ กรุณาลองใหม่");
      if (e && e.tech === "place_order P0001") fixBtn.hidden = false; // เช่น ของเหลือไม่พอ: พากลับไปแก้จำนวนล่าสุด
      confirmBtn.disabled = false;
      confirmBtn.textContent = "ยืนยันสั่ง · " + baht(total);
    }
  });

  mount(root,
    h("button", { class: "back-link", type: "button", onclick: onBack }, "← แก้ไขรายการ"),
    h("h1", null, "ตรวจสอบก่อนสั่ง"),
    h("p", { class: "muted" }, page.shopName),
    lines,
    h("div", { class: "total-row" }, h("span", null, "ยอดรวม"), h("strong", null, baht(total))),
    h("h2", null, "รับอาหารแบบไหน"),
    modeBox, addressBox,
    h("h2", null, "เวลาส่ง (ไม่บังคับ)"),
    timeSeg, timeBox,
    errorBox,
    confirmBtn,
    fixBtn);
}

export function renderDone({ root, shopName, outcome, onHome }) {
  const { result, payment } = outcome;
  const copyMsg = h("p", { class: "muted", hidden: true });
  const parts = [
    h("h1", null, "สั่งอาหารเรียบร้อย"),
    h("p", null, h("span", { class: "badge badge-warn" }, "สถานะ: รอชำระเงิน")),
    h("p", { class: "status ok" }, "เลขออเดอร์ #" + result.order_no),
    h("p", null, shopName + " ได้รับออเดอร์ของคุณแล้ว"),
    h("div", { class: "total-row" }, h("span", null, "ยอดที่ต้องชำระ"), h("strong", null, baht(result.total))),
    h("h2", null, "ขั้นต่อไป: ชำระเงิน")
  ];
  if (payment && payment.account_no) {
    const copyBtn = h("button", { class: "btn btn-secondary", type: "button" }, "คัดลอกเลขบัญชี");
    copyBtn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(payment.account_no); copyMsg.textContent = "คัดลอกเลขบัญชีแล้ว"; }
      catch (e) { copyMsg.textContent = "คัดลอกไม่ได้ กดค้างที่เลขบัญชีเพื่อคัดลอก"; }
      copyMsg.hidden = false;
    });
    parts.push(
      h("div", { class: "panel" },
        h("p", null, "โอนเงินเข้าบัญชีร้าน"),
        h("p", null, "ธนาคาร: " + (payment.bank_name || "-")),
        h("p", null, "ชื่อบัญชี: " + (payment.account_name || "-")),
        h("p", { class: "acct" }, payment.account_no)),
      copyBtn, copyMsg);
  } else {
    parts.push(h("p", { class: "muted" }, "ร้านยังไม่ได้ตั้งบัญชีรับเงิน กรุณาติดต่อร้านเพื่อชำระเงิน"));
  }
  parts.push(
    h("p", { class: "muted" }, "หรือจะจ่ายเงินสดตอนรับอาหารก็ได้ แจ้งร้านด้วยนะ"),
    h("p", { class: "muted" }, "การแนบสลิปและดูสถานะออเดอร์จะเพิ่มในขั้นถัดไป ตอนนี้เก็บเลขออเดอร์นี้ไว้ แล้วแจ้งร้านเมื่อโอนแล้ว"),
    h("button", { class: "btn", type: "button", onclick: onHome }, "กลับหน้าแรก"));
  mount(root, parts);
}

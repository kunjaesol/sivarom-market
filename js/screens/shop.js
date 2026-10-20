// หน้าร้าน: เลือกจำนวนอาหาร (ปุ่ม − 0 +) แล้วกด "สั่งอาหาร"
import { h, mount, formatTime, baht, FULFILLMENT_LABEL } from "../ui.js";

const MAX_PER_ITEM = 99;

// เบอร์โทรเก็บเฉพาะตัวเลขและ + เพื่อความปลอดภัยของลิงก์ tel:
function safePhone(p) { return String(p || "").replace(/[^0-9+]/g, ""); }

export async function renderShop({ api, root, postId, cart, onBack, onCheckout }) {
  mount(root, h("p", { class: "status" }, "กำลังโหลดเมนู..."));
  let page;
  try {
    page = await api.getShopPage(postId);
  } catch (e) {
    mount(root, h("h1", null, "Sivarom Market"),
      h("p", { class: "status error" }, e && e.friendly ? e.friendly : "โหลดไม่สำเร็จ"),
      e && e.tech ? h("p", { class: "muted" }, "รายละเอียดสำหรับผู้ดูแลระบบ: " + e.tech) : null,
      h("button", { class: "btn btn-secondary", type: "button", onclick: onBack }, "กลับหน้าแรก"));
    return;
  }
  if (!page) {
    mount(root, h("h1", null, "Sivarom Market"),
      h("p", { class: "status" }, "ไม่พบเมนูนี้ หรือร้านปิดรับออเดอร์แล้ว"),
      h("button", { class: "btn", type: "button", onclick: onBack }, "ดูร้านที่เปิดอยู่"));
    return;
  }

  // ตะกร้าเป็นของโพสต์นี้เท่านั้น ถ้าเปลี่ยนร้านให้เริ่มใหม่
  if (cart.postId !== page.postId) { cart.postId = page.postId; cart.lines = {}; cart.notes = {}; }
  cart.page = page;

  const qtyEls = new Map();
  function maxFor(item) {
    if (item.is_sold_out || item.remaining === 0) return 0;
    return item.remaining == null ? MAX_PER_ITEM : Math.min(item.remaining, MAX_PER_ITEM);
  }
  function total() { return page.items.reduce((s, i) => s + (cart.lines[i.id] || 0) * Number(i.price), 0); }
  function count() { return page.items.reduce((s, i) => s + (cart.lines[i.id] || 0), 0); }

  const orderBtn = h("button", { class: "btn", type: "button" }, "");
  function refresh() {
    for (const i of page.items) { const el = qtyEls.get(i.id); if (el) el.textContent = String(cart.lines[i.id] || 0); }
    const n = count();
    orderBtn.disabled = !page.isOpen || n === 0;
    orderBtn.textContent = !page.isOpen ? "ปิดรับออเดอร์แล้ว"
      : n === 0 ? "เลือกอาหารก่อน" : "สั่งอาหาร · " + baht(total());
  }
  function change(item, delta) {
    const next = Math.max(0, Math.min(maxFor(item), (cart.lines[item.id] || 0) + delta));
    if (next === 0) delete cart.lines[item.id]; else cart.lines[item.id] = next;
    refresh();
  }

  const rows = page.items.map((item) => {
    const max = maxFor(item);
    const qty = h("span", { class: "qty", "aria-live": "polite" }, String(cart.lines[item.id] || 0));
    qtyEls.set(item.id, qty);
    const minus = h("button", { class: "qty-btn", type: "button", "aria-label": "ลด " + item.name, onclick: () => change(item, -1) }, "−");
    const plus = h("button", { class: "qty-btn", type: "button", "aria-label": "เพิ่ม " + item.name, onclick: () => change(item, 1) }, "+");
    if (max === 0) { minus.disabled = true; plus.disabled = true; }
    return h("section", { class: "card item" },
      h("div", { class: "item-head" },
        h("h3", null, item.name),
        h("span", { class: "price" }, baht(item.price))),
      h("div", { class: "item-foot" },
        max === 0 ? h("span", { class: "tag tag-out" }, "หมด")
          : (item.remaining != null ? h("span", { class: "tag" }, "เหลือ " + item.remaining + " ชุด") : h("span", null)),
        h("div", { class: "stepper" }, minus, qty, plus)));
  });

  orderBtn.addEventListener("click", () => onCheckout());
  const phone = safePhone(page.phone);
  mount(root,
    h("button", { class: "back-link", type: "button", onclick: onBack }, "← กลับ"),
    h("h1", null, page.shopName),
    h("p", { class: "muted" }, (page.isOpen ? "รับออเดอร์ถึง " + formatTime(page.closesAt) : "ปิดรับออเดอร์แล้ว") + " · " + (FULFILLMENT_LABEL[page.fulfillment] || "")),
    !page.isOpen ? h("p", { class: "notice" }, "ร้านนี้ปิดรับออเดอร์แล้ว ดูเมนูได้แต่สั่งไม่ได้") : null,
    rows,
    phone ? h("a", { class: "btn btn-secondary btn-link", href: "tel:" + phone }, "โทรหาร้าน") : null,
    h("div", { class: "sticky-bar" }, orderBtn));
  refresh();
}

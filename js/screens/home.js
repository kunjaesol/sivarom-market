// หน้า Home: ร้านที่เปิดรับออเดอร์ตอนนี้ — กดเลือกร้านเพื่อไปหน้าสั่งอาหาร
import { h, mount, formatTime, FULFILLMENT_LABEL } from "../ui.js";

function shopCard(shop, onOpenShop) {
  const names = shop.items.slice(0, 3).map((i) => i.name).join(", ");
  const more = shop.items.length > 3 ? " และอีก " + (shop.items.length - 3) + " รายการ" : "";
  return h("section", { class: "card" },
    h("h3", null, shop.shopName),
    h("p", { class: "muted" }, "รับออเดอร์ถึง " + formatTime(shop.closesAt) + " · " + (FULFILLMENT_LABEL[shop.fulfillment] || "")),
    h("p", null, names + more),
    h("button", { class: "btn", type: "button", onclick: () => onOpenShop(shop.postId) }, "ดูเมนูและสั่งอาหาร"));
}

export async function renderHome({ api, root, profile, onOpenShop }) {
  const body = h("div", null, h("p", { class: "status" }, "กำลังโหลดร้าน..."));
  mount(root,
    h("h1", null, "Sivarom Market"),
    h("p", { class: "muted" }, "สวัสดี " + (profile.display_name || "ลูกค้า") + " · บ้านเลขที่ " + (profile.house_no || "-")),
    h("h2", null, "ร้านที่เปิดรับออเดอร์ตอนนี้"),
    body);
  try {
    const shops = await api.listOpenShops();
    if (shops.length === 0) {
      mount(body, h("p", { class: "status" }, "ตอนนี้ยังไม่มีร้านเปิดรับออเดอร์"),
        h("p", { class: "muted" }, "เมื่อร้านเปิดรับ จะแสดงที่นี่"));
    } else {
      mount(body, shops.map((s) => shopCard(s, onOpenShop)));
    }
  } catch (e) {
    mount(body, h("p", { class: "status error" }, e && e.friendly ? e.friendly : "โหลดไม่สำเร็จ"),
      e && e.tech ? h("p", { class: "muted" }, "รายละเอียดสำหรับผู้ดูแลระบบ: " + e.tech) : null);
  }
}

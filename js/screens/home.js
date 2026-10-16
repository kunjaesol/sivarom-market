// หน้า Home: ร้านที่เปิดรับออเดอร์ตอนนี้
// (ขั้นนี้ดูเมนูได้อย่างเดียว หน้าเลือกจำนวนและสั่งอาหารจะเพิ่มในขั้นถัดไป)
import { h, mount, formatTime, baht, FULFILLMENT_LABEL } from "../ui.js";

function shopCard(shop) {
  const names = shop.items.slice(0, 3).map((i) => i.name).join(", ");
  const more = shop.items.length > 3 ? " และอีก " + (shop.items.length - 3) + " รายการ" : "";
  const list = h("ul", { class: "menu-list" }, shop.items.map((i) => {
    const sold = i.is_sold_out || i.remaining === 0;
    return h("li", null,
      h("span", null, i.name),
      h("span", { class: "price" }, baht(i.price)),
      sold ? h("span", { class: "tag tag-out" }, "หมด")
           : (i.remaining != null ? h("span", { class: "tag" }, "เหลือ " + i.remaining + " ชุด") : null));
  }));
  return h("section", { class: "card" },
    h("h3", null, shop.shopName),
    h("p", { class: "muted" }, "รับออเดอร์ถึง " + formatTime(shop.closesAt) + " · " + (FULFILLMENT_LABEL[shop.fulfillment] || "")),
    h("p", null, names + more),
    h("details", null, h("summary", null, "ดูเมนูทั้งหมด"), list));
}

export async function renderHome({ api, root, profile }) {
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
      mount(body, shops.map(shopCard));
    }
  } catch (e) {
    mount(body, h("p", { class: "status error" }, e && e.friendly ? e.friendly : "โหลดไม่สำเร็จ"),
      e && e.tech ? h("p", { class: "muted" }, "รายละเอียดสำหรับผู้ดูแลระบบ: " + e.tech) : null);
  }
}

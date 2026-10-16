// หน้าขอความยินยอม + บ้านเลขที่ (ครั้งแรกก่อนใช้งาน)
// ข้อความด้านล่างเป็น "ร่าง" ควรให้ผู้เชี่ยวชาญตรวจก่อนเปิดใช้จริง แล้วเปลี่ยน CONSENT_VERSION ใน api.js
import { h, mount } from "../ui.js";

export const CONSENT_PARAGRAPHS = [
  "ระบบนี้ใช้สั่งอาหารจากร้านในหมู่บ้าน เราเก็บข้อมูลเท่าที่จำเป็นดังนี้",
  "• ข้อมูลที่เก็บ: ชื่อใน LINE, บ้านเลขที่, รายการที่สั่ง, และรูปสลิปโอนเงิน",
  "• ใช้เพื่อ: ให้ร้านเตรียมและส่งอาหาร และตรวจว่าชำระเงินแล้ว",
  "• ใครเห็น: ร้านที่คุณสั่ง เห็นชื่อ บ้านเลขที่ และรายการสั่ง ผู้ดูแลระบบเห็นชื่อ บ้านเลขที่ และรายการสั่ง แต่ไม่เห็นรูปสลิป",
  "• ระยะเวลาเก็บ: รูปสลิปลบหลังออเดอร์เสร็จ 30 วัน ข้อมูลออเดอร์เก็บ 12 เดือน",
  "• ขอลบข้อมูลของคุณได้โดยแจ้งผู้ดูแลระบบ",
  "ระบบนี้จะไม่ขอรหัสผ่าน รหัส OTP หรือเลขบัตรประชาชนของคุณ"
];

export function renderConsent({ api, root, profile, onDone }) {
  const errorBox = h("p", { class: "field-error", role: "alert", hidden: true });
  const input = h("input", {
    id: "house", class: "input", type: "text", maxlength: "50",
    autocomplete: "off", placeholder: "เช่น 12/3 หรือ 45"
  });
  input.value = profile && profile.house_no ? profile.house_no : "";

  const acceptBtn = h("button", { class: "btn", type: "button" }, "ยอมรับและเริ่มใช้งาน");
  const declineBtn = h("button", { class: "btn btn-secondary", type: "button" }, "ไม่ยอมรับ");

  function showError(text) { errorBox.textContent = text; errorBox.hidden = false; }

  acceptBtn.addEventListener("click", async () => {
    errorBox.hidden = true;
    acceptBtn.disabled = true;
    acceptBtn.textContent = "กำลังบันทึก...";
    try {
      const saved = await api.saveConsent(input.value);
      onDone(saved);
    } catch (e) {
      showError(e && e.friendly ? e.friendly : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
      acceptBtn.disabled = false;
      acceptBtn.textContent = "ยอมรับและเริ่มใช้งาน";
    }
  });

  declineBtn.addEventListener("click", () => {
    mount(root,
      h("h1", null, "Sivarom Market"),
      h("p", { class: "status" }, "ขออภัย ต้องยอมรับเงื่อนไขจึงจะใช้ระบบสั่งอาหารได้"),
      h("p", { class: "muted" }, "คุณปิดหน้านี้ได้เลย ระบบยังไม่ได้บันทึกอะไรเพิ่มเติม ถ้าเปลี่ยนใจ เปิดลิงก์ใหม่อีกครั้ง"));
  });

  mount(root,
    h("h1", null, "Sivarom Market"),
    h("h2", null, "ก่อนเริ่มใช้งาน"),
    h("div", { class: "panel" }, CONSENT_PARAGRAPHS.map((t) => h("p", null, t))),
    h("label", { class: "label", for: "house" }, "บ้านเลขที่ของคุณ (ร้านใช้เพื่อส่งอาหารและรู้ว่าคุณคือใคร)"),
    input,
    errorBox,
    acceptBtn,
    declineBtn);
}

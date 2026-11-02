// ส่วน "แนบสลิป" ใช้ซ้ำได้ (หน้าสั่งสำเร็จ และหน้า "ออเดอร์ของฉัน" ในขั้นถัดไป)
// ลำดับ: เลือกรูป -> ย่อรูปในเครื่อง -> อัปโหลดไปที่เก็บไฟล์ส่วนตัว -> แจ้งชำระเงิน
// ถ้ารูปขึ้นไปแล้วแต่แจ้งไม่สำเร็จ ปุ่มจะกลายเป็น "ลองแจ้งอีกครั้ง" (ไม่ต้องเลือกรูปใหม่ ไม่อัปโหลดซ้ำ)
import { h } from "../ui.js";
import { compressImage } from "../image.js";

const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

export function createSlipUploader({ api, orderId, onSent, compress = compressImage }) {
  const status = h("p", { class: "muted", role: "status", hidden: true });
  const errorBox = h("p", { class: "field-error", role: "alert", hidden: true });
  const input = h("input", { type: "file", accept: "image/*", class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  const pickBtn = h("button", { class: "btn", type: "button" }, "แนบสลิปโอนเงิน");
  let uploadedPath = null;
  let busy = false;

  function setStatus(text) { status.textContent = text || ""; status.hidden = !text; }
  function setBusy(on) {
    busy = on; pickBtn.disabled = on;
    if (!on) pickBtn.textContent = uploadedPath ? "ลองแจ้งชำระเงินอีกครั้ง" : "แนบสลิปโอนเงิน";
  }

  async function send(file) {
    if (busy) return;
    setBusy(true);
    errorBox.hidden = true;
    try {
      if (!uploadedPath) {
        if (!file || !/^image\//.test(file.type || "")) throw { friendly: "กรุณาเลือกไฟล์รูปภาพ (รูปสลิป)", tech: "type " + (file && file.type) };
        if (file.size > MAX_ORIGINAL_BYTES) throw { friendly: "ไฟล์ใหญ่เกินไป กรุณาเลือกรูปอื่น", tech: "size " + file.size };
        setStatus("กำลังย่อรูป...");
        const blob = await compress(file);
        setStatus("กำลังส่งสลิป...");
        uploadedPath = await api.uploadSlip(orderId, blob);
      }
      setStatus("กำลังแจ้งร้าน...");
      await api.reportPayment(orderId, uploadedPath);
      setStatus("");
      onSent();
    } catch (e) {
      // ข้อผิดพลาดที่เป็นคำตอบสุดท้ายจากฐานข้อมูล (เช่น ชำระแล้ว/ยกเลิกแล้ว) ไม่ต้องลองซ้ำด้วยรูปเดิม
      if (e && e.tech === "report_payment P0001") uploadedPath = null;
      setStatus("");
      errorBox.textContent = e && e.friendly ? e.friendly : "ส่งสลิปไม่สำเร็จ กรุณาลองใหม่";
      errorBox.hidden = false;
    } finally {
      input.value = "";
      setBusy(false);
    }
  }

  pickBtn.addEventListener("click", () => { if (uploadedPath) send(null); else input.click(); });
  input.addEventListener("change", () => { const f = input.files && input.files[0]; if (f) send(f); });

  return h("div", { class: "slip-box" },
    h("p", { class: "muted" }, "ถ่ายรูปหรือเลือกรูปสลิปจากเครื่อง ระบบจะย่อรูปให้อัตโนมัติ"),
    pickBtn, input, status, errorBox);
}

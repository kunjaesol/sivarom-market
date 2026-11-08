// ส่วน "แนบสลิป" ใช้ซ้ำได้ (หน้าสั่งสำเร็จ และหน้า "ออเดอร์ของฉัน" ในขั้นถัดไป)
// ลำดับ: เลือกรูป -> ย่อรูปในเครื่อง -> แสดงตัวอย่างให้ตรวจ (ลบ/เลือกใหม่ได้) -> กด "ยืนยันส่งสลิปนี้" -> อัปโหลด -> แจ้งชำระเงิน
// ยังไม่มีอะไรถูกส่งออกจากเครื่องจนกว่าลูกค้าจะกดยืนยัน
// ถ้ารูปขึ้นไปแล้วแต่แจ้งไม่สำเร็จ ปุ่มจะกลายเป็น "ลองแจ้งชำระเงินอีกครั้ง" (ไม่อัปโหลดซ้ำ)
import { h, baht } from "../ui.js";
import { compressImage } from "../image.js";

const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

export function createSlipUploader({ api, orderId, amount, onSent, compress = compressImage }) {
  const status = h("p", { class: "muted", role: "status", hidden: true });
  const errorBox = h("p", { class: "field-error", role: "alert", hidden: true });
  const input = h("input", { type: "file", accept: "image/*", class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  const hint = h("p", { class: "muted" }, "ถ่ายรูปหรือเลือกรูปสลิปจากเครื่อง ระบบจะย่อรูปให้อัตโนมัติ");
  const pickBtn = h("button", { class: "btn", type: "button" }, "แนบสลิปโอนเงิน");
  const preview = h("img", { class: "slip-preview", alt: "รูปสลิปที่เลือก" });
  const confirmBtn = h("button", { class: "btn", type: "button" }, "ยืนยันส่งสลิปนี้");
  const changeBtn = h("button", { class: "btn btn-secondary", type: "button" }, "ลบรูป แล้วเลือกใหม่");
  const review = h("div", { class: "slip-review", hidden: true },
    h("p", { class: "status" }, "ตรวจสอบรูปสลิปก่อนส่ง"),
    amount != null ? h("p", { class: "notice" }, "ยอดที่ต้องโอน " + baht(amount) + " ยอดในสลิปต้องตรงกัน") : null,
    preview, confirmBtn, changeBtn);

  let blob = null;
  let url = null;
  let uploadedPath = null;
  let busy = false;

  function setStatus(text) { status.textContent = text || ""; status.hidden = !text; }
  function setBusy(on) { busy = on; pickBtn.disabled = on; confirmBtn.disabled = on; changeBtn.disabled = on; }
  function refreshConfirmLabel() { confirmBtn.textContent = uploadedPath ? "ลองแจ้งชำระเงินอีกครั้ง" : "ยืนยันส่งสลิปนี้"; }
  function showError(e) {
    errorBox.textContent = e && e.friendly ? e.friendly : "ส่งสลิปไม่สำเร็จ กรุณาลองใหม่";
    errorBox.hidden = false;
  }
  function revokeUrl() {
    if (url && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    url = null;
  }

  // ลบรูปที่เลือกไว้ กลับไปหน้าแนบสลิปตอนเริ่มต้น
  function clearPhoto() {
    revokeUrl();
    blob = null; uploadedPath = null;
    preview.removeAttribute("src");
    review.hidden = true; pickBtn.hidden = false; hint.hidden = false;
    refreshConfirmLabel();
  }
  function showPhoto(b) {
    clearPhoto();
    blob = b;
    url = typeof URL.createObjectURL === "function" ? URL.createObjectURL(b) : null;
    if (url) preview.setAttribute("src", url);
    review.hidden = false; pickBtn.hidden = true; hint.hidden = true;
    refreshConfirmLabel();
  }

  async function choose(file) {
    if (busy) return;
    setBusy(true);
    errorBox.hidden = true;
    try {
      if (!file || !/^image\//.test(file.type || "")) throw { friendly: "กรุณาเลือกไฟล์รูปภาพ (รูปสลิป)", tech: "type " + (file && file.type) };
      if (file.size > MAX_ORIGINAL_BYTES) throw { friendly: "ไฟล์ใหญ่เกินไป กรุณาเลือกรูปอื่น", tech: "size " + file.size };
      setStatus("กำลังเตรียมรูป...");
      showPhoto(await compress(file));
    } catch (e) {
      showError(e);
    } finally {
      setStatus("");
      input.value = "";
      setBusy(false);
    }
  }

  async function confirm() {
    if (busy || !blob) return;
    setBusy(true);
    errorBox.hidden = true;
    setStatus("กำลังส่งสลิป...");
    try {
      if (!uploadedPath) uploadedPath = await api.uploadSlip(orderId, blob);
      await api.reportPayment(orderId, uploadedPath);
      revokeUrl();
      setStatus("");
      onSent();
    } catch (e) {
      // ข้อผิดพลาดที่เป็นคำตอบสุดท้ายจากฐานข้อมูล (เช่น ชำระแล้ว/ยกเลิกแล้ว) ไม่ต้องลองซ้ำด้วยรูปเดิม
      if (e && e.tech === "report_payment P0001") uploadedPath = null;
      showError(e);
    } finally {
      setStatus("");
      setBusy(false);
      refreshConfirmLabel();
    }
  }

  pickBtn.addEventListener("click", () => { if (!busy) input.click(); });
  changeBtn.addEventListener("click", () => { if (busy) return; clearPhoto(); input.click(); });
  confirmBtn.addEventListener("click", confirm);
  input.addEventListener("change", () => { const f = input.files && input.files[0]; if (f) choose(f); });

  return h("div", { class: "slip-box" }, hint, pickBtn, review, input, status, errorBox);
}

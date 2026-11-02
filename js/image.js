// ย่อรูปสลิปในเครื่องก่อนอัปโหลด (ประหยัดพื้นที่เก็บไฟล์และอินเทอร์เน็ตของลูกค้า)
// เป้าหมาย ~160 KB เป็น JPEG ด้านยาวสุดไม่เกิน 1600px ถ้ายังใหญ่จะลดคุณภาพแล้วลดขนาดทีละขั้น
// รับ deps (loadImage, makeCanvas) เพื่อให้ทดสอบได้
const DEFAULTS = { maxSide: 1600, targetBytes: 160 * 1024, hardMaxBytes: 480 * 1024 };

function defaultLoadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode failed")); };
    img.src = url;
  });
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

const BAD_IMAGE = { friendly: "เปิดรูปนี้ไม่ได้ กรุณาเลือกรูปอื่น หรือแคปหน้าจอสลิปใหม่", tech: "decode" };

export async function compressImage(file, opts = {}, deps = {}) {
  const { maxSide, targetBytes, hardMaxBytes } = { ...DEFAULTS, ...opts };
  const loadImage = deps.loadImage || defaultLoadImage;
  const makeCanvas = deps.makeCanvas || (() => document.createElement("canvas"));

  let img;
  try { img = await loadImage(file); } catch (e) { throw BAD_IMAGE; }
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) throw BAD_IMAGE;

  let scale = Math.min(1, maxSide / Math.max(srcW, srcH)); // ไม่ขยายรูปที่เล็กอยู่แล้ว
  let quality = 0.75;
  let best = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = makeCanvas();
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw BAD_IMAGE;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // พื้นขาวสำหรับรูปโปร่งใส (PNG)
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await toBlob(canvas, "image/jpeg", quality);
    if (!blob) throw BAD_IMAGE;
    best = blob;
    if (blob.size <= targetBytes) return blob;
    if (quality > 0.5) quality = Math.max(0.5, quality - 0.1); else scale *= 0.8;
  }
  if (best && best.size <= hardMaxBytes) return best; // ยังต่ำกว่าเพดานของที่เก็บไฟล์ (512 KB)
  throw { friendly: "รูปนี้ใหญ่เกินไป กรุณาเลือกรูปอื่น หรือแคปหน้าจอสลิปใหม่", tech: "too large " + (best ? best.size : "?") };
}

// ตัวช่วยสร้างหน้าจอแบบปลอดภัย: ข้อความทุกชิ้นถูกใส่เป็น "ข้อความล้วน" ไม่ตีความเป็น HTML
// (ป้องกันชื่อผู้ใช้/ชื่อร้านที่แฝงโค้ด)

export function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "hidden") node.hidden = !!value;
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "object" && child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

// แทนที่เนื้อหาของพื้นที่แสดงผลทั้งหมด
export function mount(root, ...nodes) {
  root.replaceChildren(...nodes.flat().filter(Boolean));
}

// เวลาแบบไทย เช่น "17:00 น." (ใช้เวลากรุงเทพเสมอ ไม่ขึ้นกับเขตเวลาของเครื่อง)
export function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const t = d.toLocaleTimeString("th-TH", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok"
  });
  return t.replace(".", ":") + " น.";
}

export function baht(n) {
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 }) + " บาท";
}

export const FULFILLMENT_LABEL = {
  delivery: "ส่งถึงบ้าน",
  pickup: "มารับเอง",
  both: "ส่งถึงบ้าน / มารับเอง"
};

// ลำดับการทำงานของแอป: ล็อกอิน -> (ครั้งแรก) ขอความยินยอม+บ้านเลขที่ -> Home
import { h, mount } from "./ui.js";
import { renderConsent } from "./screens/consent.js";
import { renderHome } from "./screens/home.js";

function renderError(root, e, retry) {
  const friendly = e && e.friendly ? e.friendly : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  const tech = e && e.tech ? e.tech : String(e && e.message ? e.message : e);
  mount(root,
    h("h1", null, "Sivarom Market"),
    h("p", { class: "status error" }, friendly),
    h("div", { class: "detail" }, h("p", null, "รายละเอียดสำหรับผู้ดูแลระบบ: " + tech)),
    h("button", { class: "btn", type: "button", onclick: retry }, "ลองใหม่"));
}

export async function boot({ api, root }) {
  mount(root, h("h1", null, "Sivarom Market"), h("p", { class: "status" }, "กำลังเข้าสู่ระบบ..."));
  try {
    const result = await api.ensureLogin();
    if (result.status === "redirect") return; // กำลังพาไปล็อกอิน LINE
    const showHome = (profile) => renderHome({ api, root, profile });
    const profile = result.profile;
    if (!profile.consented_at || !profile.house_no) {
      renderConsent({ api, root, profile, onDone: showHome });
    } else {
      showHome(profile);
    }
  } catch (e) {
    renderError(root, e, () => boot({ api, root }));
  }
}

// ลำดับการทำงานของแอป: ล็อกอิน -> (ครั้งแรก) ขอความยินยอม+บ้านเลขที่ -> Home -> หน้าร้าน -> ตรวจสอบ -> สั่งสำเร็จ
import { h, mount } from "./ui.js";
import { renderConsent } from "./screens/consent.js";
import { renderHome } from "./screens/home.js";
import { renderShop } from "./screens/shop.js";
import { renderCheckout, renderDone } from "./screens/checkout.js";

function renderError(root, e, retry) {
  const friendly = e && e.friendly ? e.friendly : "เกิดข้อผิดพลาด กรุณาลองใหม่";
  const tech = e && e.tech ? e.tech : String(e && e.message ? e.message : e);
  mount(root,
    h("h1", null, "Sivarom Market"),
    h("p", { class: "status error" }, friendly),
    h("div", { class: "detail" }, h("p", null, "รายละเอียดสำหรับผู้ดูแลระบบ: " + tech)),
    h("button", { class: "btn", type: "button", onclick: retry }, "ลองใหม่"));
}

// search = ส่วน ?post=... ของลิงก์ (ลิงก์ที่ร้านแชร์เข้ากลุ่ม LINE จะพาเข้าหน้าร้านโดยตรง)
export async function boot({ api, root, search = "" }) {
  mount(root, h("h1", null, "Sivarom Market"), h("p", { class: "status" }, "กำลังเข้าสู่ระบบ..."));
  try {
    const result = await api.ensureLogin();
    if (result.status === "redirect") return; // กำลังพาไปล็อกอิน LINE
    const profile = result.profile;
    const cart = { postId: null, lines: {}, notes: {}, page: null };

    const go = {
      home: () => renderHome({ api, root, profile, onOpenShop: go.shop }),
      shop: (postId) => renderShop({ api, root, postId, cart, onBack: go.home, onCheckout: go.checkout }),
      checkout: () => renderCheckout({ api, root, cart, profile, onBack: () => go.shop(cart.postId), onDone: go.done }),
      done: (outcome) => {
        const shopName = cart.page ? cart.page.shopName : "";
        cart.postId = null; cart.lines = {}; cart.notes = {}; cart.page = null;
        renderDone({ root, shopName, outcome, onHome: go.home });
      }
    };
    const postParam = new URLSearchParams(search).get("post");
    const start = () => (postParam ? go.shop(postParam) : go.home());

    if (!profile.consented_at || !profile.house_no) {
      renderConsent({ api, root, profile, onDone: (p) => { profile.house_no = p.house_no; profile.consented_at = p.consented_at; start(); } });
    } else {
      start();
    }
  } catch (e) {
    renderError(root, e, () => boot({ api, root, search }));
  }
}

// ชั้นเชื่อมต่อกับ LINE (LIFF) และ Supabase — รวมไว้ที่เดียว หน้าจอไม่ต้องรู้รายละเอียด
// รับ "ของที่ต้องใช้" เข้ามาเป็นพารามิเตอร์ (cfg, sb, liff, fetchFn) เพื่อให้ทดสอบได้
export const CONSENT_VERSION = "draft-1"; // เปลี่ยนเมื่อแก้ข้อความขอความยินยอม

const PROFILE_COLUMNS = "id, display_name, house_no, is_admin, consented_at";

export function createApi({ cfg, sb, liff, fetchFn }) {
  // ---------- ล็อกอิน ----------
  async function exchangeTicket(idToken) {
    let res;
    try {
      res = await fetchFn(cfg.SUPABASE_URL + "/functions/v1/liff-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ idToken })
      });
    } catch (e) {
      throw { friendly: "เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่", tech: "network" };
    }
    let body = {};
    try { body = await res.json(); } catch (e) { /* ปล่อยว่าง */ }
    if (res.status === 403 && body.error === "suspended") {
      throw { friendly: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ", tech: "suspended" };
    }
    if (!res.ok || !body.token_hash) {
      throw { friendly: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่", tech: "liff-auth " + res.status + " " + (body.error || "") };
    }
    const out = await sb.auth.verifyOtp({ token_hash: body.token_hash, type: body.verification_type || "magiclink" });
    if (out.error || !out.data || !out.data.session) {
      throw { friendly: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่", tech: "verifyOtp " + (out.error ? out.error.message : "no session") };
    }
    return out.data.session;
  }

  function fetchProfile(session) {
    return sb.from("users").select(PROFILE_COLUMNS).eq("id", session.user.id).maybeSingle();
  }

  // คืน { status: "redirect" } ถ้าต้องไปล็อกอิน LINE ก่อน, หรือ { status: "ok", session, profile }
  async function ensureLogin() {
    await liff.init({ liffId: cfg.LIFF_ID });
    if (!liff.isLoggedIn()) { liff.login(); return { status: "redirect" }; }
    const idToken = liff.getIDToken();
    const decoded = liff.getDecodedIDToken();
    if (!idToken || !decoded || !decoded.sub) { liff.login(); return { status: "redirect" }; }

    // เซสชันเดิม: ต้องเป็นบัญชี LINE เดียวกัน และบัญชียังอยู่จริงตามเซิร์ฟเวอร์
    let session = (await sb.auth.getSession()).data.session;
    if (session) {
      const sameUser = session.user && session.user.user_metadata &&
                       session.user.user_metadata.line_user_id === decoded.sub;
      if (!sameUser) {
        await sb.auth.signOut(); session = null;
      } else {
        const chk = await sb.auth.getUser();
        if (chk.error || !chk.data || !chk.data.user) { await sb.auth.signOut(); session = null; }
      }
    }
    let fresh = false;
    if (!session) { session = await exchangeTicket(idToken); fresh = true; }

    let prof = await fetchProfile(session);
    if ((prof.error || !prof.data) && !fresh) {
      await sb.auth.signOut();
      session = await exchangeTicket(idToken);
      fresh = true;
      prof = await fetchProfile(session);
    }
    if (prof.error || !prof.data) {
      throw { friendly: "อ่านข้อมูลผู้ใช้ไม่สำเร็จ", tech: "profile " + (prof.error ? prof.error.message : "not found") };
    }
    return { status: "ok", session, profile: prof.data };
  }

  // ---------- โปรไฟล์ / ความยินยอม ----------
  async function saveConsent(houseNo) {
    const house = String(houseNo == null ? "" : houseNo).trim();
    if (!house) throw { friendly: "กรุณากรอกบ้านเลขที่", tech: "validation" };
    if (house.length > 50) throw { friendly: "บ้านเลขที่ยาวเกินไป", tech: "validation" };
    const sess = (await sb.auth.getSession()).data.session;
    if (!sess) throw { friendly: "กรุณาเข้าสู่ระบบใหม่", tech: "no session" };
    const now = new Date().toISOString();
    const res = await sb.from("users")
      .update({ house_no: house, consented_at: now, consent_version: CONSENT_VERSION, updated_at: now })
      .eq("id", sess.user.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    if (res.error || !res.data) {
      throw { friendly: "บันทึกไม่สำเร็จ กรุณาลองใหม่", tech: "saveConsent " + (res.error ? res.error.message : "no row") };
    }
    return res.data;
  }

  // ---------- ร้านที่เปิดรับออเดอร์ตอนนี้ ----------
  async function listOpenShops() {
    const posts = await sb.from("menu_posts")
      .select("id, shop_id, closes_at")
      .eq("is_open", true)
      .gt("closes_at", new Date().toISOString())
      .order("closes_at", { ascending: true });
    if (posts.error) throw { friendly: "โหลดรายการร้านไม่สำเร็จ", tech: "menu_posts " + posts.error.message };
    if (!posts.data || posts.data.length === 0) return [];

    const ids = [...new Set(posts.data.map((p) => p.shop_id))];
    const shops = await sb.from("shops").select("id, name, fulfillment, phone").in("id", ids);
    if (shops.error) throw { friendly: "โหลดรายการร้านไม่สำเร็จ", tech: "shops " + shops.error.message };
    const byId = new Map((shops.data || []).map((s) => [s.id, s]));

    const rows = await Promise.all(posts.data.map(async (p) => {
      const shop = byId.get(p.shop_id);
      if (!shop) return null; // ร้านถูกระงับ/มองไม่เห็น
      const items = await sb.rpc("list_menu_items", { p_post: p.id });
      if (items.error) throw { friendly: "โหลดเมนูไม่สำเร็จ", tech: "list_menu_items " + items.error.message };
      return {
        postId: p.id, shopId: shop.id, shopName: shop.name,
        fulfillment: shop.fulfillment, phone: shop.phone, closesAt: p.closes_at,
        items: items.data || []
      };
    }));
    return rows.filter(Boolean);
  }

  return { ensureLogin, saveConsent, listOpenShops };
}

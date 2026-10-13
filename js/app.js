// Sivarom Market — ขั้น 3: ล็อกอินด้วย LINE (LIFF) แล้วแสดง "สวัสดี [ชื่อ]"
// ลำดับ: LIFF ล็อกอิน -> (ถ้ายังไม่มีเซสชัน) ส่ง ID token ให้ฟังก์ชัน liff-auth -> แลกตั๋วเป็นเซสชัน Supabase
(function () {
  "use strict";
  var cfg = window.SIVAROM_CONFIG;
  var statusEl = document.getElementById("status");
  var detailEl = document.getElementById("detail");
  var retryEl = document.getElementById("retry");

  var sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }
  function showDetail(lines) {
    detailEl.textContent = "";
    lines.forEach(function (t) {
      var p = document.createElement("p");
      p.textContent = t; // ใช้ textContent เสมอ ป้องกันชื่อผู้ใช้ที่แฝงโค้ด
      detailEl.appendChild(p);
    });
    detailEl.hidden = false;
  }
  function fail(text, technical) {
    setStatus(text, "error");
    if (technical) showDetail(["รายละเอียดสำหรับผู้ดูแลระบบ: " + technical]);
    retryEl.hidden = false;
  }

  // ขอตั๋วเข้าสู่ระบบจากฟังก์ชัน liff-auth แล้วแลกเป็นเซสชัน
  async function loginWithLine(idToken) {
    var res;
    try {
      res = await fetch(cfg.SUPABASE_URL + "/functions/v1/liff-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ idToken: idToken })
      });
    } catch (e) {
      throw { friendly: "เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่", tech: "network" };
    }
    var body = {};
    try { body = await res.json(); } catch (e) { /* ปล่อยว่าง */ }
    if (res.status === 403 && body.error === "suspended") {
      throw { friendly: "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ", tech: "suspended" };
    }
    if (!res.ok || !body.token_hash) {
      throw { friendly: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่", tech: "liff-auth " + res.status + " " + (body.error || "") };
    }
    var out = await sb.auth.verifyOtp({ token_hash: body.token_hash, type: body.verification_type || "magiclink" });
    if (out.error || !out.data || !out.data.session) {
      throw { friendly: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่", tech: "verifyOtp " + (out.error ? out.error.message : "no session") };
    }
    return out.data.session;
  }

  async function main() {
    retryEl.hidden = true;
    detailEl.hidden = true;
    setStatus("กำลังเข้าสู่ระบบ...");
    try {
      await liff.init({ liffId: cfg.LIFF_ID });
      if (!liff.isLoggedIn()) { liff.login(); return; } // พาไปล็อกอิน LINE แล้วกลับมาหน้านี้
      var idToken = liff.getIDToken();
      var decoded = liff.getDecodedIDToken();
      if (!idToken || !decoded || !decoded.sub) {
        liff.login(); return;
      }

      // มีเซสชันเดิมอยู่แล้วหรือไม่ และเป็นของบัญชี LINE คนเดียวกับที่เปิดอยู่หรือไม่
      var session = (await sb.auth.getSession()).data.session;
      var sameUser = session && session.user && session.user.user_metadata &&
                     session.user.user_metadata.line_user_id === decoded.sub;
      if (session && !sameUser) { await sb.auth.signOut(); session = null; }
      if (!session) { session = await loginWithLine(idToken); }

      // อ่านโปรไฟล์ตัวเอง (ผ่านกฎ RLS) เพื่อยืนยันว่าสิทธิ์ใช้งานได้จริง
      var prof = await sb.from("users")
        .select("display_name, house_no, is_admin, consented_at")
        .eq("id", session.user.id).single();
      if (prof.error) { throw { friendly: "อ่านข้อมูลผู้ใช้ไม่สำเร็จ", tech: "profile " + prof.error.message }; }
      var comm = await sb.rpc("current_community");

      var name = prof.data.display_name || "ลูกค้า";
      setStatus("สวัสดี " + name + " ✅", "ok");
      showDetail([
        "ล็อกอินผ่าน LINE สำเร็จ",
        "บทบาท: " + (prof.data.is_admin ? "ผู้ดูแลระบบ (Admin)" : "ผู้ใช้ทั่วไป"),
        "บ้านเลขที่: " + (prof.data.house_no || "ยังไม่ได้กรอก"),
        "ยินยอมเงื่อนไขข้อมูล: " + (prof.data.consented_at ? "แล้ว" : "ยัง"),
        "ระบบสิทธิ์ทำงาน: " + (comm.data ? "ใช่" : "ไม่")
      ]);
    } catch (e) {
      if (e && e.friendly) { fail(e.friendly, e.tech); }
      else { fail("เกิดข้อผิดพลาด กรุณาลองใหม่", String(e && e.message ? e.message : e)); }
    }
  }

  retryEl.addEventListener("click", main);
  main();
})();

// จุดเริ่มต้น: ต่อ LIFF + Supabase ของจริงเข้ากับแอป
import { createApi } from "./api.js";
import { boot } from "./app.js";

const cfg = window.SIVAROM_CONFIG;
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});
const api = createApi({ cfg, sb, liff: window.liff, fetchFn: window.fetch.bind(window) });
boot({ api, root: document.getElementById("app"), search: window.location.search });

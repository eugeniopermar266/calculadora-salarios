import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { extraerGuion, mkUid, autoEighths, intExtFromHeader } from "./lib/script";
import { genDiasBloque, parseISO, fmtISO, addDays, fmtEighths, stripColor } from "./lib/plan";
function parseEighths(str) {
  str = String(str || "").trim();
  let m = str.match(/^(\d+)\s+(\d+)\/8$/); if (m) return Number(m[1]) * 8 + Number(m[2]);
  m = str.match(/^(\d+)\/8$/); if (m) return Number(m[1]);
  const n = parseFloat(str.replace(",", ".")); if (isNaN(n)) return null;
  return Math.round(n * 8);
}
function colorTexto(hex) {
  if (!hex || hex.length < 7) return "#111";
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#111" : "#fff";
}
const PALETA = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#78716c", "#64748b", "#1f2937"];
const IE_OPTS = [["INT", "Interior"], ["EXT", "Exterior"], ["INT/EXT", "Interior/Exterior"]];
const TIEMPO_OPTS = ["DÍA", "NOCHE", "AMANECER", "ATARDECER", "TARDE", "MADRUGADA"];
const sinTilde = (v) => String(v || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function normIE(v) { const u = sinTilde(v); const i = u.includes("INT"), x = u.includes("EXT"); if (i && x) return "INT/EXT"; if (x) return "EXT"; if (i) return "INT"; return ""; }
function normTiempo(v) { const t = sinTilde(v); for (const o of TIEMPO_OPTS) { if (sinTilde(o) === t) return o; } return ""; }
import { leerStripboard } from "./lib/stripboard";

const FUNC_NAME = "dynamic-endpoint"; // slug real de la Edge Function de desglose
const CREAR_USER_FUNC = "rapid-function"; // slug real de la Edge Function de crear usuarios

const CATS = [
  ["personajes", "Personajes"], ["vestuario", "Vestuario"], ["atrezzo", "Atrezzo"],
  ["maquillajePeluqueria", "Maq./Peluq."], ["vehiculos", "Vehiculos"], ["animales", "Animales"],
  ["fx", "FX"], ["vfx", "VFX"], ["especialistas", "Especialistas"],
  ["sonido", "Sonido"], ["mobiliario", "Mobiliario"], ["notas", "Notas"],
];

async function runPool(items, worker, concurrency, onProgress) {
  let done = 0; const results = new Array(items.length); let i = 0;
  async function next() {
    const idx = i++;
    if (idx >= items.length) return;
    try { results[idx] = await worker(items[idx], idx); } catch (e) { results[idx] = { error: e.message }; }
    done++; onProgress && onProgress(done, items.length);
    return next();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

const APP_VERSION = "11.8";

function useFuentesBD() {
  useEffect(() => {
    const id = "bd-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Courier+Prime:wght@400;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

export default function App() {
  useFuentesBD();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from("profiles").select("nombre, email, rol").eq("id", session.user.id).single()
      .then(({ data }) => setProfile(data));
  }, [session]);

  if (loading) return <div className="wrap"><p className="muted">Cargando...</p></div>;
  if (!session) return <Auth />;
  return <Main session={session} profile={profile} />;
}

const DOMINIO = "bdprodtools.site";
function normalizarEmail(v) {
  const t = (v || "").trim();
  if (!t) return t;
  return t.includes("@") ? t : `${t}@${DOMINIO}`;
}

function Auth() {
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [verPass, setVerPass] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const id = "login-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Courier+Prime:wght@400;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  async function submit() {
    if (!email || !password || (modo === "registro" && !nombre.trim())) {
      setShake(true); setTimeout(() => setShake(false), 500); return;
    }
    setBusy(true); setMsg(null);
    try {
      if (modo === "registro") {
        const { error } = await supabase.auth.signUp({ email: normalizarEmail(email), password, options: { data: { nombre } } });
        if (error) throw error;
        setMsg({ ok: true, text: "Cuenta creada. Si pide confirmar por email, revisalo; si no, ya puedes entrar." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizarEmail(email), password });
        if (error) throw error;
      }
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Error" });
      setShake(true); setTimeout(() => setShake(false), 500);
    }
    setBusy(false);
  }

  const MONO = "'Courier Prime', 'Courier New', monospace";
  const campo = {
    width: "100%", padding: "16px 50px 16px 46px", fontSize: 14,
    border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
    background: "rgba(20,20,20,0.7)", boxSizing: "border-box",
    fontFamily: MONO, color: "#f0f0f0", outline: "none",
    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    transition: "all 0.15s",
  };
  const iconoStyle = { position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 2 };

  return (
    <div style={{
      minHeight: "100vh", width: "100%", position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: MONO, overflow: "hidden", boxSizing: "border-box",
    }}>
      {/* Fondo a pantalla completa */}
      <div style={{
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
        backgroundImage: "url('/bg.jpg')", backgroundSize: "cover",
        backgroundPosition: "center center", backgroundRepeat: "no-repeat", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
        background: "linear-gradient(180deg, rgba(10,15,20,0.35) 0%, rgba(10,15,20,0.55) 100%)", zIndex: 1,
      }} />

      <style>{`
        @keyframes lgShake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
        @keyframes lgFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .lg-in::placeholder { color:#666; }
        .lg-in:focus { border-color:#4ec9b8 !important; box-shadow:0 0 0 3px rgba(78,201,184,0.12); }
        .lg-in { background-color: rgba(20,20,20,0.7) !important; color:#f0f0f0 !important; caret-color:#4ec9b8; }
        .lg-in:-webkit-autofill,
        .lg-in:-webkit-autofill:hover,
        .lg-in:-webkit-autofill:focus,
        .lg-in:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #141414 inset !important;
          box-shadow: 0 0 0 1000px #141414 inset !important;
          -webkit-text-fill-color: #f0f0f0 !important;
          caret-color: #f0f0f0;
          transition: background-color 9999s ease-in-out 0s;
        }
        .lg-in:autofill { box-shadow: 0 0 0 1000px #141414 inset !important; -webkit-text-fill-color:#f0f0f0 !important; }
      `}</style>

      <div style={{
        position: "relative", zIndex: 2, width: "100%", maxWidth: 480,
        animation: shake ? "lgShake 0.4s" : "lgFade 0.6s ease-out",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src="/logo.png" alt="BD Prod Tools"
            style={{ maxWidth: 380, width: "80%", height: "auto", filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.5))" }} />
        </div>

        {/* Nombre (solo registro) */}
        {modo === "registro" && (
          <div style={{ marginBottom: 12, position: "relative" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconoStyle}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            <input className="lg-in" value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre" autoComplete="off" style={campo} />
          </div>
        )}

        {/* Usuario */}
        <div style={{ marginBottom: 12, position: "relative" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconoStyle}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
          </svg>
          <input className="lg-in" type="text" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Usuario" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"
            style={{ ...campo, paddingRight: 16 }} />
        </div>

        {/* Contrasena */}
        <div style={{ marginBottom: 20, position: "relative" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={iconoStyle}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input className="lg-in" type={verPass ? "text" : "password"} value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="PIN" autoComplete={modo === "registro" ? "new-password" : "current-password"}
            style={{ ...campo, border: `1px solid ${msg && !msg.ok ? "rgba(200,80,80,0.6)" : "rgba(255,255,255,0.12)"}` }} />
          <button type="button" onClick={() => setVerPass((v) => !v)}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", padding: 8, color: "#888", display: "flex", alignItems: "center", zIndex: 2 }}>
            {verPass ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        {/* Boton */}
        <button onClick={submit} disabled={busy}
          onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = "#5ed9c8"; }}
          onMouseLeave={(e) => { if (!busy) e.currentTarget.style.background = "#4ec9b8"; }}
          style={{
            width: "100%", padding: "16px 20px",
            background: busy ? "#3a3a3a" : "#4ec9b8", color: busy ? "#888" : "#0a0a0a",
            border: "none", borderRadius: 10, cursor: busy ? "wait" : "pointer",
            fontSize: 15, fontWeight: 700, letterSpacing: "0.05em", fontFamily: MONO,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "background 0.15s", boxShadow: "0 8px 24px rgba(78,201,184,0.2)",
          }}>
          {busy ? "Verificando..." : (
            <>
              <span>{modo === "registro" ? "Crear cuenta" : "Log in"}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </>
          )}
        </button>

        {/* Mensaje */}
        {msg && (
          <div style={{
            marginTop: 14, padding: "10px 12px", borderRadius: 8, fontSize: 12, textAlign: "center",
            letterSpacing: "0.04em",
            background: msg.ok ? "rgba(78,201,184,0.12)" : "rgba(200,80,80,0.15)",
            border: `1px solid ${msg.ok ? "rgba(78,201,184,0.35)" : "rgba(200,80,80,0.4)"}`,
            color: msg.ok ? "#4ec9b8" : "#e88",
          }}>
            {msg.ok ? "✓ " : "✕ "}{msg.text}
          </div>
        )}

        {/* Cambiar modo */}
        <div style={{ textAlign: "center" }}>
          <button onClick={() => { setModo(modo === "login" ? "registro" : "login"); setMsg(null); }}
            style={{ background: "none", border: 0, color: "#4ec9b8", fontSize: 12, cursor: "pointer", marginTop: 16, fontFamily: MONO, letterSpacing: "0.05em" }}>
            {modo === "login" ? "No tienes cuenta? Crear una" : "Ya tengo cuenta - Entrar"}
          </button>
        </div>

        {/* Titulo + version */}
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", fontSize: 22, fontWeight: 300, color: "#f0f0f0", letterSpacing: "-0.01em", marginBottom: 8 }}>
            Desglose de guion
          </div>
          <div style={{ fontSize: 13, color: "#4ec9b8", letterSpacing: "0.2em", fontWeight: 700, fontFamily: MONO }}>
            v{APP_VERSION}
          </div>
        </div>
      </div>
    </div>
  );
}

function Main({ session, profile }) {
  const [proyectos, setProyectos] = useState([]);
  const [carpetas, setCarpetas] = useState([]);
  const [proyecto, setProyecto] = useState(null);
  const [capitulo, setCapitulo] = useState(null);
  const [proyectoTab, setProyectoTab] = useState("capitulos");
  const [ultimoCap, setUltimoCap] = useState(null);
  const [saltoUid, setSaltoUid] = useState(null);
  const [volverTab, setVolverTab] = useState(null);
  const [capsProyecto, setCapsProyecto] = useState([]);
  const [showUsuarios, setShowUsuarios] = useState(false);
  const canEdit = profile && (profile.rol === "admin" || profile.rol === "editor");

  useEffect(() => {
    if (proyecto) supabase.from("capitulos").select("id, numero, proyecto_id").eq("proyecto_id", proyecto.id).then(({ data }) => setCapsProyecto(data || []));
    else setCapsProyecto([]);
  }, [proyecto]);

  function abrirCap(c) { setUltimoCap(c); setSaltoUid(null); setVolverTab(null); setCapitulo(c); }
  function saltarAPestana(tab) { setUltimoCap(capitulo); setProyectoTab(tab); setCapitulo(null); }
  function irASecuencia(uid, desdeTab) {
    const numCap = parseInt(String(uid).split("x")[0]);
    const cap = capsProyecto.find((c) => c.numero === numCap);
    if (!cap) return;
    setVolverTab(desdeTab || null); setUltimoCap(cap); setSaltoUid(uid); setCapitulo(cap);
  }

  async function cargarProyectos() {
    const { data } = await supabase.from("proyectos").select("*").order("created_at", { ascending: false });
    setProyectos(data || []);
    const { data: cfs } = await supabase.from("proyectos_carpeta").select("*").order("orden");
    setCarpetas(cfs || []);
  }
  useEffect(() => { cargarProyectos(); }, []);

  function elegirProyecto(id) {
    setCapitulo(null);
    setProyecto(id ? (proyectos.find((x) => x.id === id) || null) : null);
  }

  const enHome = !showUsuarios && !capitulo && !proyecto;

  return (
    <div className={`app ${enHome ? "app-home" : ""}`}>
      <style>{`
        .app .topbar{ background:rgba(14,14,14,.82) !important; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
          border-bottom:1px solid rgba(255,255,255,.07) !important; }
        .app .topbar .brand{ font-family:'Courier Prime',monospace !important; font-size:10px !important; letter-spacing:.16em; color:#4ec9b8 !important; text-transform:uppercase; }
        .app .topbar strong{ font-family:'Inter',-apple-system,sans-serif !important; font-weight:500 !important; font-size:15px !important; color:#f0f0f0 !important; letter-spacing:-.01em; }
        .app .topbar .app-ver{ color:#4ec9b8 !important; font-size:10px !important; letter-spacing:.14em; font-weight:700; }
        .app .topbar .crumb{ color:#a1a1aa !important; font-size:12px !important; }
        .app .topbar .muted{ color:#a1a1aa !important; }
        .app .topbar .pill{ background:rgba(78,201,184,.12) !important; border:1px solid rgba(78,201,184,.3); color:#4ec9b8 !important;
          font-size:9px !important; font-weight:700; letter-spacing:.1em; text-transform:uppercase; border-radius:20px !important; padding:2px 9px !important; }
        .app .topbar .proj-sel, .app .topbar .btn{ background:rgba(255,255,255,.05) !important; border:1px solid rgba(255,255,255,.12) !important;
          color:#d4d4d8 !important; border-radius:9px !important; font-family:'Courier Prime',monospace !important; font-size:11px !important; }
        .app .topbar .btn{ font-weight:700 !important; letter-spacing:.06em; text-transform:uppercase; padding:7px 13px !important; }
        .app .topbar .btn:hover, .app .topbar .proj-sel:focus{ border-color:#4ec9b8 !important; color:#4ec9b8 !important; background:rgba(78,201,184,.07) !important; }
        .app-home{ position:relative; min-height:100vh; }
        .app-home::before{ content:""; position:fixed; inset:0; z-index:-2;
          background-image:url('/bg.jpg'); background-size:cover; background-position:center center; background-repeat:no-repeat; }
        .app-home::after{ content:""; position:fixed; inset:0; z-index:-1;
          background:linear-gradient(180deg, rgba(10,15,20,.45) 0%, rgba(10,15,20,.68) 100%); }
        .app-home .content{ background:transparent !important; }
      `}</style>
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand">BD Prod Tools</span>
          <strong>Desglose</strong>
          <span className="app-ver">v{APP_VERSION}</span>
          {proyectos.length > 0 && (
            <select className="proj-sel" value={proyecto?.id || ""} onChange={(e) => elegirProyecto(e.target.value)}>
              <option value="">- Elegir proyecto -</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}
          {capitulo && <span className="crumb">/ Cap {capitulo.numero}</span>}
        </div>
        <div className="topbar-right">
          <span className="muted small">{profile?.nombre || session.user.email}</span>
          <span className="pill">{profile?.rol || "..."}</span>
          {profile?.rol === "admin" && <button className="btn" onClick={() => setShowUsuarios((v) => !v)}>{showUsuarios ? "Volver" : "Usuarios"}</button>}
          <button className="btn" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>
      <main className="content">
        {showUsuarios
          ? <Usuarios />
          : capitulo
          ? <Capitulo capitulo={capitulo} proyNombre={proyecto?.nombre || ""} canEdit={canEdit} onBack={() => setCapitulo(null)} onSaltar={saltarAPestana} saltoUid={saltoUid} volverTab={volverTab} onVolverPestana={() => saltarAPestana(volverTab)} />
          : proyecto
          ? <Proyecto proyecto={proyecto} canEdit={canEdit} onBack={() => setProyecto(null)} onOpenCap={abrirCap} initialTab={proyectoTab} ultimoCap={ultimoCap} onVolverCap={() => setCapitulo(ultimoCap)} irASecuencia={irASecuencia} />
          : <Proyectos canEdit={canEdit} proyectos={proyectos} carpetas={carpetas} onOpen={setProyecto} onChanged={cargarProyectos} />}
      </main>
    </div>
  );
}

async function logActividad(proyectoId, accion, detalle) {
  if (!proyectoId) return;
  try {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("actividad").insert({ proyecto_id: proyectoId, user_email: u?.user?.email || "", accion, detalle: detalle || "" });
  } catch (e) { /* el registro nunca debe romper la accion */ }
}

function Actividad({ proyectoId }) {
  const [items, setItems] = useState(null);
  async function cargar() {
    const { data } = await supabase.from("actividad").select("*").eq("proyecto_id", proyectoId).order("created_at", { ascending: false }).limit(150);
    setItems(data || []);
  }
  useEffect(() => { cargar(); }, [proyectoId]);
  if (items === null) return <p className="muted">Cargando...</p>;
  if (!items.length) return <p className="muted">Aun no hay cambios registrados en este proyecto.</p>;
  return (
    <div>
      <div className="rep-bar"><span className="muted small">Ultimos {items.length} cambios</span><button className="btn" onClick={cargar}>Actualizar</button></div>
      <div className="act-list">
        {items.map((a) => (
          <div key={a.id} className="act-row">
            <span className="act-when">{new Date(a.created_at).toLocaleString("es-ES")}</span>
            <span className="act-who">{a.user_email || "?"}</span>
            <span className="act-what"><b>{a.accion}</b>{a.detalle ? " - " + a.detalle : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function insertChunked(tabla, filas, size = 400) {
  for (let i = 0; i < filas.length; i += size) {
    const { error } = await supabase.from(tabla).insert(filas.slice(i, i + size));
    if (error) throw error;
  }
}

async function exportarProyecto(proyectoId, nombre) {
  const { data: proyecto } = await supabase.from("proyectos").select("*").eq("id", proyectoId).single();
  const { data: capitulos } = await supabase.from("capitulos").select("*").eq("proyecto_id", proyectoId).order("numero");
  const capIds = (capitulos || []).map((c) => c.id);
  let escenas = [], items = [], figs = [];
  if (capIds.length) {
    const { data: es } = await supabase.from("escenas").select("*").in("capitulo_id", capIds);
    escenas = es || [];
    const escIds = escenas.map((e) => e.id);
    if (escIds.length) {
      const { data: di } = await supabase.from("desglose_items").select("*").in("escena_id", escIds); items = di || [];
      const { data: fg } = await supabase.from("figuracion").select("*").in("escena_id", escIds); figs = fg || [];
    }
  }
  const { data: personajes } = await supabase.from("personajes").select("*").eq("proyecto_id", proyectoId);
  const { data: bloques } = await supabase.from("plan_bloques").select("*").eq("proyecto_id", proyectoId);
  const { data: dias } = await supabase.from("plan_dias").select("*").eq("proyecto_id", proyectoId);
  const diaIds = (dias || []).map((d) => d.id);
  let diaEsc = [];
  let diaPend = [];
  if (diaIds.length) { const { data: de } = await supabase.from("plan_dia_escenas").select("*").in("plan_dia_id", diaIds); diaEsc = de || []; }
  if (diaIds.length) { const { data: dp } = await supabase.from("plan_dia_pendientes").select("*").in("plan_dia_id", diaIds); diaPend = dp || []; }
  const { data: fuera } = await supabase.from("plan_fuera").select("*").eq("proyecto_id", proyectoId);
  const dump = { app: "desglose-bdprodtools", version: 2, exportado: new Date().toISOString(), app_version: APP_VERSION, proyecto, capitulos: capitulos || [], escenas, desglose_items: items, figuracion: figs, personajes: personajes || [], plan_bloques: bloques || [], plan_dias: dias || [], plan_dia_escenas: diaEsc, plan_dia_pendientes: diaPend, plan_fuera: fuera || [] };
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `desglose_${String(nombre || "proyecto").replace(/[^\w]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}

async function duplicarProyecto(proyectoId, nombreNuevo) {
  const { data: u } = await supabase.auth.getUser();
  const strip = (row, extra = {}) => { const { id, created_at, ...resto } = row; return { ...resto, ...extra }; };
  // proyecto
  const { data: proj } = await supabase.from("proyectos").select("*").eq("id", proyectoId).single();
  const { data: np, error: ep } = await supabase.from("proyectos").insert(strip(proj, { nombre: nombreNuevo, created_by: u?.user?.id })).select().single();
  if (ep) throw ep;
  const pid = np.id;
  const insMap = async (tabla, rows) => {
    const map = {};
    for (let i = 0; i < rows.length; i += 300) {
      const slice = rows.slice(i, i + 300);
      const { data, error } = await supabase.from(tabla).insert(slice.map((r) => r.payload)).select();
      if (error) throw error;
      slice.forEach((r, j) => { map[r.oldId] = data[j].id; });
    }
    return map;
  };
  // capitulos
  const { data: caps } = await supabase.from("capitulos").select("*").eq("proyecto_id", proyectoId).order("numero");
  const capMap = await insMap("capitulos", (caps || []).map((c) => ({ oldId: c.id, payload: strip(c, { proyecto_id: pid }) })));
  const capIds = (caps || []).map((c) => c.id);
  // escenas
  let escMap = {};
  if (capIds.length) {
    const { data: escs } = await supabase.from("escenas").select("*").in("capitulo_id", capIds);
    escMap = await insMap("escenas", (escs || []).map((e) => ({ oldId: e.id, payload: strip(e, { capitulo_id: capMap[e.capitulo_id] }) })));
    const escIds = (escs || []).map((e) => e.id);
    if (escIds.length) {
      const { data: its } = await supabase.from("desglose_items").select("*").in("escena_id", escIds);
      if ((its || []).length) for (let i = 0; i < its.length; i += 300) await supabase.from("desglose_items").insert(its.slice(i, i + 300).map((it) => strip(it, { escena_id: escMap[it.escena_id] })));
      const { data: figs } = await supabase.from("figuracion").select("*").in("escena_id", escIds);
      if ((figs || []).length) for (let i = 0; i < figs.length; i += 300) await supabase.from("figuracion").insert(figs.slice(i, i + 300).map((f) => strip(f, { escena_id: escMap[f.escena_id] })));
    }
  }
  // por proyecto (sin remapeo de FK salvo proyecto_id)
  const copiaSimple = async (tabla) => {
    const { data } = await supabase.from(tabla).select("*").eq("proyecto_id", proyectoId);
    if ((data || []).length) for (let i = 0; i < data.length; i += 300) await supabase.from(tabla).insert(data.slice(i, i + 300).map((r) => strip(r, { proyecto_id: pid })));
  };
  for (const t of ["personajes", "plan_bloques", "racord_colores", "territorio_colores", "nac_colores", "loc_notas", "loc_links"]) {
    try { await copiaSimple(t); } catch (e) { /* tabla opcional */ }
  }
  // plan_dias + hijos
  const { data: dias } = await supabase.from("plan_dias").select("*").eq("proyecto_id", proyectoId);
  const diaMap = await insMap("plan_dias", (dias || []).map((d) => ({ oldId: d.id, payload: strip(d, { proyecto_id: pid }) })));
  const diaIds = (dias || []).map((d) => d.id);
  if (diaIds.length) {
    const { data: de } = await supabase.from("plan_dia_escenas").select("*").in("plan_dia_id", diaIds);
    const deOk = (de || []).map((x) => strip(x, { plan_dia_id: diaMap[x.plan_dia_id], escena_id: escMap[x.escena_id] })).filter((x) => x.plan_dia_id && x.escena_id);
    if (deOk.length) for (let i = 0; i < deOk.length; i += 300) await supabase.from("plan_dia_escenas").insert(deOk.slice(i, i + 300));
  }
  // plan_fuera (proyecto_id + escena_id)
  const { data: fuera } = await supabase.from("plan_fuera").select("*").eq("proyecto_id", proyectoId);
  const fuOk = (fuera || []).map((x) => strip(x, { proyecto_id: pid, escena_id: escMap[x.escena_id] })).filter((x) => x.escena_id);
  if (fuOk.length) for (let i = 0; i < fuOk.length; i += 300) await supabase.from("plan_fuera").insert(fuOk.slice(i, i + 300));
  return np;
}

async function importarProyecto(txt) {
  const d = JSON.parse(txt);
  if (!d || !d.proyecto) throw new Error("El archivo no parece un proyecto valido.");
  const { data: u } = await supabase.auth.getUser();
  const { data: np, error } = await supabase.from("proyectos").insert({ nombre: (d.proyecto.nombre || "Proyecto") + " (importado)", created_by: u?.user?.id }).select().single();
  if (error) throw error;
  const pid = np.id;

  const capMap = {};
  if ((d.capitulos || []).length) {
    const payload = d.capitulos.map((c) => ({ proyecto_id: pid, numero: c.numero, nombre_archivo: c.nombre_archivo }));
    const { data: ncs, error: ec } = await supabase.from("capitulos").insert(payload).select();
    if (ec) throw ec;
    d.capitulos.forEach((c, i) => (capMap[c.id] = ncs[i].id));
  }

  const escMap = {};
  for (let i = 0; i < (d.escenas || []).length; i += 400) {
    const slice = d.escenas.slice(i, i + 400);
    const pl = slice.map((e) => ({ capitulo_id: capMap[e.capitulo_id], num_raw: e.num_raw, uid: e.uid, orden: e.orden, header: e.header, texto: e.texto, int_ext: e.int_ext, localizacion: e.localizacion, tiempo: e.tiempo, octavos: e.octavos, sinopsis: e.sinopsis, territorio: e.territorio })).filter((x) => x.capitulo_id);
    if (!pl.length) continue;
    const { data: nes, error: ee } = await supabase.from("escenas").insert(pl).select();
    if (ee) throw ee;
    slice.filter((e) => capMap[e.capitulo_id]).forEach((e, j) => (escMap[e.id] = nes[j].id));
  }

  const its = (d.desglose_items || []).map((it) => ({ escena_id: escMap[it.escena_id], categoria: it.categoria, elemento: it.elemento })).filter((x) => x.escena_id);
  if (its.length) await insertChunked("desglose_items", its);
  const fgs = (d.figuracion || []).map((f) => ({ escena_id: escMap[f.escena_id], tipo: f.tipo, cantidad: f.cantidad, nota: f.nota })).filter((x) => x.escena_id);
  if (fgs.length) await insertChunked("figuracion", fgs);
  const prs = (d.personajes || []).map((pp) => ({ proyecto_id: pid, nombre: pp.nombre, numero: pp.numero, actor: pp.actor, menor: pp.menor }));
  if (prs.length) await insertChunked("personajes", prs);
  const bls = (d.plan_bloques || []).map((b) => ({ proyecto_id: pid, territorio: b.territorio, inicio: b.inicio, dias_rodaje: b.dias_rodaje, regla: b.regla, festivos: b.festivos, orden: b.orden }));
  if (bls.length) await insertChunked("plan_bloques", bls);

  const diaMap = {};
  for (let i = 0; i < (d.plan_dias || []).length; i += 400) {
    const slice = d.plan_dias.slice(i, i + 400);
    const pl = slice.map((dd) => ({ proyecto_id: pid, fecha: dd.fecha, tipo: dd.tipo, territorio: dd.territorio, doble_unidad: dd.doble_unidad, camara_caliente: dd.camara_caliente, nota: dd.nota }));
    const { data: nds, error: ed } = await supabase.from("plan_dias").insert(pl).select();
    if (ed) throw ed;
    slice.forEach((dd, j) => (diaMap[dd.id] = nds[j].id));
  }
  const des = (d.plan_dia_escenas || []).map((x) => ({ plan_dia_id: diaMap[x.plan_dia_id], escena_id: escMap[x.escena_id], orden: x.orden })).filter((x) => x.plan_dia_id && x.escena_id);
  if (des.length) await insertChunked("plan_dia_escenas", des);

  return np;
}

const FOLDER_ICONS = ["📁", "🎬", "🎥", "🎞️", "📺", "⭐", "🎯", "🚀", "🔥", "💡", "🎨", "🍿", "🎭", "📽️", "🌟", "⚡"];
const FOLDER_COLORS = ["#B0CFA6", "#F49EC4", "#9FC5E8", "#F89646", "#FFE599", "#B4A7D6", "#92D050", "#3D7AB8", "#B8412A", "#5C8A6E", "#CCFF00", "#FFC000"];
const CATEGORIAS = ["Principal", "Secundario", "Reparto"];
const CAT_ABREV = { Principal: "PROT", Secundario: "SEC", Reparto: "REP" };
const abrevCat = (c) => CAT_ABREV[c] || "";
const PROJ_ICONS = ["🎬", "🎥", "🎞️", "📺", "📽️", "🍿", "🎭", "🎪", "🎤", "🎸", "⭐", "🌟", "🔥", "💎", "🚀", "🏆", "🌍", "🏝️", "🏙️", "❤️"];
const PROJ_FONTS = [
  { id: "fraunces", nombre: "Fraunces", css: "'Fraunces', serif" },
  { id: "playfair", nombre: "Playfair", css: "'Playfair Display', serif" },
  { id: "dmserif", nombre: "DM Serif", css: "'DM Serif Display', serif" },
  { id: "bodoni", nombre: "Bodoni Moda", css: "'Bodoni Moda', serif" },
  { id: "prata", nombre: "Prata", css: "'Prata', serif" },
  { id: "cormorant", nombre: "Cormorant", css: "'Cormorant Garamond', serif" },
  { id: "lora", nombre: "Lora", css: "'Lora', serif" },
  { id: "abril", nombre: "Abril Fatface", css: "'Abril Fatface', serif" },
  { id: "cinzel", nombre: "Cinzel", css: "'Cinzel', serif" },
  { id: "bebas", nombre: "Bebas Neue", css: "'Bebas Neue', sans-serif" },
  { id: "anton", nombre: "Anton", css: "'Anton', sans-serif" },
  { id: "staatliches", nombre: "Staatliches", css: "'Staatliches', sans-serif" },
  { id: "oswald", nombre: "Oswald", css: "'Oswald', sans-serif" },
  { id: "archivo", nombre: "Archivo Black", css: "'Archivo Black', sans-serif" },
  { id: "space", nombre: "Space Grotesk", css: "'Space Grotesk', sans-serif" },
  { id: "syne", nombre: "Syne", css: "'Syne', sans-serif" },
  { id: "outfit", nombre: "Outfit", css: "'Outfit', sans-serif" },
  { id: "montserrat", nombre: "Montserrat", css: "'Montserrat', sans-serif" },
  { id: "josefin", nombre: "Josefin Sans", css: "'Josefin Sans', sans-serif" },
  { id: "righteous", nombre: "Righteous", css: "'Righteous', cursive" },
];
const fuenteCss = (id) => (PROJ_FONTS.find((f) => f.id === id) || PROJ_FONTS[0]).css;

// v11.0: tinte pastel calido a partir del color del proyecto
function hexRGB(hex) {
  const h = String(hex || "").replace("#", "").trim();
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f || "888888", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
// mezcla con blanco (pastel) y devuelve rgba
function pastel(hex, mezcla, alpha) {
  const { r, g, b } = hexRGB(hex);
  const m = (v) => Math.round(v + (255 - v) * mezcla);
  return `rgba(${m(r)}, ${m(g)}, ${m(b)}, ${alpha})`;
}
function varsColor(hex) {
  if (!hex) return undefined;
  return {
    "--pc": hex,                      // franja lateral, color pleno
    "--pcs": pastel(hex, 0.55, 0.20), // sombreado pastel de la izquierda
    "--pcs2": pastel(hex, 0.55, 0.06),// desvanecido hacia la derecha
    "--pcs-i": pastel(hex, 0.5, 0.14),// cuadro del emoji
    "--pcs-b": pastel(hex, 0.5, 0.3), // bordes
    "--pcl": pastel(hex, 0.62, 1),    // nombre del proyecto
  };
}

function Proyectos({ canEdit, proyectos, carpetas, onOpen, onChanged }) {
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [editandoCarpeta, setEditandoCarpeta] = useState(null); // {id?, nombre, color, icono}
  const [editandoProy, setEditandoProy] = useState(null); // {id, nombre, color, icono}

  async function guardarProy() {
    const c = editandoProy; if (!c || !c.nombre.trim()) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from("proyectos").update({ nombre: c.nombre.trim(), color: c.color, icono: c.icono, fuente: c.fuente }).eq("id", c.id);
    if (error) setErr(error.message); else await logActividad(c.id, "Edito el proyecto", c.nombre.trim());
    setEditandoProy(null); onChanged(); setBusy(false);
  }

  function toggleCarpeta(id) { setAbiertas((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  async function crear(carpetaId = null) {
    const nom = carpetaId ? prompt("Nombre del nuevo proyecto:") : nombre;
    if (!nom || !nom.trim()) return;
    setBusy(true); setErr(null);
    const { data: u } = await supabase.auth.getUser();
    const { data: np, error } = await supabase.from("proyectos").insert({ nombre: nom.trim(), created_by: u?.user?.id, carpeta_id: carpetaId }).select().single();
    if (error) setErr(error.message); else { await logActividad(np.id, "Creo el proyecto", np.nombre); setNombre(""); onChanged(); }
    setBusy(false);
  }

  async function onImportFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    setBusy(true); setErr(null);
    try { const np = await importarProyecto(await file.text()); await logActividad(np.id, "Importo un proyecto (JSON)", np.nombre); onChanged(); }
    catch (e) { setErr("No se pudo importar: " + (e.message || e)); }
    setBusy(false); ev.target.value = "";
  }

  async function renombrar(p) {
    const nn = prompt("Nuevo nombre del proyecto:", p.nombre);
    if (nn == null || !nn.trim() || nn.trim() === p.nombre) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from("proyectos").update({ nombre: nn.trim() }).eq("id", p.id);
    if (error) setErr("No se pudo renombrar: " + error.message); else { await logActividad(p.id, "Renombro el proyecto", nn.trim()); onChanged(); }
    setBusy(false);
  }

  async function duplicar(p) {
    if (!confirm(`Duplicar "${p.nombre}" con todo su contenido?`)) return;
    setBusy(true); setErr(null);
    try { const np = await duplicarProyecto(p.id, p.nombre + " (copia)"); if (p.carpeta_id) await supabase.from("proyectos").update({ carpeta_id: p.carpeta_id }).eq("id", np.id); await logActividad(np.id, "Duplico el proyecto", np.nombre); onChanged(); }
    catch (e) { setErr("No se pudo duplicar: " + (e.message || e)); }
    setBusy(false);
  }

  async function eliminar(p) {
    const conf = prompt(`ATENCION: esto borra el proyecto "${p.nombre}" y TODO su contenido. No se puede deshacer.\n\nEscribe el nombre del proyecto para confirmar:`);
    if (conf == null) return;
    if (conf.trim() !== p.nombre.trim()) { alert("El nombre no coincide. No se ha borrado nada."); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.from("proyectos").delete().eq("id", p.id);
    if (error) setErr("No se pudo borrar: " + error.message); else onChanged();
    setBusy(false);
  }

  async function moverACarpeta(p, carpetaId) {
    setBusy(true); setErr(null);
    const { error } = await supabase.from("proyectos").update({ carpeta_id: carpetaId || null }).eq("id", p.id);
    if (error) setErr("No se pudo mover: " + error.message); else onChanged();
    setBusy(false);
  }

  async function guardarCarpeta() {
    const c = editandoCarpeta; if (!c || !c.nombre.trim()) return;
    setBusy(true); setErr(null);
    if (c.id) {
      const { error } = await supabase.from("proyectos_carpeta").update({ nombre: c.nombre.trim(), color: c.color, icono: c.icono }).eq("id", c.id);
      if (error) setErr(error.message);
    } else {
      const { error } = await supabase.from("proyectos_carpeta").insert({ nombre: c.nombre.trim(), color: c.color, icono: c.icono });
      if (error) setErr(error.message);
    }
    setEditandoCarpeta(null); onChanged(); setBusy(false);
  }

  async function duplicarCarpeta(f) {
    setBusy(true); setErr(null);
    const { error } = await supabase.from("proyectos_carpeta").insert({ nombre: f.nombre + " (copia)", color: f.color, icono: f.icono });
    if (error) setErr(error.message); else onChanged();
    setBusy(false);
  }

  async function eliminarCarpeta(f) {
    const dentro = proyectos.filter((p) => p.carpeta_id === f.id).length;
    if (dentro > 0) { alert(`La carpeta "${f.nombre}" tiene ${dentro} proyecto(s) dentro. Vaciala antes de borrarla (mueve o elimina sus proyectos).`); return; }
    if (!confirm(`Borrar la carpeta vacia "${f.nombre}"?`)) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from("proyectos_carpeta").delete().eq("id", f.id);
    if (error) setErr(error.message); else onChanged();
    setBusy(false);
  }

  const sinCarpeta = proyectos.filter((p) => !p.carpeta_id);
  const carpetaSelect = (p) => canEdit && carpetas.length > 0 && (
    <select className="proj-move" value={p.carpeta_id || ""} onClick={(e) => e.stopPropagation()} onChange={(e) => moverACarpeta(p, e.target.value)} title="Mover a carpeta">
      <option value="">Sin carpeta</option>
      {carpetas.map((f) => <option key={f.id} value={f.id}>{f.icono} {f.nombre}</option>)}
    </select>
  );

  const proyItem = (p) => (
    <div key={p.id} className={`pitem ${p.color ? "pitem-col" : ""}`} style={varsColor(p.color)}>
      <button className="pitem-main" onClick={() => onOpen(p)}>
        <span className="pitem-name" style={{ fontFamily: fuenteCss(p.fuente) }}>{p.icono && <span className="pitem-ic">{p.icono}</span>}{p.nombre}</span>
        <span className="pitem-open">Abrir &rarr;</span>
      </button>
      {canEdit && (
        <div className="pitem-actions">
          {carpetaSelect(p)}
          <button className="pbtn" onClick={() => setEditandoProy({ id: p.id, nombre: p.nombre, color: p.color || FOLDER_COLORS[0], icono: p.icono || "🎬", fuente: p.fuente || "fraunces" })} disabled={busy}>Editar</button>
          <button className="pbtn" onClick={() => duplicar(p)} disabled={busy}>Duplicar</button>
          <button className="pbtn x" onClick={() => eliminar(p)} disabled={busy} title="Eliminar">✕</button>
        </div>
      )}
    </div>
  );

  return (
    <div className="proj-screen">
      <style>{`
        .proj-screen{ background:transparent !important; min-height:calc(100vh - 56px); }
        .proj-wrap{ max-width:900px; margin:0 auto; padding:30px 22px 60px; font-family:'Courier Prime','Courier New',monospace; color:#f0f0f0; }
        .proj-topline{ display:flex; align-items:center; gap:14px; margin-bottom:20px; flex-wrap:wrap; }
        .proj-h{ font-family:'Inter',-apple-system,sans-serif !important; font-weight:300 !important; font-size:28px !important; letter-spacing:-.02em; margin:0 !important; color:#f0f0f0 !important; }
        .proj-topbtns{ margin-left:auto; display:flex; gap:8px; align-items:center; }
        .proj-busy{ font-size:11px; color:#4ec9b8; letter-spacing:.08em; }
        .proj-empty{ color:#71717a; font-size:12px; }

        .gbtn{ background:rgba(255,255,255,.05) !important; border:1px solid rgba(255,255,255,.12) !important; color:#d4d4d8 !important;
          border-radius:9px !important; padding:8px 14px !important; font-family:'Courier Prime',monospace !important; font-size:11px !important;
          font-weight:700 !important; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; transition:.15s; }
        .gbtn:hover{ border-color:#4ec9b8 !important; color:#4ec9b8 !important; background:rgba(78,201,184,.07) !important; }
        .gbtn:not(.ghost):not(.x):not(.small){ background:#4ec9b8 !important; border-color:#4ec9b8 !important; color:#0a0a0a !important; box-shadow:0 6px 18px rgba(78,201,184,.18); }
        .gbtn:not(.ghost):not(.x):not(.small):hover{ background:#5ed9c8 !important; color:#0a0a0a !important; }
        .gbtn.small{ padding:5px 10px !important; font-size:10px !important; }
        .gbtn.x{ color:#71717a !important; }
        .gbtn.x:hover{ border-color:#dc2626 !important; color:#f87171 !important; background:rgba(220,38,38,.08) !important; }

        .pitem{ display:flex; align-items:center; gap:10px; padding:0 14px 0 0; margin-bottom:7px;
          background:rgba(20,20,20,.72); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
          border:1px solid rgba(255,255,255,.08); border-left:3px solid transparent; border-radius:12px;
          transition:.15s; overflow:hidden; }
        .pitem:hover{ border-color:rgba(78,201,184,.35); transform:translateX(2px); }
        .pitem-col{ border-left-color:var(--pc) !important;
          background:linear-gradient(90deg, var(--pcs) 0%, var(--pcs2) 58%, rgba(20,20,20,0) 100%), rgba(20,20,20,.72) !important; }
        .pitem-col:hover{ border-left-color:var(--pc) !important; border-color:var(--pcs-b) !important; }
        .pitem-main{ flex:1; min-width:0; display:flex; align-items:center; gap:12px; background:none !important; border:0 !important;
          padding:13px 4px 13px 15px !important; cursor:pointer; text-align:left; }
        .pitem-name{ font-size:15px !important; font-weight:700; letter-spacing:.01em; color:#f0f0f0; display:flex; align-items:center; gap:10px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pitem-col .pitem-name{ color:var(--pcl); }
        .pitem-ic{ width:36px; height:36px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; font-size:18px;
          background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); flex-shrink:0; }
        .pitem-col .pitem-ic{ background:var(--pcs-i); border-color:var(--pcs-b); }
        .pitem-open{ margin-left:auto; color:#4ec9b8 !important; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; padding-right:10px; }
        .pitem-actions{ display:flex; gap:6px; align-items:center; }
        .pbtn{ background:rgba(0,0,0,.42) !important; border:1px solid rgba(255,255,255,.22) !important; color:#f0f0f0 !important;
          border-radius:8px !important; padding:5px 10px !important; font-family:'Courier Prime',monospace !important; font-size:10px !important;
          font-weight:700 !important; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; transition:.15s; }
        .pbtn:hover{ border-color:#4ec9b8 !important; color:#4ec9b8 !important; background:rgba(78,201,184,.14) !important; }
        .pbtn.x{ color:#d4d4d8 !important; }
        .pbtn.x:hover{ border-color:#dc2626 !important; color:#f87171 !important; background:rgba(220,38,38,.18) !important; }
        .proj-move{ background:rgba(0,0,0,.42) !important; border:1px solid rgba(255,255,255,.22) !important; color:#d4d4d8 !important;
          border-radius:8px !important; padding:4px 7px !important; font-family:'Courier Prime',monospace !important; font-size:10px !important; cursor:pointer; }

        .folder-box{ background:transparent !important; border:0 !important; padding:0 !important; margin-bottom:18px !important; }
        .folder-head{ display:flex; align-items:center; gap:10px; padding:0 0 7px !important; margin-bottom:9px;
          border-bottom:1px solid rgba(255,255,255,.07) !important; background:transparent !important; cursor:pointer; }
        .folder-head-l{ display:flex; align-items:center; gap:9px; }
        .folder-chev{ color:#71717a; font-size:11px; transition:.15s; display:inline-block; }
        .folder-chev.open{ transform:rotate(90deg); }
        .folder-ic{ font-size:14px; }
        .folder-nm{ font-size:11px !important; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--fc) !important; }
        .folder-ct{ font-size:10px; color:#71717a; background:rgba(255,255,255,.06); padding:1px 8px; border-radius:20px; }
        .folder-head-a{ margin-left:auto; display:flex; gap:6px; }
        .folder-body{ padding:0 !important; background:transparent !important; }

        .proj-sc-tit{ font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#4ec9b8;
          padding-bottom:7px; margin-bottom:9px; border-bottom:1px solid rgba(255,255,255,.07); }
        .proj-new{ margin-top:26px; padding-top:20px; border-top:1px solid rgba(255,255,255,.07); display:flex; gap:9px; flex-wrap:wrap; }
        .proj-new input{ flex:1; min-width:220px; background:rgba(20,20,20,.7) !important; border:1px solid rgba(255,255,255,.12) !important;
          color:#f0f0f0 !important; border-radius:10px !important; padding:12px 14px !important; font-family:'Courier Prime',monospace !important; font-size:13px !important; outline:none; }
        .proj-new input::placeholder{ color:#666; }
        .proj-new input:focus{ border-color:#4ec9b8 !important; box-shadow:0 0 0 3px rgba(78,201,184,.1); }
        .proj-new .gbtn{ padding:12px 20px !important; font-size:11px !important; }

        .folder-editor{ background:rgba(20,20,20,.86) !important; border:1px solid rgba(255,255,255,.1) !important; border-radius:14px !important;
          padding:18px !important; margin-bottom:16px; backdrop-filter:blur(16px); }
        .fe-row{ display:flex; gap:8px; flex-wrap:wrap; }
        .fe-name{ flex:1; min-width:200px; background:rgba(20,20,20,.7) !important; border:1px solid rgba(255,255,255,.12) !important;
          color:#f0f0f0 !important; border-radius:9px !important; padding:9px 12px !important; font-family:'Courier Prime',monospace !important; font-size:13px !important; outline:none; }
        .fe-name:focus{ border-color:#4ec9b8 !important; }
        .fe-label{ font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#71717a; margin:14px 0 7px; }
        .fe-icons,.fe-colors,.fe-fonts{ display:flex; flex-wrap:wrap; gap:6px; }
        .fe-icon{ width:34px; height:34px; background:rgba(255,255,255,.05) !important; border:1px solid rgba(255,255,255,.1) !important;
          border-radius:9px !important; font-size:16px; cursor:pointer; }
        .fe-icon.on{ border-color:#4ec9b8 !important; background:rgba(78,201,184,.12) !important; }
        .fe-color{ width:26px; height:26px; border-radius:50% !important; border:2px solid transparent !important; cursor:pointer; }
        .fe-color.on{ border-color:#f0f0f0 !important; transform:scale(1.15); }
        .fe-font{ background:rgba(255,255,255,.04) !important; border:1px solid rgba(255,255,255,.1) !important; color:#f0f0f0 !important;
          border-radius:9px !important; padding:8px 12px !important; cursor:pointer; display:flex; flex-direction:column; gap:2px; font-size:14px; }
        .fe-font.on{ border-color:#4ec9b8 !important; background:rgba(78,201,184,.1) !important; }
        .fe-font-nm{ font-family:'Courier Prime',monospace; font-size:9px; color:#71717a; letter-spacing:.06em; text-transform:uppercase; }
        .proj-screen .msg.err{ background:rgba(200,80,80,.15) !important; border:1px solid rgba(200,80,80,.4) !important; color:#e88 !important; border-radius:9px; }
      `}</style>
      <div className="proj-wrap">
        <div className="proj-topline">
          <h2 className="proj-h">Proyectos</h2>
          <div className="proj-topbtns">
            {canEdit && <button className="gbtn ghost" onClick={() => setEditandoCarpeta({ nombre: "", color: FOLDER_COLORS[0], icono: "📁" })}>📁 Nueva carpeta</button>}
            {busy && <span className="proj-busy">Trabajando...</span>}
          </div>
        </div>
        {err && <div className="msg err">{err}</div>}

        {editandoCarpeta && (
          <div className="folder-editor">
            <div className="fe-row">
              <input className="fe-name" placeholder="Nombre de la carpeta" value={editandoCarpeta.nombre} autoFocus
                onChange={(e) => setEditandoCarpeta({ ...editandoCarpeta, nombre: e.target.value })} onKeyDown={(e) => e.key === "Enter" && guardarCarpeta()} />
              <button className="gbtn" onClick={guardarCarpeta} disabled={busy}>{editandoCarpeta.id ? "Guardar" : "Crear"}</button>
              <button className="gbtn ghost" onClick={() => setEditandoCarpeta(null)}>Cancelar</button>
            </div>
            <div className="fe-label">Icono</div>
            <div className="fe-icons">
              {FOLDER_ICONS.map((ic) => <button key={ic} className={`fe-icon ${editandoCarpeta.icono === ic ? "on" : ""}`} onClick={() => setEditandoCarpeta({ ...editandoCarpeta, icono: ic })}>{ic}</button>)}
            </div>
            <div className="fe-label">Color</div>
            <div className="fe-colors">
              {FOLDER_COLORS.map((co) => <button key={co} className={`fe-color ${editandoCarpeta.color === co ? "on" : ""}`} style={{ background: co }} onClick={() => setEditandoCarpeta({ ...editandoCarpeta, color: co })} />)}
            </div>
          </div>
        )}

        {editandoProy && (
          <div className="folder-editor proy-editor">
            <div className="fe-row">
              <input className="fe-name" placeholder="Nombre del proyecto" value={editandoProy.nombre} autoFocus
                onChange={(e) => setEditandoProy({ ...editandoProy, nombre: e.target.value })} onKeyDown={(e) => e.key === "Enter" && guardarProy()} />
              <button className="gbtn" onClick={guardarProy} disabled={busy}>Guardar</button>
              <button className="gbtn ghost" onClick={() => setEditandoProy(null)}>Cancelar</button>
            </div>
            <div className="fe-label">Icono del proyecto</div>
            <div className="fe-icons">
              {PROJ_ICONS.map((ic) => <button key={ic} className={`fe-icon ${editandoProy.icono === ic ? "on" : ""}`} onClick={() => setEditandoProy({ ...editandoProy, icono: ic })}>{ic}</button>)}
            </div>
            <div className="fe-label">Color del proyecto</div>
            <div className="fe-colors">
              {FOLDER_COLORS.map((co) => <button key={co} className={`fe-color ${editandoProy.color === co ? "on" : ""}`} style={{ background: co }} onClick={() => setEditandoProy({ ...editandoProy, color: co })} />)}
            </div>
            <div className="fe-label">Fuente del titulo</div>
            <div className="fe-fonts">
              {PROJ_FONTS.map((f) => (
                <button key={f.id} className={`fe-font ${editandoProy.fuente === f.id ? "on" : ""}`} style={{ fontFamily: f.css }}
                  onClick={() => setEditandoProy({ ...editandoProy, fuente: f.id })}>
                  {editandoProy.nombre || f.nombre}
                  <span className="fe-font-nm">{f.nombre}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {carpetas.map((f) => {
          const dentro = proyectos.filter((p) => p.carpeta_id === f.id);
          const open = abiertas.has(f.id);
          return (
            <div key={f.id} className="folder-box" style={{ "--fc": f.color }}>
              <div className="folder-head" onClick={() => toggleCarpeta(f.id)}>
                <div className="folder-head-l">
                  <span className={`folder-chev ${open ? "open" : ""}`}>▸</span>
                  <span className="folder-ic">{f.icono}</span>
                  <span className="folder-nm">{f.nombre}</span>
                  <span className="folder-ct">{dentro.length}</span>
                </div>
                {canEdit && (
                  <div className="folder-head-a" onClick={(e) => e.stopPropagation()}>
                    <button className="gbtn small" onClick={() => crear(f.id)} disabled={busy}>+ Proyecto</button>
                    <button className="gbtn small ghost" onClick={() => setEditandoCarpeta({ id: f.id, nombre: f.nombre, color: f.color, icono: f.icono })}>Editar</button>
                    <button className="gbtn small ghost" onClick={() => duplicarCarpeta(f)}>Duplicar</button>
                    <button className="gbtn small x" onClick={() => eliminarCarpeta(f)} title="Eliminar (vacia)">✕</button>
                  </div>
                )}
              </div>
              {open && <div className="folder-body">{dentro.length === 0 ? <p className="proj-empty">Carpeta vacia.</p> : dentro.map(proyItem)}</div>}
            </div>
          );
        })}

        <div className="proj-sincarpeta">
          {carpetas.length > 0 && sinCarpeta.length > 0 && <div className="proj-sc-tit">Sin carpeta</div>}
          {sinCarpeta.length === 0 && carpetas.length === 0 ? <p className="proj-empty">Aun no hay proyectos.{canEdit ? " Crea el primero abajo." : ""}</p> : sinCarpeta.map(proyItem)}
        </div>

        {canEdit && (
          <div className="proj-new">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del nuevo proyecto (sin carpeta)" onKeyDown={(e) => e.key === "Enter" && crear()} />
            <button className="gbtn" onClick={() => crear()} disabled={busy}>Crear proyecto</button>
            <label className="gbtn ghost import-btn">Importar JSON<input type="file" accept="application/json,.json" onChange={onImportFile} style={{ display: "none" }} /></label>
          </div>
        )}
      </div>
    </div>
  );
}

function tipoIE(s) {
  s = String(s || "").toUpperCase().trim();
  const hasI = s.includes("INT") || s.includes("I/E") || s.includes("E/I") || s.startsWith("I/");
  const hasE = s.includes("EXT") || s.includes("I/E") || s.includes("E/I") || s.startsWith("E/");
  if (hasI && hasE) return "mix";
  if (hasI) return "int";
  if (hasE) return "ext";
  return "otro";
}
function clasifLoc(tipos) {
  const t = [...tipos];
  if (t.length && t.every((x) => x === "int")) return "int";
  if (t.length && t.every((x) => x === "ext")) return "ext";
  return "mix";
}

function Resumen({ proyectoId, proyNombre }) {
  const [caps, setCaps] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("capitulos")
        .select("id, numero, escaleta, escenas(id, octavos, localizacion, decorado, int_ext, desglose_items(categoria, elemento, pp_num))")
        .eq("proyecto_id", proyectoId)
        .order("numero");
      if (error) setErr(error.message); else setCaps(data || []);
    })();
  }, [proyectoId]);

  if (err) return <div className="msg err">{err}</div>;
  if (caps === null) return <p className="muted">Cargando...</p>;
  if (!caps.length) return <p className="muted">Todavia no hay capitulos.</p>;

  const persGlobal = new Set();
  const locsGlobal = {};
  const decosGlobal = new Set();
  let octGlobal = 0, secsGlobal = 0, octEstimados = 0;
  const persVistos = new Set(), locsVistas = new Set(), decosVistos = new Set();

  const filas = caps.map((c) => {
    let oct = 0; const pers = new Set(); const locs = {}; const decos = new Set();
    let persNuevos = 0, locsNuevas = 0, decosNuevos = 0;
    const secsCap = (c.escenas || []).length;
    (c.escenas || []).forEach((e) => {
      oct += Number(e.octavos || 0);
      (e.desglose_items || []).filter((i) => i.categoria === "personajes" && !i.pp_num).forEach((i) => {
        const n = String(i.elemento || "").trim().toUpperCase();
        if (n) { pers.add(n); persGlobal.add(n); }
      });
      const loc = String(e.localizacion || "").trim().toUpperCase();
      if (loc) {
        (locs[loc] = locs[loc] || new Set()).add(tipoIE(e.int_ext));
        (locsGlobal[loc] = locsGlobal[loc] || new Set()).add(tipoIE(e.int_ext));
      }
      const dec = String(e.decorado || "").trim().toUpperCase();
      if (dec) { const key = loc + "||" + dec; decos.add(key); decosGlobal.add(key); }
    });
    // nuevos: los que no habian aparecido en capitulos anteriores
    pers.forEach((n) => { if (!persVistos.has(n)) { persVistos.add(n); persNuevos++; } });
    Object.keys(locs).forEach((l) => { if (!locsVistas.has(l)) { locsVistas.add(l); locsNuevas++; } });
    decos.forEach((d) => { if (!decosVistos.has(d)) { decosVistos.add(d); decosNuevos++; } });
    octGlobal += oct; secsGlobal += secsCap; if (c.escaleta) octEstimados += oct;
    return { num: c.numero, escaleta: !!c.escaleta, oct, secs: secsCap, pers: pers.size, persNuevos, locs: Object.keys(locs).length, locsNuevas, decos: decos.size, decosNuevos };
  });

  const nCaps = filas.length || 1;
  const totPers = persGlobal.size, totLocs = Object.keys(locsGlobal).length, totDecos = decosGlobal.size;
  const mediaPersCap = Math.round(filas.reduce((s, f) => s + f.pers, 0) / nCaps);
  const mediaLocsCap = Math.round(filas.reduce((s, f) => s + f.locs, 0) / nCaps);
  const mediaDecosCap = Math.round(filas.reduce((s, f) => s + f.decos, 0) / nCaps * 10) / 10;
  const mediaSecsCap = Math.round(secsGlobal / nCaps * 10) / 10;
  const mediaPgSec = secsGlobal ? fmtEighths(Math.round(octGlobal / secsGlobal)) : "-";
  const mediaPgLoc = totLocs ? fmtEighths(Math.round(octGlobal / totLocs)) : "-";
  const mediaPgDeco = totDecos ? fmtEighths(Math.round(octGlobal / totDecos)) : "-";

  let intC = 0, extC = 0, mixC = 0;
  Object.values(locsGlobal).forEach((set) => { const k = clasifLoc(set); if (k === "int") intC++; else if (k === "ext") extC++; else mixC++; });

  const COLS_RES = ["Capitulo", "Paginas", "Secuencias", "Personajes", "Pers. nuevos", "Localizaciones", "Local. nuevas", "Decorados", "Dec. nuevos"];
  const filasRes = () => filas.map((f) => [
    `Capitulo ${f.num}${f.escaleta ? " (escaleta)" : ""}`, fmtEighths(f.oct), f.secs, f.pers, f.persNuevos, f.locs, f.locsNuevas, f.decos, f.decosNuevos,
  ]);
  const totalesRes = ["TOTAL", fmtEighths(octGlobal) + " pg", secsGlobal, "", totPers, "", totLocs, "", totDecos];

  function exportResumenPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    const tarjetas = [
      { n: fmtEighths(octGlobal), l: "Paginas en total", subs: [`${fmtEighths(Math.round(octGlobal / nCaps))} pg / capitulo`].concat(octEstimados > 0 ? [`${fmtEighths(octEstimados)} pg estimadas (${Math.round((octEstimados / octGlobal) * 100)}%)`] : []) },
      { n: secsGlobal, l: "Secuencias en total", subs: [`${mediaSecsCap} sec / capitulo`, `${mediaPgSec} pg / secuencia`] },
      { n: totPers, l: "Personajes distintos", subs: [] },
      { n: totLocs, l: "Localizaciones distintas", subs: [`${intC} INT \u00b7 ${extC} EXT${mixC ? ` \u00b7 ${mixC} mixtas` : ""}`] },
      { n: totDecos, l: "Decorados distintos", subs: [] },
    ];
    let html = `<html><head><meta charset="utf-8"><title>Resumen</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;box-sizing:border-box;
        font-variant-ligatures:none;font-feature-settings:"liga" 0,"clig" 0;font-synthesis:none}
      body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:400;padding:22px;color:#111;text-rendering:geometricPrecision}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
      table{border-collapse:collapse;width:100%;font-size:11px;margin-bottom:18px}
      th,td{border:1px solid #cbd5e1;padding:5px 8px;text-align:right}
      th:first-child,td:first-child{text-align:left}
      th{background:#eef2ff;color:#1e293b;font-size:10px}
      tfoot td{font-weight:bold;background:#f8fafc;border-top:2px solid #cbd5e1}
      .nue{color:#0f766e;font-weight:bold}
      .cards{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
      .card{border:1px solid #cbd5e1;border-radius:6px;padding:9px 13px;min-width:132px;flex:1}
      .card .n{display:block;font-size:20px;font-weight:700;color:#0f172a}
      .card .l{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-top:2px}
      .card .s{display:block;font-size:10px;color:#475569;margin-top:3px}
      .medias{border:1px solid #cbd5e1;border-radius:6px;padding:9px 13px;margin-bottom:14px}
      .medias .l{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#1e40af;font-weight:700;display:block;margin-bottom:4px}
      .medias span.m{display:inline-block;font-size:11px;color:#334155;margin-right:16px}
      .pie-nota{font-size:10px;color:#64748b;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:8px}
      @media print{@page{size:A4 portrait;margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre || "")} \u2014 Resumen del proyecto</h1><div class="fecha">${fecha} \u00b7 BD Prod Tools</div>`;
    html += `<div class="cards">` + tarjetas.map((c) => `<div class="card"><span class="n">${esc(c.n)}</span><span class="l">${esc(c.l)}</span>${c.subs.map((x) => `<span class="s">${esc(x)}</span>`).join("")}</div>`).join("") + `</div>`;
    html += `<div class="medias"><span class="l">Medias por capitulo</span>`;
    html += [`${mediaPersCap} personajes`, `${mediaLocsCap} localizaciones`, `${mediaDecosCap} decorados`, `${mediaPgLoc} pg / localizacion`, `${mediaPgDeco} pg / decorado`].map((x) => `<span class="m">${esc(x)}</span>`).join("") + `</div>`;
    html += `<table><thead><tr>` + COLS_RES.map((c) => `<th>${esc(c)}</th>`).join("") + `</tr></thead><tbody>`;
    filas.forEach((f) => {
      html += `<tr><td>Capitulo ${f.num}${f.escaleta ? " (escaleta)" : ""}</td><td>${fmtEighths(f.oct)}</td><td>${f.secs}</td><td>${f.pers}</td><td class="nue">${f.persNuevos}</td><td>${f.locs}</td><td class="nue">${f.locsNuevas}</td><td>${f.decos}</td><td class="nue">${f.decosNuevos}</td></tr>`;
    });
    html += `</tbody><tfoot><tr><td>TOTAL</td><td>${fmtEighths(octGlobal)} pg</td><td>${secsGlobal}</td><td></td><td>${totPers}</td><td></td><td>${totLocs}</td><td></td><td>${totDecos}</td></tr></tfoot></table>`;
    html += `<div class="pie-nota">Las localizaciones se cuentan por nombre del encabezado. "Nuevos" son los que aparecen por primera vez en ese capitulo. En la fila TOTAL, las columnas de nuevos suman el total de distintos de la serie.</div>`;
    html += `</body></html>`;
    w.document.write(html); w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  return (
    <div className="card-lite">
      <div className="rep-bar" style={{ marginBottom: 6 }}>
        <h3 className="sub" style={{ margin: 0, flex: 1 }}>Resumen por capitulo</h3>
        <button className="btn" onClick={() => descargarCSV("resumen_proyecto.csv", [COLS_RES, ...filasRes(), totalesRes])}>CSV</button>
        <button className="btn" onClick={() => exportInformeExcel("Resumen del proyecto", proyNombre || "", COLS_RES, filasRes(), totalesRes)}>Excel</button>
        <button className="btn" onClick={exportResumenPDF}>PDF</button>
      </div>
      <div className="rep-table">
      <table className="resumen-tbl">
        <thead>
          <tr><th>Capitulo</th><th>Paginas</th><th>Secuencias</th><th>Personajes</th><th>Pers. nuevos</th><th>Localizaciones</th><th>Local. nuevas</th><th>Decorados</th><th>Dec. nuevos</th></tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.num}>
              <td>Capitulo {f.num}{f.escaleta && <span className="esc-badge-mini">escaleta</span>}</td>
              <td>{fmtEighths(f.oct)}</td>
              <td>{f.secs}</td>
              <td>{f.pers}</td>
              <td className="rt-new">{f.persNuevos}</td>
              <td>{f.locs}</td>
              <td className="rt-new">{f.locsNuevas}</td>
              <td>{f.decos}</td>
              <td className="rt-new">{f.decosNuevos}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>TOTAL</td>
            <td>{fmtEighths(octGlobal)} pg</td>
            <td>{secsGlobal}</td>
            <td></td>
            <td className="rt-new">{totPers}</td>
            <td></td>
            <td className="rt-new">{totLocs}</td>
            <td></td>
            <td className="rt-new">{totDecos}</td>
          </tr>
        </tfoot>
      </table>
      </div>
      <div className="resumen-totales">
        <div className="rt-card"><span className="rt-num">{fmtEighths(octGlobal)}</span><span className="rt-lab">Paginas en total</span><span className="rt-sub">{fmtEighths(Math.round(octGlobal / nCaps))} pg / capitulo</span>{octEstimados > 0 && <span className="rt-sub rt-est">{fmtEighths(octEstimados)} pg estimadas ({Math.round((octEstimados / octGlobal) * 100)}%)</span>}</div>
        <div className="rt-card"><span className="rt-num">{secsGlobal}</span><span className="rt-lab">Secuencias en total</span><span className="rt-sub">{mediaSecsCap} sec / capitulo</span><span className="rt-sub">{mediaPgSec} pg / secuencia</span></div>
        <div className="rt-card"><span className="rt-num">{totPers}</span><span className="rt-lab">Personajes distintos</span></div>
        <div className="rt-card">
          <span className="rt-num">{totLocs}</span>
          <span className="rt-lab">Localizaciones distintas</span>
          <span className="rt-sub">{intC} INT · {extC} EXT{mixC ? ` · ${mixC} mixtas` : ""}</span>
        </div>
        <div className="rt-card"><span className="rt-num">{totDecos}</span><span className="rt-lab">Decorados distintos</span></div>
        <div className="rt-card rt-medias">
          <span className="rt-lab rt-lab-azul">Medias por capitulo</span>
          <span className="rt-media-linea">{mediaPersCap} personajes / capitulo</span>
          <span className="rt-media-linea">{mediaLocsCap} localizaciones / capitulo</span>
          <span className="rt-media-linea">{mediaDecosCap} decorados / capitulo</span>
          <span className="rt-media-linea">{mediaPgLoc} pg / localizacion</span>
          <span className="rt-media-linea">{mediaPgDeco} pg / decorado</span>
        </div>
      </div>
      <p className="muted small">Las localizaciones se cuentan por nombre del encabezado. Personajes, localizaciones, decorados denominados "nuevos" son los que aparecen por primera vez en ese capitulo. En la fila TOTAL, las columnas Personajes/Localizaciones/Decorados suman los de cada capitulo (con repetidos), mientras que las columnas "nuevos" suman el total de distintos de la serie. Puntos a tener en cuenta: Una media alta de personajes por capitulo indica serie coral. A tener en cuenta la media de paginas por localizacion y por decorado, punto clave que incide de forma directa en el presupuesto.</p>
    </div>
  );
}

// ── v10.10: filtro por personajes (aparece / no aparece) ──
// sel = { NOMBRE: 1 (tiene que aparecer) | -1 (no puede aparecer) }
function pasaFiltroPers(persSet, sel) {
  const ent = Object.entries(sel || {});
  if (!ent.length) return true;
  for (const [nom, v] of ent) {
    if (v === 1 && !persSet.has(nom)) return false;
    if (v === -1 && persSet.has(nom)) return false;
  }
  return true;
}

function FiltroPers({ personajes, persMap, sel, setSel, queCosa }) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const lista = personajes.map((nom) => {
    const p = persMap[nom] || {};
    return { nom, num: p.numero == null ? null : p.numero, menor: !!p.menor };
  }).sort((a, b) => {
    if (a.num == null && b.num == null) return a.nom.localeCompare(b.nom);
    if (a.num == null) return 1; if (b.num == null) return -1; return a.num - b.num;
  });
  const filtro = q.trim().toUpperCase();
  const vistos = filtro ? lista.filter((p) => p.nom.includes(filtro)) : lista;
  const ciclo = (nom) => setSel((prev) => {
    const n = { ...prev };
    if (n[nom] === 1) n[nom] = -1; else if (n[nom] === -1) delete n[nom]; else n[nom] = 1;
    return n;
  });
  const si = Object.keys(sel).filter((k) => sel[k] === 1);
  const no = Object.keys(sel).filter((k) => sel[k] === -1);
  const activo = si.length || no.length;

  return (
    <div className="fpx">
      <div className="fpx-head">
        <button className="fpx-toggle" onClick={() => setAbierto((v) => !v)}>
          {abierto ? "▾" : "▸"} Filtrar por personajes
        </button>
        {activo ? (
          <span className="fpx-resumen">
            {si.length > 0 && <span className="fpx-si">Aparece{si.length > 1 ? "n" : ""}: {si.join(", ")}</span>}
            {si.length > 0 && no.length > 0 && <span className="muted"> · </span>}
            {no.length > 0 && <span className="fpx-no">No aparece{no.length > 1 ? "n" : ""}: {no.join(", ")}</span>}
          </span>
        ) : <span className="muted small">Sin filtro</span>}
        {activo ? <button className="fpx-lim" onClick={() => setSel({})}>Quitar filtro</button> : null}
      </div>
      {abierto && (
        <>
          <div className="fpx-ayuda">
            Un clic = <b className="fpx-si">tiene que aparecer</b> · dos clics = <b className="fpx-no">no puede aparecer</b> · tres clics lo quita.
            {queCosa ? ` Se muestran solo ${queCosa} que cumplan todo a la vez.` : ""}
          </div>
          <input className="buscador fpx-busca" placeholder="Buscar personaje..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="fpx-chips">
            {vistos.map((p) => (
              <button key={p.nom} className={`fpx-chip ${sel[p.nom] === 1 ? "si" : sel[p.nom] === -1 ? "no" : ""} ${p.menor ? "men" : ""}`}
                onClick={() => ciclo(p.nom)} title={sel[p.nom] === 1 ? "Tiene que aparecer" : sel[p.nom] === -1 ? "No puede aparecer" : "Sin filtrar"}>
                <i>{p.num == null ? "—" : p.num}</i>{p.nom}
              </button>
            ))}
            {vistos.length === 0 && <span className="muted small">Ningun personaje coincide.</span>}
          </div>
        </>
      )}
    </div>
  );
}

// ── v10.7: estilos compartidos de las pestanas Decorados / Localizaciones ──
function EstilosDeco() {
  return <style>{`
    .dcx-card { background:#fff; border:1px solid #e4e4e7; border-radius:10px; padding:12px 14px; margin-bottom:8px; }
    .dcx-head { display:flex; align-items:baseline; gap:9px; flex-wrap:wrap; }
    .dcx-nom { font-weight:700; font-size:15px; }
    .dcx-loc { font-size:12px; color:#71717a; }
    .dcx-loc b { color:#3f3f46; font-weight:600; }
    .dcx-stats { margin-left:auto; display:flex; gap:12px; font-size:12px; color:#52525b; }
    .dcx-stats b { color:#18181b; }
    .dcx-linea { font-size:12px; margin-top:6px; line-height:1.9; }
    .dcx-lbl { color:#71717a; margin-right:4px; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.03em; }
    .dcx-pill { font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px; letter-spacing:.04em; white-space:nowrap; }
    .dcx-ie { background:#f1f5f9; color:#334155; border:1px solid #e2e8f0; }
    .dcx-esp { background:#ecfdf5; color:#065f46; border:1px solid #d1fae5; }
    .dcx-off { background:#f4f4f5; color:#a1a1aa; }
    .dcx-per { display:inline-flex; align-items:center; gap:4px; background:#fff; border:1px solid #e4e4e7; border-radius:5px; padding:1px 7px 1px 3px; font-size:11px; margin-right:3px; }
    .dcx-per i { font-style:normal; background:#1e293b; color:#fff; font-size:9px; font-weight:700; border-radius:3px; padding:1px 4px; min-width:16px; text-align:center; }
    .dcx-per.men i { background:#dc2626; }
    .dcx-per.sn i { background:#a1a1aa; }
    .dcx-ord { display:flex; gap:4px; }
    .dcx-ord button { padding:5px 10px; font-size:12px; font-weight:600; border:1px solid #d4d4d8; background:#fff; border-radius:7px; cursor:pointer; color:#52525b; }
    .dcx-ord button.on { background:#0f766e; border-color:#0f766e; color:#fff; }
    .dcx-terr-in { font-size:10px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; padding:2px 9px;
      border:1px solid #d4d4d8; border-radius:20px; background:#fff; color:#52525b; font-family:inherit; width:130px; outline:none; }
    .dcx-terr-in:hover { border-color:#0f766e; }
    .dcx-terr-in:focus { border-color:#0f766e !important; box-shadow:0 0 0 2px rgba(15,118,110,.12); color:#18181b !important; }
    .dcx-terr-in::placeholder { color:#a1a1aa; font-weight:400; text-transform:none; letter-spacing:0; }
    .dcx-per.hit { background:#ecfdf5; border-color:#0f766e; }
    .dcx-per.hit-no { background:#fef2f2; border-color:#fca5a5; }

    .fpx { background:#fff; border:1px solid #e4e4e7; border-radius:10px; padding:9px 12px; margin-bottom:12px; }
    .fpx-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .fpx-toggle { background:none; border:0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:#52525b; cursor:pointer; font-family:inherit; padding:0; }
    .fpx-resumen { font-size:12px; }
    .fpx-si { color:#0f766e; font-weight:600; }
    .fpx-no { color:#dc2626; font-weight:600; }
    .fpx-lim { margin-left:auto; background:none; border:0; color:#0f766e; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; }
    .fpx-ayuda { font-size:11px; color:#71717a; margin-top:8px; }
    .fpx-busca { margin-top:7px; width:100%; max-width:240px; display:block; }
    .fpx-chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; max-height:140px; overflow-y:auto; }
    .fpx-chip { display:inline-flex; align-items:center; gap:5px; background:#fff; border:1px solid #e4e4e7; border-radius:6px; padding:2px 8px 2px 3px; font-size:11px; cursor:pointer; font-family:inherit; color:#18181b; }
    .fpx-chip i { font-style:normal; background:#1e293b; color:#fff; font-size:9px; font-weight:700; border-radius:3px; padding:1px 4px; min-width:16px; text-align:center; }
    .fpx-chip.men i { background:#dc2626; }
    .fpx-chip.si { background:#0f766e; border-color:#0f766e; color:#fff; }
    .fpx-chip.no { background:#dc2626; border-color:#dc2626; color:#fff; }
    .fpx-chip.si i, .fpx-chip.no i { background:rgba(255,255,255,.25); }

    .lcx-nota { width:100%; font-size:12px; border:1px solid #e4e4e7; border-radius:7px; padding:6px 9px; color:#52525b; background:#fcfcfd; margin-bottom:9px; font-family:inherit; resize:vertical; }
    .lcx-nom-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .lcx-in { flex:1; min-width:200px; font-size:15px; font-weight:700; border:1px solid transparent; border-radius:7px; padding:5px 8px; background:transparent; font-family:inherit; color:#18181b; }
    .lcx-in:hover { border-color:#e4e4e7; background:#fafafa; }
    .lcx-in:focus { border-color:#0f766e; background:#fff; outline:none; }
    .lcx-stats { display:flex; gap:11px; font-size:12px; color:#52525b; white-space:nowrap; flex-wrap:wrap; }
    .lcx-stats b { color:#18181b; }
    .lcx-extras { display:flex; gap:10px; align-items:flex-start; margin-top:9px; padding-top:9px; border-top:1px solid #f1f5f9; flex-wrap:wrap; }
  `}</style>;
}

// Lista de personajes con su numero de reparto (ordenada por numero)
function PersLinea({ nombres, persMap, etiqueta, sel }) {
  const arr = Array.from(nombres).map((nom) => {
    const p = persMap[nom] || {};
    return { nom, num: p.numero == null ? null : p.numero, menor: !!p.menor };
  }).sort((a, b) => {
    if (a.num == null && b.num == null) return a.nom.localeCompare(b.nom);
    if (a.num == null) return 1;
    if (b.num == null) return -1;
    return a.num - b.num;
  });
  return (
    <div className="dcx-linea">
      <span className="dcx-lbl">{etiqueta || "Personajes"} ({arr.length})</span>
      {arr.length === 0 ? <span className="muted">-</span> : arr.map((p) => (
        <span key={p.nom} className={`dcx-per ${p.menor ? "men" : ""} ${p.num == null ? "sn" : ""} ${sel && sel[p.nom] === 1 ? "hit" : ""}`}>
          <i>{p.num == null ? "—" : p.num}</i>{p.nom}
        </span>
      ))}
    </div>
  );
}

const ESPACIO_LBL = { plato: "Plato", exteriores: "Exteriores", ext_noche: "Ext. noche" };
function pillIE(ies) {
  const s = Array.from(ies).filter(Boolean);
  if (!s.length) return <span className="dcx-pill dcx-off">sin INT/EXT</span>;
  const hayInt = s.some((x) => x.includes("INT")), hayExt = s.some((x) => x.includes("EXT"));
  const txt = hayInt && hayExt ? "INT / EXT" : hayInt ? "INT" : "EXT";
  return <span className="dcx-pill dcx-ie">{txt}</span>;
}
function pillEsp(esps) {
  const s = Array.from(esps).filter(Boolean);
  if (!s.length) return <span className="dcx-pill dcx-off">sin espacio</span>;
  const txt = s.length === 1 ? (ESPACIO_LBL[s[0]] || s[0]) : s.map((x) => (x === "plato" ? "Plato" : "Ext.")).filter((v, i, a) => a.indexOf(v) === i).join(" + ");
  return <span className="dcx-pill dcx-esp">{txt}</span>;
}
function pillTerr(terrs, colorDe) {
  const s = Array.from(terrs).filter(Boolean);
  if (!s.length) return <span className="dcx-pill dcx-off">sin territorio</span>;
  return <>{s.map((t) => {
    const c = colorDe ? colorDe(t) : "#64748b";
    return <span key={t} className="dcx-pill" style={{ background: c + "22", color: c, border: `1px solid ${c}55` }}>{t}</span>;
  })}</>;
}

function Decorados({ proyectoId, canEdit, irASecuencia }) {
  const [escenas, setEscenas] = useState(null);
  const [persMap, setPersMap] = useState({});
  const [decoTerr, setDecoTerr] = useState({});
  const [terrColor, setTerrColor] = useState({});
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState("guion");
  const [selPers, setSelPers] = useState({});
  const [busy, setBusy] = useState(false);

  async function cambiarTerritorio(d, nuevo) {
    const nv = (nuevo || "").trim();
    const actual = Array.from(d.terrs).join(" / ");
    if (nv === actual) return;
    const n = d.ids.length;
    if (!window.confirm(`Cambiar el territorio de "${d.loc} / ${d.deco}" a ${nv ? `"${nv}"` : "(sin territorio)"}?\n\nSe aplicara a sus ${n} secuencia(s) en el desglose${actual ? ` (ahora: ${actual})` : ""}.`)) { setErr(null); cargar(); return; }
    setBusy(true); setErr(null);
    try {
      for (let i = 0; i < d.ids.length; i += 200) {
        const { error } = await supabase.from("escenas").update({ territorio: nv }).in("id", d.ids.slice(i, i + 200));
        if (error) throw error;
      }
      if (d.deco !== "(sin decorado)") {
        await supabase.from("loc_notas").upsert({ proyecto_id: proyectoId, tipo: "deco", localizacion: d.loc, decorado: d.deco, territorio: nv, updated_at: new Date().toISOString() }, { onConflict: "proyecto_id,tipo,localizacion,decorado" });
      }
      await logActividad(proyectoId, "Cambio el territorio de un decorado", `${d.loc} / ${d.deco}: ${actual || "(sin territorio)"} -> ${nv || "(sin territorio)"} (${n} secs)`);
      await cargar();
    } catch (e) { setErr("No se pudo cambiar el territorio: " + (e.message || e)); }
    setBusy(false);
  }

  async function cargar() {
    setErr(null);
    const { data: caps, error } = await supabase.from("capitulos")
      .select("numero, escenas(id, uid, orden, localizacion, decorado, territorio, int_ext, espacio, octavos, desglose_items(categoria, elemento))")
      .eq("proyecto_id", proyectoId);
    if (error) { setErr(error.message); return; }
    const es = []; (caps || []).forEach((c) => (c.escenas || []).forEach((e) => es.push({ ...e, capNum: c.numero })));
    setEscenas(es);
    const { data: prs } = await supabase.from("personajes").select("nombre, numero, menor").eq("proyecto_id", proyectoId);
    const pm = {}; (prs || []).forEach((p) => { const k = String(p.nombre || "").trim().toUpperCase(); if (k) pm[k] = { numero: p.numero, menor: !!p.menor }; });
    setPersMap(pm);
    const { data: nt } = await supabase.from("loc_notas").select("*").eq("proyecto_id", proyectoId).eq("tipo", "deco");
    const t = {}; (nt || []).forEach((n) => { t[`${n.localizacion}|${n.decorado}`] = n.territorio || ""; });
    setDecoTerr(t);
    const { data: tc } = await supabase.from("territorio_colores").select("territorio, color").eq("proyecto_id", proyectoId);
    const cm = {}; (tc || []).forEach((c) => { cm[c.territorio] = c.color; }); setTerrColor(cm);
  }
  useEffect(() => { cargar(); }, [proyectoId]);

  if (err) return <div className="msg err">{err}</div>;
  if (escenas === null) return <p className="muted">Cargando...</p>;

  const map = {};
  escenas.forEach((e) => {
    const loc = (e.localizacion || "").trim();
    if (!loc) return;
    const deco = (e.decorado || "").trim() || "(sin decorado)";
    const key = `${loc}|${deco}`;
    const g = (e.capNum || 0) * 100000 + (e.orden || 0);
    if (!map[key]) map[key] = { key, loc, deco, primera: g, secs: [], ids: [], porCap: {}, oct: 0, ies: new Set(), esps: new Set(), terrs: new Set(), pers: new Set() };
    const d = map[key];
    if (g < d.primera) d.primera = g;
    if (e.uid) d.secs.push(e.uid);
    d.ids.push(e.id);
    d.porCap[e.capNum] = (d.porCap[e.capNum] || 0) + 1;
    d.oct += Number(e.octavos || 0);
    const ie = normIE(e.int_ext); if (ie) d.ies.add(ie);
    if ((e.espacio || "").trim()) d.esps.add(e.espacio);
    if ((e.territorio || "").trim()) d.terrs.add((e.territorio || "").trim());
    (e.desglose_items || []).forEach((i) => { if (i.categoria !== "personajes") return; const k = String(i.elemento || "").trim().toUpperCase(); if (k) d.pers.add(k); });
  });
  let lista = Object.values(map);
  lista.forEach((d) => {
    d.secs = Array.from(new Set(d.secs)).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    if (!d.terrs.size) { const t = decoTerr[d.key]; if (t) d.terrs.add(t); }
  });
  if (orden === "loc") lista.sort((a, b) => a.loc.localeCompare(b.loc) || a.deco.localeCompare(b.deco));
  else if (orden === "secs") lista.sort((a, b) => b.secs.length - a.secs.length || a.primera - b.primera);
  else lista.sort((a, b) => a.primera - b.primera);

  const filtro = q.trim().toLowerCase();
  let vistos = filtro ? lista.filter((d) => d.deco.toLowerCase().includes(filtro) || d.loc.toLowerCase().includes(filtro)) : lista;
  vistos = vistos.filter((d) => pasaFiltroPers(d.pers, selPers));
  const todosPers = Array.from(new Set([].concat(...lista.map((d) => Array.from(d.pers)))));
  const colorDe = (t) => terrColor[t] || PALETA[Math.abs(String(t).split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETA.length];
  const porCapTxt = (pc) => Object.keys(pc).map(Number).sort((a, b) => a - b).map((c) => `c${c}: ${pc[c]}`).join(" · ");

  if (!lista.length) return <p className="muted">Todavia no hay decorados. Aparecen al desglosar o rellenar el decorado de las secuencias.</p>;

  return (
    <div>
      <EstilosDeco />
      <div className="section-head" style={{ marginTop: 4, flexWrap: "wrap" }}>
        <h3 className="sub" style={{ margin: 0 }}>Decorados - {lista.length}</h3>
        <div className="dcx-ord">
          <button className={orden === "guion" ? "on" : ""} onClick={() => setOrden("guion")}>Orden de guion</button>
          <button className={orden === "loc" ? "on" : ""} onClick={() => setOrden("loc")}>Por localizacion</button>
          <button className={orden === "secs" ? "on" : ""} onClick={() => setOrden("secs")}>Mas secuencias</button>
        </div>
        <input className="buscador" style={{ marginLeft: "auto" }} placeholder="Buscar decorado..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="muted small">Todos los decorados del proyecto. Un decorado es la pareja localizacion + decorado. Pincha en una secuencia para ir a ella.{canEdit ? " Puedes escribir el territorio de un decorado y se aplica a todas sus secuencias." : ""}</p>
      <datalist id="dcx-terr-list">
        {Array.from(new Set(escenas.map((e) => (e.territorio || "").trim()).filter(Boolean))).sort().map((t) => <option key={t} value={t} />)}
      </datalist>
      {busy && <p className="muted small">Guardando...</p>}
      <FiltroPers personajes={todosPers} persMap={persMap} sel={selPers} setSel={setSelPers} queCosa="los decorados" />
      {Object.keys(selPers).length > 0 && <p className="muted small">Mostrando {vistos.length} de {lista.length} decorados.</p>}
      {vistos.map((d) => (
        <div key={d.key} className="dcx-card">
          <div className="dcx-head">
            <span className="dcx-nom">{d.deco}</span>
            <span className="dcx-loc">en <b>{d.loc}</b></span>
            {pillIE(d.ies)}
            {pillEsp(d.esps)}
            {canEdit ? (
              <span className="dcx-terr-edit" title="Cambiar el territorio de este decorado en el desglose">
                <input list="dcx-terr-list" className="dcx-terr-in" disabled={busy}
                  style={d.terrs.size === 1 ? { color: colorDe(Array.from(d.terrs)[0]), borderColor: colorDe(Array.from(d.terrs)[0]) + "66" } : undefined}
                  key={d.key + "|" + Array.from(d.terrs).join(",")}
                  defaultValue={Array.from(d.terrs).join(" / ")}
                  placeholder="sin territorio"
                  onBlur={(ev) => cambiarTerritorio(d, ev.target.value)}
                  onKeyDown={(ev) => { if (ev.key === "Enter") ev.target.blur(); }} />
              </span>
            ) : pillTerr(d.terrs, colorDe)}
            <span className="dcx-stats"><span><b>{d.secs.length}</b> secs</span><span><b>{fmtEighths(d.oct)}</b> pg</span></span>
          </div>
          <div className="muted small" style={{ marginTop: 5 }}>{porCapTxt(d.porCap)}</div>
          <PersLinea nombres={d.pers} persMap={persMap} sel={selPers} />
          <div className="dcx-linea">
            <span className="dcx-lbl">Secuencias</span>
            {d.secs.map((u) => <span key={u}><button className="sec-link" onClick={() => irASecuencia && irASecuencia(u, "decorados")}>{u}</button>{" "}</span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Localizaciones({ proyectoId, canEdit, irASecuencia }) {
  const [escenas, setEscenas] = useState(null);
  const [notas, setNotas] = useState({});
  const [decoTerr, setDecoTerr] = useState({});
  const [links, setLinks] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [subiendo, setSubiendo] = useState("");
  const [persMap, setPersMap] = useState({});
  const [selPers, setSelPers] = useState({});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  async function cargar() {
    setErr(null);
    const { data: caps, error } = await supabase.from("capitulos").select("numero, escenas(id, uid, orden, localizacion, decorado, territorio, int_ext, espacio, octavos, desglose_items(categoria, elemento))").eq("proyecto_id", proyectoId);
    if (error) { setErr(error.message); return; }
    const es = []; (caps || []).forEach((c) => (c.escenas || []).forEach((e) => es.push({ ...e, capNum: c.numero })));
    setEscenas(es);
    const { data: nt } = await supabase.from("loc_notas").select("*").eq("proyecto_id", proyectoId);
    const m = {}; const t = {}; (nt || []).forEach((n) => { m[`${n.tipo}|${n.localizacion}|${n.decorado}`] = n.nota; t[`${n.tipo}|${n.localizacion}|${n.decorado}`] = n.territorio || ""; });
    setNotas(m); setDecoTerr(t);
    const { data: lk } = await supabase.from("loc_links").select("*").eq("proyecto_id", proyectoId).order("created_at");
    setLinks(lk || []);
    const { data: ft } = await supabase.from("loc_fotos").select("*").eq("proyecto_id", proyectoId).order("created_at");
    setFotos(ft || []);
    const { data: prs } = await supabase.from("personajes").select("nombre, numero, menor").eq("proyecto_id", proyectoId);
    const pmap = {}; (prs || []).forEach((pp) => { const k = String(pp.nombre || "").trim().toUpperCase(); if (k) pmap[k] = { numero: pp.numero, menor: !!pp.menor }; });
    setPersMap(pmap);
  }
  useEffect(() => { cargar(); }, [proyectoId]);

  async function renombrarLoc(viejo, nuevo) {
    const nv = (nuevo || "").trim(); if (!nv || nv === viejo) return;
    setBusy(true); setErr(null);
    try {
      const ids = escenas.filter((e) => (e.localizacion || "").trim() === viejo).map((e) => e.id);
      for (let i = 0; i < ids.length; i += 200) await supabase.from("escenas").update({ localizacion: nv }).in("id", ids.slice(i, i + 200));
      await supabase.from("loc_notas").update({ localizacion: nv }).eq("proyecto_id", proyectoId).eq("localizacion", viejo);
      await supabase.from("loc_links").update({ localizacion: nv }).eq("proyecto_id", proyectoId).eq("localizacion", viejo);
      await supabase.from("loc_fotos").update({ localizacion: nv }).eq("proyecto_id", proyectoId).eq("localizacion", viejo);
      await logActividad(proyectoId, "Renombro localizacion", `${viejo} -> ${nv}`);
      await cargar();
    } catch (e) { setErr("No se pudo renombrar: " + (e.message || e)); }
    setBusy(false);
  }
  async function renombrarDeco(loc, viejo, nuevo) {
    const nv = (nuevo || "").trim(); if (!nv || nv === viejo) return;
    setBusy(true); setErr(null);
    try {
      const ids = escenas.filter((e) => (e.localizacion || "").trim() === loc && (e.decorado || "").trim() === viejo).map((e) => e.id);
      for (let i = 0; i < ids.length; i += 200) await supabase.from("escenas").update({ decorado: nv }).in("id", ids.slice(i, i + 200));
      await supabase.from("loc_notas").update({ decorado: nv }).eq("proyecto_id", proyectoId).eq("localizacion", loc).eq("decorado", viejo);
      await logActividad(proyectoId, "Renombro decorado", `${loc}: ${viejo} -> ${nv}`);
      await cargar();
    } catch (e) { setErr("No se pudo renombrar: " + (e.message || e)); }
    setBusy(false);
  }
  async function guardarNota(tipo, loc, deco, nota) {
    const key = `${tipo}|${loc}|${deco}`;
    setNotas((prev) => ({ ...prev, [key]: nota }));
    await supabase.from("loc_notas").upsert({ proyecto_id: proyectoId, tipo, localizacion: loc, decorado: deco, nota, updated_at: new Date().toISOString() }, { onConflict: "proyecto_id,tipo,localizacion,decorado" });
  }
  async function guardarDecoTerr(loc, deco, territorio) {
    const key = `deco|${loc}|${deco}`;
    setDecoTerr((prev) => ({ ...prev, [key]: territorio }));
    await supabase.from("loc_notas").upsert({ proyecto_id: proyectoId, tipo: "deco", localizacion: loc, decorado: deco, territorio, updated_at: new Date().toISOString() }, { onConflict: "proyecto_id,tipo,localizacion,decorado" });
  }
  async function anadirLink(loc) {
    const url = prompt("Pega el link (URL):"); if (!url || !url.trim()) return;
    const titulo = prompt("Titulo del link (opcional):", "") || "";
    const { error } = await supabase.from("loc_links").insert({ proyecto_id: proyectoId, localizacion: loc, titulo: titulo.trim(), url: url.trim() });
    if (error) { setErr(error.message); return; }
    await logActividad(proyectoId, "Anadio link a localizacion", loc);
    await cargar();
  }
  async function borrarLink(id) {
    if (!confirm("Borrar este link?")) return;
    await supabase.from("loc_links").delete().eq("id", id);
    await cargar();
  }
  async function subirFoto(loc, file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("El archivo debe ser una imagen."); return; }
    setSubiendo(loc); setErr(null);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${proyectoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("Loc-fotos").upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("Loc-fotos").getPublicUrl(path);
      const { error: insErr } = await supabase.from("loc_fotos").insert({ proyecto_id: proyectoId, localizacion: loc, path, url: pub.publicUrl });
      if (insErr) throw insErr;
      await logActividad(proyectoId, "Anadio foto a localizacion", loc);
      await cargar();
    } catch (e) { setErr("No se pudo subir la foto: " + (e.message || e)); }
    setSubiendo("");
  }
  async function borrarFoto(f) {
    if (!confirm("Borrar esta foto?")) return;
    await supabase.storage.from("Loc-fotos").remove([f.path]);
    await supabase.from("loc_fotos").delete().eq("id", f.id);
    await cargar();
  }

  if (err) return <div className="msg err">{err}</div>;
  if (escenas === null) return <p className="muted">Cargando...</p>;

  const locMap = {};
  escenas.forEach((e) => {
    const loc = (e.localizacion || "").trim(); if (!loc) return;
    const g = (e.capNum || 0) * 100000 + (e.orden || 0);
    if (!locMap[loc]) locMap[loc] = { nombre: loc, primera: g, porCap: {}, decos: {}, secs: [], pers: new Set(), oct: 0 };
    if (g < locMap[loc].primera) locMap[loc].primera = g;
    locMap[loc].oct += Number(e.octavos || 0);
    locMap[loc].porCap[e.capNum] = (locMap[loc].porCap[e.capNum] || 0) + 1;
    if (e.uid) locMap[loc].secs.push(e.uid);
    (e.desglose_items || []).forEach((i) => { if (i.categoria !== "personajes") return; const kp = String(i.elemento || "").trim().toUpperCase(); if (kp) locMap[loc].pers.add(kp); });
    const dec = (e.decorado || "").trim(); const k = dec || "(sin decorado)";
    if (!locMap[loc].decos[k]) locMap[loc].decos[k] = { nombre: k, primera: g, territorio: (e.territorio || "").trim(), ies: new Set(), esps: new Set(), nsecs: 0 };
    if (g < locMap[loc].decos[k].primera) locMap[loc].decos[k].primera = g;
    if (!locMap[loc].decos[k].territorio && (e.territorio || "").trim()) locMap[loc].decos[k].territorio = (e.territorio || "").trim();
    locMap[loc].decos[k].nsecs++;
    { const ie = normIE(e.int_ext); if (ie) locMap[loc].decos[k].ies.add(ie); }
    if ((e.espacio || "").trim()) locMap[loc].decos[k].esps.add(e.espacio);
  });
  const locs = Object.values(locMap).sort((a, b) => a.primera - b.primera);
  locs.forEach((l) => { l.decoList = Object.values(l.decos).sort((a, b) => a.primera - b.primera); l.secs = Array.from(new Set(l.secs)).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })); });
  if (!locs.length) return <p className="muted">Todavia no hay localizaciones. Aparecen al desglosar o rellenar la localizacion de las secuencias.</p>;

  const porCapTxt = (pc) => Object.keys(pc).map(Number).sort((a, b) => a - b).map((c) => `c${c}: ${pc[c]}`).join(" · ");

  return (
    <div>
      <EstilosDeco />
      <div className="section-head" style={{ marginTop: 4 }}>
        <h3 className="sub" style={{ margin: 0 }}>Localizaciones - {locs.length}</h3>
        <input className="buscador" placeholder="Buscar localizacion..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="muted small">Por orden de aparicion en el guion. Corrige el nombre y se cambia en todas las secuencias. Notas y links son solo informativos.</p>
      <FiltroPers personajes={Array.from(new Set([].concat(...locs.map((l) => Array.from(l.pers)))))} persMap={persMap} sel={selPers} setSel={setSelPers} queCosa="las localizaciones" />
      {(() => { const vis = locs.filter((loc) => loc.nombre.toLowerCase().includes(q.trim().toLowerCase())).filter((loc) => pasaFiltroPers(loc.pers, selPers));
        return (<>
      {Object.keys(selPers).length > 0 && <p className="muted small">Mostrando {vis.length} de {locs.length} localizaciones.</p>}
      {vis.map((loc) => {
        const lks = links.filter((l) => l.localizacion === loc.nombre);
        return (
          <div key={loc.nombre} className="loc-card">
            {canEdit
              ? <textarea className="lcx-nota" rows={1} placeholder="Notas de la localizacion..." defaultValue={notas[`loc|${loc.nombre}|`] || ""} key={"n" + loc.nombre} onBlur={(e) => guardarNota("loc", loc.nombre, "", e.target.value)} />
              : (notas[`loc|${loc.nombre}|`] ? <div className="lcx-nota">{notas[`loc|${loc.nombre}|`]}</div> : null)}
            <div className="lcx-nom-row">
              {canEdit
                ? <input className="lcx-in" key={loc.nombre} defaultValue={loc.nombre} disabled={busy} onBlur={(e) => renombrarLoc(loc.nombre, e.target.value)} />
                : <span className="lcx-in">{loc.nombre}</span>}
              <span className="lcx-stats">
                <span><b>{loc.secs.length}</b> secs</span>
                <span><b>{fmtEighths(loc.oct)}</b> pg</span>
                <span className="muted">{porCapTxt(loc.porCap)}</span>
              </span>
            </div>
            <div className="dcx-linea"><span className="dcx-lbl">Secuencias</span>
              {loc.secs.map((u) => <span key={u}><button className="sec-link" onClick={() => irASecuencia && irASecuencia(u, "localizaciones")}>{u}</button>{" "}</span>)}
            </div>
            <PersLinea nombres={loc.pers} persMap={persMap} sel={selPers} />

            <div className="loc-links lcx-extras">
              {lks.map((l) => (
                <span key={l.id} className="loc-link-pill">
                  <a href={l.url} target="_blank" rel="noopener noreferrer">{l.titulo || l.url}</a>
                  {canEdit && <button className="link-x" title="Borrar link" onClick={() => borrarLink(l.id)}>x</button>}
                </span>
              ))}
              {canEdit && <button className="btn ghost mini" onClick={() => anadirLink(loc.nombre)}>+ link</button>}
            </div>

            <div className="loc-fotos">
              {fotos.filter((f) => f.localizacion === loc.nombre).map((f) => (
                <div key={f.id} className="loc-foto">
                  <a href={f.url} target="_blank" rel="noopener noreferrer"><img src={f.url} alt="" loading="lazy" /></a>
                  {canEdit && <button className="foto-x" title="Borrar foto" onClick={() => borrarFoto(f)}>x</button>}
                </div>
              ))}
              {canEdit && (
                <label className={`foto-add ${subiendo === loc.nombre ? "load" : ""}`}>
                  {subiendo === loc.nombre ? "Subiendo..." : "+ foto"}
                  <input type="file" accept="image/*" hidden disabled={subiendo === loc.nombre} onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; subirFoto(loc.nombre, f); }} />
                </label>
              )}
            </div>

            <div className="deco-sub">
              <div className="muted small" style={{ marginBottom: 4 }}>Decorados</div>
              {loc.decoList.map((d) => (
                <div key={d.nombre} className="deco-row">
                  {canEdit && d.nombre !== "(sin decorado)"
                    ? <input className="deco-in" key={loc.nombre + d.nombre} defaultValue={d.nombre} disabled={busy} onBlur={(e) => renombrarDeco(loc.nombre, d.nombre, e.target.value)} />
                    : <span className="deco-nom">{d.nombre}</span>}
                  {pillIE(d.ies)}
                  {pillEsp(d.esps)}
                  <span className="muted small">{d.nsecs} secs</span>
                  {canEdit && d.nombre !== "(sin decorado)" && <input className="deco-terr" placeholder="Territorio" defaultValue={d.territorio || decoTerr[`deco|${loc.nombre}|${d.nombre}`] || ""} key={"dt" + loc.nombre + d.nombre + (d.territorio || "")} onBlur={(e) => guardarDecoTerr(loc.nombre, d.nombre, e.target.value)} />}
                  {canEdit && d.nombre !== "(sin decorado)" && <input className="deco-nota" placeholder="Nota" defaultValue={notas[`deco|${loc.nombre}|${d.nombre}`] || ""} key={"dn" + loc.nombre + d.nombre} onBlur={(e) => guardarNota("deco", loc.nombre, d.nombre, e.target.value)} />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
        </>);
      })()}
    </div>
  );
}

// ── v10.11: pestana de Pequenas partes ──
function PequenasPartes({ proyectoId, canEdit, irASecuencia }) {
  const [escenas, setEscenas] = useState(null);
  const [terrColor, setTerrColor] = useState({});
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState("num");

  async function cargar() {
    setErr(null);
    const { data: caps, error } = await supabase.from("capitulos")
      .select("numero, escenas(id, uid, orden, localizacion, decorado, territorio, espacio, int_ext, octavos, desglose_items(categoria, elemento, pp_num))")
      .eq("proyecto_id", proyectoId);
    if (error) { setErr(error.message); return; }
    const es = []; (caps || []).forEach((c) => (c.escenas || []).forEach((e) => es.push({ ...e, capNum: c.numero })));
    setEscenas(es);
    const { data: tc } = await supabase.from("territorio_colores").select("territorio, color").eq("proyecto_id", proyectoId);
    const cm = {}; (tc || []).forEach((c) => { cm[c.territorio] = c.color; }); setTerrColor(cm);
  }
  useEffect(() => { cargar(); }, [proyectoId]);

  if (err) return <div className="msg err">{err}</div>;
  if (escenas === null) return <p className="muted">Cargando...</p>;

  const ESP_LBL_PP = { plato: "Plato", exteriores: "Exteriores", ext_noche: "Ext. noche" };
  const map = {};
  escenas.forEach((e) => {
    (e.desglose_items || []).forEach((i) => {
      if (i.categoria !== "pequenaParte") return;
      const nom = String(i.elemento || "").trim();
      if (!nom) return;
      const k = nom.toUpperCase();
      const g = (e.capNum || 0) * 100000 + (e.orden || 0);
      if (!map[k]) map[k] = { nombre: nom, num: i.pp_num ?? null, primera: g, secs: [], oct: 0, terrs: new Set(), locs: new Set(), caps: new Set() };
      const d = map[k];
      if (d.num == null && i.pp_num != null) d.num = i.pp_num;
      if (g < d.primera) d.primera = g;
      d.oct += Number(e.octavos || 0);
      d.caps.add(e.capNum);
      const terr = (e.territorio || "").trim();
      const loc = (e.localizacion || "").trim();
      if (terr) d.terrs.add(terr);
      if (loc) d.locs.add(loc.toUpperCase());
      d.secs.push({
        uid: e.uid, cap: e.capNum, loc: loc || "-", deco: (e.decorado || "").trim() || "",
        terr: terr || "-", esp: (e.espacio || "").trim() ? (ESP_LBL_PP[e.espacio] || e.espacio) : "-",
        ie: normIE(e.int_ext) || "", oct: Number(e.octavos || 0), g,
      });
    });
  });
  let lista = Object.values(map);
  lista.forEach((d) => d.secs.sort((a, b) => a.g - b.g));
  if (orden === "secs") lista.sort((a, b) => b.secs.length - a.secs.length || a.primera - b.primera);
  else if (orden === "guion") lista.sort((a, b) => a.primera - b.primera);
  else lista.sort((a, b) => {
    if (a.num == null && b.num == null) return a.primera - b.primera;
    if (a.num == null) return 1; if (b.num == null) return -1; return a.num - b.num;
  });

  if (!lista.length) return <p className="muted">Todavia no hay pequenas partes. Se dan de alta en la pestana Figuracion o al desglosar.</p>;

  const filtro = q.trim().toLowerCase();
  const vistos = filtro ? lista.filter((d) => d.nombre.toLowerCase().includes(filtro) || d.secs.some((x) => x.loc.toLowerCase().includes(filtro))) : lista;
  const colorDe = (t) => terrColor[t] || PALETA[Math.abs(String(t).split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETA.length];
  const totSecs = lista.reduce((a, d) => a + d.secs.length, 0);

  const COLS = ["PP", "Pequena parte", "Secuencia", "Cap", "Localizacion", "Decorado", "INT/EXT", "Territorio", "Espacio", "Paginas"];
  const filasPlanas = () => {
    const f = [];
    vistos.forEach((d) => d.secs.forEach((x) => f.push([
      d.num == null ? "-" : "PP" + d.num, d.nombre, x.uid, x.cap, x.loc, x.deco || "-", x.ie || "-", x.terr, x.esp, fmtEighths(x.oct),
    ])));
    return f;
  };
  const totales = ["", `${vistos.length} pequenas partes`, `${vistos.reduce((a, d) => a + d.secs.length, 0)} secs`, "", "", "", "", "", "", fmtEighths(vistos.reduce((a, d) => a + d.oct, 0))];

  return (
    <div>
      <EstilosDeco />
      <style>{`
        .ppx-tabla { width:100%; border-collapse:collapse; font-size:12px; margin-top:7px; }
        .ppx-tabla th { text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:.04em; color:#71717a; font-weight:700; padding:3px 7px; border-bottom:1px solid #e4e4e7; }
        .ppx-tabla td { padding:4px 7px; border-bottom:1px solid #f4f4f5; color:#3f3f46; }
        .ppx-tabla tr:last-child td { border-bottom:0; }
        .ppx-num { font-size:11px; font-weight:700; background:#5b21b6; color:#fff; padding:2px 8px; border-radius:4px; }
        .ppx-num.sn { background:#a1a1aa; }
      `}</style>
      <div className="section-head" style={{ marginTop: 4, flexWrap: "wrap" }}>
        <h3 className="sub" style={{ margin: 0 }}>Pequenas partes - {lista.length}</h3>
        <span className="muted small">{totSecs} apariciones en secuencia</span>
        <div className="dcx-ord">
          <button className={orden === "num" ? "on" : ""} onClick={() => setOrden("num")}>Por numero</button>
          <button className={orden === "guion" ? "on" : ""} onClick={() => setOrden("guion")}>Orden de guion</button>
          <button className={orden === "secs" ? "on" : ""} onClick={() => setOrden("secs")}>Mas secuencias</button>
        </div>
        <input className="buscador" style={{ marginLeft: "auto" }} placeholder="Buscar pequena parte..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="muted small">Cada pequena parte con las secuencias en las que aparece. El numero de PP se asigna en la pestana Figuracion.</p>
      <div className="rep-bar" style={{ marginBottom: 10 }}>
        <button className="btn" onClick={() => descargarCSV("pequenas_partes.csv", [COLS, ...filasPlanas(), totales])}>CSV</button>
        <button className="btn" onClick={() => exportInformeExcel("Pequenas partes", "", COLS, filasPlanas(), totales)}>Excel</button>
        <button className="btn" onClick={() => exportInformePDF("Pequenas partes", "", COLS, filasPlanas(), totales)}>PDF</button>
      </div>
      {vistos.map((d) => (
        <div key={d.nombre} className="dcx-card">
          <div className="dcx-head">
            <span className={`ppx-num ${d.num == null ? "sn" : ""}`}>{d.num == null ? "sin nº" : "PP" + d.num}</span>
            <span className="dcx-nom">{d.nombre}</span>
            <span className="dcx-stats">
              <span><b>{d.secs.length}</b> secs</span>
              <span><b>{fmtEighths(d.oct)}</b> pg</span>
              <span><b>{d.caps.size}</b> cap.</span>
              <span><b>{d.locs.size}</b> locs</span>
            </span>
          </div>
          <div className="dcx-linea" style={{ marginTop: 4 }}>
            <span className="dcx-lbl">Territorios</span>
            {pillTerr(d.terrs, colorDe)}
          </div>
          <table className="ppx-tabla">
            <thead><tr><th>Sec</th><th>Localizacion</th><th>Decorado</th><th>INT/EXT</th><th>Territorio</th><th>Espacio</th><th style={{ textAlign: "right" }}>Pg</th></tr></thead>
            <tbody>
              {d.secs.map((x, j) => (
                <tr key={x.uid + j}>
                  <td><button className="sec-link" onClick={() => irASecuencia && irASecuencia(x.uid, "pequenas")}>{x.uid}</button></td>
                  <td>{x.loc}</td>
                  <td className={x.deco ? "" : "muted"}>{x.deco || "-"}</td>
                  <td>{x.ie || "-"}</td>
                  <td>{x.terr}</td>
                  <td>{x.esp}</td>
                  <td style={{ textAlign: "right" }}>{fmtEighths(x.oct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function Figuracion({ proyectoId, canEdit, irASecuencia }) {
  const [escenas, setEscenas] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");

  async function cargar() {
    setErr(null);
    const { data: caps, error } = await supabase.from("capitulos")
      .select("numero, escenas(id, uid, orden, localizacion, decorado, territorio, figuracion(id, tipo, cantidad, nota), desglose_items(id, categoria, elemento, pp_num))")
      .eq("proyecto_id", proyectoId).order("numero");
    if (error) { setErr(error.message); return; }
    const es = []; (caps || []).forEach((c) => (c.escenas || []).forEach((e) => es.push({ ...e, capNum: c.numero })));
    es.sort((a, b) => (a.capNum - b.capNum) || ((a.orden || 0) - (b.orden || 0)));
    setEscenas(es);
  }
  useEffect(() => { cargar(); }, [proyectoId]);

  async function addFig(e, tipo) {
    const { data, error } = await supabase.from("figuracion").insert({ escena_id: e.id, tipo, cantidad: 0, nota: "" }).select().single();
    if (error) { setErr(error.message); return; }
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, figuracion: [...(x.figuracion || []), { id: data.id, tipo, cantidad: 0, nota: "" }] } : x)));
  }
  async function updFig(e, id, campo, val) {
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, figuracion: (x.figuracion || []).map((f) => (f.id === id ? { ...f, [campo]: val } : f)) } : x)));
    await supabase.from("figuracion").update({ [campo]: val }).eq("id", id);
  }
  async function delFig(e, id) {
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, figuracion: (x.figuracion || []).filter((f) => f.id !== id) } : x)));
    await supabase.from("figuracion").delete().eq("id", id);
  }
  async function updPP(e, id, campo, val) {
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, desglose_items: (x.desglose_items || []).map((i) => (i.id === id ? { ...i, [campo]: val } : i)) } : x)));
    await supabase.from("desglose_items").update({ [campo]: val }).eq("id", id);
  }
  async function delPP(e, id) {
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, desglose_items: (x.desglose_items || []).filter((i) => i.id !== id) } : x)));
    await supabase.from("desglose_items").delete().eq("id", id);
  }
  async function addPP(e) {
    const nombre = prompt("Nombre de la pequena parte (ej. Camarero):"); if (!nombre || !nombre.trim()) return;
    const { data, error } = await supabase.from("desglose_items").insert({ escena_id: e.id, categoria: "pequenaParte", elemento: nombre.trim() }).select().single();
    if (error) { setErr(error.message); return; }
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, desglose_items: [...(x.desglose_items || []), { id: data.id, categoria: "pequenaParte", elemento: nombre.trim(), pp_num: null }] } : x)));
  }

  if (err) return <div className="msg err">{err}</div>;
  if (escenas === null) return <p className="muted">Cargando...</p>;

  const visibles = escenas
    .filter((e) => (e.figuracion || []).length > 0 || (e.desglose_items || []).some((i) => i.categoria === "pequenaParte"))
    .filter((e) => String(e.uid || "").toLowerCase().includes(q.trim().toLowerCase()));

  const figTot = (e) => (e.figuracion || []).reduce((s, f) => s + (Number(f.cantidad) || 0), 0);
  const ppTot = (e) => (e.desglose_items || []).filter((i) => i.categoria === "pequenaParte").length;

  return (
    <div>
      <div className="section-head" style={{ marginTop: 4 }}>
        <h3 className="sub" style={{ margin: 0 }}>Figuracion y pequenas partes</h3>
        <input className="buscador" placeholder="Buscar nº secuencia..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="muted small">Secuencias con figuracion o pequenas partes, por orden de guion. La figuracion y las PP se anaden en la secuencia; aqui las editas y numeras.</p>
      {visibles.length === 0 ? <p className="muted">No hay secuencias con figuracion ni pequenas partes todavia.</p> : visibles.map((e) => {
        const pps = (e.desglose_items || []).filter((i) => i.categoria === "pequenaParte");
        return (
          <div key={e.id} className="fig-card">
            <div className="fig-card-head">
              <button className="sec-link sec-link-b" onClick={() => irASecuencia && irASecuencia(e.uid, "figuracion")} title="Ir al desglose de la secuencia">{e.uid} &rarr;</button>
              <span className="muted small">{e.localizacion || ""}{e.decorado ? " · " + e.decorado : ""}{e.territorio ? " · " + e.territorio : ""}</span>
              <span className="fig-card-tot">Figuracion total: {figTot(e)}</span>
              <span className="fig-card-tot pp-tot">Pequenas partes: {ppTot(e)}</span>
            </div>
            <div className="fig-card-body">
              <div className="fig-col">
                {FIG_TIPOS.map(([k, l]) => {
                  const lineas = (e.figuracion || []).filter((f) => f.tipo === k);
                  return (
                    <div key={k} className="fig-grupo">
                      <div className="fig-grupo-head">
                        <span className="fig-lbl">{l}</span>
                        {canEdit && <button className="btn ghost mini" onClick={() => addFig(e, k)}>+ linea</button>}
                      </div>
                      {lineas.map((f) => (
                        <div key={f.id} className="fig-row">
                          <input className="fig-nota" placeholder="concepto" defaultValue={f.nota || ""} disabled={!canEdit} onBlur={(ev) => updFig(e, f.id, "nota", ev.target.value)} />
                          <input type="number" min="0" className="fig-num" value={f.cantidad || 0} disabled={!canEdit} onChange={(ev) => updFig(e, f.id, "cantidad", Math.max(0, parseInt(ev.target.value) || 0))} />
                          {canEdit && <button className="fig-x" title="Borrar" onClick={() => delFig(e, f.id)}>x</button>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="fig-col fig-pp">
                <div className="fig-grupo-head">
                  <span className="fig-lbl">Pequenas partes</span>
                  {canEdit && <button className="btn ghost mini" onClick={() => addPP(e)}>+ PP</button>}
                </div>
                {pps.length === 0 && <span className="muted small">-</span>}
                {pps.map((i) => (
                  <div key={i.id} className="fig-row">
                    <input className="pp-numin" type="number" min="1" placeholder="nº" defaultValue={i.pp_num ?? ""} disabled={!canEdit} onBlur={(ev) => updPP(e, i.id, "pp_num", ev.target.value === "" ? null : parseInt(ev.target.value))} />
                    <input className="fig-nota" placeholder="nombre" defaultValue={i.elemento || ""} disabled={!canEdit} onBlur={(ev) => updPP(e, i.id, "elemento", ev.target.value)} />
                    {canEdit && <button className="fig-x" title="Borrar" onClick={() => delPP(e, i.id)}>x</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Proyecto({ proyecto, canEdit, onBack, onOpenCap, initialTab, ultimoCap, onVolverCap, irASecuencia }) {
  const [tab, setTab] = useState(initialTab || "capitulos");
  const [caps, setCaps] = useState(null);
  const [err, setErr] = useState(null);
  const [nombre, setNombre] = useState(proyecto.nombre);
  const [desgVers, setDesgVers] = useState([]);
  const [busy, setBusy] = useState(false);

  async function cargarDesgVers() {
    const { data } = await supabase.from("desglose_versiones").select("id, nombre, created_by, created_at").eq("proyecto_id", proyecto.id).order("created_at", { ascending: false });
    setDesgVers(data || []);
  }
  async function guardarDesglose() {
    const nom = prompt("Nombre de la copia del desglose:", `Desglose ${new Date().toLocaleDateString("es-ES")}`);
    if (!nom || !nom.trim()) return;
    setBusy(true); setErr(null);
    try {
      const { data: cps } = await supabase.from("capitulos")
        .select("escenas(id, uid, localizacion, decorado, espacio, territorio, sinopsis, desglose_items(categoria, elemento), figuracion(tipo, cantidad, nota))")
        .eq("proyecto_id", proyecto.id);
      const escs = []; (cps || []).forEach((c) => (c.escenas || []).forEach((e) => escs.push({
        id: e.id, uid: e.uid, localizacion: e.localizacion || "", decorado: e.decorado || "", espacio: e.espacio || "", territorio: e.territorio || "", sinopsis: e.sinopsis || "",
        items: (e.desglose_items || []).map((i) => ({ categoria: i.categoria, elemento: i.elemento })),
        figuracion: (e.figuracion || []).map((f) => ({ tipo: f.tipo, cantidad: f.cantidad, nota: f.nota })),
      })));
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("desglose_versiones").insert({ proyecto_id: proyecto.id, nombre: nom.trim(), datos: { escenas: escs }, created_by: user?.email || "" });
      if (error) throw error;
      await logActividad(proyecto.id, "Guardo copia del desglose", nom.trim());
      await cargarDesgVers();
    } catch (e) { setErr("No se pudo guardar: " + (e.message || e)); }
    setBusy(false);
  }
  async function restaurarDesglose(v) {
    if (!confirm(`Restaurar el desglose "${v.nombre}"? Reemplaza el desglose actual (no toca el plan de trabajo).`)) return;
    setBusy(true); setErr(null);
    try {
      const { data: full } = await supabase.from("desglose_versiones").select("datos").eq("id", v.id).single();
      const snap = full?.datos; if (!snap) throw new Error("Copia vacia");
      const { data: cps } = await supabase.from("capitulos").select("escenas(id)").eq("proyecto_id", proyecto.id);
      const existentes = new Set(); (cps || []).forEach((c) => (c.escenas || []).forEach((e) => existentes.add(e.id)));
      const escs = (snap.escenas || []).filter((e) => existentes.has(e.id));
      const escIds = escs.map((e) => e.id);
      for (let i = 0; i < escs.length; i += 25) {
        await Promise.all(escs.slice(i, i + 25).map((e) => supabase.from("escenas").update({ localizacion: e.localizacion, decorado: e.decorado, espacio: e.espacio, territorio: e.territorio, sinopsis: e.sinopsis }).eq("id", e.id)));
      }
      if (escIds.length) await supabase.from("desglose_items").delete().in("escena_id", escIds);
      const its = []; escs.forEach((e) => (e.items || []).forEach((i) => its.push({ escena_id: e.id, categoria: i.categoria, elemento: i.elemento })));
      if (its.length) await insertChunked("desglose_items", its);
      if (escIds.length) await supabase.from("figuracion").delete().in("escena_id", escIds);
      const fgs = []; escs.forEach((e) => (e.figuracion || []).forEach((f) => fgs.push({ escena_id: e.id, tipo: f.tipo, cantidad: f.cantidad, nota: f.nota })));
      if (fgs.length) await insertChunked("figuracion", fgs);
      await logActividad(proyecto.id, "Restauro el desglose", v.nombre);
      await cargar();
    } catch (e) { setErr("No se pudo restaurar: " + (e.message || e)); }
    setBusy(false);
  }
  async function borrarDesglose(v) {
    if (!confirm(`Borrar la copia "${v.nombre}"?`)) return;
    await supabase.from("desglose_versiones").delete().eq("id", v.id);
    await logActividad(proyecto.id, "Borro copia del desglose", v.nombre);
    await cargarDesgVers();
  }

  async function cargar() {
    const { data, error } = await supabase
      .from("capitulos")
      .select("id, numero, nombre_archivo, version_guion, proyecto_id, escenas(octavos)")
      .eq("proyecto_id", proyecto.id)
      .order("numero");
    if (error) setErr(error.message); else setCaps(data);
  }
  async function editarVersion(c) {
    const actual = c.version_guion || "";
    const v = window.prompt(`Version de guion del capitulo ${c.numero}:\n(ej. "v3 18/08/2026")`, actual);
    if (v === null) return;
    const val = v.trim();
    await supabase.from("capitulos").update({ version_guion: val || null }).eq("id", c.id);
    await logActividad(proyecto.id, "Cambio la version de guion", `Cap ${c.numero}: ${val || "(sin version)"}`);
    cargar();
  }
  async function renombrar() {
    const nuevo = prompt("Nuevo nombre del proyecto:", nombre);
    if (nuevo == null) return;
    const n = nuevo.trim(); if (!n) return;
    const { error } = await supabase.from("proyectos").update({ nombre: n }).eq("id", proyecto.id);
    if (error) { setErr(error.message); return; }
    setNombre(n); proyecto.nombre = n;
    await logActividad(proyecto.id, "Renombro el proyecto", n);
  }
  useEffect(() => { cargar(); cargarDesgVers(); }, [proyecto.id]);

  async function borrarCap(c) {
    if (!confirm(`Borrar el capitulo ${c.numero} y todas sus secuencias?`)) return;
    const { error } = await supabase.from("capitulos").delete().eq("id", c.id);
    if (error) setErr(error.message); else { await logActividad(proyecto.id, "Borro un capitulo", `Cap ${c.numero}`); cargar(); }
  }

  const nextNum = caps && caps.length ? Math.max(...caps.map((c) => c.numero)) + 1 : 1;

  return (
    <div className="container wide">
      <div className="section-head">
        <button className="btn ghost" onClick={onBack}>&larr; Proyectos</button>
        {ultimoCap && <button className="btn" onClick={onVolverCap} title="Volver al capitulo que estabas viendo">&larr; Volver a Cap {ultimoCap.numero}</button>}
        <div className="proj-head">
          <h2>{nombre}{canEdit && <button className="btn ghost mini" title="Renombrar proyecto" onClick={renombrar}>Renombrar</button>}</h2>
          {caps && <span className="muted small">{caps.length} {caps.length === 1 ? "capitulo" : "capitulos"} · {fmtEighths((caps || []).reduce((t, c) => t + (c.escenas || []).reduce((a, e) => a + Number(e.octavos || 0), 0), 0))} pg</span>}
        </div>
        <button className="btn" style={{ marginLeft: "auto" }} onClick={() => exportarProyecto(proyecto.id, nombre)}>Exportar JSON</button>
      </div>
      <style>{`.cap-ver-pill{font-size:11px;font-weight:700;color:#0f766e;background:#f0fdfa;border:1px solid #ccfbf1;padding:2px 9px;border-radius:20px;white-space:nowrap}`}</style>
      <div className="tabs">
        <button className={`tab ${tab === "capitulos" ? "on" : ""}`} onClick={() => setTab("capitulos")}>Capitulos</button>
        <button className={`tab ${tab === "resumen" ? "on" : ""}`} onClick={() => setTab("resumen")}>Resumen</button>
        <button className={`tab ${tab === "localizaciones" ? "on" : ""}`} onClick={() => setTab("localizaciones")}>Localizaciones</button>
        <button className={`tab ${tab === "decorados" ? "on" : ""}`} onClick={() => setTab("decorados")}>Decorados</button>
        <button className={`tab ${tab === "reparto" ? "on" : ""}`} onClick={() => setTab("reparto")}>Reparto</button>
        <button className={`tab ${tab === "figuracion" ? "on" : ""}`} onClick={() => setTab("figuracion")}>Figuracion</button>
        <button className={`tab ${tab === "pequenas" ? "on" : ""}`} onClick={() => setTab("pequenas")}>Pequenas partes</button>
        <button className={`tab ${tab === "plan" ? "on" : ""}`} onClick={() => setTab("plan")}>Plan de trabajo</button>
        <button className={`tab ${tab === "informes" ? "on" : ""}`} onClick={() => setTab("informes")}>Informes</button>
        <button className={`tab ${tab === "cambios" ? "on" : ""}`} onClick={() => setTab("cambios")}>Cambios</button>
      </div>
      {err && <div className="msg err">{err}</div>}

      {tab === "capitulos" && (<>
        {canEdit && <SubirGuion proyectoId={proyecto.id} nextNum={nextNum} onSaved={cargar} />}
        {canEdit && (
          <div className="card-lite">
            <div className="ver-head">
              <h3 className="sub" style={{ margin: 0 }}>Copias de seguridad del desglose</h3>
              <button className="btn" onClick={guardarDesglose} disabled={busy}>Guardar desglose actual</button>
            </div>
            {desgVers.length === 0 ? <span className="muted small">Aun no hay copias guardadas. Guarda una antes de hacer cambios grandes.</span> : (
              <ul className="ver-list">
                {desgVers.map((v) => (
                  <li key={v.id}>
                    <span className="ver-nom">{v.nombre}</span>
                    <span className="muted small ver-meta">{new Date(v.created_at).toLocaleDateString("es-ES")}{v.created_by ? ` · Guardado por ${v.created_by}` : ""}</span>
                    <button className="btn ghost" onClick={() => restaurarDesglose(v)} disabled={busy}>Restaurar</button>
                    <button className="btn ghost danger" onClick={() => borrarDesglose(v)} disabled={busy}>x</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <h3 className="sub">Capitulos</h3>
        {caps === null ? <p className="muted">Cargando...</p>
          : caps.length === 0 ? <p className="muted">Todavia no hay capitulos.</p>
          : <div className="list">{caps.map((c) => (
              <div key={c.id} className="item">
                <button className="item-main" onClick={() => onOpenCap(c)}>
                  <span className="item-title">Capitulo {c.numero}</span>
                  <span className="muted small">{c.escenas?.length ?? 0} secuencias - {c.nombre_archivo || ""}</span>
                </button>
                {c.version_guion && <span className="cap-ver-pill">{c.version_guion}</span>}
                {canEdit && <button className="btn ghost" onClick={() => editarVersion(c)} title="Version de guion de este capitulo">{c.version_guion ? "Version" : "+ version"}</button>}
                {canEdit && <button className="btn ghost danger" onClick={() => borrarCap(c)}>Borrar</button>}
              </div>
            ))}</div>}
      </>)}

      {tab === "reparto" && <Reparto proyectoId={proyecto.id} canEdit={canEdit} irASecuencia={irASecuencia} />}
      {tab === "figuracion" && <Figuracion proyectoId={proyecto.id} canEdit={canEdit} irASecuencia={irASecuencia} />}
      {tab === "pequenas" && <PequenasPartes proyectoId={proyecto.id} canEdit={canEdit} irASecuencia={irASecuencia} />}
      {tab === "resumen" && <Resumen proyectoId={proyecto.id} proyNombre={nombre} />}
      {tab === "localizaciones" && <Localizaciones proyectoId={proyecto.id} canEdit={canEdit} irASecuencia={irASecuencia} />}
      {tab === "decorados" && <Decorados proyectoId={proyecto.id} canEdit={canEdit} irASecuencia={irASecuencia} />}
      {tab === "plan" && <Plan proyectoId={proyecto.id} canEdit={canEdit} irASecuencia={irASecuencia} />}
      {tab === "informes" && <Informes proyectoId={proyecto.id} proyNombre={nombre} irASecuencia={irASecuencia} />}
      {tab === "cambios" && <Actividad proyectoId={proyecto.id} />}
    </div>
  );
}

function SubirGuion({ proyectoId, nextNum, onSaved }) {
  const [estado, setEstado] = useState("idle");
  const [scenes, setScenes] = useState([]);
  const [fileName, setFileName] = useState("");
  const [numCap, setNumCap] = useState(nextNum);
  const [pagsReales, setPagsReales] = useState("");
  const [esEscaleta, setEsEscaleta] = useState(false);
  const [mediaProy, setMediaProy] = useState(null);
  useEffect(() => {
    (async () => {
      const { data: caps } = await supabase.from("capitulos").select("id, escaleta, escenas(octavos)").eq("proyecto_id", proyectoId);
      let oct = 0, nsec = 0, ncaps = 0;
      (caps || []).filter((c) => !c.escaleta).forEach((c) => { const es = c.escenas || []; if (!es.length) return; ncaps++; es.forEach((e) => { oct += Number(e.octavos || 0); nsec++; }); });
      setMediaProy(nsec > 0 ? { octPorSec: oct / nsec, octPorCap: Math.round(oct / ncaps), ncaps } : null);
    })();
  }, [proyectoId]);
  const [err, setErr] = useState(null);

  useEffect(() => { setNumCap(nextNum); }, [nextNum]);

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setErr("Sube un PDF."); return; }
    setErr(null); setFileName(file.name); setEstado("leyendo");
    try {
      const sc = await extraerGuion(file);
      if (!sc.length) { setErr("No se detectaron cabeceras INT./EXT."); setEstado("idle"); return; }
      setScenes(sc); setEstado("listo");
    } catch (e2) { setErr(e2.message); setEstado("idle"); }
  }

  async function guardar() {
    setEstado("guardando"); setErr(null);
    try {
      const { data: cap, error: e1 } = await supabase
        .from("capitulos")
        .insert({ proyecto_id: proyectoId, numero: numCap, nombre_archivo: fileName, escaleta: esEscaleta })
        .select().single();
      if (e1) throw e1;
      const capIdNuevo = cap.id;
      let octs;
      let totalEscaleta = null;
      if (esEscaleta) {
        // escaleta: no hay dialogos, asi que las paginas se estiman y se reparten uniformemente
        totalEscaleta = parseEighths(pagsReales);
        if (totalEscaleta == null || totalEscaleta <= 0) totalEscaleta = mediaProy ? Math.round(mediaProy.octPorSec * scenes.length) : scenes.length * 8;
        const base = Math.floor(totalEscaleta / scenes.length);
        let resto = totalEscaleta - base * scenes.length;
        octs = scenes.map(() => { const o = Math.max(1, base + (resto > 0 ? 1 : 0)); if (resto > 0) resto--; return o; });
      } else {
        octs = scenes.map((s) => Math.max(1, autoEighths(s.lineCount)));
      }
      const pr = esEscaleta ? 0 : parseInt(pagsReales);
      if (pr && pr > 0) {
        const objetivo = pr * 8;
        const base = octs.reduce((a, b) => a + b, 0);
        if (base > 0) {
          const f = objetivo / base;
          octs = octs.map((o) => Math.max(1, Math.round(o * f)));
          let diff = objetivo - octs.reduce((a, b) => a + b, 0);
          const idx = octs.map((o, i) => [o, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
          let k = 0;
          while (diff !== 0 && idx.length && k < 100000) {
            const i = idx[k % idx.length];
            if (diff > 0) { octs[i]++; diff--; }
            else if (octs[i] > 1) { octs[i]--; diff++; }
            k++;
          }
        }
      }
      const filas = scenes.map((s, i) => ({
        capitulo_id: cap.id, num_raw: s.numRaw, uid: mkUid(numCap, s.numRaw),
        orden: s.orden, header: s.header, texto: s.texto,
        int_ext: s.intExt || intExtFromHeader(s.header),
        localizacion: s.localizacion || "",
        tiempo: s.tiempo || "",
        octavos: octs[i],
      }));
      const { error: e2 } = await supabase.from("escenas").insert(filas);
      if (e2) throw e2;
      if (esEscaleta && totalEscaleta) await supabase.from("capitulos").update({ paginas_estimadas: totalEscaleta }).eq("id", capIdNuevo);
      await logActividad(proyectoId, esEscaleta ? "Subio una escaleta" : "Subio un guion", `Cap ${numCap}, ${scenes.length} secuencias${esEscaleta ? " (paginas estimadas)" : ""}`);
      setEstado("idle"); setScenes([]); setFileName(""); setPagsReales(""); setEsEscaleta(false);
      onSaved();
    } catch (e3) { setErr(e3.message || "Error al guardar"); setEstado("listo"); }
  }

  return (
    <div className="upload card-lite">
      {estado === "idle" && (
        <label className="filebtn">
          + Subir guion (PDF) - sera el capitulo {nextNum}
          <input type="file" accept="application/pdf" onChange={onFile} hidden />
        </label>
      )}
      {estado === "leyendo" && <p className="muted">Leyendo el PDF y detectando secuencias...</p>}
      {estado === "listo" && (
        <div className="confirm">
          <div className="row">
            <div><strong>{fileName}</strong><div className="muted small">{scenes.length} secuencias detectadas</div></div>
            <div className="numcap">
              <label>No capitulo</label>
              <input type="number" min="1" value={numCap} onChange={(e) => setNumCap(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div className="numcap">
              <label>{esEscaleta ? "Paginas estimadas del capitulo" : "Paginas reales (sin portada)"}</label>
              <input placeholder={esEscaleta ? (mediaProy ? fmtEighths(Math.round(mediaProy.octPorSec * scenes.length)) : "ej. 50") : "opcional"}
                value={pagsReales} onChange={(e) => setPagsReales(esEscaleta ? e.target.value : e.target.value.replace(/[^0-9]/g, ""))} />
            </div>
          </div>
          <label className={`escaleta-chk imp-escaleta ${esEscaleta ? "on" : ""}`}>
            <input type="checkbox" checked={esEscaleta} onChange={(e) => { setEsEscaleta(e.target.checked); setPagsReales(""); }} />
            <span>Esto es una <b>escaleta</b> (encabezados y sinopsis, sin dialogos)</span>
          </label>
          <div className="muted small">
            {esEscaleta
              ? (mediaProy
                  ? `Como no hay dialogos, las paginas no se pueden contar: se estiman y se reparten por igual entre las ${scenes.length} secuencias. Si dejas el campo vacio se usara la media de tus ${mediaProy.ncaps} capitulos escritos (${fmtEighths(Math.round(mediaProy.octPorSec))} pg/secuencia), o escribe tu el total del capitulo.`
                  : `Como no hay dialogos, las paginas se estiman. Aun no tienes capitulos escritos para sacar una media, asi que conviene que escribas el total de paginas que calculas para el capitulo.`)
              : "Si indicas las paginas reales del guion, repartimos esas paginas entre las secuencias para que el total cuadre. Si lo dejas vacio, se calcula automaticamente."}
          </div>
          <div className="actions">
            <button className="primary inline" onClick={guardar}>Guardar capitulo</button>
            <button className="btn ghost" onClick={() => { setEstado("idle"); setScenes([]); }}>Cancelar</button>
          </div>
        </div>
      )}
      {estado === "guardando" && <p className="muted">Guardando en la base de datos...</p>}
      {err && <div className="msg err">{err}</div>}
    </div>
  );
}

const FIG_TIPOS = [["normal", "Normal"], ["especial", "Especial"], ["acting", "Acting"], ["menores", "Menores"]];

function ItemAdd({ onAdd, list }) {
  const [v, setV] = useState("");
  return (
    <input className="tag-add" placeholder="+ anadir" value={v} list={list}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") { onAdd(v); setV(""); } }}
      onBlur={() => { if (v.trim()) { onAdd(v); setV(""); } }} />
  );
}

const DESG_CATS = [
  ["personajes", "Personajes"], ["pequenaParte", "Pequena Parte"], ["vestuario", "Vestuario"], ["atrezzo", "Atrezzo"],
  ["maquillajePeluqueria", "Maq./Peluq."], ["vehiculos", "Vehiculos"], ["animales", "Animales"],
  ["fx", "FX"], ["vfx", "VFX"], ["especialistas", "Especialistas"], ["sonido", "Sonido"],
  ["mobiliario", "Mobiliario"], ["notas", "Notas"],
];
function figResumen(e) {
  const tot = (e.figuracion || []).reduce((s, f) => s + (Number(f.cantidad) || 0), 0);
  return tot ? ` (${tot} fig.)` : "";
}

// ── v10.6: exportar el desglose de un capitulo como fichas por secuencia (PDF) ──
function exportDesgloseCapPDF({ capNum, proyNombre, escenas, persNumMap, persMenorSet, versionGuion, esEscaleta }) {
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = window.open("", "_blank");
  if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
  const fecha = new Date().toLocaleDateString("es-ES");
  const secs = [...(escenas || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const GRID_CATS = [
    ["pequenaParte", "Peq. parte"], ["vestuario", "Vestuario"], ["atrezzo", "Atrezzo"],
    ["maquillajePeluqueria", "Maq./Peluq."], ["vehiculos", "Vehiculos"], ["animales", "Animales"],
    ["fx", "FX"], ["vfx", "VFX"], ["especialistas", "Especialistas"], ["notas", "Notas"],
  ];
  const FIG_LBL = { normal: "normal", especial: "especial", acting: "acting", menores: "menores" };
  const ESP_LBL = { plato: "Plato", exteriores: "Exteriores", ext_noche: "Ext. noche" };

  const itemsDe = (e, cat) => (e.desglose_items || []).filter((i) => i.categoria === cat);
  const txtCat = (e, cat) => {
    const arr = itemsDe(e, cat).map((i) => {
      const el = String(i.elemento || "").trim();
      return cat === "pequenaParte" && i.pp_num != null ? `PP${i.pp_num} ${el}` : el;
    }).filter(Boolean);
    return arr.length ? arr.join(" · ") : "—";
  };
  const htmlPers = (e) => {
    const arr = itemsDe(e, "personajes").map((i) => {
      const nom = String(i.elemento || "").trim().toUpperCase();
      const n = persNumMap ? persNumMap[nom] : null;
      const menor = persMenorSet ? persMenorSet.has(nom) : false;
      return { nom, n, menor };
    }).sort((a, b) => {
      if (a.n == null && b.n == null) return a.nom.localeCompare(b.nom);
      if (a.n == null) return 1; if (b.n == null) return -1; return a.n - b.n;
    });
    if (!arr.length) return "—";
    return arr.map((x) => {
      const t = esc((x.n != null ? x.n + " " : "") + x.nom);
      return x.menor ? `<span class="men">${t}</span>` : t;
    }).join(" · ");
  };
  const hayMenores = (escenas || []).some((e) => itemsDe(e, "personajes").some((i) => persMenorSet && persMenorSet.has(String(i.elemento || "").trim().toUpperCase())));
  const txtFig = (e) => {
    const arr = (e.figuracion || []).filter((f) => Number(f.cantidad) > 0).map((f) => {
      const nota = String(f.nota || "").trim();
      return `${f.cantidad} ${FIG_LBL[f.tipo] || f.tipo}${nota ? ` (${nota})` : ""}`;
    });
    return arr.length ? arr.join(" · ") : "—";
  };

  // resumen del capitulo
  const totOct = secs.reduce((a, e) => a + Number(e.octavos || 0), 0);
  const locsSet = new Set(), decosSet = new Set(), persSet = new Set(), terrSet = new Set();
  let totFig = 0;
  secs.forEach((e) => {
    const l = String(e.localizacion || "").trim(); if (l) locsSet.add(l.toUpperCase());
    const d = String(e.decorado || "").trim(); if (d) decosSet.add((l + "|" + d).toUpperCase());
    const t = String(e.territorio || "").trim(); if (t) terrSet.add(t);
    itemsDe(e, "personajes").forEach((i) => { const k = String(i.elemento || "").trim().toUpperCase(); if (k) persSet.add(k); });
    (e.figuracion || []).forEach((f) => { totFig += Number(f.cantidad) || 0; });
  });

  let html = `<html><head><meta charset="utf-8"><title>Desglose cap ${esc(capNum)}</title><style>
    *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;box-sizing:border-box;
      font-variant-ligatures:none;font-feature-settings:"liga" 0,"clig" 0,"dlig" 0;font-synthesis:none}
    body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:400;padding:20px 20px 34px;color:#111;
      text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased}
    .men{color:#dc2626}
    .leyenda{font-size:10px;color:#64748b;margin-top:10px}
    .leyenda b{color:#dc2626}
    .pie{position:fixed;bottom:0;left:0;right:0;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;
      padding:4px 2px;display:flex;justify-content:space-between;background:#fff}
    .h-tit{font-size:15px;font-weight:700;margin:0}
    .h-sub{color:#666;font-size:11px;margin:2px 0 14px}
    .h-res{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 12px;border-radius:4px;margin-bottom:16px}
    .h-res b{color:#0f172a}
    .fic{border:1px solid #cbd5e1;border-radius:4px;margin-bottom:11px;page-break-inside:avoid}
    .fic-h{display:flex;align-items:center;gap:10px;background:#eef2ff;border-bottom:1px solid #cbd5e1;padding:6px 10px;font-size:12px}
    .fic-n{font-weight:700;font-size:13px;background:#1e293b;color:#fff;padding:2px 8px;border-radius:3px}
    .fic-loc{font-weight:700;color:#1e293b}
    .fic-meta{margin-left:auto;display:flex;gap:10px;color:#475569;font-size:11px;flex-wrap:wrap;justify-content:flex-end}
    .fic-sin{padding:8px 10px;font-size:11px;color:#334155;border-bottom:1px dashed #e2e8f0;line-height:1.45}
    .fic-cats{display:grid;grid-template-columns:repeat(2,1fr)}
    .cat{display:flex;gap:8px;padding:5px 10px;font-size:11px;border-bottom:1px solid #f1f5f9;border-right:1px solid #f1f5f9}
    .cat.full{grid-column:1 / -1}
    .cat-k{min-width:80px;font-weight:700;color:#64748b;text-transform:uppercase;font-size:9px;letter-spacing:.04em;padding-top:1px}
    .cat-v{color:#0f172a;flex:1}
    .cat.pers .cat-v{font-weight:600}
    .cat.fig .cat-v{color:#9a3412;font-weight:600}
    @media print{@page{size:A4 portrait;margin:12mm 12mm 16mm}}
  </style></head><body>`;
  const verTxt = String(versionGuion || "").trim();
  html += `<div class="pie"><span>${esc(proyNombre || "")} · Capitulo ${esc(capNum)}${verTxt ? ` · Guion ${esc(verTxt)}` : ""}</span><span>Desglose BD Prod Tools · ${fecha}</span></div>`;
  html += `<p class="h-tit">${esc(proyNombre || "")} — Desglose Capitulo ${esc(capNum)}${verTxt ? ` · Guion ${esc(verTxt)}` : ""}${esEscaleta ? " (ESCALETA)" : ""}</p>`;
  html += `<div class="h-sub">Exportado el ${fecha} · BD Prod Tools</div>`;
  html += `<div class="h-res"><span><b>${secs.length}</b> secuencias</span><span><b>${fmtEighths(totOct)}</b> paginas${esEscaleta ? " (estimadas)" : ""}</span>`;
  html += `<span><b>${locsSet.size}</b> localizaciones · <b>${decosSet.size}</b> decorados</span>`;
  html += `<span><b>${persSet.size}</b> personajes</span><span><b>${totFig}</b> figurantes</span>`;
  if (terrSet.size) html += `<span><b>${terrSet.size}</b> territorios: ${esc([...terrSet].join(", "))}</span>`;
  html += `</div>`;

  secs.forEach((e) => {
    const loc = String(e.localizacion || "").trim();
    const deco = String(e.decorado || "").trim();
    const ie = String(e.int_ext || "").trim().toUpperCase();
    const cab = [ie, loc || "(sin localizacion)"].filter(Boolean).join(". ") + (deco ? ` / ${deco}` : "");
    const meta = [];
    if (String(e.tiempo || "").trim()) meta.push(esc(String(e.tiempo).toUpperCase()));
    meta.push(`${fmtEighths(Number(e.octavos || 0))} pg`);
    if (String(e.territorio || "").trim()) meta.push(esc(e.territorio));
    if (String(e.espacio || "").trim()) meta.push(esc(ESP_LBL[e.espacio] || e.espacio));
    html += `<div class="fic"><div class="fic-h"><span class="fic-n">${esc(e.uid || e.num_raw || "")}</span>`;
    html += `<span class="fic-loc">${esc(cab)}</span><span class="fic-meta">${meta.map((m) => `<span>${m}</span>`).join("")}</span></div>`;
    html += `<div class="fic-sin">${esc(String(e.sinopsis || "").trim() || "(sin sinopsis)")}</div><div class="fic-cats">`;
    html += `<div class="cat full pers"><span class="cat-k">Personajes</span><span class="cat-v">${htmlPers(e)}</span></div>`;
    html += `<div class="cat full fig"><span class="cat-k">Figuracion</span><span class="cat-v">${esc(txtFig(e))}</span></div>`;
    GRID_CATS.forEach(([k, lbl]) => {
      html += `<div class="cat"><span class="cat-k">${esc(lbl)}</span><span class="cat-v">${esc(txtCat(e, k))}</span></div>`;
    });
    html += `</div></div>`;
  });
  if (hayMenores) html += `<div class="leyenda">En rojo, los <b>menores</b> de edad.</div>`;
  html += `</body></html>`;
  w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

function Capitulo({ capitulo, proyNombre, canEdit, onBack, onSaltar, saltoUid, volverTab, onVolverPestana }) {
  const [escenas, setEscenas] = useState(null);
  const [catValues, setCatValues] = useState({});
  const [locProyecto, setLocProyecto] = useState([]);
  const [decoProyecto, setDecoProyecto] = useState([]);
  const [locDecoMap, setLocDecoMap] = useState({});
  const [terrProyecto, setTerrProyecto] = useState([]);
  const [racordProyecto, setRacordProyecto] = useState([]);
  const [racordColor, setRacordColor] = useState({});
  const [figConceptos, setFigConceptos] = useState([]);
  const [persNumMap, setPersNumMap] = useState({});
  const [persMenorSet, setPersMenorSet] = useState(new Set());
  const [instrucciones, setInstrucciones] = useState("");
  const [showInstr, setShowInstr] = useState(false);
  const [persFichas, setPersFichas] = useState([]);
  const [esEscaleta, setEsEscaleta] = useState(false);
  const [mediaProy, setMediaProy] = useState(null);
  const [pgEscaleta, setPgEscaleta] = useState("");
  useEffect(() => { (async () => {
    const { data } = await supabase.from("capitulos").select("escenas(localizacion, decorado, territorio, racord, figuracion(nota), desglose_items(categoria, elemento))").eq("proyecto_id", capitulo.proyecto_id);
    const m = {}; const locSet = new Set(); const decoSet = new Set(); const figSet = new Set(); const terrSet = new Set(); const racordSet = new Set(); const ld = {};
    (data || []).forEach((c) => (c.escenas || []).forEach((e) => {
      const loc = String(e.localizacion || "").trim(); const dec = String(e.decorado || "").trim(); const terr = String(e.territorio || "").trim(); const rac = String(e.racord || "").trim();
      if (loc) locSet.add(loc);
      if (dec) decoSet.add(dec);
      if (terr) terrSet.add(terr);
      if (rac) racordSet.add(rac);
      if (loc && dec) { if (!ld[loc]) ld[loc] = new Set(); ld[loc].add(dec); }
      (e.figuracion || []).forEach((f) => { if (f.nota && String(f.nota).trim()) figSet.add(String(f.nota).trim()); });
      (e.desglose_items || []).forEach((i) => {
        if (!i.elemento) return; const cat = i.categoria; const val = String(i.elemento).trim();
        if (!m[cat]) m[cat] = new Set(); m[cat].add(cat === "personajes" ? val.toUpperCase() : val);
      });
    }));
    const obj = {}; Object.keys(m).forEach((k) => { obj[k] = [...m[k]]; }); setCatValues(obj);
    const ldObj = {}; Object.keys(ld).forEach((k) => { ldObj[k] = [...ld[k]]; }); setLocDecoMap(ldObj);
    setLocProyecto([...locSet]); setDecoProyecto([...decoSet]); setFigConceptos([...figSet]); setTerrProyecto([...terrSet]); setRacordProyecto([...racordSet]);
    const { data: rcs } = await supabase.from("racord_colores").select("racord, color").eq("proyecto_id", capitulo.proyecto_id);
    const rmap = {}; (rcs || []).forEach((c) => { rmap[c.racord] = c.color; }); setRacordColor(rmap);
    const { data: prs } = await supabase.from("personajes").select("nombre, numero, menor").eq("proyecto_id", capitulo.proyecto_id);
    const pm = {}; const menSet = new Set(); const nomsFicha = [];
    (prs || []).forEach((p) => { const k = String(p.nombre || "").trim().toUpperCase(); if (!k) return; nomsFicha.push(k); if (p.numero != null) pm[k] = p.numero; if (p.menor) menSet.add(k); });
    setPersNumMap(pm); setPersMenorSet(menSet); setPersFichas(nomsFicha);
    setCatValues((prev) => ({ ...prev, personajes: Array.from(new Set([...(prev.personajes || []), ...nomsFicha])) }));
    const { data: proy } = await supabase.from("proyectos").select("instrucciones_ia").eq("id", capitulo.proyecto_id).single();
    setInstrucciones(proy?.instrucciones_ia || "");
  })(); }, [capitulo.proyecto_id]);
  async function saveInstrucciones(val) { setInstrucciones(val); await supabase.from("proyectos").update({ instrucciones_ia: val }).eq("id", capitulo.proyecto_id); }
  async function getEjemplos() {
    const { data: caps } = await supabase.from("capitulos").select("escenas(texto, sinopsis, localizacion, int_ext, tiempo, desglose_items(categoria, elemento))").eq("proyecto_id", capitulo.proyecto_id);
    const cand = [];
    (caps || []).forEach((c) => (c.escenas || []).forEach((e) => { if (e.sinopsis && e.texto && (e.desglose_items || []).length > 2) cand.push(e); }));
    return cand.slice(0, 3).map((e) => {
      const d = { localizacion: e.localizacion || "", intExt: e.int_ext || "", tiempo: e.tiempo || "", sinopsis: e.sinopsis || "", figuracionSugerida: "" };
      CATS.forEach(([k]) => { d[k] = (e.desglose_items || []).filter((i) => i.categoria === k).map((i) => i.elemento); });
      return { texto: String(e.texto || "").slice(0, 1500), desglose: d };
    });
  }
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [versionGuion, setVersionGuion] = useState("");
  const [faltaColVer, setFaltaColVer] = useState(false);
  const [proc, setProc] = useState(null); // {hechas, total} mientras desglosa

  async function cargar() {
    const { data, error } = await supabase
      .from("escenas")
      .select("id, uid, num_raw, orden, header, int_ext, localizacion, decorado, espacio, tiempo, racord, sinopsis, octavos, territorio, texto, desglose_items(id, categoria, elemento, pp_num), figuracion(id, tipo, cantidad, nota)")
      .eq("capitulo_id", capitulo.id)
      .order("orden").order("uid");
    if (error) setErr(error.message); else setEscenas(data);
  }
  useEffect(() => { cargar(); cargarEscaleta(); }, [capitulo.id]);

  async function cargarEscaleta() {
    const { data: cap, error: eCap } = await supabase.from("capitulos").select("escaleta, paginas_estimadas, version_guion").eq("id", capitulo.id).single();
    if (eCap && /version_guion/.test(eCap.message || "")) {
      // la columna todavia no existe en la base
      setFaltaColVer(true);
      const { data: cap2 } = await supabase.from("capitulos").select("escaleta, paginas_estimadas").eq("id", capitulo.id).single();
      setEsEscaleta(!!cap2?.escaleta);
      if (cap2?.paginas_estimadas != null) setPgEscaleta(fmtEighths(cap2.paginas_estimadas));
    } else {
      setFaltaColVer(false);
      setEsEscaleta(!!cap?.escaleta);
      setVersionGuion(cap?.version_guion || "");
    }
    if (cap?.paginas_estimadas != null) setPgEscaleta(fmtEighths(cap.paginas_estimadas));
    const { data: caps } = await supabase.from("capitulos").select("id, escaleta, escenas(octavos)").eq("proyecto_id", capitulo.proyecto_id);
    let oct = 0, nsec = 0, ncaps = 0;
    (caps || []).filter((c) => !c.escaleta).forEach((c) => { const es = c.escenas || []; if (!es.length) return; ncaps++; es.forEach((e) => { oct += Number(e.octavos || 0); nsec++; }); });
    setMediaProy(nsec > 0 ? { octPorSec: oct / nsec, octPorCap: Math.round(oct / ncaps), nsec, ncaps } : null);
  }
  async function editarVersionCap() {
    const v = window.prompt(`Version de guion del capitulo ${capitulo.numero}:\n(ej. "v3 18/08/2026")`, versionGuion || "");
    if (v === null) return;
    const val = v.trim();
    const { error } = await supabase.from("capitulos").update({ version_guion: val || null }).eq("id", capitulo.id);
    if (error) { setErr("No se pudo guardar la version: " + error.message + (/version_guion/.test(error.message || "") ? " — falta ejecutar el SQL en Supabase." : "")); return; }
    setVersionGuion(val);
    await logActividad(capitulo.proyecto_id, "Cambio la version de guion", `Cap ${capitulo.numero}: ${val || "(sin version)"}`);
  }
  async function toggleEscaleta(val) {
    setBusy(true); setErr(null);
    const { error } = await supabase.from("capitulos").update({ escaleta: val }).eq("id", capitulo.id);
    if (error) setErr("No se pudo: " + error.message);
    else { setEsEscaleta(val); await logActividad(capitulo.proyecto_id, val ? "Marco el capitulo como escaleta" : "Quito la marca de escaleta", `Capitulo ${capitulo.numero}`); await cargarEscaleta(); }
    setBusy(false);
  }
  async function aplicarPaginasEscaleta() {
    const secs = (escenas || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
    if (!secs.length) { setErr("Este capitulo no tiene secuencias todavia."); return; }
    let totalOct = parseEighths(pgEscaleta);
    if (totalOct == null || totalOct <= 0) {
      if (!mediaProy) { setErr("Aun no hay guiones escritos para calcular la media. Escribe tu las paginas del capitulo."); return; }
      totalOct = Math.round(mediaProy.octPorSec * secs.length);
    }
    if (!confirm(`Se repartiran ${fmtEighths(totalOct)} paginas entre las ${secs.length} secuencias (unas ${fmtEighths(Math.round(totalOct / secs.length))} pg cada una).\n\nOJO: esto SOBRESCRIBE las paginas actuales de todas las secuencias de este capitulo. Continuar?`)) return;
    setBusy(true); setErr(null);
    try {
      const base = Math.floor(totalOct / secs.length);
      let resto = totalOct - base * secs.length;
      for (const e of secs) { const oct = base + (resto > 0 ? 1 : 0); if (resto > 0) resto--; await supabase.from("escenas").update({ octavos: oct }).eq("id", e.id); }
      await supabase.from("capitulos").update({ paginas_estimadas: totalOct }).eq("id", capitulo.id);
      await logActividad(capitulo.proyecto_id, "Estimo paginas de escaleta", `Capitulo ${capitulo.numero}: ${fmtEighths(totalOct)} pg`);
      await cargar(); await cargarEscaleta();
    } catch (e) { setErr("No se pudo: " + (e.message || e)); }
    setBusy(false);
  }

  function updTerrLocal(id, val) { setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, territorio: val } : e))); }
  async function saveTerr(id, val) { await supabase.from("escenas").update({ territorio: val }).eq("id", id); }
  function updLocLocal(id, val) { setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, localizacion: val } : e))); }
  async function saveLoc(id, val) { await supabase.from("escenas").update({ localizacion: val }).eq("id", id); const e = escenas.find((x) => x.id === id); await logActividad(capitulo.proyecto_id, "Edito localizacion", `${e ? e.uid : ""}: ${val}`); }
  function updSinLocal(id, val) { setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, sinopsis: val } : e))); }
  async function saveSin(id, val) { await supabase.from("escenas").update({ sinopsis: val }).eq("id", id); const e = escenas.find((x) => x.id === id); await logActividad(capitulo.proyecto_id, "Edito sinopsis", e ? e.uid : ""); }
  async function saveOct(id, val) { const n = parseEighths(val); if (n == null || n < 0) return; setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, octavos: n } : e))); await supabase.from("escenas").update({ octavos: n }).eq("id", id); }
  function updDecLocal(id, val) { setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, decorado: val } : e))); }
  async function saveDec(id, val) { await supabase.from("escenas").update({ decorado: val }).eq("id", id); const e = escenas.find((x) => x.id === id); await logActividad(capitulo.proyecto_id, "Edito decorado", `${e ? e.uid : ""}: ${val}`); }
  async function saveEspacio(id, val) { setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, espacio: val } : e))); await supabase.from("escenas").update({ espacio: val }).eq("id", id); const e = escenas.find((x) => x.id === id); await logActividad(capitulo.proyecto_id, "Cambio el espacio", `${e ? e.uid : ""}: ${val || "sin definir"}`); }
  async function saveIntExt(id, val) { setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, int_ext: val } : e))); await supabase.from("escenas").update({ int_ext: val }).eq("id", id); }
  async function saveTiempo(id, val) { setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, tiempo: val } : e))); await supabase.from("escenas").update({ tiempo: val }).eq("id", id); }
  function updRacordLocal(id, val) { setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, racord: val } : e))); }
  async function saveRacord(id, val) { await supabase.from("escenas").update({ racord: val }).eq("id", id); }
  function updNumLocal(id, val) { setEscenas((prev) => prev.map((e) => (e.id === id ? { ...e, uid: val } : e))); }
  async function setNum(e, val) {
    const v = (val || "").trim();
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, uid: v, num_raw: v } : x)));
    await supabase.from("escenas").update({ uid: v, num_raw: v }).eq("id", e.id);
  }
  async function renumerarSecuenciasDesde(escenaMarcada) {
    const ord = [...(escenas || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const idx = ord.findIndex((e) => e.id === escenaMarcada.id);
    if (idx < 0) return;
    if (!confirm(`Renumerar consecutivamente desde ${escenaMarcada.uid}? Cambia el numero de esta y las siguientes secuencias, respetando las letras (A/B). El plan de trabajo se mantiene.`)) return;
    setBusy(true); setErr(null);
    try {
      const parse = (uid) => { const m = String(uid || "").match(/^(\d+)x(\d+)([A-Za-z]*)$/); return m ? { cap: parseInt(m[1]), base: parseInt(m[2]), letra: m[3].toUpperCase() } : null; };
      const pad2 = (n) => String(n).padStart(2, "0");
      let prevBase = 0;
      if (idx > 0) { const p = parse(ord[idx - 1].uid); if (p) prevBase = p.base; }
      let curNewBase = prevBase; let lastOrigBase = null; const updates = [];
      for (let i = idx; i < ord.length; i++) {
        const e = ord[i]; const p = parse(e.uid); if (!p) continue;
        if (p.base !== lastOrigBase) { curNewBase++; lastOrigBase = p.base; }
        const newUid = `${p.cap}x${pad2(curNewBase)}${p.letra}`;
        if (newUid !== e.uid) updates.push({ id: e.id, uid: newUid });
      }
      for (const u of updates) await supabase.from("escenas").update({ uid: u.uid, num_raw: u.uid }).eq("id", u.id);
      await logActividad(capitulo.proyecto_id, "Renumero secuencias", `desde ${escenaMarcada.uid} (${updates.length} cambios)`);
      await cargar();
    } catch (e) { setErr("No se pudo renumerar: " + (e.message || e)); }
    setBusy(false);
  }
  async function copiarEscena(e, nuevoUid) {
    const { data: ne, error } = await supabase.from("escenas").insert({
      capitulo_id: capitulo.id, num_raw: nuevoUid, uid: nuevoUid, orden: e.orden || 0,
      header: e.header || "", texto: e.texto || "", int_ext: e.int_ext || "",
      localizacion: e.localizacion || "", tiempo: e.tiempo || "", octavos: e.octavos || 1,
      sinopsis: e.sinopsis || null, territorio: e.territorio || "",
    }).select().single();
    if (error) { setErr(error.message); return null; }
    const items = (e.desglose_items || []).map((it) => ({ escena_id: ne.id, categoria: it.categoria, elemento: it.elemento }));
    if (items.length) await supabase.from("desglose_items").insert(items);
    const figs = (e.figuracion || []).map((f) => ({ escena_id: ne.id, tipo: f.tipo, cantidad: f.cantidad, nota: f.nota }));
    if (figs.length) await supabase.from("figuracion").insert(figs);
    return ne;
  }
  async function duplicar(e) { await copiarEscena(e, (e.uid || "") + "B"); await logActividad(capitulo.proyecto_id, "Duplico una secuencia", e.uid); await cargar(); }
  async function dividirAB(e) {
    const base = String(e.uid || e.num_raw || "").replace(/[A-Za-z]+$/, "");
    await supabase.from("escenas").update({ uid: base + "A", num_raw: base + "A" }).eq("id", e.id);
    await copiarEscena(e, base + "B");
    await logActividad(capitulo.proyecto_id, "Dividio una secuencia en A/B", `${base}A + ${base}B`);
    await cargar();
  }
  async function anadirSecuencia() {
    const maxOrden = (escenas || []).reduce((m, e) => Math.max(m, e.orden || 0), 0);
    const { data: ne, error } = await supabase.from("escenas").insert({
      capitulo_id: capitulo.id, num_raw: "", uid: "NUEVA", orden: maxOrden + 1,
      header: "", texto: "", int_ext: "", localizacion: "", tiempo: "", octavos: 1,
    }).select().single();
    if (error) setErr(error.message); else { await logActividad(capitulo.proyecto_id, "Anadio una secuencia", `Cap ${capitulo.numero}`); await cargar(); setAbiertas((prev) => new Set(prev).add(ne.id)); }
  }
  async function borrarSecuencia(e) {
    if (!window.confirm(`Borrar la secuencia ${e.uid}? No se puede deshacer.`)) return;
    await supabase.from("escenas").delete().eq("id", e.id);
    await logActividad(capitulo.proyecto_id, "Borro una secuencia", e.uid);
    setAbiertas(new Set()); await cargar();
  }
  async function fusionarSecuencias(id1, id2) {
    const e1 = escenas.find((x) => x.id === id1);
    const e2 = escenas.find((x) => x.id === id2);
    if (!e1 || !e2 || id1 === id2) { setFusionandoDe(null); return; }
    const primera = (e1.orden || 0) <= (e2.orden || 0) ? e1 : e2;
    const segunda = primera === e1 ? e2 : e1;
    if (!window.confirm(`Fusionar ${segunda.uid} dentro de ${primera.uid}?\n\nSe queda ${primera.uid} (numero, paginas, localizacion, decorado, territorio, espacio, INT/EXT, efecto y racord) y se le suman la sinopsis, personajes, figuracion y demas de ${segunda.uid}.\n\n${segunda.uid} se eliminara. No se puede deshacer.`)) return;
    setBusy(true); setErr(null);
    try {
      const nuevaSin = [primera.sinopsis, segunda.sinopsis].filter(Boolean).join("\n");
      await supabase.from("escenas").update({ sinopsis: nuevaSin }).eq("id", primera.id);
      await supabase.from("desglose_items").update({ escena_id: primera.id }).eq("escena_id", segunda.id);
      await supabase.from("figuracion").update({ escena_id: primera.id }).eq("escena_id", segunda.id);
      const { data: its } = await supabase.from("desglose_items").select("id, categoria, elemento").eq("escena_id", primera.id);
      const vistos = new Set(); const dupIds = [];
      (its || []).forEach((it) => { const k = it.categoria + "|" + String(it.elemento || "").trim().toUpperCase(); if (vistos.has(k)) dupIds.push(it.id); else vistos.add(k); });
      for (let i = 0; i < dupIds.length; i += 200) await supabase.from("desglose_items").delete().in("id", dupIds.slice(i, i + 200));
      await supabase.from("escenas").delete().eq("id", segunda.id);
      await logActividad(capitulo.proyecto_id, "Fusiono secuencias", `${segunda.uid} -> ${primera.uid}`);
      setFusionandoDe(null); setAbiertas(new Set());
      await cargar();
    } catch (e) { setErr("No se pudo fusionar: " + (e.message || e)); }
    setBusy(false);
  }

  const [abiertas, setAbiertas] = useState(new Set());
  const [fusionandoDe, setFusionandoDe] = useState(null);
  const saltoHecho = useRef(null);
  useEffect(() => {
    if (saltoUid && escenas && escenas.length && saltoHecho.current !== saltoUid) {
      const target = escenas.find((e) => String(e.uid) === String(saltoUid));
      if (target) {
        saltoHecho.current = saltoUid;
        setAbiertas((prev) => new Set(prev).add(target.id));
        setTimeout(() => { const el = document.getElementById(`sec-${target.id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 150);
      }
    }
  }, [saltoUid, escenas]);
  function toggleAbrir(id) { setAbiertas((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function moverSecuencia(e, dir) {
    const ord = [...escenas].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const idx = ord.findIndex((x) => x.id === e.id);
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= ord.length) return;
    [ord[idx], ord[j]] = [ord[j], ord[idx]];
    setBusy(true); setErr(null);
    try {
      const updates = [];
      ord.forEach((x, i) => { if ((x.orden || 0) !== i) updates.push({ id: x.id, orden: i }); });
      setEscenas((prev) => prev.map((x) => { const u = updates.find((y) => y.id === x.id); return u ? { ...x, orden: u.orden } : x; }));
      for (const u of updates) await supabase.from("escenas").update({ orden: u.orden }).eq("id", u.id);
    } catch (err) { setErr("No se pudo mover: " + (err.message || err)); }
    setBusy(false);
  }
  async function addItem(e, categoria, elemento) {
    if (!elemento.trim()) return;
    const { data } = await supabase.from("desglose_items").insert({ escena_id: e.id, categoria, elemento: elemento.trim() }).select().single();
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, desglose_items: [...(x.desglose_items || []), data] } : x)));
  }
  async function delItem(e, item) {
    await supabase.from("desglose_items").delete().eq("id", item.id);
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, desglose_items: (x.desglose_items || []).filter((i) => i.id !== item.id) } : x)));
  }

  const [figOpen, setFigOpen] = useState(() => new Set());
  function toggleFig(id) { setFigOpen((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function addFigLinea(e, tipo) {
    const { data, error } = await supabase.from("figuracion").insert({ escena_id: e.id, tipo, cantidad: 0, nota: "" }).select().single();
    if (error) { setErr(error.message); return; }
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, figuracion: [...(x.figuracion || []), { id: data.id, tipo, cantidad: 0, nota: "" }] } : x)));
  }
  async function updFigLinea(e, id, campo, val) {
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, figuracion: (x.figuracion || []).map((f) => (f.id === id ? { ...f, [campo]: val } : f)) } : x)));
    await supabase.from("figuracion").update({ [campo]: val }).eq("id", id);
  }
  async function delFigLinea(e, id) {
    setEscenas((prev) => prev.map((x) => (x.id === e.id ? { ...x, figuracion: (x.figuracion || []).filter((f) => f.id !== id) } : x)));
    await supabase.from("figuracion").delete().eq("id", id);
  }

  const pendientes = (escenas || []).filter((e) => !e.sinopsis);

  async function desglosar() {
    setErr(null); setProc({ hechas: 0, total: pendientes.length });
    let fallos = 0;
    const ejemplos = await getEjemplos();
    await runPool(pendientes, async (e) => {
      const instrPlus = persFichas.length
        ? `${instrucciones || ""}\n\nPERSONAJES YA DADOS DE ALTA EN ESTE PROYECTO: ${persFichas.join(", ")}.\nSi alguno de estos personajes aparece en la secuencia, usa EXACTAMENTE ese mismo nombre (no lo abrevies ni lo cambies). Si aparece un personaje que no esta en la lista, anadelo con el nombre que figure en el guion.`.trim()
        : instrucciones;
      const { data, error } = await supabase.functions.invoke(FUNC_NAME, { body: { texto: e.texto || e.header, instrucciones: instrPlus, ejemplos } });
      if (error || !data?.desglose) { fallos++; return; }
      const d = data.desglose;
      await supabase.from("escenas").update({
        localizacion: d.localizacion || "", tiempo: d.tiempo || "", sinopsis: d.sinopsis || "(sin sinopsis)",
        int_ext: d.intExt || e.int_ext || "",
      }).eq("id", e.id);
      await supabase.from("desglose_items").delete().eq("escena_id", e.id).neq("categoria", "pequenaParte");
      const items = [];
      CATS.forEach(([key]) => (Array.isArray(d[key]) ? d[key] : []).forEach((el) => { if (el) items.push({ escena_id: e.id, categoria: key, elemento: String(el) }); }));
      if (items.length) await supabase.from("desglose_items").insert(items);

    }, 3, (hechas, total) => setProc({ hechas, total }));
    setProc(null);
    await logActividad(capitulo.proyecto_id, "Desgloso con IA", `Cap ${capitulo.numero}, ${pendientes.length - fallos} secuencias`);
    if (fallos) setErr(`${fallos} secuencia(s) no se pudieron desglosar. Puedes reintentar.`);
    cargar();
  }

  return (
    <div className="container wide">
      <datalist id="terr-list">{Array.from(new Set([...terrProyecto, ...((escenas || []).map((e) => e.territorio))].filter(Boolean).map((x) => String(x).trim()))).sort().map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="loc-list">{Array.from(new Set([...locProyecto, ...((escenas || []).map((e) => e.localizacion))].filter(Boolean).map((x) => String(x).trim()))).sort().map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="deco-list">{Array.from(new Set([...decoProyecto, ...((escenas || []).map((e) => e.decorado))].filter(Boolean).map((x) => String(x).trim()))).sort().map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="fig-list">{Array.from(new Set([...figConceptos, ...((escenas || []).flatMap((e) => (e.figuracion || []).map((f) => f.nota)))].filter(Boolean).map((x) => String(x).trim()))).sort().map((t) => <option key={t} value={t} />)}</datalist>
      <datalist id="racord-list">{Array.from(new Set([...racordProyecto, ...((escenas || []).map((e) => e.racord))].filter(Boolean).map((x) => String(x).trim()))).sort().map((t) => <option key={t} value={t} />)}</datalist>
      {DESG_CATS.map(([key]) => (
        <datalist key={key} id={`dl-${key}`}>
          {Array.from(new Set([...(catValues[key] || []), ...((escenas || []).flatMap((e) => (e.desglose_items || []).filter((i) => i.categoria === key).map((i) => { const v = String(i.elemento || "").trim(); return key === "personajes" ? v.toUpperCase() : v; })))].filter(Boolean))).sort().map((v) => <option key={v} value={v} />)}
        </datalist>
      ))}
      <div className="section-head">
        <button className="btn ghost" onClick={onBack}>&larr; {/* volver */}Capitulos</button>
        {volverTab && onVolverPestana && <button className="btn" onClick={onVolverPestana}>&larr; Volver a {volverTab === "reparto" ? "Reparto" : volverTab === "localizaciones" ? "Localizaciones" : volverTab === "decorados" ? "Decorados" : volverTab === "pequenas" ? "Pequenas partes" : volverTab === "informes" ? "Informes" : volverTab === "figuracion" ? "Figuracion" : volverTab === "plan" ? "Plan de trabajo" : volverTab}</button>}
        {onSaltar && volverTab !== "plan" && <button className="btn ghost" onClick={() => onSaltar("plan")}>Plan de trabajo &rarr;</button>}
        <h2>Capitulo {capitulo.numero}{esEscaleta && <span className="esc-badge">ESCALETA</span>}</h2>
        {versionGuion && <span className="cap-ver-pill">Guion {versionGuion}</span>}
        {canEdit && <button className="btn ghost mini" onClick={editarVersionCap} title="Version de guion de este capitulo">{versionGuion ? "Cambiar version" : "+ version de guion"}</button>}
        <button className="btn" style={{ marginLeft: "auto" }} disabled={!escenas || !escenas.length}
          title="Exportar el desglose de este capitulo, secuencia a secuencia, en PDF"
          onClick={() => exportDesgloseCapPDF({ capNum: capitulo.numero, proyNombre, escenas, persNumMap, persMenorSet, versionGuion, esEscaleta })}>
          Exportar desglose (PDF)
        </button>
      </div>
      <style>{`.cap-ver-pill{font-size:11px;font-weight:700;color:#0f766e;background:#f0fdfa;border:1px solid #ccfbf1;padding:2px 9px;border-radius:20px;white-space:nowrap}`}</style>
      {err && <div className="msg err">{err}</div>}
      {faltaColVer && <div className="msg err">Para usar la version de guion falta ejecutar en Supabase: <code>alter table capitulos add column if not exists version_guion text;</code></div>}
      {canEdit && (
        <div className={`escaleta-box ${esEscaleta ? "on" : ""}`}>
          <label className="escaleta-chk">
            <input type="checkbox" checked={esEscaleta} onChange={(e) => toggleEscaleta(e.target.checked)} disabled={busy} />
            <span>Este capitulo es una <b>escaleta</b> (sin dialogos: las paginas seran estimadas)</span>
          </label>
          {esEscaleta && (
            <div className="escaleta-calc">
              <span className="muted small">Paginas del capitulo:</span>
              <input className="num" style={{ width: 90 }} placeholder={mediaProy ? fmtEighths(Math.round(mediaProy.octPorSec * (escenas || []).length)) : "ej. 50"}
                value={pgEscaleta} onChange={(e) => setPgEscaleta(e.target.value)} title="Deja vacio para usar la media de los guiones escritos" />
              <button className="btn" onClick={aplicarPaginasEscaleta} disabled={busy}>Repartir entre las {(escenas || []).length} secuencias</button>
              {mediaProy
                ? <span className="muted small">Media de los {mediaProy.ncaps} capitulos escritos: <b>{fmtEighths(Math.round(mediaProy.octPorSec))} pg/secuencia</b> · {fmtEighths(mediaProy.octPorCap)} pg/capitulo. Deja el campo vacio para usarla.</span>
                : <span className="muted small">Aun no hay capitulos escritos para sacar una media: escribe tu las paginas.</span>}
            </div>
          )}
        </div>
      )}
      {fusionandoDe && <div className="fusion-banner">Selecciona la secuencia con la que fusionar (boton "Fusionar aqui" en su cabecera). <button className="btn ghost mini" onClick={() => setFusionandoDe(null)}>Cancelar</button></div>}

      {canEdit && (
        <div className="card-lite desglose-bar">
          {proc ? (
            <div className="prog">
              <div className="muted">Desglosando con IA... {proc.hechas} / {proc.total}</div>
              <div className="bar"><div className="bar-fill" style={{ width: `${proc.total ? (proc.hechas / proc.total) * 100 : 0}%` }} /></div>
            </div>
          ) : (
            <div className="row">
              <div className="muted small">{pendientes.length} secuencia(s) sin desglosar de {escenas?.length ?? 0}</div>
              {canEdit && <button className="btn ghost" onClick={() => setShowInstr((v) => !v)}>{showInstr ? "Ocultar instrucciones" : "Instrucciones IA"}</button>}
              <button className="primary inline" onClick={desglosar} disabled={!pendientes.length}>
                {pendientes.length ? `Desglosar con IA (${pendientes.length})` : "Todo desglosado"}
              </button>
            </div>
          )}
          {showInstr && canEdit && (
            <div className="instr-box">
              <label className="cat-lbl">Instrucciones para la IA (se aplican en cada desglose de este proyecto)</label>
              <textarea className="instr-area" rows={4} value={instrucciones} placeholder={"Ej:\n- Nombres de personajes en mayusculas\n- No incluyas mobiliario generico (sillas, mesas)\n- Ignora figuracion de fondo salvo que sea relevante"}
                onChange={(e) => setInstrucciones(e.target.value)} onBlur={(e) => saveInstrucciones(e.target.value)} />
              <div className="muted small">Ademas, la IA usara como ejemplo hasta 3 secuencias que ya hayas desglosado y corregido en este proyecto.</div>
            </div>
          )}
        </div>
      )}

      {escenas === null ? <p className="muted">Cargando...</p>
        : <div className="escenas">{[...escenas].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((e) => {
            const pers = (e.desglose_items || []).filter((i) => i.categoria === "personajes").map((i) => i.elemento)
              .sort((a, b) => { const na = persNumMap[String(a).trim().toUpperCase()], nb = persNumMap[String(b).trim().toUpperCase()]; if (na == null && nb == null) return String(a).localeCompare(String(b)); if (na == null) return 1; if (nb == null) return -1; return na - nb; });
            const hecha = !!e.sinopsis;
            const open = abiertas.has(e.id);
            return (
              <div key={e.id} id={`sec-${e.id}`} className={`esc ${hecha ? "" : "esc-pend"} ${open ? "esc-open" : ""}`}>
                <div className="esc-head esc-clic" onClick={() => toggleAbrir(e.id)}>
                  {canEdit && fusionandoDe && fusionandoDe !== e.id && <button className="btn mini fusion-aqui" onClick={(ev) => { ev.stopPropagation(); fusionarSecuencias(fusionandoDe, e.id); }} disabled={busy}>Fusionar aqui</button>}
                  {canEdit && <span className="esc-mover" onClick={(ev) => ev.stopPropagation()}>
                    <button title="Subir" onClick={() => moverSecuencia(e, "up")} disabled={busy}>▲</button>
                    <button title="Bajar" onClick={() => moverSecuencia(e, "down")} disabled={busy}>▼</button>
                  </span>}
                  <span className="esc-uid">{e.uid}</span>
                  <span className="esc-loc">{e.localizacion || e.header}{e.decorado && <span className="esc-deco"> · {e.decorado}</span>}</span>
                  <span className="esc-meta">{e.int_ext} {e.tiempo}</span>
                  {e.racord && <span className="esc-racord" style={racordColor[e.racord] ? { background: racordColor[e.racord], color: colorTexto(racordColor[e.racord]) } : undefined}>{e.racord}</span>}
                  {e.territorio && <span className="esc-terr">{e.territorio}</span>}
                  <span className={`esc-pgs ${esEscaleta ? "esc-pgs-est" : ""}`} title={esEscaleta ? "Paginas estimadas (capitulo en escaleta)" : undefined}>{fmtEighths(e.octavos)} pg{esEscaleta ? " ~" : ""}</span>
                  {onSaltar && <button className="esc-plan-btn" title="Ir al Plan de trabajo" onClick={(ev) => { ev.stopPropagation(); onSaltar("plan"); }}>Plan &rarr;</button>}
                  <span className="esc-arrow">{open ? "v" : ">"}</span>
                </div>
                {!open && hecha && <div className="esc-sin muted small">{e.sinopsis}</div>}
                {!open && pers.length > 0 && <div className="chips">{pers.map((pp, i) => { const k = String(pp).trim().toUpperCase(); const num = persNumMap[k]; const menor = persMenorSet.has(k); return <span key={i} className={`chip ${menor ? "chip-menor" : ""}`}><span className={`tag-num ${num == null ? "none" : ""}`}>{num == null ? "X" : num}</span>{pp}</span>; })}</div>}

                {open && (
                  <div className="esc-body">
                    <label className="esc-sin-edit">Sinopsis
                      <textarea value={e.sinopsis || ""} placeholder="Breve sinopsis de la secuencia" disabled={!canEdit} rows={2}
                        onChange={(ev) => updSinLocal(e.id, ev.target.value)} onBlur={(ev) => saveSin(e.id, ev.target.value)} />
                    </label>
                    <div className="esc-grid2">
                      <label className="esc-num-edit">No secuencia
                        <input value={e.uid || ""} placeholder="ej. 201A" disabled={!canEdit}
                          onChange={(ev) => updNumLocal(e.id, ev.target.value)} onBlur={(ev) => setNum(e, ev.target.value)} />
                        {canEdit && <button className="btn ghost mini" style={{ marginTop: 4 }} onClick={() => renumerarSecuenciasDesde(e)} disabled={busy}>Renumerar secuencias desde aqui</button>}
                      </label>
                      <label>Paginas (octavos)
                        <input key={e.octavos} defaultValue={fmtEighths(e.octavos)} placeholder="ej. 1 4/8" disabled={!canEdit}
                          onBlur={(ev) => saveOct(e.id, ev.target.value)} />
                      </label>
                      <label className="esc-loc-edit">Localizacion
                        {onSaltar && <button className="cat-jump" title="Ir a Localizaciones" onClick={() => onSaltar("localizaciones")}>ver &rarr;</button>}
                        <input list="loc-list" value={e.localizacion || ""} placeholder="ej. CASA MARIA" disabled={!canEdit}
                          onChange={(ev) => updLocLocal(e.id, ev.target.value)} onBlur={(ev) => saveLoc(e.id, ev.target.value)} />
                      </label>
                      <label>Decorado
                        <div className="deco-field">
                          <input value={e.decorado || ""} placeholder="ej. Habitacion" disabled={!canEdit}
                            onChange={(ev) => updDecLocal(e.id, ev.target.value)} onBlur={(ev) => saveDec(e.id, ev.target.value)} />
                          {canEdit && (() => {
                            const ops = Array.from(new Set([...(locDecoMap[(e.localizacion || "").trim()] || []), ...((escenas || []).filter((x) => (x.localizacion || "").trim() === (e.localizacion || "").trim() && x.decorado).map((x) => String(x.decorado).trim()))].filter(Boolean))).sort();
                            return ops.length > 0 ? (
                              <select className="deco-sel" value="" onChange={(ev) => { if (ev.target.value) { updDecLocal(e.id, ev.target.value); saveDec(e.id, ev.target.value); } }}>
                                <option value="">Elegir...</option>
                                {ops.map((d) => <option key={d} value={d}>{d}</option>)}
                              </select>
                            ) : null;
                          })()}
                        </div>
                      </label>
                      <label>Territorio
                        <input list="terr-list" value={e.territorio || ""} placeholder="territorio" disabled={!canEdit}
                          onChange={(ev) => updTerrLocal(e.id, ev.target.value)} onBlur={(ev) => saveTerr(e.id, ev.target.value)} />
                      </label>
                      <label>Espacio
                        <select value={e.espacio || ""} disabled={!canEdit} onChange={(ev) => saveEspacio(e.id, ev.target.value)}>
                          <option value="">- sin definir -</option>
                          <option value="exteriores">Exteriores</option>
                          <option value="plato">Plato</option>
                        </select>
                      </label>
                      <label>Interior / Exterior
                        <select value={normIE(e.int_ext)} disabled={!canEdit} onChange={(ev) => saveIntExt(e.id, ev.target.value)}>
                          <option value="">- sin definir -</option>
                          {IE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </label>
                      <label>Efecto (momento)
                        <select value={normTiempo(e.tiempo)} disabled={!canEdit} onChange={(ev) => saveTiempo(e.id, ev.target.value)}>
                          <option value="">- sin definir -</option>
                          {TIEMPO_OPTS.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                        </select>
                      </label>
                      <label>Racord (epoca/año)
                        <input list="racord-list" value={e.racord || ""} placeholder="ej. 1977, Actual, Flashback" disabled={!canEdit}
                          onChange={(ev) => updRacordLocal(e.id, ev.target.value)} onBlur={(ev) => saveRacord(e.id, ev.target.value)} />
                      </label>
                    </div>

                    <div className="cats">
                      {DESG_CATS.map(([key, label]) => {
                        const items = (e.desglose_items || []).filter((i) => i.categoria === key);
                        return (
                          <div key={key} className="cat">
                            <div className="cat-lbl">{label}
                              {key === "personajes" && onSaltar && <button className="cat-jump" title="Ir a Reparto" onClick={() => onSaltar("reparto")}>Reparto &rarr;</button>}
                              {key === "pequenaParte" && onSaltar && <button className="cat-jump" title="Ir a Figuracion" onClick={() => onSaltar("figuracion")}>Figuracion &rarr;</button>}
                            </div>
                            <div className="cat-items">
                              {items.length === 0 && <span className="muted small">-</span>}
                              {items.map((it) => { const esMenor = key === "personajes" && persMenorSet.has(String(it.elemento || "").trim().toUpperCase());
                                return (
                                <span key={it.id} className={`tag ${esMenor ? "tag-menor" : ""}`}>
                                  {key === "personajes" && (() => { const num = persNumMap[String(it.elemento || "").trim().toUpperCase()]; return <span className={`tag-num ${num == null ? "none" : ""}`}>{num == null ? "X" : num}</span>; })()}
                                  {it.elemento}
                                  {canEdit && <button className="tag-x" onClick={() => delItem(e, it)}>x</button>}
                                </span>
                              ); })}
                              {canEdit && <ItemAdd onAdd={(val) => addItem(e, key, val)} list={`dl-${key}`} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {canEdit && (
                      <div className="fig-panel">
                        <div className="cat-lbl">Figuracion{figResumen(e)}</div>
                        {FIG_TIPOS.map(([k, l]) => {
                          const lineas = (e.figuracion || []).filter((f) => f.tipo === k);
                          return (
                            <div key={k} className="fig-grupo">
                              <div className="fig-grupo-head">
                                <span className="fig-lbl">{l}</span>
                                <button className="btn ghost mini" onClick={() => addFigLinea(e, k)}>+ linea</button>
                              </div>
                              {lineas.length === 0 && <span className="muted small">-</span>}
                              {lineas.map((f) => (
                                <div key={f.id} className="fig-row">
                                  <input className="fig-nota" list="fig-list" placeholder="concepto (ej. personal hospital)" defaultValue={f.nota || ""} onBlur={(ev) => updFigLinea(e, f.id, "nota", ev.target.value)} />
                                  <input type="number" min="0" className="fig-num" value={f.cantidad || 0} onChange={(ev) => updFigLinea(e, f.id, "cantidad", Math.max(0, parseInt(ev.target.value) || 0))} />
                                  <button className="fig-x" title="Borrar linea" onClick={() => delFigLinea(e, f.id)}>x</button>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {canEdit && (
                      <div className="esc-actions">
                        <button className="btn" onClick={() => dividirAB(e)}>Dividir en A/B</button>
                        <button className="btn" onClick={() => duplicar(e)}>Duplicar</button>
                        <button className="btn" onClick={() => setFusionandoDe(e.id)}>Fusionar con...</button>
                        <button className="btn danger" onClick={() => borrarSecuencia(e)}>Borrar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {canEdit && <button className="btn add-seq" onClick={anadirSecuencia}>+ Anadir secuencia</button>}
          </div>}
    </div>
  );
}


function Reparto({ proyectoId, canEdit, irASecuencia }) {
  const [lista, setLista] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [nacColores, setNacColores] = useState({});
  const [paletaAbierta, setPaletaAbierta] = useState(null);
  const [abierto, setAbierto] = useState(null);

  async function cargar() {
    setErr(null);
    const { data: caps, error: e1 } = await supabase
      .from("capitulos")
      .select("numero, escenas(uid, desglose_items(categoria, elemento))")
      .eq("proyecto_id", proyectoId)
      .order("numero");
    if (e1) { setErr(e1.message); return; }
    const map = {};
    (caps || []).forEach((c) => (c.escenas || []).forEach((es) => (es.desglose_items || []).forEach((it) => {
      if (it.categoria !== "personajes") return;
      const k = String(it.elemento || "").trim().toUpperCase();
      if (!k) return;
      if (!map[k]) map[k] = { nombre: k, total: 0, porCap: {}, secs: [] };
      map[k].total++; map[k].porCap[c.numero] = (map[k].porCap[c.numero] || 0) + 1;
      if (es.uid) map[k].secs.push(es.uid);
    })));
    const { data: pers, error: e2 } = await supabase.from("personajes").select("nombre, numero, menor, descripcion, edad, nacionalidad, categoria").eq("proyecto_id", proyectoId);
    if (e2) { setErr(e2.message); return; }
    const nums = {}, menores = {}, descs = {}, edades = {}, nacs = {}, cats = {}; (pers || []).forEach((p) => { const k = String(p.nombre || "").trim().toUpperCase(); if (!k) return; nums[k] = p.numero; menores[k] = p.menor; descs[k] = p.descripcion; edades[k] = p.edad; nacs[k] = p.nacionalidad; cats[k] = p.categoria; });
    const { data: ncs } = await supabase.from("nac_colores").select("nacionalidad, color").eq("proyecto_id", proyectoId);
    const cm = {}; (ncs || []).forEach((c) => { cm[c.nacionalidad] = c.color; }); setNacColores(cm);
    const todos = new Set([...Object.keys(map), ...Object.keys(nums)]);
    const arr = Array.from(todos).map((k) => { const x = map[k] || { nombre: k, total: 0, porCap: {}, secs: [] };
      return { ...x, secs: Array.from(new Set(x.secs)).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })), numero: nums[k] ?? "", menor: !!menores[k], descripcion: descs[k] || "", edad: edades[k] || "", nacionalidad: nacs[k] || "", categoria: cats[k] || "" }; });
    arr.sort((a, b) => {
      const na = a.numero === "" ? Infinity : Number(a.numero), nb = b.numero === "" ? Infinity : Number(b.numero);
      if (na !== nb) return na - nb;
      return b.total - a.total;
    });
    setLista(arr);
  }
  useEffect(() => { cargar(); }, [proyectoId]);

  async function setNumero(nombre, val) {
    const numero = val === "" ? null : parseInt(val);
    setLista((prev) => prev.map((x) => (x.nombre === nombre ? { ...x, numero: val === "" ? "" : numero } : x)));
    await supabase.from("personajes").upsert({ proyecto_id: proyectoId, nombre, numero }, { onConflict: "proyecto_id,nombre" });
  }
  async function setMenor(nombre, val) {
    setLista((prev) => prev.map((x) => (x.nombre === nombre ? { ...x, menor: val } : x)));
    await supabase.from("personajes").upsert({ proyecto_id: proyectoId, nombre, menor: val }, { onConflict: "proyecto_id,nombre" });
  }
  function updCampoLocal(nombre, campo, val) { setLista((prev) => prev.map((x) => (x.nombre === nombre ? { ...x, [campo]: val } : x))); }
  async function saveCampo(nombre, campo, val) { await supabase.from("personajes").upsert({ proyecto_id: proyectoId, nombre, [campo]: val }, { onConflict: "proyecto_id,nombre" }); }
  async function setNacColor(nac, color) { setNacColores((prev) => ({ ...prev, [nac]: color })); await supabase.from("nac_colores").upsert({ proyecto_id: proyectoId, nacionalidad: nac, color }, { onConflict: "proyecto_id,nacionalidad" }); }
  async function renombrarPersonaje(viejo, nuevoRaw) {
    const nuevo = (nuevoRaw || "").trim().toUpperCase();
    if (!nuevo || nuevo === viejo) return;
    setBusy(true); setErr(null);
    try {
      const { data: caps } = await supabase.from("capitulos").select("escenas(desglose_items(id, categoria, elemento))").eq("proyecto_id", proyectoId);
      const ids = [];
      (caps || []).forEach((c) => (c.escenas || []).forEach((e) => (e.desglose_items || []).forEach((it) => { if (it.categoria === "personajes" && String(it.elemento || "").trim().toUpperCase() === viejo) ids.push(it.id); })));
      for (let i = 0; i < ids.length; i += 200) await supabase.from("desglose_items").update({ elemento: nuevo }).in("id", ids.slice(i, i + 200));
      const { data: existe } = await supabase.from("personajes").select("id").eq("proyecto_id", proyectoId).eq("nombre", nuevo).limit(1);
      if (existe && existe.length) {
        await supabase.from("personajes").delete().eq("proyecto_id", proyectoId).eq("nombre", viejo);
      } else {
        await supabase.from("personajes").update({ nombre: nuevo }).eq("proyecto_id", proyectoId).eq("nombre", viejo);
      }
      await logActividad(proyectoId, "Renombro personaje", `${viejo} -> ${nuevo}`);
      await cargar();
    } catch (e) { setErr("No se pudo renombrar: " + (e.message || e)); }
    setBusy(false);
  }

  async function anadirPersonaje() {
    const nom = prompt("Nombre del personaje (se guardara en mayusculas):");
    if (nom == null) return;
    const nombre = nom.trim().toUpperCase();
    if (!nombre) return;
    if (lista.some((x) => x.nombre === nombre)) { alert(`"${nombre}" ya esta en el reparto.`); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.from("personajes").upsert({ proyecto_id: proyectoId, nombre }, { onConflict: "proyecto_id,nombre" });
    if (error) setErr("No se pudo anadir: " + error.message);
    else { await logActividad(proyectoId, "Anadio un personaje al reparto", nombre); await cargar(); }
    setBusy(false);
  }
  async function eliminarPersonaje(nombre) {
    if (!confirm(`Eliminar "${nombre}" del reparto y de todas las secuencias donde aparece? Esto no se puede deshacer.`)) return;
    setBusy(true); setErr(null);
    try {
      const { data: caps } = await supabase.from("capitulos").select("escenas(desglose_items(id, categoria, elemento))").eq("proyecto_id", proyectoId);
      const ids = [];
      (caps || []).forEach((c) => (c.escenas || []).forEach((e) => (e.desglose_items || []).forEach((it) => { if (it.categoria === "personajes" && String(it.elemento || "").trim().toUpperCase() === nombre) ids.push(it.id); })));
      for (let i = 0; i < ids.length; i += 200) await supabase.from("desglose_items").delete().in("id", ids.slice(i, i + 200));
      await supabase.from("personajes").delete().eq("proyecto_id", proyectoId).eq("nombre", nombre);
      await logActividad(proyectoId, "Elimino un personaje del reparto", nombre);
      await cargar();
    } catch (e) { setErr("No se pudo eliminar: " + (e.message || e)); }
    setBusy(false);
  }

  async function moverPersonaje(p, dir) {
    const arr = [...lista];
    const i = arr.findIndex((x) => x.nombre === p.nombre);
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= arr.length) return;
    const a = arr[i], b = arr[j];
    if (a.numero === "" || a.numero == null || b.numero === "" || b.numero == null) { alert("Para mover, ambos personajes deben tener numero. Usa 'Numerar por importancia' primero si hace falta."); return; }
    setBusy(true); setErr(null);
    try {
      const na = a.numero, nb = b.numero;
      setLista((prev) => prev.map((x) => x.nombre === a.nombre ? { ...x, numero: nb } : x.nombre === b.nombre ? { ...x, numero: na } : x));
      await supabase.from("personajes").upsert([{ proyecto_id: proyectoId, nombre: a.nombre, numero: nb }, { proyecto_id: proyectoId, nombre: b.nombre, numero: na }], { onConflict: "proyecto_id,nombre" });
      await cargar();
    } catch (e) { setErr("No se pudo mover: " + (e.message || e)); }
    setBusy(false);
  }
  async function renumerarDesde(p) {
    const start = parseInt(p.numero);
    if (isNaN(start)) { alert("Este personaje no tiene numero asignado. Ponle uno antes de renumerar desde el."); return; }
    if (!confirm(`Renumerar desde ${p.nombre} (nº ${start}) segun orden de aparicion en el guion? Los personajes con numero menor que ${start} no se tocan.`)) return;
    setBusy(true); setErr(null);
    try {
      const primeraApar = (x) => (x.secs && x.secs.length ? x.secs[0] : "zzzz");
      const candidatos = lista.filter((x) => x.numero !== "" && x.numero != null && Number(x.numero) >= start)
        .sort((a, b) => String(primeraApar(a)).localeCompare(String(primeraApar(b)), undefined, { numeric: true }));
      const rows = candidatos.map((x, i) => ({ proyecto_id: proyectoId, nombre: x.nombre, numero: start + i }));
      for (let i = 0; i < rows.length; i += 200) await supabase.from("personajes").upsert(rows.slice(i, i + 200), { onConflict: "proyecto_id,nombre" });
      await logActividad(proyectoId, "Renumero el reparto", `desde ${p.nombre} (${start})`);
      await cargar();
    } catch (e) { setErr("No se pudo renumerar: " + (e.message || e)); }
    setBusy(false);
  }

  async function autoNumerar() {
    if (!lista) return;
    setBusy(true);
    const arr = [...lista].sort((a, b) => b.total - a.total);
    const rows = arr.map((x, i) => ({ proyecto_id: proyectoId, nombre: x.nombre, numero: i + 1 }));
    const { error } = await supabase.from("personajes").upsert(rows, { onConflict: "proyecto_id,nombre" });
    if (error) setErr(error.message);
    await cargar();
    setBusy(false);
  }

  if (err) return <div className="msg err">{err}</div>;
  if (lista === null) return <p className="muted">Cargando...</p>;
  if (lista.length === 0) return <p className="muted">No hay personajes todavia. Desglosa algun capitulo con IA para que aparezcan aqui.</p>;

  return (
    <div>
      <div className="section-head" style={{ marginTop: 4 }}>
        <h3 className="sub" style={{ margin: 0 }}>Reparto - {lista.length} personajes{lista.filter((x) => x.total === 0).length > 0 && <span className="muted small" style={{ marginLeft: 8, fontWeight: 400 }}>({lista.filter((x) => x.total === 0).length} sin secuencias)</span>}</h3>
        <input className="buscador" placeholder="Buscar personaje..." value={q} onChange={(e) => setQ(e.target.value)} />
        {canEdit && <button className="btn" onClick={anadirPersonaje} disabled={busy}>+ Anadir personaje</button>}
        {canEdit && <button className="btn" onClick={autoNumerar} disabled={busy}>Numerar por importancia</button>}
      </div>
      <datalist id="nac-list">{Array.from(new Set(lista.map((x) => x.nacionalidad).filter(Boolean))).sort().map((n) => <option key={n} value={n} />)}</datalist>
      {(() => { const ns = Array.from(new Set(lista.map((x) => x.nacionalidad).filter(Boolean))).sort();
        return ns.length > 0 ? (
          <div className="nac-leyenda">
            <span className="muted small">Colores por nacionalidad (pulsa el cuadro y elige):</span>
            {ns.map((n) => (
              <div key={n} className="nac-chip">
                <button className="nac-swatch" style={{ background: nacColores[n] || "#e5e7eb" }} disabled={!canEdit} onClick={() => setPaletaAbierta(paletaAbierta === n ? null : n)} title="Elegir color" />
                <span>{n}</span>
                {paletaAbierta === n && canEdit && (
                  <div className="paleta">
                    {PALETA.map((c) => (
                      <button key={c} className="paleta-c" style={{ background: c }} onClick={() => { setNacColor(n, c); setPaletaAbierta(null); }} />
                    ))}
                    <button className="paleta-clear" onClick={() => { setNacColor(n, "#e5e7eb"); setPaletaAbierta(null); }}>sin color</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null; })()}
      <div className="cast">
        <div className="cast-head"><span></span><span>No</span><span>Personaje</span><span>Categoria</span><span>Edad</span><span>Nacion</span><span>Descripcion</span><span>Menor</span><span>Secs.</span><span>Por capitulo</span></div>
        {lista.filter((p) => p.nombre.toLowerCase().includes(q.trim().toLowerCase())).map((p) => (
          <div key={p.nombre} className="cast-item">
          <div className={`cast-row ${p.total === 0 ? "cast-sin-secs" : ""}`} title={p.total === 0 ? "Este personaje no aparece en ninguna secuencia desglosada" : undefined}>
            {canEdit ? <span className="cast-mover">
              <button title="Subir" onClick={() => moverPersonaje(p, "up")} disabled={busy}>▲</button>
              <button title="Bajar" onClick={() => moverPersonaje(p, "down")} disabled={busy}>▼</button>
            </span> : <span />}
            <span>{canEdit
              ? <input className="num" value={p.numero} onChange={(e) => setNumero(p.nombre, e.target.value.replace(/[^0-9]/g, ""))} />
              : (p.numero || "-")}</span>
            <span className="cast-name">{canEdit
              ? <input className="cast-name-in" key={p.nombre} defaultValue={p.nombre} disabled={busy} onBlur={(e) => renombrarPersonaje(p.nombre, e.target.value)} />
              : p.nombre}{canEdit && <button className="cast-del" title="Eliminar del reparto" onClick={() => eliminarPersonaje(p.nombre)}>Eliminar</button>}</span>
            <span>{canEdit
              ? <select className={`cat-in cat-${(p.categoria || "").toLowerCase()}`} value={p.categoria || ""} onChange={(e) => { updCampoLocal(p.nombre, "categoria", e.target.value); saveCampo(p.nombre, "categoria", e.target.value); }}>
                  <option value="">-</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              : (p.categoria || "-")}</span>
            <span>{canEdit
              ? <input className="edad-in" value={p.edad || ""} placeholder="-" onChange={(e) => updCampoLocal(p.nombre, "edad", e.target.value)} onBlur={(e) => saveCampo(p.nombre, "edad", e.target.value)} />
              : (p.edad || "-")}</span>
            <span className="nac-cell">
              {p.nacionalidad && nacColores[p.nacionalidad] && <span className="nac-dot" style={{ background: nacColores[p.nacionalidad] }} />}
              {canEdit
                ? <input className="edad-in" list="nac-list" value={p.nacionalidad || ""} placeholder="-" onChange={(e) => updCampoLocal(p.nombre, "nacionalidad", e.target.value)} onBlur={(e) => saveCampo(p.nombre, "nacionalidad", e.target.value)} />
                : (p.nacionalidad || "-")}
            </span>
            <span>{canEdit
              ? <input className="desc-in" value={p.descripcion || ""} placeholder="ej. padre de Rocio" onChange={(e) => updCampoLocal(p.nombre, "descripcion", e.target.value)} onBlur={(e) => saveCampo(p.nombre, "descripcion", e.target.value)} />
              : (p.descripcion || "-")}</span>
            <span>{canEdit
              ? <input type="checkbox" checked={p.menor} onChange={(e) => setMenor(p.nombre, e.target.checked)} />
              : (p.menor ? "Si" : "-")}</span>
            <span className="cast-total cast-total-btn" title="Ver secuencias" onClick={() => setAbierto(abierto === p.nombre ? null : p.nombre)}>{p.total} {abierto === p.nombre ? "▴" : "▾"}</span>
            <span className="cast-caps">{Object.keys(p.porCap).sort().map((cn) => <em key={cn}>C{cn}:{p.porCap[cn]}</em>)}</span>
          </div>
          {abierto === p.nombre && (
            <div className="cast-secs">
              <span className="muted small">Secuencias ({p.secs.length}):</span> {p.secs.length ? p.secs.map((u, i) => <span key={u}>{i > 0 ? ", " : " "}<button className="sec-link" onClick={() => irASecuencia && irASecuencia(u, "reparto")}>{u}</button></span>) : "-"}
              {canEdit && p.numero !== "" && p.numero != null && <button className="btn ghost mini" style={{ marginLeft: 10 }} onClick={() => renumerarDesde(p)} disabled={busy}>Renumerar reparto desde aqui</button>}
            </div>
          )}
          </div>
        ))}
      </div>
    </div>
  );
}


const REGLAS = [["LV", "L-V"], ["LS", "L-S"]];

function Plan({ proyectoId, canEdit, irASecuencia }) {
  const [escenas, setEscenas] = useState([]);
  const [caps, setCaps] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [dias, setDias] = useState([]);
  const [topePlato, setTopePlato] = useState(40);
  const [topeExt, setTopeExt] = useState(32);
  const [interpretes, setInterpretes] = useState("");
  const [prioridad, setPrioridad] = useState("localizacion");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [persNum, setPersNum] = useState({});
  const [persMenor, setPersMenor] = useState(new Set());
  const [numColor, setNumColor] = useState({});
  const [racordColor, setRacordColor] = useState({});
  const [paletaRac, setPaletaRac] = useState(null);
  const [territorioColor, setTerritorioColor] = useState({});
  const [paletaTerr, setPaletaTerr] = useState(null);
  const [fuera, setFuera] = useState([]);
  const [versiones, setVersiones] = useState([]);
  const [impResumen, setImpResumen] = useState(null);
  const dragRef = useRef(null);
  const [sel, setSel] = useState(new Set());
  const [colocarLoc, setColocarLoc] = useState("");
  const [colocarDeco, setColocarDeco] = useState("");
  const [colocarDias, setColocarDias] = useState([]);
  const [colocarUnidad, setColocarUnidad] = useState(1);
  const [diasConWarning, setDiasConWarning] = useState(new Set());
  const locsProyecto = Array.from(new Set(escenas.map((e) => (e.localizacion || "").trim().toUpperCase()).filter(Boolean))).sort();
  const decosProyecto = Array.from(new Set(escenas.map((e) => (e.decorado || "").trim()).filter(Boolean))).sort();
  const decosParaLoc = colocarLoc ? Array.from(new Set(escenas.filter((e) => (e.localizacion || "").trim().toUpperCase() === colocarLoc).map((e) => (e.decorado || "").trim()).filter(Boolean))).sort() : decosProyecto;
  const secsParaColocar = escenas.filter((e) => {
    if (colocarLoc && (e.localizacion || "").trim().toUpperCase() !== colocarLoc) return false;
    if (colocarDeco && (e.decorado || "").trim().toUpperCase() !== colocarDeco.toUpperCase()) return false;
    if (!colocarLoc && !colocarDeco) return false;
    return true;
  }).slice().sort((a, b) => String(a.uid || "").localeCompare(String(b.uid || ""), undefined, { numeric: true }));
  const secTieneMenor = (e) => (e.desglose_items || []).some((i) => i.categoria === "personajes" && persMenor.has(persNum[String(i.elemento || "").trim().toUpperCase()]));
  const hayMenoresEnSecs = secsParaColocar.some(secTieneMenor);
  async function colocarPorLoc() {
    if (!colocarDias.length || !secsParaColocar.length) return;
    const diasDest = colocarDias.map((id) => dias.find((d) => d.id === id)).filter(Boolean);
    if (!diasDest.length) return;
    const uLbl = colocarUnidad === 2 ? "2a unidad / CC" : "Unidad principal";
    const filtro = colocarLoc ? `"${colocarLoc}${colocarDeco ? " / " + colocarDeco : ""}"` : `decorado "${colocarDeco}"`;
    if (!confirm(`Colocar ${secsParaColocar.length} secuencias de ${filtro} en ${diasDest.length} dia(s) (${uLbl}). Las que ya esten en un dia se moveran. Continuar?`)) return;
    setBusy(true); setErr(null);
    try {
      const slots = diasDest.map((d) => {
        const tope = ((d.espacio || "").toLowerCase().includes("ext") ? topeExt : topePlato) * factor;
        const carga = (d.plan_dia_escenas || []).reduce((s2, x) => s2 + Number(escById[x.escena_id]?.octavos || 0), 0);
        return { diaId: d.id, carga, tope, ord: (d.plan_dia_escenas || []).length, tieneMenor: false };
      });
      let colocadas = 0;
      const warns = new Set();
      for (const e of secsParaColocar) {
        const oct = Number(e.octavos || 0);
        const esMenor = secTieneMenor(e);
        let colocado = false;
        for (const sl of slots) {
          const cabe = sl.carga === 0 || (sl.carga < sl.tope && sl.carga + oct <= sl.tope + 8);
          if (cabe) {
            const diaActual = dias.find((d) => (d.plan_dia_escenas || []).some((x) => x.escena_id === e.id));
            if (diaActual) await supabase.from("plan_dia_escenas").delete().eq("plan_dia_id", diaActual.id).eq("escena_id", e.id);
            await supabase.from("plan_fuera").delete().eq("proyecto_id", proyectoId).eq("escena_id", e.id);
            await supabase.from("plan_dia_escenas").upsert({ plan_dia_id: sl.diaId, escena_id: e.id, orden: sl.ord++, unidad: colocarUnidad }, { onConflict: "plan_dia_id,escena_id" });
            sl.carga += oct; colocadas++; colocado = true;
            if (esMenor) sl.tieneMenor = true;
            if (sl.tieneMenor && sl.carga > sl.tope * 0.7) warns.add(sl.diaId);
            break;
          }
        }
        if (!colocado) break;
      }
      await logActividad(proyectoId, "Coloco secuencias por localizacion", `${filtro}: ${colocadas} secuencias en ${diasDest.length} dia(s)`);
      await cargar();
      setDiasConWarning(warns);
      if (warns.size > 0) alert(`AVISO: ${warns.size} dia(s) con menores superan el 70% de la jornada. Los menores no pueden trabajar mas de 6 horas al dia. Revisalo en el plan (los dias marcados en rojo).`);
      setColocarLoc(""); setColocarDeco(""); setColocarDias([]); setColocarUnidad(1);
    } catch (e) { setErr("No se pudo: " + (e.message || e)); }
    setBusy(false);
  }
  function toggleColocarDia(diaId) { setColocarDias((prev) => prev.includes(diaId) ? prev.filter((x) => x !== diaId) : [...prev, diaId]); }
  const [buscaSec, setBuscaSec] = useState("");
  const [buscaMsg, setBuscaMsg] = useState(null);
  const [resaltada, setResaltada] = useState(null);
  function buscarSecuencia() {
    const q = String(buscaSec || "").trim().toUpperCase();
    if (!q) { setBuscaMsg(null); setResaltada(null); return; }
    const esc = escenas.find((e) => String(e.uid || "").trim().toUpperCase() === q)
      || escenas.find((e) => String(e.uid || "").trim().toUpperCase().includes(q));
    if (!esc) { setBuscaMsg({ tipo: "no", txt: `No existe ninguna secuencia "${buscaSec}" en los capitulos del plan.` }); setResaltada(null); return; }
    const dia = dias.find((d) => (d.plan_dia_escenas || []).some((x) => x.escena_id === esc.id));
    if (dia) {
      const p = String(dia.fecha || "").split("-");
      const fx = p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dia.fecha;
      setBuscaMsg({ tipo: "ok", txt: `${esc.uid} · ${esc.localizacion || esc.header || "-"} · ${fx} · ${dia.territorio || "sin territorio"}` });
      setResaltada(esc.id);
      setTimeout(() => { const el = document.getElementById("str-" + esc.id); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60);
      setTimeout(() => setResaltada(null), 6000);
      return;
    }
    if (fuera.some((f) => f.escena_id === esc.id)) {
      setBuscaMsg({ tipo: "fuera", txt: `${esc.uid} esta en "Fuera de plan" (sin dia asignado).` });
      setResaltada(esc.id);
      setTimeout(() => { const el = document.getElementById("fue-" + esc.id); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60);
      setTimeout(() => setResaltada(null), 6000);
      return;
    }
    setBuscaMsg({ tipo: "no", txt: `${esc.uid} no esta colocada en el plan ni en "Fuera de plan".` });
    setResaltada(null);
  }
  const [destinoSel, setDestinoSel] = useState("");
  function toggleSel(escenaId) { setSel((prev) => { const n = new Set(prev); n.has(escenaId) ? n.delete(escenaId) : n.add(escenaId); return n; }); }
  function limpiarSel() { setSel(new Set()); setDestinoSel(""); }
  async function moverSeleccion(toDiaId) {
    if (!sel.size || !toDiaId) return;
    setBusy(true); setErr(null);
    try {
      const ids = [...sel];
      // origen de cada escena
      const origen = {}; dias.forEach((d) => (d.plan_dia_escenas || []).forEach((x) => { if (sel.has(x.escena_id)) origen[x.escena_id] = d.id; }));
      fuera.forEach((f) => { if (sel.has(f.escena_id)) origen[f.escena_id] = "FUERA"; });
      if (toDiaId === "FUERA") {
        for (const id of ids) {
          const from = origen[id];
          if (from && from !== "FUERA") await supabase.from("plan_dia_escenas").delete().eq("plan_dia_id", from).eq("escena_id", id);
          await supabase.from("plan_fuera").upsert({ proyecto_id: proyectoId, escena_id: id, orden: 0 }, { onConflict: "proyecto_id,escena_id" });
        }
      } else {
        const diaDest = dias.find((d) => d.id === toDiaId);
        let cruces = 0; ids.forEach((id) => { const e = escById[id]; if (e && diaDest && sinTilde(e.territorio) && sinTilde(diaDest.territorio) && sinTilde(e.territorio) !== sinTilde(diaDest.territorio)) cruces++; });
        if (cruces && !window.confirm(`${cruces} de las secuencias seleccionadas son de otro territorio que el dia destino. Moverlas igualmente?`)) { setBusy(false); return; }
        let base = (diaDest?.plan_dia_escenas || []).length;
        for (const id of ids) {
          const from = origen[id];
          if (from === "FUERA") await supabase.from("plan_fuera").delete().eq("proyecto_id", proyectoId).eq("escena_id", id);
          else if (from && from !== toDiaId) await supabase.from("plan_dia_escenas").delete().eq("plan_dia_id", from).eq("escena_id", id);
          await supabase.from("plan_dia_escenas").upsert({ plan_dia_id: toDiaId, escena_id: id, orden: base++ }, { onConflict: "plan_dia_id,escena_id" });
        }
      }
      await logActividad(proyectoId, "Movio secuencias en bloque", `${ids.length} secuencias`);
      limpiarSel();
      await cargar();
    } catch (e) { setErr("No se pudo mover: " + (e.message || e)); }
    setBusy(false);
  }

  function fechaDia(diaId) { const d = dias.find((x) => x.id === diaId); return d ? d.fecha : ""; }
  async function setTipoDia(diaId, tipo) {
    setDias((prev) => prev.map((d) => (d.id === diaId ? { ...d, tipo } : d)));
    await supabase.from("plan_dias").update({ tipo }).eq("id", diaId);
    await logActividad(proyectoId, "Cambio el tipo de un dia", `${fechaDia(diaId)} -> ${tipo}`);
  }
  async function setFlag(diaId, campo, val) {
    setDias((prev) => prev.map((d) => (d.id === diaId ? { ...d, [campo]: val } : d)));
    await supabase.from("plan_dias").update({ [campo]: val }).eq("id", diaId);
    const etq = campo === "doble_unidad" ? "doble unidad" : campo === "camara_caliente" ? "camara caliente" : campo;
    await logActividad(proyectoId, "Marco " + etq, `${fechaDia(diaId)}: ${val ? "si" : "no"}`);
  }
  async function setEspacioDia(diaId, val) {
    setDias((prev) => prev.map((d) => (d.id === diaId ? { ...d, espacio: val } : d)));
    await supabase.from("plan_dias").update({ espacio: val }).eq("id", diaId);
    await logActividad(proyectoId, "Cambio el espacio de un dia", `${fechaDia(diaId)}: ${val || "sin definir"}`);
  }
  async function setEspacio2Dia(diaId, val) {
    setDias((prev) => prev.map((d) => (d.id === diaId ? { ...d, espacio2: val } : d)));
    await supabase.from("plan_dias").update({ espacio2: val }).eq("id", diaId);
    await logActividad(proyectoId, "Cambio el espacio 2a unidad", `${fechaDia(diaId)}: ${val || "sin definir"}`);
  }

  async function reordenarEnDia(escenaId, targetEscenaId, diaId) {
    if (!escenaId || !targetEscenaId || escenaId === targetEscenaId) return;
    const dia = dias.find((d) => d.id === diaId); if (!dia) return;
    const arr = (dia.plan_dia_escenas || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const fromIdx = arr.findIndex((x) => x.escena_id === escenaId);
    const toIdx = arr.findIndex((x) => x.escena_id === targetEscenaId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    const nuevo = arr.map((x, i) => ({ ...x, orden: i }));
    setDias((prev) => prev.map((d) => (d.id === diaId ? { ...d, plan_dia_escenas: nuevo } : d)));
    for (let i = 0; i < nuevo.length; i++) await supabase.from("plan_dia_escenas").update({ orden: i }).eq("plan_dia_id", diaId).eq("escena_id", nuevo[i].escena_id);
  }
  async function moverEscena(escenaId, fromDiaId, toDiaId) {
    if (!toDiaId || fromDiaId === toDiaId) return;
    const nrm = (x) => sinTilde(String(x || "").trim());
    if (toDiaId !== "FUERA") {
      const eMove = escById[escenaId]; const diaDest = dias.find((d) => d.id === toDiaId);
      if (eMove && diaDest && nrm(eMove.territorio) && nrm(diaDest.territorio) && nrm(eMove.territorio) !== nrm(diaDest.territorio)) {
        if (!window.confirm(`La secuencia ${eMove.uid} es de territorio "${eMove.territorio}" y ese dia es de "${diaDest.territorio}". Colocarla igualmente?`)) return;
      }
    }
    if (fromDiaId === "FUERA") {
      await supabase.from("plan_fuera").delete().eq("proyecto_id", proyectoId).eq("escena_id", escenaId);
      await supabase.from("plan_dia_escenas").upsert({ plan_dia_id: toDiaId, escena_id: escenaId, orden: 0 }, { onConflict: "plan_dia_id,escena_id" });
      const e0 = escById[escenaId];
      await logActividad(proyectoId, "Coloco una secuencia desde fuera de plan", `${e0 ? e0.uid : ""} -> ${fechaDia(toDiaId)}`);
      await cargar();
      return;
    }
    if (!fromDiaId) return;
    setDias((prev) => prev.map((d) => {
      if (d.id === fromDiaId) return { ...d, plan_dia_escenas: (d.plan_dia_escenas || []).filter((x) => x.escena_id !== escenaId) };
      if (d.id === toDiaId) {
        const ya = (d.plan_dia_escenas || []).some((x) => x.escena_id === escenaId);
        return ya ? d : { ...d, plan_dia_escenas: [...(d.plan_dia_escenas || []), { escena_id: escenaId, orden: (d.plan_dia_escenas || []).length }] };
      }
      return d;
    }));
    await supabase.from("plan_dia_escenas").delete().eq("plan_dia_id", fromDiaId).eq("escena_id", escenaId);
    await supabase.from("plan_dia_escenas").upsert({ plan_dia_id: toDiaId, escena_id: escenaId, orden: 0 }, { onConflict: "plan_dia_id,escena_id" });
    const eMov = escById[escenaId];
    await logActividad(proyectoId, "Movio una secuencia", `${eMov ? eMov.uid : ""}: ${fechaDia(fromDiaId)} -> ${fechaDia(toDiaId)}`);
    await cargar();
  }
  async function mandarFuera(escenaId, fromDiaId) {
    if (fromDiaId && fromDiaId !== "FUERA") await supabase.from("plan_dia_escenas").delete().eq("plan_dia_id", fromDiaId).eq("escena_id", escenaId);
    await supabase.from("plan_fuera").upsert({ proyecto_id: proyectoId, escena_id: escenaId, orden: 0 }, { onConflict: "proyecto_id,escena_id" });
    const e = escById[escenaId];
    await logActividad(proyectoId, "Mando una secuencia a fuera de plan", e ? e.uid : "");
    await cargar();
  }

  async function activarDia(fecha) {
    if (!fecha) return;
    const terr = (escenas.find(() => true) && terrList[0]) || "";
    const { error } = await supabase.from("plan_dias").insert({ proyecto_id: proyectoId, fecha, tipo: "rodaje", territorio: terr });
    if (error) { setErr(error.message); return; }
    await logActividad(proyectoId, "Activo un dia", fecha);
    await cargar();
  }
  async function cambiarUnidad(escenaId, diaId, unidad) {
    setDias((prev) => prev.map((d) => d.id === diaId
      ? { ...d, plan_dia_escenas: (d.plan_dia_escenas || []).map((x) => x.escena_id === escenaId ? { ...x, unidad } : x) }
      : d));
    await supabase.from("plan_dia_escenas").update({ unidad }).eq("plan_dia_id", diaId).eq("escena_id", escenaId);
  }
  async function moverEscenaUnidad(escenaId, fromDiaId, toDiaId, unidad) {
    if (!escenaId || !toDiaId) return;
    if (fromDiaId === toDiaId) { await cambiarUnidad(escenaId, toDiaId, unidad); return; }
    if (fromDiaId) await supabase.from("plan_dia_escenas").delete().eq("plan_dia_id", fromDiaId).eq("escena_id", escenaId);
    await supabase.from("plan_dia_escenas").upsert({ plan_dia_id: toDiaId, escena_id: escenaId, orden: 0, unidad }, { onConflict: "plan_dia_id,escena_id" });
    await cargar();
  }

  async function cargar() {
    setErr(null);
    const { data: capsData, error: e1 } = await supabase
      .from("capitulos")
      .select("id, numero, nombre_archivo, en_plan, escenas(id, uid, territorio, int_ext, tiempo, octavos, localizacion, decorado, espacio, header, sinopsis, racord, desglose_items(categoria, elemento))")
      .eq("proyecto_id", proyectoId).order("numero");
    if (e1) { setErr(e1.message); return; }
    const es = []; (capsData || []).forEach((c) => (c.escenas || []).forEach((e) => es.push({ ...e, capId: c.id, capNum: c.numero, capEnPlan: c.en_plan })));
    setEscenas(es);
    setCaps((capsData || []).map((c) => ({ id: c.id, numero: c.numero, nombre_archivo: c.nombre_archivo, en_plan: c.en_plan, nEsc: (c.escenas || []).length })));
    const { data: pers } = await supabase.from("personajes").select("nombre, numero, menor, nacionalidad").eq("proyecto_id", proyectoId);
    const pmap = {}; const menores = new Set(); (pers || []).forEach((p) => { if (p.numero != null) { pmap[p.nombre] = p.numero; if (p.menor) menores.add(p.numero); } });
    const { data: ncs } = await supabase.from("nac_colores").select("nacionalidad, color").eq("proyecto_id", proyectoId);
    const colByNac = {}; (ncs || []).forEach((c) => { colByNac[c.nacionalidad] = c.color; });
    const { data: rcs } = await supabase.from("racord_colores").select("racord, color").eq("proyecto_id", proyectoId);
    const rmap = {}; (rcs || []).forEach((c) => { rmap[c.racord] = c.color; }); setRacordColor(rmap);
    const { data: tcs } = await supabase.from("territorio_colores").select("territorio, color").eq("proyecto_id", proyectoId);
    const tmap = {}; (tcs || []).forEach((c) => { tmap[c.territorio] = c.color; }); setTerritorioColor(tmap);
    const ncol = {}; (pers || []).forEach((p) => { if (p.numero != null && p.nacionalidad && colByNac[p.nacionalidad]) ncol[p.numero] = colByNac[p.nacionalidad]; });
    setPersNum(pmap); setPersMenor(menores); setNumColor(ncol);
    const { data: bl } = await supabase.from("plan_bloques").select("*").eq("proyecto_id", proyectoId).order("orden");
    setBloques(bl || []);
    const { data: ds } = await supabase.from("plan_dias").select("id, fecha, tipo, territorio, espacio, espacio2, doble_unidad, camara_caliente, plan_dia_escenas(escena_id, orden, unidad)").eq("proyecto_id", proyectoId).order("fecha");
    const diaIds = (ds || []).map((d) => d.id);
    let pend = [];
    if (diaIds.length) { const { data: pp } = await supabase.from("plan_dia_pendientes").select("*").in("plan_dia_id", diaIds); pend = pp || []; }
    const pendBy = {}; pend.forEach((x) => (pendBy[x.plan_dia_id] = pendBy[x.plan_dia_id] || []).push(x));
    setDias((ds || []).map((d) => ({ ...d, pendientes: pendBy[d.id] || [] })));
    const { data: fp } = await supabase.from("plan_fuera").select("escena_id, orden").eq("proyecto_id", proyectoId).order("orden");
    setFuera(fp || []);
    const { data: vs } = await supabase.from("plan_versiones").select("id, nombre, created_by, created_at").eq("proyecto_id", proyectoId).order("created_at", { ascending: false });
    setVersiones(vs || []);
  }
  useEffect(() => { cargar(); }, [proyectoId]);

  const terrList = Array.from(new Set(escenas.map((e) => (e.territorio || "").trim()).filter(Boolean)));

  async function addBloque() {
    await supabase.from("plan_bloques").insert({ proyecto_id: proyectoId, territorio: terrList[0] || "", inicio: null, dias_rodaje: 5, regla: "LV", festivos: "ninguno", orden: bloques.length });
    cargar();
  }
  async function updBloque(id, partial) {
    setBloques((prev) => prev.map((b) => (b.id === id ? { ...b, ...partial } : b)));
    await supabase.from("plan_bloques").update(partial).eq("id", id);
  }
  async function delBloque(id) { await supabase.from("plan_bloques").delete().eq("id", id); cargar(); }

  async function sacarMalUbicadas() {
    const malas = [];
    dias.forEach((d) => (d.plan_dia_escenas || []).forEach((x) => {
      const e = escById[x.escena_id];
      if (e && sinTilde(e.territorio) && sinTilde(d.territorio) && sinTilde(e.territorio) !== sinTilde(d.territorio)) malas.push({ escena_id: x.escena_id, diaId: d.id, uid: e.uid, terrE: e.territorio, terrD: d.territorio });
    }));
    if (!malas.length) { setErr("No hay secuencias en un dia de territorio distinto al suyo. Todo cuadra."); return; }
    const ejemplos = malas.slice(0, 5).map((m) => `${m.uid} (${m.terrE}) esta en dia ${m.terrD}`).join("\n");
    if (!confirm(`Hay ${malas.length} secuencias en un dia de territorio distinto al suyo:\n\n${ejemplos}${malas.length > 5 ? "\n..." : ""}\n\nSacarlas a 'Fuera de plan' para recolocarlas bien (pulsando luego Auto-reparto)?`)) return;
    setBusy(true); setErr(null);
    try {
      for (const m of malas) {
        await supabase.from("plan_dia_escenas").delete().eq("plan_dia_id", m.diaId).eq("escena_id", m.escena_id);
      }
      const filas = [...new Set(malas.map((m) => m.escena_id))].map((id, i) => ({ proyecto_id: proyectoId, escena_id: id, orden: i }));
      for (let i = 0; i < filas.length; i += 400) await supabase.from("plan_fuera").upsert(filas.slice(i, i + 400), { onConflict: "proyecto_id,escena_id" });
      await logActividad(proyectoId, "Saco secuencias mal ubicadas por territorio", `${malas.length}`);
      await cargar();
    } catch (e) { setErr("No se pudo: " + (e.message || e)); }
    setBusy(false);
  }
  async function limpiarCalendario() {
    if (!confirm("Mandar todas las secuencias colocadas a 'Fuera de plan' y vaciar los dias? (Las pendientes en rojo se mantienen.)")) return;
    setBusy(true); setErr(null);
    try {
      const colocadas = [];
      dias.forEach((d) => (d.plan_dia_escenas || []).forEach((x) => colocadas.push(x.escena_id)));
      const uniq = [...new Set(colocadas)];
      const diaIds = dias.map((d) => d.id);
      if (diaIds.length) await supabase.from("plan_dia_escenas").delete().in("plan_dia_id", diaIds);
      const filas = uniq.map((id, i) => ({ proyecto_id: proyectoId, escena_id: id, orden: i }));
      for (let i = 0; i < filas.length; i += 400) await supabase.from("plan_fuera").upsert(filas.slice(i, i + 400), { onConflict: "proyecto_id,escena_id" });
      await logActividad(proyectoId, "Limpio el calendario", `${uniq.length} secuencias a fuera de plan`);
      await cargar();
    } catch (e) { setErr("No se pudo limpiar: " + (e.message || e)); }
    setBusy(false);
  }
  async function guardarVersion() {
    const njor = dias.filter((d) => d.tipo === "rodaje").length;
    const sugerido = `Plan ${njor} jornadas - ${new Date().toLocaleDateString("es-ES")}`;
    const nombre = prompt("Nombre de la version:", sugerido);
    if (!nombre || !nombre.trim()) return;
    const snap = {
      dias: dias.map((d) => ({
        fecha: d.fecha, tipo: d.tipo, territorio: d.territorio || "", espacio: d.espacio || "", espacio2: d.espacio2 || "",
        doble_unidad: !!d.doble_unidad, camara_caliente: !!d.camara_caliente,
        escenas: (d.plan_dia_escenas || []).map((x) => ({ escena_id: x.escena_id, orden: x.orden || 0, unidad: x.unidad || 1 })),
        pendientes: (d.pendientes || []).map((pp) => ({ etiqueta: pp.etiqueta, num_norm: pp.num_norm, orden: pp.orden || 0, unidad: pp.unidad || 1 })),
      })),
      fuera: (fuera || []).map((f) => ({ escena_id: f.escena_id, orden: f.orden || 0 })),
    };
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("plan_versiones").insert({ proyecto_id: proyectoId, nombre: nombre.trim(), datos: snap, created_by: user?.email || "" });
    if (error) { setErr(error.message); return; }
    await logActividad(proyectoId, "Guardo una version del plan", nombre.trim());
    await cargar();
  }
  async function restaurarVersion(v) {
    if (!confirm(`Restaurar "${v.nombre}"? Se reemplazara el plan actual.`)) return;
    setBusy(true); setErr(null);
    try {
      const { data: full } = await supabase.from("plan_versiones").select("datos").eq("id", v.id).single();
      const snap = full?.datos; if (!snap) throw new Error("Version vacia");
      await supabase.from("plan_dias").delete().eq("proyecto_id", proyectoId);
      await supabase.from("plan_fuera").delete().eq("proyecto_id", proyectoId);
      const filas = (snap.dias || []).map((d) => ({ proyecto_id: proyectoId, fecha: d.fecha, tipo: d.tipo, territorio: d.territorio || "", espacio: d.espacio || "", espacio2: d.espacio2 || "", doble_unidad: !!d.doble_unidad, camara_caliente: !!d.camara_caliente }));
      const { data: nuevos, error: ed } = await supabase.from("plan_dias").insert(filas).select();
      if (ed) throw ed;
      const idByFecha = {}; nuevos.forEach((n) => (idByFecha[n.fecha] = n.id));
      const enlaces = [], pend = [];
      (snap.dias || []).forEach((d) => { const id = idByFecha[d.fecha];
        (d.escenas || []).forEach((x) => { if (escById[x.escena_id]) enlaces.push({ plan_dia_id: id, escena_id: x.escena_id, orden: x.orden || 0, unidad: x.unidad || 1 }); });
        (d.pendientes || []).forEach((pp) => pend.push({ plan_dia_id: id, etiqueta: pp.etiqueta, num_norm: pp.num_norm, orden: pp.orden || 0, unidad: pp.unidad || 1 }));
      });
      if (enlaces.length) await insertChunked("plan_dia_escenas", enlaces);
      if (pend.length) await insertChunked("plan_dia_pendientes", pend);
      const ff = (snap.fuera || []).filter((f) => escById[f.escena_id]).map((f) => ({ proyecto_id: proyectoId, escena_id: f.escena_id, orden: f.orden || 0 }));
      if (ff.length) await insertChunked("plan_fuera", ff);
      await logActividad(proyectoId, "Restauro una version del plan", v.nombre);
      await cargar();
    } catch (e) { setErr("No se pudo restaurar: " + (e.message || e)); }
    setBusy(false);
  }
  async function borrarVersion(v) {
    if (!confirm(`Borrar la version "${v.nombre}"?`)) return;
    await supabase.from("plan_versiones").delete().eq("id", v.id);
    await logActividad(proyectoId, "Borro una version del plan", v.nombre);
    await cargar();
  }

  async function importarPlan(file) {
    setBusy(true); setErr(null); setImpResumen(null);
    try {
      const plan = await leerStripboard(file);
      const dch = plan.filter((d) => d.fecha);
      if (!dch.length) throw new Error("No se detectaron dias. Asegurate de exportar el stripboard en formato lista.");
      const { data: caps } = await supabase.from("capitulos").select("escenas(id, uid)").eq("proyecto_id", proyectoId);
      const normMap = {};
      (caps || []).forEach((c) => (c.escenas || []).forEach((e) => { const k = String(e.uid || "").replace(/[.\s]/g, "").toUpperCase(); if (k) normMap[k] = e.id; }));
      await supabase.from("plan_dias").delete().eq("proyecto_id", proyectoId);
      const filas = dch.map((d) => ({ proyecto_id: proyectoId, fecha: d.fecha, tipo: "rodaje", territorio: d.territorio || "", doble_unidad: d.doble_unidad, camara_caliente: d.camara_caliente }));
      const { data: nuevos, error: ed } = await supabase.from("plan_dias").insert(filas).select();
      if (ed) throw ed;
      const idByFecha = {}; nuevos.forEach((nd) => (idByFecha[nd.fecha] = nd.id));
      const enlaces = [], pendientes = []; let ok = 0, pe = 0;
      dch.forEach((d) => {
        const diaId = idByFecha[d.fecha];
        const vistos = new Set();
        d.secs.forEach((sec, i) => {
          const uid = sec.uid, unidad = sec.unidad || 1;
          const k = String(uid).replace(/[.\s]/g, "").toUpperCase();
          const eid = normMap[k];
          if (eid) {
            const clave = diaId + "|" + eid;
            if (vistos.has(clave)) return;
            vistos.add(clave);
            enlaces.push({ plan_dia_id: diaId, escena_id: eid, orden: i, unidad }); ok++;
          } else { pendientes.push({ plan_dia_id: diaId, etiqueta: uid, num_norm: k, orden: i, unidad }); pe++; }
        });
      });
      if (enlaces.length) await insertChunked("plan_dia_escenas", enlaces);
      if (pendientes.length) await insertChunked("plan_dia_pendientes", pendientes);
      await logActividad(proyectoId, "Importo el plan (stripboard)", `${dch.length} dias, ${ok} enlazadas, ${pe} pendientes`);
      setImpResumen({ dias: dch.length, ok, pend: pe });
      await cargar();
    } catch (e) { setErr("No se pudo importar: " + (e.message || e)); }
    setBusy(false);
  }
  async function onImportPlanFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    await importarPlan(file);
    ev.target.value = "";
  }

  async function generar() {
    setBusy(true); setErr(null);
    await supabase.from("plan_dias").delete().eq("proyecto_id", proyectoId);
    const ordered = bloques.filter((b) => b.inicio).slice().sort((a, b) => a.inicio.localeCompare(b.inicio));
    const seen = {};
    ordered.forEach((b) => genDiasBloque(b).forEach((d) => { if (!seen[d.fecha]) seen[d.fecha] = { tipo: d.tipo, territorio: d.territorio }; }));
    const fechas = Object.keys(seen);
    const filas = [];
    if (fechas.length) {
      // rellenar TODOS los dias entre el primero y el ultimo (los huecos quedan como descanso, editables)
      fechas.sort();
      let cur = addDays(parseISO(fechas[0]), -7); const end = addDays(parseISO(fechas[fechas.length - 1]), 7); let g = 0;
      while (cur <= end && g < 2000) {
        const iso = fmtISO(cur);
        const info = seen[iso] || { tipo: "descanso", territorio: "" };
        filas.push({ proyecto_id: proyectoId, fecha: iso, tipo: info.tipo, territorio: info.territorio });
        cur = addDays(cur, 1); g++;
      }
    }
    if (filas.length) { const { error } = await supabase.from("plan_dias").insert(filas); if (error) setErr(error.message); }
    await logActividad(proyectoId, "Genero el calendario", `${filas.length} dias`);
    await cargar(); setBusy(false);
  }

  async function guardarRacordColor(racord, color) {
    setRacordColor((prev) => ({ ...prev, [racord]: color }));
    await supabase.from("racord_colores").upsert({ proyecto_id: proyectoId, racord, color }, { onConflict: "proyecto_id,racord" });
  }
  async function guardarTerritorioColor(territorio, color) {
    setTerritorioColor((prev) => ({ ...prev, [territorio]: color }));
    await supabase.from("territorio_colores").upsert({ proyecto_id: proyectoId, territorio, color }, { onConflict: "proyecto_id,territorio" });
  }
  async function toggleCapPlan(cap, val) {
    setBusy(true); setErr(null);
    try {
      await supabase.from("capitulos").update({ en_plan: val }).eq("id", cap.id);
      if (!val) {
        const escIds = escenas.filter((e) => e.capId === cap.id).map((e) => e.id);
        if (escIds.length) {
          const diaIds = dias.map((d) => d.id);
          if (diaIds.length) await supabase.from("plan_dia_escenas").delete().in("plan_dia_id", diaIds).in("escena_id", escIds);
          await supabase.from("plan_fuera").delete().eq("proyecto_id", proyectoId).in("escena_id", escIds);
        }
      }
      await logActividad(proyectoId, val ? "Anadio capitulo al plan" : "Quito capitulo del plan", `Cap ${cap.numero}`);
      await cargar();
    } catch (e) { setErr("No se pudo: " + (e.message || e)); }
    setBusy(false);
  }
  async function activarTodosCaps(val) {
    if (!val && !confirm("Quitar TODOS los capitulos del plan? Se vaciara el calendario.")) return;
    setBusy(true); setErr(null);
    try {
      await supabase.from("capitulos").update({ en_plan: val }).eq("proyecto_id", proyectoId);
      if (!val) {
        const diaIds = dias.map((d) => d.id);
        if (diaIds.length) await supabase.from("plan_dia_escenas").delete().in("plan_dia_id", diaIds);
        await supabase.from("plan_fuera").delete().eq("proyecto_id", proyectoId);
      }
      await logActividad(proyectoId, val ? "Activo todos los capitulos en el plan" : "Quito todos los capitulos del plan", "");
      await cargar();
    } catch (e) { setErr("No se pudo: " + (e.message || e)); }
    setBusy(false);
  }
  async function autoReparto() {
    setBusy(true); setErr(null);
    try {
      const topeDeEspacio = (esp) => esp === "plato" ? topePlato : (esp === "exteriores" || esp === "ext_noche") ? topeExt : topePlato;
      const norm = (x) => String(x || "").trim().toUpperCase();
      const nt = (x) => sinTilde(String(x || "").trim()); // territorio: sin tildes ni espacios
      const numsDe = (e) => (e.desglose_items || []).filter((i) => i.categoria === "personajes").map((i) => persNum[norm(i.elemento)]).filter((v) => v != null);
      const sel = new Set(String(interpretes).split(/[^0-9]+/).map((x) => parseInt(x)).filter((x) => !isNaN(x)));

      // 1. secuencias ya colocadas o en fuera de plan -> no se tocan
      const colocadas = new Set();
      dias.forEach((d) => (d.plan_dia_escenas || []).forEach((x) => colocadas.add(x.escena_id)));
      fuera.forEach((f) => colocadas.add(f.escena_id));

      // 2. pendientes: desglosadas, con territorio, no colocadas
      const pendientes = escenas.filter((e) => !colocadas.has(e.id) && nt(e.territorio) && e.capEnPlan);
      if (!pendientes.length) { setErr("No hay secuencias nuevas que colocar (todo esta ya en el calendario o en fuera de plan)."); setBusy(false); return; }

      // 3. orden: interprete seleccionado -> espacio -> localizacion -> decorado -> nº secuencia
      pendientes.sort((a, b) => {
        if (sel.size) {
          const ka = numsDe(a).some((x) => sel.has(x)) ? 0 : 1;
          const kb = numsDe(b).some((x) => sel.has(x)) ? 0 : 1;
          if (ka !== kb) return ka - kb;
        }
        const ea = (a.espacio || ""), eb = (b.espacio || ""); if (ea !== eb) return ea.localeCompare(eb);
        const la = (a.localizacion || a.header || ""), lb = (b.localizacion || b.header || ""); if (la !== lb) return la.localeCompare(lb);
        const da = (a.decorado || ""), db = (b.decorado || ""); if (da !== db) return da.localeCompare(db);
        return String(a.uid).localeCompare(String(b.uid), undefined, { numeric: true });
      });

      // 4. por territorio, construir slots (dia + unidad) respetando carga actual
      const shoot = dias.filter((d) => d.tipo === "rodaje").slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
      const cargaUnidad = (d, u) => (d.plan_dia_escenas || []).filter((x) => (x.unidad || 1) === u).reduce((s, x) => s + Number(escById[x.escena_id]?.octavos || 0), 0);
      const ordUnidad = (d, u) => (d.plan_dia_escenas || []).filter((x) => (x.unidad || 1) === u).length;

      const byTerr = {}; shoot.forEach((d) => { (byTerr[nt(d.territorio)] = byTerr[nt(d.territorio)] || []).push(d); });
      const rows = [];
      const locDe = (e) => (e.localizacion || e.header || "SIN LOC").trim().toUpperCase();
      Object.keys(byTerr).forEach((terr) => {
        const days = byTerr[terr];
        const slots = [];
        days.forEach((d) => {
          const u1 = (d.plan_dia_escenas || []).filter((x) => (x.unidad || 1) === 1);
          const loc1 = u1.length ? locDe(escById[u1[0].escena_id] || {}) : null;
          slots.push({ diaId: d.id, unidad: 1, espacio: d.espacio || "", carga: cargaUnidad(d, 1), ord: ordUnidad(d, 1), loc: loc1 });
          if (d.doble_unidad || d.camara_caliente) {
            const esp2 = d.camara_caliente ? "plato" : (d.espacio2 || "");
            const u2 = (d.plan_dia_escenas || []).filter((x) => (x.unidad || 1) === 2);
            const loc2 = u2.length ? locDe(escById[u2[0].escena_id] || {}) : null;
            slots.push({ diaId: d.id, unidad: 2, espacio: esp2, carga: cargaUnidad(d, 2), ord: ordUnidad(d, 2), loc: loc2 });
          }
        });
        const secsTerr = pendientes.filter((e) => nt(e.territorio) === terr);

        // Construir grupos segun la prioridad elegida.
        // Cada "grupo" se coloca entero (respetando que un dia = una localizacion) antes del siguiente.
        // - Por localizacion: un grupo por localizacion.
        // - Por actor: primero un grupo por cada actor indicado (sus secuencias), y dentro se agrupan por localizacion; el resto, por localizacion.
        const gruposLoc = (lista) => {
          const porLoc = {}; lista.forEach((e) => { const L = locDe(e); (porLoc[L] = porLoc[L] || []).push(e); });
          return Object.keys(porLoc).sort((a, b) => {
            const ua = porLoc[a].map((e) => e.uid).sort((x, y) => String(x).localeCompare(String(y), undefined, { numeric: true }))[0] || "";
            const ub = porLoc[b].map((e) => e.uid).sort((x, y) => String(x).localeCompare(String(y), undefined, { numeric: true }))[0] || "";
            return String(ua).localeCompare(String(ub), undefined, { numeric: true });
          }).map((L) => ({ loc: L, secs: porLoc[L] }));
        };

        let grupos = [];
        if (prioridad === "actor" && sel.size) {
          const usadas = new Set();
          // un bloque por cada actor indicado, en el orden en que se escribieron
          const actoresOrden = String(interpretes).split(/[^0-9]+/).map((x) => parseInt(x)).filter((x) => !isNaN(x));
          const vistos = new Set();
          for (const num of actoresOrden) {
            if (vistos.has(num)) continue; vistos.add(num);
            const delActor = secsTerr.filter((e) => !usadas.has(e.id) && numsDe(e).includes(num));
            delActor.forEach((e) => usadas.add(e.id));
            if (delActor.length) grupos.push(...gruposLoc(delActor));
          }
          // resto (sin esos actores) por localizacion
          const resto = secsTerr.filter((e) => !usadas.has(e.id));
          grupos.push(...gruposLoc(resto));
        } else {
          grupos = gruposLoc(secsTerr);
        }

        for (const grupo of grupos) {
          const L = grupo.loc;
          for (const e of grupo.secs) {
            const oct = Number(e.octavos || 0);
            const esp = norm(e.espacio) ? (e.espacio || "").trim() : "";
            for (const sl of slots) {
              const espOk = !esp || !sl.espacio || sl.espacio === esp;
              const locOk = !sl.loc || sl.loc === L; // un dia = una sola localizacion
              const tope = topeDeEspacio(sl.espacio || esp);
              // norma +1 pagina: si el dia esta por debajo del tope, cabe aunque supere hasta 1 pagina (8/8)
              const cabe = sl.carga === 0 ? true : (sl.carga < tope && sl.carga + oct <= tope + 8);
              if (espOk && locOk && cabe) {
                rows.push({ plan_dia_id: sl.diaId, escena_id: e.id, unidad: sl.unidad, orden: sl.ord++ });
                sl.carga += oct; sl.loc = L; break;
              }
            }
            // si no cabe en ningun slot, se queda sin colocar
          }
        }
      });

      if (rows.length) { await insertChunked("plan_dia_escenas", rows); }
      await logActividad(proyectoId, "Hizo el auto-reparto", `${rows.length} secuencias colocadas`);
      await cargar();
    } catch (e) { setErr("No se pudo repartir: " + (e.message || e)); }
    setBusy(false);
  }

  const escById = {}; escenas.forEach((e) => (escById[e.id] = e));
  const normUid = (u) => String(u || "").replace(/[.\s]/g, "").toUpperCase();
  const escByUid = {}; escenas.forEach((e) => { const k = normUid(e.uid); if (k && !escByUid[k]) escByUid[k] = e; });
  async function linkarPendiente(pend, escenaId) {
    if (!escenaId) return;
    const { data: ya } = await supabase.from("plan_dia_escenas").select("id").eq("plan_dia_id", pend.plan_dia_id).eq("escena_id", escenaId).limit(1);
    if (!ya || !ya.length) {
      await supabase.from("plan_dia_escenas").insert({ plan_dia_id: pend.plan_dia_id, escena_id: escenaId, orden: pend.orden || 0, unidad: pend.unidad || 1 });
    }
    await supabase.from("plan_dia_pendientes").delete().eq("id", pend.id);
    const eLink = escById[escenaId];
    await logActividad(proyectoId, "Linko una secuencia", `${pend.etiqueta} -> ${eLink ? eLink.uid : ""}`);
    await cargar();
  }
  const dayNo = {}; let n = 0;
  dias.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((d) => { if (d.tipo === "rodaje") { n++; dayNo[d.fecha] = n; } });

  let weeks = [];
  if (dias.length) {
    const sorted = dias.slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    const first = parseISO(sorted[0].fecha), last = parseISO(sorted[sorted.length - 1].fecha);
    const map = {}; dias.forEach((d) => (map[d.fecha] = d));
    let cur = addDays(first, -((first.getDay() + 6) % 7));
    const end = addDays(last, 6 - ((last.getDay() + 6) % 7));
    let g = 0;
    while (cur <= end && g < 400) { const w = []; for (let i = 0; i < 7; i++) { const iso = fmtISO(cur); w.push({ iso, dia: map[iso] || null }); cur = addDays(cur, 1); } weeks.push(w); g++; }
  }
  const weekNo = {}; let sem = 0;
  weeks.forEach((w, wi) => { if (w.some((c) => c.dia && c.dia.tipo === "rodaje")) { sem++; weekNo[wi] = sem; } });

  return (
    <div className="plan-wide">
      {err && <div className="msg err">{err}</div>}
      <div className="card-lite">
        <div className="row">
          <h3 className="sub" style={{ margin: 0 }}>Territorios y fechas de rodaje</h3>
          {canEdit && <button className="btn" onClick={addBloque}>+ Bloque</button>}
          {canEdit && <label className="btn import-btn" style={{ marginLeft: "auto" }}>Importar plan (PDF){busy ? "..." : ""}<input type="file" accept="application/pdf,.pdf" onChange={onImportPlanFile} style={{ display: "none" }} /></label>}
        </div>
        {impResumen && <div className="msg ok">Plan importado: {impResumen.dias} dias, {impResumen.ok} secuencias enlazadas, {impResumen.pend} pendientes de linkar (en rojo).</div>}
        <datalist id="terr-plan">{terrList.map((t) => <option key={t} value={t} />)}</datalist>
        {bloques.length === 0 ? <p className="muted small">Anade un bloque por territorio. Mexico L-S (rueda sabados), Madrid o Tenerife L-V.</p>
          : <div className="bloques">{bloques.map((b) => (
              <div key={b.id} className="bloque">
                <input list="terr-plan" value={b.territorio || ""} placeholder="territorio" onChange={(e) => updBloque(b.id, { territorio: e.target.value })} disabled={!canEdit} />
                <input type="date" value={b.inicio || ""} onChange={(e) => updBloque(b.id, { inicio: e.target.value })} disabled={!canEdit} />
                <input type="number" min="1" value={b.dias_rodaje || 1} title="dias de rodaje" onChange={(e) => updBloque(b.id, { dias_rodaje: Math.max(1, parseInt(e.target.value) || 1) })} disabled={!canEdit} />
                <div className="seg">{REGLAS.map(([k, l]) => <button key={k} className={b.regla === k ? "on" : ""} onClick={() => canEdit && updBloque(b.id, { regla: k })}>{l}</button>)}</div>
                {canEdit && <button className="btn ghost danger" onClick={() => delBloque(b.id)}>x</button>}
              </div>
            ))}</div>}
        {canEdit && caps.length > 0 && (
          <div className="caps-plan">
            <div className="caps-plan-head">
              <span className="muted small">Capitulos en el plan ({caps.filter((c) => c.en_plan).length}/{caps.length}):</span>
              <button className="btn ghost mini" onClick={() => activarTodosCaps(true)} disabled={busy}>Todos</button>
              <button className="btn ghost mini" onClick={() => activarTodosCaps(false)} disabled={busy}>Ninguno</button>
            </div>
            <div className="caps-plan-list">
              {caps.map((c) => (
                <button key={c.id} className={`cap-pill ${c.en_plan ? "on" : ""}`} disabled={busy} onClick={() => toggleCapPlan(c, !c.en_plan)} title={c.en_plan ? "Quitar del plan" : "Anadir al plan"}>
                  {c.en_plan ? "✓ " : ""}Cap {c.numero}
                </button>
              ))}
            </div>
          </div>
        )}
        {canEdit && (() => {
          const racords = Array.from(new Set((escenas || []).map((e) => (e.racord || "").trim()).filter(Boolean))).sort();
          return racords.length > 0 ? (
            <div className="caps-plan">
              <div className="caps-plan-head"><span className="muted small">Colores por racord (pulsa el cuadro y elige):</span></div>
              <div className="nac-leyenda">
                {racords.map((r) => (
                  <div key={r} className="nac-chip">
                    <button className="nac-swatch" style={{ background: racordColor[r] || "#e5e7eb" }} onClick={() => setPaletaRac(paletaRac === r ? null : r)} title="Elegir color" />
                    <span>{r}</span>
                    {paletaRac === r && (
                      <div className="paleta">
                        {PALETA.map((c) => <button key={c} className="paleta-c" style={{ background: c }} onClick={() => { guardarRacordColor(r, c); setPaletaRac(null); }} />)}
                        <button className="paleta-clear" onClick={() => { guardarRacordColor(r, "#e5e7eb"); setPaletaRac(null); }}>sin color</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}
        {canEdit && (() => {
          const terrs = Array.from(new Set((escenas || []).map((e) => (e.territorio || "").trim()).filter(Boolean))).sort();
          return terrs.length > 0 ? (
            <div className="caps-plan">
              <div className="caps-plan-head"><span className="muted small">Colores por territorio (pulsa el cuadro y elige):</span></div>
              <div className="nac-leyenda">
                {terrs.map((t) => (
                  <div key={t} className="nac-chip">
                    <button className="nac-swatch" style={{ background: territorioColor[t] || "#e5e7eb" }} onClick={() => setPaletaTerr(paletaTerr === t ? null : t)} title="Elegir color" />
                    <span>{t}</span>
                    {paletaTerr === t && (
                      <div className="paleta">
                        {PALETA.map((c) => <button key={c} className="paleta-c" style={{ background: c }} onClick={() => { guardarTerritorioColor(t, c); setPaletaTerr(null); }} />)}
                        <button className="paleta-clear" onClick={() => { guardarTerritorioColor(t, "#e5e7eb"); setPaletaTerr(null); }}>sin color</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}
        {canEdit && bloques.length > 0 && (<>
          <div className="actions auto-rep">
            <button className="primary inline" onClick={generar} disabled={busy}>Generar calendario</button>
            <span className="muted small ar-lbl">Tope/dia (paginas) — Plato:</span>
            <input className="num" defaultValue={fmtEighths(topePlato)} key={"tp" + topePlato} onBlur={(e) => setTopePlato(Math.max(8, parseEighths(e.target.value) || 40))} title="Ej. 5 o 5 4/8" />
            <span className="muted small ar-lbl">Ext:</span>
            <input className="num" defaultValue={fmtEighths(topeExt)} key={"te" + topeExt} onBlur={(e) => setTopeExt(Math.max(8, parseEighths(e.target.value) || 32))} title="Ej. 4 o 4 4/8" />
            <span className="muted small ar-lbl">Prioridad:</span>
            <select className="num" value={prioridad} onChange={(e) => setPrioridad(e.target.value)} title="Como agrupar el reparto" style={{ width: "auto" }}>
              <option value="localizacion">Por localizacion</option>
              <option value="actor">Por actor(es)</option>
            </select>
            <span className="muted small ar-lbl">{prioridad === "actor" ? "Actores nº:" : "Priorizar nº:"}</span>
            <input className="num ar-int" placeholder="ej. 1,5" value={interpretes} onChange={(e) => setInterpretes(e.target.value)} title="Numeros de interprete a juntar/priorizar, separados por coma" />
            <button className="btn" onClick={autoReparto} disabled={busy || !dias.length}>Auto-reparto</button>
            <button className="btn ghost" onClick={sacarMalUbicadas} disabled={busy || !dias.length} title="Saca a fuera de plan las secuencias que estan en un dia de territorio distinto al suyo">Sacar mal ubicadas</button>
            <button className="btn ghost danger" onClick={limpiarCalendario} disabled={busy || !dias.length}>Vaciar a fuera de plan</button>
          </div>

          <div className="colocar-box">
            <div className="colocar-row">
              <span className="muted small ar-lbl">Localizacion:</span>
              <select className="num" style={{ width: "auto", maxWidth: 200 }} value={colocarLoc} onChange={(e) => { setColocarLoc(e.target.value); setColocarDeco(""); setColocarDias([]); }}>
                <option value="">Todas</option>
                {locsProyecto.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <span className="muted small ar-lbl">Decorado:</span>
              <select className="num" style={{ width: "auto", maxWidth: 180 }} value={colocarDeco} onChange={(e) => setColocarDeco(e.target.value)}>
                <option value="">Todos</option>
                {decosParaLoc.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {(colocarLoc || colocarDeco) && <span className="muted small">{secsParaColocar.length} sec.{hayMenoresEnSecs && <span className="col-menor-warn"> (con menores)</span>}</span>}
            </div>
            {(colocarLoc || colocarDeco) && secsParaColocar.length > 0 && (
              <div className="colocar-dias">
                <div className="colocar-row">
                  <span className="muted small">Unidad:</span>
                  <select className="num" style={{ width: "auto" }} value={colocarUnidad} onChange={(e) => setColocarUnidad(Number(e.target.value))}>
                    <option value={1}>UP - Unidad principal</option>
                    <option value={2}>DU - Doble unidad</option>
                    <option value={3}>CC - Camara caliente</option>
                  </select>
                </div>
                <span className="muted small">Dias destino (marca los dias donde colocar):</span>
                <div className="colocar-dias-grid">
                  {dias.filter((d) => d.tipo === "rodaje").slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map((d) => {
                    const p = String(d.fecha).split("-"); const fx = p.length === 3 ? `${p[2]}/${p[1]}` : d.fecha;
                    const u = d.camara_caliente ? " [CC]" : d.doble_unidad ? " [DU]" : "";
                    const on = colocarDias.includes(d.id);
                    const warn = diasConWarning.has(d.id);
                    return <label key={d.id} className={`colocar-dia-chk ${on ? "on" : ""} ${warn ? "dia-warn" : ""}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleColocarDia(d.id)} /> {fx} · {d.territorio || "-"}{u}
                    </label>;
                  })}
                </div>
                <button className="btn" disabled={busy || !colocarDias.length} onClick={colocarPorLoc}>
                  Colocar {secsParaColocar.length} secuencias en {colocarDias.length} dia(s)
                </button>
              </div>
            )}
          </div>
        </>)}
        {dias.length > 0 && (
          <div className="busca-sec">
            <input className="busca-sec-in" placeholder="Buscar secuencia en el plan (ej. 2x14)" value={buscaSec}
              onChange={(e) => { setBuscaSec(e.target.value); if (!e.target.value.trim()) { setBuscaMsg(null); setResaltada(null); } }}
              onKeyDown={(e) => e.key === "Enter" && buscarSecuencia()} />
            <button className="btn" onClick={buscarSecuencia}>Buscar</button>
            {buscaMsg && <span className={`busca-msg busca-${buscaMsg.tipo}`}>{buscaMsg.txt}</span>}
            {buscaMsg && <button className="btn ghost mini" onClick={() => { setBuscaSec(""); setBuscaMsg(null); setResaltada(null); }}>Limpiar</button>}
          </div>
        )}
        {dias.length > 0 && (
          <div className="versiones">
            <div className="ver-head">
              <h3 className="sub" style={{ margin: 0 }}>Versiones guardadas</h3>
              {canEdit && <button className="btn" onClick={guardarVersion} disabled={busy}>Guardar version actual</button>}
            </div>
            {versiones.length === 0 ? <span className="muted small">Aun no has guardado ninguna version.</span> : (
              <ul className="ver-list">
                {versiones.map((v) => (
                  <li key={v.id}>
                    <span className="ver-nom">{v.nombre}</span>
                    <span className="muted small ver-meta">{new Date(v.created_at).toLocaleDateString("es-ES")}{v.created_by ? ` · Guardado por ${v.created_by}` : ""}</span>
                    {canEdit && <button className="btn ghost" onClick={() => restaurarVersion(v)} disabled={busy}>Restaurar</button>}
                    {canEdit && <button className="btn ghost danger" onClick={() => borrarVersion(v)} disabled={busy}>x</button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <datalist id="esc-list-link">{escenas.map((e) => <option key={e.id} value={e.uid}>{e.localizacion || e.header}</option>)}</datalist>

      {canEdit && sel.size > 0 && (
        <div className="sel-bar">
          <b>{sel.size} seleccionada{sel.size > 1 ? "s" : ""}</b>
          <select value={destinoSel} onChange={(e) => setDestinoSel(e.target.value)}>
            <option value="">Mover a...</option>
            {dias.filter((d) => d.tipo === "rodaje").slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).map((d) => { const p = String(d.fecha).split("-"); const fx = p.length === 3 ? `${p[2]}/${p[1]}` : d.fecha; const u = d.camara_caliente ? " [CC]" : d.doble_unidad ? " [DU]" : ""; return <option key={d.id} value={d.id}>{fx} · {d.territorio || "-"}{u}</option>; })}
            <option value="FUERA">Fuera de plan</option>
          </select>
          <button className="btn" disabled={!destinoSel || busy} onClick={() => moverSeleccion(destinoSel)}>Mover</button>
          <button className="btn ghost" onClick={limpiarSel}>Quitar seleccion</button>
        </div>
      )}

      {dias.length > 0 && (
        <div className="fuera-zona"
          onDragOver={canEdit ? (ev) => ev.preventDefault() : undefined}
          onDrop={canEdit ? (ev) => { ev.preventDefault(); if (dragRef.current) { if (dragRef.current.grupo) moverSeleccion("FUERA"); else mandarFuera(dragRef.current.escenaId, dragRef.current.from); dragRef.current = null; } } : undefined}>
          <div className="fuera-tit">Fuera de plan <span className="fuera-n">{fuera.length}</span></div>
          <div className="fuera-list">
            {fuera.length === 0 && <span className="muted small">Arrastra aqui las secuencias que quieras aparcar mientras decides su dia.</span>}
            {fuera.map((f) => { const e = escById[f.escena_id]; if (!e) return null;
              const nums = (e.desglose_items || []).filter((i) => i.categoria === "personajes")
                .map((i) => persNum[String(i.elemento || "").trim().toUpperCase()]).filter((v) => v != null).sort((a, b) => a - b);
              const espLbl = e.espacio === "plato" ? "Plato" : e.espacio === "exteriores" ? "Ext." : e.espacio === "ext_noche" ? "Ext.Noche" : "";
              return <div key={f.escena_id} id={"fue-" + e.id} className={`fuera-card ${stripColor(e.int_ext, e.tiempo)} ${sel.has(f.escena_id) ? "sel-on" : ""} ${resaltada === e.id ? "strip-found" : ""}`}
                draggable={canEdit} onDragStart={canEdit ? () => { dragRef.current = { escenaId: e.id, from: "FUERA", grupo: sel.has(e.id) && sel.size > 1 }; } : undefined}
                title={(e.uid || "") + " " + (e.localizacion || e.header || "") + (e.sinopsis ? " - " + e.sinopsis : "") + " (doble clic: desglose)"}
                onDoubleClick={() => irASecuencia && irASecuencia(e.uid, "plan")}>
                <div className="fc-l1">{canEdit && <input type="checkbox" className="sel-chk" checked={sel.has(f.escena_id)} onChange={() => toggleSel(f.escena_id)} onClick={(ev) => ev.stopPropagation()} />}<b>{e.uid}</b><span className="fc-fx">{[e.int_ext, e.tiempo].filter(Boolean).join(" · ")}</span></div>
                <div className="fc-loc">{e.localizacion || e.header}{e.decorado && <span className="fc-deco"> / {e.decorado}</span>}</div>
                <div className="fc-meta">{e.territorio || "-"}{espLbl && <> · {espLbl}</>}</div>
                {nums.length > 0 && <div className="fc-pers">{nums.map((num, i) => { const col = numColor[num];
                  return <span key={i} className={`pnum ${persMenor.has(num) ? "pers-menor" : ""}`} style={col ? { background: col, color: colorTexto(col) } : undefined}>{num}</span>; })}</div>}
              </div>; })}
          </div>
        </div>
      )}

      {dias.length > 0 && (
        <div className="legend">
          <span className="strip strip-intd">INT dia</span>
          <span className="strip strip-extd">EXT dia</span>
          <span className="strip strip-intn">INT noche</span>
          <span className="strip strip-extn">EXT noche</span>
          <span className="strip strip-mix">INT/EXT</span>
        </div>
      )}

      {dias.length === 0 ? <p className="muted" style={{ marginTop: 16 }}>Anade bloques y pulsa "Generar calendario".</p>
        : <div className="cal-scroll"><div className="cal">
            <div className="cal-dow">{["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => <div key={d}>{d}</div>)}</div>
            {weeks.map((w, wi) => <div key={wi} className="cal-week">{w.map((cell, ci) => <Celda key={ci} cell={cell} semana={ci === 0 ? (weekNo[wi] || null) : null} dayNo={dayNo} escById={escById} escByUid={escByUid} persNum={persNum} persMenor={persMenor} numColor={numColor} racordColor={racordColor} irASecuencia={irASecuencia} topePlato={topePlato} topeExt={topeExt} canEdit={canEdit} dragRef={dragRef} onDrop={moverEscena} onReordenar={reordenarEnDia} sel={sel} onToggleSel={toggleSel} onMoverGrupo={moverSeleccion} onMandarFuera={mandarFuera} resaltada={resaltada} onSetTipo={setTipoDia} onSetEspacio={setEspacioDia} onSetEspacio2={setEspacio2Dia} onSetFlag={setFlag} onLink={linkarPendiente} onMoverUnidad={moverEscenaUnidad} onActivar={activarDia} />)}</div>)}
          </div></div>}
    </div>
  );
}

const TIPOS_DIA = [["rodaje", "Rodaje"], ["viaje", "Viaje"], ["festivo", "Festivo"], ["preproduccion", "Preprod."], ["descanso", "Descanso"]];
const ESPACIOS = [["", "- espacio -"], ["plato", "Plato"], ["exteriores", "Exteriores"], ["ext_noche", "Ext. Noche"]];
const ESP_LBL = { plato: "PLATO", exteriores: "EXTERIORES", ext_noche: "EXT. NOCHE" };

function Celda({ cell, semana, dayNo, escById, escByUid, persNum, persMenor, numColor, racordColor, irASecuencia, topePlato, topeExt, canEdit, dragRef, onDrop, onReordenar, sel, onToggleSel, onMoverGrupo, onMandarFuera, resaltada, onSetTipo, onSetEspacio, onSetEspacio2, onSetFlag, onLink, onMoverUnidad, onActivar }) {
  const [over, setOver] = useState(false);
  const semBadge = semana ? <div className="semana-badge">SEMANA {semana}</div> : null;
  const [linkId, setLinkId] = useState(null);
  const [linkVal, setLinkVal] = useState("");
  function doLink(pp) {
    const v = linkVal.trim(); setLinkId(null); setLinkVal("");
    if (!v) return;
    const e = (escByUid || {})[v.replace(/[.\s]/g, "").toUpperCase()];
    if (e) onLink(pp, e.id);
  }
  const d = cell.dia;
  if (!d) return (
    <div className="cal-cell empty">
      {semBadge}
      {canEdit && cell.iso && (
        <button className="activar-dia" title="Crear este dia" onClick={() => onActivar(cell.iso)}>
          + Activar dia<span className="activar-fecha">{cell.iso.slice(8)}/{cell.iso.slice(5, 7)}</span>
        </button>
      )}
    </div>
  );
  const rod = d.tipo === "rodaje";
  const factor = 1 + (d.doble_unidad ? 1 : 0) + (d.camara_caliente ? 1 : 0);
  const secs = (d.plan_dia_escenas || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const pend = (d.pendientes || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
  const load = secs.reduce((s, x) => s + Number(escById[x.escena_id]?.octavos || 0), 0);
  const u1 = secs.filter((x) => (x.unidad || 1) === 1), u2 = secs.filter((x) => (x.unidad || 1) === 2);
  const p1 = pend.filter((x) => (x.unidad || 1) === 1), p2 = pend.filter((x) => (x.unidad || 1) === 2);
  const load1 = u1.reduce((s, x) => s + Number(escById[x.escena_id]?.octavos || 0), 0);
  const load2 = u2.reduce((s, x) => s + Number(escById[x.escena_id]?.octavos || 0), 0);
  const hay2 = u2.length > 0 || p2.length > 0 || d.doble_unidad || d.camara_caliente;
  const banner2 = d.camara_caliente ? "CAMARA CALIENTE" : "DOBLE UNIDAD";
  const tira = (x) => { const e = escById[x.escena_id]; if (!e) return null;
    const nums = (e.desglose_items || []).filter((i) => i.categoria === "personajes")
      .map((i) => persNum[String(i.elemento || "").trim().toUpperCase()]).filter((v) => v != null).sort((a, b) => a - b);
    const u = x.unidad || 1;
    const fx = [e.int_ext, e.tiempo].filter(Boolean).join(" · ");
    const loc = e.localizacion || e.header || "";
    const et = sinTilde((e.territorio || "").trim()), dt = sinTilde((d.territorio || "").trim());
    return <div key={x.escena_id} id={"str-" + e.id} className={`strip ${stripColor(e.int_ext, e.tiempo)} ${(et && dt && et !== dt) ? "strip-terr-bad" : ""} ${sel && sel.has(e.id) ? "sel-on" : ""} ${resaltada === e.id ? "strip-found" : ""}`}
      draggable={canEdit} onDragStart={canEdit ? () => { dragRef.current = { escenaId: e.id, from: d.id, grupo: sel && sel.has(e.id) && sel.size > 1 }; } : undefined}
      onDragOver={canEdit ? (ev) => { ev.preventDefault(); ev.stopPropagation(); } : undefined}
      onDrop={canEdit ? (ev) => { ev.preventDefault(); ev.stopPropagation(); const dr = dragRef.current; if (dr) { if (dr.grupo) onMoverGrupo(d.id); else if (dr.from === d.id) onReordenar(dr.escenaId, e.id, d.id); else onDrop(dr.escenaId, dr.from, d.id); dragRef.current = null; } } : undefined}
      onDoubleClick={() => irASecuencia && irASecuencia(e.uid, "plan")}
      onContextMenu={canEdit && onMandarFuera ? (ev) => { ev.preventDefault(); if (window.confirm(`Sacar ${e.uid} a fuera de plan?`)) onMandarFuera(e.id, d.id); } : undefined}
      title={(e.uid || "") + " " + loc + (e.decorado ? " / " + e.decorado : "") + (e.sinopsis ? " - " + e.sinopsis : "") + " (doble clic: desglose · clic derecho: fuera de plan)"}>
      {canEdit && onToggleSel && <input type="checkbox" className="sel-chk" checked={sel ? sel.has(e.id) : false} onChange={() => onToggleSel(e.id)} onClick={(ev) => ev.stopPropagation()} />}
      <div className="strip-l1">
        <b className="strip-uid">{e.uid}</b>
        <span className="strip-fx">{fx}</span>
        <span className="strip-pg">{fmtEighths(e.octavos)} pg</span>
        {e.territorio && <span className="strip-terr">{e.territorio}</span>}
        {e.racord && <span className="strip-racord" style={(racordColor && racordColor[e.racord]) ? { background: racordColor[e.racord], color: colorTexto(racordColor[e.racord]) } : undefined}>{e.racord}</span>}
        {hay2 && canEdit && <button className="u-toggle" title="Cambiar de unidad"
          onClick={(ev) => { ev.stopPropagation(); onMoverUnidad(e.id, d.id, d.id, u === 1 ? 2 : 1); }}>{u === 1 ? "▾2ª" : "▴1ª"}</button>}
      </div>
      {loc && <div className="strip-loc">{loc}{e.decorado && <span className="strip-deco"> / {e.decorado}</span>}</div>}
      {e.sinopsis && <div className="strip-sin">{e.sinopsis}</div>}
      {nums.length > 0 && <div className="strip-pers-row">{nums.map((num, i) => (
        <span key={i} className={`pnum ${(persMenor && persMenor.has(num)) ? "pers-menor" : ""}`} style={(numColor && numColor[num]) ? { background: numColor[num], color: colorTexto(numColor[num]) } : undefined}>{num}</span>
      ))}</div>}
    </div>; };
  const tiraPend = (pp) => linkId === pp.id
    ? <div key={pp.id} className="strip strip-pend linking">
        <input autoFocus list="esc-list-link" className="link-input" placeholder={pp.etiqueta + " -> nº"} value={linkVal}
          onChange={(ev) => setLinkVal(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === "Enter") doLink(pp); if (ev.key === "Escape") { setLinkId(null); setLinkVal(""); } }}
          onBlur={() => doLink(pp)} />
      </div>
    : <div key={pp.id} className={`strip strip-pend ${canEdit ? "clic" : ""}`} title="Pulsa para linkar con una secuencia"
        onClick={canEdit ? () => { setLinkId(pp.id); setLinkVal(""); } : undefined}>{pp.etiqueta}</div>;
  const espSel = (val, fn) => <select className={`esp-sel mini ${val ? "esp-" + val : ""}`} value={val || ""} onChange={(e) => fn(d.id, e.target.value)}>{ESPACIOS.filter(([k]) => k !== "ext_noche").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
  const espBadge = (val) => val ? <div className={`esp-badge esp-${val}`}>{ESP_LBL[val]}</div> : null;
  return (
    <div className={`cal-cell ${rod ? "" : "rest"} tipo-${d.tipo} ${over ? "over" : ""}`}
      onDragOver={canEdit ? (ev) => { ev.preventDefault(); setOver(true); } : undefined}
      onDragLeave={() => setOver(false)}
      onDrop={canEdit ? (ev) => { ev.preventDefault(); setOver(false); const dr = dragRef.current; if (dr) { if (dr.grupo) onMoverGrupo(d.id); else onDrop(dr.escenaId, dr.from, d.id); dragRef.current = null; } } : undefined}>
      {semBadge}
      <div className="cal-cell-head">
        <span className="cal-dayno">{dayNo[d.fecha] ? `Dia ${dayNo[d.fecha]}` : ""}</span>
        <span className="cal-date">{d.fecha.slice(8)}/{d.fecha.slice(5, 7)}</span>
      </div>
      {canEdit
        ? <select className="tipo-sel" value={d.tipo} onChange={(e) => onSetTipo(d.id, e.target.value)}>
            {TIPOS_DIA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        : null}
      {rod && !hay2 && canEdit && (
        <select className={`esp-sel ${d.espacio ? "esp-" + d.espacio : ""}`} value={d.espacio || ""} onChange={(e) => onSetEspacio(d.id, e.target.value)}>
          {ESPACIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      )}
      {rod && !hay2 && !canEdit && d.espacio && <div className={`esp-badge esp-${d.espacio}`}>{ESP_LBL[d.espacio]}</div>}
      {rod ? (() => { const tope = (d.espacio === "exteriores" || d.espacio === "ext_noche") ? topeExt : topePlato; const topeTot = tope * factor; const excede = load > topeTot + 8; return <div className={`cal-terr ${excede ? "cal-terr-over" : ""}`}>{d.territorio || "-"} - {fmtEighths(load)} pg{factor > 1 ? ` x${factor}` : ""}</div>; })() : (!canEdit ? <div className="cal-terr rest-lbl">{d.tipo}</div> : null)}
      {rod && canEdit && (
        <div className="du-cc">
          <label title="Doble unidad"><input type="checkbox" checked={!!d.doble_unidad} onChange={(e) => onSetFlag(d.id, "doble_unidad", e.target.checked)} />2Ud</label>
          <label title="Camara caliente"><input type="checkbox" checked={!!d.camara_caliente} onChange={(e) => onSetFlag(d.id, "camara_caliente", e.target.checked)} />CC</label>
        </div>
      )}
      <div className="cal-strips">
        {hay2 ? (<>
          <div className="unidad-grupo"
            onDragEnter={canEdit ? (ev) => ev.preventDefault() : undefined}
            onDragOver={canEdit ? (ev) => { ev.preventDefault(); ev.stopPropagation(); } : undefined}
            onDrop={canEdit ? (ev) => { ev.preventDefault(); ev.stopPropagation(); if (dragRef.current) { onMoverUnidad(dragRef.current.escenaId, dragRef.current.from, d.id, 1); dragRef.current = null; } } : undefined}>
            <div className="unidad-banner principal">UNIDAD PRINCIPAL · {fmtEighths(load1)} pg</div>
            {canEdit ? espSel(d.espacio, onSetEspacio) : espBadge(d.espacio)}
            {u1.map(tira)}
            {p1.map(tiraPend)}
          </div>
          <div className="unidad-grupo"
            onDragEnter={canEdit ? (ev) => ev.preventDefault() : undefined}
            onDragOver={canEdit ? (ev) => { ev.preventDefault(); ev.stopPropagation(); } : undefined}
            onDrop={canEdit ? (ev) => { ev.preventDefault(); ev.stopPropagation(); if (dragRef.current) { onMoverUnidad(dragRef.current.escenaId, dragRef.current.from, d.id, 2); dragRef.current = null; } } : undefined}>
            <div className={`unidad-banner ${d.camara_caliente ? "cc" : "du"}`}>{banner2} · {fmtEighths(load2)} pg</div>
            {canEdit ? espSel(d.espacio2, onSetEspacio2) : espBadge(d.espacio2)}
            {u2.map(tira)}
            {p2.map(tiraPend)}
          </div>
        </>) : (<>
          {u1.map(tira)}
          {p1.map(tiraPend)}
          {u2.map(tira)}
          {p2.map(tiraPend)}
        </>)}
      </div>
    </div>
  );
}


const ROLES = [["viewer", "Viewer (solo ve)"], ["editor", "Editor (puede editar)"], ["admin", "Admin (todo)"]];

function Usuarios() {
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState(null);
  const [nu, setNu] = useState({ usuario: "", password: "", nombre: "", rol: "editor" });
  const [creando, setCreando] = useState(false);
  const [msg, setMsg] = useState(null);

  async function cargar() {
    const { data, error } = await supabase.from("profiles").select("id, email, nombre, rol").order("email");
    if (error) setErr(error.message); else setUsers(data);
  }
  useEffect(() => { cargar(); }, []);

  async function setRol(id, rol) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, rol } : u)));
    const { error } = await supabase.from("profiles").update({ rol }).eq("id", id);
    if (error) setErr(error.message);
  }
  async function setNombre(id, nombre) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, nombre } : u)));
    const { error } = await supabase.from("profiles").update({ nombre }).eq("id", id);
    if (error) setErr(error.message);
  }

  async function crearUsuario() {
    if (!nu.usuario.trim() || !nu.password.trim()) { setMsg({ ok: false, text: "Pon usuario y contrasena." }); return; }
    if (nu.password.length < 6) { setMsg({ ok: false, text: "La contrasena debe tener al menos 6 caracteres." }); return; }
    setCreando(true); setMsg(null);
    const email = normalizarEmail(nu.usuario);
    const { data, error } = await supabase.functions.invoke(CREAR_USER_FUNC, { body: { email, password: nu.password, nombre: nu.nombre, rol: nu.rol } });
    if (error) setMsg({ ok: false, text: error.message });
    else if (data?.error) setMsg({ ok: false, text: data.error });
    else { setMsg({ ok: true, text: `Usuario ${email} creado como ${nu.rol}.` }); setNu({ usuario: "", password: "", nombre: "", rol: "editor" }); cargar(); }
    setCreando(false);
  }

  return (
    <div className="container">
      <div className="section-head"><h2>Usuarios</h2></div>

      <div className="card-lite nuevo-user">
        <h3>Crear usuario</h3>
        <div className="nu-grid">
          <label>Usuario
            <div className="email-field">
              <input type="text" value={nu.usuario} onChange={(e) => setNu({ ...nu, usuario: e.target.value })} placeholder="ej. jrp" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              {!nu.usuario.includes("@") && <span className="email-suffix">@{DOMINIO}</span>}
            </div>
          </label>
          <label>Nombre
            <input type="text" value={nu.nombre} onChange={(e) => setNu({ ...nu, nombre: e.target.value })} placeholder="Nombre y apellidos" />
          </label>
          <label>Contrasena
            <input type="text" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} placeholder="min. 6 caracteres" />
          </label>
          <label>Rol
            <select value={nu.rol} onChange={(e) => setNu({ ...nu, rol: e.target.value })}>
              {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
        <button className="primary inline" onClick={crearUsuario} disabled={creando}>{creando ? "Creando..." : "Crear usuario"}</button>
        {msg && <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      </div>

      <p className="muted small">O cambia el rol de alguien ya existente:</p>
      {err && <div className="msg err">{err}</div>}
      {users === null ? <p className="muted">Cargando...</p>
        : users.length === 0 ? <p className="muted">No hay usuarios.</p>
        : <div className="cast" style={{ marginTop: 12 }}>
            <div className="users-head"><span>Email</span><span>Nombre</span><span>Rol</span></div>
            {users.map((u) => (
              <div key={u.id} className="users-row">
                <span className="cast-name">{u.email}</span>
                <input className="user-nombre-in" defaultValue={u.nombre || ""} placeholder="Nombre" key={"un" + u.id} onBlur={(e) => setNombre(u.id, e.target.value)} />
                <span>
                  <select className="rol-sel" value={u.rol} onChange={(e) => setRol(u.id, e.target.value)}>
                    {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </span>
              </div>
            ))}
          </div>}
    </div>
  );
}


function descargarCSV(nombre, filas) {
  const csv = filas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = nombre; a.click();
  URL.revokeObjectURL(url);
}

function exportInformeExcel(titulo, proyNombre, cols, rows, totales) {
  const fecha = new Date().toLocaleDateString("es-ES");
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">`;
  html += `<tr><td colspan="${cols.length}" style="font-weight:bold;font-size:14px">${esc(proyNombre)} — ${esc(titulo)}</td></tr>`;
  html += `<tr><td colspan="${cols.length}">${fecha}</td></tr><tr></tr>`;
  html += "<tr>" + cols.map((c) => `<th style="background:#dfe3f7;font-weight:bold">${esc(c)}</th>`).join("") + "</tr>";
  if (totales) html += "<tr>" + totales.map((t) => `<td style="font-weight:bold;background:#eef2ff">${esc(t)}</td>`).join("") + "</tr>";
  rows.forEach((r) => { html += "<tr>" + r.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>"; });
  html += "</table></body></html>";
  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${titulo.replace(/[^a-zA-Z0-9]+/g, "_")}.xls`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportInformePDF(titulo, proyNombre, cols, rows, totales) {
  const fecha = new Date().toLocaleDateString("es-ES");
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
  let html = `<html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
    *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
    h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
    table{border-collapse:collapse;width:100%;font-size:11px;table-layout:auto}
    th,td{border:1px solid #cbd5e1;padding:5px 8px;text-align:left;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    th{background:#eef2ff;color:#1e293b} tr.tot td{font-weight:bold;background:#f8fafc}
    @media print{@page{margin:14mm}}
  </style></head><body>`;
  html += `<h1>${esc(proyNombre)} — ${esc(titulo)}</h1><div class="fecha">${fecha}</div>`;
  html += "<table><thead><tr>" + cols.map((c) => `<th>${esc(c)}</th>`).join("") + "</tr>";
  if (totales) html += `<tr class="tot">` + totales.map((t) => `<td>${esc(t)}</td>`).join("") + "</tr>";
  html += "</thead><tbody>";
  rows.forEach((r) => { html += "<tr>" + r.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>"; });
  html += "</tbody></table></body></html>";
  w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

function PersPorTerritorio({ persRows, terrRodaje, diasRodPorTerr, totalDiasRod, proyNombre, colorTerr, colorTexto }) {
  const [selTerr, setSelTerr] = useState(new Set());
  const [modo, setModo] = useState("exacto"); // exacto | incluye
  const [vista, setVista] = useState("terr");  // terr | tabla
  const [cob, setCob] = useState(0);           // 0 = sin filtro; N = en N territorios
  function toggle(t) { setSelTerr((prev) => { const n = new Set(prev); n.has(t) ? n.delete(t) : n.add(t); return n; }); }

  const terrsDe = (x) => terrRodaje.filter((t) => (x.secsTerr?.[t] || 0) > 0 || (x.diasTerr?.[t]?.size || 0) > 0);
  const nTerr = terrRodaje.length;

  // ── cobertura: cuantos personajes aparecen en 1, 2, ... N territorios ──
  const porCobertura = {};
  persRows.forEach((x) => { const n = terrsDe(x).length; if (n > 0) porCobertura[n] = (porCobertura[n] || 0) + 1; });
  const conTerr = persRows.filter((x) => terrsDe(x).length > 0).length;

  let filtradas = persRows;
  if (cob > 0) filtradas = filtradas.filter((x) => terrsDe(x).length === cob);
  if (selTerr.size) {
    filtradas = filtradas.filter((x) => {
      const suyos = new Set(terrsDe(x));
      if (modo === "exacto") return suyos.size === selTerr.size && [...selTerr].every((t) => suyos.has(t));
      return [...selTerr].every((t) => suyos.has(t));
    });
  }

  const cols = ["No", "Nombre", "Nacion", "Menor", "Territorios", ...terrRodaje.flatMap((t) => [`Dias ${t}`, `Secs ${t}`]), "Total dias"];
  const totales = ["", "", "", "", "", ...terrRodaje.flatMap((t) => [diasRodPorTerr[t] || 0, ""]), totalDiasRod];
  const aligns = ["left", "left", "left", "center", "right", ...terrRodaje.flatMap(() => ["right", "right"]), "right"];
  const fila = (x) => [x.num, x.nombre, x.nacionalidad || "-", x.menor ? "Si" : "", terrsDe(x).length, ...terrRodaje.flatMap((t) => [x.diasTerr?.[t]?.size || 0, x.secsTerr?.[t] || 0]), x.dias];

  // ── vista por territorio ──
  const ordPers = (a, b) => {
    if (a.num == null && b.num == null) return String(a.nombre).localeCompare(String(b.nombre));
    if (a.num == null) return 1; if (b.num == null) return -1; return a.num - b.num;
  };
  const grupos = terrRodaje.map((t, i) => {
    const dentro = filtradas.filter((x) => (x.secsTerr?.[t] || 0) > 0 || (x.diasTerr?.[t]?.size || 0) > 0);
    const clas = { solo: [], varios: [], todos: [] };
    dentro.forEach((x) => {
      const n = terrsDe(x).length;
      (n === 1 ? clas.solo : n === nTerr && nTerr > 1 ? clas.todos : clas.varios).push(x);
    });
    Object.values(clas).forEach((arr) => arr.sort(ordPers));
    return {
      terr: t, i, dentro, clas,
      dias: diasRodPorTerr[t] || 0,
      secs: dentro.reduce((a, x) => a + (x.secsTerr?.[t] || 0), 0),
      menores: dentro.filter((x) => x.menor).length,
    };
  });

  const chip = (x, t, extra) => (
    <span key={x.nombre} className={`ptx-per ${extra} ${x.menor ? "men" : ""}`}>
      <i>{x.num == null ? "—" : x.num}</i>{x.nombre}
      <span className="d">{x.diasTerr?.[t]?.size || 0} d · {x.secsTerr?.[t] || 0} secs</span>
    </span>
  );

  // ── exportaciones de la vista por territorio ──
  const COLS_T = ["Territorio", "Grupo", "No", "Personaje", "Nacion", "Menor", "Territorios", "Dias en el territorio", "Secs en el territorio", "Total dias"];
  const GRP_LBL = { solo: "Solo en este territorio", varios: "Tambien en otro territorio", todos: "En todos los territorios" };
  const filasTerr = () => {
    const f = [];
    grupos.forEach((g) => {
      ["solo", "varios", "todos"].forEach((k) => g.clas[k].forEach((x) => f.push([
        g.terr, GRP_LBL[k], x.num ?? "-", x.nombre, x.nacionalidad || "-", x.menor ? "Si" : "",
        terrsDe(x).length, x.diasTerr?.[g.terr]?.size || 0, x.secsTerr?.[g.terr] || 0, x.dias,
      ])));
      f.push([g.terr + " - TOTAL", `${g.dentro.length} personajes`, "", `${g.clas.solo.length} exclusivos`, "", `${g.menores} menores`, "", g.dias, g.secs, ""]);
    });
    return f;
  };
  function exportTerrPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>Personajes por territorio</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;box-sizing:border-box;
        font-variant-ligatures:none;font-feature-settings:"liga" 0;font-synthesis:none}
      body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:400;padding:20px;color:#111;text-rendering:geometricPrecision}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:14px}
      .cob{border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:11px;display:flex;gap:18px;flex-wrap:wrap}
      .cob b{color:#0f172a}
      .rc{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:12px;overflow:hidden;page-break-inside:avoid}
      .rc-h{padding:8px 12px;color:#fff;font-weight:bold;font-size:13px;display:flex;justify-content:space-between;gap:10px}
      .rc-b{padding:8px 12px 10px}
      .g{font-size:9px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding:7px 0 4px;margin-bottom:5px;display:flex;justify-content:space-between}
      .p{display:inline-block;border:1px solid #e2e8f0;border-radius:5px;padding:2px 7px;font-size:10px;margin:0 4px 4px 0}
      .p.excl{border-color:#fdba74;background:#fff7ed}
      .p.todos{border-color:#c4b5fd;background:#f5f3ff}
      .p .n{font-weight:bold;color:#0f172a}
      .p .men{color:#dc2626;font-weight:bold}
      .p .d{color:#94a3b8}
      .sub{margin-top:8px;padding-top:6px;border-top:2px solid #e2e8f0;font-size:10px;color:#475569}
      .sub b{color:#0f172a}
      @media print{@page{size:A4 portrait;margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} - Personajes por territorio</h1><div class="fecha">${fecha} &middot; BD Prod Tools</div>`;
    html += `<div class="cob"><span><b>Cobertura:</b></span>` +
      Object.keys(porCobertura).map(Number).sort((a, b) => b - a).map((n) => `<span><b>${porCobertura[n]}</b> ${n === nTerr && nTerr > 1 ? `en los ${n}` : n === 1 ? "solo en 1" : `en ${n}`}</span>`).join("") +
      `<span><b>${conTerr}</b> personajes en total</span></div>`;
    grupos.forEach((g) => {
      const col = colorTerr ? colorTerr(g.terr, g.i) : "#334155";
      html += `<div class="rc"><div class="rc-h" style="background:${col}"><span>${esc(g.terr)} &mdash; ${g.dentro.length} personajes</span><span>${g.dias} dias &middot; ${g.secs} secuencias</span></div><div class="rc-b">`;
      ["solo", "varios", "todos"].forEach((k) => {
        if (!g.clas[k].length) return;
        html += `<div class="g"><span>${GRP_LBL[k]}</span><span>${g.clas[k].length} personajes</span></div>`;
        html += g.clas[k].map((x) => `<span class="p ${k === "solo" ? "excl" : k === "todos" ? "todos" : ""}"><span class="n${x.menor ? " men" : ""}">${x.num != null ? x.num + " " : ""}${esc(x.nombre)}</span> <span class="d">${x.diasTerr?.[g.terr]?.size || 0} d &middot; ${x.secsTerr?.[g.terr] || 0} secs</span></span>`).join("");
      });
      html += `<div class="sub"><b>${esc(g.terr)}</b> &mdash; <b>${g.dentro.length}</b> personajes &middot; <b>${g.clas.solo.length}</b> exclusivos &middot; <b>${g.dias}</b> dias de rodaje &middot; <b>${g.menores}</b> menores</div>`;
      html += `</div></div>`;
    });
    html += `</body></html>`;
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  const cobBtn = (n, lbl, cls) => (
    <button key={n} className={`ptx-cob ${cls || ""} ${cob === n ? "on" : ""}`} onClick={() => setCob(cob === n ? 0 : n)}>
      <span className="n">{n === 0 ? conTerr : (porCobertura[n] || 0)}</span>
      <span className="l">{lbl}</span>
    </button>
  );

  return (
    <div>
      <style>{`
        .ptx-bar{ display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
        .ptx-seg{ display:inline-flex; border:1px solid #d4d4d8; border-radius:8px; overflow:hidden; }
        .ptx-seg button{ padding:6px 13px; font-size:12px; font-weight:600; background:#fff; border:0; border-right:1px solid #e4e4e7; cursor:pointer; color:#52525b; font-family:inherit; }
        .ptx-seg button:last-child{ border-right:0; }
        .ptx-seg button.on{ background:#0f766e; color:#fff; }
        .ptx-cobbox{ background:#fff; border:1px solid #e4e4e7; border-radius:10px; padding:10px 12px; margin-bottom:12px; }
        .ptx-cobt{ font-size:10px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:#52525b; margin-bottom:8px; }
        .ptx-cobrow{ display:flex; gap:7px; flex-wrap:wrap; }
        .ptx-cob{ border:1px solid #d4d4d8; background:#fff; border-radius:9px; padding:7px 12px; cursor:pointer; font-family:inherit;
          display:flex; flex-direction:column; gap:2px; min-width:104px; text-align:left; }
        .ptx-cob .n{ font-size:17px; font-weight:700; color:#0f172a; line-height:1; }
        .ptx-cob .l{ font-size:10px; color:#71717a; text-transform:uppercase; letter-spacing:.04em; }
        .ptx-cob.on{ border-color:#0f766e; background:#f0fdfa; }
        .ptx-cob.on .n{ color:#0f766e; }
        .ptx-cob.todos.on{ border-color:#7c3aed; background:#f5f3ff; } .ptx-cob.todos.on .n{ color:#7c3aed; }
        .ptx-cob.uno.on{ border-color:#ea580c; background:#fff7ed; } .ptx-cob.uno.on .n{ color:#ea580c; }
        .ptx-barra{ display:flex; height:6px; border-radius:4px; overflow:hidden; margin-top:9px; background:#f4f4f5; }
        .ptx-grp{ margin-bottom:12px; }
        .ptx-grp:last-child{ margin-bottom:0; }
        .ptx-grpt{ font-size:10px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:#64748b;
          padding-bottom:5px; border-bottom:1px solid #e2e8f0; margin-bottom:7px; display:flex; gap:8px; align-items:baseline; }
        .ptx-grpt .n{ margin-left:auto; font-weight:400; letter-spacing:0; text-transform:none; font-size:11px; color:#94a3b8; }
        .ptx-per{ display:inline-flex; align-items:center; gap:5px; background:#fff; border:1px solid #e4e4e7; border-radius:6px;
          padding:3px 9px 3px 3px; font-size:11px; margin:0 4px 4px 0; }
        .ptx-per i{ font-style:normal; background:#1e293b; color:#fff; font-size:9px; font-weight:700; border-radius:3px; padding:2px 5px; min-width:18px; text-align:center; }
        .ptx-per.men i{ background:#dc2626; }
        .ptx-per .d{ color:#94a3b8; font-size:10px; }
        .ptx-per.excl{ border-color:#fdba74; background:#fff7ed; }
        .ptx-per.todos{ border-color:#c4b5fd; background:#f5f3ff; }
        .ptx-sub{ margin-top:10px; padding-top:8px; border-top:2px solid #e2e8f0; display:flex; gap:14px; font-size:11px; color:#475569; flex-wrap:wrap; }
        .ptx-sub b{ color:#0f172a; }
      `}</style>

      <div className="ptx-bar">
        <span className="muted small" style={{ fontWeight: 600 }}>Vista:</span>
        <div className="ptx-seg">
          <button className={vista === "terr" ? "on" : ""} onClick={() => setVista("terr")}>Por territorio</button>
          <button className={vista === "tabla" ? "on" : ""} onClick={() => setVista("tabla")}>Tabla</button>
        </div>
        <span className="muted small">{filtradas.length} de {persRows.length} personajes · {nTerr} territorios</span>
        {vista === "terr" && <>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={() => descargarCSV("personajes_por_territorio.csv", [COLS_T, ...filasTerr()])}>CSV</button>
          <button className="btn" onClick={() => exportInformeExcel("Personajes por territorio", proyNombre || "", COLS_T, filasTerr(), null)}>Excel</button>
          <button className="btn" onClick={exportTerrPDF}>PDF</button>
        </>}
      </div>

      {nTerr > 1 && (
        <div className="ptx-cobbox">
          <div className="ptx-cobt">Cobertura — en cuantos territorios aparece cada personaje</div>
          <div className="ptx-cobrow">
            {Array.from({ length: nTerr }, (_, k) => nTerr - k).map((n) =>
              cobBtn(n, n === nTerr ? `En los ${n}` : n === 1 ? "Solo en 1" : `En ${n}`, n === nTerr ? "todos" : n === 1 ? "uno" : ""))}
            {cobBtn(0, "Todos")}
          </div>
          <div className="ptx-barra">
            {Array.from({ length: nTerr }, (_, k) => nTerr - k).map((n) => {
              const v = porCobertura[n] || 0; if (!v || !conTerr) return null;
              const c = n === nTerr ? "#7c3aed" : n === 1 ? "#ea580c" : "#0f766e";
              return <span key={n} style={{ background: c, width: `${(v / conTerr) * 100}%` }} title={`${v} en ${n}`} />;
            })}
          </div>
        </div>
      )}

      <div className="pt-filtro">
        <span className="pt-filtro-lbl">Filtrar por territorio:</span>
        {terrRodaje.map((t) => (
          <label key={t} className={`pt-chip ${selTerr.has(t) ? "on" : ""}`}>
            <input type="checkbox" checked={selTerr.has(t)} onChange={() => toggle(t)} /> {t}
          </label>
        ))}
        {selTerr.size > 0 && <>
          <select className="pt-modo" value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="exacto">solo en esos (exacto)</option>
            <option value="incluye">que incluyan esos</option>
          </select>
          <button className="btn ghost mini" onClick={() => setSelTerr(new Set())}>Quitar filtro</button>
        </>}
      </div>

      {vista === "tabla" ? (
        <InformeTablaOrd titulo="Informe de personajes por territorio" proyNombre={proyNombre}
          cols={cols} totales={totales} aligns={aligns} rows={filtradas.map(fila)} rowClass={(r) => r[3] === "Si" ? "row-menor row-menor-pt" : ""} />
      ) : (
        <div className="fig-informe">
          {grupos.every((g) => g.dentro.length === 0) ? <p className="muted">Ningun personaje cumple el filtro.</p> : grupos.map((g) => {
            if (!g.dentro.length) return null;
            const col = colorTerr ? colorTerr(g.terr, g.i) : "#334155";
            return (
              <div key={g.terr} className="racord-card2">
                <div className="racord-head2" style={{ background: col, color: colorTexto ? colorTexto(col) : "#fff" }}>
                  <span className="racord-tit">{g.terr}</span>
                  <span className="racord-sub">{g.dentro.length} personajes · {g.dias} dias · {g.secs} secuencias</span>
                </div>
                <div className="racord-body">
                  {[["solo", "Solo en este territorio", "excl"], ["varios", "Tambien en otro territorio", ""], ["todos", "En todos los territorios", "todos"]].map(([k, lbl, cls]) => (
                    g.clas[k].length > 0 && (
                      <div key={k} className="ptx-grp">
                        <div className="ptx-grpt"><span>{lbl}</span><span className="n">{g.clas[k].length} personaje{g.clas[k].length === 1 ? "" : "s"}</span></div>
                        {g.clas[k].map((x) => chip(x, g.terr, cls))}
                      </div>
                    )
                  ))}
                  <div className="ptx-sub">
                    <span><b>{g.terr}</b></span>
                    <span><b>{g.dentro.length}</b> personajes</span>
                    <span><b>{g.clas.solo.length}</b> exclusivos</span>
                    <span><b>{g.dias}</b> dias de rodaje</span>
                    <span><b>{g.menores}</b> menores</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function RepartoPorCategoria({ persRows, proyNombre, totalSecs, totalDiasRod }) {
  const [filtro, setFiltro] = useState("");
  const pct = (n, tot) => tot > 0 ? `${n} / ${Math.round((n / tot) * 100)}%` : `${n}`;
  const conteo = {}; persRows.forEach((x) => { const c = x.categoria || "(sin categoria)"; conteo[c] = (conteo[c] || 0) + 1; });
  const filtradas = filtro === "__sin" ? persRows.filter((x) => !x.categoria) : (filtro ? persRows.filter((x) => (x.categoria || "") === filtro) : persRows);
  const cols = ["No", "Personaje", "Descripcion", "Categoria", "Edad", "Nacion", "Menor", "Secuencias", "Dias rodaje"];
  const totales = ["", "", "", "", "", "", "", totalSecs, totalDiasRod];
  const aligns = ["left", "left", "left", "left", "right", "left", "center", "right", "right"];
  const fila = (x) => [x.num, x.nombre, x.descripcion || "-", x.categoria || "-", x.edad || "-", x.nacionalidad || "-", x.menor ? "Si" : "", pct(x.secs, totalSecs), pct(x.dias, totalDiasRod)];
  return (
    <div>
      <div className="pt-filtro">
        <span className="pt-filtro-lbl">Categoria:</span>
        <button className={`pt-chip ${filtro === "" ? "on" : ""}`} onClick={() => setFiltro("")}>Todos ({persRows.length})</button>
        {CATEGORIAS.map((c) => <button key={c} className={`pt-chip ${filtro === c ? "on" : ""}`} onClick={() => setFiltro(c)}>{c} ({conteo[c] || 0})</button>)}
        {conteo["(sin categoria)"] > 0 && <button className={`pt-chip ${filtro === "__sin" ? "on" : ""}`} onClick={() => setFiltro(filtro === "__sin" ? "" : "__sin")}>Sin categoria ({conteo["(sin categoria)"]})</button>}
      </div>
      <InformeTablaOrd titulo={`Reparto por categoria${filtro && filtro !== "__sin" ? " - " + filtro : ""}`} proyNombre={proyNombre}
        cols={cols} totales={totales} aligns={aligns}
        rows={filtradas.map(fila)}
        rowClass={(r) => r[6] === "Si" ? "row-menor row-menor-rc" : ""} />
    </div>
  );
}

function InformeTablaOrd({ cols, rows, totales, titulo, proyNombre, aligns, rowClass }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(1);
  const clickCol = (j) => { if (sortCol === j) setSortDir((d) => -d); else { setSortCol(j); setSortDir(1); } };
  const ordenadas = sortCol == null ? rows : rows.slice().sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol];
    const na = typeof va === "number" ? va : parseFloat(String(va).replace(",", "."));
    const nb = typeof vb === "number" ? vb : parseFloat(String(vb).replace(",", "."));
    if (!isNaN(na) && !isNaN(nb)) return (na - nb) * sortDir;
    return String(va).localeCompare(String(vb), undefined, { numeric: true }) * sortDir;
  });
  const al = (j) => (aligns && aligns[j]) || (j === 0 ? "left" : "right");
  return (
    <div>
      <div className="rep-bar">
        <span className="muted small">{rows.length} filas · clic en cabecera para ordenar</span>
        <button className="btn" onClick={() => descargarCSV((titulo || "informe").toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".csv", [cols, ...ordenadas, ...(totales ? [totales] : [])])}>CSV</button>
        <button className="btn" onClick={() => exportInformeExcel(titulo || "Informe", proyNombre || "", cols, ordenadas, totales)}>Excel</button>
        <button className="btn" onClick={() => exportInformePDF(titulo || "Informe", proyNombre || "", cols, ordenadas, totales)}>PDF</button>
      </div>
      {rows.length === 0 ? <p className="muted">Sin datos. Necesitas desglosar y generar el plan.</p> :
        <div className="rep-table">
          <table>
            <thead><tr>{cols.map((c, j) => (
              <th key={j} className="th-sort" style={{ textAlign: al(j), cursor: "pointer" }} onClick={() => clickCol(j)}>
                {c}{sortCol === j ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                {totales && totales[j] != null && totales[j] !== "" && <div className="th-total">{totales[j]}</div>}
              </th>
            ))}</tr></thead>
            <tbody>{ordenadas.map((r, i) => <tr key={i} className={rowClass ? rowClass(r) : ""}>{r.map((c, j) => <td key={j} style={{ textAlign: al(j) }}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>}
    </div>
  );
}

function InformeTabla({ cols, rows, onCSV, totales, titulo, proyNombre }) {
  return (
    <div>
      <div className="rep-bar">
        <span className="muted small">{rows.length} filas</span>
        <button className="btn" onClick={onCSV}>CSV</button>
        <button className="btn" onClick={() => exportInformeExcel(titulo || "Informe", proyNombre || "", cols, rows, totales)}>Excel</button>
        <button className="btn" onClick={() => exportInformePDF(titulo || "Informe", proyNombre || "", cols, rows, totales)}>PDF</button>
      </div>
      {rows.length === 0 ? <p className="muted">Sin datos. Necesitas desglosar y/o generar el plan.</p> :
        <div className="rep-table">
          <table>
            <thead><tr>{cols.map((c, j) => <th key={c}>{c}{totales && totales[j] != null && totales[j] !== "" && <div className="th-total">{totales[j]}</div>}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 0 ? "" : "num"}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>}
    </div>
  );
}

function Informes({ proyectoId, proyNombre, irASecuencia }) {
  const [data, setData] = useState(null);
  const [sub, setSub] = useState("localizaciones");
  const [agrDeco, setAgrDeco] = useState("terr");
  const [err, setErr] = useState(null);

  async function cargar() {
    setErr(null);
    const { data: caps, error: e1 } = await supabase.from("capitulos")
      .select("numero, escenas(id, uid, orden, localizacion, decorado, territorio, espacio, racord, octavos, figuracion(tipo, cantidad, nota), desglose_items(categoria, elemento, pp_num))")
      .eq("proyecto_id", proyectoId);
    if (e1) { setErr(e1.message); return; }
    const escenas = []; (caps || []).forEach((c) => (c.escenas || []).forEach((e) => escenas.push({ ...e, capNum: c.numero })));
    const { data: dias } = await supabase.from("plan_dias").select("id, fecha, tipo, territorio, plan_dia_escenas(escena_id)").eq("proyecto_id", proyectoId);
    const { data: pers } = await supabase.from("personajes").select("nombre, numero, descripcion, edad, nacionalidad, menor, categoria, actor").eq("proyecto_id", proyectoId);
    const { data: rcs } = await supabase.from("racord_colores").select("racord, color").eq("proyecto_id", proyectoId);
    const racordColor = {}; (rcs || []).forEach((c) => { racordColor[c.racord] = c.color; });
    const { data: tcs } = await supabase.from("territorio_colores").select("territorio, color").eq("proyecto_id", proyectoId);
    const territorioColor = {}; (tcs || []).forEach((c) => { territorioColor[c.territorio] = c.color; });
    const { data: tfs } = await supabase.from("tarifas_figuracion").select("*").eq("proyecto_id", proyectoId);
    const tarifas = {}; (tfs || []).forEach((t) => { tarifas[t.territorio] = t; });
    const { data: proy } = await supabase.from("proyectos").select("caps_serie, fig_alzado").eq("id", proyectoId).single();
    setData({ escenas, dias: dias || [], pers: pers || [], racordColor, territorioColor, tarifas, proy: proy || {} });
  }
  useEffect(() => { cargar(); }, [proyectoId]);

  if (err) return <div className="msg err">{err}</div>;
  if (!data) return <p className="muted">Cargando...</p>;

  const { escenas, dias, pers, racordColor = {}, territorioColor = {}, tarifas = {}, proy = {} } = data;
  const escById = {}; escenas.forEach((e) => (escById[e.id] = e));
  const numByName = {}, descByName = {}, edadByName = {}, nacByName = {}, menorByName = {}, catByName = {}; pers.forEach((p) => { if (p.numero != null) numByName[p.nombre] = p.numero; descByName[p.nombre] = p.descripcion || ""; edadByName[p.nombre] = p.edad || ""; nacByName[p.nombre] = p.nacionalidad || ""; menorByName[p.nombre] = !!p.menor; catByName[p.nombre] = p.categoria || ""; });

  // Localizaciones
  const locMap = {};
  escenas.forEach((e) => { const l = (e.localizacion || "").trim(); if (!l) return; if (!locMap[l]) locMap[l] = { loc: l, secs: 0, oct: 0, dias: new Set(), diasTerr: {}, terrs: new Set(), esps: new Set() }; locMap[l].secs++; locMap[l].oct += Number(e.octavos || 0); if ((e.territorio || "").trim()) locMap[l].terrs.add((e.territorio || "").trim()); if ((e.espacio || "").trim()) locMap[l].esps.add(e.espacio); });
  dias.forEach((d) => { if (d.tipo !== "rodaje") return; const terr = (d.territorio || "").trim() || "(sin territorio)"; (d.plan_dia_escenas || []).forEach((x) => { const e = escById[x.escena_id]; const l = (e?.localizacion || "").trim(); if (l && locMap[l]) { locMap[l].dias.add(d.id); (locMap[l].diasTerr[terr] = locMap[l].diasTerr[terr] || new Set()).add(d.id); } }); });
  const ESP_LBL_INF = { plato: "Plato", exteriores: "Exteriores", ext_noche: "Ext. noche" };
  const locRows = Object.values(locMap).map((x) => ({
    ...x, dias: x.dias.size,
    terrTxt: Array.from(x.terrs).sort().join(" / ") || "-",
    espTxt: Array.from(x.esps).map((v) => ESP_LBL_INF[v] || v).sort().join(" / ") || "-",
  })).sort((a, b) => b.secs - a.secs);

  // Territorios
  const terrMap = {};
  escenas.forEach((e) => { const t = (e.territorio || "").trim(); if (!t) return; if (!terrMap[t]) terrMap[t] = { terr: t, secs: 0, oct: 0, dias: 0 }; terrMap[t].secs++; terrMap[t].oct += Number(e.octavos || 0); });
  dias.forEach((d) => { if (d.tipo !== "rodaje") return; const t = (d.territorio || "").trim(); if (t) { if (!terrMap[t]) terrMap[t] = { terr: t, secs: 0, oct: 0, dias: 0 }; terrMap[t].dias++; } });
  const totalSecs = escenas.length;
  const totalOct = escenas.reduce((s, e) => s + Number(e.octavos || 0), 0);
  const totalDiasRod = dias.filter((d) => d.tipo === "rodaje").length;
  const diasRodPorTerr = {}; dias.filter((d) => d.tipo === "rodaje").forEach((d) => { const t = (d.territorio || "").trim() || "(sin territorio)"; diasRodPorTerr[t] = (diasRodPorTerr[t] || 0) + 1; });
  const terrPrimeraFecha = {};
  dias.filter((d) => d.tipo === "rodaje" && (d.territorio || "").trim()).forEach((d) => {
    const t = (d.territorio || "").trim();
    if (!terrPrimeraFecha[t] || String(d.fecha) < terrPrimeraFecha[t]) terrPrimeraFecha[t] = String(d.fecha);
  });
  // v10.4: incluye tambien los territorios que solo aparecen en las secuencias
  // (antes solo salian los que tenian dias de rodaje en el plan y desaparecian
  // de "Pers. por territorio" y "Loc. por territorio").
  const terrRodaje = Object.keys(terrMap).sort((a, b) => {
    const fa = terrPrimeraFecha[a], fb = terrPrimeraFecha[b];
    if (fa && fb) return String(fa).localeCompare(String(fb)) || a.localeCompare(b);
    if (fa) return -1;
    if (fb) return 1;
    return a.localeCompare(b);
  });
  const terrOrden = (t) => { const i = terrRodaje.indexOf(t); return i < 0 ? 9999 : i; };
  const terrRows = Object.values(terrMap).sort((a, b) => (terrOrden(a.terr) - terrOrden(b.terr)) || a.terr.localeCompare(b.terr));

  // Informe de territorios enriquecido (tarjetas)
  const terrDataMap = {};
  escenas.forEach((e) => {
    const t = (e.territorio || "").trim(); if (!t) return;
    if (!terrDataMap[t]) terrDataMap[t] = { terr: t, secs: [], porCap: {}, oct: 0, pers: {}, locs: {} };
    const g = terrDataMap[t];
    if (e.uid) g.secs.push({ uid: e.uid, cap: e.capNum, orden: e.orden });
    g.porCap[e.capNum] = (g.porCap[e.capNum] || 0) + 1;
    g.oct += Number(e.octavos || 0);
    (e.desglose_items || []).forEach((it) => { if (it.categoria !== "personajes") return; const k = String(it.elemento || "").trim().toUpperCase(); if (k) g.pers[k] = true; });
    const loc = (e.localizacion || e.header || "").trim();
    if (loc) { if (!g.locs[loc]) g.locs[loc] = { secs: 0, oct: 0, decos: {} }; g.locs[loc].secs++; g.locs[loc].oct += Number(e.octavos || 0); const dec = (e.decorado || "").trim(); if (dec) g.locs[loc].decos[dec] = true; }
  });
  const terrDataList = Object.keys(terrDataMap).sort((a, b) => (terrOrden(a) - terrOrden(b)) || a.localeCompare(b)).map((t) => {
    const g = terrDataMap[t];
    const secs = g.secs.slice().sort((a, b) => (a.cap - b.cap) || ((a.orden || 0) - (b.orden || 0))).map((x) => x.uid);
    const porCapTxt = Object.keys(g.porCap).map(Number).sort((a, b) => a - b).map((c) => `c${c}: ${g.porCap[c]}`).join(" · ");
    const persArr = Object.keys(g.pers).map((nom) => ({ nom, num: numByName[nom] })).sort((a, b) => { const na = a.num == null ? 99999 : a.num, nb = b.num == null ? 99999 : b.num; return na - nb; });
    const locs = Object.keys(g.locs).sort().map((loc) => ({ loc, secs: g.locs[loc].secs, oct: g.locs[loc].oct, decos: Object.keys(g.locs[loc].decos).sort() }));
    return { terr: t, totalSecs: g.secs.length, oct: g.oct, dias: diasRodPorTerr[t] || 0, porCapTxt, secs, pers: persArr, locs };
  });
  const terrColorAuto = {}; terrDataList.forEach((g, i) => { terrColorAuto[g.terr] = territorioColor[g.terr] || PALETA[i % PALETA.length]; });
  const pctTxt = (n, tot) => tot > 0 ? `${n} / ${Math.round((n / tot) * 100)}%` : `${n}`;
  const pctPg = (oct, tot) => tot > 0 ? `${fmtEighths(oct)} / ${Math.round((oct / tot) * 100)}%` : fmtEighths(oct);

  // ── v11.1: informe de decorados ──
  const decoMap = {};
  escenas.forEach((e) => {
    const l = (e.localizacion || "").trim(); if (!l) return;
    const dc = (e.decorado || "").trim() || "(sin decorado)";
    const k = l + "||" + dc;
    if (!decoMap[k]) decoMap[k] = { loc: l, deco: dc, secs: 0, oct: 0, uids: [], dias: new Set(), diasTerr: {}, terrs: new Set(), esps: new Set(), ies: new Set(), caps: new Set(), pers: new Set() };
    const d = decoMap[k];
    d.secs++; d.oct += Number(e.octavos || 0); d.caps.add(e.capNum);
    if (e.uid) d.uids.push({ uid: e.uid, g: (e.capNum || 0) * 100000 + (e.orden || 0) });
    if ((e.territorio || "").trim()) d.terrs.add((e.territorio || "").trim());
    if ((e.espacio || "").trim()) d.esps.add(e.espacio);
    { const ie = normIE(e.int_ext); if (ie) d.ies.add(ie); }
    (e.desglose_items || []).forEach((i) => { if (i.categoria !== "personajes") return; const n = String(i.elemento || "").trim().toUpperCase(); if (n) d.pers.add(n); });
  });
  dias.forEach((dd) => {
    if (dd.tipo !== "rodaje") return;
    const terr = (dd.territorio || "").trim() || "(sin territorio)";
    (dd.plan_dia_escenas || []).forEach((x) => {
      const e = escById[x.escena_id]; if (!e) return;
      const l = (e.localizacion || "").trim(); if (!l) return;
      const k = l + "||" + ((e.decorado || "").trim() || "(sin decorado)");
      if (!decoMap[k]) return;
      decoMap[k].dias.add(dd.id);
      (decoMap[k].diasTerr[terr] = decoMap[k].diasTerr[terr] || new Set()).add(dd.id);
    });
  });
  const ieTxt = (set) => { const a = Array.from(set); const i = a.some((x) => x.includes("INT")), x = a.some((y) => y.includes("EXT")); return i && x ? "INT / EXT" : i ? "INT" : x ? "EXT" : "-"; };
  Object.values(decoMap).forEach((d) => {
    d.nDias = d.dias.size;
    d.terrTxt = Array.from(d.terrs).sort().join(" / ") || "-";
    d.espTxt = Array.from(d.esps).map((v) => ESP_LBL_INF[v] || v).sort().join(" / ") || "-";
    d.ieTxt = ieTxt(d.ies);
    d.uidsOrd = d.uids.slice().sort((a, b) => a.g - b.g).map((x) => x.uid);
  });
  const decoRows = Object.values(decoMap).sort((a, b) => b.oct - a.oct || b.secs - a.secs);
  // v11.5: al agrupar por territorio, cada decorado solo cuenta las secuencias DE ESE territorio
  const decoPorTerr = (() => {
    const m = {};
    escenas.forEach((e) => {
      const l = (e.localizacion || "").trim(); if (!l) return;
      const dc = (e.decorado || "").trim() || "(sin decorado)";
      const terr = (e.territorio || "").trim() || "(sin territorio)";
      const k = terr + "||" + l + "||" + dc;
      if (!m[k]) m[k] = { terr, loc: l, deco: dc, secs: 0, oct: 0, uids: [], dias: new Set(), terrs: new Set([terr]), esps: new Set(), ies: new Set(), caps: new Set(), pers: new Set() };
      const d = m[k];
      d.secs++; d.oct += Number(e.octavos || 0); d.caps.add(e.capNum);
      if (e.uid) d.uids.push({ uid: e.uid, g: (e.capNum || 0) * 100000 + (e.orden || 0) });
      if ((e.espacio || "").trim()) d.esps.add(e.espacio);
      { const ie = normIE(e.int_ext); if (ie) d.ies.add(ie); }
      (e.desglose_items || []).forEach((i) => { if (i.categoria !== "personajes") return; const n = String(i.elemento || "").trim().toUpperCase(); if (n) d.pers.add(n); });
    });
    dias.forEach((dd) => {
      if (dd.tipo !== "rodaje") return;
      (dd.plan_dia_escenas || []).forEach((x) => {
        const e = escById[x.escena_id]; if (!e) return;
        const l = (e.localizacion || "").trim(); if (!l) return;
        const k = ((e.territorio || "").trim() || "(sin territorio)") + "||" + l + "||" + ((e.decorado || "").trim() || "(sin decorado)");
        if (m[k]) m[k].dias.add(dd.id);
      });
    });
    Object.values(m).forEach((d) => {
      d.nDias = d.dias.size;
      d.terrTxt = d.terr;
      d.espTxt = Array.from(d.esps).map((v) => ESP_LBL_INF[v] || v).sort().join(" / ") || "-";
      d.ieTxt = ieTxt(d.ies);
      d.uidsOrd = d.uids.slice().sort((a, b) => a.g - b.g).map((x) => x.uid);
    });
    const porTerr = {};
    Object.values(m).forEach((d) => { (porTerr[d.terr] = porTerr[d.terr] || []).push(d); });
    return Object.keys(porTerr).sort((a, b) => (terrOrden(a) - terrOrden(b)) || a.localeCompare(b)).map((terr) => {
      const ds = porTerr[terr];
      const porLoc = {};
      ds.forEach((d) => { (porLoc[d.loc] = porLoc[d.loc] || []).push(d); });
      const locs = Object.keys(porLoc).sort((a, b) => porLoc[b].reduce((x, y) => x + y.oct, 0) - porLoc[a].reduce((x, y) => x + y.oct, 0))
        .map((loc) => { const dd = porLoc[loc].slice().sort((a, b) => b.oct - a.oct);
          return { loc, decos: dd, secs: dd.reduce((a, x) => a + x.secs, 0), oct: dd.reduce((a, x) => a + x.oct, 0) }; });
      const diasT = new Set(); ds.forEach((d) => d.dias.forEach((x) => diasT.add(x)));
      const persT = new Set(); ds.forEach((d) => d.pers.forEach((x) => persT.add(x)));
      return { grupo: terr, locs, nDecos: ds.length,
        secs: ds.reduce((a, d) => a + d.secs, 0), oct: ds.reduce((a, d) => a + d.oct, 0),
        dias: diasT.size, nPers: persT.size };
    });
  })();
  const decoPorLocGrp = (() => {
    const m = {};
    Object.values(decoMap).forEach((d) => { (m[d.loc] = m[d.loc] || []).push(d); });
    return Object.keys(m).sort((a, b) => m[b].reduce((x, y) => x + y.oct, 0) - m[a].reduce((x, y) => x + y.oct, 0)).map((loc) => {
      const ds = m[loc].slice().sort((a, b) => b.oct - a.oct);
      const diasL = new Set(); ds.forEach((d) => d.dias.forEach((x) => diasL.add(x)));
      const persL = new Set(); ds.forEach((d) => d.pers.forEach((x) => persL.add(x)));
      const terrs = Array.from(new Set([].concat(...ds.map((d) => Array.from(d.terrs)))));
      return { grupo: loc, locs: [{ loc, decos: ds, secs: ds.reduce((a, x) => a + x.secs, 0), oct: ds.reduce((a, x) => a + x.oct, 0) }],
        nDecos: ds.length, secs: ds.reduce((a, d) => a + d.secs, 0), oct: ds.reduce((a, d) => a + d.oct, 0),
        dias: diasL.size, nPers: persL.size, terrs };
    });
  })();
  function exportTerrCSV() {
    const filas = [["Territorio", "Secuencias", "%", "Paginas", "%", "Dias rodaje", "%", "Por capitulo", "Secuencias detalle", "Personajes", "Localizaciones (decorados)"]];
    terrDataList.forEach((g) => filas.push([g.terr, g.totalSecs, Math.round((g.totalSecs / totalSecs) * 100) + "%", fmtEighths(g.oct), Math.round((g.oct / totalOct) * 100) + "%", g.dias, totalDiasRod ? Math.round((g.dias / totalDiasRod) * 100) + "%" : "0%", g.porCapTxt, g.secs.join(", "), g.pers.map((p) => (p.num != null ? p.num + " " : "") + p.nom).join(", "), g.locs.map((l) => l.loc + (l.decos.length ? " [" + l.decos.join(", ") + "]" : "")).join(" | ")]));
    descargarCSV("informe_territorios.csv", filas);
  }
  function exportTerrExcel() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<div style="font-weight:bold;font-size:14px">${esc(proyNombre)} — Informe por territorio</div><div>${fecha}</div><br/>`;
    html += `<table border="1"><tr style="background:#dfe3f7"><th>Territorio</th><th>Secuencias</th><th>Paginas</th><th>Dias rodaje</th><th>Por capitulo</th><th>Secuencias</th><th>Personajes</th><th>Localizaciones (decorados)</th></tr>`;
    terrDataList.forEach((g) => { html += `<tr><td style="font-weight:bold">${esc(g.terr)}</td><td>${g.totalSecs} (${Math.round((g.totalSecs / totalSecs) * 100)}%)</td><td>${fmtEighths(g.oct)} (${Math.round((g.oct / totalOct) * 100)}%)</td><td>${g.dias} (${totalDiasRod ? Math.round((g.dias / totalDiasRod) * 100) : 0}%)</td><td>${esc(g.porCapTxt)}</td><td>${esc(g.secs.join(", "))}</td><td>${esc(g.pers.map((p) => (p.num != null ? p.num + " " : "") + p.nom).join(", "))}</td><td>${esc(g.locs.map((l) => l.loc + (l.decos.length ? " [" + l.decos.join(", ") + "]" : "")).join(" | "))}</td></tr>`; });
    html += "</table></body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "informe_territorios.xls"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportTerrPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>Informe territorios</title><style>
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{font-family:Arial,Helvetica,sans-serif;padding:22px;color:#111}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
      .rc{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
      .rc-h{padding:9px 12px;color:#fff;font-weight:bold;font-size:14px}
      .rc-h small{font-weight:normal;font-size:11px;opacity:.92}
      .rc-b{padding:10px 12px}
      .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#888;margin:10px 0 3px}
      .lbl:first-child{margin-top:0}
      .pers span{display:inline-block;background:#eef2ff;color:#3730a3;padding:1px 7px;border-radius:5px;font-size:11px;margin:2px 3px 2px 0}
      .loc{display:inline-block;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;margin:3px 5px 3px 0;font-size:12px;background:#fafafa}
      .loc b{display:block;margin-bottom:2px}
      .deco{background:#fff;border:1px solid #e2e8f0;color:#475569;padding:0 6px;border-radius:4px;font-size:10px;margin:1px 2px 0 0;display:inline-block}
      @media print{@page{margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} — Informe por territorio</h1><div class="fecha">${fecha}</div>`;
    terrDataList.forEach((g) => {
      const col = terrColorAuto[g.terr] || "#334155";
      html += `<div class="rc"><div class="rc-h" style="background:${col}">${esc(g.terr)} <small>&nbsp; ${g.totalSecs} sec (${Math.round((g.totalSecs / totalSecs) * 100)}%) · ${fmtEighths(g.oct)} pg (${Math.round((g.oct / totalOct) * 100)}%) · ${g.dias} dias rodaje (${totalDiasRod ? Math.round((g.dias / totalDiasRod) * 100) : 0}%)</small></div><div class="rc-b">`;
      html += `<div class="lbl">Personajes</div><div class="pers">${g.pers.map((p) => `<span>${p.num != null ? "<b>" + p.num + "</b> " : ""}${esc(p.nom)}</span>`).join("") || "-"}</div>`;
      html += `<div class="lbl">Secuencias (${esc(g.porCapTxt)})</div><div style="font-size:12px">${esc(g.secs.join(", ")) || "-"}</div>`;
      html += `<div class="lbl">Localizaciones</div><div>${g.locs.map((l) => `<div class="loc"><b>${esc(l.loc)} · ${l.secs} sec · ${fmtEighths(l.oct)} pg</b>${l.decos.map((d) => `<span class="deco">${esc(d)}</span>`).join("")}</div>`).join("") || "-"}</div>`;
      html += `</div></div>`;
    });
    html += "</body></html>";
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  // Personajes
  const persMap = {};
  escenas.forEach((e) => (e.desglose_items || []).forEach((it) => { if (it.categoria !== "personajes") return; const k = String(it.elemento || "").trim().toUpperCase(); if (!k) return; if (!persMap[k]) persMap[k] = { nombre: k, secs: 0, dias: new Set(), diasTerr: {}, secsTerr: {}, secsRacord: {} }; persMap[k].secs++; const rac = String(e.racord || "").trim(); if (rac) persMap[k].secsRacord[rac] = (persMap[k].secsRacord[rac] || 0) + 1; const te = (e.territorio || "").trim(); if (te) persMap[k].secsTerr[te] = (persMap[k].secsTerr[te] || 0) + 1; }));
  dias.forEach((d) => { if (d.tipo !== "rodaje") return; const terr = (d.territorio || "").trim() || "(sin territorio)"; (d.plan_dia_escenas || []).forEach((x) => { const e = escById[x.escena_id]; (e?.desglose_items || []).forEach((it) => { if (it.categoria !== "personajes") return; const k = String(it.elemento || "").trim().toUpperCase(); if (persMap[k]) { persMap[k].dias.add(d.id); (persMap[k].diasTerr[terr] = persMap[k].diasTerr[terr] || new Set()).add(d.id); } }); }); });
  const racordSecs = {}; escenas.forEach((e) => { const r = String(e.racord || "").trim(); if (r) racordSecs[r] = (racordSecs[r] || 0) + 1; });
  const racords = Object.keys(racordSecs).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

  // Informe por racord (secuencias por cap, personajes, localizaciones+decorados)
  const racordData = {};
  escenas.forEach((e) => {
    const r = String(e.racord || "").trim(); if (!r) return;
    if (!racordData[r]) racordData[r] = { racord: r, secs: [], porCap: {}, pers: {}, locs: {} };
    const g = racordData[r];
    if (e.uid) g.secs.push({ uid: e.uid, cap: e.capNum, orden: e.orden });
    g.porCap[e.capNum] = (g.porCap[e.capNum] || 0) + 1;
    (e.desglose_items || []).forEach((it) => { if (it.categoria !== "personajes") return; const k = String(it.elemento || "").trim().toUpperCase(); if (k) g.pers[k] = true; });
    const loc = (e.localizacion || e.header || "").trim(); if (loc) { if (!g.locs[loc]) g.locs[loc] = {}; const dec = (e.decorado || "").trim(); if (dec) g.locs[loc][dec] = true; }
  });
  const racordList = racords.map((r) => {
    const g = racordData[r]; if (!g) return { racord: r, secs: [], porCapTxt: "", pers: [], locs: [] };
    const secs = g.secs.slice().sort((a, b) => (a.cap - b.cap) || ((a.orden || 0) - (b.orden || 0))).map((x) => x.uid);
    const porCapTxt = Object.keys(g.porCap).map(Number).sort((a, b) => a - b).map((c) => `c${c}: ${g.porCap[c]}`).join(" · ");
    const pers = Object.keys(g.pers).map((nom) => ({ nom, num: numByName[nom] })).sort((a, b) => { const na = a.num == null ? 99999 : a.num, nb = b.num == null ? 99999 : b.num; return na - nb; });
    const locs = Object.keys(g.locs).sort().map((loc) => ({ loc, decos: Object.keys(g.locs[loc]).sort() }));
    return { racord: r, total: g.secs.length, secs, porCapTxt, pers, locs };
  });
  function exportRacordCSV() {
    const filas = [["Racord", "Total secuencias", "Por capitulo", "Secuencias", "Personajes", "Localizaciones (decorados)"]];
    racordList.forEach((g) => {
      filas.push([g.racord, g.total, g.porCapTxt, g.secs.join(" "), g.pers.map((p) => (p.num != null ? p.num + " " : "") + p.nom).join(", "), g.locs.map((l) => l.loc + (l.decos.length ? " [" + l.decos.join(", ") + "]" : "")).join(" | ")]);
    });
    descargarCSV("informe_racord.csv", filas);
  }
  function exportRacordExcel() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<div style="font-weight:bold;font-size:14px">${esc(proyNombre)} — Informe por racord</div><div>${fecha}</div><br/>`;
    html += `<table border="1"><tr style="background:#dfe3f7"><th>Racord</th><th>Total sec.</th><th>Por capitulo</th><th>Secuencias</th><th>Personajes</th><th>Localizaciones (decorados)</th></tr>`;
    racordList.forEach((g) => {
      html += `<tr><td style="font-weight:bold">${esc(g.racord)}</td><td>${g.total}</td><td>${esc(g.porCapTxt)}</td><td>${esc(g.secs.join(", "))}</td><td>${esc(g.pers.map((p) => (p.num != null ? p.num + " " : "") + p.nom).join(", "))}</td><td>${esc(g.locs.map((l) => l.loc + (l.decos.length ? " [" + l.decos.join(", ") + "]" : "")).join(" | "))}</td></tr>`;
    });
    html += "</table></body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "informe_racord.xls"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportRacordPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>Informe racord</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      body{font-family:Arial,Helvetica,sans-serif;padding:22px;color:#111}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
      .rc{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
      .rc-h{padding:8px 12px;color:#fff;font-weight:bold;font-size:14px}
      .rc-b{padding:10px 12px}
      .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#888;margin:8px 0 3px}
      .lbl:first-child{margin-top:0}
      .pers span{display:inline-block;background:#eef2ff;color:#3730a3;padding:1px 7px;border-radius:5px;font-size:11px;margin:2px 3px 2px 0}
      .loc{display:inline-block;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;margin:3px 5px 3px 0;font-size:12px;background:#fafafa}
      .loc b{display:block;margin-bottom:2px}
      .deco{background:#fff;border:1px solid #e2e8f0;color:#475569;padding:0 6px;border-radius:4px;font-size:10px;margin:1px 2px 0 0;display:inline-block}
      @media print{@page{margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} — Informe por racord</h1><div class="fecha">${fecha}</div>`;
    racordList.forEach((g) => {
      const col = racordColor[g.racord] || "#334155";
      html += `<div class="rc"><div class="rc-h" style="background:${col}">Racord ${esc(g.racord)} — ${g.total} secuencias · ${esc(g.porCapTxt)}</div><div class="rc-b">`;
      html += `<div class="lbl">Secuencias</div><div style="font-size:12px">${esc(g.secs.join(", ")) || "-"}</div>`;
      html += `<div class="lbl">Personajes</div><div class="pers">${g.pers.map((p) => `<span>${p.num != null ? "<b>" + p.num + "</b> " : ""}${esc(p.nom)}</span>`).join("") || "-"}</div>`;
      html += `<div class="lbl">Localizaciones</div><div>${g.locs.map((l) => `<div class="loc"><b>${esc(l.loc)}</b>${l.decos.map((d) => `<span class="deco">${esc(d)}</span>`).join("")}</div>`).join("") || "-"}</div>`;
      html += `</div></div>`;
    });
    html += "</body></html>";
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  // Figuración por día de rodaje (mismo concepto el mismo día = el mayor, no la suma)
  const FIG_LBL = { normal: "Normal", especial: "Especial", acting: "Acting", menores: "Menores" };
  const FIG_ORDEN = ["normal", "especial", "acting", "menores"];
  const figDiaPorTerr = {};
  dias.filter((d) => d.tipo === "rodaje").slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).forEach((d) => {
    const terr = (d.territorio || "").trim() || "(sin territorio)";
    const maxPorClave = {};
    (d.plan_dia_escenas || []).forEach((x) => {
      const e = escById[x.escena_id]; if (!e) return;
      (e.figuracion || []).forEach((f) => {
        const concepto = String(f.nota || "").trim();
        const clave = f.tipo + "|" + concepto.toUpperCase();
        const cant = Number(f.cantidad || 0);
        if (!maxPorClave[clave] || cant > maxPorClave[clave].cant) maxPorClave[clave] = { tipo: f.tipo, concepto, cant };
      });
    });
    const lineas = Object.values(maxPorClave).filter((l) => l.cant > 0);
    if (!lineas.length) return;
    const total = lineas.reduce((s, l) => s + l.cant, 0);
    const porTipo = FIG_ORDEN.map((t) => { const ls = lineas.filter((l) => l.tipo === t); return { tipo: t, lineas: ls, subtotal: ls.reduce((s2, l) => s2 + l.cant, 0) }; }).filter((g) => g.lineas.length);
    (figDiaPorTerr[terr] = figDiaPorTerr[terr] || []).push({ fecha: d.fecha, lineas, porTipo, total });
  });
  const figDiaTerrs = Object.keys(figDiaPorTerr).sort((a, b) => (terrOrden(a) - terrOrden(b)) || a.localeCompare(b)).map((terr) => {
    const ds = figDiaPorTerr[terr];
    const totTipo = {}; ds.forEach((d) => d.porTipo.forEach((g) => { totTipo[g.tipo] = (totTipo[g.tipo] || 0) + g.subtotal; }));
    return { terr, dias: ds, total: ds.reduce((s, x) => s + x.total, 0), totTipo };
  });
  const fmtFecha = (f) => { if (!f) return "-"; const p = String(f).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : f; };

  // Pequenas partes por dia de rodaje (la misma peq. parte el mismo dia cuenta una vez)
  const ppDiaPorTerr = {};
  dias.filter((d) => d.tipo === "rodaje").slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).forEach((d) => {
    const terr = (d.territorio || "").trim() || "(sin territorio)";
    const mapa = {};
    (d.plan_dia_escenas || []).forEach((x) => {
      const e = escById[x.escena_id]; if (!e) return;
      (e.desglose_items || []).filter((i) => i.categoria === "pequenaParte").forEach((i) => {
        const nom = String(i.elemento || "").trim(); if (!nom) return;
        const k = nom.toUpperCase();
        if (!mapa[k]) mapa[k] = { nombre: nom, num: i.pp_num ?? null };
        else if (mapa[k].num == null && i.pp_num != null) mapa[k].num = i.pp_num;
      });
    });
    const pps = Object.values(mapa).sort((a, b) => { const na = a.num == null ? 99999 : a.num, nb = b.num == null ? 99999 : b.num; return (na - nb) || a.nombre.localeCompare(b.nombre); });
    if (!pps.length) return;
    (ppDiaPorTerr[terr] = ppDiaPorTerr[terr] || []).push({ fecha: d.fecha, pps, total: pps.length });
  });
  const ppDiaTerrs = Object.keys(ppDiaPorTerr).sort((a, b) => (terrOrden(a) - terrOrden(b)) || a.localeCompare(b)).map((terr) => {
    const ds = ppDiaPorTerr[terr];
    const dist = new Set(); ds.forEach((d) => d.pps.forEach((x) => dist.add(x.nombre.toUpperCase())));
    return { terr, dias: ds, total: ds.reduce((s, x) => s + x.total, 0), distintas: dist.size };
  });
  const ppTxt = (x) => `${x.num != null ? "PP" + x.num + " " : ""}${x.nombre}`;

  // ===== Informes por categoria y dia (especialistas, vehiculos...) =====
  function catPorDia(categoria) {
    const porTerr = {};
    dias.filter((d) => d.tipo === "rodaje").slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))).forEach((d) => {
      const terr = (d.territorio || "").trim() || "(sin territorio)";
      const mapa = {};
      (d.plan_dia_escenas || []).forEach((x) => {
        const e = escById[x.escena_id]; if (!e) return;
        (e.desglose_items || []).filter((i) => i.categoria === categoria).forEach((i) => {
          const nom = String(i.elemento || "").trim(); if (!nom) return;
          const k = nom.toUpperCase();
          if (!mapa[k]) mapa[k] = { nombre: nom, secs: [] };
          if (e.uid && !mapa[k].secs.includes(e.uid)) mapa[k].secs.push(e.uid);
        });
      });
      const items = Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre));
      items.forEach((it) => it.secs.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })));
      if (!items.length) return;
      (porTerr[terr] = porTerr[terr] || []).push({ fecha: d.fecha, items, total: items.length });
    });
    return Object.keys(porTerr).sort((a, b) => (terrOrden(a) - terrOrden(b)) || a.localeCompare(b)).map((terr) => {
      const ds = porTerr[terr];
      const dist = new Set(); ds.forEach((d) => d.items.forEach((x) => dist.add(x.nombre.toUpperCase())));
      return { terr, dias: ds, total: ds.reduce((s2, x) => s2 + x.total, 0), distintas: dist.size };
    });
  }
  // ===== Localizaciones por territorio =====
  const locPorTerrMap = {};
  escenas.forEach((e) => {
    const terr = (e.territorio || "").trim(); if (!terr) return;
    const loc = (e.localizacion || "").trim().toUpperCase(); if (!loc) return;
    const dec = (e.decorado || "").trim() || "(sin decorado)";
    const oct = Number(e.octavos || 0);
    if (!locPorTerrMap[terr]) locPorTerrMap[terr] = {};
    if (!locPorTerrMap[terr][loc]) locPorTerrMap[terr][loc] = {};
    if (!locPorTerrMap[terr][loc][dec]) locPorTerrMap[terr][loc][dec] = { secs: 0, oct: 0 };
    locPorTerrMap[terr][loc][dec].secs++;
    locPorTerrMap[terr][loc][dec].oct += oct;
  });
  const locPorTerrList = terrRodaje.filter((t) => locPorTerrMap[t]).map((t) => {
    const locsMap = locPorTerrMap[t];
    const locs = Object.keys(locsMap).sort().map((loc) => {
      const decos = Object.keys(locsMap[loc]).sort((a, b) => a === "(sin decorado)" ? 1 : b === "(sin decorado)" ? -1 : a.localeCompare(b)).map((dec) => ({ dec, ...locsMap[loc][dec] }));
      return { loc, decos, secs: decos.reduce((s2, d) => s2 + d.secs, 0), oct: decos.reduce((s2, d) => s2 + d.oct, 0) };
    });
    const nLocs = locs.length, nDecos = locs.reduce((s2, l) => s2 + l.decos.length, 0);
    const totSecs = locs.reduce((s2, l) => s2 + l.secs, 0), totOct = locs.reduce((s2, l) => s2 + l.oct, 0);
    return { terr: t, locs, nLocs, nDecos, totSecs, totOct };
  });
  function exportLocTerrCSV() {
    const filas = [["Territorio", "Localizacion", "Decorado", "Secuencias", "Paginas"]];
    locPorTerrList.forEach((g) => {
      g.locs.forEach((l) => {
        l.decos.forEach((d) => filas.push([g.terr, l.loc, d.dec, `${d.secs} / ${totalSecs > 0 ? Math.round((d.secs / totalSecs) * 100) : 0}%`, `${fmtEighths(d.oct)} / ${totalOct > 0 ? Math.round((d.oct / totalOct) * 100) : 0}%`]));
        if (l.decos.length > 1) filas.push([g.terr, l.loc, "Subtotal " + l.loc, `${l.secs} / ${totalSecs > 0 ? Math.round((l.secs / totalSecs) * 100) : 0}%`, `${fmtEighths(l.oct)} / ${totalOct > 0 ? Math.round((l.oct / totalOct) * 100) : 0}%`]);
      });
      filas.push([g.terr + " — TOTAL", "", "", `${g.totSecs} / ${totalSecs > 0 ? Math.round((g.totSecs / totalSecs) * 100) : 0}%`, `${fmtEighths(g.totOct)} / ${totalOct > 0 ? Math.round((g.totOct / totalOct) * 100) : 0}%`]);
    });
    descargarCSV("localizaciones_por_territorio.csv", filas);
  }
  function exportLocTerrExcel() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<div style="font-weight:bold;font-size:14px">${esc(proyNombre)} — Localizaciones por territorio</div><div>${fecha}</div><br/>`;
    locPorTerrList.forEach((g) => {
      html += `<table border="1"><tr><td colspan="4" style="font-weight:bold;background:#dfe3f7">${esc(g.terr)} — ${g.nLocs} localizaciones · ${g.nDecos} decorados · ${g.totSecs} secs · ${fmtEighths(g.totOct)} pg</td></tr>`;
      html += `<tr style="background:#eef2ff"><th>Localizacion</th><th>Decorado</th><th>Secuencias</th><th>Paginas</th></tr>`;
      g.locs.forEach((l) => {
        l.decos.forEach((d, j) => { html += `<tr><td${j === 0 ? " style=\"font-weight:bold\"" : ""}>${j === 0 ? esc(l.loc) : ""}</td><td>${esc(d.dec)}</td><td>${d.secs} / ${totalSecs > 0 ? Math.round((d.secs / totalSecs) * 100) : 0}%</td><td>${fmtEighths(d.oct)} / ${totalOct > 0 ? Math.round((d.oct / totalOct) * 100) : 0}%</td></tr>`; });
        if (l.decos.length > 1) html += `<tr style="background:#f8fafc"><td></td><td style="font-style:italic">Subtotal ${esc(l.loc)}</td><td style="font-weight:bold">${l.secs} / ${totalSecs > 0 ? Math.round((l.secs / totalSecs) * 100) : 0}%</td><td style="font-weight:bold">${fmtEighths(l.oct)} / ${totalOct > 0 ? Math.round((l.oct / totalOct) * 100) : 0}%</td></tr>`;
      });
      html += `<tr style="font-weight:bold;background:#f1f5f9"><td colspan="2">TOTAL ${esc(g.terr)}</td><td>${g.totSecs} / ${totalSecs > 0 ? Math.round((g.totSecs / totalSecs) * 100) : 0}%</td><td>${fmtEighths(g.totOct)} / ${totalOct > 0 ? Math.round((g.totOct / totalOct) * 100) : 0}%</td></tr></table><br/>`;
    });
    html += "</body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "localizaciones_por_territorio.xls"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportLocTerrPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>Localizaciones por territorio</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      body{font-family:Arial,Helvetica,sans-serif;padding:22px;color:#111}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
      .rc{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
      .rc-h{padding:8px 12px;color:#fff;font-weight:bold;font-size:13px}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th,td{border:1px solid #e2e8f0;padding:4px 7px;text-align:left}
      th{background:#f4f6fb} td.r{text-align:right} tr.tot td{font-weight:bold;border-top:2px solid #cbd5e1}
      tr.sub td{background:#f8fafc}
      @media print{@page{margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} — Localizaciones por territorio</h1><div class="fecha">${fecha}</div>`;
    locPorTerrList.forEach((g, i) => {
      const col = colorTerr(g.terr, i);
      html += `<div class="rc"><div class="rc-h" style="background:${col}">${esc(g.terr)} — ${g.nLocs} localizaciones · ${g.nDecos} decorados · ${g.totSecs} secs · ${fmtEighths(g.totOct)} pg</div>`;
      html += `<table><thead><tr><th>Localizacion</th><th>Decorado</th><th>Secuencias</th><th>Paginas</th></tr></thead><tbody>`;
      g.locs.forEach((l) => {
        l.decos.forEach((d, j) => { html += `<tr><td${j === 0 ? " style=\"font-weight:bold\"" : ""}>${j === 0 ? esc(l.loc) : ""}</td><td>${esc(d.dec)}</td><td class="r">${d.secs} / ${totalSecs > 0 ? Math.round((d.secs / totalSecs) * 100) : 0}%</td><td class="r">${fmtEighths(d.oct)} / ${totalOct > 0 ? Math.round((d.oct / totalOct) * 100) : 0}%</td></tr>`; });
        if (l.decos.length > 1) html += `<tr class="sub"><td></td><td style="font-style:italic">Subtotal ${esc(l.loc)}</td><td class="r" style="font-weight:bold">${l.secs} / ${totalSecs > 0 ? Math.round((l.secs / totalSecs) * 100) : 0}%</td><td class="r" style="font-weight:bold">${fmtEighths(l.oct)} / ${totalOct > 0 ? Math.round((l.oct / totalOct) * 100) : 0}%</td></tr>`;
      });
      html += `<tr class="tot"><td colspan="2">TOTAL ${esc(g.terr)}</td><td class="r">${g.totSecs} / ${totalSecs > 0 ? Math.round((g.totSecs / totalSecs) * 100) : 0}%</td><td class="r">${fmtEighths(g.totOct)} / ${totalOct > 0 ? Math.round((g.totOct / totalOct) * 100) : 0}%</td></tr></tbody></table></div>`;
    });
    html += "</body></html>";
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  const espDiaTerrs = catPorDia("especialistas");
  const vehDiaTerrs = catPorDia("vehiculos");
  const itemTxt = (x) => `${x.nombre}${x.secs.length ? " (" + x.secs.join(", ") + ")" : ""}`;
  function exportCatCSV(terrs, nombreArch, lbl) {
    const filas = [["Territorio", "Dia", lbl, "Secuencias", "Total dia"]];
    terrs.forEach((g) => {
      g.dias.forEach((d) => d.items.forEach((x, k) => filas.push([g.terr, k === 0 ? fmtFecha(d.fecha) : "", x.nombre, x.secs.join(" "), k === 0 ? d.total : ""])));
      filas.push([g.terr + " — TOTAL TERRITORIO", "", `${g.distintas} distintos`, "", g.total]);
    });
    descargarCSV(nombreArch + ".csv", filas);
  }
  function exportCatExcel(terrs, nombreArch, titulo, lbl) {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<div style="font-weight:bold;font-size:14px">${esc(proyNombre)} — ${esc(titulo)}</div><div>${fecha}</div><br/>`;
    terrs.forEach((g) => {
      html += `<table border="1"><tr><td colspan="4" style="font-weight:bold;background:#dfe3f7">${esc(g.terr)} — ${g.total} jornadas · ${g.distintas} distintos</td></tr>`;
      html += `<tr style="background:#eef2ff"><th>Dia</th><th>${esc(lbl)}</th><th>Secuencias</th><th>Total dia</th></tr>`;
      g.dias.forEach((d) => d.items.forEach((x, k) => { html += `<tr><td>${k === 0 ? esc(fmtFecha(d.fecha)) : ""}</td><td>${esc(x.nombre)}</td><td>${esc(x.secs.join(", "))}</td><td>${k === 0 ? d.total : ""}</td></tr>`; }));
      html += `</table><br/>`;
    });
    html += "</body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = nombreArch + ".xls"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportCatPDF(terrs, titulo, lbl, colorChip) {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      body{font-family:Arial,Helvetica,sans-serif;padding:22px;color:#111}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
      .rc{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
      .rc-h{padding:8px 12px;color:#fff;font-weight:bold;font-size:13px}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th,td{border:1px solid #e2e8f0;padding:4px 7px;text-align:left}
      th{background:#f4f6fb} td.tot{text-align:right;font-weight:bold}
      .it{display:inline-block;background:${colorChip.bg};color:${colorChip.fg};padding:1px 6px;border-radius:4px;margin:1px 3px 1px 0;font-size:10px}
      .secs{color:#71717a;font-size:10px}
      @media print{@page{margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} — ${esc(titulo)}</h1><div class="fecha">${fecha}</div>`;
    terrs.forEach((g, i) => {
      const col = colorTerr(g.terr, i);
      html += `<div class="rc"><div class="rc-h" style="background:${col}">${esc(g.terr)} — ${g.total} jornadas · ${g.distintas} distintos</div>`;
      html += `<table><thead><tr><th style="width:90px">Dia</th><th>${esc(lbl)}</th><th style="width:60px;text-align:right">Total</th></tr></thead><tbody>`;
      g.dias.forEach((d) => { html += `<tr><td><b>${esc(fmtFecha(d.fecha))}</b></td><td>${d.items.map((x) => `<span class="it">${esc(x.nombre)}</span><span class="secs">${x.secs.length ? " " + esc(x.secs.join(", ")) : ""}</span>`).join("<br/>")}</td><td class="tot">${d.total}</td></tr>`; });
      html += `</tbody></table></div>`;
    });
    html += "</body></html>";
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  // ===== Informe economico de figuracion =====
  const nCoord = (n) => (n <= 10 ? 0 : 1 + Math.floor((n - 1) / 50));
  const eur = (v) => (Number(v) || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const TARIFA_CAMPOS = [
    { k: "t_normal", lbl: "Normal" }, { k: "t_especial", lbl: "Especial" }, { k: "t_acting", lbl: "Acting" },
    { k: "t_menores", lbl: "Menores" }, { k: "t_pp", lbl: "Pequena parte" }, { k: "t_prueba", lbl: "Prueba" },
    { k: "t_coord", lbl: "Coordinador" }, { k: "pct_pruebas", lbl: "% que prueba" },
  ];
  const ecoTerrs = terrRodaje.map((terr) => {
    const tf = tarifas[terr] || {};
    const tar = { normal: Number(tf.t_normal) || 0, especial: Number(tf.t_especial) || 0, acting: Number(tf.t_acting) || 0, menores: Number(tf.t_menores) || 0, pp: Number(tf.t_pp) || 0, prueba: Number(tf.t_prueba) || 0, coord: Number(tf.t_coord) || 0, pct: Number(tf.pct_pruebas) || 0 };
    const gFig = figDiaTerrs.find((g) => g.terr === terr);
    const gPP = ppDiaTerrs.find((g) => g.terr === terr);
    const fechas = new Set([...(gFig?.dias || []).map((d) => d.fecha), ...(gPP?.dias || []).map((d) => d.fecha)]);
    const dias2 = Array.from(fechas).sort().map((f) => {
      const df = (gFig?.dias || []).find((d) => d.fecha === f);
      const dp = (gPP?.dias || []).find((d) => d.fecha === f);
      const porTipo = {}; (df?.porTipo || []).forEach((g) => { porTipo[g.tipo] = g.subtotal; });
      const nFig = df?.total || 0;
      const nPP = dp?.total || 0;
      const cTipo = { normal: (porTipo.normal || 0) * tar.normal, especial: (porTipo.especial || 0) * tar.especial, acting: (porTipo.acting || 0) * tar.acting, menores: (porTipo.menores || 0) * tar.menores };
      const cFig = cTipo.normal + cTipo.especial + cTipo.acting + cTipo.menores;
      const nPruebas = Math.round(nFig * tar.pct / 100);
      const cPruebas = nPruebas * tar.prueba;
      const nCo = nCoord(nFig);
      const cCoord = nCo * tar.coord;
      const cPP = nPP * tar.pp;
      return { fecha: f, nFig, porTipo, cTipo, cFig, nPruebas, cPruebas, nCo, cCoord, nPP, cPP, total: cFig + cPruebas + cCoord + cPP };
    });
    const suma = (campo) => dias2.reduce((s2, d) => s2 + (d[campo] || 0), 0);
    const cTipoT = {}, nTipoT = {};
    FIG_ORDEN.forEach((t) => { cTipoT[t] = dias2.reduce((s2, d) => s2 + (d.cTipo[t] || 0), 0); nTipoT[t] = dias2.reduce((s2, d) => s2 + (d.porTipo[t] || 0), 0); });
    return { terr, tar, dias: dias2, nDias: dias2.length, cTipoT, nTipoT,
      cFig: suma("cFig"), cPruebas: suma("cPruebas"), cCoord: suma("cCoord"), cPP: suma("cPP"), total: suma("total"),
      nFig: suma("nFig"), nPruebas: suma("nPruebas"), nCo: suma("nCo"), nPP: suma("nPP") };
  }).filter((g) => g.dias.length);
  const ecoTotal = ecoTerrs.reduce((s2, g) => s2 + g.total, 0);
  const capsDesglosados = new Set(escenas.map((e) => e.capNum)).size;
  const capsSerie = Number(proy.caps_serie) || 0;
  const capsFaltan = Math.max(0, capsSerie - capsDesglosados);
  const mediaCap = capsDesglosados > 0 ? ecoTotal / capsDesglosados : 0;
  const alzado = Number(proy.fig_alzado) || 0;
  const proyMedia = ecoTotal + mediaCap * capsFaltan;
  const factorProy = capsDesglosados > 0 && capsSerie > 0 ? capsSerie / capsDesglosados : 0;
  const ecoProyTerr = ecoTerrs.map((g) => ({ terr: g.terr, actual: g.total, mediaCap: capsDesglosados > 0 ? g.total / capsDesglosados : 0, proyectado: g.total * factorProy }));
  const proyAlzado = ecoTotal + alzado;
  function ecoFilas() {
    const cab = ["Territorio", "Dia", ...FIG_ORDEN.map((t) => FIG_LBL[t]), "Coste figuracion", "Pruebas (n)", "Coste pruebas", "Coordinadores", "Coste coordinador", "Peq. partes (n)", "Coste peq. partes", "Total"];
    const filas = [cab];
    ecoTerrs.forEach((g) => {
      g.dias.forEach((d) => filas.push([g.terr, fmtFecha(d.fecha), ...FIG_ORDEN.map((t) => d.cTipo[t] || 0), d.cFig, d.nPruebas, d.cPruebas, d.nCo, d.cCoord, d.nPP, d.cPP, d.total]));
      filas.push([g.terr + " — TOTAL", `${g.nDias} dias`, ...FIG_ORDEN.map((t) => g.cTipoT[t] || 0), g.cFig, g.nPruebas, g.cPruebas, g.nCo, g.cCoord, g.nPP, g.cPP, g.total]);
    });
    filas.push(["TOTAL PRODUCCION", "", ...FIG_ORDEN.map((t) => ecoTerrs.reduce((s2, g) => s2 + g.cTipoT[t], 0)), ecoTerrs.reduce((s2, g) => s2 + g.cFig, 0), "", ecoTerrs.reduce((s2, g) => s2 + g.cPruebas, 0), "", ecoTerrs.reduce((s2, g) => s2 + g.cCoord, 0), "", ecoTerrs.reduce((s2, g) => s2 + g.cPP, 0), ecoTotal]);
    return filas;
  }
  function exportEcoCSV() { descargarCSV("presupuesto_figuracion.csv", ecoFilas()); }
  function exportEcoExcel() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const filas = ecoFilas();
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<div style="font-weight:bold;font-size:14px">${esc(proyNombre)} — Presupuesto de figuracion</div><div>${fecha}</div><br/>`;
    html += `<table border="1"><tr style="background:#dfe3f7">${filas[0].map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
    filas.slice(1).forEach((r) => { const esTot = String(r[0]).includes("TOTAL"); html += `<tr${esTot ? ' style="font-weight:bold;background:#eef2ff"' : ""}>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`; });
    html += `</table><br/><table border="1"><tr style="background:#dfe3f7"><th>Proyeccion</th><th>Importe</th></tr>`;
    html += `<tr><td>Desglosado (${capsDesglosados} cap.)</td><td>${ecoTotal}</td></tr><tr><td>Media por capitulo</td><td>${Math.round(mediaCap * 100) / 100}</td></tr>`;
    if (capsSerie > 0) html += `<tr><td>Proyeccion serie (${capsSerie} cap.)</td><td>${Math.round(proyMedia * 100) / 100}</td></tr>`;
    if (alzado > 0) html += `<tr><td>Con tanto alzado</td><td>${proyAlzado}</td></tr>`;
    html += "</table>";
    if (capsSerie > 0) {
      html += `<br/><table border="1"><tr style="background:#dfe3f7"><th>Territorio</th><th>Desglosado</th><th>Media/capitulo</th><th>Proyectado (${capsSerie} cap.)</th></tr>`;
      ecoProyTerr.forEach((g) => { html += `<tr><td>${esc(g.terr)}</td><td>${Math.round(g.actual * 100) / 100}</td><td>${Math.round(g.mediaCap * 100) / 100}</td><td>${Math.round(g.proyectado * 100) / 100}</td></tr>`; });
      html += `<tr style="font-weight:bold;background:#eef2ff"><td>TOTAL</td><td>${Math.round(ecoTotal * 100) / 100}</td><td>${Math.round(mediaCap * 100) / 100}</td><td>${Math.round(proyMedia * 100) / 100}</td></tr>`;
    }
    html += "</table></body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "presupuesto_figuracion.xls"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportEcoPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>Presupuesto de figuracion</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      body{font-family:Arial,Helvetica,sans-serif;padding:20px;color:#111}
      h1{font-size:17px;margin:0 0 2px} h2{font-size:13px;margin:18px 0 6px}
      .fecha{color:#666;font-size:12px;margin-bottom:14px}
      table{border-collapse:collapse;width:100%;font-size:10px;margin-bottom:12px}
      th,td{border:1px solid #cbd5e1;padding:3px 5px;text-align:right}
      th{background:#eef2ff;text-align:right} th:first-child,td:first-child{text-align:left}
      tr.tot td{font-weight:bold;background:#f1f5f9}
      .rc{page-break-inside:avoid}
      .rc-h{padding:6px 10px;color:#fff;font-weight:bold;font-size:12px;margin-top:12px}
      @media print{@page{margin:10mm;size:landscape}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} — Presupuesto de figuracion</h1><div class="fecha">${fecha}</div>`;
    html += `<h2>Coste por territorio</h2><table><thead><tr><th>Territorio</th><th>Dias</th>${FIG_ORDEN.map((t) => `<th>${FIG_LBL[t]}</th>`).join("")}<th>Total fig.</th><th>Pruebas</th><th>Coordinador</th><th>Peq. partes</th><th>TOTAL</th></tr></thead><tbody>`;
    ecoTerrs.forEach((g) => { html += `<tr><td><b>${esc(g.terr)}</b></td><td>${g.nDias}</td>${FIG_ORDEN.map((t) => `<td>${eur(g.cTipoT[t])}</td>`).join("")}<td>${eur(g.cFig)}</td><td>${eur(g.cPruebas)}</td><td>${eur(g.cCoord)}</td><td>${eur(g.cPP)}</td><td><b>${eur(g.total)}</b></td></tr>`; });
    html += `<tr class="tot"><td>TOTAL</td><td>${ecoTerrs.reduce((s2, g) => s2 + g.nDias, 0)}</td>${FIG_ORDEN.map((t) => `<td>${eur(ecoTerrs.reduce((s2, g) => s2 + g.cTipoT[t], 0))}</td>`).join("")}<td>${eur(ecoTerrs.reduce((s2, g) => s2 + g.cFig, 0))}</td><td>${eur(ecoTerrs.reduce((s2, g) => s2 + g.cPruebas, 0))}</td><td>${eur(ecoTerrs.reduce((s2, g) => s2 + g.cCoord, 0))}</td><td>${eur(ecoTerrs.reduce((s2, g) => s2 + g.cPP, 0))}</td><td>${eur(ecoTotal)}</td></tr></tbody></table>`;
    html += `<h2>Proyeccion</h2><table><tbody><tr><td>Desglosado (${capsDesglosados} cap.)</td><td>${eur(ecoTotal)}</td></tr><tr><td>Media por capitulo</td><td>${eur(mediaCap)}</td></tr>`;
    if (capsSerie > 0) html += `<tr class="tot"><td>Proyeccion serie (${capsSerie} cap.)</td><td>${eur(proyMedia)}</td></tr>`;
    if (alzado > 0) html += `<tr class="tot"><td>Con tanto alzado</td><td>${eur(proyAlzado)}</td></tr>`;
    html += `</tbody></table>`;
    if (capsSerie > 0) {
      html += `<h2>Proyeccion por territorio (${capsSerie} capitulos)</h2><table><thead><tr><th>Territorio</th><th>Desglosado (${capsDesglosados} cap.)</th><th>Media / capitulo</th><th>Proyectado</th></tr></thead><tbody>`;
      ecoProyTerr.forEach((g) => { html += `<tr><td><b>${esc(g.terr)}</b></td><td>${eur(g.actual)}</td><td>${eur(g.mediaCap)}</td><td><b>${eur(g.proyectado)}</b></td></tr>`; });
      html += `<tr class="tot"><td>TOTAL</td><td>${eur(ecoTotal)}</td><td>${eur(mediaCap)}</td><td>${eur(proyMedia)}</td></tr></tbody></table>`;
    }
    ecoTerrs.forEach((g, i) => {
      const col = colorTerr(g.terr, i);
      html += `<div class="rc"><div class="rc-h" style="background:${col}">${esc(g.terr)} — ${eur(g.total)}</div>`;
      html += `<table><thead><tr><th>Dia</th>${FIG_ORDEN.map((t) => `<th>${FIG_LBL[t]}</th>`).join("")}<th>Coste fig.</th><th>Pruebas</th><th>Coord.</th><th>PP</th><th>Total dia</th></tr></thead><tbody>`;
      g.dias.forEach((d) => { html += `<tr><td><b>${esc(fmtFecha(d.fecha))}</b></td>${FIG_ORDEN.map((t) => `<td>${d.porTipo[t] || 0}</td>`).join("")}<td>${eur(d.cFig)}</td><td>${d.nPruebas || "-"}</td><td>${d.nCo || "-"}</td><td>${d.nPP || "-"}</td><td><b>${eur(d.total)}</b></td></tr>`; });
      html += `</tbody></table></div>`;
    });
    html += "</body></html>";
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }
  async function guardarTarifa(terr, campo, valor) {
    const v = valor === "" ? 0 : Number(String(valor).replace(",", "."));
    if (isNaN(v)) return;
    const actual = tarifas[terr] || {};
    const fila = { proyecto_id: proyectoId, territorio: terr, t_normal: actual.t_normal || 0, t_especial: actual.t_especial || 0, t_acting: actual.t_acting || 0, t_menores: actual.t_menores || 0, t_pp: actual.t_pp || 0, t_prueba: actual.t_prueba || 0, t_coord: actual.t_coord || 0, pct_pruebas: actual.pct_pruebas || 0 };
    fila[campo] = v;
    await supabase.from("tarifas_figuracion").upsert(fila, { onConflict: "proyecto_id,territorio" });
    await cargar();
  }
  async function guardarProy(campo, valor) {
    const v = valor === "" ? null : Number(String(valor).replace(",", "."));
    await supabase.from("proyectos").update({ [campo]: v }).eq("id", proyectoId);
    await cargar();
  }
  function exportPPDiaCSV() {
    const filas = [["Territorio", "Dia", "Pequenas partes", "Total dia"]];
    ppDiaTerrs.forEach((g) => {
      g.dias.forEach((d) => filas.push([g.terr, fmtFecha(d.fecha), d.pps.map(ppTxt).join(", "), d.total]));
      filas.push([g.terr + " — TOTAL TERRITORIO", "", `${g.distintas} distintas`, g.total]);
    });
    descargarCSV("informe_pequenas_partes_por_dia.csv", filas);
  }
  function exportPPDiaExcel() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<div style="font-weight:bold;font-size:14px">${esc(proyNombre)} — Pequenas partes por dia</div><div>${fecha}</div><br/>`;
    ppDiaTerrs.forEach((g) => {
      html += `<table border="1"><tr><td colspan="3" style="font-weight:bold;background:#dfe3f7">${esc(g.terr)} — Total: ${g.total} jornadas · ${g.distintas} distintas</td></tr>`;
      html += `<tr style="background:#eef2ff"><th>Dia</th><th>Pequenas partes</th><th>Total dia</th></tr>`;
      g.dias.forEach((d) => { html += `<tr><td>${esc(fmtFecha(d.fecha))}</td><td>${esc(d.pps.map(ppTxt).join(", "))}</td><td>${d.total}</td></tr>`; });
      html += `</table><br/>`;
    });
    html += "</body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "informe_pequenas_partes_por_dia.xls"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportPPDiaPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>Pequenas partes por dia</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      body{font-family:Arial,Helvetica,sans-serif;padding:22px;color:#111}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
      .rc{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
      .rc-h{padding:8px 12px;color:#fff;font-weight:bold;font-size:13px}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th,td{border:1px solid #e2e8f0;padding:4px 7px;text-align:left}
      th{background:#f4f6fb} td.tot{text-align:right;font-weight:bold}
      .pp{display:inline-block;background:#f3e8ff;color:#6b21a8;padding:1px 6px;border-radius:4px;margin:1px 3px 1px 0;font-size:10px}
      @media print{@page{margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} — Pequenas partes por dia</h1><div class="fecha">${fecha}</div>`;
    ppDiaTerrs.forEach((g, i) => {
      const col = colorTerr(g.terr, i);
      html += `<div class="rc"><div class="rc-h" style="background:${col}">${esc(g.terr)} — Total: ${g.total} jornadas · ${g.distintas} distintas</div>`;
      html += `<table><thead><tr><th>Dia</th><th>Pequenas partes</th><th>Total dia</th></tr></thead><tbody>`;
      g.dias.forEach((d) => { html += `<tr><td><b>${esc(fmtFecha(d.fecha))}</b></td><td>${d.pps.map((x) => `<span class="pp">${esc(ppTxt(x))}</span>`).join("")}</td><td class="tot">${d.total}</td></tr>`; });
      html += `</tbody></table></div>`;
    });
    html += "</body></html>";
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }
  function exportFigDiaCSV() {
    const filas = [["Territorio", "Dia", "Tipo", "Concepto", "Cantidad"]];
    figDiaTerrs.forEach((g) => {
      g.dias.forEach((d) => { d.lineas.forEach((l) => filas.push([g.terr, fmtFecha(d.fecha), FIG_LBL[l.tipo] || l.tipo, l.concepto || "-", l.cant])); filas.push([g.terr, fmtFecha(d.fecha) + " — TOTAL DIA", "", "", d.total]); });
      filas.push([g.terr + " — TOTAL TERRITORIO", "", "", "", g.total]);
    });
    descargarCSV("informe_figuracion_por_dia.csv", filas);
  }
  const persRows = Object.values(persMap).map((x) => ({ ...x, num: numByName[x.nombre] ?? "", edad: edadByName[x.nombre] || "", nacionalidad: nacByName[x.nombre] || "", descripcion: descByName[x.nombre] || "", menor: !!menorByName[x.nombre], categoria: catByName[x.nombre] || "", dias: x.dias.size }))
    .sort((a, b) => { const na = a.num === "" ? 99999 : a.num, nb = b.num === "" ? 99999 : b.num; if (na !== nb) return na - nb; return b.secs - a.secs; });

  // Figuración por territorio
  const figByTerr = {};
  escenas.forEach((e) => {
    const terr = (e.territorio || "").trim() || "(sin territorio)";
    if (!figByTerr[terr]) figByTerr[terr] = { terr, tot: { normal: 0, especial: 0, acting: 0, menores: 0 }, pps: 0, secs: [] };
    const g = figByTerr[terr];
    const figLineas = e.figuracion || [];
    const pps = (e.desglose_items || []).filter((i) => i.categoria === "pequenaParte");
    figLineas.forEach((f) => { if (g.tot[f.tipo] != null) g.tot[f.tipo] += Number(f.cantidad || 0); });
    g.pps += pps.length;
    if (figLineas.length || pps.length) g.secs.push({ uid: e.uid, capNum: e.capNum, orden: e.orden, loc: e.localizacion, figLineas, pps });
  });
  Object.values(figByTerr).forEach((g) => g.secs.sort((a, b) => (a.capNum - b.capNum) || ((a.orden || 0) - (b.orden || 0))));
  const figTerrs = Object.values(figByTerr).filter((g) => g.secs.length > 0).sort((a, b) => (terrOrden(a.terr) - terrOrden(b.terr)) || a.terr.localeCompare(b.terr));
  const lineasTxt = (secLineas, t) => secLineas.filter((f) => f.tipo === t).map((f) => `${f.cantidad || 0}${f.nota ? " " + f.nota : ""}`).join(" / ") || "-";
  const ppsTxt = (pps) => pps.map((p) => `${p.pp_num ? "PP" + p.pp_num + " " : ""}${p.elemento}`).join(" / ") || "-";
  function exportFigCSV() {
    const filas = [["Territorio", "Secuencia", "Normal", "Especial", "Acting", "Menores", "Pequenas partes"]];
    figTerrs.forEach((g) => {
      g.secs.forEach((s) => filas.push([g.terr, s.uid, lineasTxt(s.figLineas, "normal"), lineasTxt(s.figLineas, "especial"), lineasTxt(s.figLineas, "acting"), lineasTxt(s.figLineas, "menores"), ppsTxt(s.pps)]));
      filas.push([g.terr + " — TOTAL", "", g.tot.normal, g.tot.especial, g.tot.acting, g.tot.menores, g.pps]);
    });
    descargarCSV("informe_figuracion.csv", filas);
  }
  const colorTerr = (terr, i) => territorioColor[terr] || terrColorAuto[terr] || PALETA[i % PALETA.length];
  function exportFigExcel() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<div style="font-weight:bold;font-size:14px">${esc(proyNombre)} — Informe de figuracion</div><div>${fecha}</div><br/>`;
    figTerrs.forEach((g) => {
      html += `<table border="1"><tr><td colspan="6" style="font-weight:bold;background:#dfe3f7">${esc(g.terr)} — Normal ${g.tot.normal} · Especial ${g.tot.especial} · Acting ${g.tot.acting} · Menores ${g.tot.menores} · Pequenas partes ${g.pps}</td></tr>`;
      html += `<tr style="background:#eef2ff"><th>Secuencia</th><th>Normal</th><th>Especial</th><th>Acting</th><th>Menores</th><th>Pequenas partes</th></tr>`;
      g.secs.forEach((s) => { html += `<tr><td style="font-weight:bold">${esc(s.uid)}</td><td>${esc(lineasTxt(s.figLineas, "normal"))}</td><td>${esc(lineasTxt(s.figLineas, "especial"))}</td><td>${esc(lineasTxt(s.figLineas, "acting"))}</td><td>${esc(lineasTxt(s.figLineas, "menores"))}</td><td>${esc(ppsTxt(s.pps))}</td></tr>`; });
      html += `</table><br/>`;
    });
    html += "</body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "informe_figuracion.xls"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportFigPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>Figuracion</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      body{font-family:Arial,Helvetica,sans-serif;padding:22px;color:#111}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
      .rc{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
      .rc-h{padding:8px 12px;color:#fff;font-weight:bold;font-size:13px}
      .rc-h small{font-weight:normal;opacity:.92}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th,td{border:1px solid #e2e8f0;padding:4px 7px;text-align:left}
      th{background:#f4f6fb}
      @media print{@page{margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} — Informe de figuracion</h1><div class="fecha">${fecha}</div>`;
    figTerrs.forEach((g, i) => {
      const col = colorTerr(g.terr, i);
      html += `<div class="rc"><div class="rc-h" style="background:${col}">${esc(g.terr)} <small>&nbsp; Normal ${g.tot.normal} · Especial ${g.tot.especial} · Acting ${g.tot.acting} · Menores ${g.tot.menores} · PP ${g.pps}</small></div>`;
      html += `<table><thead><tr><th>Secuencia</th><th>Normal</th><th>Especial</th><th>Acting</th><th>Menores</th><th>Pequenas partes</th></tr></thead><tbody>`;
      g.secs.forEach((s) => { html += `<tr><td><b>${esc(s.uid)}</b></td><td>${esc(lineasTxt(s.figLineas, "normal"))}</td><td>${esc(lineasTxt(s.figLineas, "especial"))}</td><td>${esc(lineasTxt(s.figLineas, "acting"))}</td><td>${esc(lineasTxt(s.figLineas, "menores"))}</td><td>${esc(ppsTxt(s.pps))}</td></tr>`; });
      html += `</tbody></table></div>`;
    });
    html += "</body></html>";
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }
  function exportFigDiaExcel() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<div style="font-weight:bold;font-size:14px">${esc(proyNombre)} — Figuracion por dia</div><div>${fecha}</div><br/>`;
    figDiaTerrs.forEach((g) => {
      html += `<table border="1"><tr><td colspan="3" style="font-weight:bold;background:#dfe3f7">${esc(g.terr)} — Total territorio: ${g.total}</td></tr>`;
      html += `<tr style="background:#eef2ff"><th>Dia</th><th>Figuracion</th><th>Total dia</th></tr>`;
      g.dias.forEach((d) => { html += `<tr><td>${esc(fmtFecha(d.fecha))}</td><td>${esc(d.lineas.map((l) => `${FIG_LBL[l.tipo] || l.tipo}: ${l.concepto ? l.concepto + " " : ""}${l.cant}`).join(" · "))}</td><td>${d.total}</td></tr>`; });
      html += `</table><br/>`;
    });
    html += "</body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "informe_figuracion_por_dia.xls"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportFigDiaPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>Figuracion por dia</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
      body{font-family:Arial,Helvetica,sans-serif;padding:22px;color:#111}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
      .rc{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
      .rc-h{padding:8px 12px;color:#fff;font-weight:bold;font-size:13px}
      table{border-collapse:collapse;width:100%;font-size:11px}
      th,td{border:1px solid #e2e8f0;padding:4px 7px;text-align:left}
      th{background:#f4f6fb} td.tot{text-align:right;font-weight:bold}
      @media print{@page{margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} — Figuracion por dia</h1><div class="fecha">${fecha}</div>`;
    figDiaTerrs.forEach((g, i) => {
      const col = colorTerr(g.terr, i);
      html += `<div class="rc"><div class="rc-h" style="background:${col}">${esc(g.terr)} — Total territorio: ${g.total}</div>`;
      html += `<table><thead><tr><th>Dia</th><th>Figuracion</th><th>Total dia</th></tr></thead><tbody>`;
      g.dias.forEach((d) => { html += `<tr><td><b>${esc(fmtFecha(d.fecha))}</b></td><td>${esc(d.lineas.map((l) => `${FIG_LBL[l.tipo] || l.tipo}: ${l.concepto ? l.concepto + " " : ""}${l.cant}`).join(" · "))}</td><td class="tot">${d.total}</td></tr>`; });
      html += `</tbody></table></div>`;
    });
    html += "</body></html>";
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }


  const persInfo = {}; (pers || []).forEach((pp) => { const k = String(pp.nombre || "").trim().toUpperCase(); if (k) persInfo[k] = pp; });
  const persOrd = (set) => Array.from(set).map((n) => ({ nom: n, num: persInfo[n]?.numero ?? null, actor: persInfo[n]?.actor || "", menor: !!persInfo[n]?.menor }))
    .sort((a, b) => { if (a.num == null && b.num == null) return a.nom.localeCompare(b.nom); if (a.num == null) return 1; if (b.num == null) return -1; return a.num - b.num; });
  const persTxt = (set) => persOrd(set).map((x) => `${x.num != null ? x.num + " " : ""}${x.nom}${x.actor ? " (" + x.actor + ")" : ""}`).join(", ") || "-";
  const gruposDeco = () => (agrDeco === "terr" ? decoPorTerr : decoPorLocGrp);

  function exportDecoCSV() {
    const filas = [[agrDeco === "terr" ? "Territorio" : "Localizacion", "Localizacion", "Decorado", "INT/EXT", "Espacio", "Territorio", "Caps", "Secuencias", "Paginas", "Dias", "Reparto", "Secuencias detalle"]];
    gruposDeco().forEach((g) => {
      g.locs.forEach((l) => l.decos.forEach((d) => filas.push([
        g.grupo, l.loc, d.deco, d.ieTxt, d.espTxt, d.terrTxt, d.caps.size,
        pctTxt(d.secs, totalSecs), pctPg(d.oct, totalOct), d.nDias, persTxt(d.pers), d.uidsOrd.join(" "),
      ])));
      filas.push([g.grupo + " TOTAL", "", `${g.nDecos} decorados`, "", "", "", "", pctTxt(g.secs, totalSecs), pctPg(g.oct, totalOct), g.dias, `${g.nPers} personajes`, ""]);
    });
    descargarCSV("informe_decorados.csv", filas);
  }
  function exportDecoExcel() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<div style="font-weight:bold;font-size:14px">${esc(proyNombre)} - Decorados</div><div>${fecha}</div><br/>`;
    gruposDeco().forEach((g) => {
      html += `<table border="1"><tr><td colspan="9" style="font-weight:bold;background:#dfe3f7">${esc(g.grupo)} - ${g.nDecos} decorados, ${g.secs} secs, ${fmtEighths(g.oct)} pg, ${g.dias} dias</td></tr>`;
      html += `<tr style="background:#eef2ff"><th>Localizacion</th><th>Decorado</th><th>INT/EXT</th><th>Espacio</th><th>Territorio</th><th>Caps</th><th>Secuencias</th><th>Paginas</th><th>Reparto</th></tr>`;
      g.locs.forEach((l) => l.decos.forEach((d) => {
        html += `<tr><td>${esc(l.loc)}</td><td style="font-weight:bold">${esc(d.deco)}</td><td>${esc(d.ieTxt)}</td><td>${esc(d.espTxt)}</td><td>${esc(d.terrTxt)}</td><td>${d.caps.size}</td><td>${d.secs}</td><td>${fmtEighths(d.oct)}</td><td>${esc(persTxt(d.pers))}</td></tr>`;
      }));
      html += `</table><br/>`;
    });
    html += `</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "informe_decorados.xls"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportDecoPDF() {
    const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fecha = new Date().toLocaleDateString("es-ES");
    const w = window.open("", "_blank"); if (!w) { alert("Permite las ventanas emergentes para exportar a PDF."); return; }
    let html = `<html><head><meta charset="utf-8"><title>Decorados</title><style>
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;box-sizing:border-box;
        font-variant-ligatures:none;font-feature-settings:"liga" 0;font-synthesis:none}
      body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:400;padding:20px;color:#111;text-rendering:geometricPrecision}
      h1{font-size:17px;margin:0 0 2px} .fecha{color:#666;font-size:12px;margin-bottom:16px}
      .rc{border:1px solid #cbd5e1;border-radius:8px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid}
      .rc-h{padding:8px 12px;color:#fff;font-weight:bold;font-size:13px;display:flex;justify-content:space-between;gap:10px}
      .rc-b{padding:6px 12px 10px}
      .lg{font-size:9px;font-weight:bold;letter-spacing:.09em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;padding:8px 0 4px;display:flex;justify-content:space-between}
      .dec{padding:7px 0 8px;border-bottom:1px solid #f1f5f9}
      .dh{display:flex;gap:7px;align-items:baseline;flex-wrap:wrap;font-size:12px}
      .dn{font-weight:bold;color:#0f172a}
      .pl{font-size:9px;font-weight:bold;padding:1px 6px;border-radius:10px;background:#f1f5f9;color:#334155}
      .pl.e{background:#ecfdf5;color:#065f46}
      .st{margin-left:auto;font-size:10px;color:#475569}
      .st b{color:#0f172a}
      .l{font-size:10px;margin-top:4px;color:#334155;line-height:1.5}
      .lb{font-size:8px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;margin-right:5px}
      .men{color:#dc2626;font-weight:bold}
      .sub{margin-top:8px;padding-top:6px;border-top:2px solid #e2e8f0;font-size:10px;color:#475569}
      .sub b{color:#0f172a}
      @media print{@page{size:A4 portrait;margin:12mm}}
    </style></head><body>`;
    html += `<h1>${esc(proyNombre)} - Decorados por ${agrDeco === "terr" ? "territorio" : "localizacion"}</h1><div class="fecha">${fecha} &middot; BD Prod Tools</div>`;
    gruposDeco().forEach((g, i) => {
      const col = colorTerr(agrDeco === "terr" ? g.grupo : (g.terrs && g.terrs[0]) || "-", i);
      html += `<div class="rc"><div class="rc-h" style="background:${col}"><span>${esc(g.grupo)} &mdash; ${g.nDecos} decorados</span><span>${g.secs} secs &middot; ${fmtEighths(g.oct)} pg &middot; ${g.dias} dias</span></div><div class="rc-b">`;
      g.locs.forEach((l) => {
        if (agrDeco === "terr") html += `<div class="lg"><span>${esc(l.loc)}</span><span>${l.decos.length} decorados &middot; ${l.secs} secs &middot; ${fmtEighths(l.oct)} pg</span></div>`;
        l.decos.forEach((d) => {
          html += `<div class="dec"><div class="dh"><span class="dn">${esc(d.deco)}</span><span class="pl">${esc(d.ieTxt)}</span><span class="pl e">${esc(d.espTxt)}</span>`;
          html += `<span class="st"><b>${d.secs}</b> secs &middot; <b>${fmtEighths(d.oct)}</b> pg &middot; <b>${d.nDias}</b> dias &middot; <b>${d.caps.size}</b> caps</span></div>`;
          const po = persOrd(d.pers);
          html += `<div class="l"><span class="lb">Reparto (${po.length})</span>` + (po.length ? po.map((x) => {
            const t = esc(`${x.num != null ? x.num + " " : ""}${x.nom}${x.actor ? " - " + x.actor : ""}`);
            return x.menor ? `<span class="men">${t}</span>` : t;
          }).join(" &middot; ") : "-") + `</div>`;
          html += `<div class="l"><span class="lb">Secuencias</span>${esc(d.uidsOrd.join(", ")) || "-"}</div></div>`;
        });
      });
      html += `<div class="sub"><b>${esc(g.grupo)}</b> &mdash; <b>${g.secs}</b> secuencias (${totalSecs > 0 ? Math.round((g.secs / totalSecs) * 100) : 0}%) &middot; <b>${fmtEighths(g.oct)}</b> pg (${totalOct > 0 ? Math.round((g.oct / totalOct) * 100) : 0}%) &middot; <b>${g.dias}</b> dias &middot; <b>${g.nPers}</b> personajes distintos</div>`;
      html += `</div></div>`;
    });
    html += `</body></html>`;
    w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  return (
    <div>
      <EstilosDeco />
      <div className="tabs">
        {[["localizaciones", "Localizaciones"], ["decorados", "Decorados"], ["loc_terr", "Loc. por territorio"], ["territorios", "Territorios"], ["personajes", "Personajes"], ["reparto_cat", "Reparto por categoria"], ["pers_racord", "Pers. por racord"], ["pers_terr", "Pers. por territorio"], ["racord", "Racord"], ["figuracion", "Figuracion"], ["figuracion_dia", "Fig. por dia"], ["pp_dia", "Peq. partes por dia"], ["esp_dia", "Especialistas"], ["veh_dia", "Vehiculos"], ["economico", "Economico"]].map(([k, l]) =>
          <button key={k} className={`tab ${sub === k ? "on" : ""}`} onClick={() => setSub(k)}>{l}</button>)}
      </div>

      {sub === "racord" && (
        <div className="fig-informe">
          {racordList.length === 0 ? <p className="muted">No hay racords marcados en las secuencias. Rellena el campo Racord en el desglose.</p> : (<>
            <div className="inf-csv" style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={exportRacordCSV}>CSV</button>
              <button className="btn" onClick={exportRacordExcel}>Excel</button>
              <button className="btn" onClick={exportRacordPDF}>PDF</button>
            </div>
            {racordList.map((g) => { const col = racordColor[g.racord] || "#334155";
              return (
              <div key={g.racord} className="racord-card2">
                <div className="racord-head2" style={{ background: col, color: colorTexto(col) }}>
                  <span className="racord-tit">Racord {g.racord}</span>
                  <span className="racord-sub">{g.total} secuencias · {g.porCapTxt}</span>
                </div>
                <div className="racord-body">
                  <div className="racord-blk">
                    <div className="racord-lbl2">Secuencias</div>
                    <div className="racord-secs2">{g.secs.join(", ") || "-"}</div>
                  </div>
                  <div className="racord-blk">
                    <div className="racord-lbl2">Personajes</div>
                    <div className="racord-pers2">{g.pers.length ? g.pers.map((p, i) => <span key={i} className="racord-pchip">{p.num != null && <b>{p.num}</b>} {p.nom}</span>) : "-"}</div>
                  </div>
                  <div className="racord-blk">
                    <div className="racord-lbl2">Localizaciones</div>
                    <div className="racord-locs2">
                      {g.locs.length === 0 ? <span className="muted small">-</span> : g.locs.map((l, i) => (
                        <div key={i} className="racord-loc2"><b>{l.loc}</b>{l.decos.length > 0 && <div className="racord-decos2">{l.decos.map((d, j) => <span key={j} className="racord-deco2">{d}</span>)}</div>}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ); })}
          </>)}
        </div>
      )}

      {sub === "pers_racord" && (() => {
        const pct = (n, tot) => tot > 0 ? `${n} / ${Math.round((n / tot) * 100)}%` : `${n}`;
        const cols = ["No", "Personaje", "Secuencias", ...racords.map((r) => `Racord ${r}`)];
        const totales = ["", "", totalSecs, ...racords.map((r) => `${racordSecs[r]} / ${Math.round((racordSecs[r] / totalSecs) * 100)}%`)];
        const fila = (x) => [x.num, x.nombre, x.secs, ...racords.map((r) => pct(x.secsRacord?.[r] || 0, x.secs))];
        return racords.length === 0
          ? <p className="muted">No hay racords marcados en las secuencias. Rellena el campo Racord en el desglose.</p>
          : <InformeTabla titulo="Informe de personajes por racord" proyNombre={proyNombre}
            cols={cols} totales={totales}
            rows={persRows.map(fila)}
            onCSV={() => descargarCSV("informe_personajes_racord.csv", [cols, ...persRows.map(fila), totales])} />;
      })()}

      {sub === "reparto_cat" && <RepartoPorCategoria persRows={persRows} proyNombre={proyNombre} totalSecs={totalSecs} totalDiasRod={totalDiasRod} />}

      {sub === "pers_terr" && (terrRodaje.length === 0
        ? <p className="muted">No hay territorios con dias de rodaje en el plan.</p>
        : <PersPorTerritorio persRows={persRows} terrRodaje={terrRodaje} diasRodPorTerr={diasRodPorTerr} totalDiasRod={totalDiasRod} proyNombre={proyNombre} colorTerr={colorTerr} colorTexto={colorTexto} />)}

      {sub === "figuracion" && (
        <div className="fig-informe">
          {figTerrs.length === 0 ? <p className="muted">No hay figuracion ni pequenas partes registradas.</p> : (<>
            <div className="inf-csv" style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={exportFigCSV}>CSV</button>
              <button className="btn" onClick={exportFigExcel}>Excel</button>
              <button className="btn" onClick={exportFigPDF}>PDF</button>
            </div>
            {figTerrs.map((g, i) => { const col = colorTerr(g.terr, i);
              return (
              <div key={g.terr} className="racord-card2">
                <div className="racord-head2" style={{ background: col, color: colorTexto(col) }}>
                  <span className="racord-tit">{g.terr}</span>
                  <span className="racord-sub">Normal: {g.tot.normal} · Especial: {g.tot.especial} · Acting: {g.tot.acting} · Menores: {g.tot.menores} · Pequenas partes: {g.pps}</span>
                </div>
                <div className="racord-body">
                  <table className="inf-tabla">
                    <thead><tr><th>Secuencia</th><th>Normal</th><th>Especial</th><th>Acting</th><th>Menores</th><th>Pequenas partes</th></tr></thead>
                    <tbody>
                      {g.secs.map((s) => (
                        <tr key={s.uid}>
                          <td><b>{s.uid}</b></td>
                          <td>{lineasTxt(s.figLineas, "normal")}</td>
                          <td>{lineasTxt(s.figLineas, "especial")}</td>
                          <td>{lineasTxt(s.figLineas, "acting")}</td>
                          <td>{lineasTxt(s.figLineas, "menores")}</td>
                          <td>{ppsTxt(s.pps)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ); })}
          </>)}
        </div>
      )}

      {sub === "economico" && (
        <div className="fig-informe">
          {terrRodaje.length === 0 ? <p className="muted">Necesitas el plan de trabajo hecho para calcular el presupuesto.</p> : (<>
            <p className="muted small">Presupuesto de figuracion y pequenas partes. Introduce las tarifas de cada territorio y el calculo se actualiza solo. El coordinador se calcula por tramos: hasta 10 figurantes ninguno, y uno mas por cada 50 a partir de 11 (11 a 50 uno, 51 a 100 dos, 101 a 150 tres...).</p>

            <div className="inf-csv" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button className="btn" onClick={exportEcoCSV}>CSV</button>
              <button className="btn" onClick={exportEcoExcel}>Excel</button>
              <button className="btn" onClick={exportEcoPDF}>PDF</button>
            </div>

            <div className="eco-tarifas">
              <div className="eco-tit">Tarifas por territorio (€ por jornada)</div>
              <div className="rep-table">
                <table>
                  <thead><tr><th>Territorio</th>{TARIFA_CAMPOS.map((c) => <th key={c.k} style={{ textAlign: "right" }}>{c.lbl}</th>)}</tr></thead>
                  <tbody>
                    {terrRodaje.map((t) => (
                      <tr key={t}>
                        <td><b>{t}</b></td>
                        {TARIFA_CAMPOS.map((c) => (
                          <td key={c.k} style={{ textAlign: "right" }}>
                            <input className="eco-in" defaultValue={tarifas[t]?.[c.k] ?? ""} placeholder="0" key={t + c.k + (tarifas[t]?.[c.k] ?? "")}
                              onBlur={(e) => guardarTarifa(t, c.k, e.target.value)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="eco-total-box">
              <div className="eco-tit">Coste por territorio</div>
              <div className="rep-table">
                <table>
                  <thead><tr><th>Territorio</th><th style={{ textAlign: "right" }}>Dias</th>{FIG_ORDEN.map((t) => <th key={t} style={{ textAlign: "right" }}>{FIG_LBL[t]}</th>)}<th style={{ textAlign: "right" }}>Total fig.</th><th style={{ textAlign: "right" }}>Pruebas</th><th style={{ textAlign: "right" }}>Coordinador</th><th style={{ textAlign: "right" }}>Peq. partes</th><th style={{ textAlign: "right" }}>TOTAL</th></tr></thead>
                  <tbody>
                    {ecoTerrs.map((g) => (
                      <tr key={g.terr}>
                        <td><b>{g.terr}</b></td>
                        <td style={{ textAlign: "right" }}>{g.nDias}</td>
                        {FIG_ORDEN.map((t) => <td key={t} style={{ textAlign: "right" }}>{g.nTipoT[t] > 0 ? <>{eur(g.cTipoT[t])}<div className="eco-cant">{g.nTipoT[t]} fig.</div></> : "-"}</td>)}
                        <td style={{ textAlign: "right" }}>{eur(g.cFig)}</td>
                        <td style={{ textAlign: "right" }}>{eur(g.cPruebas)}<div className="eco-cant">{g.nPruebas}</div></td>
                        <td style={{ textAlign: "right" }}>{eur(g.cCoord)}<div className="eco-cant">{g.nCo} jorn.</div></td>
                        <td style={{ textAlign: "right" }}>{eur(g.cPP)}<div className="eco-cant">{g.nPP}</div></td>
                        <td style={{ textAlign: "right" }}><b>{eur(g.total)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td><b>TOTAL</b></td>
                      <td style={{ textAlign: "right" }}>{ecoTerrs.reduce((s2, g) => s2 + g.nDias, 0)}</td>
                      {FIG_ORDEN.map((t) => <td key={t} style={{ textAlign: "right" }}>{eur(ecoTerrs.reduce((s2, g) => s2 + g.cTipoT[t], 0))}</td>)}
                      <td style={{ textAlign: "right" }}>{eur(ecoTerrs.reduce((s2, g) => s2 + g.cFig, 0))}</td>
                      <td style={{ textAlign: "right" }}>{eur(ecoTerrs.reduce((s2, g) => s2 + g.cPruebas, 0))}</td>
                      <td style={{ textAlign: "right" }}>{eur(ecoTerrs.reduce((s2, g) => s2 + g.cCoord, 0))}</td>
                      <td style={{ textAlign: "right" }}>{eur(ecoTerrs.reduce((s2, g) => s2 + g.cPP, 0))}</td>
                      <td style={{ textAlign: "right" }}><b>{eur(ecoTotal)}</b></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="eco-proy">
              <div className="eco-tit">Proyeccion de la serie</div>
              <div className="eco-proy-row">
                <label>Capitulos totales de la serie
                  <input className="eco-in" defaultValue={proy.caps_serie ?? ""} placeholder="ej. 8" key={"cs" + (proy.caps_serie ?? "")} onBlur={(e) => guardarProy("caps_serie", e.target.value)} />
                </label>
                <label>Tanto alzado para lo que falta (€)
                  <input className="eco-in" defaultValue={proy.fig_alzado ?? ""} placeholder="opcional" key={"fa" + (proy.fig_alzado ?? "")} onBlur={(e) => guardarProy("fig_alzado", e.target.value)} />
                </label>
              </div>
              {capsSerie > 0 && (
                <div className="rep-table" style={{ marginBottom: 14 }}>
                  <table>
                    <thead><tr><th>Territorio</th><th style={{ textAlign: "right" }}>Desglosado ({capsDesglosados} cap.)</th><th style={{ textAlign: "right" }}>Media / capitulo</th><th style={{ textAlign: "right" }}>Proyectado ({capsSerie} cap.)</th></tr></thead>
                    <tbody>
                      {ecoProyTerr.map((g) => (
                        <tr key={g.terr}>
                          <td><b>{g.terr}</b></td>
                          <td style={{ textAlign: "right" }}>{eur(g.actual)}</td>
                          <td style={{ textAlign: "right" }}>{eur(g.mediaCap)}</td>
                          <td style={{ textAlign: "right" }}><b>{eur(g.proyectado)}</b></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td><b>TOTAL</b></td>
                        <td style={{ textAlign: "right" }}>{eur(ecoTotal)}</td>
                        <td style={{ textAlign: "right" }}>{eur(mediaCap)}</td>
                        <td style={{ textAlign: "right" }}><b>{eur(proyMedia)}</b></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <div className="eco-cards">
                <div className="eco-card"><span className="eco-num">{eur(ecoTotal)}</span><span className="eco-lab">Desglosado ({capsDesglosados} cap.)</span></div>
                <div className="eco-card"><span className="eco-num">{eur(mediaCap)}</span><span className="eco-lab">Media por capitulo</span></div>
                {capsSerie > 0 && <div className="eco-card eco-card-proy"><span className="eco-num">{eur(proyMedia)}</span><span className="eco-lab">Proyeccion serie ({capsSerie} cap.)</span><span className="eco-sub">{capsFaltan} capitulos estimados por media</span></div>}
                {alzado > 0 && <div className="eco-card eco-card-proy"><span className="eco-num">{eur(proyAlzado)}</span><span className="eco-lab">Con tanto alzado</span><span className="eco-sub">{eur(ecoTotal)} + {eur(alzado)}</span></div>}
              </div>
            </div>

            {ecoTerrs.map((g, i) => { const col = colorTerr(g.terr, i);
              return (
              <div key={g.terr} className="racord-card2">
                <div className="racord-head2" style={{ background: col, color: colorTexto(col) }}>
                  <span className="racord-tit">{g.terr}</span>
                  <span className="racord-sub">{eur(g.total)} · {g.nDias} dias · {g.nFig} figurantes · {g.nPruebas} pruebas · {g.nCo} jornadas de coordinador · {g.nPP} peq. partes</span>
                </div>
                <div className="racord-body">
                  <table className="inf-tabla">
                    <thead><tr><th>Dia</th>{FIG_ORDEN.map((t) => <th key={t} style={{ textAlign: "right" }}>{FIG_LBL[t]}</th>)}<th style={{ textAlign: "right" }}>Coste fig.</th><th style={{ textAlign: "right" }}>Pruebas</th><th style={{ textAlign: "right" }}>Coord.</th><th style={{ textAlign: "right" }}>PP</th><th style={{ textAlign: "right" }}>Total dia</th></tr></thead>
                    <tbody>
                      {g.dias.map((d, j) => (
                        <tr key={j}>
                          <td><b>{fmtFecha(d.fecha)}</b></td>
                          {FIG_ORDEN.map((t) => <td key={t} style={{ textAlign: "right" }}>{d.porTipo[t] > 0 ? <>{d.porTipo[t]}<div className="eco-cant">{eur(d.cTipo[t])}</div></> : "-"}</td>)}
                          <td style={{ textAlign: "right" }}>{eur(d.cFig)}</td>
                          <td style={{ textAlign: "right" }}>{d.nPruebas > 0 ? `${d.nPruebas} · ${eur(d.cPruebas)}` : "-"}</td>
                          <td style={{ textAlign: "right" }}>{d.nCo > 0 ? `${d.nCo} · ${eur(d.cCoord)}` : "-"}</td>
                          <td style={{ textAlign: "right" }}>{d.nPP > 0 ? `${d.nPP} · ${eur(d.cPP)}` : "-"}</td>
                          <td style={{ textAlign: "right" }}><b>{eur(d.total)}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ); })}
          </>)}
        </div>
      )}

      {(sub === "esp_dia" || sub === "veh_dia") && (() => {
        const esEsp = sub === "esp_dia";
        const terrs = esEsp ? espDiaTerrs : vehDiaTerrs;
        const lbl = esEsp ? "Especialistas" : "Vehiculos";
        const arch = esEsp ? "informe_especialistas" : "informe_vehiculos";
        const chip = esEsp ? "chip-esp" : "chip-veh";
        const chipPdf = esEsp ? { bg: "#fee2e2", fg: "#991b1b" } : { bg: "#dbeafe", fg: "#1e40af" };
        return (
          <div className="fig-informe">
            {terrs.length === 0 ? <p className="muted">No hay {lbl.toLowerCase()} en dias de rodaje del plan. Desglosa la categoria "{lbl}" y coloca esas secuencias en el plan.</p> : (<>
              <p className="muted small">{lbl} necesarios por dia de rodaje, con las secuencias en las que aparecen. Un mismo elemento que sale en varias secuencias del mismo dia cuenta una sola vez. El total del territorio es la suma de las jornadas.</p>
              <div className="inf-csv" style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => exportCatCSV(terrs, arch, lbl)}>CSV</button>
                <button className="btn" onClick={() => exportCatExcel(terrs, arch, `Informe de ${lbl.toLowerCase()}`, lbl)}>Excel</button>
                <button className="btn" onClick={() => exportCatPDF(terrs, `Informe de ${lbl.toLowerCase()}`, lbl, chipPdf)}>PDF</button>
              </div>
              {terrs.map((g, i) => { const col = colorTerr(g.terr, i);
                return (
                <div key={g.terr} className="racord-card2">
                  <div className="racord-head2" style={{ background: col, color: colorTexto(col) }}>
                    <span className="racord-tit">{g.terr}</span>
                    <span className="racord-sub">Total territorio: {g.total} jornadas · {g.distintas} {lbl.toLowerCase()} distintos</span>
                  </div>
                  <div className="racord-body">
                    <table className="inf-tabla">
                      <thead><tr><th style={{ width: 100 }}>Dia</th><th>{lbl} (secuencias)</th><th style={{ textAlign: "right", width: 80 }}>Total dia</th></tr></thead>
                      <tbody>
                        {g.dias.map((d, j) => (
                          <tr key={j}>
                            <td><b>{fmtFecha(d.fecha)}</b></td>
                            <td>{d.items.map((x, k) => (
                              <div key={k} className="cat-linea">
                                <span className={`cat-chip ${chip}`}>{x.nombre}</span>
                                {x.secs.length > 0 && <span className="cat-secs">{x.secs.join(", ")}</span>}
                              </div>
                            ))}</td>
                            <td style={{ textAlign: "right" }}><b>{d.total}</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ); })}
            </>)}
          </div>
        );
      })()}

      {sub === "pp_dia" && (
        <div className="fig-informe">
          {ppDiaTerrs.length === 0 ? <p className="muted">No hay pequenas partes en dias de rodaje del plan. Desglosa pequenas partes y coloca esas secuencias en el plan.</p> : (<>
            <p className="muted small">Pequenas partes necesarias por dia de rodaje. Una misma pequena parte que aparece en varias secuencias del mismo dia cuenta una sola vez. El total del territorio es la suma de las jornadas.</p>
            <div className="inf-csv" style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={exportPPDiaCSV}>CSV</button>
              <button className="btn" onClick={exportPPDiaExcel}>Excel</button>
              <button className="btn" onClick={exportPPDiaPDF}>PDF</button>
            </div>
            {ppDiaTerrs.map((g, i) => { const col = colorTerr(g.terr, i);
              return (
              <div key={g.terr} className="racord-card2">
                <div className="racord-head2" style={{ background: col, color: colorTexto(col) }}>
                  <span className="racord-tit">{g.terr}</span>
                  <span className="racord-sub">Total territorio: {g.total} · {g.distintas} pequenas partes distintas</span>
                </div>
                <div className="racord-body">
                  <table className="inf-tabla">
                    <thead><tr><th>Dia</th><th>Pequenas partes</th><th>Total dia</th></tr></thead>
                    <tbody>
                      {g.dias.map((d, j) => (
                        <tr key={j}>
                          <td><b>{fmtFecha(d.fecha)}</b></td>
                          <td>{d.pps.map((x, k) => <span key={k} className="pp-chip">{x.num != null && <b>PP{x.num}</b>} {x.nombre}</span>)}</td>
                          <td><b>{d.total}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ); })}
          </>)}
        </div>
      )}

      {sub === "figuracion_dia" && (
        <div className="fig-informe">
          {figDiaTerrs.length === 0 ? <p className="muted">No hay figuracion en dias de rodaje del plan. Coloca secuencias con figuracion en el plan primero.</p> : (<>
            <p className="muted small">Figuracion necesaria por dia de rodaje. Un mismo concepto que se repite en varias secuencias del mismo dia cuenta una sola vez (el mayor). El total del territorio es la suma de los totales por dia.</p>
            <div className="inf-csv" style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={exportFigDiaCSV}>CSV</button>
              <button className="btn" onClick={exportFigDiaExcel}>Excel</button>
              <button className="btn" onClick={exportFigDiaPDF}>PDF</button>
            </div>
            {figDiaTerrs.map((g, i) => { const col = colorTerr(g.terr, i);
              return (
              <div key={g.terr} className="racord-card2">
                <div className="racord-head2" style={{ background: col, color: colorTexto(col) }}>
                  <span className="racord-tit">{g.terr}</span>
                  <span className="racord-sub">Total territorio: {g.total}{FIG_ORDEN.filter((t) => g.totTipo[t]).map((t) => ` · ${FIG_LBL[t]}: ${g.totTipo[t]}`).join("")}</span>
                </div>
                <div className="racord-body">
                  <table className="inf-tabla">
                    <thead><tr><th>Dia</th><th>Figuracion por tipo</th><th>Total dia</th></tr></thead>
                    <tbody>
                      {g.dias.map((d, i) => (
                        <tr key={i}>
                          <td><b>{fmtFecha(d.fecha)}</b></td>
                          <td>{d.porTipo.map((gt, j) => (
                            <div key={j} className={`figdia-tipo ft-${gt.tipo}`}>
                              <span className="figdia-tlbl">{FIG_LBL[gt.tipo]}</span>
                              <span className="figdia-tsub">{gt.subtotal}</span>
                              <span className="figdia-tdet">{gt.lineas.map((l, k) => `${l.concepto || "(sin concepto)"} ${l.cant}`).join(" · ")}</span>
                            </div>
                          ))}</td>
                          <td><b>{d.total}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ); })}
          </>)}
        </div>
      )}

      {sub === "localizaciones" && <InformeTabla titulo="Informe de localizaciones" proyNombre={proyNombre}
        cols={["Localizacion", "Territorio", "Espacio", "Secuencias", "Paginas", "Dias rodaje", ...terrRodaje.map((t) => `Dias ${t}`)]}
        totales={["TOTAL", "", "", totalSecs, fmtEighths(totalOct), totalDiasRod, ...terrRodaje.map((t) => diasRodPorTerr[t] || 0)]}
        rows={locRows.map((x) => [x.loc, x.terrTxt, x.espTxt, pctTxt(x.secs, totalSecs), pctPg(x.oct, totalOct), pctTxt(x.dias, totalDiasRod), ...terrRodaje.map((t) => pctTxt(x.diasTerr?.[t]?.size || 0, diasRodPorTerr[t] || 0))])}
        onCSV={() => descargarCSV("informe_localizaciones.csv", [["Localizacion", "Territorio", "Espacio", "Secuencias", "Paginas", "Dias rodaje", ...terrRodaje.map((t) => `Dias ${t}`)], ...locRows.map((x) => [x.loc, x.terrTxt, x.espTxt, pctTxt(x.secs, totalSecs), pctPg(x.oct, totalOct), pctTxt(x.dias, totalDiasRod), ...terrRodaje.map((t) => pctTxt(x.diasTerr?.[t]?.size || 0, diasRodPorTerr[t] || 0))]), ["TOTAL", "", "", totalSecs, fmtEighths(totalOct), totalDiasRod, ...terrRodaje.map((t) => diasRodPorTerr[t] || 0)]])} />}

      {sub === "decorados" && (
        <div className="fig-informe">
          <style>{`
            .dgr-loc{ font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#64748b;
              padding:10px 0 5px; border-bottom:1px solid #e2e8f0; display:flex; gap:9px; align-items:baseline; }
            .dgr-loc .n{ margin-left:auto; font-weight:400; letter-spacing:0; text-transform:none; font-size:11px; color:#94a3b8; }
            .dgr-dec{ padding:9px 0 10px; border-bottom:1px solid #f1f5f9; }
            .dgr-dec:last-child{ border-bottom:0; }
            .dgr-h{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
            .dgr-n{ font-weight:700; font-size:13px; color:#0f172a; }
            .dgr-st{ margin-left:auto; display:flex; gap:11px; font-size:11px; color:#52525b; flex-wrap:wrap; }
            .dgr-st b{ color:#0f172a; }
            .dgr-st .pc{ color:#94a3b8; }
            .dgr-l{ font-size:11px; margin-top:6px; line-height:2; }
            .dgr-lbl{ color:#94a3b8; font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:.06em; margin-right:5px; }
            .dgr-per{ display:inline-flex; align-items:center; gap:4px; background:#fff; border:1px solid #e4e4e7; border-radius:5px;
              padding:1px 7px 1px 3px; font-size:11px; margin-right:3px; }
            .dgr-per i{ font-style:normal; background:#1e293b; color:#fff; font-size:9px; font-weight:700; border-radius:3px; padding:1px 4px; min-width:16px; text-align:center; }
            .dgr-per.men i{ background:#dc2626; }
            .dgr-per .act{ color:#94a3b8; font-size:10px; }
            .dgr-sub{ margin-top:10px; padding-top:8px; border-top:2px solid #e2e8f0; display:flex; gap:14px; font-size:11px; color:#475569; flex-wrap:wrap; }
            .dgr-sub b{ color:#0f172a; }
          `}</style>
          <div className="rep-bar" style={{ marginBottom: 12 }}>
            <span className="muted small" style={{ fontWeight: 600 }}>Agrupar por:</span>
            <div className="dcx-ord">
              <button className={agrDeco === "terr" ? "on" : ""} onClick={() => setAgrDeco("terr")}>Territorio</button>
              <button className={agrDeco === "loc" ? "on" : ""} onClick={() => setAgrDeco("loc")}>Localizacion</button>
            </div>
            <span className="muted small">{decoRows.length} decorados</span>
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={exportDecoCSV}>CSV</button>
            <button className="btn" onClick={exportDecoExcel}>Excel</button>
            <button className="btn" onClick={exportDecoPDF}>PDF</button>
          </div>
          {gruposDeco().length === 0 ? <p className="muted">Todavia no hay decorados.</p> : gruposDeco().map((g, i) => {
            const col = colorTerr(agrDeco === "terr" ? g.grupo : (g.terrs && g.terrs[0]) || "-", i);
            return (
              <div key={g.grupo} className="racord-card2">
                <div className="racord-head2" style={{ background: col, color: colorTexto(col) }}>
                  <span className="racord-tit">{g.grupo}</span>
                  <span className="racord-sub">{g.nDecos} decorados{agrDeco === "terr" ? ` \u00b7 ${g.locs.length} localizaciones` : ""} \u00b7 {g.secs} secuencias \u00b7 {fmtEighths(g.oct)} pg \u00b7 {g.dias} dias</span>
                </div>
                <div className="racord-body">
                  {g.locs.map((l) => (
                    <div key={l.loc}>
                      {agrDeco === "terr" && (
                        <div className="dgr-loc"><span>{l.loc}</span><span className="n">{l.decos.length} decorados \u00b7 {l.secs} secs \u00b7 {fmtEighths(l.oct)} pg</span></div>
                      )}
                      {l.decos.map((d) => {
                        const po = persOrd(d.pers);
                        return (
                          <div key={d.deco} className="dgr-dec">
                            <div className="dgr-h">
                              <span className={`dgr-n ${d.deco === "(sin decorado)" ? "muted" : ""}`}>{d.deco}</span>
                              <span className="dcx-pill dcx-ie">{d.ieTxt}</span>
                              <span className={`dcx-pill ${d.espTxt === "-" ? "dcx-off" : "dcx-esp"}`}>{d.espTxt === "-" ? "sin espacio" : d.espTxt}</span>
                              {agrDeco === "loc" && <span className="dcx-pill dcx-off">{d.terrTxt}</span>}
                              <span className="dgr-st">
                                <span><b>{d.secs}</b> secs <span className="pc">{totalSecs > 0 ? Math.round((d.secs / totalSecs) * 100) : 0}%</span></span>
                                <span><b>{fmtEighths(d.oct)}</b> pg <span className="pc">{totalOct > 0 ? Math.round((d.oct / totalOct) * 100) : 0}%</span></span>
                                <span><b>{d.nDias}</b> dias</span>
                                <span><b>{d.caps.size}</b> caps</span>
                              </span>
                            </div>
                            <div className="dgr-l">
                              <span className="dgr-lbl">Reparto ({po.length})</span>
                              {po.length === 0 ? <span className="muted">-</span> : po.map((x) => (
                                <span key={x.nom} className={`dgr-per ${x.menor ? "men" : ""}`}>
                                  <i>{x.num == null ? "\u2014" : x.num}</i>{x.nom}{x.actor && <span className="act">\u00b7 {x.actor}</span>}
                                </span>
                              ))}
                            </div>
                            <div className="dgr-l">
                              <span className="dgr-lbl">Secuencias</span>
                              {d.uidsOrd.length === 0 ? <span className="muted">-</span> : d.uidsOrd.map((u) => <span key={u}><button className="sec-link" title="Ir al desglose de la secuencia" onClick={() => irASecuencia && irASecuencia(u, "informes")}>{u}</button>{" "}</span>)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div className="dgr-sub">
                    <span><b>{g.grupo}</b></span>
                    <span><b>{g.secs}</b> secuencias \u00b7 {totalSecs > 0 ? Math.round((g.secs / totalSecs) * 100) : 0}%</span>
                    <span><b>{fmtEighths(g.oct)}</b> pg \u00b7 {totalOct > 0 ? Math.round((g.oct / totalOct) * 100) : 0}%</span>
                    <span><b>{g.dias}</b> dias de rodaje</span>
                    <span><b>{g.nPers}</b> personajes distintos</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sub === "loc_terr" && (
        <div className="fig-informe">
          {locPorTerrList.length === 0 ? <p className="muted">No hay secuencias con territorio marcado.</p> : (<>
            <p className="muted small">Localizaciones y decorados de cada territorio, con el numero de secuencias y paginas. Si una localizacion tiene decorados en distintos territorios, aparece en ambos con solo los decorados de ese territorio.</p>
            <div className="inf-csv" style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={exportLocTerrCSV}>CSV</button>
              <button className="btn" onClick={exportLocTerrExcel}>Excel</button>
              <button className="btn" onClick={exportLocTerrPDF}>PDF</button>
            </div>
            {locPorTerrList.map((g, i) => { const col = colorTerr(g.terr, i);
              return (
              <div key={g.terr} className="racord-card2">
                <div className="racord-head2" style={{ background: col, color: colorTexto(col) }}>
                  <span className="racord-tit">{g.terr}</span>
                  <span className="racord-sub">{g.nLocs} localizaciones · {g.nDecos} decorados · {g.totSecs} secuencias · {fmtEighths(g.totOct)} pg</span>
                </div>
                <div className="racord-body">
                  <table className="inf-tabla">
                    <thead><tr><th>Localizacion</th><th>Decorado</th><th style={{ textAlign: "right" }}>Secuencias</th><th style={{ textAlign: "right" }}>Paginas</th></tr></thead>
                    <tbody>
                      {g.locs.map((l) => [
                        ...l.decos.map((d, j) => (
                          <tr key={l.loc + d.dec} className={j === 0 ? "loc-sep" : ""}>
                            {j === 0 && <td rowSpan={l.decos.length} className="loc-name-cell"><b>{l.loc}</b></td>}
                            <td className={d.dec === "(sin decorado)" ? "muted" : ""}>{d.dec}</td>
                            <td style={{ textAlign: "right" }}>{d.secs} / {totalSecs > 0 ? Math.round((d.secs / totalSecs) * 100) : 0}%</td>
                            <td style={{ textAlign: "right" }}>{fmtEighths(d.oct)} / {totalOct > 0 ? Math.round((d.oct / totalOct) * 100) : 0}%</td>
                          </tr>
                        )),
                        l.decos.length > 1 ? (
                          <tr key={l.loc + "__sub"} className="loc-subtot">
                            <td colSpan={2} style={{ textAlign: "right", fontStyle: "italic" }}>Subtotal {l.loc}</td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{l.secs} / {totalSecs > 0 ? Math.round((l.secs / totalSecs) * 100) : 0}%</td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{fmtEighths(l.oct)} / {totalOct > 0 ? Math.round((l.oct / totalOct) * 100) : 0}%</td>
                          </tr>
                        ) : null,
                      ])}
                    </tbody>
                    <tfoot>
                      <tr className="loc-sep">
                        <td colSpan={2}><b>TOTAL {g.terr}</b></td>
                        <td style={{ textAlign: "right" }}><b>{g.totSecs} / {totalSecs > 0 ? Math.round((g.totSecs / totalSecs) * 100) : 0}%</b></td>
                        <td style={{ textAlign: "right" }}><b>{fmtEighths(g.totOct)} / {totalOct > 0 ? Math.round((g.totOct / totalOct) * 100) : 0}%</b></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ); })}
          </>)}
        </div>
      )}

      {sub === "territorios" && (
        <div className="fig-informe">
          {terrDataList.length === 0 ? <p className="muted">No hay territorios marcados en las secuencias.</p> : (<>
            <div className="inf-csv" style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={exportTerrCSV}>CSV</button>
              <button className="btn" onClick={exportTerrExcel}>Excel</button>
              <button className="btn" onClick={exportTerrPDF}>PDF</button>
            </div>
            {terrDataList.map((g) => { const col = terrColorAuto[g.terr] || "#334155";
              return (
              <div key={g.terr} className="racord-card2">
                <div className="racord-head2" style={{ background: col, color: colorTexto(col) }}>
                  <span className="racord-tit">{g.terr}</span>
                  <span className="racord-sub">{pctTxt(g.totalSecs, totalSecs)} sec · {pctPg(g.oct, totalOct)} pg · {pctTxt(g.dias, totalDiasRod)} dias rodaje</span>
                </div>
                <div className="racord-body">
                  <div className="racord-blk">
                    <div className="racord-lbl2">Personajes</div>
                    <div className="racord-pers2">{g.pers.length ? g.pers.map((p, i) => <span key={i} className="racord-pchip">{p.num != null && <b>{p.num}</b>} {p.nom}</span>) : "-"}</div>
                  </div>
                  <div className="racord-blk">
                    <div className="racord-lbl2">Secuencias{g.porCapTxt ? ` (${g.porCapTxt})` : ""}</div>
                    <div className="racord-secs2">{g.secs.join(", ") || "-"}</div>
                  </div>
                  <div className="racord-blk">
                    <div className="racord-lbl2">Localizaciones</div>
                    <div className="racord-locs2">
                      {g.locs.length === 0 ? <span className="muted small">-</span> : g.locs.map((l, i) => (
                        <div key={i} className="racord-loc2"><b>{l.loc} · {l.secs} sec · {fmtEighths(l.oct)} pg</b>{l.decos.length > 0 && <div className="racord-decos2">{l.decos.map((d, j) => <span key={j} className="racord-deco2">{d}</span>)}</div>}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ); })}
          </>)}
        </div>
      )}

      {sub === "personajes" && (() => {
        const pct = (n, tot) => tot > 0 ? `${n} / ${Math.round((n / tot) * 100)}%` : `${n}`;
        const totDiasTerr = terrRodaje.map((t) => diasRodPorTerr[t] || 0);
        const cols = ["No", "Personaje", "CAT", "Edad", "Nacion", "Descripcion", "Secuencias", "Dias rodaje", ...terrRodaje.map((t) => `Dias ${t}`)];
        const totales = ["", "", "", "", "", "", totalSecs, totalDiasRod, ...totDiasTerr];
        const fila = (x) => [x.num, x.nombre, abrevCat(x.categoria) || "-", x.edad || "-", x.nacionalidad || "-", x.descripcion || "-", pct(x.secs, totalSecs), pct(x.dias, totalDiasRod), ...terrRodaje.map((t, i) => pct(x.diasTerr[t]?.size || 0, totDiasTerr[i]))];
        return <InformeTabla titulo="Informe de personajes" proyNombre={proyNombre}
          cols={cols} totales={totales}
          rows={persRows.map(fila)}
          onCSV={() => descargarCSV("informe_personajes.csv", [cols, ...persRows.map(fila), totales])} />;
      })()}
    </div>
  );
}

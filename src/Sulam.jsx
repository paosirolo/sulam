import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ============================================================
// CONFIGURAZIONE SUPABASE
// Sostituisci con le tue credenziali da supabase.com > Settings > API
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ============================================================
// SUPABASE CLIENT (minimal, no dependency needed)
// ============================================================
const supabase = {
  from: (table) => ({
    select: (cols = "*") => {
      let url = `${SUPABASE_URL}/rest/v1/${table}?select=${cols}`;
      let headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      };
      let filters = [];
      let orderStr = "";
      let rangeHeader = null;

      const builder = {
        eq: (col, val) => { filters.push(`${col}=eq.${encodeURIComponent(val)}`); return builder; },
        ilike: (col, val) => { filters.push(`${col}=ilike.${encodeURIComponent(val)}`); return builder; },
        in: (col, vals) => {
          const list = Array.isArray(vals) ? vals.join(",") : vals;
          filters.push(`${col}=in.(${encodeURIComponent(list)})`);
          return builder;
        },
        order: (col, { ascending = true } = {}) => { orderStr = `&order=${col}.${ascending ? "asc" : "desc"}`; return builder; },
        range: (from, to) => { rangeHeader = `${from}-${to}`; return builder; },
        single: () => builder,
        update: (data) => ({
          eq: (col, val) => fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify(data),
          }).then(r => r.json()),
        }),
        insert: (data) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        }).then(r => r.json()),
        then: (resolve, reject) => {
          const finalUrl = url + (filters.length ? "&" + filters.join("&") : "") + orderStr;
          const fetchHeaders = { ...headers };
          if (rangeHeader) fetchHeaders["Range"] = rangeHeader;
          return fetch(finalUrl, { headers: fetchHeaders })
            .then(r => r.json())
            .then(data => resolve({ data, error: null }))
            .catch(err => reject({ data: null, error: err }));
        },
      };
      return builder;
    },
    update: (data) => ({
      eq: (col, val) => fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }).then(r => ({ data: null, error: r.ok ? null : r.statusText })),
    }),
    insert: (data) => ({
      then: (resolve) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(Array.isArray(data) ? data : [data]),
      }).then(r => resolve({ data: null, error: r.ok ? null : r.statusText })),
    }),
  }),
  rpc: (fn, params) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  }).then(r => ({ error: r.ok ? null : r.statusText })),
};

// ============================================================
// MOCK DATA per demo (rimosso quando connetti Supabase)
// ============================================================
const MOCK_CANTI = [
  { id: 1, Title: "Laudato Si'", Content: "Laudato si', mi' Signore\nCon tutte le tue creature\nSpecialmente messor lo frate sole\nLo quale è iorno, et allumini noi per lui\n\nEt ellu è bellu e radiante cum grande splendore\nDe te, Altissimo, porta significatione\n\nLaudato si', mi' Signore\nPer sora luna e le stelle\nIn celu l'ài formate clarite et pretiose et belle", Album: "Cantico delle Creature", Autori: "San Francesco d'Assisi", Anno: 2020, Tempo_Liturgico: "Tempo Ordinario", Momento_Messa: "Offertorio", Genere: "Lode", link_ascolto: "", view_count: 42 },
  { id: 2, Title: "Alleluia - Pasqua", Content: "Alleluia, alleluia\nCristo è risorto, alleluia\nEsultiamo e rallegriamoci\nAlleluia, alleluia\n\nQuesto è il giorno che ha fatto il Signore\nEsultiamo e rallegriamoci\nAlleluia, alleluia", Album: "Canti Pasquali", Autori: "Comunità di Taizé", Anno: 2018, Tempo_Liturgico: "Tempo di Pasqua", Momento_Messa: "Vangelo", Genere: "Acclamazione", link_ascolto: "https://youtube.com", view_count: 128 },
  { id: 3, Title: "Vieni Santo Spirito", Content: "Vieni Santo Spirito\nManda a noi dal cielo\nUn raggio della tua luce\n\nVieni padre dei poveri\nVieni datore dei doni\nVieni luce dei cuori\n\nConsolatore perfetto\nOspite dolce dell'anima\nDolcissimo sollievo", Album: "Pentecoste", Autori: "Liturgia delle Ore", Anno: 2019, Tempo_Liturgico: "Pentecoste", Momento_Messa: "Comunione", Genere: "Inno", link_ascolto: "", view_count: 89 },
  { id: 4, Title: "Tu sei la mia vita", Content: "Tu sei la mia vita\nAltro io non ho\nTu sei la mia strada\nLa mia verità\n\nNella tua parola\nIo camminerò\nFinché avrò respiro\nLoderti voglio o Dio\n\nA te voglio credere\nIn te voglio sperare\nTi voglio amare Signore", Album: "Canti della Speranza", Autori: "Autori Vari", Anno: 2021, Tempo_Liturgico: "Tempo Ordinario", Momento_Messa: "Ingresso", Genere: "Adorazione", link_ascolto: "", view_count: 215 },
  { id: 5, Title: "Kyrie Eleison", Content: "Kyrie, eleison\nKyrie, eleison\nKyrie, eleison\n\nChriste, eleison\nChriste, eleison\nChriste, eleison\n\nKyrie, eleison\nKyrie, eleison\nKyrie, eleison", Album: "Ordinario della Messa", Autori: "Tradizionale", Anno: 2015, Tempo_Liturgico: "Tutto l'Anno", Momento_Messa: "Atto Penitenziale", Genere: "Supplica", link_ascolto: "", view_count: 301 },
  { id: 6, Title: "Ave Maria", Content: "Ave Maria\nGratia plena\nDominus tecum\nBenedicta tu in mulieribus\n\nEt benedictus\nFructus ventris tui Jesus\nSancta Maria\nMater Dei\n\nOra pro nobis peccatoribus\nNunc et in hora mortis nostrae", Album: "Canti Mariani", Autori: "Franz Schubert / Tradizionale", Anno: 2016, Tempo_Liturgico: "Avvento", Momento_Messa: "Offertorio", Genere: "Mariano", link_ascolto: "", view_count: 178 },
];

// ============================================================
// UTILITIES
// ============================================================
function fuzzyMatch(text, query) {
  if (!query) return true;
  const t = text?.toLowerCase() || "";
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function splitTags(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function sanitizeInput(value, maxLength = 2000) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ""); // rimuove < e > che potrebbero formare tag HTML
}

// ============================================================
// CHORD / CHORDPRO UTILITIES
// ============================================================

const NOTE_NAMES_SHARP = [
  "Do",
  "Do#",
  "Re",
  "Re#",
  "Mi",
  "Fa",
  "Fa#",
  "Sol",
  "Sol#",
  "La",
  "La#",
  "Si",
];

const NOTE_INDEX = {
  do: 0,
  "do#": 1,
  reb: 1,
  re: 2,
  "re#": 3,
  mib: 3,
  mi: 4,
  fa: 5,
  "fa#": 6,
  solb: 6,
  sol: 7,
  "sol#": 8,
  lab: 8,
  la: 9,
  "la#": 10,
  sib: 10,
  si: 11,
};

function transposeSingleChordSymbol(symbol, steps) {
  if (!symbol || !steps) return symbol;

  const match = symbol.match(/^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?(.*)$/i);
  if (!match) return symbol;

  const rootName = match[1];
  const accidental = match[2] || "";
  const suffix = match[3] || "";

  const key = (rootName + accidental).toLowerCase();
  const index = NOTE_INDEX[key];
  if (index === undefined) return symbol;

  const normalizedSteps = ((steps % 12) + 12) % 12;
  const newIndex = (index + normalizedSteps) % 12;
  const newRoot = NOTE_NAMES_SHARP[newIndex];

  return newRoot + suffix;
}

function transposeChord(chord, steps) {
  if (!chord || !steps) return chord;
  if (!/\[?[A-G]/i.test(chord) && !/(Do|Re|Mi|Fa|Sol|La|Si)/i.test(chord)) return chord;

  const parts = chord.split("/");
  const main = parts[0];
  const bass = parts[1];

  const mainT = transposeSingleChordSymbol(main, steps);
  if (!bass) return mainT;

  const bassT = transposeSingleChordSymbol(bass, steps);
  return `${mainT}/${bassT}`;
}

const BADGE_COLORS = {
  // ── Tempo Liturgico ──────────────────────────────────────────
 "Avvento":               { bg: "#e8e7f7", color: "#3730a3" },        // blu notte → indaco su lavanda chiara
  "Corpus Domini":         { bg: "#FEF9C3", color: "#854D0E" },        // giallo caldo + ocra
  "Domenica delle Palme":  { bg: "#d1fae5", color: "#065f46" },        // verde chiaro
  "Epifania":              { bg: "#fdf4ff", color: "#7e22ce" },        // lilla tenue + viola
  "Esequie":               { bg: "#e2e8f0", color: "#334155" },        // antracite → grigio ardesia su grigio molto chiaro
  "Festa del Santo":       { bg: "#fff7ed", color: "#c2410c" },        // arancio caldo
  "Immacolata Concezione": { bg: "#e0f2fe", color: "#075985" },        // celeste medio
  "Maggio Mariano":        { bg: "#bfdbfe", color: "#1e40af" },        // celeste intenso
  "Natale":                { bg: "#fef2f2", color: "#991b1b" },        // bianco + rosso scuro
  "Ordinario":             { bg: "#d1fae5", color: "#065F46" },        // verde salvia
  "Pasqua":                { bg: "#fffbeb", color: "#92400e" },        // bianco avorio + dorato
  "Pentecoste":            { bg: "#fee2e2", color: "#b91c1c" },        // rosso fuoco tenue
  "Quaresima":             { bg: "#ede9fe", color: "#5b21b6" },        // viola medio
  "Santissima Trinità":    { bg: "#ecfdf5", color: "#065f46" },        // verde smeraldo tenue

  // ── Momento della Messa ──────────────────────────────────────
  "Acclamazione":          { bg: "#fef3c7", color: "#b45309" },        // ambra
  "Adorazione":            { bg: "#f5f3ff", color: "#6d28d9" },        // viola tenue
  "Adorazione della Croce":{ bg: "#ffe4e6", color: "#881337" },        // borgogna → cremisi su rosa pallido
  "Canto al Vangelo":      { bg: "#f0fdf4", color: "#15803d" },        // verde evangelio
  "Comunione":             { bg: "#fafaf9", color: "#78350f" },        // bianco + marrone caldo
  "Credo":                 { bg: "#eff6ff", color: "#1d4ed8" },        // blu fede
  "Finale":                { bg: "#f8fafc", color: "#475569" },        // grigio neutro
  "Gloria":                { bg: "#fffbeb", color: "#d97706" },        // oro brillante
  "Ingresso":              { bg: "#fef9c3", color: "#854d0e" },        // giallo ingresso
  "Invocazione allo Spirito":{ bg: "#fef2f2", color: "#dc2626" },     // rosso Spirito
  "Lode":                  { bg: "#e0f2fe", color: "#0369a1" },        // azzurro lode
  "Mariano":               { bg: "#dbeafe", color: "#1e40af" },        // celeste mariano
  "Offertorio":            { bg: "#ecfdf5", color: "#047857" },        // verde offerta
  "Penitenziale":          { bg: "#fce7f3", color: "#9d174d" },        // rosa penitenza
  "Ringraziamento":        { bg: "#f0fdf4", color: "#166534" },        // verde ringraziamento
  "Salmo":                 { bg: "#e0e7ff", color: "#3730a3" },        // indaco salmo
  "Santo":                 { bg: "#fff7ed", color: "#c2410c" },        // arancio Santo
  "Scambio della pace":    { bg: "#f0fdfa", color: "#0f766e" },        // verde acqua pace
  "Sequenza":              { bg: "#fdf2f8", color: "#9d174d" },        // ciclamino
};

function Badge({ label }) {
  const style = BADGE_COLORS[label] || { bg: "#F1F5F9", color: "#475569" };
  return (
    <span style={{
      background: style.bg,
      color: style.color,
      padding: "2px 10px",
      borderRadius: "999px",
      fontSize: "0.7rem",
      fontWeight: 600,
      letterSpacing: "0.03em",
      fontFamily: "'Montserrat', sans-serif",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

// ============================================================
// ICONS (SVG inline)
// ============================================================
const Icons = {
  Search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Filter: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Music: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {/* Sinuous staircase ascending from bottom-left to top-right */}
      <path d="M2 18 C3 18 3 18 3 17 C4 17 4 17 4 15.5 C5.5 15.5 5.5 15.5 5.5 13.5 C7 13.5 7 13.5 7 11.5 C9 11.5 9 11.5 9 9 C11 9 11 9 11 7 C13 7 13 7 13 5 C15 5 15 5 15 3 C16.5 3 16.5 3 16.5 2" />
    </svg>
  ),
  Play: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Pause: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  Scroll: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>,
  FontUp: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><text x="2" y="18" fontSize="18" fontWeight="bold" stroke="currentColor">A</text><text x="14" y="14" fontSize="10" stroke="currentColor">+</text></svg>,
  FontDown: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><text x="2" y="18" fontSize="18" fontWeight="bold" stroke="currentColor">A</text><text x="14" y="14" fontSize="12" stroke="currentColor">−</text></svg>,
  Back: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  Flag: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  Close: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Eye: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  ExternalLink: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Menu: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
};

// ============================================================
// GLOBAL STYLES
// ============================================================
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
    
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --sky-50: #f0f9ff;
      --sky-100: #e0f2fe;
      --sky-200: #bae6fd;
      --sky-300: #7dd3fc;
      --sky-400: #38bdf8;
      --sky-500: #0ea5e9;
      --sky-600: #0284c7;
      --sky-700: #0369a1;
      --sky-800: #075985;
      --sky-900: #0c4a6e;
      --white: #ffffff;
      --gray-50: #f8fafc;
      --gray-100: #f1f5f9;
      --gray-200: #e2e8f0;
      --gray-300: #cbd5e1;
      --gray-400: #94a3b8;
      --gray-500: #64748b;
      --gray-600: #475569;
      --gray-700: #334155;
      --gray-800: #1e293b;
      --shadow-sm: 0 1px 3px rgba(14,165,233,0.08), 0 1px 2px rgba(14,165,233,0.06);
      --shadow: 0 4px 16px rgba(14,165,233,0.1), 0 2px 6px rgba(14,165,233,0.06);
      --shadow-lg: 0 12px 40px rgba(14,165,233,0.15), 0 4px 12px rgba(14,165,233,0.1);
      --radius: 14px;
      --radius-sm: 8px;
    }
    
    html { scroll-behavior: smooth; }
    
    body {
      font-family: 'Montserrat', sans-serif;
      background: var(--sky-50);
      color: var(--gray-800);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: var(--sky-100); }
    ::-webkit-scrollbar-thumb { background: var(--sky-300); border-radius: 3px; }
    
    /* Animations */
    @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
    @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    
    .fade-in { animation: fadeIn 0.35s ease both; }
    .slide-in { animation: slideIn 0.3s cubic-bezier(0.4,0,0.2,1) both; }
    
    /* Skeleton loader */
    .skeleton {
      background: linear-gradient(90deg, var(--sky-100) 25%, var(--sky-50) 50%, var(--sky-100) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius);
    }
    
    /* Song text */
    .song-content {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.9;
      color: var(--gray-700);
    }
    
    /* Button base */
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 10px 18px; border-radius: var(--radius-sm);
      border: none; cursor: pointer; font-family: 'Montserrat', sans-serif;
      font-weight: 600; font-size: 0.875rem; transition: all 0.2s ease;
      text-decoration: none;
    }
    .btn:active { transform: scale(0.97); }
    .btn-primary {
      background: var(--sky-500); color: white;
    }
    .btn-primary:hover { background: var(--sky-600); box-shadow: var(--shadow); }
    .btn-secondary {
      background: var(--sky-100); color: var(--sky-700);
    }
    .btn-secondary:hover { background: var(--sky-200); }
    .btn-ghost {
      background: transparent; color: var(--gray-500);
    }
    .btn-ghost:hover { background: var(--sky-100); color: var(--sky-700); }
    
    /* Card */
    .card {
      background: white;
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--sky-100);
      transition: all 0.25s ease;
    }
    .card:hover {
      box-shadow: var(--shadow);
      border-color: var(--sky-200);
      transform: translateY(-2px);
    }
    
    /* Input */
    .input {
      width: 100%; padding: 12px 16px;
      border: 1.5px solid var(--sky-200);
      border-radius: var(--radius-sm);
      font-family: 'Montserrat', sans-serif;
      font-size: 0.9rem;
      background: white;
      color: var(--gray-800);
      transition: all 0.2s;
      outline: none;
    }
    .input:focus { border-color: var(--sky-400); box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }
    
    select.input { appearance: none; cursor: pointer; }
    
    /* Overlay */
    .overlay {
      position: fixed; inset: 0;
      background: rgba(12,74,110,0.3);
      backdrop-filter: blur(4px);
      z-index: 100;
    }
    
    /* Responsive grid */
    .canti-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    
    @media (max-width: 640px) {
      .canti-grid { grid-template-columns: 1fr; gap: 12px; }
    }
    
    /* Auto-scroll highlight */
    @keyframes scrollPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(14,165,233,0); } 50% { box-shadow: 0 0 0 4px rgba(14,165,233,0.3); } }
    .scrolling-active { animation: scrollPulse 2s infinite; }
    
    /* Toolbar floating */
    .floating-toolbar {
      position: sticky;
      bottom: 16px;
      z-index: 10;
    }
 @media print {
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  
  /* Nasconde tutta l'interfaccia */
  header,
  footer,
  .no-print { display: none !important; }
  
  /* Sfondo bianco ovunque */
  body, html {
    background: white !important;
  }
  
  /* Rimuove bordi, ombre, sfondi colorati dai card */
  .card, div {
    box-shadow: none !important;
    border: none !important;
    background: white !important;
    border-radius: 0 !important;
  }
  
  /* Testo del canto */
  .song-content {
    font-size: 13px !important;
    line-height: 1.8 !important;
    color: black !important;
  }

  /* Margini pagina */
  @page {
    margin: 2cm;
    size: A4;
  }
}

.print-only { display: none; }
  
  @page {
    margin: 2cm;
    size: A4;
  }
}

.print-only { display: none; }
  `}</style>
);

// ============================================================
// HEADER
// ============================================================
function Header({ onMenuToggle, showBack, onBack, onNavigate }) {
  return (
    <header style={{
      background: "white",
      borderBottom: "1px solid var(--sky-100)",
      padding: "0 20px",
      height: "60px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 50,
      boxShadow: "0 2px 12px rgba(14,165,233,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {showBack ? (
          <button className="btn btn-ghost" onClick={onBack} style={{ padding: "8px", borderRadius: "50%" }}>
            <Icons.Back />
          </button>
        ) : null}
        <button
          onClick={() => onNavigate("home")}
          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <img
            src="/logo.svg"
            alt="Sulàm logo"
            style={{ width: 36, height: 36, objectFit: "contain" }}
          />
          <div style={{ textAlign: "left" }}>
            <h1 style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 900,
              fontSize: "1.3rem",
              background: "linear-gradient(135deg, var(--sky-500), var(--sky-800))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}>sulàm</h1>
            <p style={{ fontSize: "0.62rem", color: "var(--gray-400)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              la web-app dei canti
            </p>
          </div>
        </button>
      </div>
      <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button className="btn btn-ghost" onClick={() => onNavigate("about")} style={{ fontSize: "0.8rem", padding: "8px 12px" }}>
          cos'è
        </button>
        <button className="btn btn-ghost" onClick={() => onNavigate("install")} style={{ fontSize: "0.8rem", padding: "8px 12px" }}>
          installa
        </button>
      </nav>
    </header>
  );
}

// ============================================================
// FILTER SIDEBAR / DRAWER
// ============================================================
function FilterPanel({ filters, setFilters, canti, isDrawer, onClose }) {
  const tempi = useMemo(
    () => [
      ...new Set(
        canti.flatMap((c) => splitTags(c.Tempo_Liturgico)).filter(Boolean)
      ),
    ].sort(),
    [canti]
  );
  const momenti = useMemo(
    () => [
      ...new Set(
        canti.flatMap((c) => splitTags(c.Momento_Messa)).filter(Boolean)
      ),
    ].sort(),
    [canti]
  );
  const generi = useMemo(
    () => [
      ...new Set(
        canti.flatMap((c) => splitTags(c.Genere)).filter(Boolean)
      ),
    ].sort(),
    [canti]
  );

  const content = (
    <div style={{ padding: isDrawer ? "24px" : "0", height: "100%", overflowY: "auto" }}>
      {isDrawer && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--sky-700)" }}>Filtri</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 8, borderRadius: "50%" }}>
            <Icons.Close />
          </button>
        </div>
      )}

      {[
        { key: "tempo", label: "Tempo Liturgico", options: tempi },
        { key: "momento", label: "Momento della Messa", options: momenti },
        { key: "genere", label: "Genere", options: generi },
      ].map(({ key, label, options }) => (
        <div key={key} style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--sky-700)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </label>
          <div style={{ position: "relative" }}>
            <select
              className="input"
              value={filters[key] || ""}
              onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
              style={{ paddingRight: 36 }}
            >
              <option value="">Tutti</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--sky-400)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
        </div>
      ))}

      {(filters.tempo || filters.momento || filters.genere) && (
        <button
          className="btn btn-secondary"
          onClick={() => setFilters({})}
          style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
        >
          Rimuovi filtri
        </button>
      )}
    </div>
  );

  if (isDrawer) {
    return (
      <>
        <div className="overlay" onClick={onClose} />
        <div className="slide-in" style={{
          position: "fixed", left: 0, top: 0, bottom: 0, width: 300,
          background: "white", zIndex: 101,
          boxShadow: "var(--shadow-lg)",
        }}>
          {content}
        </div>
      </>
    );
  }

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: "white",
      borderRadius: "var(--radius)",
      padding: "20px",
      boxShadow: "var(--shadow-sm)",
      border: "1px solid var(--sky-100)",
      position: "sticky",
      top: 76,
      alignSelf: "flex-start",
    }}>
      <h3 style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--sky-700)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
        <Icons.Filter /> Filtri
      </h3>
      {content}
    </aside>
  );
}

// ============================================================
// CANTO CARD
// ============================================================
function CantoCard({ canto, onClick, index }) {
  return (
    <div
      className="card fade-in"
      onClick={() => onClick(canto)}
      style={{ padding: "18px 20px", cursor: "pointer", animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <h3 style={{
          fontWeight: 700, fontSize: "1rem",
          color: "var(--gray-800)", lineHeight: 1.3,
          fontFamily: "'Montserrat', sans-serif",
        }}>{canto.Title}</h3>
        {canto.view_count > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--gray-400)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
            <Icons.Eye /> {canto.view_count}
          </span>
        )}
      </div>

      {canto.Autori && (
        <p style={{ fontSize: "0.82rem", color: "var(--sky-600)", marginBottom: 12, fontWeight: 500 }}>
          {canto.Autori}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {splitTags(canto.Tempo_Liturgico).map((t) => (
          <Badge key={t} label={t} />
        ))}
        {splitTags(canto.Momento_Messa).map((m) => (
          <Badge key={m} label={m} />
        ))}
        {splitTags(canto.Genere).map((g) => (
          <Badge key={g} label={g} />
        ))}
      </div>

      {canto.link_ascolto && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 4, color: "var(--sky-400)", fontSize: "0.75rem" }}>
          <Icons.Play /> <span style={{ fontWeight: 600 }}>Audio disponibile</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SKELETON CARDS
// ============================================================
function SkeletonCard() {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div className="skeleton" style={{ height: 20, width: "70%", marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 14, width: "45%", marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 999 }} />
        <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 999 }} />
      </div>
    </div>
  );
}

// ============================================================
// SEGNALAZIONE MODAL
// ============================================================
function SegnalazioneModal({ canto, onClose }) {
  const [messaggio, setMessaggio] = useState("");
  const [email, setEmail] = useState("");
  const [stato, setStato] = useState("idle"); // idle | sending | success | error

  const handleSubmit = async () => {
    if (!messaggio.trim()) return;
    setStato("sending");
    try {
      const { error } = await supabase.from("segnalazioni").insert({
        canto_id: canto.id,
        canto_titolo: canto.Title,
        messaggio: sanitizeInput(messaggio, 2000),
        email_utente: sanitizeInput(email, 200) || null,
      });
      setStato(error ? "error" : "success");
    } catch {
      setStato("error");
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div style={{
        position: "fixed", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        background: "white", borderRadius: "var(--radius)",
        padding: "28px", width: "min(480px, calc(100vw - 32px))",
        zIndex: 102, boxShadow: "var(--shadow-lg)",
        animation: "fadeIn 0.25s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--gray-800)" }}>Segnala una modifica</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--sky-600)", marginTop: 2 }}>"{canto.Title}"</p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 8, borderRadius: "50%" }}>
            <Icons.Close />
          </button>
        </div>

        {stato === "success" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--sky-100)", margin: "0 auto 16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--sky-500)",
            }}>
              <Icons.Check />
            </div>
            <p style={{ fontWeight: 600, color: "var(--gray-700)" }}>Segnalazione inviata!</p>
            <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", marginTop: 4 }}>Grazie per il tuo contributo.</p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>Chiudi</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--gray-600)", marginBottom: 6 }}>
                Descrivi la modifica *
              </label>
              <textarea
                className="input"
                value={messaggio}
                onChange={e => setMessaggio(e.target.value)}
                placeholder="Es: accordo sbagliato al secondo verso, testo mancante..."
                rows={4}
                style={{ resize: "vertical", fontFamily: "'Montserrat', sans-serif" }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--gray-600)", marginBottom: 6 }}>
                Email (opzionale)
              </label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="per ricevere aggiornamenti"
              />
            </div>
            {stato === "error" && (
              <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: 12 }}>
                Errore nell'invio. Riprova.
              </p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={stato === "sending" || !messaggio.trim()}
                style={{ opacity: (stato === "sending" || !messaggio.trim()) ? 0.6 : 1 }}
              >
                {stato === "sending" ? "Invio..." : "Invia segnalazione"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
function parseChordPro(text) {
  if (!text) return [{ type: "verse", lines: [] }];
  const sections = [];
  let currentSection = { type: "verse", lines: [] };
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "{start_of_chorus}" || trimmed === "{soc}") {
      if (currentSection.lines.length) sections.push(currentSection);
      currentSection = { type: "chorus", lines: [] };
    } else if (trimmed === "{end_of_chorus}" || trimmed === "{eoc}") {
      sections.push(currentSection);
      currentSection = { type: "verse", lines: [] };
    } else if (trimmed === "{chorus}") {
      currentSection.lines.push("__CHORUS_REPEAT__");
    } else {
      currentSection.lines.push(line);
    }
  }
  if (currentSection.lines.length) sections.push(currentSection);
  return sections;
}

function parseInlineMarkdown(text) {
  const parts = [];
  const regex = /_([^_]+)_/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ italic: false, value: text.slice(last, match.index) });
    }
    parts.push({ italic: true, value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push({ italic: false, value: text.slice(last) });
  }
  return parts;
}



function ChordProLine({ line, showChords, transpose, fontSize, isChorus }) {
  if (!line || line.trim() === "") return <div style={{ height: "1.9em" }} />;

  const chordRegex = /\[([^\]]+)\]/g;
  const hasChord = /\[[^\]]+\]/.test(line);

  if (!showChords || !hasChord) {
    const clean = line.replace(/\[[^\]]+\]/g, "");
    const parts = parseInlineMarkdown(clean);
    return (
      <pre className="song-content" style={{
        fontSize: `${fontSize}px`,
        fontWeight: isChorus ? 700 : 400,
        color: isChorus ? "var(--sky-700)" : "var(--gray-700)",
        marginBottom: 0,
      }}>
        {parts.map((p, i) =>
          p.italic
            ? <em key={i} style={{ fontStyle: "italic" }}>{p.value}</em>
            : p.value
        )}
      </pre>
    );
  }

  const chordSize = Math.max(fontSize - 2, 11);
  const chordHeightPx = chordSize * 1.5;
  const textColor = isChorus ? "var(--sky-700)" : "var(--gray-700)";
  const fontWeight = isChorus ? 700 : 400;

  // Tokenizza la riga in una lista flat di token: { type: "chord"|"text", value }
  const tokens = [];
  let lastIndex = 0;
  let match;
  chordRegex.lastIndex = 0;
  while ((match = chordRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: line.slice(lastIndex, match.index) });
    }
    const raw = match[1];
    const transposed = transpose ? transposeChord(raw, transpose) : raw;
    tokens.push({ type: "chord", value: transposed });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    tokens.push({ type: "text", value: line.slice(lastIndex) });
  }

  // Raggruppa in segmenti colonna: ogni accordo prende il testo immediatamente successivo
  const segments = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].type === "chord") {
      const chord = tokens[i].value;
      const text = (i + 1 < tokens.length && tokens[i + 1].type === "text") ? tokens[i + 1].value : "";
      segments.push({ chord, text });
      i += text ? 2 : 1;
    } else {
      segments.push({ chord: null, text: tokens[i].value });
      i++;
    }
  }

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-end",
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: `${fontSize}px`,
      marginBottom: 0,
    }}>
      {segments.map((seg, idx) =>
        seg.chord ? (
          <span key={idx} style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "flex-start",
            whiteSpace: "pre",
          }}>
            <span style={{
              fontSize: `${chordSize}px`,
              fontWeight: 700,
              color: "var(--sky-600)",
              lineHeight: `${chordHeightPx}px`,
              whiteSpace: "nowrap",
              paddingRight: "4px",
            }}>{seg.chord}</span>
            <span style={{
              fontWeight,
              color: textColor,
              lineHeight: `${fontSize * 1.7}px`,
              whiteSpace: "pre",
              minWidth: seg.text.trim() === ""
                ? `${(seg.chord.length + 1) * chordSize * 0.62}px`
                : undefined,
            }}>{seg.text || " "}</span>
          </span>
        ) : (
          <span key={idx} style={{
            display: "inline-flex",
            flexDirection: "column",
            whiteSpace: "pre",
          }}>
            <span style={{
              lineHeight: `${chordHeightPx}px`,
              visibility: "hidden",
              fontSize: `${chordSize}px`,
            }}>{"\u200B"}</span>
            <span style={{
              fontWeight,
              color: textColor,
              lineHeight: `${fontSize * 1.7}px`,
              whiteSpace: "pre",
            }}>{seg.text}</span>
          </span>
        )
      )}
    </div>
  );
}
// ============================================================
// CANTO VIEWER
// ============================================================
function CantoViewer({ canto, onBack }) {
  const [fontSize, setFontSize] = useState(16);
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollVelocity, setScrollVelocity] = useState(5);
  const scrollSpeed = Math.round(200 / scrollVelocity);
  const [showSegnalazione, setShowSegnalazione] = useState(false);
  const [viewIncremented, setViewIncremented] = useState(false);
  const [showChords, setShowChords] = useState(false);
  const [transpose, setTranspose] = useState(0);
  const hasChords = useMemo(
    () => /\[[^\]]+\]/.test(canto.Content || ""),
    [canto.Content]
  );
  const [copied, setCopied] = useState(false);
  const handlePrint = useCallback(() => {
    window.print();
  }, []);
  const contentRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  // Increment view count
  useEffect(() => {
    if (!viewIncremented) {
      setViewIncremented(true);
      supabase.from("sulam_canti").update({ view_count: (canto.view_count || 0) + 1 }).eq("id", canto.id);
    }
  }, [canto.id]);

  // Auto-scroll
  const toggleScroll = useCallback(() => {
    if (isScrolling) {
      clearInterval(scrollIntervalRef.current);
      setIsScrolling(false);
    } else {
      setIsScrolling(true);
      scrollIntervalRef.current = setInterval(() => {
        window.scrollBy({ top: 1, behavior: "auto" });
      }, scrollSpeed);
    }
  }, [isScrolling, scrollSpeed]);

  useEffect(() => {
    if (isScrolling) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = setInterval(() => {
        window.scrollBy({ top: 1, behavior: "auto" });
      }, scrollSpeed);
    }
    return () => clearInterval(scrollIntervalRef.current);
  }, [scrollVelocity]);

  useEffect(() => {
    return () => clearInterval(scrollIntervalRef.current);
  }, []);

  const openLink = () => {
    if (!canto.link_ascolto) return;
    try {
      const url = new URL(canto.link_ascolto);
      if (url.protocol === "https:" || url.protocol === "http:") {
        window.open(url.href, "_blank", "noopener,noreferrer");
      }
    } catch {
      // URL non valido, non fare nulla
    }
  };

  const handleCopyLink = useCallback(() => {
    const origin = window.location.origin || "";
    const url = `${origin}/canto/${canto.id}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback silenzioso
    });
  }, [canto.id]);

  return (
    <div className="no-print" style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 100px" }} className="fade-in">
      {/* Header info */}
      <div style={{
        background: "white", borderRadius: "var(--radius)",
        padding: "20px 24px", marginBottom: 20,
        boxShadow: "var(--shadow-sm)", border: "1px solid var(--sky-100)",
      }}>
        <h1 style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 800, fontSize: "clamp(1.4rem, 4vw, 2rem)",
          color: "var(--gray-800)", marginBottom: 8,
          lineHeight: 1.2,
        }}>{canto.Title}</h1>

        {(canto.Autori || canto.Album || canto.Anno) && (
          <p style={{ color: "var(--sky-600)", fontWeight: 600, marginBottom: 12, fontSize: "0.9rem" }}>
            {canto.Autori && <span>{canto.Autori}</span>}
            {canto.Album && (
              <span style={{ color: "var(--gray-500)", fontWeight: 500 }}>
                {" \u2014 "}{canto.Album}
              </span>
            )}
            {canto.Anno && (
              <span style={{ color: "var(--gray-400)", fontWeight: 400 }}>
                {" · "}{canto.Anno}
              </span>
            )}
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {splitTags(canto.Tempo_Liturgico).map((t) => (
            <Badge key={t} label={t} />
          ))}
          {splitTags(canto.Momento_Messa).map((m) => (
            <Badge key={m} label={m} />
          ))}
          {splitTags(canto.Genere).map((g) => (
            <Badge key={g} label={g} />
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: "white", borderRadius: "var(--radius)",
        padding: "12px 16px", marginBottom: 20,
        boxShadow: "var(--shadow-sm)", border: "1px solid var(--sky-100)",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        {/* Font size */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginRight: 4 }}>
          <button className="btn btn-secondary" onClick={() => setFontSize(f => Math.max(12, f - 2))} style={{ padding: "8px 10px" }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.85rem" }}>A-</span>
          </button>
          <span style={{ fontSize: "0.78rem", color: "var(--gray-400)", minWidth: 30, textAlign: "center" }}>{fontSize}px</span>
          <button className="btn btn-secondary" onClick={() => setFontSize(f => Math.min(32, f + 2))} style={{ padding: "8px 10px" }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.95rem" }}>A+</span>
          </button>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: "var(--sky-100)" }} />

        {/* Auto-scroll */}
        <button
          className={`btn ${isScrolling ? "btn-primary" : "btn-secondary"}`}
          onClick={toggleScroll}
          style={{ gap: 6 }}
        >
          <Icons.Scroll />
          {isScrolling ? "Stop" : "Auto-scroll"}
        </button>

        {isScrolling && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>Velocità</span>
            <input
              type="range" min="1" max="10" step="1"
              value={scrollVelocity}
              onChange={e => setScrollVelocity(Number(e.target.value))}
              style={{ width: 80, accentColor: "var(--sky-500)" }}
            />  
          </div>
        )}

        {hasChords && (
          <>
            {/* Divider */}
            <div style={{ width: 1, height: 28, background: "var(--sky-100)" }} />

            {/* Chords toggle */}
            <button
              className={`btn ${showChords ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setShowChords(v => !v)}
              style={{ gap: 6 }}
            >
              ♫ Accordi
            </button>

            {/* Transpose controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setTranspose(t => t - 1)}
                style={{ padding: "6px 10px" }}
              >
                -1
              </button>
              <span style={{ fontSize: "0.78rem", color: "var(--gray-400)", minWidth: 40, textAlign: "center" }}>
                {transpose === 0 ? "0" : `${transpose > 0 ? "+" : ""}${transpose}`}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setTranspose(t => t + 1)}
                style={{ padding: "6px 10px" }}
              >
                +1
              </button>
            </div>
          </>
        )}

        {canto.link_ascolto && (
          <>
            <div style={{ width: 1, height: 28, background: "var(--sky-100)" }} />
            <button className="btn btn-primary" onClick={openLink}>
              <Icons.Play /> Ascolta
            </button>
          </>
        )}
      </div>

      {/* Song content */}
      <div
        ref={contentRef}
        style={{
          background: "white", borderRadius: "var(--radius)",
          padding: "28px 28px",
          boxShadow: "var(--shadow-sm)", border: "1px solid var(--sky-100)",
          marginBottom: 20,
        }}
        className={isScrolling ? "scrolling-active" : ""}
      >
      {/* Visibile solo in stampa */}
<div className="print-only" style={{ marginBottom: 24 }}>
  <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{canto.Title}</h1>
  {canto.Autori && <p style={{ fontSize: 13, color: "#555", marginBottom: 2 }}><strong>Autori:</strong> {canto.Autori}</p>}
  {canto.Album && <p style={{ fontSize: 13, color: "#555", marginBottom: 2 }}><strong>Album:</strong> {canto.Album}</p>}
  {canto.Anno && <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}><strong>Anno:</strong> {canto.Anno}</p>}
  <hr style={{ borderTop: "1px solid #ccc", marginBottom: 16 }} />
</div>
        {canto.Content ? (
          parseChordPro(canto.Content).map((section, i) => (
            <div
              key={i}
              style={
                section.type === "chorus"
                  ? {
                      borderLeft: "3px solid var(--sky-400)",
                      paddingLeft: 16,
                      marginBottom: 16,
                    }
                  : { marginBottom: 16 }
              }
            >
              {section.lines.map((line, j) =>
                line === "__CHORUS_REPEAT__" ? (
                  <div
                    key={j}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      margin: "6px 0",
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "var(--sky-100)",
                      color: "var(--sky-600)",
                      fontSize: `${Math.max(fontSize - 2, 11)}px`,
                      fontWeight: 700,
                      fontFamily: "'Montserrat', sans-serif",
                      letterSpacing: "0.04em",
                    }}
                  >
                    ↩ Rit.
                  </div>
                ) : (
                  <ChordProLine
                    key={j}
                    line={line}
                    showChords={showChords}
                    transpose={transpose}
                    fontSize={fontSize}
                    isChorus={section.type === "chorus"}
                  />
                )
              )}
            </div>
          ))
        ) : (
          <p style={{ color: "var(--gray-400)" }}>Testo non disponibile.</p>
        )}
      </div>

      {/* Share link */}
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 20 }}>
  <button
    className="btn btn-secondary"
    onClick={handlePrint}
    style={{ gap: 6 }}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
    Stampa
  </button>
  <button
    className="btn btn-secondary"
    onClick={handleCopyLink}
    style={{ gap: 6 }}
  >
    <Icons.ExternalLink />
    {copied ? "Link copiato!" : "Condividi"}
  </button>
</div>

      {/* Segnalazione */}
      <div className="no-print" style={{
        background: "var(--sky-50)", borderRadius: "var(--radius)",
        padding: "16px 20px",
        border: "1px dashed var(--sky-200)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div>
          <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--gray-600)" }}>Hai trovato un errore?</p>
          <p style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>Aiutaci a migliorare il canzoniere</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowSegnalazione(true)} style={{ gap: 6, whiteSpace: "nowrap" }}>
          <Icons.Flag /> Segnala modifica
        </button>
      </div>

      {showSegnalazione && <SegnalazioneModal canto={canto} onClose={() => setShowSegnalazione(false)} />}
    </div>
  );
}

// ============================================================
// HOME PAGE
// ============================================================
const PAGE_SIZE = 20;

function HomePage({ onSelectCanto, search, setSearch, filters, setFilters }) {
  const [allCanti, setAllCanti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [showDrawer, setShowDrawer] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const loaderRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const loadCanti = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("sulam_canti")
          .select("id,Title,Autori,Album,Anno,Tempo_Liturgico,Momento_Messa,Genere,link_ascolto,view_count")
          .order("Title", { ascending: true });
        if (error || !data?.length) {
          // Use mock data if Supabase not configured
          setAllCanti(MOCK_CANTI);
        } else {
          setAllCanti(data);
        }
      } catch {
        setAllCanti(MOCK_CANTI);
      }
      setLoading(false);
    };
    loadCanti();
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setDisplayCount(c => c + PAGE_SIZE);
    }, { threshold: 0.1 });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loading]);

  const filtered = useMemo(() => {
    return allCanti.filter(c => {
      if (filters.tempo && !splitTags(c.Tempo_Liturgico).includes(filters.tempo)) return false;
      if (filters.momento && !splitTags(c.Momento_Messa).includes(filters.momento)) return false;
      if (filters.genere) {
        const generiCanto = splitTags(c.Genere);
        if (!generiCanto.includes(filters.genere)) return false;
      }
      if (search) {
        const matchTitle = fuzzyMatch(c.Title, search);
        const matchAutori = fuzzyMatch(c.Autori, search);
        const searchLower = search.toLowerCase();
        const matchGenere = splitTags(c.Genere)
          .map(g => g.toLowerCase())
          .includes(searchLower);
        if (!matchTitle && !matchAutori && !matchGenere) return false;
      }
      return true;
    });
  }, [allCanti, filters, search]);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = displayed.length < filtered.length;
  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, var(--sky-500) 0%, var(--sky-700) 100%)",
        padding: "32px 20px 28px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.06,
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }} />
        <div style={{ maxWidth: 700, margin: "0 auto", position: "relative" }}>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            {allCanti.length > 0 ? `${allCanti.length} canti disponibili` : "Canzoniere musicale"}
          </p>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--sky-300)" }}>
              <Icons.Search />
            </div>
            <input
              className="input"
              value={search}
              onChange={e => { setSearch(e.target.value); setDisplayCount(PAGE_SIZE); }}
              placeholder="Cerca per titolo o autore..."
              style={{
                paddingLeft: 44, fontSize: "1rem",
                border: "2px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.95)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px" }}>
        {/* Mobile filter button */}
        {isMobile && (
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "0.82rem", color: "var(--gray-500)" }}>
              <strong style={{ color: "var(--gray-800)" }}>{filtered.length}</strong> canti trovati
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => setShowDrawer(true)}
              style={{ gap: 6 }}
            >
              <Icons.Filter />
              Filtri
              {activeFiltersCount > 0 && (
                <span style={{
                  background: "var(--sky-500)", color: "white",
                  borderRadius: "50%", width: 18, height: 18,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", fontWeight: 700,
                }}>{activeFiltersCount}</span>
              )}
            </button>
          </div>
        )}

        {showDrawer && isMobile && (
          <FilterPanel filters={filters} setFilters={setFilters} canti={allCanti} isDrawer onClose={() => setShowDrawer(false)} />
        )}

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          {/* Desktop sidebar */}
          {!isMobile && (
            <FilterPanel filters={filters} setFilters={setFilters} canti={allCanti} isDrawer={false} />
          )}

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!isMobile && (
              <p style={{ fontSize: "0.82rem", color: "var(--gray-500)", marginBottom: 16 }}>
                <strong style={{ color: "var(--gray-800)" }}>{filtered.length}</strong> canti trovati
              </p>
            )}

            {loading ? (
              <div className="canti-grid">
                {Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎵</div>
                <p style={{ fontWeight: 600, color: "var(--gray-600)" }}>Nessun canto trovato</p>
                <p style={{ fontSize: "0.85rem", color: "var(--gray-400)", marginTop: 4 }}>Prova a modificare i filtri o la ricerca</p>
              </div>
            ) : (
              <div className="canti-grid">
                {displayed.map((canto, i) => (
                  <CantoCard key={canto.id} canto={canto} onClick={onSelectCanto} index={i} />
                ))}
              </div>
            )}

            {/* Infinite scroll loader */}
            {hasMore && !loading && (
              <div ref={loaderRef} style={{ padding: "24px 0", textAlign: "center" }}>
                <div style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "var(--sky-400)", fontSize: "0.82rem" }}>
                  <div style={{ width: 16, height: 16, border: "2px solid var(--sky-300)", borderTopColor: "var(--sky-500)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Carico altri canti...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LISTA PAGE
// ============================================================

function ListaPage({ slug, onSelectCanto }) {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState(null);
  const [canti, setCanti] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setLista(null);
      setCanti([]);

      try {
        const { data, error: listaError } = await supabase
          .from("liste")
          .select("*")
          .eq("slug", slug);

        if (listaError) throw listaError;

        if (!data || data.length === 0) {
          if (!cancelled) {
            setLista(null);
            setLoading(false);
          }
          return;
        }

        const row = data[0];
        if (cancelled) return;
        setLista(row);

        const ids = String(row.canti_ids || "")
          .split(",")
          .map((part) => parseInt(part.trim(), 10))
          .filter((n) => Number.isFinite(n));

        if (ids.length === 0) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data: cantiData, error: cantiError } = await supabase
          .from("sulam_canti")
          .select("id, Title, Autori, Tempo_Liturgico, Momento_Messa")
          .in("id", ids);

        if (cantiError) throw cantiError;

        const byId = new Map((cantiData || []).map((c) => [c.id, c]));
        const ordered = ids
          .map((id) => byId.get(id))
          .filter(Boolean);

        if (!cancelled) {
          setCanti(ordered);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Errore nel caricamento della lista.");
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, var(--sky-500) 0%, var(--sky-700) 100%)",
            borderRadius: "var(--radius)",
            padding: "24px 20px",
            marginBottom: 20,
            color: "white",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="skeleton" style={{ height: 20, width: "60%", marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: "40%" }} />
        </div>
        <div className="canti-grid">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <SkeletonCard key={i} />
            ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px 80px", textAlign: "center" }}>
        <p style={{ color: "#ef4444", fontWeight: 600, marginBottom: 4 }}>{error}</p>
      </div>
    );
  }

  if (!lista) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px 80px", textAlign: "center" }}>
        <p style={{ fontWeight: 600, color: "var(--gray-700)", marginBottom: 4 }}>Lista non trovata</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 80px" }} className="fade-in">
      <div
        style={{
          background: "linear-gradient(135deg, var(--sky-500) 0%, var(--sky-700) 100%)",
          borderRadius: "var(--radius)",
          padding: "24px 24px",
          marginBottom: 24,
          color: "white",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            opacity: 0.8,
            marginBottom: 6,
            fontWeight: 600,
          }}
        >
          Lista
        </p>
        <h1
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(1.4rem, 4vw, 2rem)",
            marginBottom: 4,
          }}
        >
          {lista.titolo || lista.title || ""}
        </h1>
        {(lista.sottotitolo || lista.subtitle) && (
          <p style={{ fontSize: "0.9rem", opacity: 0.9 }}>
            {lista.sottotitolo || lista.subtitle}
          </p>
        )}
      </div>

      {canti.length === 0 ? (
        <p style={{ color: "var(--gray-400)", fontSize: "0.9rem" }}>Nessun canto in questa lista.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {canti.map((canto, index) => (
            <div
              key={canto.id}
              className="card fade-in"
              onClick={() => onSelectCanto && onSelectCanto(canto)}
              style={{
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: "999px",
                  background: "var(--sky-100)",
                  color: "var(--sky-700)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {index + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    fontWeight: 700,
                    fontSize: "0.98rem",
                    color: "var(--gray-800)",
                    marginBottom: 4,
                  }}
                >
                  {canto.Title}
                </h3>
                {canto.Autori && (
                  <p
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--sky-600)",
                      marginBottom: 8,
                      fontWeight: 500,
                    }}
                  >
                    {canto.Autori}
                  </p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {splitTags(canto.Tempo_Liturgico).map((t) => (
                    <Badge key={t} label={t} />
                  ))}
                  {splitTags(canto.Momento_Messa).map((m) => (
                    <Badge key={m} label={m} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ABOUT PAGE
// ============================================================
function AboutPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 20px 80px" }} className="fade-in">
      <div style={{
        background: "white", borderRadius: "var(--radius)",
        padding: "36px 40px",
        boxShadow: "var(--shadow-sm)", border: "1px solid var(--sky-100)",
      }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src="/logo.svg" alt="Sulàm" style={{ width: 80, height: 80, objectFit: "contain", marginBottom: 16 }} />
          <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: "2rem", color: "var(--sky-700)", marginBottom: 6 }}>
            cos'è sulàm
          </h1>
          <p style={{ color: "var(--gray-400)", fontSize: "0.85rem", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 500 }}>
            la web-app dei canti
          </p>
        </div>

        <div style={{ lineHeight: 1.85, color: "var(--gray-700)", fontSize: "0.97rem" }}>

          <p style={{ marginBottom: 20 }}>
            <strong style={{ color: "var(--gray-800)" }}>Sulàm</strong> ha le sue radici in un momento di profonda necessità. Il primo progetto nacque durante l'emergenza legata alla pandemia di <strong style={{ color: "var(--gray-800)" }}>Covid-19</strong>, quando le parrocchie italiane si trovarono nell'impossibilità di distribuire i classici libretti dei canti cartacei per garantire la sicurezza sanitaria dei fedeli. In quel contesto, l'idea di trasferire l'intero repertorio online, rendendolo consultabile direttamente dal proprio smartphone, permise a molte comunità di non rinunciare alla preghiera cantata.
          </p>
          <p style={{ marginBottom: 32 }}>
            Oggi, quell'idea è diventata qualcosa di nuovo. <strong style={{ color: "var(--gray-800)" }}>Sulàm è stato totalmente riprogettato e modernizzato</strong>, evolvendo da soluzione d'emergenza a una web app moderna. L'obiettivo attuale è offrire uno strumento digitale che superi i limiti della carta, rendendo il canto per la liturgia sempre a portata di mano.
          </p>

          <hr style={{ border: "none", borderTop: "1px solid var(--sky-100)", marginBottom: 32 }} />

          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "var(--sky-700)", marginBottom: 16 }}>
            Perché questo nome?
          </h2>
          <p style={{ marginBottom: 20 }}>
            Il nome del progetto richiama un'immagine biblica profonda, descritta in un{" "}
            <a href="https://archive.ph/JL6Dn" target="_blank" rel="noopener noreferrer" style={{ color: "var(--sky-500)", fontWeight: 600, textDecoration: "underline" }}>
              articolo
            </a>{" "}
            dal cardinal Ravasi:
          </p>

          <blockquote style={{
            borderLeft: "4px solid var(--sky-300)",
            paddingLeft: 20, marginLeft: 0, marginBottom: 20,
            color: "var(--gray-600)", fontStyle: "italic",
            background: "var(--sky-50)", borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
            padding: "16px 20px",
          }}>
            «Elie Wiesel, premio Nobel 1986 per la pace, in un suo libro aveva rispolverato una suggestiva allegoria giudaica. Quando Giacobbe, in fuga da Esaù, il fratello beffato, era giunto a Betel, secondo la Bibbia (Genesi 28,10-19) aveva avuto una visione: "una scala poggiava sulla terra, mentre la sua cima raggiungeva il cielo; ed ecco, gli angeli di Dio salivano e scendevano su di essa". Ebbene – continuava la parabola giudaica – alla fine gli angeli si dimenticarono di ritirare la scala che, perciò, rimase piantata sulla terra. È, così, divenuta la scala musicale le cui note angeliche permettono ancora a Dio di scendere e parlarci e a noi di ascendere in cielo per raggiungerlo. Questo intreccio tra musica e fede è, così, divenuto una costante per l'esperienza artistica e religiosa».
          </blockquote>

          <p style={{ marginBottom: 32 }}>
            <strong style={{ color: "var(--gray-800)" }}>Sulàm</strong> (סֻלָּם) è il vocabolo ebraico originale usato in Genesi per indicare quella "scala". È stato scelto questo nome perché il canto può essere un ponte, una preghiera potente che ci mette in contatto con Dio, proprio come se fosse una scala da percorrere.
          </p>

          <hr style={{ border: "none", borderTop: "1px solid var(--sky-100)", marginBottom: 32 }} />

          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "var(--sky-700)", marginBottom: 16 }}>
            Il Progetto
          </h2>
          <p style={{ marginBottom: 20 }}>
            Sulàm è un progetto personale no-profit, nato come strumento gratuito a disposizione di tutti. L'evoluzione della piattaforma non si ferma qui: l'obiettivo futuro è arricchire costantemente l'esperienza degli animatori liturgici e dei musicisti.
          </p>

          <p style={{ fontWeight: 700, color: "var(--gray-800)", marginBottom: 12 }}>I prossimi passi:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {[
              { title: "Accordi musicali", desc: "Integrazione degli accordi per supportare chi suona." },
              { title: "Link all'ascolto", desc: "Inserimento di riferimenti multimediali per imparare e approfondire i brani." },
            ].map(({ title, desc }) => (
              <div key={title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sky-400)", marginTop: 8, flexShrink: 0 }} />
                <p><strong style={{ color: "var(--gray-800)" }}>{title}:</strong> {desc}</p>
              </div>
            ))}
          </div>

          <div style={{
            background: "linear-gradient(135deg, var(--sky-50), var(--sky-100))",
            borderRadius: "var(--radius)", padding: "20px 24px",
            border: "1px solid var(--sky-200)",
          }}>
            <p style={{ color: "var(--sky-800)", fontWeight: 500, fontStyle: "italic", lineHeight: 1.7 }}>
              La bellezza della musica è una via per l'incontro con il Signore. Sulàm esiste affinché questa "scala" sia alla portata di tutti, con un semplice clic.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// INSTALL PAGE (PWA)
// ============================================================
function InstallPage() {
  const Card = ({ title, icon, steps, note }) => (
    <div
      className="card"
      style={{
        padding: "18px 20px",
        border: "1px solid var(--sky-100)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "12px",
            background: "var(--sky-100)",
            color: "var(--sky-700)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
          }}
        >
          {icon}
        </div>
        <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "1rem", color: "var(--sky-700)" }}>
          {title}
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, lineHeight: 1.75, color: "var(--gray-700)", fontSize: "0.95rem" }}>
        {steps.map((s, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "var(--sky-500)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.78rem",
                fontWeight: 800,
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {idx + 1}
            </div>
            <p style={{ margin: 0 }}>{s}</p>
          </div>
        ))}
      </div>

      {note ? (
        <div style={{ marginTop: 14, background: "var(--sky-50)", border: "1px solid var(--sky-100)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
          <p style={{ margin: 0, color: "var(--gray-600)", fontSize: "0.9rem" }}>{note}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "36px 20px 80px" }} className="fade-in">
      <div
        style={{
          background: "white",
          borderRadius: "var(--radius)",
          padding: "32px 36px",
          boxShadow: "var(--shadow-sm)",
          border: "1px solid var(--sky-100)",
        }}
      >
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              margin: "0 auto 14px",
              background: "linear-gradient(135deg, var(--sky-500), var(--sky-700))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "1.6rem",
              fontWeight: 900,
              boxShadow: "var(--shadow)",
            }}
          >
            ⬇️
          </div>
          <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: "1.7rem", color: "var(--sky-700)", marginBottom: 6 }}>
            installa l'app
          </h1>
          <p style={{ color: "var(--gray-500)", fontSize: "0.95rem", lineHeight: 1.7 }}>
            Sulàm può essere installata come app (PWA): avrai un’icona sulla schermata Home e potrai usarla anche offline.
          </p>
        </div>

        {/* Benefits */}
        <div style={{ marginBottom: 26 }}>
          <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "1.05rem", color: "var(--sky-700)", marginBottom: 10 }}>
            Perché installarla?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {[
              { t: "Uso offline", d: "I canti restano disponibili anche senza connessione." },
              { t: "Icona in Home", d: "Avvio rapido come una vera app, senza cercare il sito nel browser." },
              { t: "Esperienza “app”", d: "Schermo intero, più fluida e comoda da usare durante la liturgia." },
            ].map(({ t, d }) => (
              <div key={t} style={{ background: "var(--sky-50)", border: "1px solid var(--sky-100)", borderRadius: "var(--radius-sm)", padding: "14px 16px" }}>
                <p style={{ margin: "0 0 6px", fontWeight: 800, color: "var(--sky-800)" }}>{t}</p>
                <p style={{ margin: 0, color: "var(--gray-600)", lineHeight: 1.7, fontSize: "0.92rem" }}>{d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card
            title="iPhone / iPad (Safari)"
            icon=""
            steps={[
              "Apri Sulàm in Safari.",
              "Tocca il pulsante Condividi (quadrato con freccia verso l’alto) in basso nella barra.",
              "Scorri e seleziona “Aggiungi a schermata Home”.",
              "Conferma il nome (es. “Sulàm”) e tocca “Aggiungi”.",
            ]}
            note="Nella barra in basso di Safari, l’icona Condividi è al centro. Dopo il tap, appare un menu a lista; cerca “Aggiungi a schermata Home” con l’icona “+” su un quadrato."
          />

          <Card
            title="Android (Chrome)"
            icon="🤖"
            steps={[
              "Apri Sulàm in Chrome.",
              "Tocca il menu ⋮ in alto a destra.",
              "Seleziona “Installa app” oppure “Aggiungi a schermata Home”.",
              "Conferma “Installa”.",
            ]}
            note="Nel menu ⋮ di Chrome compare una voce con icona di download o un segno “+”. Se vedi “Installa app”, è l’opzione migliore."
          />

          <Card
            title="Android (Firefox / Samsung Internet / altri)"
            icon="🌐"
            steps={[
              "Apri Sulàm nel browser che usi.",
              "Apri il menu del browser (⋮ o ☰).",
              "Cerca “Aggiungi a schermata Home” o “Installa”.",
              "Conferma l’aggiunta/installa e avvia Sulàm dall’icona in Home.",
            ]}
            note="Se non trovi l’opzione “Installa”, prova con Chrome: alcuni browser mostrano solo “Aggiungi a schermata Home” oppure non supportano l’installazione completa su tutti i dispositivi."
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PRIVACY PAGE
// ============================================================
function PrivacyPage() {
  const year = new Date().getFullYear();
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "36px 20px 80px" }} className="fade-in">
      <div style={{
        background: "white", borderRadius: "var(--radius)",
        padding: "36px 40px",
        boxShadow: "var(--shadow-sm)", border: "1px solid var(--sky-100)",
      }}>
        <h1 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: "1.7rem", color: "var(--sky-700)", marginBottom: 6 }}>
          Privacy Policy
        </h1>
        <p style={{ color: "var(--gray-400)", fontSize: "0.8rem", marginBottom: 32 }}>Ultimo aggiornamento: {year}</p>

        <div style={{ lineHeight: 1.85, color: "var(--gray-700)", fontSize: "0.95rem", display: "flex", flexDirection: "column", gap: 28 }}>

          {[
            {
              title: "1. Titolare del trattamento",
              body: "Sulàm è un progetto personale no-profit. Per qualsiasi richiesta relativa alla privacy puoi contattarci tramite il modulo di segnalazione presente in ogni pagina canto."
            },
            {
              title: "2. Dati raccolti",
              body: "Sulàm non raccoglie dati personali in modo automatico. L'unico dato volontariamente fornito dall'utente è l'indirizzo email, opzionale, nel modulo di segnalazione modifiche. Questo dato viene conservato esclusivamente per rispondere alla segnalazione."
            },
            {
              title: "3. Conteggio visualizzazioni",
              body: "Per ogni canto viene incrementato un contatore anonimo di visualizzazioni (view_count). Questo dato non è associato ad alcuna informazione personale o identificativa dell'utente."
            },
            {
              title: "4. Cookie e tracciamento",
              body: "Sulàm non utilizza cookie di profilazione né strumenti di tracciamento pubblicitario. Non vengono installati cookie di terze parti. Il sito può fare uso di cookie tecnici strettamente necessari al funzionamento."
            },
            {
              title: "5. Servizi di terze parti",
              body: "Il database è ospitato su Supabase (supabase.com), soggetto alla propria privacy policy. I font sono caricati da Google Fonts. Eventuali link audio rimandano a piattaforme esterne (es. YouTube) soggette alle rispettive policy."
            },
            {
              title: "6. Diritti dell'utente",
              body: "Hai il diritto di richiedere la cancellazione di qualsiasi dato personale fornito volontariamente (es. email nelle segnalazioni). Per esercitare questo diritto, contattaci tramite il modulo di segnalazione."
            },
          ].map(({ title, body }) => (
            <div key={title}>
              <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--sky-700)", marginBottom: 8 }}>{title}</h2>
              <p>{body}</p>
            </div>
          ))}

          <hr style={{ border: "none", borderTop: "1px solid var(--sky-100)" }} />

          <div>
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--sky-700)", marginBottom: 8 }}>Copyright</h2>
            <p style={{ marginBottom: 12 }}>
              © {year} Sulàm — tutti i diritti riservati sul codice sorgente e sul design della piattaforma.
            </p>
            <p style={{ marginBottom: 12 }}>
              I testi e gli accordi dei canti presenti nel database appartengono ai rispettivi autori ed editori. Sulàm li riporta esclusivamente a scopo liturgico e non commerciale, nel rispetto dell'uso fair dealing per finalità religiose.
            </p>
            <p>
              Per segnalare una violazione di copyright relativa a un testo specifico, utilizza il pulsante <strong>"Segnala modifica"</strong> presente in fondo a ogni pagina canto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RICHIESTA NUOVO CANTO MODAL
// ============================================================
function RichiestaCantoModal({ onClose }) {
  const [form, setForm] = useState({
    Title: "",
    Content: "",
    Autori: "",
    Album: "",
    Anno: "",
    link_ascolto: "",
    email_utente: "",
    note: "",
  });
  const [stato, setStato] = useState("idle"); // idle | sending | success | error

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.Title.trim()) return;
    setStato("sending");
    try {
      const payload = {
        titolo: sanitizeInput(form.Title, 300),
        testo: sanitizeInput(form.Content, 10000) || null,
        autori: sanitizeInput(form.Autori, 300) || null,
        album: sanitizeInput(form.Album, 300) || null,
        anno: form.Anno ? parseInt(form.Anno, 10) || null : null,
        link_ascolto: sanitizeInput(form.link_ascolto, 500) || null,
        email_utente: sanitizeInput(form.email_utente, 200) || null,
        note: sanitizeInput(form.note, 1000) || null,
      };
      const { error } = await supabase.from("richieste_canti").insert(payload);
      setStato(error ? "error" : "success");
    } catch {
      setStato("error");
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    border: "1.5px solid var(--sky-200)",
    borderRadius: "var(--radius-sm)",
    fontFamily: "'Montserrat', sans-serif",
    fontSize: "0.88rem",
    background: "white",
    color: "var(--gray-800)",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "var(--sky-700)",
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        background: "white",
        borderRadius: "var(--radius)",
        padding: "28px 28px 24px",
        width: "min(560px, calc(100vw - 24px))",
        maxHeight: "85vh",
        overflowY: "auto",
        zIndex: 102,
        boxShadow: "var(--shadow-lg)",
        animation: "fadeIn 0.25s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--gray-800)", marginBottom: 3 }}>
              Richiedi un canto
            </h3>
            <p style={{ fontSize: "0.78rem", color: "var(--gray-400)" }}>
              Solo il titolo è obbligatorio. Gli altri campi sono facoltativi.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 8, borderRadius: "50%", flexShrink: 0 }}>
            <Icons.Close />
          </button>
        </div>

        {stato === "success" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "var(--sky-100)", margin: "0 auto 16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--sky-500)",
            }}>
              <Icons.Check />
            </div>
            <p style={{ fontWeight: 700, color: "var(--gray-800)", fontSize: "1rem" }}>Richiesta inviata!</p>
            <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", marginTop: 6, lineHeight: 1.6 }}>
              Grazie per il tuo contributo.<br />Valuteremo l'inserimento del canto il prima possibile.
            </p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>Chiudi</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Titolo */}
              <div>
                <label style={labelStyle}>Titolo del canto *</label>
                <input
                  style={inputStyle}
                  value={form.Title}
                  onChange={e => set("Title", e.target.value)}
                  placeholder="Es. Anima Christi"
                />
              </div>

              {/* Autori + Anno */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Autori</label>
                  <input style={inputStyle} value={form.Autori} onChange={e => set("Autori", e.target.value)} placeholder="Es. Marco Frisina" />
                </div>
                <div>
                  <label style={labelStyle}>Anno</label>
                  <input style={{ ...inputStyle, width: 90 }} type="number" value={form.Anno} onChange={e => set("Anno", e.target.value)} placeholder="2000" min="1900" max="2099" />
                </div>
              </div>

              {/* Album */}
              <div>
                <label style={labelStyle}>Album / Raccolta</label>
                <input style={inputStyle} value={form.Album} onChange={e => set("Album", e.target.value)} placeholder="Es. Pane di Vita nuova" />
              </div>

              {/* Link Youtube */}
              <div>
                <label style={labelStyle}>Link YouTube</label>
                <input style={inputStyle} type="url" value={form.link_ascolto} onChange={e => set("link_ascolto", e.target.value)} placeholder="https://www.youtube.com/..." />
              </div>

              {/* Testo */}
              <div>
                <label style={labelStyle}>Testo del canto</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
                  value={form.Content}
                  onChange={e => set("Content", e.target.value)}
                  placeholder="Incolla qui il testo del canto (opzionale)..."
                  rows={5}
                />
              </div>

              {/* Divider */}
              <hr style={{ border: "none", borderTop: "1px solid var(--sky-100)", margin: "2px 0" }} />

              {/* Email + Note */}
              <div>
                <label style={labelStyle}>Tua email (opzionale)</label>
                <input style={inputStyle} type="email" value={form.email_utente} onChange={e => set("email_utente", e.target.value)} placeholder="per ricevere aggiornamenti sull'inserimento" />
              </div>

              <div>
                <label style={labelStyle}>Note aggiuntive</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical" }}
                  value={form.note}
                  onChange={e => set("note", e.target.value)}
                  placeholder="Altre informazioni utili..."
                  rows={2}
                />
              </div>
            </div>

            {stato === "error" && (
              <p style={{ color: "#EF4444", fontSize: "0.8rem", marginTop: 12 }}>
                Errore nell'invio. Riprova.
              </p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={onClose}>Annulla</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={stato === "sending" || !form.Title.trim()}
                style={{ opacity: (stato === "sending" || !form.Title.trim()) ? 0.6 : 1 }}
              >
                {stato === "sending" ? "Invio..." : "Invia richiesta"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ============================================================
// FOOTER
// ============================================================
function Footer({ onNavigate, onRichiesta, isSticky }) {
  const year = new Date().getFullYear();
  return (
    <footer style={{
      borderTop: "1px solid var(--sky-100)",
      background: "white",
      padding: "16px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
      ...(isSticky ? {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
      } : {
        position: "static",
        marginTop: 32,
      }),
    }}>
      {/* Bottoni — su mobile vanno prima, su desktop a destra */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <button
          className="btn btn-ghost"
          onClick={onRichiesta}
          style={{ fontSize: "0.75rem", padding: "6px 10px", color: "var(--sky-600)", fontWeight: 700 }}
        >
          ✦ richiedi un canto
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onNavigate("install")}
          style={{ fontSize: "0.75rem", padding: "6px 10px", color: "var(--gray-400)" }}
        >
          installa
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onNavigate("privacy")}
          style={{ fontSize: "0.75rem", padding: "6px 10px", color: "var(--gray-400)" }}
        >
          privacy
        </button>
      </div>

      {/* Copyright — su mobile finisce in fondo grazie a order */}
      <p style={{
        fontSize: "0.75rem",
        color: "var(--gray-400)",
        fontFamily: "'Montserrat', sans-serif",
        width: "100%",         // occupa tutta la larghezza su mobile → va a capo sotto
        textAlign: "right",
      }}>
        © {year} sulàm
      </p>
    </footer>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [page, setPage] = useState("home"); // "home" | "canto" | "about" | "install" | "privacy" | "lista"
  const [selectedCanto, setSelectedCanto] = useState(null);
  const [cantoFull, setCantoFull] = useState(null);
  const [loadingCanto, setLoadingCanto] = useState(false);
  const [listaSlug, setListaSlug] = useState(null);
  const [previousPage, setPreviousPage] = useState("home");
  const [showRichiesta, setShowRichiesta] = useState(false);
  const [homeSearch, setHomeSearch] = useState("");
  const [homeFilters, setHomeFilters] = useState({});

  useEffect(() => {
    const path = window.location.pathname || "";
    const listaMatch = path.match(/^\/lista\/([^/]+)/);
    const cantoMatch = path.match(/^\/canto\/(\d+)/);

    if (listaMatch && listaMatch[1]) {
      setListaSlug(listaMatch[1]);
      setPage("lista");
      return;
    }

    if (cantoMatch && cantoMatch[1]) {
      const id = parseInt(cantoMatch[1], 10);
      if (!Number.isFinite(id)) return;

      let cancelled = false;
      const load = async () => {
        setLoadingCanto(true);
        try {
          const { data } = await supabase
            .from("sulam_canti")
            .select("*")
            .eq("id", id);
          if (cancelled) return;
          if (data && data.length > 0) {
            setCantoFull(data[0]);
            setSelectedCanto(data[0]);
            setPage("canto");
          } else {
            setCantoFull(null);
          }
        } catch {
          if (!cancelled) setCantoFull(null);
        } finally {
          if (!cancelled) setLoadingCanto(false);
        }
      };

      load();
      return () => {
        cancelled = true;
      };
    }
  }, []);

  const handleNavigate = useCallback((dest) => {
    setPage(dest);
    if (dest !== "canto") { setSelectedCanto(null); setCantoFull(null); }
    window.scrollTo(0, 0);
    if (dest === "home") {
      try {
        window.history.pushState({}, "", "/");
      } catch {
        // ignore history errors
      }
    }
  }, []);

  const handleSelectCanto = useCallback(async (canto) => {
    setSelectedCanto(canto);
    setPreviousPage(page);
    setPage("canto");
    setLoadingCanto(true);
    window.scrollTo(0, 0);
    try {
      window.history.pushState({}, "", `/canto/${canto.id}`);
    } catch {
      // ignore history errors
    }

    try {
      const { data } = await supabase
        .from("sulam_canti")
        .select("*")
        .eq("id", canto.id);
      if (data && data.length > 0) {
        setCantoFull(data[0]);
      } else {
        const mock = MOCK_CANTI.find(c => c.id === canto.id);
        setCantoFull(mock || canto);
      }
    } catch {
      setCantoFull(canto);
    }
    setLoadingCanto(false);
  }, [page]);

  const handleBack = useCallback(() => {
    setSelectedCanto(null);
    setCantoFull(null);
    window.scrollTo(0, 0);
    if (previousPage === "lista" && listaSlug) {
      setPage("lista");
      try {
        window.history.pushState({}, "", `/lista/${listaSlug}`);
      } catch {}
    } else {
      setPage("home");
      try {
        window.history.pushState({}, "", `/`);
      } catch {}
    }
  }, [previousPage, listaSlug]);

  return (
    <>
      <GlobalStyle />
      <div style={{ minHeight: "100vh", background: "var(--sky-50)", paddingBottom: page === "home" ? "64px" : "0" }}>
        <Header
          showBack={page === "canto"}
          onBack={handleBack}
          onNavigate={handleNavigate}
        />

        {page === "canto" ? (
          loadingCanto ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 60 }}>
              <div style={{ width: 36, height: 36, border: "3px solid var(--sky-200)", borderTopColor: "var(--sky-500)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : (
            cantoFull && <CantoViewer canto={cantoFull} onBack={handleBack} />
          )
        ) : page === "about" ? (
          <AboutPage />
        ) : page === "install" ? (
          <InstallPage />
        ) : page === "privacy" ? (
          <PrivacyPage />
        ) : page === "lista" && listaSlug ? (
          <ListaPage slug={listaSlug} onSelectCanto={handleSelectCanto} />
        ) : (
          <HomePage
          onSelectCanto={handleSelectCanto}
          search={homeSearch}
          setSearch={setHomeSearch}
          filters={homeFilters}
          setFilters={setHomeFilters}
        />
        )}
        {showRichiesta && <RichiestaCantoModal onClose={() => setShowRichiesta(false)} />}
        <Footer onNavigate={handleNavigate} onRichiesta={() => setShowRichiesta(true)} isSticky={page === "home"} />
      </div>
    </>
  );
}

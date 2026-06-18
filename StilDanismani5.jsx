import { useState, useCallback } from "react";

const C = {
  cream: "#F5F0E8", warm: "#FDFAF5", charcoal: "#1C1C1A",
  muted: "#8A8478", accent: "#C4A882", accentDark: "#9E7F5A",
  border: "#E2DAD0", green: "#7A9E7E", orange: "#C4956A",
};

function resizeImage(dataUrl, maxW = 1024, maxH = 1024) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxW && height <= maxH) { resolve(dataUrl); return; }
      const ratio = Math.min(maxW / width, maxH / height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}

function ScoreRing({ score, size = 48 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 10) * circ;
  const color = score >= 7 ? C.green : score >= 5 ? C.accent : C.orange;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={3} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: size * 0.3, fill: color, fontWeight: 400 }}>{score}</text>
    </svg>
  );
}

function CategoryCard({ emoji, label, score, yorum, oneriler }) {
  if (!yorum || yorum.toLowerCase().includes("belirlenemiyor") || yorum.toLowerCase().includes("görünmüyor")) return null;
  const color = score >= 7 ? C.green : score >= 5 ? C.accent : C.orange;
  return (
    <div style={{ background: C.warm, borderRadius: 6, padding: "0.9rem 1rem", borderTop: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <ScoreRing score={score} size={44} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{emoji} {label}</div>
          <div style={{ fontSize: 13, color: C.charcoal, lineHeight: 1.6 }}>{yorum}</div>
          {oneriler?.filter(o => o?.trim()).length > 0 && (
            <div style={{ marginTop: "0.5rem", borderTop: `1px solid ${C.border}`, paddingTop: "0.45rem" }}>
              {oneriler.filter(o => o?.trim()).map((o, i) => (
                <div key={i} style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 2 }}>→ {o}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const KATEGORILER = [
  { key: "sac", emoji: "💇", label: "Saç" },
  { key: "makyaj", emoji: "✨", label: "Makyaj / Cilt" },
  { key: "aksesuar", emoji: "💍", label: "Aksesuar" },
  { key: "giysi", emoji: "👗", label: "Giysi & Renkler" },
  { key: "genel_kombin", emoji: "🪞", label: "Genel Kombin" },
];

export default function StilDanismani() {
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const loadFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const resized = await resizeImage(ev.target.result);
      setImage({ dataUrl: resized, base64: resized.split(",")[1] });
      setResult(null); setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const analyze = async () => {
    if (!image || loading) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1200,
          system: `Sen deneyimli bir kişisel stil danışmanısın. Fotoğraftaki kişinin görünümünü analiz et.
Yanıtını YALNIZCA geçerli JSON olarak ver. Markdown veya ek metin ekleme.
Format:
{
  "genel_puan": 7,
  "genel_his": "kombininin tek cümlelik özeti",
  "en_guclu": "en güçlü yön",
  "ilk_degistir": "öncelikli değiştirilmesi önerilen şey",
  "kategoriler": {
    "sac":          { "puan": 7, "yorum": "saç hakkında yorum", "oneriler": ["öneri"] },
    "makyaj":       { "puan": 5, "yorum": "makyaj veya cilt bakımı; görünmüyorsa 'Fotoğrafta belirlenemiyor' yaz", "oneriler": [] },
    "aksesuar":     { "puan": 5, "yorum": "takı, gözlük, çanta vb.; yoksa 'Fotoğrafta belirlenemiyor' yaz", "oneriler": [] },
    "giysi":        { "puan": 7, "yorum": "kıyafet ve renk uyumu", "oneriler": ["öneri"] },
    "genel_kombin": { "puan": 7, "yorum": "tüm parçaların birbiriyle uyumu", "oneriler": ["öneri"] }
  }
}
Türkçe, samimi ve yapıcı ol.`,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image.base64 } },
              { type: "text", text: "Bu kişinin tüm görünümünü kategorilere göre analiz et." }
            ]
          }]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.content?.[0]?.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(clean));
    } catch (err) {
      setError(err.message?.includes("JSON") || err.message?.includes("parse")
        ? "Model beklenmedik yanıt verdi. Tekrar dene."
        : "Bağlantı hatası. İnternet bağlantını kontrol et.");
    }
    setLoading(false);
  };

  const reset = () => { setImage(null); setResult(null); setError(null); };

  const btnBase = {
    border: "none", borderRadius: 4, fontSize: 13,
    letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
    padding: "13px 0", width: "100%", fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "system-ui, sans-serif", fontWeight: 300 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ padding: "1.1rem 1.25rem 0.9rem", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
        <div style={{ fontSize: 20, color: C.charcoal, letterSpacing: "0.04em" }}>
          Stil <span style={{ fontStyle: "italic", color: C.accentDark }}>Danışmanı</span>
        </div>
        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Kategorili görünüm analizi
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "1.25rem 1rem" }}>

        {/* Fotoğraf yok — yükleme ekranı */}
        {!image && (
          <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
            <div style={{ fontSize: 48, marginBottom: 14, opacity: 0.35 }}>📷</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 28, lineHeight: 1.8 }}>
              Baş ya da tam boy fotoğrafını yükle,<br />saçından ayakkabına analiz edelim.
            </div>

            {/* İki ayrı buton: Kamera + Galeri */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280, margin: "0 auto" }}>
              <label style={{ ...btnBase, display: "block", background: C.charcoal, color: C.cream, padding: "13px 0" }}>
                📷 Kameradan Çek
                <input type="file" accept="image/*" capture="user" onChange={e => loadFile(e.target.files[0])} style={{ display: "none" }} />
              </label>
              <label style={{ ...btnBase, display: "block", background: C.accentDark, color: C.cream, padding: "13px 0" }}>
                🖼 Galeriden Seç
                <input type="file" accept="image/*" onChange={e => loadFile(e.target.files[0])} style={{ display: "none" }} />
              </label>
            </div>
          </div>
        )}

        {/* Fotoğraf var */}
        {image && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.5fr)", gap: "1.25rem" }}>

            {/* Sol */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <img src={image.dataUrl} alt="Yüklenen"
                style={{ width: "100%", borderRadius: 6, objectFit: "cover", maxHeight: 400, border: `2px solid ${C.accent}` }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <label style={{ textAlign: "center", background: "transparent", color: C.muted, padding: "8px", borderRadius: 3, border: `1px solid ${C.border}`, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
                  📷 Kamera
                  <input type="file" accept="image/*" capture="user" onChange={e => loadFile(e.target.files[0])} style={{ display: "none" }} />
                </label>
                <label style={{ textAlign: "center", background: "transparent", color: C.muted, padding: "8px", borderRadius: 3, border: `1px solid ${C.border}`, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
                  🖼 Galeri
                  <input type="file" accept="image/*" onChange={e => loadFile(e.target.files[0])} style={{ display: "none" }} />
                </label>
              </div>

              {!result && !loading && (
                <button onClick={analyze} style={{ ...btnBase, background: C.charcoal, color: C.cream }}>
                  Analiz Et
                </button>
              )}
              {result && !loading && (
                <button onClick={analyze} style={{ ...btnBase, background: C.accentDark, color: C.cream }}>
                  Yeniden Analiz Et
                </button>
              )}
              <button onClick={reset} style={{ ...btnBase, background: "transparent", color: C.muted, border: `1px solid ${C.border}`, fontSize: 11 }}>
                Temizle
              </button>
            </div>

            {/* Sağ: Sonuçlar */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

              {loading && (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: C.muted }}>
                  <div style={{ width: 30, height: 30, border: `2px solid ${C.border}`, borderTopColor: C.accentDark, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 13 }}>Kategorileri inceliyorum…</div>
                </div>
              )}

              {error && !loading && (
                <div style={{ background: "#FFF8F0", border: `1px solid ${C.orange}`, borderRadius: 4, padding: "1rem", fontSize: 13, color: "#8A5A2A", lineHeight: 1.6 }}>
                  ⚠️ {error}
                  <div style={{ marginTop: 10 }}>
                    <button onClick={analyze} style={{ background: C.charcoal, color: C.cream, border: "none", padding: "8px 16px", borderRadius: 3, fontSize: 11, cursor: "pointer" }}>
                      Tekrar Dene
                    </button>
                  </div>
                </div>
              )}

              {!loading && !result && !error && (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: C.muted, fontSize: 13, lineHeight: 1.8 }}>
                  Fotoğraf hazır.<br />
                  <span style={{ color: C.accentDark }}>"Analiz Et"</span> butonuna bas.
                </div>
              )}

              {result && !loading && (
                <>
                  <div style={{ background: C.warm, borderRadius: 6, padding: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                    <ScoreRing score={result.genel_puan} size={58} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.charcoal, marginBottom: 5, lineHeight: 1.4 }}>{result.genel_his}</div>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
                        🌟 <strong>En güçlü:</strong> {result.en_guclu}<br />
                        🔧 <strong>İlk değiştir:</strong> {result.ilk_degistir}
                      </div>
                    </div>
                  </div>
                  {KATEGORILER.map(({ key, emoji, label }) =>
                    result.kategoriler?.[key] ? (
                      <CategoryCard key={key} emoji={emoji} label={label}
                        score={result.kategoriler[key].puan}
                        yorum={result.kategoriler[key].yorum}
                        oneriler={result.kategoriler[key].oneriler}
                      />
                    ) : null
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

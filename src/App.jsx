import { useState } from "react";

const WORDS_PER_MINUTE = 150;
const MAX_SESSION_MINUTES = 30;
const MAX_SESSION_WORDS = WORDS_PER_MINUTE * MAX_SESSION_MINUTES;

function analyzeText(text) {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const words = text.trim().split(/\s+/).length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = words / Math.max(sentences.length, 1);
  const dialogueMatches = (text.match(/[""][^""]+[""]/g) || []).join(" ");
  const dialogueWords = dialogueMatches.split(/\s+/).length;
  const dialogueRatio = dialogueWords / Math.max(words, 1);
  const longParagraphs = paragraphs.filter(p => p.split(/\s+/).length > 150).length;
  const vocalLoad = Math.min(100, Math.round(
    (avgSentenceLength / 25) * 30 +
    (1 - dialogueRatio) * 40 +
    (longParagraphs / Math.max(paragraphs.length, 1)) * 30
  ));

  // detect cold read risk sentences: flag sentences over 40 words or with high punctuation density
  const sentMatches = text.match(/[^.!?]+[.!?]?/g) || [];
  const sentList = sentMatches.map(s => s.trim()).filter(Boolean);
  const flagged = sentList.map(s => {
    const sWords = s.split(/\s+/).filter(Boolean).length;
    const punctMatches = s.match(/[^\w\s]/g) || [];
    const punctRatio = punctMatches.length / Math.max(sWords, 1);
    const reasons = [];
    if (sWords > 40) reasons.push('long sentence');
    // only flag punctuation density for sentences >= 10 words; increase threshold to 0.25
    if (sWords >= 10 && punctRatio > 0.25) reasons.push('high punctuation density');
    return reasons.length ? { sentence: s, words: sWords, punctRatio: Math.round(punctRatio * 1000)/1000, reasons } : null;
  }).filter(Boolean);

  return { words, paragraphs, vocalLoad, dialogueRatio, avgSentenceLength, coldReadFlags: flagged, coldReadCount: flagged.length };
}

function analyzeRegister(text) {
  const t = (text || '').toLowerCase();
  const keywords = {
    TENSION: ['anxious','tension','tense','heartbeat','pulse','breathless','uneasy','nervous','panic','urgent','taut','clench','tight'],
    GRIEF: ['grief','sorrow','weep','tremble','mourning','broken','tears','loss','sadness','lament','bereft','anguish'],
    INTROSPECTION: ['think','thought','remember','reflect','ponder','introspect','consider','memory','recall','wonder','contemplate','silence'],
    DIALOGUE: ['said','asked','replied','"','"says','says','asked.','said.','"said"','"asked"'],
    ACTION: ['run','chase','punch','fight','sprint','jump','grab','pushed','pulled','collapse','shoot','attack','burst','dash','strike'],
    EXPOSITION: ['explained','described','information','history','background','details','therefore','however','furthermore','moreover','in conclusion']
  };
  const scores = {};
  Object.keys(keywords).forEach(k => { scores[k] = 0; keywords[k].forEach(w => { const re = new RegExp('\\b' + w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'g'); const m = t.match(re); if (m) scores[k] += m.length; }); });
  const order = ['TENSION','GRIEF','INTROSPECTION','DIALOGUE','ACTION','EXPOSITION'];
  let best = order[0]; let bestScore = scores[best] || 0;
  order.forEach(k => { if ((scores[k] || 0) > bestScore) { best = k; bestScore = scores[k]; } });
  const notes = {
    TENSION: 'Maintain controlled intensity; favor clipped delivery.',
    GRIEF: 'Allow space and softness; let pauses breathe.',
    INTROSPECTION: 'Slow pacing and intimate tone; subtle dynamics.',
    DIALOGUE: 'Differentiate voices and cadence for characters.',
    ACTION: 'Increase energy, keep crisp consonants and drive.',
    EXPOSITION: 'Steady, clear narration; neutral and informative.'
  };
  return { register: best, note: notes[best] || '' };
}

function splitIntoSessions(paragraphs, chapterName) {
  const sessions = [];
  let current = [];
  let currentWords = 0;
  let sessionIndex = 0;

  paragraphs.forEach((para) => {
    const paraWords = para.split(/\s+/).length;
    if (currentWords + paraWords > MAX_SESSION_WORDS && current.length > 0) {
      sessions.push({
        id: sessionIndex,
        name: `${chapterName} — Session ${String.fromCharCode(65 + sessionIndex)}`,
        paragraphs: current,
        words: currentWords
      });
      sessionIndex++;
      current = [para];
      currentWords = paraWords;
    } else {
      current.push(para);
      currentWords += paraWords;
    }
  });

  if (current.length > 0) {
    sessions.push({
      id: sessionIndex,
      name: `${chapterName} — Session ${String.fromCharCode(65 + sessionIndex)}`,
      paragraphs: current,
      words: currentWords
    });
  }

  return sessions;
}

function getLoadColor(score) {
  if (score >= 70) return "#A84832";
  if (score >= 40) return "#C4752A";
  return "#5C8C5A";
}

function getLoadLabel(score) {
  if (score >= 70) return "HIGH LOAD";
  if (score >= 40) return "MODERATE";
  return "LIGHT";
}

const css = {
  bg: "#0F0C08",
  surface: "#1A1610",
  surface2: "#211D14",
  border: "#2A2218",
  amber: "#D4923A",
  gold: "#8B6914",
  cream: "#F2E8D9",
  muted: "#7A6A55",
  muted2: "#3A3020",
  success: "#5C8C5A",
  warning: "#C4752A",
  danger: "#A84832",
  mono: "'Courier New', monospace",
  sans: "'Georgia', serif",
};

function StatCell({ label, val, color }) {
  return (
    <div style={{ background: css.surface, padding: "16px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: css.mono, fontSize: 22, fontWeight: 700, color: color || css.amber, marginBottom: 4 }}>{val}</div>
      <div style={{ fontFamily: css.mono, fontSize: 9, color: css.muted, letterSpacing: 2, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function SessionCard({ session, index, done, onToggle }) {
  const recTime = Math.ceil(session.words / WORDS_PER_MINUTE);
  const editTime = Math.ceil(recTime * 1.5);
  const analysis = analyzeText(session.paragraphs.join("\n\n"));
  const reg = analyzeRegister(session.paragraphs.join("\n\n"));
  const loadColor = getLoadColor(analysis.vocalLoad);

  return (
    <div style={{
      background: done ? "#141A12" : css.surface,
      border: `1px solid ${done ? css.success : css.border}`,
      borderLeft: `4px solid ${loadColor}`,
      borderRadius: 2,
      padding: "20px 24px",
      marginBottom: 12,
      opacity: done ? 0.65 : 1,
      transition: "all 0.25s"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: css.mono, fontSize: 10, color: css.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            Session {index + 1}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: css.sans, fontSize: 17, fontWeight: 600, color: done ? css.success : css.cream, fontStyle: "italic" }}>
              {session.name}
            </div>
            <div title={reg.note} style={{ background: css.surface2, border: `1px solid ${css.amber}`, color: css.amber, padding: '4px 8px', borderRadius: 12, fontFamily: css.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              {reg.register}
            </div>
          </div>
        </div>
        <button
          onClick={() => onToggle(session.id)}
          style={{
            background: done ? css.success : "transparent",
            border: `1px solid ${done ? css.success : css.border}`,
            color: done ? css.bg : css.muted,
            padding: "6px 14px",
            borderRadius: 2,
            fontFamily: css.mono,
            fontSize: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          {done ? "✓ Done" : "Mark Done"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Words", val: session.words.toLocaleString() },
          { label: "Rec Time", val: `~${recTime} min` },
          { label: "Edit Time", val: `~${editTime} min` },
          { label: "Paragraphs", val: session.paragraphs.length },
        ].map(s => (
          <div key={s.label} style={{ background: css.bg, border: `1px solid ${css.border}`, padding: "10px 12px", borderRadius: 2 }}>
            <div style={{ fontFamily: css.mono, fontSize: 9, color: css.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: css.mono, fontSize: 15, fontWeight: 700, color: css.cream }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: css.mono, fontSize: 9, color: css.muted, letterSpacing: 2, textTransform: "uppercase", whiteSpace: "nowrap" }}>Vocal Load</div>
        <div style={{ flex: 1, height: 3, background: css.border, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${analysis.vocalLoad}%`, height: "100%", background: loadColor, transition: "width 1.2s ease" }} />
        </div>
        <span style={{ fontFamily: css.mono, fontSize: 10, color: loadColor, letterSpacing: 1, whiteSpace: "nowrap" }}>
          {analysis.vocalLoad} — {getLoadLabel(analysis.vocalLoad)}
        </span>
      </div>

      {analysis.vocalLoad >= 70 && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#2A100A", border: `1px solid ${css.danger}`, borderRadius: 2, fontFamily: css.mono, fontSize: 11, color: css.danger }}>
          ⚠ High vocal load — rest your voice for 10 minutes before recording this session
        </div>
      )}

      {analysis.dialogueRatio > 0.4 && (
        <div style={{ marginTop: 8, padding: "8px 12px", background: "#1A1A0A", border: `1px solid ${css.gold}`, borderRadius: 2, fontFamily: css.mono, fontSize: 11, color: css.amber }}>
          ✦ High dialogue ratio — lighter performance, good warm-up session
        </div>
      )}

      {analysis.coldReadCount > 0 && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#2A2414", border: `1px solid ${css.amber}`, borderRadius: 2, fontFamily: css.mono, fontSize: 11, color: css.amber }}>
          ⚠ Cold-read risk — {analysis.coldReadCount} sentence{analysis.coldReadCount > 1 ? 's' : ''} flagged.
          <div style={{ marginTop: 8, fontSize: 12, color: css.cream }}>
            {analysis.coldReadFlags.slice(0,3).map((f, idx) => (
              <div key={idx} style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: css.mono, fontSize: 11, color: css.amber, marginBottom: 4 }}>{f.reasons.join(', ')}</div>
                <div style={{ color: css.muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{f.sentence.trim()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CHECKLIST = [
  "Find the quietest room — a closet works perfectly",
  "Close windows and turn off fans, AC, and ceiling fans",
  "Silence your phone and turn off notifications",
  "Record a 10-second test clip and play it back",
  "Drink a glass of water — room temperature, not cold",
  "Read the first paragraph silently before you hit record",
  "Set your phone to Do Not Disturb mode",
  "Take three slow breaths — start when you're settled",
];

function PanelHeader({ dot, label }) {
  return (
    <div style={{
      padding: "11px 20px",
      background: css.surface2,
      borderBottom: `1px solid ${css.border}`,
      fontFamily: css.mono,
      fontSize: 10,
      color: css.muted,
      letterSpacing: 3,
      textTransform: "uppercase",
      display: "flex",
      alignItems: "center",
      gap: 10
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, display: "inline-block", flexShrink: 0 }} />
      {label}
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState("input");
  const [chapterName, setChapterName] = useState("");
  const [manuscript, setManuscript] = useState("");
  const [sessions, setSessions] = useState([]);
  const [done, setDone] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [checklist, setChecklist] = useState({});

  function generate() {
    if (!manuscript.trim() || manuscript.trim().split(/\s+/).length < 10)
      return alert("Paste at least a few paragraphs of your manuscript.");
    const name = chapterName.trim() || "Chapter";
    const result = analyzeText(manuscript);
    const built = splitIntoSessions(result.paragraphs, name);
    setAnalysis(result);
    setSessions(built);
    setDone({});
    setChecklist({});
    setStep("plan");
  }

  function toggleDone(id) {
    setDone(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleCheck(i) {
    setChecklist(prev => ({ ...prev, [i]: !prev[i] }));
  }

  // function to export the session plan as a downloadable markdown file
  function exportPlan() {
    const name = chapterName.trim() || "Chapter";
    const header = `# ${name} — Recording Plan\n\n`;
    const stats = `- Total words: ${totalWords}\n- Sessions: ${totalSessions}\n- Estimated recording time: ~${totalRecTime} min\n- Completed: ${doneCount}/${totalSessions}\n\n`;
    const checklistMd = '## Studio Anywhere Checklist\n' + CHECKLIST.map((item,i) => `- [${checklist[i] ? 'x' : ' '}] ${item}`).join('\n') + '\n\n';
    const sessionsMd = sessions.map(s => `### ${s.name}\n\n**Words:** ${s.words}\n\n${s.paragraphs.map(p=>p.trim()).join('\n\n')}\n`).join('\n---\n\n');
    const content = header + stats + checklistMd + '## Sessions\n\n' + sessionsMd;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9_\- ]/gi,'').replace(/\s+/g,'_').toLowerCase()}_recording_plan.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const doneCount = Object.values(done).filter(Boolean).length;
  const totalSessions = sessions.length;
  const totalWords = analysis?.words || 0;
  const totalRecTime = Math.ceil(totalWords / WORDS_PER_MINUTE);
  const progressPct = totalSessions ? (doneCount / totalSessions) * 100 : 0;
  const checkCount = Object.values(checklist).filter(Boolean).length;

  return (
    <div style={{ background: css.bg, minHeight: "100vh", color: css.cream, fontFamily: css.sans }}>

      {/* DOT GRID */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `radial-gradient(circle, ${css.border} 1px, transparent 1px)`,
        backgroundSize: "32px 32px", opacity: 0.5
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>

        {/* HEADER */}
        <div style={{ marginBottom: 44 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <div style={{
              width: 42, height: 42,
              border: `1px solid ${css.amber}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, position: "relative"
            }}>
              <div style={{ position: "absolute", inset: 4, border: `1px solid ${css.gold}30` }} />
              🎙
            </div>
            <div style={{ fontFamily: css.mono, fontSize: 26, fontWeight: 700, color: css.amber, letterSpacing: 6 }}>ATTUNE</div>
          </div>
          <div style={{ fontFamily: css.mono, fontSize: 11, color: css.muted, letterSpacing: 3, textTransform: "uppercase", marginLeft: 56 }}>
            Audiobook Performance Attunement Tool
          </div>
        </div>

        {/* INPUT SCREEN */}
        {step === "input" && (
          <>
            <div style={{ background: css.surface, border: `1px solid ${css.border}`, marginBottom: 16, overflow: "hidden" }}>
              <PanelHeader dot={css.amber} label="Chapter Name" />
              <input
                value={chapterName}
                onChange={e => setChapterName(e.target.value)}
                placeholder="e.g. Chapter 1 — The Beginning"
                style={{
                  width: "100%", background: "transparent", border: "none",
                  color: css.cream, fontFamily: css.sans, fontSize: 15,
                  padding: "18px 20px", outline: "none", boxSizing: "border-box",
                  fontStyle: "italic"
                }}
              />
            </div>

            <div style={{ background: css.surface, border: `1px solid ${css.border}`, marginBottom: 20, overflow: "hidden" }}>
              <PanelHeader dot={css.amber} label="Manuscript Text" />
              <textarea
                value={manuscript}
                onChange={e => setManuscript(e.target.value)}
                placeholder="Paste your manuscript here — one chapter at a time. The tool will structure it into optimal recording sessions for you."
                style={{
                  width: "100%", minHeight: 240, background: "transparent",
                  border: "none", color: css.cream, fontFamily: css.sans,
                  fontSize: 14, lineHeight: 1.9, padding: "20px",
                  outline: "none", resize: "vertical", boxSizing: "border-box"
                }}
              />
              <div style={{
                padding: "8px 20px", background: css.surface2,
                borderTop: `1px solid ${css.border}`,
                fontFamily: css.mono, fontSize: 11, color: css.muted,
                display: "flex", justifyContent: "space-between"
              }}>
                <span>{manuscript.trim() ? manuscript.trim().split(/\s+/).length.toLocaleString() : 0} words</span>
                <span>~{manuscript.trim() ? Math.ceil(manuscript.trim().split(/\s+/).length / WORDS_PER_MINUTE) : 0} min recording</span>
              </div>
            </div>

            <button
              onClick={generate}
              style={{
                width: "100%", background: css.amber, color: css.bg,
                border: "none", padding: "14px 0",
                fontFamily: css.mono, fontSize: 13, fontWeight: 700,
                letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                transition: "background 0.15s"
              }}
              onMouseOver={e => e.target.style.background = css.warning}
              onMouseOut={e => e.target.style.background = css.amber}
            >
              GENERATE RECORDING PLAN →
            </button>

            <div style={{ marginTop: 32, padding: 20, background: css.surface, border: `1px solid ${css.border}` }}>
              <div style={{ fontFamily: css.mono, fontSize: 9, color: css.muted, letterSpacing: 3, textTransform: "uppercase", marginBottom: 12 }}>How it works</div>
              {[
                "Paste one chapter of your manuscript",
                "ATTUNE splits it into 30-minute vocal performance sessions",
                "Each session gets a Vocal Load Score — so you know when to rest",
                "Work through the Studio Anywhere checklist before you hit record",
                "Mark sessions done as you record"
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 13, color: css.muted, lineHeight: 1.6 }}>
                  <span style={{ fontFamily: css.mono, color: css.amber, flexShrink: 0 }}>0{i + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* PLAN SCREEN */}
        {step === "plan" && (
          <>
            {/* STATS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: css.border, border: `1px solid ${css.border}`, marginBottom: 20 }}>
              <StatCell label="Total Words" val={totalWords.toLocaleString()} color={css.amber} />
              <StatCell label="Sessions" val={totalSessions} color="#7B61FF" />
              <StatCell label="Rec Time" val={`~${totalRecTime} min`} color={css.warning} />
              <StatCell label="Completed" val={`${doneCount}/${totalSessions}`} color={css.success} />
            </div>

            {/* PROGRESS */}
            <div style={{ height: 4, background: css.border, marginBottom: 6, overflow: "hidden" }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: css.success, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ fontFamily: css.mono, fontSize: 10, color: css.muted, letterSpacing: 2, marginBottom: 24, textAlign: "right" }}>
              {Math.round(progressPct)}% complete
            </div>

            {/* CHECKLIST */}
            <div style={{ background: css.surface, border: `1px solid ${css.border}`, marginBottom: 24, overflow: "hidden" }}>
              <PanelHeader dot="#7B61FF" label={`Studio Anywhere Checklist — ${checkCount}/${CHECKLIST.length} ready`} />
              <div style={{ padding: "8px 20px 16px" }}>
                {CHECKLIST.map((item, i) => (
                  <div
                    key={i}
                    onClick={() => toggleCheck(i)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 14,
                      padding: "11px 0",
                      borderBottom: i < CHECKLIST.length - 1 ? `1px solid ${css.border}` : "none",
                      cursor: "pointer"
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, minWidth: 18,
                      border: `1px solid ${checklist[i] ? css.success : css.border}`,
                      background: checklist[i] ? css.success : "transparent",
                      borderRadius: 2, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 11, color: css.bg, marginTop: 1
                    }}>
                      {checklist[i] ? "✓" : ""}
                    </div>
                    <span style={{
                      fontSize: 13, lineHeight: 1.6,
                      color: checklist[i] ? css.muted : "#B0A090",
                      textDecoration: checklist[i] ? "line-through" : "none"
                    }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SESSION CARDS */}
            <div style={{
              fontFamily: css.mono, fontSize: 10, color: css.muted,
              letterSpacing: 3, textTransform: "uppercase",
              marginBottom: 16, display: "flex", alignItems: "center", gap: 10
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: css.danger, display: "inline-block" }} />
              Recording Sessions — {sessions.length} total
            </div>

            {sessions.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                index={i}
                done={!!done[session.id]}
                onToggle={toggleDone}
              />
            ))}

            <button
              onClick={exportPlan}
              style={{
                width: "100%", background: "transparent",
                border: `1px solid ${css.amber}`, color: css.amber,
                padding: "12px 0", fontFamily: css.mono, fontSize: 11, fontWeight: 700,
                letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                marginTop: 20, transition: "border-color 0.15s"
              }}
              onMouseOver={e => e.target.style.borderColor = css.warning}
              onMouseOut={e => e.target.style.borderColor = css.amber}
            >
              EXPORT PLAN
            </button>

            <button
              onClick={() => setStep("input")}
              style={{
                width: "100%", background: "transparent",
                border: `1px solid ${css.border}`, color: css.muted,
                padding: "12px 0", fontFamily: css.mono, fontSize: 11,
                letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                marginTop: 12, transition: "border-color 0.15s"
              }}
              onMouseOver={e => e.target.style.borderColor = css.muted}
              onMouseOut={e => e.target.style.borderColor = css.border}
            >
              ← New Chapter
            </button>
          </>
        )}

      </div>
    </div>
  );
}
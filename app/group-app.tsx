"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useCloudData } from "../lib/storage/use-cloud-data";
import { isSnapshot, type Snapshot } from "../lib/storage/snapshot";
import { regionForGroup } from "../lib/groups";
import { AccessProvider, useAccess } from "../lib/auth/access-provider";
import { GroupMedia, GroupMediaContext, useGroupMedia } from "../lib/storage/group-media";
import { mascotQuestions, type MascotAnswers } from "../lib/mascot/questions";

type Page = "characters" | "journey" | "quiz" | "goals" | "avatar" | "mascot";
type Milestone = { id: string; title: string; text: string; date?: string; emoji: string; meeting?: string };
type Goal = { id: string; title: string; text: string; status: "יש לנו רעיון" | "מנסות ובונות" | "עשינו את זה! 🎉" };
type Question = { id: string; question: string; answers: string[]; correct: string; fact?: string };
type Character = { id: string; name: string; avatarId?: string; fallback: string; passion: string; power: string; item: string; vibe: string; quote?: string; learningGoal?: string };
type GroupData = { milestones: Milestone[]; goals: Goal[]; questions: Question[]; characters: Character[]; settings: { journeyTitle: string; journeySubtitle: string; titleColor: string; goalColor: string; charactersTitle:string; quizTitle:string; goalsTitle:string; avatarTitle:string; avatarButton:string; mascotTitle:string; mascotLoading:string } };

const MASCOT_IMAGE_ID = "queenb-group-mascot";
const statuses: Goal["status"][] = ["יש לנו רעיון", "מנסות ובונות", "עשינו את זה! 🎉"];
const defaultData: GroupData = {
  milestones: [
    { id: "m1", title: "מפגש 1 — הכרנו!", text: "יצרנו את הקבוצה שלנו והתחלנו לכתוב קוד.", emoji: "👑", meeting: "1" },
    { id: "m2", title: "שינוי קטן, תוצאה אמיתית", text: "ערכנו כמה שורות וראינו איך רעיון הופך למשהו שעובד על המסך.", emoji: "💻", meeting: "2" },
    { id: "m3", title: "הדבר הבא שנעז לנסות", text: "כאן נוסיף ניסוי, הצלחה או באג שלימד אותנו משהו חדש.", emoji: "✨" },
  ],
  goals: [
    { id: "g1", title: "לבנות משהו שעוזר למישהי", text: "להשתמש בקוד כדי לפתור בעיה אמיתית", status: "מנסות ובונות" },
    { id: "g2", title: "ליצור משחק משלנו", text: "להמציא, לבנות, לבדוק ולשפר יחד", status: "יש לנו רעיון" },
    { id: "g3", title: "לנסות גם כשעוד לא בטוחות", text: "כי באג הוא לא כישלון, הוא רמז לצעד הבא", status: "מנסות ובונות" },
    { id: "g4", title: "להציג פרויקט בגאווה", text: "גם אם הוא עדיין לא מושלם", status: "יש לנו רעיון" },
  ],
  questions: [
    { id: "q1", question: "מי בקבוצה הייתה ממלאת בריכה בסוכריות גומי?", answers: ["מאיה", "נועה", "דנה"], correct: "נועה", fact: "בחירה הגיונית לגמרי, אם שואלות אותנו 🍬" },
    { id: "q2", question: "למי בקבוצה יש שלושה אחים?", answers: ["דנה", "מאיה", "נועה"], correct: "מאיה", fact: "עכשיו אנחנו מבינות מאיפה כישורי המשא ומתן." },
  ],
  characters: [],
  settings: { journeyTitle: "המסע שלנו", journeySubtitle: "כאן נשמור את כל מה שניסינו, בנינו וגילינו בדרך", titleColor: "#17131d", goalColor: "#ffd6e7", charactersTitle:"הדמויות שלנו", quizTitle:"חידון על הקבוצה", goalsTitle:"לוח המטרות שלנו", avatarTitle:"הגיע הזמן לפגוש את הדמות שלך", avatarButton:"צרי את הדמות שלי ✨", mascotTitle:"מי תהיה הקמע של הקבוצה שלנו?", mascotLoading:"מחברות את כל הבחירות שלכן..." },
};

const challengesByPage:Record<Page,{id:string;label:string}[]>={
  characters:[{id:"charactersTitle",label:"שינוי כותרת הסקוואד"},{id:"characterQuote",label:"הוספת משפט לדמות"}],
  journey:[{id:"title",label:"שינוי כותרת"},{id:"subtitle",label:"שינוי משפט פתיחה"},{id:"color",label:"שינוי צבע הכותרת"},{id:"milestone",label:"הוספת רגע למסע"}],
  quiz:[{id:"quizTitle",label:"שינוי כותרת החידון"},{id:"question",label:"הוספת שאלה"},{id:"quizFact",label:"שינוי Fun fact"}],
  goals:[{id:"goalsTitle",label:"שינוי כותרת הלוח"},{id:"goalColor",label:"צביעת הכרטיסים"},{id:"goal",label:"הוספת מטרה"},{id:"goalStatus",label:"שינוי סטטוס בקוד"}],
  avatar:[{id:"avatarTitle",label:"שינוי כותרת היוצרת"},{id:"avatarButton",label:"שינוי טקסט הכפתור"}],
  mascot:[{id:"mascotTitle",label:"שינוי שאלת הפתיחה"},{id:"mascotLoading",label:"שינוי הודעת הקסם"}],
};

const nav: { id: Page; label: string; icon: string }[] = [
  { id: "characters", label: "הדמויות שלנו", icon: "♛" },
  { id: "journey", label: "המסע שלנו", icon: "↝" },
  { id: "quiz", label: "חידון על הקבוצה", icon: "?" },
  { id: "goals", label: "לוח מטרות", icon: "★" },
  { id: "avatar", label: "יצירת אווטרים", icon: "✦" },
  { id: "mascot", label: "הקמע שלנו", icon: "⚡" },
];

function id() { return crypto.randomUUID(); }
function cloneDefaults() { return JSON.parse(JSON.stringify(defaultData)) as GroupData; }
function migrateData(parsed:GroupData){
  const originalGoals=parsed.goals.some(goal=>goal.id==="g1"&&goal.title==="לבנות אתר לבד");
  const milestones=parsed.milestones.map(item=>item.id==="m2"&&item.title==="האתר הראשון שלנו"?defaultData.milestones[1]:item.id==="m3"&&item.title==="הפרק הבא מחכה לנו"?defaultData.milestones[2]:item);
  let goals=parsed.goals.map(goal=>{const status=(goal.status as string)==="רוצה לעשות"?"יש לנו רעיון":(goal.status as string)==="בדרך"?"מנסות ובונות":goal.status as Goal["status"];if(goal.id==="g1"&&goal.title==="לבנות אתר לבד")return defaultData.goals[0];if(goal.id==="g2"&&goal.title==="ליצור משחק")return defaultData.goals[1];if(goal.id==="g3"&&goal.title==="להבין קוד בלי לפחד")return defaultData.goals[2];return{...goal,status}});
  if(originalGoals&&!goals.some(goal=>goal.id==="g4"))goals=[...goals,defaultData.goals[3]];
  const settings={...defaultData.settings,...parsed.settings};
  if(parsed.settings.journeySubtitle==="כאן נשמור את הרגעים הכי טובים שלנו")settings.journeySubtitle=defaultData.settings.journeySubtitle;
  return{...parsed,milestones,goals,settings};
}
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="סגירה">×</button><h2>{title}</h2>{children}</section></div>;
}
function CodeChallenge({ challenge, data, setData, onClose }: { challenge: string; data: GroupData; setData: (value: GroupData) => void; onClose: () => void }) {
  const configs: Record<string, { title: string; hint: string; initial: string; run: (code: string) => GroupData }> = {
    title: { title: "משנות את הכותרת", hint: "נסו לשנות רק את הטקסט שבין התגיות.", initial: `<h1>${data.settings.journeyTitle}</h1>`, run(code) { const match = code.match(/^\s*<h1>([^<>]+)<\/h1>\s*$/); if (!match) throw Error(); return { ...data, settings: { ...data.settings, journeyTitle: match[1] } }; } },
    subtitle: { title: "משנות שורת טקסט", hint: "הטקסט החדש נכנס בין <p> לבין </p>.", initial: `<p>${data.settings.journeySubtitle}</p>`, run(code) { const match = code.match(/^\s*<p>([^<>]+)<\/p>\s*$/); if (!match) throw Error(); return { ...data, settings: { ...data.settings, journeySubtitle: match[1] } }; } },
    color: { title: "צובעות את הכותרת", hint: "צבעי hex מתחילים ב־# ואחריהם 6 תווים.", initial: `.page-title {\n  color: ${data.settings.titleColor};\n}`, run(code) { const match = code.match(/color:\s*(#[0-9a-fA-F]{6})\s*;/); if (!match) throw Error(); return { ...data, settings: { ...data.settings, titleColor: match[1] } }; } },
    goalColor: { title: "צובעות את המטרות", hint: "אפשר לנסות #C9B7FF או #FFF2A8.", initial: `.goal-card {\n  background: ${data.settings.goalColor};\n}`, run(code) { const match = code.match(/background:\s*(#[0-9a-fA-F]{6})\s*;/); if (!match) throw Error(); return { ...data, settings: { ...data.settings, goalColor: match[1] } }; } },
    goal: { title: "מוסיפות מטרה בקוד", hint: "כל מטרה במרכאות, וביניהן פסיק.", initial: `const goals = [\n  "לבנות משהו שעוזר לקהילה",\n  "ליצור משחק משלנו"\n];`, run(code) { const match = code.match(/const\s+goals\s*=\s*\[([\s\S]*?)\]\s*;/); if (!match) throw Error(); const values = [...match[1].matchAll(/["']([^"']+)["']/g)].map(x => x[1]); if (!values.length) throw Error(); const existing = new Set(data.goals.map(goal => goal.title)); const added = values.filter(value => !existing.has(value)).map(title => ({ id: id(), title, text: "מטרה שהוספנו דרך הקוד ✨", status: "יש לנו רעיון" as const })); return { ...data, goals: [...data.goals, ...added] }; } },
    milestone: { title: "מוסיפות רגע למסע", hint: "שימו לב למרכאות, לפסיק ולסוגריים המסולסלים.", initial: `{\n  title: "הרגע החדש שלנו",\n  text: "ניסינו גם כשלא ידענו בדיוק איך"\n}`, run(code) { const title = code.match(/title\s*:\s*["']([^"']+)["']/)?.[1]; const text = code.match(/text\s*:\s*["']([^"']+)["']/)?.[1]; if (!title || !text || !code.includes("{") || !code.includes("}")) throw Error(); return { ...data, milestones: [...data.milestones, { id: id(), title, text, emoji: "🚀" }] }; } },
    question: { title: "מוסיפות שאלה לחידון", hint: "התשובה הנכונה חייבת להופיע גם ברשימת answers.", initial: `{\n  question: "מי הכי אוהבת פיצה?",\n  answers: ["מאיה", "נועה", "דנה"],\n  correct: "נועה"\n}`, run(code) { const question = code.match(/question\s*:\s*["']([^"']+)["']/)?.[1]; const answerBlock = code.match(/answers\s*:\s*\[([^\]]+)\]/)?.[1]; const correct = code.match(/correct\s*:\s*["']([^"']+)["']/)?.[1]; const answers = answerBlock ? [...answerBlock.matchAll(/["']([^"']+)["']/g)].map(x => x[1]) : []; if (!question || answers.length < 2 || !correct || !answers.includes(correct)) throw Error(); return { ...data, questions: [...data.questions, { id: id(), question, answers, correct }] }; } },
    charactersTitle:{title:"משנות את כותרת הסקוואד",hint:"שנו רק את המילים שבין התגיות.",initial:`<h1>${data.settings.charactersTitle}</h1>`,run(code){const value=code.match(/^\s*<h1>([^<>]+)<\/h1>\s*$/)?.[1];if(!value)throw Error();return{...data,settings:{...data.settings,charactersTitle:value}}}},
    characterQuote:{title:"נותנות לדמות משפט",hint:"בחרו שם שכבר נמצא בסקוואד.",initial:`const name = "מאיה";\nconst quote = "אני לא חייבת לדעת הכול כדי להתחיל";\n\nconst character = characters.find(item => item.name === name);\ncharacter.quote = quote;`,run(code){const name=code.match(/name\s*=\s*["']([^"']+)["']/)?.[1],quote=code.match(/quote\s*=\s*["']([^"']+)["']/)?.[1];if(!name||!quote||!data.characters.some(item=>item.name===name))throw Error();return{...data,characters:data.characters.map(item=>item.name===name?{...item,quote}:item)}}},
    quizTitle:{title:"משנות את כותרת החידון",hint:"כל מה שבין h1 יופיע בראש העמוד.",initial:`<h1>${data.settings.quizTitle}</h1>`,run(code){const value=code.match(/^\s*<h1>([^<>]+)<\/h1>\s*$/)?.[1];if(!value)throw Error();return{...data,settings:{...data.settings,quizTitle:value}}}},
    quizFact:{title:"משנות את העובדה המצחיקה",hint:"השינוי יחול על השאלה הראשונה.",initial:`const funFact = "כשאנחנו משתפות רעיונות, כולן מרוויחות";\n\nquestions[0].fact = funFact;`,run(code){const value=code.match(/funFact\s*=\s*["']([^"']+)["']/)?.[1];if(!value||!data.questions.length)throw Error();return{...data,questions:data.questions.map((item,index)=>index?item:{...item,fact:value})}}},
    goalsTitle:{title:"משנות את כותרת המטרות",hint:"נסו כותרת שנותנת אנרגיה לקבוצה.",initial:`<h1>${data.settings.goalsTitle}</h1>`,run(code){const value=code.match(/^\s*<h1>([^<>]+)<\/h1>\s*$/)?.[1];if(!value)throw Error();return{...data,settings:{...data.settings,goalsTitle:value}}}},
    goalStatus:{title:"מקדמות מטרה בקוד",hint:"הסטטוס חייב להיות אחד משלושת הסטטוסים באתר.",initial:`const goal = "לבנות משהו שעוזר למישהי";\nconst status = "עשינו את זה! 🎉";\n\nconst card = goals.find(item => item.title === goal);\ncard.status = status;`,run(code){const title=code.match(/goal\s*=\s*["']([^"']+)["']/)?.[1],status=code.match(/status\s*=\s*["']([^"']+)["']/)?.[1] as Goal["status"]|undefined;if(!title||!status||!statuses.includes(status)||!data.goals.some(item=>item.title===title))throw Error();return{...data,goals:data.goals.map(item=>item.title===title?{...item,status}:item)}}},
    avatarTitle:{title:"משנות את כותרת יצירת האווטאר",hint:"שנו את הטקסט בתוך h1.",initial:`<h1>${data.settings.avatarTitle}</h1>`,run(code){const value=code.match(/^\s*<h1>([^<>]+)<\/h1>\s*$/)?.[1];if(!value)throw Error();return{...data,settings:{...data.settings,avatarTitle:value}}}},
    avatarButton:{title:"משנות את כפתור הקסם",hint:"השאירו את תגיות button במקום.",initial:`<button>${data.settings.avatarButton}</button>`,run(code){const value=code.match(/^\s*<button>([^<>]+)<\/button>\s*$/)?.[1];if(!value)throw Error();return{...data,settings:{...data.settings,avatarButton:value}}}},
    mascotTitle:{title:"משנות את שאלת הקמע",hint:"אפשר להפוך אותה למצחיקה או מסתורית.",initial:`<h1>${data.settings.mascotTitle}</h1>`,run(code){const value=code.match(/^\s*<h1>([^<>]+)<\/h1>\s*$/)?.[1];if(!value)throw Error();return{...data,settings:{...data.settings,mascotTitle:value}}}},
    mascotLoading:{title:"משנות את הודעת הקסם",hint:"הטקסט יופיע בזמן יצירת הקמע.",initial:`const loadingText = "${data.settings.mascotLoading}";\n\nconst heading = document.querySelector(".mascot-creating h1");\nheading.textContent = loadingText;`,run(code){const value=code.match(/loadingText\s*=\s*["']([^"']+)["']/)?.[1];if(!value)throw Error();return{...data,settings:{...data.settings,mascotLoading:value}}}},
  };
  const config = configs[challenge];
  const [code, setCode] = useState(config.initial); const [error, setError] = useState(false); const [showHint, setShowHint] = useState(false); const [success, setSuccess] = useState(false);
  function run() { try { setData(config.run(code)); setError(false); setSuccess(true); setTimeout(() => setSuccess(false), 1800); } catch { setError(true); setSuccess(false); } }
  return <Modal title="אתגר קוד 👀" onClose={onClose}><p className="challenge-intro">מה אתן חושבות שהקוד הזה משנה?</p><textarea className="code-editor" dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false}/>{error && <div className="code-error">מצאנו באג 👀 וזה מעולה, עכשיו יש לנו רמז.<br/>בדקו פסיק, גרש או סוגריים ונסו שוב.</div>}{success && <div className="code-success">ניסיתן, שיניתן, והמסך הגיב! ככה לומדות קוד ✨</div>}{showHint && <div className="hint">💡 {config.hint}</div>}<div className="modal-actions"><button className="primary" onClick={run}>הריצי ▶</button><button onClick={() => { setCode(config.initial); setError(false); }}>חזרה לקוד המקורי</button><button onClick={() => setShowHint(!showHint)}>רמז</button></div></Modal>;
}

async function createSnapshot(data: GroupData, media: GroupMedia): Promise<Snapshot> {
  const images: Record<string, string> = {};
  for (const character of data.characters) if (character.avatarId) {
    const value = await media.reference(character.avatarId);
    if (!value) throw new Error("חסרה תמונה מקומית. השמירה נעצרה כדי לשמור על המידע בענן.");
    images[character.avatarId] = value;
  }
  const mascot = await media.reference(MASCOT_IMAGE_ID);
  if (mascot) images[MASCOT_IMAGE_ID] = mascot;
  return { version: 2, data, images, ...(media.answers ? { mascotAnswers: media.answers } : {}) };
}
async function restoreSnapshot(snapshot: Snapshot, media: GroupMedia): Promise<GroupData> {
  if (!isSnapshot(snapshot)) throw new Error("הקובץ לא נראה כמו מידע של QueenB");
  for (const [imageId, value] of Object.entries(snapshot.images)) await media.putImage(imageId, value);
  if (!snapshot.images[MASCOT_IMAGE_ID]) await media.deleteImage(MASCOT_IMAGE_ID);
  media.answers = snapshot.mascotAnswers;
  return migrateData(snapshot.data as GroupData);
}
export default function GroupApp({ groupId }: { groupId: string }) {
  const [media] = useState(() => new GroupMedia(groupId));
  return <GroupMediaContext.Provider value={media}><AccessProvider><App groupId={groupId}/></AccessProvider></GroupMediaContext.Provider>;
}

function App({ groupId }: { groupId: string }) {
  const media = useGroupMedia();
  const access = useAccess();
  const [page, setPage] = useState<Page>("characters");
  const cloud = useCloudData({ groupId, initial: defaultData, empty: async () => { media.clear(); return cloneDefaults(); }, restore: snapshot => restoreSnapshot(snapshot, media), snapshot: data => createSnapshot(data, media), prepare: snapshot => media.prepare(snapshot, (url, init) => access.fetch(url, init, "data:write")), authorize: force => access.ensure("data:write", force) });
  const { data, ready } = cloud;
  const [teacher, setTeacher] = useState(false);
  const [codeEnabled, setCodeEnabled] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [challengePicker, setChallengePicker] = useState(false);
  async function toggleTeacher() {
    if (teacher) { setTeacher(false); setCodeEnabled(false); setChallenge(null); setChallengePicker(false); return; }
    if (await access.ensure("teacher:enter")) setTeacher(true);
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "t") { event.preventDefault(); void toggleTeacher(); }
    };
    addEventListener("keydown", shortcut); return () => removeEventListener("keydown", shortcut);
  });
  async function setData(value: GroupData) { if (!await access.ensure("data:write")) return false; return cloud.update(value); }
  async function resetAll() {
    if (!await access.ensure("data:write")) return;
    if (!confirm(`לאפס את קבוצה ${groupId}? התוכן והאווטארים שלה יימחקו גם מהענן.`)) return;
    media.clear(); cloud.update(cloneDefaults()); setPage("characters");
  }
  if (!ready) return <main className="loading-screen" dir="rtl">{cloud.error ? <div role="alert"><p>{cloud.error}</p><button onClick={() => location.reload()}>נסי שוב</button></div> : "טוענות את המידע מהענן... ✨"}</main>;
  return <div className="app-shell" dir="rtl">
    <header className="topbar"><button className="brand" onClick={() => setPage("characters")} aria-label="עמוד הבית של QueenB"><img src="/queenb-logo.svg" alt="QueenB"/></button><nav>{nav.map(item => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav><button className={`teacher-toggle ${teacher ? "on" : ""}`} onClick={() => void toggleTeacher()} aria-label="מצב מדריכה">{teacher ? "מצב מדריכה: פועל" : "♛"}</button></header>
    {teacher && <aside className="teacher-bar"><strong>מצב מדריכה</strong><label><input type="checkbox" checked={codeEnabled} onChange={(event) => setCodeEnabled(event.target.checked)}/> להציג כפתורי קוד</label><button onClick={() => setChallengePicker(true)}>פתחי אתגר</button><button onClick={async()=>{if(await access.lock()){setTeacher(false);setCodeEnabled(false);setChallenge(null);setChallengePicker(false)}else alert("לא הצלחנו לנעול כרגע. בדקי את החיבור ונסי שוב.")}}>נעילת גישה</button><button className="danger" onClick={resetAll}>איפוס האתר</button></aside>}
    <div className="group-context"><span>קבוצה <b>{groupId}</b> · {regionForGroup(groupId)}</span><a href="/">מעבר לקבוצה אחרת ←</a></div>
    <div className="cloud-status" role="status">{cloud.status}{cloud.error && <><p role="alert">{cloud.error}</p>{!cloud.conflict && <button onClick={() => void cloud.retry()}>נסי לשמור שוב</button>}{cloud.conflict && <><button onClick={() => void cloud.exportDraft()}>הורדת גיבוי לשינויים שלי</button><button onClick={() => void cloud.discardDraft()}>ויתור על הטיוטה וטעינה מהענן</button></>}</>}</div>
    <main className="page-wrap">
      {page === "characters" && <CharactersPage data={data} setData={setData} teacher={teacher} goCreate={() => setPage("avatar")}/>} 
      {page === "journey" && <JourneyPage data={data} setData={setData} teacher={teacher} codeEnabled={codeEnabled} openCode={setChallenge}/>} 
      {page === "quiz" && <QuizPage data={data} setData={setData} teacher={teacher} codeEnabled={codeEnabled} openCode={setChallenge}/>} 
      {page === "goals" && <GoalsPage data={data} setData={setData} teacher={teacher} codeEnabled={codeEnabled} openCode={setChallenge}/>} 
      {page === "avatar" && <AvatarPage data={data} setData={setData} done={() => setPage("characters")}/>} 
      {page === "mascot" && <MascotPage data={data} onSaved={cloud.mediaChanged}/>}
    </main>
    <footer><span>built together with <b>&lt;/&gt;</b> + courage</span><span>אמיצות, לא מושלמות 👑</span></footer>
    {challengePicker&&<Modal title={`אתגרי הקוד — ${nav.find(item=>item.id===page)?.label}`} onClose={()=>setChallengePicker(false)}><p className="challenge-intro">בחרי אתגר, נחשו יחד מה הקוד יעשה — ואז הריצו ▶</p><div className="option-grid">{challengesByPage[page].map((item,index)=><button key={item.id} onClick={()=>{setChallengePicker(false);setChallenge(item.id)}}>&lt;/&gt; אתגר {index+1}</button>)}</div></Modal>}
    {challenge && <CodeChallenge challenge={challenge} data={data} setData={setData} onClose={() => setChallenge(null)}/>}
  </div>;
}

function CodeButton({ onClick }: { onClick: () => void }) { return <button className="code-button" onClick={onClick}>&lt;/&gt; פתחי את הקוד</button>; }
function CharactersPage({ data, setData, teacher, goCreate }: { data: GroupData; setData: (d: GroupData) => void; teacher: boolean; goCreate: () => void }) {
  const [selected, setSelected] = useState<Character | null>(null);
  useEffect(()=>{const heading=document.querySelector(".characters-hero h1");if(heading)heading.textContent=`${data.settings.charactersTitle} ✦`},[data.settings.charactersTitle]);
  return <><section className="hero characters-hero"><div className="eyebrow">THE QUEENB SQUAD</div><h1>הדמויות שלנו <span>✦</span></h1><p>כל אחת מביאה כוח אחר. ביחד? אנחנו קבוצה שאי אפשר לעצור.</p><div className="doodle-arrow">↙ <small>בחרי דמות</small></div></section><section className="squad-grid">{data.characters.map((character, index) => <CharacterCard character={character} key={character.id} index={index} onClick={() => setSelected(character)}/>)}<button className="add-character" onClick={goCreate}><b>+</b><span>{data.characters.length ? "עוד דמות מצטרפת לסקוואד" : "יש כאן מקום לכל אחת, מי מצטרפת ראשונה?"}</span><small>צרי אווטאר ✨</small></button></section><div className="squad-footer"><span>READY PLAYER <b>{data.characters.length + 1}</b></span><span>{data.characters.length} דמויות בסקוואד</span></div>{selected && <Modal title={selected.name} onClose={() => setSelected(null)}><div className="character-detail"><AvatarImage character={selected}/><div><p>🎨 הכי היא: {selected.passion}</p><p>⚡ כוח־על: {selected.power}</p><p>🎒 תמיד איתה: {selected.item}</p><p>✨ מה היא מביאה לצוות: {selected.vibe}</p>{selected.learningGoal&&<p>🌱 השנה היא רוצה ללמוד: {selected.learningGoal}</p>}{selected.quote && <blockquote>“{selected.quote}”</blockquote>}</div></div>{teacher && <button className="danger" onClick={() => { setData({ ...data, characters: data.characters.filter(item => item.id !== selected.id) }); setSelected(null); }}>מחיקת הדמות</button>}</Modal>}</>;
}
function CharacterCard({ character, index, onClick }: { character: Character; index: number; onClick: () => void }) { return <button className={`character-card tilt-${index % 3}`} onClick={onClick}><div className="avatar-frame"><AvatarImage character={character}/><span className="level">LVL {index + 1}</span></div><h2>{character.name}</h2><p>{character.vibe} • {character.passion}</p><div className="power-tag">⚡ {character.power}</div></button>; }
function AvatarImage({ character }: { character: Character }) {
  const media = useGroupMedia();
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let active = true, url: string | undefined;
    setSrc(undefined);
    if (character.avatarId) void media.getImage(character.avatarId).then(blob => { if (blob && active) { url = URL.createObjectURL(blob); setSrc(url); } }).catch(()=>{});
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [character.avatarId, media]);
  return src ? <img src={src} alt={`האווטאר של ${character.name}`}/> : <div className="avatar-fallback">{character.fallback}</div>;
}

function JourneyPage({ data, setData, teacher, codeEnabled, openCode }: { data: GroupData; setData:(d:GroupData)=>void; teacher:boolean; codeEnabled:boolean; openCode:(x:string)=>void }) {
  const [editing, setEditing] = useState<Milestone | null>(null);
  function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const item = { id: editing?.id || id(), title: String(form.get("title")), text: String(form.get("text")), emoji: String(form.get("emoji") || "✨"), date: String(form.get("date") || ""), meeting: String(form.get("meeting") || "") }; setData({ ...data, milestones: editing ? data.milestones.map(m => m.id === editing.id ? item : m) : [...data.milestones, item] }); setEditing(null); }
  function move(index:number, direction:number) { const items=[...data.milestones]; const next=index+direction; if(next<0||next>=items.length)return; [items[index],items[next]]=[items[next],items[index]]; setData({...data,milestones:items}); }
  return <><section className="page-heading"><div><span className="eyebrow">OUR YEAR, OUR STORY</span><h1 className="page-title" style={{color:data.settings.titleColor}}>{data.settings.journeyTitle}</h1><p>{data.settings.journeySubtitle}</p></div><div className="heading-actions">{codeEnabled && <><CodeButton onClick={() => openCode("title")}/><CodeButton onClick={() => openCode("subtitle")}/><CodeButton onClick={() => openCode("color")}/></>} {teacher && <button className="primary" onClick={() => setEditing({id:"",title:"",text:"",emoji:"✨"})}>רגע חדש +</button>}</div></section><section className="timeline">{data.milestones.map((item,index)=><article className="milestone" key={item.id}><div className="timeline-dot">{item.emoji}</div><div className="milestone-card"><div className="milestone-meta">{item.meeting && <span>מפגש {item.meeting}</span>}{item.date && <time>{item.date}</time>}</div><h2>{item.title}</h2><p>{item.text}</p>{teacher&&<div className="item-actions"><button onClick={()=>setEditing(item)}>עריכה</button><button onClick={()=>move(index,-1)}>↑</button><button onClick={()=>move(index,1)}>↓</button><button onClick={()=>setData({...data,milestones:data.milestones.filter(m=>m.id!==item.id)})}>מחיקה</button></div>}</div></article>)}</section>{codeEnabled&&<div className="standalone-code"><CodeButton onClick={()=>openCode("milestone")}/><span>אתגר: הוסיפו רגע חדש דרך הקוד</span></div>}{editing&&<Modal title={editing.id?"עורכות את הרגע":"מוסיפות רגע למסע"} onClose={()=>setEditing(null)}><form className="edit-form" onSubmit={save}><label>כותרת<input name="title" required defaultValue={editing.title}/></label><label>מה קרה?<textarea name="text" required defaultValue={editing.text}/></label><div className="form-row"><label>אימוג׳י<input name="emoji" defaultValue={editing.emoji}/></label><label>מספר מפגש<input name="meeting" defaultValue={editing.meeting}/></label><label>תאריך<input type="date" name="date" defaultValue={editing.date}/></label></div><button className="primary">נשמור את הרגע ✨</button></form></Modal>}</>;
}

function GoalsPage({data,setData,teacher,codeEnabled,openCode}:{data:GroupData;setData:(d:GroupData)=>void;teacher:boolean;codeEnabled:boolean;openCode:(x:string)=>void}) {
 const [editing,setEditing]=useState<Goal|null>(null); const [confetti,setConfetti]=useState(false);
 useEffect(()=>{const heading=document.querySelector(".goals-heading h1");if(heading)heading.textContent=data.settings.goalsTitle},[data.settings.goalsTitle]);
 function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const goal={id:editing?.id||id(),title:String(f.get("title")),text:String(f.get("text")),status:String(f.get("status")) as Goal["status"]};setData({...data,goals:editing?.id?data.goals.map(g=>g.id===editing.id?goal:g):[...data.goals,goal]});setEditing(null);}
 function status(goal:Goal,value:Goal["status"]){setData({...data,goals:data.goals.map(g=>g.id===goal.id?{...g,status:value}:g)});if(value===statuses[2]){setConfetti(true);setTimeout(()=>setConfetti(false),1800)}}
 return <><section className="page-heading goals-heading"><div><span className="eyebrow">DREAM IT. CODE IT. DO IT.</span><h1>לוח המטרות שלנו</h1><p>דברים שאנחנו עוד הולכות לגרום להם לקרות.</p></div><div className="heading-actions">{codeEnabled&&<><CodeButton onClick={()=>openCode("goalColor")}/><CodeButton onClick={()=>openCode("goal")}/></>}{teacher&&<button className="primary" onClick={()=>setEditing({id:"",title:"",text:"",status:statuses[0]})}>יש לנו מטרה חדשה? 👀</button>}</div></section><section className="goals-board">{data.goals.map((goal,index)=><article className={`goal-card goal-${index%4}`} style={{background:data.settings.goalColor}} key={goal.id}><span className="tape"/><h2>{goal.title}</h2><p>{goal.text}</p><select value={goal.status} onChange={e=>status(goal,e.target.value as Goal["status"])}>{statuses.map(s=><option key={s}>{s}</option>)}</select>{teacher&&<div className="item-actions"><button onClick={()=>setEditing(goal)}>עריכה</button><button onClick={()=>setData({...data,goals:data.goals.filter(g=>g.id!==goal.id)})}>מחיקה</button></div>}</article>)}</section>{confetti&&<div className="confetti" aria-label="כל הכבוד">🎉 ✦ 👑 ★ ✨ 🎉 ✦</div>}{editing&&<Modal title="המטרה שלנו" onClose={()=>setEditing(null)}><form className="edit-form" onSubmit={save}><label>כותרת<input name="title" required defaultValue={editing.title}/></label><label>משפט קצר<textarea name="text" defaultValue={editing.text}/></label><label>איפה אנחנו?<select name="status" defaultValue={editing.status}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><button className="primary">נשמור ונעשה את זה</button></form></Modal>}</>;
}

function QuizPage({data,setData,teacher,codeEnabled,openCode}:{data:GroupData;setData:(d:GroupData)=>void;teacher:boolean;codeEnabled:boolean;openCode:(x:string)=>void}) {
 const [playing,setPlaying]=useState(false),[index,setIndex]=useState(0),[score,setScore]=useState(0),[answer,setAnswer]=useState<string|null>(null),[editing,setEditing]=useState<Question|null>(null); const question=data.questions[index];
 useEffect(()=>{const heading=document.querySelector(".quiz-heading h1");if(heading)heading.textContent=data.settings.quizTitle},[data.settings.quizTitle,playing]);
 function choose(value:string){if(answer)return;setAnswer(value);if(value===question.correct)setScore(score+1)} function next(){setAnswer(null);setIndex(index+1)}
 function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const answers=String(f.get("answers")).split("\n").map(x=>x.trim()).filter(Boolean);if(answers.length<2||answers.length>4){alert("אפשר להוסיף בין 2 ל־4 תשובות בלבד 👀");return}const q={id:editing?.id||id(),question:String(f.get("question")),answers,correct:String(f.get("correct")),fact:String(f.get("fact"))};if(!answers.includes(q.correct)){alert("התשובה הנכונה חייבת להופיע ברשימת התשובות");return}setData({...data,questions:editing?.id?data.questions.map(x=>x.id===editing.id?q:x):[...data.questions,q]});setEditing(null)}
 if(playing&&index>=data.questions.length)return <section className="quiz-result"><span>🏆</span><h1>כל תשובה גילתה לנו עוד כוח בסקוואד</h1><p>{score} מתוך {data.questions.length}. הניקוד נחמד, אבל להכיר אחת את השנייה זה הניצחון האמיתי.</p><button className="primary" onClick={()=>{setPlaying(false);setIndex(0);setScore(0)}}>עוד סיבוב ↻</button></section>;
 return <><section className="page-heading quiz-heading"><div><span className="eyebrow">HOW WELL DO WE KNOW US?</span><h1>חידון על הקבוצה</h1><p>כמה כבר הספקנו לגלות אחת על השנייה? בואו נראה 👀</p></div><div className="heading-actions">{codeEnabled&&<CodeButton onClick={()=>openCode("question")}/>} {teacher&&<button className="primary" onClick={()=>setEditing({id:"",question:"",answers:["",""],correct:""})}>שאלה חדשה +</button>}</div></section>{!playing?<section className="quiz-start"><div className="quiz-stack"><span>?</span><span>?</span><span>?</span></div><h2>{data.questions.length} שאלות מחכות לכן</h2><button className="primary giant" disabled={!data.questions.length} onClick={()=>{setPlaying(true);setIndex(0);setScore(0)}}>יאללה, מתחילות!</button>{teacher&&<div className="question-list">{data.questions.map(q=><div key={q.id}><span>{q.question}</span><button onClick={()=>setEditing(q)}>עריכה</button><button onClick={()=>setData({...data,questions:data.questions.filter(x=>x.id!==q.id)})}>מחיקה</button></div>)}</div>}</section>:<section className="quiz-game"><div className="quiz-progress"><span>שאלה {index+1}/{data.questions.length}</span><b>ניקוד {score}</b></div><div className="progress"><i style={{width:`${((index+1)/data.questions.length)*100}%`}}/></div><article className="question-card"><span className="question-mark">?</span><h2>{question.question}</h2><div className="answers">{question.answers.map(value=><button key={value} onClick={()=>choose(value)} className={answer?(value===question.correct?"correct":value===answer?"wrong":"muted"):""}>{value}</button>)}</div>{answer&&<div className="feedback"><b>{answer===question.correct?"בול! 🎯":"כמעט! עכשיו כולנו יודעות 😄"}</b>{question.fact&&<p>{question.fact}</p>}<button className="primary" onClick={next}>{index===data.questions.length-1?"לתוצאה":"לשאלה הבאה ←"}</button></div>}</article></section>}{editing&&<Modal title="שאלה לקבוצה" onClose={()=>setEditing(null)}><form className="edit-form" onSubmit={save}><label>השאלה<input name="question" required defaultValue={editing.question}/></label><label>תשובות — כל אחת בשורה<textarea name="answers" required defaultValue={editing.answers.join("\n")}/></label><label>התשובה הנכונה<input name="correct" required defaultValue={editing.correct}/></label><label>Fun fact (לא חובה)<input name="fact" defaultValue={editing.fact}/></label><button className="primary">השאלה בפנים ✨</button></form></Modal>}</>;
}

function AvatarPage({data,setData,done}:{data:GroupData;setData:(d:GroupData)=>Promise<boolean>;done:()=>void}) {
 const media = useGroupMedia(); const access = useAccess();
 const [step,setStep]=useState(0),[name,setName]=useState(""),[photo,setPhoto]=useState<File|null>(null),[referenceMode,setReferenceMode]=useState<"photo"|"text">("photo"),[appearance,setAppearance]=useState(""),[customPrompt,setCustomPrompt]=useState(""),[answers,setAnswers]=useState({passion:"",power:"",item:"",vibe:""}),[generated,setGenerated]=useState<Blob|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [saving,setSaving]=useState(false); const savingRef=useRef(false); const pendingCharacter=useRef<Character|null>(null);
 const loadingLines=["מערבבות קצת קוד...","מוסיפות קצת קסם...","מלבישות את כוח־העל...","עוד שנייה היא כאן..."]; const [line,setLine]=useState(0); useEffect(()=>{if(!loading)return;const timer=setInterval(()=>setLine(x=>(x+1)%loadingLines.length),1300);return()=>clearInterval(timer)},[loading]);
 useEffect(()=>{const heading=document.querySelector(".avatar-side h1");if(heading)heading.textContent=data.settings.avatarTitle;const button=document.querySelector(".generate-card .primary.giant");if(button)button.textContent=data.settings.avatarButton},[data.settings.avatarTitle,data.settings.avatarButton,step,loading]);
 useEffect(()=>{const input=document.querySelector<HTMLInputElement>('input[placeholder="למשל: רקע עם כוכבים סגולים"]');if(!input)return;input.placeholder="למשל: לבנות משחק משלי";const label=input.closest("label");if(label?.firstChild)label.firstChild.textContent="משהו שאני רוצה ללמוד השנה (לא חובה)"},[step]);
 const questions=[{key:"passion",title:"מה הכי את?",options:["מוזיקה","ציור","ספורט","גיימינג","ספרים","משהו אחר"]},{key:"power",title:"כשמשהו לא עובד, מה כוח־העל שלך?",options:["לנסות דרך אחרת","לפרק את הבעיה לחלקים","לבקש עזרה","לעזור לחברה לחשוב","לקחת רגע ולחזור"]},{key:"item",title:"מה חייב להיות עם הדמות שלך?",options:["אוזניות","מכחול","כדורסל","לפטופ","מצלמה","ספר"]},{key:"vibe",title:"מה את מביאה לצוות?",options:["רעיונות יצירתיים","אנרגיה והתלהבות","הקשבה וסבלנות","שאלות טובות","אומץ לנסות","הומור"]}] as const;
 async function generate(){if(!await access.ensure("images:generate"))return;if(referenceMode==="photo"?!photo:!appearance.trim())return;pendingCharacter.current=null;setGenerated(null);setLoading(true);setError("");try{const form=new FormData();if(referenceMode==="photo"&&photo){const resizedPhoto=await resizeReferenceImage(photo);form.append("photo",resizedPhoto,"reference.jpg");}else{form.append("appearance",appearance.trim());}form.append("name",name);form.append("prompt",customPrompt);Object.entries(answers).forEach(([k,v])=>form.append(k,v));const response=await access.fetch(`/api/avatar?groupId=${media.groupId}`,{method:"POST",body:form},"images:generate");const result=await response.json() as { image: string; error?: string };if(!response.ok)throw new Error(result.error||"לא הצלחנו ליצור כרגע");setGenerated(dataUrlToBlob(result.image));}catch(err){setError(err instanceof Error?err.message:"משהו השתבש");}finally{setLoading(false)}}
 async function approve(){
   if(!generated||savingRef.current)return;
   savingRef.current=true;setSaving(true);setError("");
   try {
     if(!await access.ensure("data:write"))return;
     const character=pendingCharacter.current||{id:id(),name,avatarId:id(),fallback:"👩‍💻",learningGoal:customPrompt,...answers};
     pendingCharacter.current=character;
     await media.putImage(character.avatarId!,generated);
     const characters=data.characters.some(c=>c.id===character.id)?data.characters:[...data.characters,character];
     if(await setData({...data,characters}))done();
     else setError("האווטאר עדיין לא נשמר בענן. נסי שוב — אין צורך ליצור אותו מחדש.");
   } catch(err){setError(err instanceof Error?err.message:"השמירה נכשלה. נסי שוב.")}
   finally{savingRef.current=false;setSaving(false)}
 }

 if(generated)return <section className="avatar-result"><span className="eyebrow">QUEEN APPROVED</span><h1>{name}, הדמות שלך כאן!</h1><img src={URL.createObjectURL(generated)} alt={`האווטאר של ${name}`}/><div>{error&&<p role="alert" className="code-error">{error}</p>}<button className="primary" disabled={saving} onClick={approve}>{saving?"שומרות את האווטאר בענן…":"זו אני! הוסיפי לסקוואד"}</button><button disabled={saving} onClick={generate}>נסי שוב ↻</button><button disabled={saving} onClick={()=>{setGenerated(null);setStep(1)}}>שינוי תשובות</button></div></section>;
 return <section className="avatar-maker"><div className="avatar-side"><span className="eyebrow">CREATE YOUR CHARACTER</span><h1>הגיע הזמן לפגוש את הדמות שלך</h1><p>דקה של שאלות, קצת קסם של AI — ואת בתוך העולם של QueenB.</p><div className="privacy-note">🔒 התמונה או תיאור המראה נשלחים ל־Cloudflare לצורך יצירת האווטאר בלבד ואינם נשמרים באפליקציה.</div></div><div className="wizard"><div className="steps"><i className={step>=0?"done":""}>1</i><span/><i className={step>=1?"done":""}>2</i><span/><i className={step>=5?"done":""}>3</i></div>{step===0?<div className="wizard-card"><h2>קודם כול, מי את? 👋</h2><label>השם שלך<input value={name} onChange={e=>setName(e.target.value)} placeholder="איך קוראים לך?"/></label><div className="option-grid" role="group" aria-label="איך ליצור את המראה שלך"><button type="button" aria-pressed={referenceMode==="photo"} className={referenceMode==="photo"?"selected":""} onClick={()=>setReferenceMode("photo")}>העלאת תמונה</button><button type="button" aria-pressed={referenceMode==="text"} className={referenceMode==="text"?"selected":""} onClick={()=>setReferenceMode("text")}>תיאור המראה שלי</button></div>{referenceMode==="photo"?<label className="photo-drop">{photo?<><b>התמונה מוכנה ✓</b><small>{photo.name}</small></>:<><b>בחרי תמונת פנים</b><small>חשוב שהתמונה תהיה באיכות טובה ותראה את הפנים בעיקר</small></>}<input type="file" accept="image/*" capture="user" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label>:<label>איך את נראית?<textarea rows={4} maxLength={2000} value={appearance} onChange={e=>setAppearance(e.target.value)} placeholder="למשל: יש לי שיער חלק עד הכתפיים בצבע חום כהה, גוון עור בהיר, עיניים ירוקות ומשקפיים שחורות."/><small>אפשר לתאר שיער, גוון עור, עיניים ואביזרים — בלי להעלות תמונה.</small></label>}<label>משהו נוסף שתרצי בדמות? (לא חובה)<input value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)} placeholder="למשל: רקע עם כוכבים סגולים"/></label><button className="primary" disabled={!name.trim()||(referenceMode==="photo"?!photo:!appearance.trim())} onClick={()=>setStep(1)}>יאללה לשאלות ←</button></div>:step<=4?<div className="wizard-card"><span className="question-count">שאלה {step} מתוך 4</span><h2>{questions[step-1].title}</h2><div className="option-grid">{questions[step-1].options.map(option=><button key={option} className={answers[questions[step-1].key]===option?"selected":""} onClick={()=>setAnswers({...answers,[questions[step-1].key]:option})}>{option}</button>)}</div><div className="wizard-actions"><button onClick={()=>setStep(step-1)}>חזרה</button><button className="primary" disabled={!answers[questions[step-1].key]} onClick={()=>setStep(step+1)}>הבא ←</button></div></div>:<div className="wizard-card generate-card">{loading?<><div className="magic-loader"><i>✦</i><i>{`{ }`}</i><i>♛</i></div><h2>{loadingLines[line]}</h2><p>הקסם עובד מאחורי הקלעים</p></>:<><span className="big-sparkle">✨</span><h2>מוכנה לפגוש את {name} בגרסת־העל?</h2><div className="answer-summary"><span>{answers.passion}</span><span>{answers.power}</span><span>{answers.item}</span><span>{answers.vibe}</span></div>{error&&<div className="code-error">{error}</div>}<button className="primary giant" onClick={generate}>צרי את הדמות שלי ✨</button><button onClick={()=>setStep(1)}>רגע, נשנה תשובות</button></>}</div>}</div></section>;
}

function MascotPage({data,onSaved}:{data:GroupData;onSaved:()=>Promise<boolean>}) {
 const media = useGroupMedia(); const access = useAccess();
 const [phase,setPhase]=useState<"intro"|"questions"|"creating"|"result">("intro"),[index,setIndex]=useState(0),[answers,setAnswers]=useState<MascotAnswers>({}),[selected,setSelected]=useState(""),[image,setImage]=useState(""),[error,setError]=useState(""),[loadingLine,setLoadingLine]=useState(0);
 const transition = useRef<ReturnType<typeof setTimeout> | null>(null);
 useEffect(()=>()=>{if(transition.current)clearTimeout(transition.current)},[]);
 const loadingLines=["מחברות את כל הבחירות שלכן...","נותנות לה קצת QueenB magic...","ומכירות את הקמע שלכן 👀"];
 useEffect(()=>{const heading=document.querySelector(".mascot-intro h1");if(heading)heading.textContent=data.settings.mascotTitle;const loadingHeading=document.querySelector(".mascot-creating h1");if(loadingHeading&&loadingLine===0)loadingHeading.textContent=data.settings.mascotLoading},[data.settings.mascotTitle,data.settings.mascotLoading,phase,loadingLine]);
 useEffect(()=>{let active=true;Promise.all([media.getImage(MASCOT_IMAGE_ID),Promise.resolve(media.answers)]).then(async([blob,savedAnswers])=>{if(!active||!blob)return;setImage(await blobToDataUrl(blob));if(savedAnswers)setAnswers(savedAnswers);setPhase("result")}).catch(()=>{});return()=>{active=false}},[]);
 useEffect(()=>{if(phase!=="creating")return;const timer=setInterval(()=>setLoadingLine(value=>(value+1)%loadingLines.length),1200);return()=>clearInterval(timer)},[phase]);
 const question=mascotQuestions[index];
 function choose(value:string){if(selected)return;setSelected(value);setAnswers(current=>({...current,[question.key]:value}));transition.current=setTimeout(()=>{if(index===mascotQuestions.length-1){void generate({...answers,[question.key]:value})}else{setIndex(value=>value+1);setSelected("")}},1000)}
 async function generate(finalAnswers=answers){if(!await access.ensure("images:generate")){setSelected("");return;}setPhase("creating");setError("");try{const response=await access.fetch(`/api/mascot?groupId=${media.groupId}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers:finalAnswers})},"images:generate");const result=await response.json() as { image: string; error?: string };if(!response.ok)throw new Error(result.error||"לא הצלחנו ליצור כרגע");await media.putImage(MASCOT_IMAGE_ID,dataUrlToBlob(result.image));media.answers=finalAnswers;setAnswers(finalAnswers);setImage(result.image);if(!await onSaved())throw new Error("הקמע נוצר אבל עדיין לא נשמר בענן. לחצי על ניסיון השמירה החוזר בראש העמוד.");setPhase("result")}catch(err){setError(err instanceof Error?err.message:"משהו השתבש");setPhase("result")}}
 async function restart(){if(!await access.ensure("data:write"))return;await media.deleteImage(MASCOT_IMAGE_ID);media.answers=undefined;if(!await onSaved()){setError("השינוי עדיין לא נשמר בענן. נסי לשמור שוב בראש העמוד.");return;}setPhase("intro");setIndex(0);setAnswers({});setSelected("");setImage("");setError("")}
 if(phase==="intro")return <section className="mascot-intro"><div className="mascot-stickers"><span>⚡</span><span>{`{ }`}</span><span>👑</span></div><span className="eyebrow">BUILD OUR MASCOT</span><h1>מי תהיה הקמע של<br/>הקבוצה שלנו?</h1><p>כל אחת מקבלת החלטה אחת. אין בחירה נכונה או מושלמת - מכל הרעיונות שלכן תיוולד דמות ייחודית לקבוצה שלנו.</p><button className="primary giant" onClick={async()=>{if(await access.ensure("images:generate"))setPhase("questions")}}>יאללה, מתחילות ←</button><small>15 החלטות • קמע אחד • כולן בפנים</small></section>;
 if(phase==="creating")return <section className="mascot-creating"><div className="mascot-orbit"><i>✦</i><b>QB</b><i>⚡</i></div><h1>{loadingLines[loadingLine]}</h1><div className="mascot-progress-dots"><span/><span/><span/></div></section>;
 if(phase==="result")return <section className="mascot-result"><span className="eyebrow">QUEENB SQUAD ORIGINAL</span><h1>הכירו את הקמע שלכן!</h1>{image?<img src={image} alt="הקמע הקבוצתי שיצרתן"/>:<div className="mascot-error"><b>הקמע כבר בדמיון שלנו ✨</b><p>{error}</p></div>}{image&&error&&<p role="alert" className="code-error">{error}</p>}<div className="mascot-chips">{mascotQuestions.slice(0,4).map(item=><span key={item.key}>{item.emoji} {answers[item.key]}</span>)}</div><div className="mascot-result-actions"><button className="primary" onClick={()=>void generate()}>ניצור עוד גרסה</button><button onClick={restart}>מתחילות מחדש ↻</button></div></section>;
 return <section className="mascot-quiz"><div className="mascot-quiz-top"><button onClick={()=>{if(index===0)restart();else{setIndex(index-1);setSelected("")}}}>→ חזרה</button><span>{index+1} / {mascotQuestions.length}</span></div><div className="mascot-progress"><i style={{width:`${((index+1)/mascotQuestions.length)*100}%`}}/></div><div className="mascot-question-icon">{question.emoji}</div><h1>{question.title}</h1><div className="mascot-options">{question.options.map(option=><button key={option.label} className={selected===option.label?"selected":selected?"dimmed":""} onClick={()=>choose(option.label)}><b>{option.icon}</b><span>{option.label}</span>{selected===option.label&&<em>נבחר! עכשיו תעבירי למישהי הבאה 👑</em>}</button>)}</div></section>;
}

function blobToDataUrl(blob:Blob){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob)})}
function dataUrlToBlob(value:string){const [header,data]=value.split(",");const mime=header.match(/:(.*?);/)?.[1]||"image/png";const bytes=atob(data);const array=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);return new Blob([array],{type:mime})}
function resizeReferenceImage(file:File){return new Promise<Blob>((resolve,reject)=>{const image=new Image();const url=URL.createObjectURL(file);image.onload=()=>{const scale=Math.min(1,512/image.width,512/image.height);const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext("2d")?.drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{URL.revokeObjectURL(url);blob?resolve(blob):reject(new Error("לא הצלחנו להכין את התמונה לשליחה"))},"image/jpeg",.9)};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("לא הצלחנו לקרוא את התמונה"))};image.src=url})}


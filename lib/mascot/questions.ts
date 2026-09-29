export type MascotAnswerKey = "creature" | "vibe" | "power" | "item" | "world" | "feature" | "motto" | "movement" | "colorMood" | "bodyShape" | "expression" | "techDetail" | "artTexture" | "energyEffect" | "teamSymbol";

export type MascotAnswers = Partial<Record<MascotAnswerKey, string>>;

export type MascotQuestion = {
  key: MascotAnswerKey;
  title: string;
  emoji: string;
  options: { label: string; icon: string }[];
};

export const mascotQuestions: MascotQuestion[] = [
  { key: "creature", title: "איזה יצור הקמע שלנו?", emoji: "✦", options: [{ label: "חתולה", icon: "🐱" }, { label: "דבורה", icon: "🐝" }, { label: "רובוטית", icon: "🤖" }, { label: "יצור דמיוני", icon: "🌀" }] },
  { key: "vibe", title: "מה הווייב שלה?", emoji: "⚡", options: [{ label: "אנרגטית ומלאת ביטחון", icon: "🔥" }, { label: "מצחיקה וקלילה", icon: "🎉" }, { label: "רגועה וחכמה", icon: "🧠" }, { label: "סקרנית והרפתקנית", icon: "🧭" }] },
  { key: "power", title: "מה כוח־העל שלה?", emoji: "💥", options: [{ label: "לפתור בעיות שאף אחת אחרת לא מצליחה", icon: "🧩" }, { label: "להפוך טעויות לרעיונות חדשים", icon: "💡" }, { label: "לחבר בין כולן", icon: "🔗" }, { label: "להמציא דברים שאף אחת עוד לא חשבה עליהם", icon: "🚀" }] },
  { key: "item", title: "מה היא תמיד לוקחת איתה?", emoji: "🎒", options: [{ label: "לפטופ מלא במדבקות", icon: "💻" }, { label: "אוזניות ענקיות", icon: "🎧" }, { label: "תיק עם מיליון גאדג׳טים", icon: "🛠️" }, { label: "מחברת מלאה ברעיונות ושרבוטים", icon: "📓" }] },
  { key: "world", title: "באיזה עולם היא חיה?", emoji: "🌐", options: [{ label: "מעבדת טכנולוגיה צבעונית", icon: "🧪" }, { label: "עיר עתידנית", icon: "🌆" }, { label: "עולם דיגיטלי משוגע", icon: "🕹️" }, { label: "חדר יצירה מלא בקוד, מסכים ורעיונות", icon: "🖥️" }] },
  { key: "feature", title: "מה הפרט שהכי מזוהה איתה?", emoji: "👀", options: [{ label: "משקפיים מיוחדים", icon: "👓" }, { label: "קפוצ׳ון אייקוני", icon: "🧥" }, { label: "סניקרס מוגזמות", icon: "👟" }, { label: "אביזר טכנולוגי עתידני", icon: "⌚" }] },
  { key: "motto", title: "איזה משפט הכי מתאים לה?", emoji: "💬", options: [{ label: "אמיצה, לא מושלמת", icon: "👑" }, { label: "ננסה ונראה מה יקרה", icon: "✨" }, { label: "יש לי רעיון", icon: "💡" }, { label: "ביחד נפתור את זה", icon: "🤝" }] },
  { key: "movement", title: "איך היא נכנסת לחדר?", emoji: "💨", options: [{ label: "מרחפת בביטחון", icon: "☁️" }, { label: "מקפצת באנרגיה", icon: "⚡" }, { label: "גולשת על סקייטבורד", icon: "🛹" }, { label: "מופיעה מתוך פורטל", icon: "🌀" }] },
  { key: "colorMood", title: "איזה שילוב צבעים מוביל אותה?", emoji: "🎨", options: [{ label: "ורוד וסגול חזקים", icon: "💜" }, { label: "ורוד, שחור ולבן", icon: "🖤" }, { label: "סגול עם נגיעות ורוד", icon: "🔮" }, { label: "כל צבעי QueenB ביחד", icon: "🌈" }] },
  { key: "bodyShape", title: "איזו צורה יש לדמות שלה?", emoji: "◒", options: [{ label: "קטנה וזריזה", icon: "💫" }, { label: "גבוהה וגמישה", icon: "〰️" }, { label: "עגולה וחזקה", icon: "🟣" }, { label: "גאומטרית ועתידנית", icon: "🔷" }] },
  { key: "expression", title: "איזו הבעת פנים יש לה?", emoji: "😎", options: [{ label: "חיוך מלא ביטחון", icon: "😁" }, { label: "מבט סקרן", icon: "🤔" }, { label: "קריצה מחויכת", icon: "😉" }, { label: "פרצוף של ריכוז־על", icon: "🧐" }] },
  { key: "techDetail", title: "איך היא משתמשת בטכנולוגיה?", emoji: "🤖", options: [{ label: "בונה כלי שעוזר לאחרות", icon: "🛠️" }, { label: "הופכת רעיון למשחק", icon: "🎮" }, { label: "מסבירה משהו מסובך בפשטות", icon: "💡" }, { label: "מחברת בין אנשים", icon: "🔗" }] },
  { key: "artTexture", title: "מה היא עושה כשמשהו לא מצליח?", emoji: "✍️", options: [{ label: "מנסה דרך חדשה", icon: "🧭" }, { label: "מבקשת עזרה מהקבוצה", icon: "🤝" }, { label: "מספרת את הבאג לברווז גומי", icon: "🦆" }, { label: "בודקת מה אפשר ללמוד ממנו", icon: "🔎" }] },
  { key: "energyEffect", title: "מה קורה סביבה כשהיא מתרגשת?", emoji: "✨", options: [{ label: "עפים ניצוצות", icon: "⚡" }, { label: "פיקסלים מתפזרים", icon: "👾" }, { label: "שורות קוד מסתחררות", icon: "⌨️" }, { label: "כוכבים קטנים מופיעים", icon: "🌟" }] },
  { key: "teamSymbol", title: "איזה סמל מייצג את הכוח הקבוצתי שלה?", emoji: "🤝", options: [{ label: "נקודות שמתחברות לרשת", icon: "🕸️" }, { label: "סוגריים של קוד", icon: "{ }" }, { label: "כתר קטן ומודרני", icon: "♛" }, { label: "לב שמורכב מפיקסלים", icon: "💗" }] },
];

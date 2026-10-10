"use client";
import { useState } from "react";
import { groupsByRegion, type Region } from "../lib/groups";

export default function GroupSelection() {
  const [region, setRegion] = useState<Region | null>(null);
  return <main className="group-selection" dir="rtl">
    <a className="selection-logo" href="/" aria-label="QueenB — בחירת קבוצה"><img src="/queenb-logo.svg" alt="QueenB"/></a>
    <section className="selection-panel" key={region ?? "regions"} aria-labelledby="selection-title">
      <div className="eyebrow">{region ? `QUEENB · ${region}` : "כל אחת מביאה כוח. ביחד אנחנו QueenB."}</div>
      <h1 id="selection-title">{region ? "מה מספר הקבוצה שלך?" : "באיזה אזור את?"}</h1>
      <p>{region ? "בחרי את הקבוצה שלך — המסע שלכן מחכה בפנים." : "מתחילות באזור שלך, וממשיכות לקבוצה שלכן."}</p>
      {region && <button className="selection-back" onClick={() => setRegion(null)}>→ חזרה לבחירת אזור</button>}
      <div className={`selection-grid ${region ? "group-numbers" : ""}`}>
        {region ? groupsByRegion[region].map(id => <a className="selection-card" href={`/group/${id}`} key={id}><span>קבוצה</span><strong>{id}</strong><span aria-hidden="true">↖</span></a>) : (Object.keys(groupsByRegion) as Region[]).map((name, index) => <button className={`selection-card region-${index % 3}`} key={name} onClick={() => setRegion(name)}><span aria-hidden="true">{["✦", "♛", "{ }", "★", "⚡", "↝", "♡"][index]}</span><strong>{name}</strong><span aria-hidden="true">←</span></button>)}
      </div>
      <small className="selection-note">כל קבוצה, הסיפור והקסם שלה 💜</small>
    </section>
  </main>;
}

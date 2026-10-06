"use client";

import { FormEvent, useState, useTransition } from "react";
import { updateSettings } from "@/app/actions/settings";

const zones = ["Asia/Bangkok", "Asia/Ho_Chi_Minh", "Asia/Singapore", "Asia/Tokyo", "Europe/London", "America/New_York", "UTC"];
export function DashboardSettings({ timezone, dailyGoalMinutes }: { timezone: string; dailyGoalMinutes: number }) {
  const [message, setMessage] = useState(""); const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const timezoneValue = String(form.get("timezone")); const goal = Number(form.get("goal")); startTransition(async () => { const result = await updateSettings(timezoneValue, goal); setMessage(result.ok ? "Đã lưu cài đặt." : result.message); }); }
  return <form className="settings-form" onSubmit={submit}><label>Múi giờ IANA<input name="timezone" list="timezone-options" defaultValue={timezone} required /><datalist id="timezone-options">{zones.map((zone) => <option value={zone} key={zone} />)}</datalist></label><label>Mục tiêu mỗi ngày (phút)<input name="goal" type="number" min="1" max="1440" defaultValue={dailyGoalMinutes} required /></label><button className="button button--secondary" disabled={pending}>{pending ? "Đang lưu…" : "Lưu cài đặt"}</button>{message && <p className="feedback">{message}</p>}</form>;
}

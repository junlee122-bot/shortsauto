import type { Metadata } from "next";
import { CalendarPage } from "@/components/pages/calendar-page";
export const metadata: Metadata = { title: "캘린더" };
export default function Page() { return <CalendarPage />; }

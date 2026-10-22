import { useEffect, useState } from 'react';

import { daysEnding } from '@/lib/study-stats';
import { supabase } from '@/lib/supabase';

/** How far back the weekly chart and the streak look. */
export const HISTORY_DAYS = 28;

/**
 * Study time per day for the last four weeks, with today's live total (running timer included) on top.
 * Past days are read once a day; today comes from the study session, so the chart moves as you study.
 * shortcut: offline, past days read as zero; cache them like holidays.ts if that matters.
 */
export function useStudyHistory(today: string, todayMs: number): { days: string[]; msByDay: Map<string, number> } {
  const [past, setPast] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    let live = true;
    const [from] = daysEnding(today, HISTORY_DAYS);
    supabase
      .from('study_time')
      .select('day, ms')
      .gte('day', from)
      .lt('day', today)
      .then(({ data, error }) => {
        if (!live) return;
        const byDay = new Map<string, number>();
        for (const r of (error ? [] : data) as { day: string; ms: number }[]) byDay.set(r.day, (byDay.get(r.day) ?? 0) + Number(r.ms));
        setPast(byDay);
      });
    return () => {
      live = false;
    };
  }, [today]);
  return { days: daysEnding(today, HISTORY_DAYS), msByDay: new Map([...past, [today, todayMs]]) };
}

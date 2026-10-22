import { useCallback, useEffect, useState } from 'react';

import type { Assessment, Course } from '@/data/courses';
import { callFunction } from '@/lib/functions';

/** One block of Sonnet's plan, already checked by the plan-day function. */
type SmartBlock = { assessmentId: number; minutes: number; topics: string[]; reason: string };
type Reply = { blocks: SmartBlock[]; generated_at: string | null; replans_left: number };

export type SmartItem = { course: Course; assessment: Assessment; minutes: number; topics: string[]; reason: string };

export type SmartPlan = {
  /** Today's AI plan, or null when it isn't available (loading, offline, error). */
  items: SmartItem[] | null;
  /** Why there's no AI plan, in a sentence the student can read. */
  message: string | null;
  replansLeft: number;
  /** The first request of the day hasn't answered yet. */
  loading: boolean;
  busy: boolean;
  replan: () => void;
};

const UNAVAILABLE = 'Smart plan unavailable right now.';

/**
 * Today's plan from Sonnet via the plan-day function, which saves one per day, so asking again is cheap.
 * Asks again when the day, study hours or holiday change, and when the device comes back online.
 */
export function useSmartPlan(courses: Course[], hours: number, holiday: string | null, online: boolean, day: string): SmartPlan {
  const [blocks, setBlocks] = useState<SmartBlock[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [replansLeft, setReplansLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  const request = useCallback((replan: boolean) => callFunction<Reply>('plan-day', { hours, holiday, replan }, UNAVAILABLE), [hours, holiday]);
  const apply = (reply: Reply) => {
    setBlocks(reply.blocks);
    setReplansLeft(reply.replans_left);
    setMessage(null);
  };
  const fail = (e: unknown) => setMessage(e instanceof Error ? e.message : UNAVAILABLE);

  useEffect(() => {
    if (!online) return;
    let live = true; // a reply for old hours mustn't overwrite a newer one
    request(false)
      .then((reply) => live && apply(reply))
      .catch((e) => {
        if (!live) return;
        setBlocks(null);
        fail(e);
      });
    return () => {
      live = false;
    };
  }, [online, day, request]);

  const replan = () => {
    setBusy(true);
    // A failed re-plan keeps the plan the student already has.
    request(true)
      .then(apply)
      .catch(fail)
      .finally(() => setBusy(false));
  };

  return {
    items: blocks && online ? itemsFor(blocks, courses) : null,
    message: online ? message : 'Smart plan needs the internet. Showing your usual plan.',
    replansLeft,
    loading: online && blocks === null && message === null,
    busy,
    replan,
  };
}

/** Blocks for assessments the student still has open; finished or deleted ones drop out. */
function itemsFor(blocks: SmartBlock[], courses: Course[]): SmartItem[] {
  return blocks.flatMap((b) => {
    for (const course of courses) {
      const assessment = course.assessments.find((a) => a.id === String(b.assessmentId));
      if (assessment && assessment.status !== 'done') return [{ course, assessment, minutes: b.minutes, topics: b.topics, reason: b.reason }];
    }
    return [];
  });
}

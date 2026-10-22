// Preview what note analysis says about your own files, using the same prompt and checks as the
// server. Nothing is saved anywhere; files go only to the Anthropic API.
//
//   $env:ANTHROPIC_API_KEY="sk-ant-..."
//   npx deno@2 run --allow-read --allow-env --allow-net supabase/tests/preview-notes.ts topics.txt "C:\...\MATH1051\Week 2.pdf" ...
//
// topics.txt lists your courses and their topics (see topics.example.txt).

import { buildUserText, fileKind, validateResult, type CourseTopics } from '../functions/_shared/analysis.ts';
import { MODEL, askClaude } from '../functions/_shared/claude.ts';
import { courseFromPath } from '../functions/_shared/course-code.ts';
import { extensionOf } from '../functions/_shared/diff.ts';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

const MAX_BYTES = 20 * 1024 * 1024;
// claude-haiku-5-5 list prices, US$ per million tokens; prompts over 100K tokens bill at the higher tier.
const PRICE = { input: 0.1, output: 0.5 };
const LONG_PRICE = { input: 0.5, output: 2.5 };

const [topicsFile, ...files] = Deno.args;
if (!topicsFile || files.length === 0) {
  console.error('Usage: preview-notes.ts topics.txt file.pdf [more files...]');
  Deno.exit(1);
}

/** "MATH1051 Calculus" starts a course; "- Limits" (or "- Limits [Week 2]") adds a topic to it. */
function parseTopics(text: string): CourseTopics[] {
  const courses: CourseTopics[] = [];
  let nextId = 1;
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const topic = line.match(/^[-*]\s*(.+?)(?:\s*\[(.+)\])?$/);
    if (topic) {
      const course = courses.at(-1);
      if (!course) throw new Error(`Topic "${line}" comes before any course line.`);
      course.topics.push({ id: nextId++, name: topic[1], week: topic[2] ?? null });
      continue;
    }
    const course = line.match(/^([A-Za-z]{4}\d{4})\s*(.*)$/);
    if (!course) throw new Error(`Couldn't read the line "${line}". Use "CODE1234 Name" or "- Topic".`);
    courses.push({ id: nextId++, code: course[1].toUpperCase(), name: course[2], topics: [] });
  }
  return courses;
}

if (!Deno.env.get('ANTHROPIC_API_KEY')) {
  console.error('Set your Anthropic key first:  $env:ANTHROPIC_API_KEY="sk-ant-..."');
  Deno.exit(1);
}

const courses = parseTopics(await Deno.readTextFile(topicsFile));
console.log(`Courses: ${courses.map((c) => `${c.code} (${c.topics.length} topics)`).join(', ')}\n`);
let totalCost = 0;

for (const path of files) {
  const name = path.split(/[\\/]/).pop()!;
  const type = fileKind(extensionOf(name));
  if (!type) {
    console.log(`${name}: skipped, this file type isn't supported yet.\n`);
    continue;
  }
  const bytes = await Deno.readFile(path);
  if (bytes.length > MAX_BYTES) {
    console.log(`${name}: skipped, over 20 MB. The server would ask you to split it.\n`);
    continue;
  }

  const fromPath = courseFromPath(path, courses);
  const noteText = type.kind === 'text' ? new TextDecoder().decode(bytes) : null;
  const content = [];
  if (type.kind === 'pdf') content.push({ type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: encodeBase64(bytes) } });
  if (type.kind === 'image') content.push({ type: 'image' as const, source: { type: 'base64' as const, media_type: type.mediaType as 'image/png', data: encodeBase64(bytes) } });
  content.push({ type: 'text' as const, text: buildUserText({ fileName: name, courses, knownCode: fromPath?.code ?? null, noteText }) });

  const started = Date.now();
  try {
    const reply = await askClaude(content, courses.map((c) => c.code));
    const seconds = (Date.now() - started) / 1000;
    const result = validateResult(reply.raw, courses, fromPath?.code ?? null);
    const price = reply.inputTokens > 100_000 ? LONG_PRICE : PRICE;
    const cost = (reply.inputTokens * price.input + reply.outputTokens * price.output) / 1e6;
    totalCost += cost;

    const how = fromPath ? 'from the folder/file name' : `Claude's guess, ${Math.round(result.confidence * 100)}% sure`;
    console.log(`${name} (${(bytes.length / 1e6).toFixed(1)} MB) → ${result.course?.code ?? 'no matching course'} (${how})`);
    for (const r of result.readings) {
      const topic = result.course!.topics.find((t) => t.id === r.topicId)!;
      console.log(`  ${r.level.padEnd(6)}  ${topic.name}: ${r.reason}`);
    }
    console.log(`  ${seconds.toFixed(0)} s · ${reply.inputTokens.toLocaleString()} in / ${reply.outputTokens.toLocaleString()} out tokens · ~US$${cost.toFixed(2)} (${MODEL})\n`);
  } catch (e) {
    console.log(`${name}: failed. ${e instanceof Error ? e.message : String(e)}\n`);
  }
}
console.log(`Total ~US$${totalCost.toFixed(2)}`);

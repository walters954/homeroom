"use client";

import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
} from "@homeroom/ui";
import type { VerifyResult } from "@/lib/actions/exercises";

export interface FileRow {
  path: string;
  contents: string;
}
export interface SpecRow {
  name: string;
  description?: string;
}

const LANGUAGES = ["TYPESCRIPT", "JAVASCRIPT", "APEX", "SQL", "PYTHON", "OTHER"];

/** Languages the runner can actually execute today — the rest report honestly. */
const RUNNABLE = new Set(["TYPESCRIPT", "JAVASCRIPT"]);

function FileList({
  label,
  hint,
  files,
  onChange,
  mono = true,
}: {
  label: string;
  hint: string;
  files: FileRow[];
  onChange: (next: FileRow[]) => void;
  mono?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        <p className="hr-ev">{hint}</p>
      </div>
      {files.map((f, i) => (
        <div key={i} className="rounded-[8px] border border-border p-2">
          <div className="mb-1.5 flex items-center gap-2">
            <Input
              value={f.path}
              placeholder="src/thing.ts"
              onChange={(e) =>
                onChange(files.map((x, j) => (j === i ? { ...x, path: e.target.value } : x)))
              }
              className="font-mono text-[12px]"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
          <Textarea
            rows={6}
            value={f.contents}
            onChange={(e) =>
              onChange(files.map((x, j) => (j === i ? { ...x, contents: e.target.value } : x)))
            }
            className={mono ? "font-mono text-[12px]" : undefined}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...files, { path: "", contents: "" }])}
      >
        Add file
      </Button>
    </div>
  );
}

export function ExerciseForm({
  exercise,
  lessons,
  saveAction,
  verifyAction,
  deleteAction,
}: {
  exercise: {
    id: string;
    title: string;
    slug: string;
    prompt: string;
    language: string;
    published: boolean;
    lessonId: string | null;
    lessonTimecode: number | null;
    differenceNotes: string | null;
    starterFiles: FileRow[];
    solutionFiles: FileRow[];
    testFiles: FileRow[];
    hints: string[];
    testSpec: SpecRow[];
    submissionCount: number;
  };
  lessons: { id: string; title: string; section: string }[];
  saveAction: (formData: FormData) => void | Promise<void>;
  verifyAction: () => Promise<VerifyResult>;
  deleteAction: () => void | Promise<void>;
}) {
  const [starter, setStarter] = useState(exercise.starterFiles);
  const [tests, setTests] = useState(exercise.testFiles);
  const [solution, setSolution] = useState(exercise.solutionFiles);
  const [hints, setHints] = useState(exercise.hints);
  const [spec, setSpec] = useState(exercise.testSpec);
  const [language, setLanguage] = useState(exercise.language);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [checking, startCheck] = useTransition();

  const runnable = RUNNABLE.has(language);

  return (
    <form action={saveAction} className="space-y-4">
      <input type="hidden" name="starterFiles" value={JSON.stringify(starter)} />
      <input type="hidden" name="testFiles" value={JSON.stringify(tests)} />
      <input type="hidden" name="solutionFiles" value={JSON.stringify(solution)} />
      <input type="hidden" name="hints" value={JSON.stringify(hints)} />
      <input type="hidden" name="testSpec" value={JSON.stringify(spec)} />

      <Card>
        <CardHeader>
          <CardTitle>What to build</CardTitle>
          <span className="ml-auto hr-path">{exercise.slug}</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={exercise.title} required />
          </div>
          <div>
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea id="prompt" name="prompt" rows={7} defaultValue={exercise.prompt} />
            <p className="hr-ev">
              Markdown. Describe the failure a learner is fixing, not the API to
              call — the symptom is what makes it memorable.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                id="language"
                name="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l.toLowerCase()}
                  </option>
                ))}
              </Select>
              {!runnable && (
                <p className="hr-ev text-warn">
                  Not executable yet — a submission reports every test as failed
                  and an admin has to pass it manually.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="lessonId">Paired lesson</Label>
              <Select id="lessonId" name="lessonId" defaultValue={exercise.lessonId ?? ""}>
                <option value="">None</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.section} · {l.title}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="lessonTimecode">Timecode (seconds)</Label>
              <Input
                id="lessonTimecode"
                name="lessonTimecode"
                type="number"
                min={0}
                defaultValue={exercise.lessonTimecode ?? ""}
                placeholder="705"
              />
              <p className="hr-ev">Where in the video this is explained.</p>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
                <input
                  type="checkbox"
                  name="published"
                  defaultChecked={exercise.published}
                  className="h-3.5 w-3.5"
                />
                Published
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <FileList
            label="Starter files"
            hint="What the learner opens. Should compile and be plausibly wrong, not empty."
            files={starter}
            onChange={setStarter}
          />
          <FileList
            label="Test files (hidden)"
            hint={
              'Never shown to the learner. Each default-exports [{ name, run }]; run throws to fail. Use node:assert — nothing is installed per run.'
            }
            files={tests}
            onChange={setTests}
          />
          <FileList
            label="Reference solution"
            hint="Shown only after a genuine pass. Also what the check below runs."
            files={solution}
            onChange={setSolution}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test spec</CardTitle>
          <span className="ml-auto hr-ev">
            Names must match the test file exactly
          </span>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="hr-ev">
            This is the contract the learner sees before running anything. A row
            here that never runs counts as failed, so a typo reads as a broken
            exercise rather than a missing test.
          </p>
          {spec.map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Input
                  value={t.name}
                  placeholder="returns rows in descending order"
                  onChange={(e) =>
                    setSpec(spec.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                  }
                  className="font-mono text-[12px]"
                />
                <Input
                  value={t.description ?? ""}
                  placeholder="What this proves, in one line."
                  onChange={(e) =>
                    setSpec(
                      spec.map((x, j) =>
                        j === i ? { ...x, description: e.target.value } : x,
                      ),
                    )
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSpec(spec.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSpec([...spec, { name: "", description: "" }])}
          >
            Add test
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hint ladder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="hr-ev">
            Nudge, then mechanism, then the answer. Revealing the last rung
            costs the proven mark, so it should be worth the cost.
          </p>
          {hints.map((h, i) => (
            <div key={i} className="flex items-start gap-2">
              <Badge variant="untested" className="mt-2 shrink-0">
                {i + 1}
              </Badge>
              <Textarea
                rows={2}
                value={h}
                onChange={(e) =>
                  setHints(hints.map((x, j) => (j === i ? e.target.value : x)))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setHints(hints.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHints([...hints, ""])}
          >
            Add rung
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Difference notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            name="differenceNotes"
            rows={4}
            defaultValue={exercise.differenceNotes ?? ""}
            placeholder="What a passing-but-worse version still costs them in production."
          />
          <p className="hr-ev">
            Shown beside the reference solution after a pass. This is where the
            pattern actually lands.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Check before publishing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="hr-ev">
            Runs the reference solution against these tests. If the author&apos;s
            own answer cannot pass, no learner&apos;s can — and they would be told
            correct code is wrong. Save first; this runs against what is stored.
          </p>
          {verify && (
            <div
              className={`rounded-[8px] border p-3 ${
                verify.ok ? "border-acc bg-acc-soft" : "border-fail bg-fail-soft"
              }`}
            >
              <p className="text-[12.5px] font-semibold">{verify.headline}</p>
              {verify.detail && <p className="hr-ev">{verify.detail}</p>}
              {verify.results.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {verify.results.map((r) => (
                    <li key={r.name} className="text-[12px]">
                      <span className="font-mono">
                        {r.passed ? "✓" : "✕"} {r.name}
                      </span>
                      {!r.passed && r.message && (
                        <span className="hr-ev block">{r.message}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={checking}
            onClick={() => startCheck(async () => setVerify(await verifyAction()))}
          >
            {checking ? "Running…" : "Run reference solution"}
          </Button>
        </CardFooter>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          Save
        </Button>
        {exercise.submissionCount === 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void deleteAction()}>
            Delete
          </Button>
        ) : (
          <span className="hr-ev">
            {exercise.submissionCount} submission(s) recorded — deleting would
            take that evidence with it, so it is disabled.
          </span>
        )}
      </div>
    </form>
  );
}

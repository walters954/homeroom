/**
 * Assembling and reading back an anonymous Apex run. Node 24:
 * `pnpm --filter @homeroom/app test`.
 *
 * The generated block's structure is load-bearing in ways that are Apex rules
 * rather than taste — submitted code inside the wrapper class so statics are
 * legal, per-check try/catch so one failure can't hide the rest, a savepoint
 * unless callouts forbid one. Those are asserted here because getting them
 * wrong produces a runtime error in a learner's org, where it's expensive to
 * find out.
 */

import assert from "node:assert";
import test from "node:test";

import {
  APEX_SENTINEL,
  buildAnonymousApex,
  readAnonymousResult,
  usesCallouts,
} from "./apex-anonymous.ts";

const SUBMITTED = [
  { path: "AccountService.cls", contents: "public Integer total(List<Integer> xs) { return 0; }" },
];
const CHECKS = [
  {
    path: "sumsLineItems.apex",
    contents:
      "void sumsLineItems() { hrRecord('sumsLineItems', total(new List<Integer>{1,2}) == 3, 'expected 3'); }",
  },
];

function signal(payload) {
  return {
    compiled: true,
    success: false,
    // Salesforce prefixes the class name onto the message.
    exceptionMessage: `HomeroomResultException: ${APEX_SENTINEL}${JSON.stringify(payload)}`,
  };
}

test("submitted code sits inside the wrapper class, so statics stay legal", () => {
  const { code } = buildAnonymousApex(SUBMITTED, CHECKS);
  const classAt = code.indexOf("public class HomeroomAttempt");
  const submittedAt = code.indexOf("public Integer total");
  const runAt = code.indexOf("public void hrRunAll");

  assert.ok(classAt > -1 && submittedAt > classAt, "submitted code is outside the class");
  assert.ok(submittedAt < runAt, "submitted code is below the runner");
});

test("each check is invoked in its own try/catch, named", () => {
  const { code, checks } = buildAnonymousApex(SUBMITTED, [
    ...CHECKS,
    { path: "handlesEmpty.apex", contents: "void handlesEmpty() {}" },
  ]);

  assert.deepEqual(checks, ["sumsLineItems", "handlesEmpty"]);
  assert.match(code, /try \{\s*this\.sumsLineItems\(\);\s*\} catch/);
  assert.match(code, /try \{\s*this\.handlesEmpty\(\);\s*\} catch/);
  // Attribution: the catch records against the check that threw.
  assert.match(code, /hrRecord\('sumsLineItems', false/);
});

test("DML is rolled back by default", () => {
  const { code, rollsBack } = buildAnonymousApex(SUBMITTED, CHECKS);
  assert.equal(rollsBack, true);
  assert.match(code, /Savepoint hrSp = Database\.setSavepoint\(\)/);
  assert.match(code, /finally \{\s*Database\.rollback\(hrSp\)/);
});

test("a callout exercise runs without a savepoint, since Apex forbids holding one", () => {
  const calloutCode = [
    { path: "Caller.cls", contents: "public void go() { HttpRequest r = new HttpRequest(); }" },
  ];
  const { code, rollsBack } = buildAnonymousApex(calloutCode, CHECKS);

  assert.equal(rollsBack, false);
  assert.ok(!code.includes("Database.setSavepoint"), "savepoint held across a callout");
  assert.ok(!code.includes("Database.rollback"), "rollback across a callout");
});

test("callout detection covers the usual entry points", () => {
  assert.equal(usesCallouts(["HttpRequest req = new HttpRequest();"]), true);
  assert.equal(usesCallouts(["new HttpResponse()"]), true);
  assert.equal(usesCallouts(["Integer x = 1;"]), false);
});

test("names that aren't Apex identifiers are not invoked", () => {
  const { checks, code } = buildAnonymousApex(SUBMITTED, [
    { path: "not a method.apex", contents: "void x() {}" },
    { path: "9lives.apex", contents: "void y() {}" },
    { path: "valid.apex", contents: "void valid() {}" },
  ]);
  assert.deepEqual(checks, ["valid"]);
  assert.ok(!code.includes("9lives"));
});

test("a quote in a check name cannot break out of the Apex literal", () => {
  const { code } = buildAnonymousApex(SUBMITTED, [
    { path: "it_s_fine.apex", contents: "void it_s_fine() {}" },
  ]);
  assert.match(code, /hrRecord\('it_s_fine'/);
});

test("results are read out of the sentinel", () => {
  const outcome = readAnonymousResult(
    signal([
      { name: "sumsLineItems", passed: true, message: "" },
      { name: "handlesEmpty", passed: false, message: "expected 0" },
    ]),
  );
  assert.equal(outcome.ok, true);
  assert.deepEqual(outcome.results, [
    { name: "sumsLineItems", passed: true, message: "" },
    { name: "handlesEmpty", passed: false, message: "expected 0" },
  ]);
});

test("only an explicit true is a pass", () => {
  for (const passed of ["true", 1, null, undefined]) {
    const outcome = readAnonymousResult(signal([{ name: "a", passed, message: "" }]));
    assert.equal(outcome.results[0].passed, false, `${JSON.stringify(passed)} passed`);
  }
});

test("a compile failure reports where, and is never a pass", () => {
  const outcome = readAnonymousResult({
    compiled: false,
    success: false,
    compileProblem: "Variable does not exist: acc",
    line: 12,
    column: 4,
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /didn't compile/);
  assert.match(outcome.message, /line 12, column 4/);
  assert.match(outcome.message, /Variable does not exist/);
});

test("a run that dies before reporting is a failure with its reason", () => {
  const outcome = readAnonymousResult({
    compiled: true,
    success: false,
    exceptionMessage: "System.NullPointerException: Attempt to de-reference a null object",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /stopped before reporting/);
  assert.match(outcome.message, /NullPointerException/);
});

test("the response a real org actually returns", () => {
  // Captured verbatim from `sf apex run` against a live org, running a block
  // this module generated. Keeps the parser honest against the real envelope
  // rather than only against payloads written to suit it: the class-name
  // prefix on the message, the key order Apex serialises, and an uncaught
  // exception attributed to the check that threw.
  const outcome = readAnonymousResult({
    compiled: true,
    success: false,
    compileProblem: "",
    exceptionMessage:
      'HomeroomResultException: __HOMEROOM_APEX__[{"message":"","passed":true,"name":"sumsValues"},' +
      '{"message":"deliberate failure","passed":false,"name":"failsLoudly"},' +
      '{"message":"System.MathException: Divide by 0 (line 23)","passed":false,"name":"throwsInstead"}]',
  });

  assert.equal(outcome.ok, true);
  assert.deepEqual(outcome.results, [
    { name: "sumsValues", passed: true, message: "" },
    { name: "failsLoudly", passed: false, message: "deliberate failure" },
    {
      name: "throwsInstead",
      passed: false,
      message: "System.MathException: Divide by 0 (line 23)",
    },
  ]);
});

test("a compile failure a real org actually returns", () => {
  // Also captured live — the rule that classes extending Exception must be
  // named *Exception, which this module got wrong until an org said so.
  const outcome = readAnonymousResult({
    compiled: false,
    success: false,
    compileProblem:
      "Classes extending Exception must have a name ending in Exception: HomeroomSignal",
    // Salesforce returns these as strings, not numbers.
    line: "2",
    column: "14",
  });
  assert.equal(outcome.ok, false);
  assert.match(outcome.message, /line 2, column 14/);
});

test("nothing recognisable is a failure, not an empty green run", () => {
  for (const response of [
    {},
    { compiled: true, success: true, exceptionMessage: null },
    { compiled: true, exceptionMessage: `${APEX_SENTINEL}not json` },
    { compiled: true, exceptionMessage: `${APEX_SENTINEL}{"not":"an array"}` },
    { compiled: true, exceptionMessage: `${APEX_SENTINEL}[]` },
    { compiled: true, exceptionMessage: `${APEX_SENTINEL}[{"passed":true}]` },
  ]) {
    const outcome = readAnonymousResult(response);
    assert.equal(outcome.ok, false, `treated as results: ${JSON.stringify(response)}`);
  }
});

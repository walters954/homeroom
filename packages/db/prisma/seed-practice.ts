/**
 * Seeds the practice loop with real Apex content: query ordering guarantees and
 * trigger bulkification. Two skills, one exercise each, three recall questions.
 *
 * Attaches to the first existing course if there is one; otherwise creates a
 * small demo course (with the paired concept lessons, so the watch → attempt
 * handoff is exercisable). Never seeds users — attempts have to be earned.
 *
 * Run from packages/db with Node 24:
 *   pnpm seed:practice
 *   # or: node --env-file=.env prisma/seed-practice.ts
 * Idempotent: re-running updates in place.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ORDERING_STARTER = `public with sharing class AccountRanking {
    /**
     * Powers the "Top accounts" tile on the ops dashboard.
     * Support keeps reporting that two accounts swap places between refreshes,
     * and that an account sometimes drops out of the list entirely.
     */
    public static List<Account> topAccounts(Integer howMany) {
        return [
            SELECT Id, Name, AnnualRevenue
            FROM Account
            WHERE AnnualRevenue != null
            LIMIT :howMany
        ];
    }
}
`;

const ORDERING_SOLUTION = `public with sharing class AccountRanking {
    public static List<Account> topAccounts(Integer howMany) {
        return [
            SELECT Id, Name, AnnualRevenue
            FROM Account
            WHERE AnnualRevenue != null
            ORDER BY AnnualRevenue DESC NULLS LAST, Id ASC
            LIMIT :howMany
        ];
    }
}
`;

const BULK_STARTER = `public with sharing class OpportunityTriggerHandler {
    /**
     * Rolls closed-won amounts up to the parent account.
     * Works fine when a rep closes one deal in the UI. The nightly data load
     * updates ~500 opportunities in a single transaction.
     */
    public static void afterUpdate(List<Opportunity> opportunities) {
        for (Opportunity opp : opportunities) {
            if (opp.StageName != 'Closed Won') {
                continue;
            }
            Account acct = [
                SELECT Id, Total_Won__c FROM Account WHERE Id = :opp.AccountId
            ];
            acct.Total_Won__c =
                (acct.Total_Won__c == null ? 0 : acct.Total_Won__c) + opp.Amount;
            update acct;
        }
    }
}
`;

const BULK_SOLUTION = `public with sharing class OpportunityTriggerHandler {
    public static void afterUpdate(List<Opportunity> opportunities) {
        Map<Id, Decimal> wonByAccount = new Map<Id, Decimal>();

        for (Opportunity opp : opportunities) {
            if (opp.StageName != 'Closed Won' || opp.AccountId == null) {
                continue;
            }
            Decimal running = wonByAccount.containsKey(opp.AccountId)
                ? wonByAccount.get(opp.AccountId)
                : 0;
            wonByAccount.put(opp.AccountId, running + opp.Amount);
        }

        if (wonByAccount.isEmpty()) {
            return;
        }

        List<Account> toUpdate = new List<Account>();
        for (Account acct : [
            SELECT Id, Total_Won__c FROM Account WHERE Id IN :wonByAccount.keySet()
        ]) {
            Decimal current = acct.Total_Won__c == null ? 0 : acct.Total_Won__c;
            acct.Total_Won__c = current + wonByAccount.get(acct.Id);
            toUpdate.add(acct);
        }

        update toUpdate;
    }
}
`;

async function main() {
  // --- Course -------------------------------------------------------------
  let course = await db.course.findFirst({ orderBy: { createdAt: "asc" } });
  let orderingLessonId: string | null = null;
  let bulkLessonId: string | null = null;

  if (!course) {
    course = await db.course.create({
      data: {
        title: "Apex That Survives Production",
        slug: "apex-that-survives-production",
        description:
          "The handful of Apex behaviours that only bite once real data volume shows up: ordering guarantees, governor limits, and bulk-safe triggers.",
        published: true,
      },
    });

    const section = await db.section.create({
      data: { courseId: course.id, title: "Querying and triggers", order: 1 },
    });

    const orderingLesson = await db.lesson.create({
      data: {
        sectionId: section.id,
        title: "SOQL makes no ordering promise",
        slug: "soql-ordering-guarantees",
        order: 1,
        published: true,
        durationSeconds: 940,
        body: {
          markdown:
            "SOQL returns rows in whatever order the query optimiser found convenient. There is no default sort — not by Id, not by created date, not by the order rows went in. `LIMIT` without `ORDER BY` is not a top-N query; it is *some* N rows.\n\nThe failure mode is quiet: it looks stable in a sandbox with 40 records and starts shuffling in production.",
        },
      },
    });
    orderingLessonId = orderingLesson.id;

    const bulkLesson = await db.lesson.create({
      data: {
        sectionId: section.id,
        title: "One transaction, 200 records",
        slug: "trigger-bulkification",
        order: 2,
        published: true,
        durationSeconds: 1320,
        body: {
          markdown:
            "A trigger does not fire once per record. It fires once per batch, with up to 200 records in `Trigger.new`, and every SOQL query or DML statement inside a loop multiplies against that batch until a governor limit ends the transaction.\n\nThe shape that works is always the same: collect ids in a map, query once outside the loop, mutate in memory, DML once at the end.",
        },
      },
    });
    bulkLessonId = bulkLesson.id;

    console.log(`Created demo course ${course.slug} with 2 paired lessons.`);
  } else {
    const lessons = await db.lesson.findMany({
      where: { section: { courseId: course.id } },
      orderBy: [{ order: "asc" }],
      take: 2,
    });
    orderingLessonId = lessons[0]?.id ?? null;
    bulkLessonId = lessons[1]?.id ?? lessons[0]?.id ?? null;
    console.log(`Attaching practice content to existing course ${course.slug}.`);
  }

  // --- Skills -------------------------------------------------------------
  const ordering = await upsertSkill(course.id, {
    name: "Query ordering guarantees",
    description:
      "Knowing what SOQL does and does not promise about row order, and writing queries whose results are stable across runs.",
    order: 1,
  });

  const bulkification = await upsertSkill(course.id, {
    name: "Trigger bulkification",
    description:
      "Writing trigger logic that survives a 200-record batch: no SOQL or DML inside a loop, ever.",
    order: 2,
  });

  // --- Exercises ----------------------------------------------------------
  await db.exercise.upsert({
    where: { slug: "deterministic-top-accounts" },
    create: {
      slug: "deterministic-top-accounts",
      skillId: ordering.id,
      lessonId: orderingLessonId,
      lessonTimecode: 705,
      title: "Make the top-accounts query deterministic",
      language: "APEX",
      order: 1,
      published: true,
      prompt: ORDERING_PROMPT,
      starterFiles: [
        { path: "classes/AccountRanking.cls", contents: ORDERING_STARTER },
      ],
      solutionFiles: [
        { path: "classes/AccountRanking.cls", contents: ORDERING_SOLUTION },
      ],
      hints: ORDERING_HINTS,
      testSpec: [
        {
          name: "returns rows in descending annual revenue",
          description: "The highest-revenue account is first, every run.",
        },
        {
          name: "breaks ties on a unique field",
          description:
            "Two accounts with identical revenue keep a stable relative order.",
        },
        {
          name: "returns exactly the requested number of rows",
          description: "topAccounts(5) returns 5 rows when 5 or more qualify.",
        },
        {
          name: "same result on a repeated call",
          description:
            "Called twice against unchanged data, the two lists are identical.",
        },
      ],
      differenceNotes: ORDERING_DIFFERENCE,
    },
    update: {
      skillId: ordering.id,
      lessonId: orderingLessonId,
      published: true,
      prompt: ORDERING_PROMPT,
      hints: ORDERING_HINTS,
      differenceNotes: ORDERING_DIFFERENCE,
    },
  });

  await db.exercise.upsert({
    where: { slug: "bulkify-opportunity-rollup" },
    create: {
      slug: "bulkify-opportunity-rollup",
      skillId: bulkification.id,
      lessonId: bulkLessonId,
      lessonTimecode: 1112,
      title: "Bulkify the closed-won rollup",
      language: "APEX",
      order: 1,
      published: true,
      prompt: BULK_PROMPT,
      starterFiles: [
        {
          path: "classes/OpportunityTriggerHandler.cls",
          contents: BULK_STARTER,
        },
      ],
      solutionFiles: [
        {
          path: "classes/OpportunityTriggerHandler.cls",
          contents: BULK_SOLUTION,
        },
      ],
      hints: BULK_HINTS,
      testSpec: [
        {
          name: "issues at most one SOQL query",
          description: "Limits.getQueries() is 1 or 0 after the handler runs.",
        },
        {
          name: "issues at most one DML statement",
          description: "One update for the whole batch, not one per record.",
        },
        {
          name: "survives a 200-record batch",
          description: "No governor limit exception on a full trigger batch.",
        },
        {
          name: "sums multiple opportunities per account",
          description:
            "Two closed-won deals on one account add together rather than overwrite.",
        },
        {
          name: "ignores stages other than Closed Won",
          description: "A batch of Prospecting records changes nothing.",
        },
      ],
      differenceNotes: BULK_DIFFERENCE,
    },
    update: {
      skillId: bulkification.id,
      lessonId: bulkLessonId,
      published: true,
      prompt: BULK_PROMPT,
      hints: BULK_HINTS,
      differenceNotes: BULK_DIFFERENCE,
    },
  });

  // --- Recall questions ---------------------------------------------------
  await upsertQuestion(ordering.id, orderingLessonId, 712, {
    prompt:
      "A SOQL query with LIMIT 10 and no ORDER BY runs twice against data nobody changed in between. What are you guaranteed about the two result sets?",
    options: [
      "Nothing — without ORDER BY the order is undefined, so even which ten rows come back can differ",
      "The same ten rows in the same order; SOQL falls back to ordering by Id",
      "The same ten rows, possibly in a different order",
    ],
    correctIndex: 0,
  });

  await upsertQuestion(ordering.id, orderingLessonId, 848, {
    prompt:
      "You add ORDER BY AnnualRevenue DESC to a top-10 query. Two accounts have identical revenue. What is still undefined?",
    options: [
      "Which of the two tied accounts comes first, and therefore which one survives the LIMIT at the boundary",
      "Whether descending order is respected at all",
      "Whether LIMIT returns ten rows when ten qualify",
    ],
    correctIndex: 0,
  });

  await upsertQuestion(bulkification.id, bulkLessonId, 1180, {
    prompt:
      "A trigger handler runs one SOQL query inside a for loop over Trigger.new. A data load updates 500 opportunities in a single transaction. What actually happens?",
    options: [
      "The 101st query throws System.LimitException and the whole transaction rolls back",
      "Salesforce batches the queries for you, so it is slower but succeeds",
      "The trigger runs once per record, each invocation with its own fresh limits",
    ],
    correctIndex: 0,
  });

  console.log("Practice seed complete: 2 skills, 2 exercises, 3 recall questions.");
}

async function upsertSkill(
  courseId: string,
  data: { name: string; description: string; order: number },
) {
  const existing = await db.skill.findFirst({
    where: { courseId, name: data.name },
  });
  if (existing) {
    return db.skill.update({ where: { id: existing.id }, data });
  }
  return db.skill.create({ data: { courseId, ...data } });
}

async function upsertQuestion(
  skillId: string,
  sourceLessonId: string | null,
  sourceTimecode: number,
  q: { prompt: string; options: string[]; correctIndex: number },
) {
  const existing = await db.recallQuestion.findFirst({
    where: { skillId, prompt: q.prompt },
  });
  if (existing) {
    return db.recallQuestion.update({
      where: { id: existing.id },
      data: { ...q, sourceLessonId, sourceTimecode },
    });
  }
  return db.recallQuestion.create({
    data: { skillId, sourceLessonId, sourceTimecode, ...q },
  });
}

const ORDERING_PROMPT = `Support has two bug reports open against the **Top accounts** dashboard tile:

- Two accounts swap places between refreshes, with no data change in between.
- An account that should be in the top five occasionally vanishes from the list.

Both come from the same line of Apex. \`AccountRanking.topAccounts\` uses \`LIMIT\` to take the top N by revenue — except \`LIMIT\` does not know anything about revenue.

**Fix \`topAccounts\` so that:**

1. The highest-revenue accounts are the ones returned, every run.
2. Two accounts with identical \`AnnualRevenue\` keep a stable relative order.
3. Calling it twice against unchanged data returns identical lists.

Change the query only. Do not sort in Apex after the fact — the rows have already been chosen wrongly by then.`;

const ORDERING_HINTS = [
  "LIMIT decides how many rows come back. Ask yourself what decides which ones.",
  "SOQL has no default sort — not Id, not CreatedDate, nothing. Add ORDER BY on the field the tile is actually ranking by. Then think about what happens when two rows tie on it: a second sort key on a field that is unique per row is what makes the result reproducible.",
  `Full solution:

\`\`\`apex
SELECT Id, Name, AnnualRevenue
FROM Account
WHERE AnnualRevenue != null
ORDER BY AnnualRevenue DESC NULLS LAST, Id ASC
LIMIT :howMany
\`\`\`

\`ORDER BY\` runs before \`LIMIT\`, so the right rows are chosen and then cut. \`Id ASC\` is the tiebreaker: it is unique, so no two rows can still be ambiguous after it.`,
];

const ORDERING_DIFFERENCE = `Both versions return the top accounts. The difference shows up in two places you will not see in a sandbox:

- **The tiebreaker.** Without \`Id ASC\`, ties are resolved by whatever the optimiser did that day. That is invisible until a tie lands exactly on the \`LIMIT\` boundary — and then one account silently drops out of the list on some refreshes and not others. That is the "vanishing account" bug report, and it is unreproducible without the second sort key.
- **NULLS LAST.** The \`WHERE\` clause already excludes null revenue here, so it changes nothing today. It stops being decorative the moment someone loosens that filter, which is exactly the kind of edit that gets made without re-reading the ORDER BY.

If you sorted in Apex instead of in the query: the rows were already chosen by \`LIMIT\` before your sort ran, so you would be carefully ordering the wrong five accounts.`;

const BULK_PROMPT = `\`OpportunityTriggerHandler.afterUpdate\` rolls closed-won amounts up to the parent account. It passes review, works in the UI, and fails every night.

The nightly integration updates about 500 opportunities in one transaction. Trigger batches are up to 200 records, and this handler issues one SOQL query **and** one DML statement per record inside the loop.

**Rewrite \`afterUpdate\` so that it:**

1. Issues at most one SOQL query and one DML statement, regardless of batch size.
2. Sums correctly when several closed-won opportunities share one account.
3. Ignores opportunities in any other stage, and opportunities with no account.

Keep the same method signature.`;

const BULK_HINTS = [
  "Count the queries. How many times does that SOQL line run when Trigger.new holds 200 records?",
  "Split the work into two passes. The first walks the opportunities and accumulates what each account is owed into a Map<Id, Decimal> — no SOQL, no DML. The second queries every account in that map's keySet() at once, applies the totals in memory, and issues a single update on the collected list.",
  `Full solution:

\`\`\`apex
Map<Id, Decimal> wonByAccount = new Map<Id, Decimal>();
for (Opportunity opp : opportunities) {
    if (opp.StageName != 'Closed Won' || opp.AccountId == null) continue;
    Decimal running = wonByAccount.containsKey(opp.AccountId)
        ? wonByAccount.get(opp.AccountId) : 0;
    wonByAccount.put(opp.AccountId, running + opp.Amount);
}
if (wonByAccount.isEmpty()) return;

List<Account> toUpdate = new List<Account>();
for (Account acct : [SELECT Id, Total_Won__c FROM Account
                     WHERE Id IN :wonByAccount.keySet()]) {
    Decimal current = acct.Total_Won__c == null ? 0 : acct.Total_Won__c;
    acct.Total_Won__c = current + wonByAccount.get(acct.Id);
    toUpdate.add(acct);
}
update toUpdate;
\`\`\`

One query, one DML, whatever the batch size.`,
];

const BULK_DIFFERENCE = `A version that queries once but still calls \`update\` inside the account loop passes four of the five tests and still fails in production — DML statements have their own limit of 150, and 200 accounts blows through it just as reliably as 200 queries do. Count both.

Two more differences worth the read:

- **The early return.** Without \`if (wonByAccount.isEmpty()) return;\`, a batch containing no closed-won records still issues a query with an empty \`IN\` clause. Harmless in isolation; not harmless when this handler is one of six firing on the same transaction and the transaction has 100 queries to spend.
- **Accumulating in the map, not on the record.** Summing into \`Map<Id, Decimal>\` first is what makes two deals on the same account add rather than overwrite. Mutating the \`Account\` inside the opportunity loop reintroduces that bug even with the queries pulled out — which is why the "sums multiple opportunities per account" test exists separately from the limit tests.`;

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

---
name: minimise
description: Use when reducing codebase size, removing duplication and dead code, collapsing abstractions, or when the user says "too many lines", "minimise", "shrink", "simplify", "consolidate", "this file is too big". Front-loads a hard rule: line count is never the objective, behaviour preservation is.
---

# Minimise

Reduce a codebase to the smallest thing that still does everything it does.

**The objective is not a smaller line count.** It is the smallest amount of
code that implements the same behaviour. Those are different goals, and the
second one is the only one worth having. A 1,600-line component that renders a
video feed, a comment sheet, a camera and a music picker is not bloated —
deleting 1,500 lines of it deletes the product.

Every reduction below is a *removal of something that was never doing work*.

---

## Rule zero: never trade behaviour for lines

These are not acceptable reductions:

- **Deleting a feature** to hit a number. If a route, screen, or code path
  stops working, the reduction failed, however impressive the diff looks.
- **Collapsing distinct cases** into one that handles "most" of them. The
  cleared cases were the reason the branches existed.
- **Inlining to save a function declaration** when the function is called from
  more than one place.
- **Removing a guard** because "it can't happen". It happened; that is why the
  guard is there.
- **Shortening identifiers** until the code is unreadable. Names are the thing
  you read; lines are not the thing you pay for.

If a reduction cannot be justified as "this was doing nothing", do not make it.

---

## Before touching anything

Measure, so you know what you are actually looking at and can prove the
after-state is better.

```bash
# Largest files — the honest candidates for accidental complexity
git ls-files | xargs wc -l 2>/dev/null | sort -rn | head -30

# Unused exports: what is exported that nothing imports
rg --type ts --type tsx -l "export " src | head -50

# Dead code: what is declared and never referenced
rg "\b(\w+)\s*=\s*\(\) =>" -o --no-filename | sort | uniq -c | sort -rn

# Duplicate shapes: two implementations of the same thing
rg "TODO|FIXME|HACK|XXX|placeholder|Placeholder|mock|Mock|dummy" -i
```

Record the numbers. You will need them to prove the change was an improvement
and not a rewrite.

---

## What can actually be removed, in order of safety

### 1. Dead code (zero risk, always do it)
- Unused imports, unused locals, unused exported functions and types
- Branches that can never be reached (`if (step === 1)` inside a block that
  already returned at `step === 1`)
- State that is written and never read
- Placeholder and mock data left in production paths — this is the highest
  value category and the most commonly shipped. `social.controller.js:184`
  returned "User muted (Placeholder)" and wrote nothing; the UI confirmed a
  mute that never happened.

**Verify with**: a type checker, and a grep counting references to what you
removed. `rg "nameIremoved"` returning only the definition is not proof — it
proves nothing *in the repo* uses it, which is exactly what you want, but also
check dynamic access (`obj[name]`, `import()`, string-keyed maps).

### 2. Duplication (low risk)
- The same block in three or more places. Extract once, call three times.
- Two conditions that compute the same thing. This is a real bug class, not
  just duplication: `Moments.tsx` had one `isVideo` verdict computed fully
  from `is_video`/`media_type`/`video_url`/`streaming_url` and a *second* one
  recomputed from the URL alone. They disagreed, and a moment flagged as video
  whose URL had no media extension rendered an `<img>` for a video — a tile
  that could never load.
- Two response shapes for one resource. Not a size problem, a correctness one:
  consumers break on the variant they were not written for.

### 3. Over-abstraction (medium risk — the one that most often goes wrong)
- A wrapper that adds nothing over the thing it wraps
- A generic parameter used by exactly one caller
- A factory producing one product
- An interface with one implementation

Removing an abstraction is safe only when the abstraction is genuinely unused.
"One caller today" is not a reason to inline — a second caller next month is
the normal case, and re-extracting is far cheaper than re-testing.

### 4. Whole-file consolidation (highest risk — avoid unless asked)
Splitting or merging files changes the diff for everyone reviewing and buys
nothing a reader can use. Only do this when the file boundaries are actively
misleading (a 2,000-line "utils" that is four unrelated modules) or when the
user explicitly asked for the layout change.

---

## How to make a reduction safely

1. **Prove the current behaviour.** Run the tests first and record the result.
   A reduction made against a red baseline is unreviewable — you cannot tell
   your breakage from the pre-existing breakage.
2. **Make one class of change at a time.** Dead code in one commit, duplication
   in another. A commit that does both cannot be reviewed or reverted.
3. **Verify after each class**, with the same command you ran in step 1.
4. **Never let the gate get worse.** If type errors were 143 and now they are
   148, the "reduction" added work. Fix it or revert it.

---

## Hard stops

Stop and report rather than continuing if:

- **A test fails that passed before.** Revert. A reduction that breaks a test
  was not a reduction.
- **A gate goes from green to red**, even if the diff is smaller.
- **You cannot explain the removal in one sentence** that starts with "this was
  never…". If the explanation starts with "this probably…", you are guessing.
- **The change is in the money or auth path** (`wallet`, `paystack`, `auth`,
  `config/paystack`, `services/wallet.service`). These get reviewed by a human,
  not just a gate.
- **You would need to delete a feature** to reach the target number.

---

## Reporting

Report what you removed and what you proved, never the line count as a
headline:

```
Removed: 12 unused exports, 3 unreachable branches, 1 placeholder response
Proved:  typecheck 143 -> 131 (12 fewer), tests 162/162 unchanged
Not removed: Moments.tsx (1,600 lines) — every section is reachable and used
```

The last line matters. Saying what you *chose not to* shrink, and why, is what
separates an audit from a rewrite.

---

## Red flags that a "reduction" is actually damage

- A file went from 800 lines to 200 and the tests still pass, but the feature
  list got shorter.
- A duplicated block is now "shared" but the two call sites wanted different
  behaviour and one was quietly changed.
- A guard disappeared and the crash moved from a clear error to a silent
  wrong answer.
- The commit message leads with a line count.

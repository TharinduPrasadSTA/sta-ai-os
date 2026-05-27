# Create Plan

Create a detailed implementation plan for changes to your AI OS. Plans are thorough documents that capture the full context, rationale, and step-by-step tasks needed to execute a change.

## Variables

request: $ARGUMENTS (describe what you want to plan — new data source, new function, structural change, etc.)

---

## Instructions

- **IMPORTANT:** You are creating a PLAN, not implementing changes. Research thoroughly, think deeply, then output a comprehensive plan document.
- Consider which layer of the AI OS this change affects (Context, Data, Function)
- Create the plan in `plans/` with filename: `YYYY-MM-DD-{descriptive-name}.md`
- Follow existing patterns. Study similar files in the workspace before proposing new structures.

---

## Research Phase

Before writing the plan, investigate:

1. **Read core files:**
   - `CLAUDE.md` — AI OS architecture
   - `context/` — current business context
   - `reference/architecture.md` — layer dependencies

2. **Explore relevant areas:**
   - If adding a data source: check `context/integrations.md` and `scripts/`
   - If adding a function: check `outputs/` and existing scripts
   - If modifying context: read all context files for consistency

3. **Check layer dependencies:**
   - Does this require a layer below it to be complete first?
   - What context or data does this change need to work properly?

---

## Plan Format

```markdown
# Plan: <descriptive title>

**Created:** <YYYY-MM-DD>
**Status:** Draft
**Layer:** <AI OS / Context / Data / Function>
**Request:** <one-line summary>

---

## Overview

### What This Accomplishes
<2-3 sentences describing the end result>

### Why It Matters
<Connect to strategy.md priorities or business goals>

### Layer Dependencies
<What must be in place before this can be built?>

---

## Current State
<Relevant existing structure and gaps>

---

## Proposed Changes

### Summary
<Bulleted list of changes>

### New Files

| File Path | Purpose |
|-----------|---------|
| `path/to/file` | Description |

### Files to Modify

| File Path | Changes |
|-----------|---------|
| `path/to/file` | Description |

---

## Design Decisions
1. **<Decision>**: <Rationale>

---

## Step-by-Step Tasks

### Step 1: <Title>
<Description>

**Actions:**
- <Specific action>

**Files affected:**
- `path/to/file`

---

## Validation Checklist
- [ ] <Verification step>

## Success Criteria
1. <Measurable outcome>
```

---

## Quality Standards

- **Completeness:** Every section filled out, no generic placeholders
- **Actionability:** Steps are detailed enough that `/implement` can execute without questions
- **Layer-aware:** Plan accounts for which AI OS layer is being built or modified
- **Consistency:** Follows existing workspace patterns
- **Clarity:** Someone unfamiliar could understand and execute

---

## After Creating the Plan

1. Provide a brief summary of what the plan covers
2. List any open questions that need input before implementation
3. Provide the full path to the plan file
4. Remind user to run `/implement plans/YYYY-MM-DD-{name}.md` to execute

**CRITICAL: Do not auto-implement. Always stop after presenting the plan.**

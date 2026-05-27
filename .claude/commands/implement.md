# Implement

Execute an implementation plan created by `/create-plan`. Read the plan thoroughly, execute each step in order, and report on the completed work.

## Variables

plan_path: $ARGUMENTS (path to the plan file, e.g., `plans/2026-03-24-sync-crm-data.md`)

---

## Instructions

### Phase 1: Understand the Plan

1. **Read the plan file completely.** Do not skim — understand every section.
2. **Verify prerequisites:**
   - Are there open questions that need answers first?
   - Are there layer dependencies that aren't met? (e.g., Context incomplete but building a Function)
   - If blockers exist, stop and ask before proceeding.
3. **Confirm the plan is ready:**
   - Status should be "Draft" or "Ready"
   - All sections should be filled out

---

### Phase 2: Execute the Plan

1. **Follow the Step-by-Step Tasks in exact order.**
   - Complete each step fully before moving to the next
   - If a step involves creating a file, write the complete file — not a stub
   - If a step involves modifying a file, read it first, then apply changes precisely

2. **For each task:**
   - Read any files that will be affected
   - Make the changes specified
   - Verify the change is correct before proceeding

3. **Handle issues gracefully:**
   - If a step can't be completed as written, note the issue and adapt if the intent is clear
   - If unsure how to proceed, ask rather than guessing
   - Document any deviations from the plan

---

### Phase 3: Validate

1. **Run through the Validation Checklist** from the plan
2. **Verify Success Criteria** are met
3. **Check consistency:**
   - New files referenced where they should be
   - CLAUDE.md updated if workspace structure changed
   - Naming conventions followed

---

### Phase 4: Update Plan Status

Change `**Status:** Draft` to `**Status:** Implemented` and add:

```markdown
---

## Implementation Notes

**Implemented:** <YYYY-MM-DD>

### Summary
<Brief summary of what was done>

### Deviations from Plan
<List any changes, or "None">

### Issues Encountered
<List any problems and resolutions, or "None">
```

---

## Report

After implementation, provide:

1. **Summary:** Bulleted list of work completed
2. **Files changed:** All files created, modified, or deleted
3. **Validation results:** Status of each checklist item
4. **Deviations:** Any changes from the original plan
5. **Next steps:** Follow-up actions needed (if any)

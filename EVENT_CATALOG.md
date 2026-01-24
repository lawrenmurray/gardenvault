# Guardian Telemetry Event Catalog

## Overview
This document catalogs all event types emitted by the Guardian telemetry system. Events are organized by section and purpose.

---

## Record Types & Routing

Events are transmitted to Google Apps Script with a `record_type` field for sheet routing:

| record_type | Description | Destination Sheet |
|-------------|-------------|-------------------|
| `session` | Session end events | sessions |
| `artifact` | Completed artifact summaries | artifacts |
| `raw_event` | Word-boundary input batches | raw_events |
| `interaction` | Semantic interaction events | interactions |

---

## Artifact Kinds & Status Values

### Entrance Artifacts

| kind | Description | Status Values |
|------|-------------|---------------|
| `entrance_casual` | "What shall I call you?" | `submitted` (any input accepted) |
| `entrance_name` | Real name validation (realName, finalName) | `accepted` (valid), `failed` (invalid) |
| `entrance_path` | Special path shortcuts (pearls, beloved_rose) | `accepted` |
| `entrance_bookmark` | "Did you keep it?" choice | `submitted` |
| `entrance_front` | Front inscription validation | `accepted`, `failed` |
| `entrance_back` | Back inscription validation | `accepted`, `failed` |

**Note:** When `pearls` or `beloved`/`rose` is detected in casualName, the `entrance_casual` artifact is **not emitted** - only `entrance_path` is emitted. The raw input is still captured via `raw.input.batch`.

### Whisper Artifacts

| kind | Description | Status Values |
|------|-------------|---------------|
| `whisper_attempt` | Individual typing attempt | `submitted` |
| `whisper_sent` | Final confirmed send to garden | `submitted` |
| `whisper_silenced` | User exited with unsent content | `abandoned` |

### Poem Artifacts

| kind | Description | Status Values |
|------|-------------|---------------|
| `poem_request` | Poem request attempt | `submitted`, `abandoned` |

**Expressive Artifact Rule:** `poem_request` artifacts are suppressed if user typed 0 characters and had 0 paste operations (empty engagement).

---

## Core Session Events

| event_type | Description | When Emitted |
|------------|-------------|--------------|
| `session.end` | Complete session summary | Page unload or visibility hidden (after 5s) |

**Note:** There is no `session.start` event. The `session.end` event contains complete session data including `session_start_iso`.

### session.end Payload

| Field | Type | Description |
|-------|------|-------------|
| `session_start_iso` | string | ISO timestamp of session start |
| `session_duration_ms` | number | Total session duration |
| `visit_count` | number | Total visits by this persistent_id |
| `flush_reason` | string | "page_unload" or "visibility_hidden" |
| `raw_buffers_flushed_count` | number | Buffers with pending data at end |
| `events_sent_count` | number | Total events sent during session |
| `session_signature` | object | Descriptive session summary (see below) |

---

## Raw Input Events

| event_type | Description |
|------------|-------------|
| `raw.input.batch` | Word-boundary input capture |

### Word Capture Rule (STRICT)
Words are captured **ONLY** when the user types a literal SPACE character (ASCII 32).

**NOT captured on:** Tab, Enter, newline, blur, interval flush, or any other trigger.

**Exception:** On `artifact_end`, the final trailing word (if any) is captured with `trailing: true` flag.

### raw.input.batch Payload

| Field | Type | Description |
|-------|------|-------------|
| `field_id` | string | Input field identifier |
| `artifact_start_iso` | string | When associated artifact started |
| `artifact_elapsed_ms_at_flush` | number | Time since artifact start (null if no artifact) |
| `words` | array | Captured words (see below) |
| `aggregates` | object | Typing statistics (see below) |
| `flush_reason` | string | What triggered the flush |

### Words Array Entry

| Field | Type | Description |
|-------|------|-------------|
| `word` | string | The captured word (unmodified case) |
| `t` | number | Milliseconds since session/artifact start |
| `timeSinceLastWord` | number | Milliseconds since previous word |
| `trailing` | boolean | True if captured on artifact_end (optional) |

### Aggregates Object

| Field | Type | Description |
|-------|------|-------------|
| `wordCount` | number | Words in this batch |
| `totalCharsTyped` | number | Characters typed |
| `totalCharsDeleted` | number | Characters deleted |
| `editRatio` | number | deleted/typed ratio (0-1) |
| `avgPauseDuration` | number | Average pause > 100ms (ms) |
| `maxPause` | number | Longest pause (ms) |
| `longPauseCount` | number | Pauses >= 2000ms |
| `longPauseWords` | array | Words after long pauses |
| `avgWordDuration` | number | Average time between words (ms) |
| `slowWords` | array | Words taking > 2x average |
| `pasteDetected` | boolean | Paste operation occurred |

### Flush Reasons

| Reason | Description |
|--------|-------------|
| `artifact_end` | Artifact completed |
| `artifact_switch` | Different artifact started |
| `blur` | Input field lost focus |
| `buffer_full` | 50 words reached |
| `interval` | Periodic flush (500ms) |

---

## Entrance Flow Events

### Step Events

| event_type | Description | Payload |
|------------|-------------|---------|
| `entrance.step.enter` | User enters step | `step_num`, `step_name` |
| `entrance.step.exit` | User exits step | `step_num`, `step_name`, `duration_ms` |

### Validation Events

| event_type | Description | Payload |
|------------|-------------|---------|
| `entrance.verification.success` | Correct answer | `step_name`, `attempts` |
| `entrance.verification.failure` | Wrong answer | `step_name`, `reason`, `attempt_num` |

### Flow Completion

| event_type | Description | Payload |
|------------|-------------|---------|
| `entrance.flow.complete` | Entrance completed | `accepted`, `pearls_used`, `steps_completed`, `failure_counts`, `casual_name`, `real_name`, `kept_bookmark` |

### Entrance Artifact Payload

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | Artifact kind (see table above) |
| `status` | string | `accepted`, `failed`, `submitted`, `abandoned` |
| `duration_ms` | number | Time spent on this artifact |
| `chars_typed` | number | Characters typed |
| `chars_deleted` | number | Characters deleted |
| `edit_ratio` | number | deleted/typed ratio |
| `paste_count` | number | Paste operations |
| `final_text` | string | Submitted text |
| `final_length` | number | Character count |
| `word_count` | number | Word count |
| `attempt_count` | number | Attempt number (for validated steps) |
| `path_type` | string | For entrance_path: "pearls" or "beloved_rose" |
| `kept_bookmark` | boolean | For entrance_bookmark: user's choice |
| `failure_reason` | string | For failed status |
| `narrative_summary` | string | Human-readable summary |

### Step Names (by index)

| Index | Step Name |
|-------|-----------|
| 0 | greeting |
| 1 | casualName |
| 2 | helloMessage |
| 3 | gardenMessage |
| 4 | realName |
| 5 | bookmarkStatement |
| 6 | bookmarkQuestion |
| 7 | frontInscription |
| 8 | backInscription |
| 9 | welcomeJessica |
| 10 | revealGarden |

---

## Menu Events

| event_type | Description | Payload |
|------------|-------------|---------|
| `menu.opened` | Menu displayed | - |
| `menu.intent` | Option selected | `option`, `time_to_decision_ms`, `help_opened_count`, `total_help_dwell_ms` |
| `menu.help.opened` | Help modal opened | `open_count` |
| `menu.help.closed` | Help modal closed | `dwell_ms` |

---

## Whisper Events

### Interaction Events

| event_type | Description | Payload |
|------------|-------------|---------|
| `whisper.textarea.focus` | Textarea focused | - |
| `whisper.timing.changed` | Timing mode changed | `from`, `to` |
| `whisper.edit_mode.entered` | Edit mode entered | - |
| `whisper.submit` | Single whisper submitted | `length`, `is_edit`, `whisper_number` |
| `whisper.ring.filled` | Ring reached capacity | `ring` (1, 2, or 3) |
| `whisper.confirmation.shown` | Send confirmation shown | - |
| `whisper.confirmation.choice` | Confirmation response | `choice` |
| `whisper.section.complete` | Section ended | `total_whispers_sent`, `confirmation_shown`, `outcome` |

### Whisper Artifact Payload

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | `whisper_attempt`, `whisper_sent`, or `whisper_silenced` |
| `status` | string | `submitted` or `abandoned` |
| `duration_ms` | number | Time on this artifact |
| `chars_typed` | number | Characters typed |
| `chars_deleted` | number | Characters deleted |
| `edit_ratio` | number | deleted/typed ratio |
| `paste_count` | number | Paste operations |
| `final_text` | string | Whisper text |
| `final_length` | number | Character count |
| `word_count` | number | Word count |
| `whisper_number` | number | Which whisper (1-indexed) |
| `total_whispers` | number | For whisper_sent: total count |
| `is_edit` | boolean | Whether this was an edit |
| `edit_mode_used` | boolean | Edit mode was used |
| `timing_mode_changes` | number | Times timing changed |
| `narrative_summary` | string | Human-readable summary |

### Section Complete Outcomes

| Outcome | Description |
|---------|-------------|
| `sent` | Whispers confirmed and sent |
| `silenced` | Exited with unsent content |
| `empty` | Exited with no content |

---

## Poem Events

### Interaction Events

| event_type | Description | Payload |
|------------|-------------|---------|
| `poem.book.opened` | Book opened | - |
| `poem.textarea.focus` | Textarea focused | - |
| `poem.page.overflow` | Text overflowed to right page | - |
| `poem.swipe_confirm.shown` | Swipe confirm shown | - |
| `poem.swipe_confirm.choice` | Swipe confirm response | `choice` |
| `poem.return_confirm.shown` | Return confirm shown | - |
| `poem.return_confirm.choice` | Return confirm response | `choice` |

### Poem Artifact Payload

| Field | Type | Description |
|-------|------|-------------|
| `kind` | string | `poem_request` |
| `status` | string | `submitted` or `abandoned` |
| `duration_ms` | number | Time on this artifact |
| `chars_typed` | number | Characters typed |
| `chars_deleted` | number | Characters deleted |
| `edit_ratio` | number | deleted/typed ratio |
| `paste_count` | number | Paste operations |
| `final_text` | string | Poem request text |
| `final_length` | number | Character count |
| `word_count` | number | Word count |
| `overflow_occurred` | boolean | Text overflowed |
| `swipe_confirm_shown` | boolean | Confirm was shown |
| `typing_tempo` | object | `{ fast, normal, slow }` counts |
| `narrative_summary` | string | Human-readable summary |

---

## Semantic Interaction Events

| event_type | Description | Payload |
|------------|-------------|---------|
| `interaction.typing.feedback` | Visual feedback triggered | `type` (bloom, erasure), `field` |
| `interaction.typing.paste` | Paste detected | `field_id`, `hasData` |
| `interaction.typing.copy` | Copy detected | `field_id`, `selection_length` |
| `interaction.cursor.move` | Cursor moved (250ms debounce) | `field_id`, `cursor_start`, `cursor_end` |
| `interaction.commit.absorb` | Ring absorption | `type` |

---

## Field IDs

| field_id | Section | Description |
|----------|---------|-------------|
| `entrance.casualName` | entrance | "What shall I call you?" |
| `entrance.realName` | entrance | "Your name?" |
| `entrance.finalName` | entrance | "What is your real name?" |
| `entrance.frontInscription` | entrance | Front bookmark inscription |
| `entrance.backInscription` | entrance | Back bookmark inscription |
| `whisper.textarea` | whisper | Whisper input |
| `poem.textarea` | poem | Poem request input |

---

## Device Fingerprint

Included in `device_fingerprint_json`:

| Field | Description |
|-------|-------------|
| `userAgent` | Browser user agent |
| `platform` | navigator.platform |
| `language` | Primary language |
| `languages` | All accepted languages |
| `timezone` | IANA timezone |
| `timezoneOffset` | UTC offset (minutes) |
| `screenWidth`, `screenHeight` | Full screen |
| `availWidth`, `availHeight` | Available area |
| `devicePixelRatio` | Display scaling |
| `colorDepth` | Bits per color |
| `touchSupport` | Touch available |
| `maxTouchPoints` | Touch points |
| `hardwareConcurrency` | CPU cores |
| `cookieEnabled` | Cookies enabled |
| `doNotTrack` | DNT value |
| `online` | Network status |
| `connectionType` | Effective type |
| `viewportWidth`, `viewportHeight` | Window size |

---

## Identity Fields

| Field | Storage | Description |
|-------|---------|-------------|
| `persistent_id` | localStorage | Stable across visits (pid_*) |
| `visit_id` | session | Unique per page load (vid_*) |
| `first_visit_iso` | localStorage | First visit timestamp |
| `last_visit_iso` | localStorage | Most recent visit |
| `visit_count` | localStorage | Total visit count |
| `session_start_iso` | session | Current session start |

---

## Session Signature

Included only in `session.end`. Purely descriptive, no scoring.

```json
{
  "device": {
    "same_timezone": true,
    "same_language": true,
    "same_screen": true,
    "first_device": false,
    "storage_unavailable": false
  },
  "timing": {
    "window": "evening"
  },
  "entrance": {
    "steps_completed": 10,
    "total_failures": 0
  },
  "interaction": {
    "edit_ratio": 0.15,
    "active_artifacts_at_end": 0
  }
}
```

### Timing Windows

| Window | Hours |
|--------|-------|
| morning | 05:00-11:59 |
| afternoon | 12:00-16:59 |
| evening | 17:00-20:59 |
| night | 21:00-04:59 |

---

## Narrative Generation

The `narrative_summary` is generated client-side with template clauses:

1. **Duration**: "Completed in X seconds" or "Completed in Xm Ys"
2. **Typing**: "N characters typed with [no/minimal/moderate/heavy] editing (X%)"
3. **Paste**: "N paste operation(s)" (if any)
4. **Final text**: "Final text: N words, M characters"
5. **Status**: "Status: [status]"

Example:
```
Completed in 45 seconds. 127 characters typed with minimal editing (8%). Final text: 23 words, 127 characters. Status: submitted.
```

---

## Flags

| Flag | Meaning |
|------|---------|
| `artifact_switch_flush` | Raw buffer flushed due to artifact change |
| `offline_retry` | Event retried from offline queue |

# Guardian Telemetry Event Catalog

## Overview
This document catalogs all event types emitted by the Guardian telemetry system. Events are organized by section and purpose.

---

## Core Session Events

| event_type | Section | Description | Payload Fields |
|------------|---------|-------------|----------------|
| `session.start` | - | Emitted once when Guardian initializes | `visit_count`, `first_visit_iso`, `returning` |
| `session.end` | - | Emitted once on page unload or visibility hidden | `session_duration_ms`, `flush_reason`, `raw_buffers_flushed_count`, `events_sent_count`, `session_signature` |

### session.end Payload
- `session_duration_ms`: Total time from session start
- `flush_reason`: "page_unload" or "visibility_hidden"
- `raw_buffers_flushed_count`: Number of raw buffers with pending events at session end
- `events_sent_count`: Total events sent during session
- `session_signature`: Descriptive session summary object (see below)

---

## Raw Input Events

| event_type | Section | Description | Payload Fields |
|------------|---------|-------------|----------------|
| `raw.input.batch` | any | Batched per-character input capture | `field_id`, `artifact_start_iso`, `artifact_elapsed_ms_at_flush`, `events[]`, `aggregates`, `flush_reason` |

### Raw Batch Traceability
- `artifact_start_iso`: ISO timestamp of when the associated artifact started
- `artifact_elapsed_ms_at_flush`: Milliseconds since artifact start at time of flush (null if no active artifact)

### Raw Event Structure
Each event in the `events[]` array contains:
- `t`: milliseconds since session/artifact start
- `v`: full current value
- `len`: character count
- `cursor`: cursor position (when available)
- `inputType`: beforeinput type (insertText, deleteContentBackward, etc.)
- `delta`: character count change (+/-)
- `dt`: time since last keystroke in ms

### Aggregates
- `charsAdded`: total characters added since last flush
- `charsRemoved`: total characters deleted since last flush
- `pasteCount`: number of paste operations

---

## Entrance Flow Events

| event_type | Section | Description | Payload Fields |
|------------|---------|-------------|----------------|
| `entrance.step.enter` | entrance | User enters a step | `step_num`, `step_name` |
| `entrance.step.exit` | entrance | User completes a step | `step_num`, `step_name`, `duration_ms` |
| `entrance.verification.success` | entrance | User passes validation | `step_name`, `attempts` |
| `entrance.verification.failure` | entrance | User fails validation | `step_name`, `reason`, `attempt_num` |
| `entrance.shortcut.pearls_used` | entrance | User entered "pearls" to skip | - |
| `entrance.special_path` | entrance | User triggered beloved/rose path | `path` |
| `entrance.artifact` | entrance | Final entrance summary | See artifact fields below |

### Entrance Artifact Payload
- `kind`: "entrance_flow"
- `status`: "accepted" or "rejected"
- `duration_ms`: total entrance time
- `pearls_used`: boolean
- `steps_completed`: number
- `failure_counts`: object with step failure counts
- `casual_name`, `real_name`, `kept_bookmark`: user responses

### Step Names
0. greeting
1. casualName
2. helloMessage
3. gardenMessage
4. realName
5. bookmarkStatement
6. bookmarkQuestion
7. frontInscription
8. backInscription
9. welcomeJessica
10. revealGarden

---

## Menu Events

| event_type | Section | Description | Payload Fields |
|------------|---------|-------------|----------------|
| `menu.opened` | menu | Menu displayed | - |
| `menu.intent` | menu | User selected an option | `option`, `time_to_decision_ms`, `help_opened_count`, `total_help_dwell_ms` |
| `menu.help.opened` | menu | Help modal opened | `open_count` |
| `menu.help.closed` | menu | Help modal closed | `dwell_ms` |

---

## Whisper Events

| event_type | Section | Description | Payload Fields |
|------------|---------|-------------|----------------|
| `whisper.textarea.focus` | whisper | Textarea gained focus | - |
| `whisper.timing.changed` | whisper | Timing mode changed | `from`, `to` |
| `whisper.edit_mode.entered` | whisper | User entered edit mode | - |
| `whisper.submit` | whisper | Single whisper submitted | `length`, `is_edit` |
| `whisper.ring.filled` | whisper | Text ring reached capacity | `ring` (1, 2, or 3) |
| `whisper.confirmation.shown` | whisper | Send confirmation displayed | - |
| `whisper.confirmation.choice` | whisper | User responded to confirmation | `choice` |
| `whisper.artifact` | whisper | Final whisper summary | See artifact fields below |

### Whisper Artifact Payload
- `kind`: "whisper_attempt"
- `status`: "submitted" or "abandoned"
- `duration_ms`: total time in section
- `chars_typed`, `chars_deleted`, `paste_count`: input stats
- `final_text`: submitted or draft text
- `final_length`: character count
- `whisper_count`: number of whispers submitted
- `edit_mode_used`: boolean
- `timing_mode_changes`: number of timing changes
- `confirmation_shown`: boolean

---

## Poem Events

| event_type | Section | Description | Payload Fields |
|------------|---------|-------------|----------------|
| `poem.book.opened` | poem | Book transitioned from closed | - |
| `poem.textarea.focus` | poem | Textarea gained focus | - |
| `poem.page.overflow` | poem | Text overflowed to right page | - |
| `poem.swipe_confirm.shown` | poem | Swipe-to-send confirm displayed | - |
| `poem.swipe_confirm.choice` | poem | User responded to swipe confirm | `choice` ("yes", "no", "dismiss") |
| `poem.return_confirm.shown` | poem | Return confirmation displayed | - |
| `poem.return_confirm.choice` | poem | User responded to return confirm | `choice` ("yes", "no", "dismiss") |
| `poem.artifact` | poem | Final poem summary | See artifact fields below |

### Poem Artifact Payload
- `kind`: "poem_request"
- `status`: "submitted" or "abandoned"
- `duration_ms`: total time in section
- `chars_typed`, `chars_deleted`, `paste_count`: input stats
- `final_text`: submitted or draft text
- `final_length`: character count
- `overflow_occurred`: boolean
- `swipe_confirm_shown`: boolean
- `typing_tempo`: object with `fast`, `normal`, `slow` counts

---

## Interaction Semantic Events

| event_type | Section | Description | Payload Fields |
|------------|---------|-------------|----------------|
| `interaction.typing.feedback` | any | Typing caused visual feedback | `type` (bloom, firefly, erasure), `field` |
| `interaction.typing.paste` | any | Paste operation detected | `field_id`, `hasData` |
| `interaction.typing.copy` | any | Copy operation detected (no clipboard content) | `field_id`, `selection_length` |
| `interaction.cursor.move` | any | Cursor moved without input (250ms debounce) | `field_id`, `cursor_start`, `cursor_end` |
| `interaction.commit.absorb` | whisper | Ring absorption animation | `type` |
| `interaction.send.sequence_start` | any | Send animation began | `type` (inward_spiral, absorbing_pulse) |

---

## Field IDs for Raw Input Capture

| field_id | Section | Description |
|----------|---------|-------------|
| `entrance.casualName` | entrance | "What shall I call you?" input |
| `entrance.realName` | entrance | "Your name?" input |
| `entrance.finalName` | entrance | "What is your real name?" input |
| `entrance.frontInscription` | entrance | Front bookmark inscription |
| `entrance.backInscription` | entrance | Back bookmark inscription |
| `whisper.textarea` | whisper | Main whisper textarea |
| `poem.textarea` | poem | Poem request textarea |

---

## Google Forms Field Mapping

| Field | Entry ID |
|-------|----------|
| visit_id | entry.99657608 |
| persistent_id | entry.1252075505 |
| event_type | entry.1140106371 |
| section | entry.75256911 |
| artifact_id | entry.1509851328 |
| timestamp_iso | entry.794719559 |
| payload_json | entry.1925252025 |
| device_fingerprint_json | entry.1396868347 |
| flags | entry.1003393738 |

---

## Device Fingerprint Fields

The `device_fingerprint_json` contains:
- `userAgent`: browser user agent string
- `platform`: navigator.platform
- `language`: primary language
- `languages`: all accepted languages
- `timezone`: IANA timezone name
- `timezoneOffset`: UTC offset in minutes
- `screenWidth`, `screenHeight`: full screen dimensions
- `availWidth`, `availHeight`: available screen area
- `devicePixelRatio`: display scaling factor
- `colorDepth`: bits per color
- `touchSupport`: boolean
- `maxTouchPoints`: number
- `hardwareConcurrency`: CPU cores (if available)
- `cookieEnabled`: boolean
- `doNotTrack`: DNT header value
- `online`: navigator.onLine
- `connectionType`: network effective type (if available)
- `viewportWidth`, `viewportHeight`: window dimensions

---

## Identity & Session Fields

| Field | Storage | Description |
|-------|---------|-------------|
| `persistent_id` | localStorage | Stable across visits (pid_*) |
| `visit_id` | session | Unique per page load (vid_*) |
| `first_visit_iso` | localStorage | First visit timestamp |
| `last_visit_iso` | localStorage | Most recent visit |
| `visit_count` | localStorage | Total visit count |
| `session_start_iso` | session | Current session start |

---

## Session Signature (Descriptive Only)

The `session_signature` object is included only in `session.end` events. It provides a purely descriptive summary of the session with no scoring or verdicts.

### Structure

```json
{
  "device": {
    "same_timezone": true,
    "same_language": true,
    "same_screen": true,
    "first_device": false
  },
  "timing": {
    "window": "evening"
  },
  "entrance": {
    "pearls_used": false,
    "total_failures": 2
  },
  "interaction": {
    "edit_ratio": 0.15,
    "active_artifacts_at_end": 0
  }
}
```

### Device Fields
- `same_timezone`: Timezone matches previous visit
- `same_language`: Browser language matches previous visit
- `same_screen`: Screen dimensions match previous visit
- `first_device`: True if no previous fingerprint stored
- `storage_unavailable`: True if localStorage inaccessible

### Timing Fields
- `window`: Time-of-day bucket ("morning", "afternoon", "evening", "night")

### Entrance Fields
- `pearls_used`: Inferred from zero failures and early completion
- `total_failures`: Sum of all validation failures

### Interaction Fields
- `edit_ratio`: Ratio of deleted characters to typed characters (0-1)
- `active_artifacts_at_end`: Unclosed artifacts when session ended

---

## Flags Field Values

The `flags` field contains comma-separated status indicators:

| Flag | Meaning |
|------|---------|
| `artifact_switch_flush` | Raw buffer flushed due to artifact_id change |
| `offline_retry` | Event is being retried from offline queue |
| `abnormal_session_end` | Reserved for future anomaly detection |

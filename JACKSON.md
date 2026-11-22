# Jackson — Feature Notes

## Purpose

Jackson is the working feature document for planner buddy, accessibility/customization, and backup improvements. Changes should be made on the `feature/backup-and-restore` branch before Jackson is merged into `main`.

## Planner buddy

- The character's default name is **Zippy**; users can rename it.
- The user can choose among a few character designs and colors.
- Zippy may celebrate completed assignments, send reminder speech, and become interactive.
- Zippy should include emojis, animations, and dancing according to the selected cheer level.
- Zippy must have a black outline and a character color different from the selected background color so it remains visible.

### Cheer level

- **0:** Plain text only. No emoji, dance, or extra animation.
- **1–2:** Mildly encouraging text with limited emoji and small motion.
- **3–5:** Fuller encouragement, emojis, dances, and high-energy reactions.
- Levels **3–5** allow a high-five interaction after major accomplishments.

Examples:

- Level 0: `Math assignment due in 5 days.`
- Level 5: `Math assignment is due in 5 days! You have plenty of time—tiny steps count ✨`

## Reminder appearance

- Regular reminder: Zippy appears with a **50% randomized chance**.
- The decision should be made once for each assignment for each day, not every time the site is opened or refreshed.
- An assignment due in **1 day** always shows Zippy.
- For assignments due in 1 day, Zippy uses urgent but encouraging text.

Examples:

- Level 0: `Math assignment due tomorrow. Finish it today.`
- Level 3: `Math is due tomorrow! Let's tackle it today—you've got this 💪`
- Level 5: `🚨 Math is due TOMORROW! One focused step at a time—you can crush this 💪✨`

## Completion celebrations

- When one assignment is completed, Zippy gives a brief congratulatory reaction based on the cheer level.
- If five assignments are completed in one calendar day, Zippy provides a special celebration.
- At cheer levels 3–5, the special celebration includes an interactive high-five: the character holds out a hand and the player taps/clicks the character or screen to complete it.
- Zippy's completion count resets at local midnight.

## Randomness and reduced motion

- Zippy's 50% random appearance should use a stable per-day/per-assignment result.
- Reopening or refreshing the app should not reroll that day's result.
- Respect the browser's reduced-motion setting.
- When reduced motion is enabled, replace dances and movement with static or fade/scale reactions.

## Email and reminder integration

- Zippy's chosen name and cheer level are included in notification content where appropriate.
- Zippy's randomized on-site appearance rules do not need to change plain email delivery.
- Emails use text and emoji supported by the app.
- Interactive animations cannot exist inside an email; the email should link back to the planner.
- Email copy should preserve urgency for assignments due tomorrow without adding unnecessary pressure.

## Customize

All interface personalization controls should be grouped under a clearly labeled **Customize** header in Settings.

### Font and readability

- Offer five font options: **Atkinson Hyperlegible**, **OpenDyslexic**, **Lexend**, **Andika**, and **Comic Neue**.
- Include a preview/sample for each option.
- Render each font's title/name in that font itself.
- Apply the selected font consistently to planner text and controls, while keeping readable fallbacks if a font cannot load.

### Background

- Keep every existing gradient/wallpaper color option; do not replace or remove them.
- Provide two background tabs: **Solid colors** and the existing gradient/color style options.
- Add 20 distinct solid background color choices.

### Text and bubbles

- Add a 10-step text-size slider: setting 1 is smallest, 5 is normal, and 10 is largest.
- Allow bold text to be toggled.
- Allow text color selection using the same palette options as backgrounds.
- The text color must differ from both the background color and the bubble color.
- Bubble color can match or differ from the background, but must differ from the text color.
- Bubble dimensions and layout must adapt to the selected text size so content remains legible and does not clip.

### Character appearance

- Allow customization of Zippy's color.
- Prevent selecting the same character and background color; maintain the black outline for contrast.

## Backup and restore

- Add an Export Data button and Import Data button in Settings.
- Export should save assignments, classes, settings, and backup format/version information.
- Never export GitHub sync passwords or tokens.
- First use should show a backup notice before the main site is available.

### Merge import

- Preserve all existing browser data.
- Assignments and classes are matched by stable IDs.
- Existing records are not overwritten.
- Missing records are imported with their saved status.
- Show an import preview before applying changes.

### Overwrite and undo

- Overwrite requires explicit confirmation.
- Save the complete previous state before overwriting.
- Provide Undo Overwrite in Settings.
- Undo restores the complete state saved immediately before overwrite.
- Invalid or damaged backup files make no changes.

## Data safety requirements

- Backups remain local download files unless the user separately configures an account or cloud sync.
- Browser storage is not an automatic cloud backup.
- A GitHub sync token must never appear in exported planner data.
- Existing public GitHub assignments data must not be used as a private cloud account for all users.

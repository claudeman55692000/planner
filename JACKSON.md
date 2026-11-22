# Jackson — Feature Notes

## Purpose

Jackson is the working feature document for planner buddy, accessibility/customization, assignment reminders, and backup improvements. Changes should be made on the `feature/backup-and-restore` branch before Jackson is merged into `main`.

## Planner buddy

- The character's default name is **Zippy**; users can rename it.
- Users can choose among character designs and colors.
- Zippy may celebrate completed assignments, send reminder speech, and become interactive.
- Zippy's emojis, animations, and dancing follow the selected cheer level.
- Zippy must have a black outline and a color different from the selected background so it remains visible.

### Cheer level

- **0:** Plain text only; no emoji, dance, or extra animation.
- **1–2:** Mildly encouraging text with limited emoji and small motion.
- **3–5:** Fuller encouragement, emojis, dances, and high-energy reactions.
- Levels **3–5** allow a high-five interaction after major accomplishments.

Examples:

- Level 0: `Math assignment due in 5 days.`
- Level 5: `Math assignment is due in 5 days! You have plenty of time—tiny steps count ✨`

## Reminder appearance

- For ordinary reminders, Zippy appears with a **50% randomized chance**. Make the decision once per assignment per day, not on every page open or refresh.
- An assignment due in **1 day** always shows Zippy, with urgent but encouraging text.
- Example: `🚨 Math is due TOMORROW! One focused step at a time—you can crush this 💪✨`

## Completion celebrations

- Completing one assignment triggers a brief congratulatory reaction based on cheer level.
- Completing five assignments in one local calendar day triggers a special celebration.
- At cheer levels 3–5, the special celebration includes an interactive high-five.
- The daily completion count resets at local midnight.

## Randomness and reduced motion

- Keep the 50% appearance decision stable per assignment and local day; reopening or refreshing must not reroll it.
- Respect the browser's reduced-motion setting. Replace dances and movement with static or subtle fade/scale reactions when enabled.

## Assignment reminder schedules

- Reminder frequency and timing are configurable for each assignment when creating or editing it.
- Remove **“N/A: remind me daily”** and replace it with **“Custom time.”**
- **Use default** uses the applicable default schedule and then allows the user to choose a specific reminder time for that assignment.
- A specific time is chosen in the user's local device time zone, with hour and minute in **10-minute increments** and an **AM/PM** selector; honor the phone or computer's local clock and time zone.
- **Custom time** opens a calendar to choose the dates on which that assignment should trigger reminders.
- After the final selected custom reminder date, offer:
  1. **After the final day, remind me each day.**
  2. **After the final day, remind me on a default schedule.**
  3. **After the final day, don't remind me anymore on this assignment.**
- Require exactly one follow-up choice to continue. Only one can be checked at a time. The selected choice can be unchecked so the user can choose another; do not allow continuing until one is selected.
- Below both the default and custom schedule choices, show **“Don't remind me on this assignment”** in red text. Selecting it opens a confirmation warning such as **“Is this what you want? You won't get reminders on this assignment.”** Disable reminders only after confirmation; cancel returns to schedule selection.
- Save each reminder schedule on its assignment, independently, and include it in export/import.

### Assignment-type defaults

- Add **Exam** as an assignment type.
- **Exam:** start reminders 14 days before the due date and remind every 2 days.
- **Test:** start 7 days before; remind every 2 days, and remind on each of the final 2 days.
- **Quiz:** start 5 days before; use the test cadence (every 2 days, plus each of the final 2 days).
- **Homework:** start 2 days before and remind on both days (2 days before and 1 day before the due date).
- **Special project:** start 10 days before and remind every 2 days.
- These are defaults; per-assignment reminder settings can customize or disable them.

## Assignment urgency indicator and editing

- Show every assignment a vertical progress bar, initially full/green. As the due date approaches, reduce its fill according to the proportion of time remaining and shift its hue gradually from green toward dark orange.
- At the warning threshold, transition from orange to blood red: **Exams: 6 days remaining; Tests: 3 days; Quizzes: 2 days; Homework: 1 day.** A special-project red-warning threshold has not yet been specified.
- Show days remaining as a large number beside the bar and use the same color as the bar. Cap the numeric display at 31 days; when more than 31 days remain, display **“1+ month.”**
- Add a pencil icon near the top of the home screen that opens assignment editing, including name, due date, reminder time/schedule, and whether to use defaults or custom settings.

## Class categories and reminder wording

- Provide three class categories: **Academic**, **Other...**, and **Extracurriculars**.
- **Other...** is for classes or activities that are neither academic nor extracurricular.
- Rename the non-academic category/example previously represented by examples such as chess and sports to **Extracurriculars**, and place it at the bottom of the category list.
- For reminders about **Other...** items, include the class name and assignment name.
- For extracurricular reminders, identify the item as an extracurricular and include the class name and assignment name.

## Customize

Group all interface personalization controls under a clearly labeled **Customize** header.

### Font and readability

- Offer five font options: **Atkinson Hyperlegible**, **OpenDyslexic**, **Lexend**, **Andika**, and **Comic Neue**.
- Include a preview for each and render each font's title in that font itself.
- Apply the selected font consistently to planner text and controls, with readable fallbacks if a font cannot load.

### Background

- Preserve all existing gradient/wallpaper color options.
- Provide two background tabs: **Solid colors** and the existing gradient/color style options.
- Add 20 distinct solid background color choices.

### Text and bubbles

- Add a 10-step text-size slider: setting 1 is smallest, 5 is normal, and 10 is largest.
- Allow bold text and text-color selection using the same palette options as backgrounds.
- Text color must differ from both background and bubble colors.
- Bubble color may match or differ from the background, but must differ from text color.
- Bubble dimensions and layout must adapt to text size so content remains legible and does not clip.

### Character appearance

- Allow Zippy's color to be customized.
- Prevent selecting the same character and background color; retain the black outline for contrast.

## Backup and restore

- Add **Export Data** and **Import Data** buttons in Settings.
- Export assignments, classes, settings, and backup format/version information. Never export GitHub sync passwords or tokens.
- Show a backup notice before the main site is available on first use.

### Merge import

- Preserve existing browser data.
- Match assignments and classes by stable IDs; do not overwrite existing records.
- Import missing records with their saved status and show a preview before applying.

### Overwrite and undo

- Require explicit confirmation for overwrite and save the complete previous state first.
- Provide **Undo Overwrite** in Settings to restore the complete state saved immediately before overwriting.
- Invalid or damaged backup files must make no changes.

## Data safety

- Backups remain local download files unless the user separately configures an account or cloud sync; browser storage is not an automatic cloud backup.
- Never include a GitHub sync token in exported planner data.
- Do not use existing public GitHub assignments data as a private cloud account for all users.

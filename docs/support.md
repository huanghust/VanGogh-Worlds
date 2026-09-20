# Support reports and publishing known issues

Settings (gear) → Support contains Known Issues, Changes, and a private Report an issue form.
The public API returns reviewed issue summaries only. Reporting uses POST; it
never puts a report's text in a URL. Empty/repeated keyboard-mash submissions
are rejected, and requests are rate-limited. Exact duplicates share a reference.
These checks are a spam filter, not proof that a bug exists. No AI service or
automatic claim of bug verification is built in.

## Where reports live

The single-process server writes atomically to `SUPPORT_DATA_DIR/support.json`.
The default is `.data/support/support.json` under the server working directory.
It survives process restarts and is ignored by Git, outside the public assets.
For a published container, **set SUPPORT_DATA_DIR to a persistent mounted folder**
(e.g. `/data/support` on a host with a persistent `/data` volume). A default
container filesystem may be erased by redeployment. The review command and web
server share an exclusive write lock. Use a shared database before scaling out
to multiple replicas or hosts.
An unreadable or corrupt store fails closed instead of silently discarding data.
If a process is forcibly killed during a write, an empty `.write-lock` directory
may remain. Stop writers and remove that empty directory before restarting;
blocked requests return an error rather than claiming their reports were saved.

## Reviewing a new report

Run these commands on the server (or against its persistent support directory):

1. `npm run support:review -- list`
2. Read the pending report. Reject nonsense/spam. Compare it with existing issues;
   wording alone is not enough to decide whether two reports are the same bug.
3. Reproduce the reported behavior and confirm it is a bug. If it cannot yet be
   verified, leave it pending. Do not publish raw player text or personal details.
4. For a genuinely new confirmed issue, write an approval JSON file containing:
   - `reportId`: the report UUID.
   - `verification`: an internal note of the device/browser, reproduction steps,
     expected result and observed result (at least 20 characters).
   - `title` and `body`: objects with nonempty `en`, `zhCN`, `zhTW`, `ja`, `es`,
     `fr`, `de`, and `nl` translations of the edited public summary.
5. `npm run support:review -- approve /path/to/reviewed-issue.json --confirmed`
   This adds the issue to the public list and marks the source report published.

Other commands:

- `npm run support:review -- duplicate REPORT_ID ISSUE_ID`
- `npm run support:review -- reject REPORT_ID`
- `npm run support:review -- resolve ISSUE_ID`

There is no public approval endpoint. Review requires server access. The browser
shows honest pending status after submission; it does not promise instant public
listing or an automatic reviewer. To review with Codex later, ask it to inspect
this inbox, reproduce the reports, and use the commands above for confirmed ones.
No scheduled background review has been configured.

## Release articles

The newest-first `changeArticles` list is in `src/supportArticles.ts`. Article
text is localized in `src/releaseCopy.ts` and `src/supportCopy.ts`. Each article
has an introduction, section heading, topic subsections, paragraphs, and bullets.
The Changes list and article header use the same `releaseTitle` formatter.

Versions follow `Type N.R—Release date`, for example
`Patch 1.1—Sep 20th, 2026`. An Update starts at N.0. Patches and hotfixes share
one increasing revision counter within that update (Patch 1.1, Hotfix 1.2),
resetting when the next Update starts at 2.0. Dates and type labels are localized;
English uses abbreviated months and ordinal days. Keep the actual release date
in the data, not the visitor's current date. The initial notes are Update 1.0,
followed by Patch 1.1 for the menu, audio controls, and article refinements.
Only add notes for completed changes. Do not publish an example hotfix as history.

Known Issues opens reviewed articles with their status. Back and Escape return
to the previous list and restore its scroll and focus.

Article structure reference (use this site's own content and version numbers):
https://thatgamecompany.helpshift.com/hc/en/17-sky-children-of-the-light/faq/1469-update-34-5---august-25th-2026/

Sound settings reference: Sky offers independent audio categories. This site
uses Overall volume, Music, Nature sounds, and Sound effects for its own audio.
The category buses sit after scene fades and before the overall volume/limiter;
preferences persist locally in `wheatfield-audio-mix`. Existing overall mute
preferences in `wheatfield-muted` are preserved.
https://thatgamecompany.helpshift.com/hc/en/17-sky-children-of-the-light/faq/523-how-do-i-access-the-utility-settings-menu-how-do-i-change-my-game-settings/

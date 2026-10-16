# Nova Frames — Production workspace

Primary administrator: **novaframes02@gmail.com**.

## Login and access
The portal uses its own email/password login as requested. Administrators create worker accounts in Team, choose one or more roles, and set the worker's initial password. Passwords are salted PBKDF2 hashes. Sessions use random tokens in HttpOnly, SameSite=Strict cookies, with Secure cookies on hosted domains. Wrong-password attempts are rate limited; sessions expire after 24 hours. Worker password resets, role/access changes, disabling, and removal invalidate their sessions.

The initial administrator password hash is configured with the secret runtime variable `NOVA_ADMIN_PASSWORD_HASH`. No administrator password or hash is embedded in application source. Keep local `.dev.vars` and `.sites-runtime` private. After deployment, the login page may be public; brand and job APIs require a portal session and enforce roles server-side.

## Administration
- Brands: add, edit and remove brand profiles; store contacts, category, Instagram profile and brand brief. There is no fixed brand-count limit in the app.
- Videos: create a video inside a brand, add a brief, shoot date, deadline and priority.
- Allocations: independently assign content creator, cameraman, editor and publisher.
- Team: add, edit, disable, remove or reset a worker's password.
- Client review: record approval or revision feedback. Revisions return to the same assigned editor.

Removing a brand preserves its name and existing video history. Removing a worker revokes login immediately and retains existing videos for reallocation.

## Role pages and workflow
1. **Content**: the content creator only sees assigned Content tasks. Submit the content/script Drive link to move to Shoot.
2. **Shoots**: the cameraman sees assigned shoot tasks and the content link. Confirm Shoot completed, Uploaded to Drive, and submit the footage Drive link. Updated in system is an optional checkbox. There is no system-copy workflow stage or requirement.
3. **Editing**: the editor sees allocated videos, content/footage Drive links, brief and client feedback. Submit the completed, ready-to-post video Drive link and confirm Editing completed to send it for Client approval.
4. **Client approval**: any signed-in staff member records the client's decision. Changes requested requires feedback, sends the video back to Editing and keeps the same editor. Approved sends it to Ready to post.
5. **Ready to post**: publishers and administrators see the pending videos by brand with their final Drive links. Publishing is manual; mark the video Posted after publishing it.
6. **Posted**: paste the live Instagram link and mark the video Completed.

Submitting a replacement edited video resets approval and clears an old Instagram link. The portal stores links; it does not upload footage to Drive, copy files to a computer, or post automatically to Instagram. Client decisions may be recorded by any signed-in staff member after communicating with the client.

## Development and deployment

Production uses Next.js on Vercel and Neon Postgres. Connect the provisioned Neon database to the Vercel project so DATABASE_URL is injected. Configure NOVA_ADMIN_PASSWORD_HASH as a Vercel Secret; never commit its value. Run the migration in drizzle/postgres/ on a new Postgres database, then run npm ci and npm run build. Vercel uses the Next.js preset, npm run build and .next output. Use npm run dev for local Next.js development with a separate development database. Original Cloudflare migrations and starter files remain for historical reference and are excluded from TypeScript compilation; they are not the production backend.


## Managers, attendance and monthly Excel reports
Managers can read existing video jobs and allocate all four production roles. They cannot add, change or remove people, brands or branches, or download reports. Managers can create videos and allocate work. Anyone can mark client approval. A manager may receive posting work and may also hold additional production roles. Only the administrator manages people (including manager accounts). Managers also have their own attendance page.

Team profiles have a joining date and branch. Removed accounts are archived and disabled to preserve work and attendance history. Admin can create branch records and associate brands, videos and people with a branch.

Attendance uses Asia/Kolkata calendar dates. Each worker and manager explicitly checks in, can take a permission break with a reason, resumes, and ends the day. Permission breaks do not count toward the eight-hour daily target. Ending early requires a reason. A past working day without attendance is Leave; Sunday is Holiday with zero required hours; today remains Not marked until check-in or the day ends. Dates before joining or after removal are excluded from monthly leave calculations. Sundays are holidays; the eight-hour attendance target applies Monday through Saturday. Admin attendance corrections require an audit reason. Active shifts must be ended before sign-out. Login sessions now last up to 24 hours, separately from the eight-hour attendance target.

Reports is administrator-only. Select any current or past month and download a real .xlsx workbook with Overview, Worker summary, Work detail, Brand summary, Branch summary, Video register, Attendance, Attendance summary and a work-detail tab for each branch. Completed work is recorded with the actual person, time, role, video, brand, branch and link. Re-edit submissions are counted as separate edit submissions. Reports remain available after worker removal. Current-month reports include data so far. This implements the requested download alternative; automatic Drive upload and unattended monthly scheduling are not configured.

Local preview: http://127.0.0.1:4173/ . The source, built app and local D1 data are retained in this workspace. Preview uses the private local administrator password hash; it is excluded from exports. The server is intentionally left running for the user's requested localhost check.

## Flexible work allocation and switches
- Brands and Team have administrator-controlled On/Off switches. Off brands keep their history and completion totals but pause new allocations and production/extra-task updates. Off people cannot log in; their sessions are revoked and running attendance is paused. Enable the account to allow sign-in again, then resume attendance.
- Brand cards and profiles show completed/total video counts, posted counts (including completed videos), a progress bar and pending completion counts.
- Multiple role checkboxes are available in Team. Production allocations require the relevant role; posting can go to any active worker or manager. Every signed-in staff member can record client approval or request changes.
- Work allocation is a separate page for administrator and managers. Select a listed person, choose a video and production step, and save the allocation.
- Extra tasks supports typing, research, administration, design and other work. Administrator/managers assign tasks to people; assignees update progress and submit typed output, notes or Drive links. Only the assignee can complete the task. Completed extra tasks appear in monthly Excel reports.
- Sunday is always Holiday, has no attendance target, and is excluded from Leave and required-hour totals. The attendance export includes Sunday rows for clarity.

## Cameraman-created videos
Accounts with the Cameraman role see New video and My videos. They can create a video under an active existing brand, with title, format, brief, shoot date and deadline. New videos start at Content and automatically assign their creator to the camera shoot. The administrator or manager allocates content, editing and posting. Cameraman creation does not grant administrator access to existing video settings, brand management or other worker allocations. Creation is audited with creator identity. The source package can be added to your own GitHub repository; it excludes passwords and local database/runtime state.

## Overview and creation permissions
Overview is the default landing page and is visible to every authenticated account. Its aggregate studio totals are shared across roles; video/task details retain their existing access rules. Only manager and cameraman accounts may create new videos, including workers with either role among multiple roles. The administrator may manage existing video settings and allocations, but cannot create new videos under this rule. Managers may choose initial allocations when creating a video; cameramen are automatically assigned to its shoot. All new videos begin at Content.

Manager navigation: Overview, Projects, Work allocation, Extra tasks, every production stage through Completed, and Attendance. Managers see all videos by stage; Brands, Team, Branches and Reports remain administrator-only. Production submissions require the assigned worker role; managers can inspect links and allocate work.

## Project stage controls

Admins, managers and cameramen can create videos. New videos can start at Content, Shoot, Video editing or Post. Admins and managers can manually change any video’s production stage; a cameraman can change a video they created or are assigned to shoot. Open the video, choose Current stage, and click Save current stage. Manual stage changes are audited and do not fabricate Drive submissions, shoot completion or client approval. Existing client-review, posting and completion actions remain available. Only administrators manage worker roles and accounts.

## Mobile navigation and opening page

On phone and tablet widths up to 800px, the top-left menu opens a vertical drawer listing all pages available to the account. Its page list scrolls independently, closes after navigation, supports Escape and keyboard focus, and restores page scrolling. Long forms scroll inside their drawers; wide attendance and project tables scroll horizontally. Workers and managers open on Attendance after login or a fresh page load; administrators open on Overview. Refreshing data while using another page does not force a return to Attendance.

## Stage-specific allocation and manager attendance

Managers can view daily attendance for all workers and managers, while keeping their own check-in, permission-break, resume and end-day controls. Only administrators may correct attendance. Workers can read only their own attendance. Work allocation filters videos by the selected work type: Content, Shoot, Editing or Ready to post. Changing the type clears the video selection. Project allocation shows only its current production role, and updates preserve every other assignment. The server rejects stale work-type submissions and changes to other steps.


## Confirming task reassignment

When a video production step or extra task is already assigned to another person, saving a new assignee opens a warning naming the current and selected people. Cancel leaves the saved assignment unchanged. Assign to another person replaces the current assignee; each task step has exactly one assignee. First assignments and saving the same assignee do not show this warning. The server checks the current assignment and record version before replacement and rejects stale confirmations.


## Content batches and shoot-to-editing tasks

Content creation uses a brand, content date and content count; the creator submits one Google Drive link for the batch. Video/task titles are generated from the brand and date for new content batches. Shoot submission takes the content count, a separate name and footage Drive link for every item, plus shoot completion/Drive confirmations. The original record becomes the first editing video, and each remaining item becomes its own editing video. All items retain their brand, content link, shoot attribution and batch reference. New items await their own editor allocation; later approvals and posting remain per video.

For cameramen without manager permission, My videos → New video shows brand, shoot date and locked Video editing stage. Next opens the Shoot form, and Create videos saves the batch as individual editing tasks. Other roles cannot use this camera-only endpoint, and cameramen cannot bypass it to create empty editing records. Admins and managers retain their normal creation and stage controls. Batch writes and audit events are saved atomically; duplicate/stale submissions cannot create extra tasks. Counts are 1–500 per batch. Monthly content totals use the submitted content count, and work details include the content date/count.


## Permission and leave requests

Requests is available to workers, managers and the administrator. Workers and managers submit permission requests with a date, time window (IST) and reason, or leave requests with a date range and reason. They can view their own request history and cancel pending requests. Managers review worker requests. Requests made by managers (including people with multiple roles) require administrator approval; managers cannot review their own or other managers’ requests. The administrator can review all requests. Rejection requires a reviewer note, and decisions retain reviewer identity/time.

Approved leave marks the requested non-Sunday dates as Approved leave in attendance, with zero required hours and no fabricated worked time. Existing attendance events are retained. An active shift must be ended before approving full-day leave for today. Administrator corrections are protected from being overwritten. Approval and attendance updates are atomic and check record versions. Permission approvals record authorization; actual break/resume times continue to be logged in Attendance. Sundays remain holidays. The staff_requests table is initialized idempotently on first authenticated request; the matching SQL migration is included under drizzle/postgres.


## Overview brands, editing links, independent edits and expenses

Overview includes a Brands selector. Active videos, client review, ready-to-post and completed totals, pipeline counts, and the visible task list follow the selected brand. Shared summary counts include every studio video while task details keep their role permissions.

Administrators and managers can enter a Source footage / editing Drive link when creating a video at Video editing. The link is required when an editor is selected; it is retained as the source footage link visible to that editor. Manager creation does not accept final edited links or bypass client approval.

Editors can use Editing → Add unassigned task to choose an active brand and submit a completed video Drive link, with optional video name and notes. The video is credited to that editor and starts at Client approval. Revision requests return to the same editor. Approval, ready-to-post allocation, posting and Instagram completion use the normal workflow. Retries cannot create duplicate videos.

Expenses is available to every account. Workers record their own expenses; managers and administrators can select employees and record on their behalf. Each entry contains the date, INR amount, purpose, receiving active manager, proof-submitted checkbox, proof details and optional Drive proof link. Workers see their own records, managers see their own records plus receipts routed to them, and the administrator sees company totals. Entries retain the employee, manager and recorder identities. Money is stored as integer paise. The monthly workbook includes a total in Overview, an Expenses detail sheet and an Expense summary by employee. Expense dates determine their report month. The expenses table is initialized idempotently on first use, with matching SQL migration included.


## Allocation queue, management filters and administrator audit

Work allocation lists only unassigned videos at the selected work type and priority. Saving an allocation removes that video from this queue. Existing assigned videos remain in Projects and their stage pages, where the existing Cancel / Assign to another person warning handles reassignment. Status, current allocation (unassigned, assigned, or a named person) and priority filters are available to administrators and managers across video lists. The posting, posted and completed lists retain a priority column alongside their video links. Workers do not see the management filters.

Only the administrator can manually move an existing video to any of the seven workflow stages, including Completed. Use the project's Current stage control and Save current stage. The override retains existing assets, allocations and client decisions and records an audit entry. It does not invent a worker submission, Instagram link or client approval. Managers and cameramen can still create videos through their permitted creation flows; they cannot manually move existing tasks to another stage. Production submission, client review and posting actions continue normally.

Attendance shows administrators exact check-in, latest break, latest resume and end-day times in IST. View times opens the full chronological attendance and portal access timeline for the selected person/date. Successful worker/manager portal sign-ins and explicit sign-outs are recorded separately from worked hours from this update onward; historical portal sign-ins cannot be reconstructed. Closing a tab or session expiry is not treated as an observed sign-out. Managers retain team status, hours and reasons; event timestamps are omitted from non-admin attendance API responses, including their own responses. Workers retain their own attendance controls and summary. The access_events table is initialized idempotently on first use; the corresponding SQL migration is included under drizzle/postgres.


## Hidden switched-off records

Switched-off brands and their videos/extra tasks are excluded from normal workspace responses, Overview totals, brand selectors, allocation queues and production lists for every role. Switched-off workers are excluded from normal Team/worker selectors, attendance, request lists and expense records. Extra tasks assigned to them are hidden. Assigned video steps retain the saved worker ID but display an unavailable-worker label until the account is enabled or reassigned. Current-state monthly reports omit switched-off brands and workers, and their associated activity/expense entries; their historical data remains stored and reappears when enabled.

Only the administrator can open Brands → Manage switched-off brands or Team → Manage switched-off workers to restore an account/brand. The recovery records are not sent to other roles. Disabling an account continues to revoke its sessions. Workspace data refreshes every 30 seconds while the page is visible and when the window regains focus; hidden task dialogs close on the next refresh. Turning off a brand also prevents manual project-stage overrides until it is enabled. No history is deleted by these switches.


## Personal notification bell

Every signed-in account has a bell at the top right, including mobile. Workers receive in-app alerts for their current production assignments, stage-ready/re-edit work and allocated extra tasks. Managers receive permission/leave requests from workers they may review; only the administrator receives manager requests. The administrator can also see worker requests. Requesters see approved/rejected decisions on their own requests. Alerts follow existing role, ownership and switched-off-record rules. Opening an alert opens the relevant task or page.

The red dot means there are unread alerts. Opening the notification list marks only the displayed item IDs as viewed. Read receipts are stored separately for each account and persist across refresh, sign-out and devices. New assignments/reassignments, re-edit returns and later request decisions have new notification IDs and become unread. Opening one account's list does not mark another account's alerts viewed. Notifications refresh every 15 seconds while the page is visible and when the window regains focus. Existing actionable assignments/pending requests appear on first use. Notifications are in-app; no email, browser push permission or background delivery is configured. The notification_reads table initializes idempotently, with the corresponding SQL migration in drizzle/postgres.

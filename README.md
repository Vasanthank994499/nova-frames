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
This app uses the Sites Vinext starter, Cloudflare Workers and D1. Preserve .openai/hosting.json's project ID. Use the Sites plugin's install-dependencies.mjs and build-site.mjs helpers. Drizzle migrations are in drizzle/; apply pending migrations to local D1 before preview. Hosted deployments apply migrations through Sites.

For local built preview, scripts/preview-config.mjs reads the ignored .dev.vars administrator hash and generates an ignored .sites-runtime/preview.json. Run Wrangler dev with that config and .wrangler/state. The generated preview config is never included in deployments.

scripts/verify-workflow.mjs exports verify(credentials, localhostOrigin). It tests password login, worker role isolation, four allocations, brands, Drive-only shoot, same-editor revisions, approval, posting/completion, reset/removal, invalid sessions and login throttling using disposable local data. Never run it against a production URL.

## Managers, attendance and monthly Excel reports
Managers can read existing video jobs and allocate all four production roles. They cannot add, change or remove people, brands, branches or videos, or download reports. Anyone can mark client approval. A manager may receive posting work and may also hold additional production roles. Only the administrator manages people (including manager accounts). Managers also have their own attendance page.

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

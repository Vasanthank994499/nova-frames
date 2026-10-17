# Nova Frames device notifications

Open the bell and choose **Enable phone notifications**, then allow the browser prompt. Each worker, manager or administrator enrolls each device separately. After enrollment, the entire setup section hides automatically, leaving the notification inbox. Device notification preferences can be managed in browser/OS settings. On iPhone/iPad, add the site to the Home Screen first and enable notifications from the installed web app (iOS/iPadOS 16.4+).

The notification-only service worker handles encrypted Web Push messages while the portal is closed. It does not cache private pages or API data. Tapping an alert opens its work page; the server still enforces the signed-in account's existing permissions.

Successful workspace and request mutations use Next.js `after()` to dispatch new actionable inbox items to subscribed devices. This covers current-stage assignments (including every shoot crew member), extra tasks, pending leave/permission requests to eligible reviewers, and approval/rejection decisions to the requester. Read inbox items and pre-enrollment items are not replayed. Delivery receipts claim each device/item atomically. Temporary provider errors receive two immediate retries; undelivered items can retry on subsequent workspace/request mutations. Expired provider subscriptions are removed.

VAPID keys are generated once and persisted in the server-only `push_config` PostgreSQL table. The private key never reaches the browser. `push_devices` contains provider subscriptions and `push_deliveries` contains delivery receipts; these tables initialize idempotently using the existing database connection. Preserve `push_config` across deployments. No paid messaging service or additional environment variable is required.

The protected notifications API validates provider endpoints and encryption keys, enforces same-origin writes and keeps subscription ownership per account. Disabling/removing a worker stops their delivery. Explicit sign-out disables alerts on that browser. Signing in to a shared browser clears its previous account enrollment; the new account must opt in. Notification permission remains a browser/OS setting.

Phone delivery depends on notification permission, network access, platform support, and Focus/battery restrictions. A successful push-provider response confirms acceptance, not a guarantee that the OS displayed it. Permission cannot be granted remotely by an administrator. iOS support: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

Checks: `npx tsx scripts/verify-push.ts`, existing shoot/unassigned work checks, and `npm run build`. The push test prepares an actual encrypted VAPID request without sending any notification or changing production work data.

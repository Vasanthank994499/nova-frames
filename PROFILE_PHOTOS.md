# Worker profile photos

Workers and managers change their own photo in **Settings → Profile photo**. Administrators open **Team → Change profile photo** on a worker's card. Choose a JPG, PNG or WebP image, review the square preview, and press **Save photo**. Photo changes do not modify passwords, attendance, roles or sessions. Create a worker account first before adding their photo.

Photos appear in the worker's sidebar account, administrator Team cards, and the work allocation worker list. The workspace refreshes photo version tokens so changes propagate to other signed-in sessions. Initials remain when no photo exists or an image cannot be loaded.

Uploads are compressed in the browser, then decoded and re-encoded as a 256×256 JPEG on the server. Server validation rejects unsupported/corrupt images, files over 2 MB, excessive decoded pixels, and animated inputs. Re-encoding removes embedded EXIF/location metadata. The original upload is never stored or served.

`worker_profile_photos` is initialized idempotently in the existing PostgreSQL database, with a single small image per worker plus a version and update attribution. There is no public bucket or external storage setup. Photo reads and writes go through the authenticated `/api/auth?photo=<worker-id>` route; reads use private/no-store caching. Workers can update only themselves. Managers can view active workers' photos but cannot change another worker's photo. Only administrators can edit other people's photos, including inactive accounts. Removed workers' photos are not served.

Checks: `npx tsx scripts/verify-profile-photos.ts` and `npm run build`.

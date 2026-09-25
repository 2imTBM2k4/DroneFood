# Backend uploads: current tracked state

This note records only behavior and files observed in the repository. It does not assign ownership, retention status, or production usage to any image.

## Tracked files

The Phase 0 manifest recorded **60 Git-tracked entries** under the former `backend/uploads`: 41 directly under the former `backend/uploads` and 19 under the former `backend/uploads/restaurants`. One of the 60 entries was `backend/uploads/.DS_Store`; repository hygiene removed that operating-system metadata file, leaving **59 tracked image files**.

On 2026-09-25, Phase 4 completed a path-preserving **worktree** relocation of
those 59 image files from `backend/uploads/**` to `apps/api/uploads/**`. The
non-Customer structural relocation entries, including these image renames, are
staged; the Customer Mobile worktree is handled separately in the Phase 4
handoff. No image bytes were changed and no image file was deleted as part of
this relocation. The former path is historical only.

The path, byte size, and SHA-256 recorded for every baseline entry are in [`../plans/backend-uploads-manifest.md`](../plans/backend-uploads-manifest.md).

## Runtime paths

`apps/api/app.js` mounts `express.static("uploads")` at `/images`. This is a current-working-directory-relative path. When the API starts with `apps/api` as its working directory, an `/images/...` request reads from `apps/api/uploads/...`.

`apps/api/config/multer.js` also uses current-working-directory-relative destinations. It writes uploaded files to `uploads/restaurants`, `uploads/foods`, or `uploads/avatars`, selected from the request URL, and creates a destination directory when it is missing.

## Cloudinary flows

The food, restaurant, and user services upload Multer's temporary `file.path` to Cloudinary. Those services also contain Cloudinary deletion flows for replaced or removed hosted images. Separately, `apps/api/migrate-images.js` looks for database image paths beginning with `/images/`, resolves corresponding local files below the cwd-relative `uploads` directory, uploads them to Cloudinary, and updates the stored URLs.

These observable flows do not establish whether any currently tracked image is still referenced by deployed data.

## Retention decision

The completed local relocation does not assign ownership, retention, or production usage. Do not delete the 59 tracked image files until a data owner verifies their references, retention requirements, and whether any are required as fixtures or seed assets.

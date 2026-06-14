# File Storage Runbook

PRISM stores uploaded files (mentor **resources**, **resume** PDFs, profile **avatars**)
through a single adapter, `server/utils/storage/`. The active backend is chosen by
the `STORAGE_DRIVER` env var — **no code changes** are needed to switch.

| Driver | Where files live | When to use |
| ------ | ---------------- | ----------- |
| `local` (default) | `server/uploads/<folder>/`, served at `/uploads/...` | Dev, single-server, or a college box with disk |
| `s3` | Amazon S3 **or** any S3-compatible store (MinIO) | Production / when you need durable, shared, CDN-able storage |

Routes only ever call `storage.saveFile({ buffer, mimeType, originalName, folder })`
and `storage.deleteFile(key)`. Folders in use: `resources/`, `resumes/`, `avatars/`.

> ⚠️ In-app preview (PDF inline viewer, Microsoft Office viewer, `<img>` avatars)
> needs the file to be **publicly readable over HTTPS**. Both runbooks below cover that.

---

## Option A — Amazon S3

### 1. Create the bucket
1. S3 console → **Create bucket** → pick a globally-unique name (e.g. `prism-uploads-prod`) and a region (e.g. `ap-south-1`).
2. Leave **Block all public access** ON for now if you'll front it with CloudFront (recommended); turn it OFF only if you use the public bucket policy in step 4.

### 2. Create a least-privilege IAM user
1. IAM → **Users → Create user** (programmatic access, no console).
2. Attach an inline policy scoped to just this bucket:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::prism-uploads-prod/*"
       }
     ]
   }
   ```
3. Save the **Access key ID** and **Secret access key**.

### 3. CORS (so the browser can fetch/preview files)
Bucket → **Permissions → CORS**:
```json
[
  {
    "AllowedOrigins": ["https://your-client-domain.com", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```
(Uploads go through the **server**, not the browser, so `PUT` from the browser is not required.)

### 4. Make files readable — pick ONE
- **CloudFront (recommended):** create a distribution with the bucket as origin (Origin Access Control), then set `S3_PUBLIC_BASE_URL=https://dxxxx.cloudfront.net`. Keep public access blocked.
- **Public bucket policy (simpler, less ideal):** turn off "Block public access" and add:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::prism-uploads-prod/*"
    }]
  }
  ```
  Leave `S3_PUBLIC_BASE_URL` empty — the adapter builds `https://<bucket>.s3.<region>.amazonaws.com/<key>`.

### 5. Configure `server/.env`
```bash
STORAGE_DRIVER=s3
S3_BUCKET=prism-uploads-prod
S3_REGION=ap-south-1
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://dxxxx.cloudfront.net   # only if using CloudFront; else leave empty
# S3_ENDPOINT stays empty for real AWS
```
Restart the server. Upload a resource/resume/avatar and confirm the returned URL serves the file.

---

## Option B — MinIO / college object store (S3-compatible)

Use this when you have an on-campus / self-hosted S3-compatible store and no AWS account.

### 1. Run or obtain MinIO
Local example (Docker):
```bash
docker run -d --name minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
  quay.io/minio/minio server /data --console-address ":9001"
```
Console at `http://localhost:9001`.

### 2. Create bucket + access keys
1. In the console, create a bucket (e.g. `prism-uploads`).
2. Set its **Access Policy** to allow anonymous **read** (download) so previews work, or front it with your own reverse proxy + `S3_PUBLIC_BASE_URL`.
3. Create an **Access Key / Secret Key** pair.

### 3. Configure `server/.env`
```bash
STORAGE_DRIVER=s3
S3_BUCKET=prism-uploads
S3_REGION=us-east-1            # MinIO ignores region, but the SDK needs a value
S3_ACCESS_KEY_ID=<minio access key>
S3_SECRET_ACCESS_KEY=<minio secret key>
S3_ENDPOINT=http://your-minio-host:9000   # path-style is auto-enabled for custom endpoints
# S3_PUBLIC_BASE_URL=https://files.yourcollege.edu   # optional, if proxied behind a domain/CDN
```
Setting `S3_ENDPOINT` switches the adapter to path-style URLs
(`<endpoint>/<bucket>/<key>`) — see `server/utils/storage/s3.js`.

---

## Switching back to local
Set `STORAGE_DRIVER=local` (and ensure `SERVER_PUBLIC_URL` points at the server's
public origin). Existing files already on S3 keep their stored URLs; only **new**
uploads land on disk. No code change required.

## Verifying
- `local`: upload → file appears under `server/uploads/<folder>/` and is served at `/uploads/...`.
- `s3`/MinIO: upload → object appears in the bucket and the returned URL opens in a browser.
- Replace/delete flows (avatars, resources) call `storage.deleteFile(key)` — confirm the old object is removed.

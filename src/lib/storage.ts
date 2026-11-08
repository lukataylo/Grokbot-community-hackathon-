import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";
import { env } from "./env";

// Bucket when configured (Railway/R2/S3), local disk otherwise (dev and tests).
const useS3 = !!(env.s3.endpoint && env.s3.bucket && env.s3.key);
const client = useS3
  ? new S3Client({ endpoint: env.s3.endpoint, region: env.s3.region, credentials: { accessKeyId: env.s3.key, secretAccessKey: env.s3.secret }, forcePathStyle: true })
  : null;

export async function put(key: string, body: Buffer, type = "image/jpeg") {
  if (client) { await client.send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: body, ContentType: type })); return; }
  const p = path.join(env.localStore, key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

export async function get(key: string): Promise<Buffer | null> {
  try {
    if (client) {
      const r = await client.send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }));
      return Buffer.from(await r.Body!.transformToByteArray());
    }
    return await fs.readFile(path.join(env.localStore, key));
  } catch { return null; }
}

export async function del(key: string) {
  try {
    if (client) await client.send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    else await fs.unlink(path.join(env.localStore, key));
  } catch { /* already gone */ }
}


import { getApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadBatchPhoto(batchId: string, file: File) {
  const storage = getStorage(getApp());
  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const path = `batches/${batchId}/photos/${fileName}`;
  const r = ref(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}

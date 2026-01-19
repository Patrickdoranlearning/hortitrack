import { createClient } from '@/lib/supabase/client';

/**
 * Upload a photo to Supabase Storage and return the public URL.
 * 
 * @param file The file to upload
 * @param bucket The storage bucket name
 * @param path The path within the bucket (e.g., 'scouts/loc-1/photo.jpg')
 * @returns The public URL of the uploaded photo
 */
export async function uploadPhoto(file: File, bucket: string, path: string): Promise<string> {
  const supabase = createClient();

  // Upload the file
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return publicUrl;
}

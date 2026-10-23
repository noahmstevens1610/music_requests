// Keep uploads below typical serverless function request-body limits.
const TARGET_BYTES = 3.5 * 1024 * 1024;
const MAX_DIMENSION = 1920;

export async function preparePhotoForUpload(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES) return file;
  if (typeof createImageBitmap !== "function") {
    throw new Error("This photo is too large to upload directly. Please choose an image under 3.5 MB.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Unable to resize this photo in your browser. Please save it as a JPG under 3.5 MB and try again.");
  }
  try {
    const ratio = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare the image for upload.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.72, 0.58]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= TARGET_BYTES) {
        return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {type:"image/jpeg"});
      }
    }
    throw new Error("The photo is still too large after resizing. Please choose a smaller photo.");
  } finally {
    bitmap.close();
  }
}

export async function readPhotoApiResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    const result: unknown = JSON.parse(text);
    if (typeof result === "object" && result !== null && !Array.isArray(result)) return result as Record<string, unknown>;
  } catch { /* HTML or plain text error page */ }
  if (response.status === 413) throw new Error("Photo is too large for the upload server. Try a smaller image.");
  if (!response.ok) throw new Error(`Upload server returned HTTP ${response.status} instead of a photo result. Check the Vercel function logs for /api/photos/upload.`);
  throw new Error("Upload server returned an unexpected response.");
}

// Resizes an image and re-encodes as JPEG, shrinking quality/dimensions
// iteratively until the result is at or under targetBytes, to keep
// stored progress photos small (max 1.5MB raw upload ceiling on the backend).
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.75,
  targetBytes = 1.5 * 1024 * 1024 // 1.5MB
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const baseWidth = bitmap.width;
  const baseHeight = bitmap.height;

  const renderAt = (dimension: number, q: number): Promise<Blob | null> => {
    let width = baseWidth;
    let height = baseHeight;
    if (width > dimension || height > dimension) {
      if (width > height) {
        height = Math.round((height / width) * dimension);
        width = dimension;
      } else {
        width = Math.round((width / height) * dimension);
        height = dimension;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
  };

  // Progressively more aggressive passes: shrink quality first, then dimensions.
  const attempts: { dimension: number; quality: number }[] = [
    { dimension: maxDimension, quality },
    { dimension: maxDimension, quality: 0.6 },
    { dimension: maxDimension, quality: 0.45 },
    { dimension: 1200, quality: 0.5 },
    { dimension: 1000, quality: 0.45 },
    { dimension: 800, quality: 0.4 },
  ];

  let bestBlob: Blob | null = null;

  for (const attempt of attempts) {
    const blob = await renderAt(attempt.dimension, attempt.quality);
    if (!blob) continue;
    if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
    if (blob.size <= targetBytes) {
      bestBlob = blob;
      break;
    }
  }

  if (!bestBlob) return file; // fallback: upload original if canvas unsupported

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([bestBlob], newName, { type: 'image/jpeg' });
}
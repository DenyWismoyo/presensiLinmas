/**
 * Utilitas Kompresi Gambar Client-Side untuk Foto Selfie Presensi Linmas
 * Menjaga ukuran foto di bawah 100 KB agar upload cepat di jaringan seluler.
 */

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  dataUrl: string;
}

export async function compressImage(
  file: File | Blob,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.72
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Hitung aspect ratio resize
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal mendapatkan 2D context canvas.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Kompresi canvas toBlob gagal.'));
              return;
            }

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve({
              blob,
              originalSize: file.size,
              compressedSize: blob.size,
              dataUrl,
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Gagal memproses file gambar.'));
    };

    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
  });
}

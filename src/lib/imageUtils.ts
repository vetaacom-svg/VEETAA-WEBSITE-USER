export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const base64ToDataUrl = (base64: string, mimeType: string = 'image/jpeg'): string => {
  return `data:${mimeType};base64,${base64}`;
};

export const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not compress image'))), 'image/jpeg', quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

/** Rejette avec `Error('compress-timeout')` après `timeoutMs`. */
export function compressDataUrlWithTimeout(
  dataUrl: string,
  maxWidth: number,
  quality: number,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const to = window.setTimeout(() => reject(new Error('compress-timeout')), timeoutMs);
    compressDataUrl(dataUrl, maxWidth, quality)
      .then((v) => {
        window.clearTimeout(to);
        resolve(v);
      })
      .catch((e) => {
        window.clearTimeout(to);
        reject(e);
      });
  });
}

export const compressDataUrl = (dataUrl: string, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
  });
};

export const imageToBase64Compressed = async (file: File): Promise<string> => {
  try {
    const compressed = await compressImage(file);
    return await fileToBase64(compressed);
  } catch {
    return await fileToBase64(file);
  }
};

export const getBase64Size = (base64: string): number => {
  const padding = (base64.match(/=/g) || []).length;
  return (base64.length * 0.75 - padding) / 1024;
};

export const validateImageSize = (base64: string, maxSizeKB: number = 500): boolean => {
  return getBase64Size(base64) <= maxSizeKB;
};

/** Web: no Capacitor. Use standard web APIs. */
export const makePhoneCall = (phoneNumber: string): void => {
  const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
  window.open(`tel:${cleanNumber}`, '_self');
};

export const openMaps = (latitude: number, longitude: number, label?: string): void => {
  const encodedLabel = label ? encodeURIComponent(label) : '';
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    '_blank'
  );
};

export const shareContent = async (text: string, url?: string): Promise<void> => {
  if (navigator.share) {
    try {
      await navigator.share({ text, url });
    } catch (e) {
      console.log('Share cancelled or failed:', e);
    }
  } else {
    const shareText = url ? `${text} ${url}` : text;
    navigator.clipboard?.writeText(shareText);
    alert('Lien copié dans le presse-papiers!');
  }
};

export const isNative = (): boolean => false;
export const getPlatform = (): string => 'web';

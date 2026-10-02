/**
 * Converts a Blob object to a base64 encoded string.
 * @param blob The Blob to convert.
 * @returns A promise that resolves with the base64 string (without the data URL prefix).
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const base64data = reader.result as string;
            // remove the data url prefix
            resolve(base64data.split(',')[1]);
        };
        reader.onerror = (error) => reject(error);
    });
};
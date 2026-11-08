/** Shrink a phone photo to 640 px as a JPEG data URL before it leaves the phone. */
export async function shrinkPhoto(file) {
	const bmp = await createImageBitmap(file);
	const s = Math.min(1, 640 / Math.max(bmp.width, bmp.height));
	const cv = document.createElement('canvas');
	cv.width = Math.round(bmp.width * s);
	cv.height = Math.round(bmp.height * s);
	cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
	return cv.toDataURL('image/jpeg', 0.8);
}

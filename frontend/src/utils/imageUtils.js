export function getAvatarFocusLimits() {
  return { min: 0, max: 100 };
}

export async function cropImageToAvatarBlob(imageSource, focusX, focusY, scale, outputSize = 256, domMetrics = null, previewRect = null) {
  let objectUrl = null;
  try {
    const img = new Image();
    if (typeof imageSource === "string") {
      img.crossOrigin = "anonymous";
    }
    const src = imageSource instanceof File ? (objectUrl = URL.createObjectURL(imageSource)) : imageSource;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = src;
    });

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    let srcX = 0;
    let srcY = 0;
    let cropSize = Math.min(imgW, imgH);
    let domDraw = null;

    if (domMetrics?.imageRect && domMetrics?.selectorRect) {
      const imageRect = domMetrics.imageRect;
      const selectorRect = domMetrics.selectorRect;
      const selectorClientWidth = domMetrics.selectorClientWidth || selectorRect.width;
      const selectorClientHeight = domMetrics.selectorClientHeight || selectorRect.height;

      const borderX = Math.max(0, (selectorRect.width - selectorClientWidth) / 2);
      const borderY = Math.max(0, (selectorRect.height - selectorClientHeight) / 2);
      const selectionLeft = selectorRect.left + borderX;
      const selectionTop = selectorRect.top + borderY;
      const selectionSize = Math.min(selectorClientWidth, selectorClientHeight);

      // Use uniform scale to avoid distortion (object-fit: contain)
      const fitInElement = Math.min(imageRect.width / imgW, imageRect.height / imgH);
      if (fitInElement > 0) {
        const bitmapW = imgW * fitInElement;
        const bitmapH = imgH * fitInElement;
        const bitmapLeft = imageRect.left + (imageRect.width - bitmapW) / 2;
        const bitmapTop = imageRect.top + (imageRect.height - bitmapH) / 2;

        const outScale = outputSize / Math.max(selectionSize, 1);
        domDraw = {
          dx: (bitmapLeft - selectionLeft) * outScale,
          dy: (bitmapTop - selectionTop) * outScale,
          dw: bitmapW * outScale,
          dh: bitmapH * outScale,
        };
      }
    } else {
      const s = Math.max(0.5, Math.min(2, scale / 100));
      const previewW = previewRect?.width || 400;
      const previewH = previewRect?.height || 225;
      const innerW = 2 * previewW;
      const innerH = 2 * previewH;
      const fit = Math.min(innerW / imgW, innerH / imgH);

      const drawnW = imgW * fit;
      const drawnH = imgH * fit;
      const imgOffsetX = (innerW - drawnW) / 2;
      const imgOffsetY = (innerH - drawnH) / 2;
      const txPct = -50 + (focusX - 50) * 1.5;
      const tyPct = -50 + (focusY - 50) * 1.5;
      const tx = (txPct / 100) * innerW;
      const ty = (tyPct / 100) * innerH;
      const originX = innerW / 2;
      const originY = innerH / 2;
      const previewCenterX = previewW / 2;
      const previewCenterY = previewH / 2;

      const innerCenterX = originX + (previewCenterX - previewW / 2 - originX - tx) / s;
      const innerCenterY = originY + (previewCenterY - previewH / 2 - originY - ty) / s;
      const imageCenterX = (innerCenterX - imgOffsetX) / fit;
      const imageCenterY = (innerCenterY - imgOffsetY) / fit;
      const circleD = 0.52 * previewW;
      cropSize = circleD / (s * fit);
      srcX = imageCenterX - cropSize / 2;
      srcY = imageCenterY - cropSize / 2;
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outputSize;
    outCanvas.height = outputSize;
    const oCtx = outCanvas.getContext("2d");
    oCtx.fillStyle = "#f4f8f5";
    oCtx.fillRect(0, 0, outputSize, outputSize);
    oCtx.beginPath();
    oCtx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    oCtx.closePath();
    oCtx.clip();
    if (domDraw) {
      oCtx.drawImage(img, domDraw.dx, domDraw.dy, domDraw.dw, domDraw.dh);
    } else {
      oCtx.drawImage(img, srcX, srcY, cropSize, cropSize, 0, 0, outputSize, outputSize);
    }

    return new Promise((resolve) => outCanvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92));
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

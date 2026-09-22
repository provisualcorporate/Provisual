/**
 * compressImage.ts
 *
 * Comprime uma imagem no browser usando a Canvas API antes de a enviar
 * para o Supabase Storage.  O algoritmo tenta manter a maior qualidade
 * possível reduzindo iterativamente a qualidade JPEG/WebP até o ficheiro
 * ficar abaixo de TARGET_KB.
 *
 * Estratégia:
 *  1. Se o ficheiro original já estiver abaixo do limite, devolve-o sem tocar.
 *  2. Caso contrário, converte para JPEG (ou WebP se suportado) e reduz a
 *     qualidade em passos de 0.05 desde 0.92 até ao mínimo de 0.30.
 *  3. Se mesmo com qualidade mínima não atingir o limite, reduz também as
 *     dimensões em 75 %, 60 % e 50 % do original, tentando novamente em
 *     cada escala.
 *  4. Devolve sempre o melhor resultado obtido (menor tamanho <= alvo, ou
 *     o menor ficheiro possível caso não seja possível atingir o alvo).
 */

/** Tamanho máximo desejado em bytes (50 KB) */
const TARGET_BYTES = 50 * 1024;

/** Qualidade inicial (0-1) — JPEG/WebP */
const QUALITY_START = 0.92;

/** Passo de redução de qualidade a cada tentativa */
const QUALITY_STEP = 0.05;

/** Qualidade mínima a tentar antes de escalar a imagem */
const QUALITY_MIN = 0.30;

/** Escalas de dimensão a tentar quando a qualidade mínima não é suficiente */
const SCALE_STEPS = [0.75, 0.60, 0.50];

/** Escolhe o melhor output type disponível no browser */
function preferredOutputType(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const dataUrl = canvas.toDataURL('image/webp');
  return dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
}

/**
 * Desenha `img` numa canvas com a escala dada e exporta para Blob.
 */
async function canvasToBlob(
  img: HTMLImageElement,
  scale: number,
  quality: number,
  outputType: string,
): Promise<Blob | null> {
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), outputType, quality);
  });
}

/**
 * Carrega um File/Blob como HTMLImageElement.
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível carregar a imagem.'));
    };
    img.src = url;
  });
}

/** Constrói um `File` a partir de um `Blob`, ajustando o nome do ficheiro. */
function blobToFile(blob: Blob, originalName: string, ext: string, mimeType: string): File {
  const baseName = originalName.replace(/\.[^.]+$/, '');
  const newName = `${baseName}.${ext}`;
  return new File([blob], newName, { type: mimeType });
}

/**
 * Comprime `file` para no máximo 50 KB.
 *
 * @param file   Ficheiro de imagem original (qualquer formato suportado pelo browser).
 * @returns      Um novo `File` comprimido com o mesmo nome mas extensão
 *               ajustada ao formato de saída (webp ou jpg).
 */
export async function compressImage(file: File): Promise<File> {
  // Ficheiros não-imagem ou já suficientemente pequenos: devolver tal-qual.
  if (!file.type.startsWith('image/') || file.size <= TARGET_BYTES) {
    return file;
  }

  // GIFs animados: não comprimimos para não perder animação.
  if (file.type === 'image/gif') {
    return file;
  }

  const outputType = preferredOutputType();
  const ext = outputType === 'image/webp' ? 'webp' : 'jpg';

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    // Se não conseguir carregar, devolve o original.
    return file;
  }

  let bestBlob: Blob | null = null;

  // Tentar diferentes qualidades à escala 1:1
  for (
    let q = QUALITY_START;
    q >= QUALITY_MIN - 0.001;
    q = Math.round((q - QUALITY_STEP) * 100) / 100
  ) {
    const blob = await canvasToBlob(img, 1.0, q, outputType);
    if (!blob) continue;

    if (bestBlob === null || blob.size < bestBlob.size) {
      bestBlob = blob;
    }

    if (blob.size <= TARGET_BYTES) {
      return blobToFile(blob, file.name, ext, outputType);
    }
  }

  // Se ainda não chegámos ao alvo, tentar com redução de dimensões.
  for (const scale of SCALE_STEPS) {
    for (
      let q = QUALITY_START;
      q >= QUALITY_MIN - 0.001;
      q = Math.round((q - QUALITY_STEP) * 100) / 100
    ) {
      const blob = await canvasToBlob(img, scale, q, outputType);
      if (!blob) continue;

      if (bestBlob === null || blob.size < bestBlob.size) {
        bestBlob = blob;
      }

      if (blob.size <= TARGET_BYTES) {
        return blobToFile(blob, file.name, ext, outputType);
      }
    }
  }

  // Devolver o melhor resultado obtido mesmo que ainda supere o alvo.
  if (bestBlob) {
    console.warn(
      `[compressImage] Nao foi possivel reduzir "${file.name}" abaixo de ${TARGET_BYTES / 1024} KB. ` +
      `Tamanho final: ${(bestBlob.size / 1024).toFixed(1)} KB.`,
    );
    return blobToFile(bestBlob, file.name, ext, outputType);
  }

  // Fallback: devolve original se tudo falhar.
  return file;
}

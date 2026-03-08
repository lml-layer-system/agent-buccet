import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function extractPdfTextWithOcr(pdfBytes: Uint8Array): Promise<{
  text: string;
  method: "pdftotext" | "ocr_fallback" | "none";
}> {
  const workdir = path.join(process.cwd(), ".tmp", "pdf-ocr", randomUUID());
  const pdfPath = path.join(workdir, "input.pdf");
  await fs.mkdir(workdir, { recursive: true });
  await fs.writeFile(pdfPath, pdfBytes);

  try {
    const textLayout = await runPdftotext(pdfPath, true);
    const textPlain = await runPdftotext(pdfPath, false);
    const textFirst = bestText([textLayout, textPlain]);
    if (scoreTextQuality(textFirst) >= 0.45 && textFirst.length >= 180) {
      return { text: textFirst, method: "pdftotext" };
    }

    const ocrText = await runTesseractFallback(pdfPath, workdir);
    const best = bestText([textFirst, ocrText]);
    if (best === ocrText && ocrText.length > 0) {
      return { text: ocrText, method: "ocr_fallback" };
    }
    if (textFirst.length > 0) {
      return { text: textFirst, method: "pdftotext" };
    }
    return { text: ocrText, method: ocrText.length > 0 ? "ocr_fallback" : "none" };
  } finally {
    await fs.rm(workdir, { recursive: true, force: true });
  }
}

async function runPdftotext(pdfPath: string, layout: boolean): Promise<string> {
  try {
    const args = layout ? ["-layout", "-enc", "UTF-8", pdfPath, "-"] : ["-enc", "UTF-8", pdfPath, "-"];
    const { stdout } = await execFileAsync("pdftotext", args, {
      maxBuffer: 16 * 1024 * 1024,
    });
    return normalizeText(stdout ?? "");
  } catch {
    return "";
  }
}

async function runTesseractFallback(pdfPath: string, workdir: string): Promise<string> {
  const prefix = path.join(workdir, "page");
  const runs = await Promise.all([
    runOcrPass(pdfPath, workdir, prefix, 300, ["-l", "eng", "--psm", "6", "--oem", "1"]),
    runOcrPass(pdfPath, workdir, `${prefix}-hq`, 400, ["-l", "eng", "--psm", "4", "--oem", "1"]),
  ]);
  return bestText(runs);
}

async function runOcrPass(
  pdfPath: string,
  workdir: string,
  prefix: string,
  dpi: number,
  tesseractArgs: string[],
): Promise<string> {
  try {
    await execFileAsync("pdftoppm", ["-png", "-r", String(dpi), pdfPath, prefix], {
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return "";
  }

  const entries = await fs.readdir(workdir);
  const escapedPrefix = escapeRegex(path.basename(prefix));
  const imagePattern = new RegExp(`^${escapedPrefix}-\\d+\\.png$`, "i");
  const images = entries
    .filter((name) => imagePattern.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const out: string[] = [];
  for (const image of images) {
    const imagePath = path.join(workdir, image);
    try {
      const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", ...tesseractArgs], {
        maxBuffer: 32 * 1024 * 1024,
      });
      const cleaned = normalizeText(stdout ?? "");
      if (cleaned.length > 0) {
        out.push(cleaned);
      }
    } catch {
      // Continue page-level OCR attempts.
    }
  }
  return out.join("\n\n");
}

function bestText(candidates: string[]): string {
  const ranked = candidates
    .map((text) => ({ text, score: scoreTextQuality(text) }))
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);
  return ranked[0]?.text ?? "";
}

function scoreTextQuality(text: string): number {
  if (!text) {
    return 0;
  }
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const weird = (text.match(/[^A-Za-z0-9\s.,;:()'"!?%/@_-]/g) ?? []).length;
  const density = letters / Math.max(1, text.length);
  const wordScore = Math.min(1, words / 120);
  const noisePenalty = Math.min(0.4, weird / Math.max(1, text.length));
  return density * 0.7 + wordScore * 0.3 - noisePenalty;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// FFT_ROOT if set (cron, containers), otherwise backend/ relative to this file.
export const ROOT = process.env.FFT_ROOT ?? path.resolve(here, '..');
export const OUT_DIR = path.join(ROOT, 'data', 'out');

export const TIERS_FILE = path.join(OUT_DIR, 'tiers.json');
export const BIG_BOARD_FILE = path.join(OUT_DIR, 'big_board_tiers.json');
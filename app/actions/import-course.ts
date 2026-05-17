'use server';

type CsvParseResult = {
  header: string[];
  rows: string[][];
};

const required = [
  'lesson_id',
  'lesson_title',
  'lesson_position',
  'question_position',
  'prompt',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_option',
  'explanation',
];

function parseCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    return { header: [], rows: [] };
  }

  const parseLine = (line: string) =>
    line.split(',').map((v) => v.trim());

  const header = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { header, rows };
}

export async function importCourseCsv(_formData: FormData) {
  return {
    ok: true,
    message: 'CSV parser repaired. Import logic can be reattached next.',
  };
}

export async function previewCourseCsv(formData: FormData) {
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return {
      ok: false,
      error: 'Keine CSV-Datei gefunden.',
      header: [],
      rows: [],
      missing: required,
    };
  }

  const text = await file.text();
  const { header, rows } = parseCsv(text);
  const missing = required.filter((col) => !header.includes(col));

  if (!header.length) {
    return {
      ok: false,
      error: 'CSV ist leer oder ungültig.',
      header,
      rows: [],
      missing: required,
    };
  }

  if (missing.length) {
    return {
      ok: false,
      error: 'Pflichtspalten fehlen.',
      header,
      rows: rows.slice(0, 10),
      missing,
    };
  }

  return {
    ok: true,
    error: null,
    header,
    rows: rows.slice(0, 10),
    missing: [],
  };
}

import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function extract(file: string) {
  const buf = fs.readFileSync(file);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  console.log('===', file.split('/').pop(), 'pages:', result.total, 'chars:', result.text.length);
  console.log(result.text.slice(0, 4000));
  await parser.destroy();
}

async function main() {
  await extract('public/prov/92024_bedomningsunderlag_b_maskinerna_ar_vara_vanner_text_och_fragor.pdf');
  console.log('\n\n==========\n\n');
  await extract('public/prov/92025_bedomingsunderlag_c_skrivuppgift.pdf');
}

main().catch(console.error);
import { generatePdfReport, generateHtmlReport, generateLifeWrapped } from '../src/reports/pdf.js';

async function test() {
  console.log('Testing PDF Report...');
  const pdf = await generatePdfReport('week');
  console.log('PDF generated size:', pdf.length, 'bytes');
  console.log('PDF header check:', pdf.slice(0, 5).toString());

  console.log('\nTesting HTML Report...');
  const html = generateHtmlReport('week');
  console.log('HTML generated length:', html.length, 'characters');

  console.log('\nTesting Annual Life Wrapped...');
  const wrapped = generateLifeWrapped(2026);
  console.log('Life Wrapped Commits:', wrapped.totalCommits);
  console.log(wrapped.asciiCard);
}

test().catch(console.error);

import { checkPackages } from './checker/index.ts';
const [ecosystem,...packages]=process.argv.slice(2);
if(ecosystem!=='npm'&&ecosystem!=='pypi') { console.error('Usage: npm run check -- npm|pypi name ...'); process.exitCode=1; }
else console.log(JSON.stringify(await checkPackages({ecosystem,packages}),null,2));

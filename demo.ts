import { AppDate, setAppDateLanguage } from './src/index';

async function demo() {
  console.log('=== Serbian Ijekavian ===');
  await setAppDateLanguage('sr-ije');

  const days = ['2024-01-07','2024-01-08','2024-01-09','2024-01-10','2024-01-11','2024-01-12','2024-01-13'];
  days.forEach(d => {
    const date = AppDate.fromDateString(d);
    console.log(date.format('dddd').padEnd(12), '-', date.toLocalizedDateString({ includeDayOfWeek: true }));
  });

  console.log('\n=== Serbian Ekavian ===');
  await setAppDateLanguage('sr');

  days.forEach(d => {
    const date = AppDate.fromDateString(d);
    console.log(date.format('dddd').padEnd(12), '-', date.toLocalizedDateString({ includeDayOfWeek: true }));
  });

  console.log('\n=== Full Date Examples ===');

  await setAppDateLanguage('sr-ije');
  console.log('Ijekavian:', AppDate.now().format('LLLL'));

  await setAppDateLanguage('sr');
  console.log('Ekavian:  ', AppDate.now().format('LLLL'));

  await setAppDateLanguage('de');
  console.log('German:   ', AppDate.now().format('LLLL'));
}

demo();

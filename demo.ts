import { AppDate, initializeAppDate } from "./src/index";

async function demo() {
  console.log("=== Serbian Ijekavian ===");
  await initializeAppDate({ language: "sr-ije", timeZone: "Europe/Zurich" });

  const days = [
    "2024-01-07",
    "2024-01-08",
    "2024-01-09",
    "2024-01-10",
    "2024-01-11",
    "2024-01-12",
    "2024-01-13",
  ];
  days.forEach((d) => {
    const date = AppDate.fromDateString(d);
    console.log(
      date.format("dddd").padEnd(12),
      "-",
      date.toLocalizedDateString({ includeDayOfWeek: true })
    );
  });

  console.log("\n=== Serbian Ekavian ===");
  await initializeAppDate({ language: "sr", timeZone: "Europe/Zurich" });

  days.forEach((d) => {
    const date = AppDate.fromDateString(d);
    console.log(
      date.format("dddd").padEnd(12),
      "-",
      date.toLocalizedDateString({ includeDayOfWeek: true })
    );
  });

  console.log("\n=== Full Date Examples ===");

  await initializeAppDate({ language: "sr-ije", timeZone: "Europe/Zurich" });
  console.log("Ijekavian:", AppDate.now().format("LLLL"));

  await initializeAppDate({ language: "sr", timeZone: "Europe/Zurich" });
  console.log("Ekavian:  ", AppDate.now().format("LLLL"));

  await initializeAppDate({ language: "de", timeZone: "Europe/Zurich" });
  console.log("German:   ", AppDate.now().format("LLLL"));
}

demo();

import type dayjs from "dayjs";

const locale: ILocale = {
  name: "sr-ije",
  weekdays:
    "Nedjelja_Ponedjeljak_Utorak_Srijeda_Četvrtak_Petak_Subota".split("_"),
  weekdaysShort: "Ned._Pon._Uto._Sri._Čet._Pet._Sub.".split("_"),
  weekdaysMin: "ne_po_ut_sr_če_pe_su".split("_"),
  months:
    "Januar_Februar_Mart_April_Maj_Jun_Jul_Avgust_Septembar_Oktobar_Novembar_Decembar".split(
      "_"
    ),
  monthsShort:
    "Jan._Feb._Mar._Apr._Maj_Jun_Jul_Avg._Sep._Okt._Nov._Dec.".split("_"),
  weekStart: 1,
  ordinal: (n) => `${n}.`,
  formats: {
    LT: "H:mm",
    LTS: "H:mm:ss",
    L: "DD.MM.YYYY",
    LL: "D. MMMM YYYY.",
    LLL: "D. MMMM YYYY. H:mm",
    LLLL: "dddd, D. MMMM YYYY. H:mm",
  },
  relativeTime: {
    future: "za %s",
    past: "prije %s",
    s: "nekoliko sekundi",
    m: "jedan minut",
    mm: "%d minuta",
    h: "jedan sat",
    hh: "%d sati",
    d: "jedan dan",
    dd: "%d dana",
    M: "jedan mjesec",
    MM: "%d mjeseci",
    y: "jednu godinu",
    yy: "%d godina",
  },
};

export default locale;

type ILocale = Parameters<typeof dayjs.locale>[0];

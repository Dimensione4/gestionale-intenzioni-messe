const fixedCelebrations: Record<string, string> = {
  "01-01": "Maria Santissima Madre di Dio",
  "03-19": "San Giuseppe",
  "06-29": "Santi Pietro e Paolo",
  "07-03": "San Tommaso Apostolo",
  "07-09": "Santa Veronica Giuliani",
  "08-15": "Assunzione della Beata Vergine Maria",
  "10-04": "San Francesco d’Assisi",
  "11-01": "Tutti i Santi",
  "12-08": "Immacolata Concezione",
  "12-25": "Natale del Signore",
};

export function getCelebrationOfDay(date: string): string | null {
  return fixedCelebrations[date.slice(5)] ?? null;
}

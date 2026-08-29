// version.js – Stand der Anwendung
//
// Das Versionsschema ist YYYY.MMDD.HHMM in UTC (z. B. 2026.829.1119): über
// Tages- und Jahresgrenzen hinweg monoton steigend, minutengenau und zugleich
// gültiges SemVer. Dieselbe Nummer trägt der Git-Tag und das GitHub-Release.
//
// Im Repository steht hier bewusst kein Datum: die Nummer entsteht erst beim
// Veröffentlichen. Der Workflow .github/workflows/release.yml ersetzt die Zeile
// unmittelbar vor dem Hochladen und schreibt nichts zurück – wer den Quelltext
// auscheckt und lokal ausliefert, sieht deshalb „Entwicklungsstand“.
export const VERSION = 'Entwicklungsstand';

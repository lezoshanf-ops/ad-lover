

# Plan: Neuen Admin-Account erstellen

## Zusammenfassung
Erstellung eines neuen Administrator-Accounts für Dr. Jens Fritze mit der E-Mail `j.fritze@fritze-it.solutions`.

## Zu erstellender Account

| Feld | Wert |
|------|------|
| E-Mail | j.fritze@fritze-it.solutions |
| Vorname | Jens |
| Nachname | Fritze |
| Rolle | Admin |
| Passwort | Wird generiert (z.B. `Fritze2024!`) |

## Technische Umsetzung

Die bestehende Edge Function `create-user` wird verwendet, um den Account zu erstellen. Diese Funktion:

1. Erstellt den Benutzer in der Authentifizierungstabelle
2. Legt automatisch ein Profil in der `profiles`-Tabelle an
3. Weist die Admin-Rolle in der `user_roles`-Tabelle zu

## Schritte

1. **Edge Function aufrufen** - Die `create-user` Funktion mit den Benutzerdaten aufrufen
2. **Verifizierung** - Prüfen, ob der Account erfolgreich erstellt wurde
3. **Zugangsdaten mitteilen** - Die Login-Daten werden dir nach erfolgreicher Erstellung angezeigt

## Sicherheitshinweis

Nach dem Erstellen sollte das Passwort beim ersten Login geändert werden.


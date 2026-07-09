---
name: Gestionale Intenzioni Messe
description: Agenda parrocchiale Windows leggibile, calma e affidabile
colors:
  primary-navy: "#173D61"
  primary-deep: "#142F4A"
  accent-gold: "#B69943"
  surface: "#FFFFFF"
  canvas: "#F5F2EB"
  ink: "#18202B"
  muted: "#5D6670"
  success: "#185B3B"
  danger: "#9F1D25"
  border: "#D8D4CB"
typography:
  headline:
    fontFamily: "Inter, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Inter, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "12px 22px"
    height: "54px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
    height: "52px"
---

# Design System: Gestionale Intenzioni Messe

## Overview

**Creative North Star: "L’agenda parrocchiale"**

Un prodotto da scrivania sobrio e leggibile, costruito attorno alla giornata e alle sue fasce orarie. La gerarchia deve aiutare un operatore non tecnico a capire immediatamente dove si trova, cosa può fare e come correggere un errore. Rifiuta l’aspetto dei gestionali datati e le decorazioni che competono con i dati.

**Key Characteristics:**

- Navigazione stabile e sempre visibile.
- Dati organizzati per giorno, ora e stato.
- Azioni grandi, nominate e coerenti.
- Storico permanente con eliminazioni reversibili.

## Colors

Il blu profondo struttura navigazione e azioni primarie; oro e colori semantici compaiono solo per selezione e stato.

**The One Accent Rule.** L’oro evidenzia oggi, focus e dettagli selezionati; non è decorazione diffusa.

## Typography

Una singola famiglia sans-serif serve l’intero prodotto. Titoli, dati e controlli usano peso e dimensione, mai font decorativi.

**The Read Once Rule.** Etichette e messaggi devono essere comprensibili alla prima lettura e non scendere sotto 18px.

## Elevation

Le superfici sono piatte e separate da tono e bordi. Le ombre sono riservate a dialoghi e notifiche temporanee.

**The Flat-by-Default Rule.** Nessuna card combina bordo sottile e ombra ampia.

## Components

### Buttons

Altezza minima 48px, raggio 8px, testo con verbo e oggetto. Primario blu, secondario bianco con bordo neutro, distruttivo rosso solo nella danger zone.

### Cards / Containers

Raggio massimo 16px, sfondo bianco e bordo neutro. Le liste operative usano righe e separatori, non card annidate.

### Inputs / Fields

Etichetta sempre sopra il controllo, bordo 2px e focus oro ad alto contrasto. Errore testuale immediatamente sotto il campo.

### Navigation

Sidebar blu a tutta altezza, fissa durante lo scroll. La voce attiva ha sfondo tonale e non dipende dal solo colore.

## Do's and Don'ts

### Do:

- **Do** mostrare fasce orarie, capienza e intenzioni nella vista giorno.
- **Do** usare conferme esplicite per azioni distruttive.
- **Do** conservare record eliminati nello storico e consentire il ripristino.
- **Do** separare le impostazioni in pagine tematiche.

### Don't:

- **Don't** ricreare gestionali datati, densi di tabelle e abbreviazioni incomprensibili.
- **Don't** usare icone senza testo, controlli piccoli o contrasti deboli.
- **Don't** cancellare fisicamente intenzioni o storico.
- **Don't** usare modali per la navigazione ordinaria quando basta un pannello o una pagina dedicata.

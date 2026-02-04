# Chatbot Metrics Baseline

Data: 3 febbraio 2026  
Ambito: baseline locale per chatbot UpdateLens (prima di App Insights completa).

## Metriche tracciate

- `query_submitted`: numero query inviate.
- `response_received`: numero risposte completate.
- `response_error`: errori in elaborazione risposta.
- `filters_applied`: utilizzo CTA/applicazione filtri dalla chat.

## Storage e formato

- Chiave localStorage: `updatelens.chat.metrics.v1`
- Servizio: `src/services/ChatTelemetryService.ts`
- Integrazione UI: `src/app/components/chat/ChatPanel.tsx`

## KPI baseline da monitorare

- Error rate = `response_error / query_submitted`
- Completion rate = `response_received / query_submitted`
- Apply rate = `filters_applied / response_received`

## Passo successivo (Azure)

Mappare gli stessi eventi in Application Insights mantenendo naming invariato.

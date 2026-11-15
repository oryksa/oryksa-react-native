<p align="center"><img src="https://app.oryksa.com/static/oryksa_logo.png" width="300" alt="ORYKSA"></p>

# @oryksa/react-native

[![English](https://img.shields.io/badge/English-30363d?style=for-the-badge)](README.md) [![Português](https://img.shields.io/badge/Portugu%C3%AAs-30363d?style=for-the-badge)](README.pt.md) [![Español](https://img.shields.io/badge/Espa%C3%B1ol-30363d?style=for-the-badge)](README.es.md) [![Français](https://img.shields.io/badge/Fran%C3%A7ais-0891b2?style=for-the-badge)](README.fr.md)

SDK React Native officiel d'**ORYKSA AI Employees** : mettez dans votre app iOS et Android un employé IA qui connaît déjà votre entreprise, avec un chat prêt à l'emploi identique au chat du site ORYKSA, avec le nom et la photo de votre IA.

1. Votre **serveur** garde la clé secrète et crée un jeton de session pour chaque utilisateur (`POST /v1/sessions`).
2. L'**app** n'utilise que ce jeton : `new OryksaClient({ getToken })` et `<OryksaChatButton client={client} lang="en" />`.
3. Chaque réponse de l'IA compte comme une interaction de votre forfait.

## Installer

```bash
npm install @oryksa/react-native
```

**Documentation complète:** https://developer.oryksa.com/fr/sdk-react-native

---

## À propos de l'auteur

**Weslley Harakawa** - Fondateur d'ORYKSA AI. À Lisbonne, Portugal. Spécialités : intelligence artificielle, développement web et mobile, tokenisation blockchain. Formation : University of the People.

- LinkedIn: https://www.linkedin.com/in/weslleyharakawa/
- ORYKSA AI Employees: https://oryksa.com (X: https://x.com/oryksa, Instagram: https://www.instagram.com/oryksaai, YouTube: https://www.youtube.com/@ORYKSAAI)

---

MIT License · ORYKSA AI Employees · W8 Atlantic Unipessoal Lda

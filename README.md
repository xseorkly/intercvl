# Inter-CVL ZESE — Nicosie

Site web pour les ateliers élèves.

## Contenu

- `index.html` — accueil des 5 ateliers
- `atelier1.html` — Atelier 1 : Faire Réseau
- `atelier2.html` — Atelier 2 : Vivre Réseau
- `atelier3.html` — Atelier 3 : Construire le Réseau
- `atelier-ia.html` — LAB IA : expérimenter et analyser
- `charte-ia.html` — Construire la Charte d’usage de l’IA pour la ZESE

Chaque atelier sauvegarde d’abord les réponses localement dans le navigateur (`localStorage`). Il n’utilise ni Supabase ni Firebase.

## PDF et Google Drive

Le site ne se contente plus d’ouvrir la fenêtre d’impression : il **génère réellement un fichier PDF dans le navigateur**.

Le bouton principal de chaque atelier est désormais :

**📄 Générer le PDF + l’enregistrer dans Drive**

Lors du clic :

1. le PDF est fabriqué dans le navigateur ;
2. le PDF et une sauvegarde JSON du carnet sont envoyés au Google Apps Script défini dans `drive-sync.js` ;
3. le script enregistre les fichiers dans un dossier `INTERCVL ZESE - Productions` du Drive de l’organisateur ;
4. si l’envoi échoue, le PDF est téléchargé localement automatiquement pour éviter toute perte.

Le bouton **☁️ Envoyer une copie du carnet (JSON)** reste disponible pour transmettre uniquement les données structurées du carnet.

### Important

Le fichier `Code.gs` fourni dans ce dossier doit remplacer l’ancien code du projet Apps Script et le déploiement Web doit être mis à jour. Voir `CONFIGURATION_DRIVE.md`.

Le moteur PDF est chargé côté navigateur au moment de la génération. Une connexion internet est donc nécessaire pour générer puis envoyer le PDF vers Drive.

## Données et transparence

Les prénoms, établissements, notes et productions sont sauvegardés localement pendant le travail. Ils quittent l’appareil uniquement lors d’une action explicite :

- génération/enregistrement du PDF dans Drive ;
- envoi volontaire d’une copie JSON du carnet.

Aucune donnée n’est envoyée automatiquement au simple chargement de la page.

## Atelier Charte IA

L’atelier Charte IA prolonge le LAB IA :

1. quatre pôles de réflexion ;
2. quatre rotations de 10 minutes ;
3. transformation des idées en articles ;
4. synthèse de chaque pôle ;
5. import local des quatre synthèses ;
6. Assemblée finale pour produire une charte de 10 à 12 articles ;
7. génération du PDF complet puis enregistrement dans Drive.

## Correctif génération PDF
Le générateur PDF vérifie désormais le rendu avant l'envoi vers Drive. Le rendu HTML n'est plus placé hors écran. Pour les rapports très longs ou si le moteur graphique échoue, un PDF texte de secours multipage est généré automatiquement afin qu'aucune production ne soit enregistrée sous forme de page blanche.


## Mise en page PDF - version design

Les PDF générés utilisent désormais une mise en page dédiée : couverture harmonisée AEFE/ZESE, sections structurées, blocs de réponses, tableaux améliorés, pagination et pied de page. Le contenu envoyé vers Drive est exactement le même PDF que celui généré localement.

# Enregistrement automatique des PDF dans Google Drive

## Déploiement configuré pour ce site

Le site est déjà configuré avec votre Application Web Apps Script :

- **ID de déploiement** : `AKfycbxeMAI2vOb_bn_R6JyXIfIcmzrtzrHe8kVJBK1nJjnaJ9GXPaMEvFv7vufA_Ww4pfVk4w`
- **URL Application Web utilisée par le site** : `https://script.google.com/macros/s/AKfycbxeMAI2vOb_bn_R6JyXIfIcmzrtzrHe8kVJBK1nJjnaJ9GXPaMEvFv7vufA_Ww4pfVk4w/exec`

L'URL de bibliothèque Apps Script (`/macros/library/...`) n'est **pas** utilisée par le site pour envoyer les productions. C'est bien l'URL `/exec` ci-dessus qui reçoit les PDF et les sauvegardes JSON.


Le site génère désormais **un vrai fichier PDF dans le navigateur**, puis l'envoie automatiquement vers Google Drive via `Code.gs`.

## Une seule mise à jour Apps Script est nécessaire

1. Ouvrir le projet Google Apps Script déjà utilisé pour l'Inter-CVL.
2. Remplacer l'ancien contenu de `Code.gs` par le fichier `Code.gs` fourni dans ce dossier.
3. Enregistrer.
4. Aller dans **Déployer > Gérer les déploiements**.
5. Modifier le déploiement de l'Application Web existante.
6. Choisir **Nouvelle version** puis **Déployer**.
7. Si Google demande une autorisation Drive, l'accepter avec le compte organisateur.

Si vous mettez à jour le déploiement existant, son URL reste normalement la même et `drive-sync.js` n'a rien à modifier.

## Ce qui se passe ensuite

Quand un élève clique sur :

**📄 Générer le PDF + l’enregistrer dans Drive**

le site :

1. génère réellement le PDF dans le navigateur ;
2. envoie le PDF + une sauvegarde JSON du carnet à Apps Script ;
3. Apps Script crée automatiquement dans votre Drive :
   - `INTERCVL ZESE - Productions/01 - Atelier 1 - Faire Reseau`
   - `INTERCVL ZESE - Productions/02 - Atelier 2 - Vivre Reseau`
   - `INTERCVL ZESE - Productions/03 - Atelier 3 - Construire le Reseau`
   - `INTERCVL ZESE - Productions/04 - LAB IA`
   - `INTERCVL ZESE - Productions/05 - Charte IA`
4. enregistre le PDF dans le bon dossier ;
5. garde également le JSON complet comme sauvegarde technique.

Si l'envoi Drive échoue, le site télécharge automatiquement le PDF sur l'ordinateur afin de ne pas perdre le travail.

## Bouton « copie du carnet »

Le bouton **☁️ Envoyer une copie du carnet (JSON)** reste disponible. Il n'envoie que les données structurées du carnet et ne génère pas de PDF.

## Données

Les réponses restent d'abord dans `localStorage` sur l'appareil de la table. Elles quittent l'appareil seulement lorsque l'utilisateur clique explicitement sur un bouton d'envoi ou sur le bouton de génération/enregistrement du PDF.

## Correctif PDF blanc
Cette version corrige le problème de PDF vide : le rendu graphique est vérifié avant l'envoi. Si le navigateur ne peut pas rendre correctement la mise en page graphique (document très long, limite de canvas, etc.), le site génère automatiquement un PDF texte de secours contenant toutes les traces textuelles au lieu d'envoyer une page blanche.

Après avoir remplacé `Code.gs`, redéployez l'application Web afin d'utiliser la version 3 du récepteur.


## Diagnostic v4 — à faire une seule fois

1. Remplacez `Code.gs` par la version v4 fournie.
2. Dans Apps Script, choisissez la fonction `setupIntercvl` puis cliquez sur **Exécuter**.
3. Acceptez les autorisations Google Drive demandées.
4. Faites **Déployer > Gérer les déploiements > Modifier**.
5. Choisissez **Nouvelle version** puis vérifiez :
   - **Exécuter en tant que : Moi** ;
   - **Qui a accès : Tout le monde / Anyone** (accès sans connexion, si cette option est proposée).
6. Cliquez sur **Déployer**.
7. Ouvrez directement l'URL `/exec` dans le navigateur. Elle doit afficher quelque chose de proche de :

```json
{"ok":true,"service":"INTERCVL ZESE Drive receiver","version":4,"driveReady":true}
```

Si vous voyez une page Google, un écran de connexion, une erreur HTML ou `driveReady:false`, l'envoi depuis le site ne pourra pas fonctionner correctement.

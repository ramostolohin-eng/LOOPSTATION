# LoopStation Worship — application Android

Station de boucles pour le culte : séquenceur en boucle continue (jusqu'à l'arrêt manuel), métronome avec BPM −/+/curseur/tap, gongs, hi-hats et percussions africaines (dont le **gangan**), enregistrement de vos propres rythmes au micro, séparation de pistes, et espace de stockage privé dans l'application.

Projet Android **natif** (Java + WebView, aucune dépendance tierce, pas de npm). L'interface est dans `android/app/src/main/assets/www/`.

## 1. Compiler l'APK

Prérequis : **Android Studio** (récent) — il apporte le SDK et le JDK 17.

**Option A (la plus simple) :** Android Studio → *Open* → choisir le dossier `android/` → attendre la synchro Gradle → brancher le téléphone (débogage USB activé) → ▶ *Run*.
APK à installer à la main : menu *Build → Build APK(s)*.

**Option B (ligne de commande)** : définir `ANDROID_HOME` (ou créer `android/local.properties` avec `sdk.dir=/chemin/vers/Android/sdk`), puis :
```bash
cd android
./gradlew assembleDebug        # Windows : gradlew.bat assembleDebug
# APK : app/build/outputs/apk/debug/app-debug.apk
```
Le premier build télécharge Gradle 8.9 et le plugin Android 8.5.2 (internet requis). Android 7.0 (API 24) minimum.

## 2. Serveur de séparation (onglet « Séparer »)

Demucs est trop lourd pour tourner dans le téléphone : la séparation s'exécute sur un ordinateur du même Wi-Fi (un GPU accélère beaucoup).
```bash
cd server
pip install -r requirements.txt
LOOP_TOKEN=un-secret uvicorn server:app --host 0.0.0.0 --port 8000
```
Dans l'app : Séparer → adresse `http://<IP-de-l-ordinateur>:8000`, jeton, choisir un morceau, **Séparer**. Les pistes sont téléchargées dans le stockage de l'app et jouables dans le lecteur (volume + mute par piste). Modèles : `htdemucs_6s` = voix, batterie, basse, guitare, piano, autres ; `htdemucs` = voix, batterie, basse, autres. HTTP local non chiffré : utilisez un jeton et un réseau de confiance.

## 3. Fonctionnement

- **Boucles** : touchez une case pour passer éteint → normal → accent. 8/12/16/24/32 pas par mesure de 4 temps. Planificateur à l'avance sur l'horloge audio : pas de trou à la reprise. BPM modifiable en direct.
- **Menu d'instruments** : gongs (4), hi-hats (3), percussions africaines (gangan ×5, djembé ×3, conga ×2, shekere, agogo ×2), batterie. Tous les sons sont **synthétisés par le code** (aucun enregistrement n'est fourni) ; le gangan est une approximation. Importez de vrais sons avec « Importer un sample » : ils apparaissent sous « Mes samples ».
- **Enregistrer** : « boucle synchronisée » capte N mesures calées sur la grille (décompte optionnel) et les ajoute comme piste en boucle ; réglez le *décalage de latence* si la prise est en avance/retard. Utilisez un casque. Un enregistreur de sample simple est aussi fourni.
- **Export** : « Exporter la boucle (WAV) » rend le motif + prises en WAV dans la bibliothèque (piste d'accompagnement). Le bouton ⬇ de chaque élément de la bibliothèque copie le fichier vers **Téléchargements/LoopStation** (visible par les autres applications).
- **Stockage** : dossier privé de l'app `…/files/LoopStation/{samples,loops,projects,recordings,separated}`, accessible via un pont natif (`MainActivity.java`).
- **Autorisations** : au premier lancement, une fenêtre explicative puis les demandes système : **micro**, et **stockage sur Android 9 et antérieur** uniquement. Sur Android 10+ aucune autorisation de stockage n'existe pour le dossier privé de l'app, donc aucune demande n'apparaît ; l'export vers Téléchargements passe par MediaStore, sans autorisation non plus.
- Bouton Retour : appuyer deux fois pour quitter (évite de couper la musique par erreur). L'écran reste allumé.

## 4. Limites à connaître avant dimanche

- **Cet APK n'a pas pu être compilé ni testé là où le code a été écrit** (pas d'Android SDK ni d'accès réseau). Vérifié : syntaxe JS/Python, XML valides, analyse syntaxique du Java, WAV, arithmétique du séquenceur (contexte audio simulé). **Non vérifié :** compilation Gradle, son réel, micro, pont de fichiers sur téléphone, serveur FastAPI/Demucs. Attendez-vous à corriger de petits défauts ; faites une répétition complète. Si le build échoue, envoyez-moi le message d'erreur exact.
- Une prise enregistrée change de **hauteur** si vous modifiez le BPM ensuite (pas d'étirement temporel).
- La lecture en arrière-plan / écran verrouillé n'est pas garantie : gardez l'app au premier plan.
- Le modèle 6 pistes est décrit par ses auteurs comme expérimental (guitare « correcte », piano avec bavures).
- Test rapide dans un navigateur de bureau : `python3 -m http.server -d android/app/src/main/assets/www 8080` puis http://localhost:8080 (stockage en IndexedDB).

## Sources
- WebView, WebResourceResponse, PermissionRequest, MediaStore : https://developer.android.com/reference
- Capacitor Filesystem / stockage scoped (raison de l'absence de permission de stockage) : https://capawesome.io/blog/android-scoped-storage-in-capacitor-apps/
- Demucs 6 pistes : https://github.com/facebookresearch/demucs , https://huggingface.co/schism-audio/htdemucs-6s-mlx
